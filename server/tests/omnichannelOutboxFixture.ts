import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { RequestContext } from '../src/audit/types.js';
import { CatalogOutbox } from '../src/integrations/catalogOutbox.js';
import { boot } from './omnichannelFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

export async function outboxFixture(pg?: PGlite) {
  const f = await boot(pg);
  await f.pg.query("UPDATE produtos SET codigo='SYNTHETIC',workflow_status='PUBLICADO' WHERE id=$1", [S.produtoA]);
  const permissions = { Integracoes: { catalogo: ['publicar','visualizar'], 'catalogo-reprocessamento': ['editar'] } };
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
