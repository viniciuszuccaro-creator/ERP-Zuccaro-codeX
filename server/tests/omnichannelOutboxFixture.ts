import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { RequestContext } from '../src/audit/types.js';
import { CatalogOutbox } from '../src/integrations/catalogOutbox.js';
import { boot } from './omnichannelFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

export async function outboxFixture(pg?: PGlite) {
  const f = await boot(pg);
  await f.pg.query("UPDATE produtos SET codigo='SYNTHETIC',workflow_status='PUBLICADO' WHERE id=$1", [S.produtoA]);
  const permissions = { Integracoes: { catalogo: ['publicar','visualizar'], 'catalogo-reprocessamento': ['editar'], 'catalogo-reconciliacao': ['editar'] } };
  await f.pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), S.runtimeActorA]);
  const ctx: RequestContext = { groupId: S.groupA, empresaId: S.empresaA, actorId: S.runtimeActorA, scopeType: 'empresa', requestId: 'synthetic-outbox' };
  const outbox = new CatalogOutbox(f.db, f.runtime);
  async function event(overrides: { empresa?: string; type?: string; max?: number; payload?: unknown } = {}) {
    const id = randomUUID();
    await f.pg.query(`INSERT INTO integration_events(id,group_id,empresa_id,source,event_type,idempotency_key,payload,status,aggregate_type,aggregate_id,max_attempts)
      VALUES($1,$2,$3,'ERP',$4,$5,$6::jsonb,'pending','Produto',$7,$8)`,
    [id, S.groupA, overrides.empresa ?? S.empresaA, overrides.type ?? 'produto.publicado', `synthetic-${id}`,
      JSON.stringify(overrides.payload ?? { produtoId: S.produtoA, codigo: 'SYNTHETIC', workflowStatus: 'PUBLICADO', schemaVersion: 1 }), S.produtoA, overrides.max ?? 3]);
    return id;
  }
  return { ...f, ctx, outbox, event };
}

/** Growth fixture retains latest observer/current-attempt semantics without a provider. */
export async function assertHealthGrowth(f: Awaited<ReturnType<typeof outboxFixture>>) {
  await f.pg.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type,status,aggregate_type,aggregate_id,attempts) SELECT $1,$2,'ERP','produto.publicado','published','Produto',$3,2 FROM generate_series(1,150)",[S.groupA,S.empresaA,S.produtoA]);
  await f.pg.query(`INSERT INTO integration_events(group_id,empresa_id,source,event_type,status,aggregate_type,aggregate_id,payload,created_at)
    SELECT q.group_id,q.empresa_id,'ERP','catalogo.reconciliado','processed','IntegracaoEvento',q.id,
      jsonb_build_object('observer',o.observer,'sourceAttempt',CASE WHEN h.n=1 THEN '1' ELSE '2' END,
        'state',CASE WHEN h.n<3 THEN 'MISSING' ELSE o.state END),now()-(4-h.n)*interval '1 minute'
    FROM integration_events q CROSS JOIN (VALUES ('site','CONSISTENT'),('marketplace','CONFLICT'),('app','UNAVAILABLE')) o(observer,state)
      CROSS JOIN generate_series(1,3) h(n)
    WHERE q.group_id=$1 AND q.empresa_id=$2 AND q.event_type='produto.publicado'`,[S.groupA,S.empresaA]);
  const health=await f.outbox.health(f.ctx,60);
  if(health.consistent!==150||health.divergent!==150||health.unavailable!==150||health.unreconciled!==0)
    throw new Error('Health growth snapshot lost current attempt/observer semantics');
}
