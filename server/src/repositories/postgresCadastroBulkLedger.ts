import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import { captureAppliedCadastroBatch, type AppliedCadastroBatch } from '../services/cadastroBulkPolicy.js';
import type { CadastroBulkLedger } from '../services/cadastroBulkTransaction.js';

const uuid = z.string().uuid();
const contextSchema = z.object({ groupId: uuid, empresaId: uuid.nullish(), actorId: uuid,
  requestId: z.string().min(1).max(200) });
const storedSchema = z.object({ id: uuid, group_id: uuid, empresa_id: uuid.nullable(),
  entity: z.enum(['Cliente', 'Fornecedor', 'Produto']), actor_id: uuid, reversed: z.boolean(),
  items: z.array(z.object({ id: z.union([z.string().min(1).max(200), z.number().int().safe()]),
    before: z.object({ id: z.union([z.string(), z.number()]), group_id: uuid, empresa_id: uuid.nullable(), ativo: z.boolean() }).passthrough(),
    after: z.object({ id: z.union([z.string(), z.number()]), group_id: uuid, empresa_id: uuid.nullable(), ativo: z.boolean() }).passthrough(),
  }).strict()).min(1).max(500) });

/** No pool access: every call must receive the coordinator's active tenant transaction executor. */
export class PostgresCadastroBulkLedger implements CadastroBulkLedger {
  private scope(ctx: RequestContext) {
    const parsed = contextSchema.safeParse(ctx);
    if (!parsed.success) throw new AppError(403, 'BULK_CONTEXT_REQUIRED', 'Authenticated tenant context required');
    return { ...parsed.data, empresaId: parsed.data.empresaId ?? null };
  }

  async lock(ctx: RequestContext, batchId: string, q: DbQueryExecutor) {
    const scope = this.scope(ctx); uuid.parse(batchId);
    // Company-independent within the group: even an absent/cross-company key is serialized.
    await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`cadastro_bulk:${scope.groupId}:${batchId}`]);
    const result = await q.query(`SELECT id, group_id, empresa_id, entity, actor_id, reversed, items
      FROM cadastro_bulk_lotes WHERE group_id=$1 AND id=$2
        AND empresa_id IS NOT DISTINCT FROM $3::uuid FOR UPDATE`, [scope.groupId, batchId, scope.empresaId]);
    if (!result.rows.length) return null;
    const row = storedSchema.safeParse(result.rows[0]);
    if (!row.success) throw new AppError(409, 'BULK_EVIDENCE_INVALID', 'Stored batch evidence invalid');
    const batch = captureAppliedCadastroBatch(row.data.id, row.data.entity,
      { groupId: row.data.group_id, empresaId: row.data.empresa_id }, row.data.items);
    return { batch, actorId: row.data.actor_id, reversed: row.data.reversed };
  }

  async insert(ctx: RequestContext, rawBatch: AppliedCadastroBatch, q: DbQueryExecutor) {
    const scope = this.scope(ctx);
    if (rawBatch.scope.groupId !== scope.groupId || rawBatch.scope.empresaId !== scope.empresaId) {
      throw new AppError(403, 'BULK_SCOPE_DENIED', 'Batch scope mismatch');
    }
    const serialized = JSON.stringify(rawBatch.items);
    // A lossy JSON image cannot be reliable reversal evidence (undefined, NaN, Date, etc.).
    if (!isDeepStrictEqual(JSON.parse(serialized), rawBatch.items) || Buffer.byteLength(serialized) > 8388608) {
      throw new AppError(422, 'BULK_SNAPSHOT_INVALID', 'Batch snapshots must be lossless bounded JSON');
    }
    const batch = captureAppliedCadastroBatch(rawBatch.id, rawBatch.entity, rawBatch.scope, rawBatch.items);
    await q.query(`INSERT INTO cadastro_bulk_lotes(id,group_id,empresa_id,entity,actor_id,request_id,items)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [batch.id, scope.groupId, scope.empresaId, batch.entity,
      scope.actorId, scope.requestId, serialized]);
  }

  async markReversed(ctx: RequestContext, batchId: string, q: DbQueryExecutor) {
    const scope = this.scope(ctx); uuid.parse(batchId);
    const result = await q.query(`UPDATE cadastro_bulk_lotes SET reversed=true,reversed_at=now(),reversed_by=$4,reversal_request_id=$5
      WHERE group_id=$1 AND id=$2 AND empresa_id IS NOT DISTINCT FROM $3::uuid AND reversed=false
      RETURNING id`, [scope.groupId, batchId, scope.empresaId, scope.actorId, scope.requestId]);
    if (result.rows.length !== 1) throw new AppError(409, 'BULK_REVERSAL_CONFLICT', 'Batch missing or already reversed');
  }
}
