import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { createDbClient } from './client.js';
import type { DbQueryExecutor } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort();
}

export async function applyMigrations(databaseUrl?: string) {
  const config = loadConfig({
    ...process.env,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    REQUIRE_DATABASE: 'true',
  });

  const db = createDbClient(config);
  if (!db.pool) {
    throw new Error('DATABASE_URL required to apply migrations');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
    )
  `);

  const applied = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
  const appliedSet = new Set(applied.rows.map((r) => r.id));
  const files = listMigrationFiles();
  const executed: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
    });
    executed.push(file);
  }

  await db.end();
  return { applied: [...appliedSet], executed, pending: files.filter((f) => !appliedSet.has(f) && !executed.includes(f)) };
}

export async function migrationStatus(databaseUrl?: string) {
  const config = loadConfig({
    ...process.env,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    REQUIRE_DATABASE: 'true',
  });
  const db = createDbClient(config);
  const files = listMigrationFiles();
  let applied: string[] = [];
  try {
    const result = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
    applied = result.rows.map((r) => r.id);
  } catch {
    applied = [];
  }
  await db.end();
  const appliedSet = new Set(applied);
  return {
    files,
    applied,
    pending: files.filter((f) => !appliedSet.has(f)),
  };
}

/** Read-only, aggregate-only gate. No classification can be inferred from current Produto. */
export async function pedidoHistorico026Preflight(db: DbQueryExecutor) {
  const role = await db.query<{ trusted: boolean }>(
    'SELECT COALESCE(rolsuper OR rolbypassrls,false) trusted FROM pg_roles WHERE rolname=current_user',
  );
  const trusted = role.rows[0]?.trusted === true;
  const tables = await db.query<{ pedidos: boolean; itens: boolean; migrations: boolean }>(
    "SELECT to_regclass('pedidos') IS NOT NULL pedidos,to_regclass('pedido_itens') IS NOT NULL itens,to_regclass('schema_migrations') IS NOT NULL migrations",
  );
  const available = tables.rows[0];
  if (!available?.pedidos || !available.itens) {
    return { gate: 'PEDIDO_026', blocked: true, reasons: ['PEDIDO_TABLES_MISSING', ...(!trusted ? ['UNTRUSTED_RLS_VISIBILITY'] : [])], pedidos: 0, itens: 0, porEmpresa: [] };
  }
  const columns = await db.query<{ cabecalho: boolean; item: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='pedidos'::regclass AND attname='tipo_comercial' AND NOT attisdropped) cabecalho,EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='pedido_itens'::regclass AND attname='tipo_comercial_snapshot' AND NOT attisdropped) item",
  );
  const [pedidoRows, itemRows, porEmpresaRows] = await Promise.all([
    db.query<{ total: number }>('SELECT count(*)::int total FROM pedidos'),
    db.query<{ total: number }>('SELECT count(*)::int total FROM pedido_itens'),
    db.query<{ group_id: string; empresa_id: string; pedidos: number }>(
      'SELECT group_id::text,empresa_id::text,count(*)::int pedidos FROM pedidos GROUP BY group_id,empresa_id ORDER BY group_id,empresa_id',
    ),
  ]);
  const pedidos = Number(pedidoRows.rows[0]?.total ?? 0);
  const itens = Number(itemRows.rows[0]?.total ?? 0);
  const itemScope = await db.query<{ scoped: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='pedido_itens'::regclass AND attname='group_id' AND NOT attisdropped) AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='pedido_itens'::regclass AND attname='empresa_id' AND NOT attisdropped) scoped",
  );
  const itemGroups = itemScope.rows[0]?.scoped
    ? await db.query<{ group_id: string; empresa_id: string; itens: number }>(
      'SELECT group_id::text,empresa_id::text,count(*)::int itens FROM pedido_itens GROUP BY group_id,empresa_id ORDER BY group_id,empresa_id',
    )
    : null;
  const companies = new Map<string, { groupId: string; empresaId: string; pedidos: number; itens: number | null }>();
  for (const row of porEmpresaRows.rows) {
    companies.set(`${row.group_id}:${row.empresa_id}`, { groupId: row.group_id, empresaId: row.empresa_id, pedidos: Number(row.pedidos), itens: itemGroups ? 0 : null });
  }
  for (const row of itemGroups?.rows ?? []) {
    const key = `${row.group_id}:${row.empresa_id}`;
    const summary = companies.get(key) ?? { groupId: row.group_id, empresaId: row.empresa_id, pedidos: 0, itens: 0 };
    summary.itens = Number(row.itens);
    companies.set(key, summary);
  }
  const cabecalho = columns.rows[0]?.cabecalho === true;
  const item = columns.rows[0]?.item === true;
  const itemLink = await db.query<{ linked: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='pedido_itens'::regclass AND attname='pedido_id' AND NOT attisdropped) linked",
  );
  const headerInvalid = cabecalho
    ? await db.query<{ total: number }>("SELECT count(*)::int total FROM pedidos WHERE tipo_comercial IS NULL OR tipo_comercial NOT IN ('REVENDA','ARMADO','CORTE_DOBRA','FABRICADO','KIT','SERVICO','MISTO')")
    : null;
  const itemInvalid = item
    ? await db.query<{ total: number }>("SELECT count(*)::int total FROM pedido_itens WHERE tipo_comercial_snapshot IS NULL OR tipo_comercial_snapshot NOT IN ('REVENDA','ARMADO','CORTE_DOBRA','FABRICADO','KIT','SERVICO')")
    : null;
  const canReconcile = cabecalho && item && itemScope.rows[0]?.scoped === true && itemLink.rows[0]?.linked === true;
  const orphanItems = canReconcile
    ? await db.query<{ total: number }>('SELECT count(*)::int total FROM pedido_itens i WHERE NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.id=i.pedido_id AND p.group_id=i.group_id AND p.empresa_id=i.empresa_id)')
    : null;
  const mismatchedHeaders = canReconcile
    ? await db.query<{ total: number }>(`WITH expected AS (
        SELECT p.id,p.tipo_comercial,
          CASE WHEN count(i.id)=0 OR count(i.id)<>count(i.tipo_comercial_snapshot) THEN NULL
            WHEN count(DISTINCT i.tipo_comercial_snapshot)=1 THEN min(i.tipo_comercial_snapshot)
            ELSE 'MISTO' END AS item_type
        FROM pedidos p LEFT JOIN pedido_itens i ON i.pedido_id=p.id AND i.group_id=p.group_id AND i.empresa_id=p.empresa_id
        GROUP BY p.id,p.tipo_comercial
      ) SELECT count(*)::int total FROM expected WHERE item_type IS NOT NULL AND item_type<>tipo_comercial`)
    : null;
  const reasons: string[] = [];
  if (!trusted) reasons.push('UNTRUSTED_RLS_VISIBILITY');
  if (pedidos > 0 && !cabecalho) reasons.push('PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED');
  if (itens > 0 && !item) reasons.push('PEDIDO_ITEM_HISTORICAL_TYPE_MAPPING_REQUIRED');
  if ((pedidos > 0 || itens > 0) && (cabecalho || item)) reasons.push('HISTORICAL_CLASSIFICATION_PROVENANCE_REQUIRED');
  if (Number(headerInvalid?.rows[0]?.total ?? 0) > 0) reasons.push('PEDIDO_TYPE_INVALID_OR_MISSING');
  if (Number(itemInvalid?.rows[0]?.total ?? 0) > 0) reasons.push('PEDIDO_ITEM_TYPE_INVALID_OR_MISSING');
  if (Number(orphanItems?.rows[0]?.total ?? 0) > 0) reasons.push('PEDIDO_ITEM_OWNER_MISMATCH');
  if (Number(mismatchedHeaders?.rows[0]?.total ?? 0) > 0) reasons.push('PEDIDO_HEADER_ITEM_TYPE_MISMATCH');
  const applied = available.migrations
    ? await db.query<{ present: boolean }>("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE id='026_pedidos_tipo_comercial.sql') present")
    : null;
  return {
    gate: 'PEDIDO_026', blocked: reasons.length > 0, reasons,
    migrationApplied: applied?.rows[0]?.present === true,
    columns: { cabecalho, item }, pedidos, itens,
    reconciliacao: {
      cabecalhosSemTipoValido: headerInvalid ? Number(headerInvalid.rows[0]?.total ?? 0) : null,
      itensSemTipoValido: itemInvalid ? Number(itemInvalid.rows[0]?.total ?? 0) : null,
      itensSemPedidoNoEscopo: orphanItems ? Number(orphanItems.rows[0]?.total ?? 0) : null,
      cabecalhosDivergentesDosItens: mismatchedHeaders ? Number(mismatchedHeaders.rows[0]?.total ?? 0) : null,
    },
    porEmpresa: [...companies.values()].sort((a, b) => `${a.groupId}:${a.empresaId}`.localeCompare(`${b.groupId}:${b.empresaId}`)),
  };
}

export async function pedidoHistorico026PreflightFromUrl(databaseUrl?: string) {
  const config = loadConfig({ ...process.env, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}), REQUIRE_DATABASE: 'true' });
  const db = createDbClient(config);
  try { return await pedidoHistorico026Preflight(db); }
  finally { await db.end(); }
}

async function main() {
  if (process.argv.includes('--preflight-pedido-026')) {
    const report = await pedidoHistorico026PreflightFromUrl();
    console.log(JSON.stringify(report, null, 2));
    if (report.blocked) process.exitCode = 2;
    return;
  }
  const statusOnly = process.argv.includes('--status');
  if (statusOnly) {
    const status = await migrationStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  const result = await applyMigrations();
  console.log(JSON.stringify(result, null, 2));
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
