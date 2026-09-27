import { createHash } from 'node:crypto';
import type { DbClient, DbQueryExecutor } from './client.js';

const itemTypes = new Set(['REVENDA', 'ARMADO', 'CORTE_DOBRA', 'FABRICADO', 'KIT', 'SERVICO']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HistoricalPedidoTypePlan = {
  expectedDatabase: string;
  groupId: string;
  reviewerProfileId: string;
  decisions: Array<{ itemId: string; type: string; evidence: string }>;
};

function validatePlan(value: unknown): HistoricalPedidoTypePlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('HISTORICAL_TYPE_PLAN_INVALID');
  const plan = value as Record<string, unknown>;
  if (Object.keys(plan).sort().join(',') !== 'decisions,expectedDatabase,groupId,reviewerProfileId'
    || typeof plan.expectedDatabase !== 'string' || !/^[a-zA-Z0-9_]{1,63}$/.test(plan.expectedDatabase)
    || typeof plan.groupId !== 'string' || !uuid.test(plan.groupId)
    || typeof plan.reviewerProfileId !== 'string' || !uuid.test(plan.reviewerProfileId)
    || !Array.isArray(plan.decisions) || plan.decisions.length < 1 || plan.decisions.length > 10000) {
    throw new Error('HISTORICAL_TYPE_PLAN_INVALID');
  }
  const seen = new Set<string>();
  for (const raw of plan.decisions) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || Object.keys(raw).sort().join(',') !== 'evidence,itemId,type') throw new Error('HISTORICAL_TYPE_PLAN_INVALID');
    const entry = raw as Record<string, unknown>;
    if (typeof entry.itemId !== 'string' || !uuid.test(entry.itemId)
      || typeof entry.type !== 'string' || !itemTypes.has(entry.type)
      || typeof entry.evidence !== 'string' || entry.evidence.trim().length < 12
      || entry.evidence.length > 500 || seen.has(entry.itemId.toLowerCase())) {
      throw new Error('HISTORICAL_TYPE_PLAN_INVALID');
    }
    seen.add(entry.itemId.toLowerCase());
  }
  return plan as HistoricalPedidoTypePlan;
}

type CountRow = { count: number };
async function count(tx: DbQueryExecutor, sql: string, params?: unknown[]): Promise<number> {
  const result = await tx.query<CountRow>(sql, params);
  return Number(result.rows[0]?.count ?? -1);
}

/** Transactionally classifies every old item from a privately reviewed plan, then runs canonical 026. */
export async function mapHistoricalPedidoTypes(db: DbClient, rawPlan: unknown, migration026: string) {
  const plan = validatePlan(rawPlan);
  if (!migration026.includes('PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED')) throw new Error('HISTORICAL_TYPE_MIGRATION_INVALID');
  const digest = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return db.withTransaction(async (tx) => {
    const dbName = await tx.query<{ name: string }>('SELECT current_database() AS name');
    if (dbName.rows[0]?.name !== plan.expectedDatabase) throw new Error('HISTORICAL_TYPE_DATABASE_MISMATCH');
    if (await count(tx, `SELECT count(*)::int AS count FROM pg_roles
      WHERE rolname=current_user AND (rolsuper OR rolbypassrls)`) !== 1) {
      throw new Error('HISTORICAL_TYPE_FULL_VISIBILITY_REQUIRED');
    }
    await tx.query('LOCK TABLE pedidos, pedido_itens IN SHARE ROW EXCLUSIVE MODE');
    const migrationState = await tx.query<{ id: string }>(
      "SELECT id FROM schema_migrations WHERE id IN ('025_pedidos_origem_canal_idempotency.sql','026_pedidos_tipo_comercial.sql')",
    );
    if (!migrationState.rows.some((row) => row.id === '025_pedidos_origem_canal_idempotency.sql')
      || migrationState.rows.some((row) => row.id === '026_pedidos_tipo_comercial.sql')) {
      throw new Error('HISTORICAL_TYPE_MIGRATION_ORDER_INVALID');
    }
    if (await count(tx, `SELECT count(*)::int AS count FROM pg_attribute
      WHERE (attrelid='pedidos'::regclass AND attname='tipo_comercial'
        OR attrelid='pedido_itens'::regclass AND attname='tipo_comercial_snapshot') AND NOT attisdropped`) !== 0) {
      throw new Error('HISTORICAL_TYPE_PARTIAL_SCHEMA');
    }
    if (await count(tx, `SELECT count(*)::int AS count FROM profiles
      WHERE id=$1 AND group_id=$2 AND role='admin' AND ativo AND empresa_id IS NULL`,
      [plan.reviewerProfileId, plan.groupId]) !== 1) throw new Error('HISTORICAL_TYPE_REVIEWER_INVALID');
    const orders = await count(tx, 'SELECT count(*)::int AS count FROM pedidos');
    const items = await count(tx, 'SELECT count(*)::int AS count FROM pedido_itens');
    if (orders < 1 || items !== plan.decisions.length
      || await count(tx, 'SELECT count(*)::int AS count FROM pedidos WHERE group_id<>$1 OR group_id IS NULL', [plan.groupId]) !== 0
      || await count(tx, 'SELECT count(*)::int AS count FROM pedido_itens WHERE group_id<>$1 OR group_id IS NULL', [plan.groupId]) !== 0) {
      throw new Error('HISTORICAL_TYPE_COVERAGE_INVALID');
    }
    await tx.query('CREATE TEMP TABLE historical_pedido_type_map(item_id uuid PRIMARY KEY, tipo text NOT NULL) ON COMMIT DROP');
    for (const decision of plan.decisions) {
      await tx.query('INSERT INTO historical_pedido_type_map(item_id,tipo) VALUES($1,$2)', [decision.itemId, decision.type]);
    }
    if (await count(tx, `SELECT count(*)::int AS count FROM pedido_itens i
      FULL JOIN historical_pedido_type_map m ON m.item_id=i.id
      WHERE i.id IS NULL OR m.item_id IS NULL OR i.group_id<>$1`, [plan.groupId]) !== 0
      || await count(tx, `SELECT count(*)::int AS count FROM pedido_itens i
        LEFT JOIN pedidos p ON p.id=i.pedido_id AND p.group_id=i.group_id AND p.empresa_id=i.empresa_id
        WHERE p.id IS NULL`) !== 0
      || await count(tx, `SELECT count(*)::int AS count FROM pedidos p
        WHERE NOT EXISTS (SELECT 1 FROM pedido_itens i WHERE i.pedido_id=p.id AND i.group_id=p.group_id AND i.empresa_id=p.empresa_id)`) !== 0) {
      throw new Error('HISTORICAL_TYPE_COVERAGE_INVALID');
    }
    await tx.query('ALTER TABLE pedidos ADD COLUMN tipo_comercial text');
    await tx.query('ALTER TABLE pedido_itens ADD COLUMN tipo_comercial_snapshot text');
    await tx.query(`UPDATE pedido_itens i SET tipo_comercial_snapshot=m.tipo
      FROM historical_pedido_type_map m WHERE i.id=m.item_id`);
    await tx.query(`UPDATE pedidos p SET tipo_comercial=types.tipo FROM (
      SELECT i.pedido_id, CASE WHEN count(DISTINCT i.tipo_comercial_snapshot)=1
        THEN min(i.tipo_comercial_snapshot) ELSE 'MISTO' END AS tipo
      FROM pedido_itens i GROUP BY i.pedido_id) types WHERE p.id=types.pedido_id`);
    if (await count(tx, 'SELECT count(*)::int AS count FROM pedidos WHERE tipo_comercial IS NULL') !== 0
      || await count(tx, 'SELECT count(*)::int AS count FROM pedido_itens WHERE tipo_comercial_snapshot IS NULL') !== 0) {
      throw new Error('HISTORICAL_TYPE_COVERAGE_INVALID');
    }
    await tx.query(migration026);
    await tx.query("INSERT INTO schema_migrations(id) VALUES('026_pedidos_tipo_comercial.sql')");
    await tx.query(`INSERT INTO audit_logs(group_id,empresa_id,actor_id,entity,entity_id,action,after_data,request_id)
      SELECT i.group_id,i.empresa_id,$1,'PedidoItem',i.id::text,'update',
        jsonb_build_object('tipo_comercial_snapshot',i.tipo_comercial_snapshot,'manifest_sha256',$2::text),$2::text
      FROM pedido_itens i`, [plan.reviewerProfileId, digest]);
    await tx.query(`INSERT INTO audit_logs(group_id,empresa_id,actor_id,entity,entity_id,action,after_data,request_id)
      SELECT p.group_id,p.empresa_id,$1,'Pedido',p.id::text,'update',
        jsonb_build_object('tipo_comercial',p.tipo_comercial,'manifest_sha256',$2::text),$2::text
      FROM pedidos p`, [plan.reviewerProfileId, digest]);
    return { mappedOrders: orders, mappedItems: items, manifestSha256: digest };
  });
}
