import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext, AuditRepository } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { cadastroBulkPreflight, captureAppliedCadastroBatch, cadastroBulkReversalPlan,
  type CadastroBulkEntity, type CadastroBulkIdentity, type CadastroBulkRow,
  type Eligibility, type AppliedCadastroBatch, type AppliedBulkItem } from './cadastroBulkPolicy.js';
import { expectedPostgresBulkRestore } from './cadastroBulkPostgresSnapshot.js';

/** Implementations must use the supplied executor, including relation locks and canonical mutations. */
export interface CadastroBulkAdapter {
  entity: CadastroBulkEntity;
  permissionSection: string;
  readonly restoredTimestamp?: 'postgres_set_updated_at_json';
  inspect(ctx: RequestContext, ids: readonly CadastroBulkIdentity[], q: DbQueryExecutor): Promise<{ rows: CadastroBulkRow[]; eligibility: Eligibility[] }>;
  inactivate(ctx: RequestContext, id: CadastroBulkIdentity, q: DbQueryExecutor): Promise<CadastroBulkRow>;
  restore(ctx: RequestContext, id: CadastroBulkIdentity, q: DbQueryExecutor, evidence: AppliedBulkItem): Promise<CadastroBulkRow>;
}

export interface CadastroBulkLedger {
  // An absent key must also be serialized (transaction advisory lock or equivalent).
  lock(ctx: RequestContext, batchId: string, q: DbQueryExecutor): Promise<{ batch: AppliedCadastroBatch; actorId: string; reversed: boolean } | null>;
  insert(ctx: RequestContext, batch: AppliedCadastroBatch, q: DbQueryExecutor): Promise<void>;
  markReversed(ctx: RequestContext, batchId: string, q: DbQueryExecutor): Promise<void>;
}

const input = z.object({ batchId: z.string().uuid(), ids: z.array(z.union([z.string().min(1).max(200), z.number().int().safe()])).min(1).max(500),
  confirmation: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Server-only coordinator; no default adapters, fallback storage or HTTP activation. */
export class CadastroBulkTransaction {
  constructor(private readonly db: DbClient, private readonly rbac: RbacGuard,
    private readonly audit: AuditRepository, private readonly ledger: CadastroBulkLedger,
    private readonly adapter: CadastroBulkAdapter) {}

  private transaction<T>(ctx: RequestContext, action: 'inativar' | 'restaurar', fn: (q: DbQueryExecutor, context: RequestContext) => Promise<T>) {
    if (!ctx.actorId || !ctx.requestId || !this.db.withTenantContext) {
      throw new AppError(403, 'BULK_CONTEXT_REQUIRED', 'Authenticated tenant transaction required');
    }
    const context = Object.freeze({ ...ctx });
    return this.db.withTenantContext(context, () => this.db.withTransaction(async q => {
      await this.rbac.assertAllowed(context, 'Cadastros', this.adapter.permissionSection, action,
        { allowGlobalWildcard: false, executor: q });
      const result = await fn(q, context);
      await this.rbac.assertAllowed(context, 'Cadastros', this.adapter.permissionSection, action,
        { allowGlobalWildcard: false, executor: q });
      return result;
    }));
  }

  private async inspect(ctx: RequestContext, ids: readonly CadastroBulkIdentity[], q: DbQueryExecutor) {
    const checked = await this.adapter.inspect(ctx, ids, q);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId ?? null };
    const plan = cadastroBulkPreflight(this.adapter.entity, scope, ids, checked.rows, checked.eligibility);
    const confirmation = createHash('sha256').update(canonical({ actorId: ctx.actorId, scope,
      entity: this.adapter.entity, ids, rows: checked.rows, plan })).digest('hex');
    return { checked, scope, plan, confirmation };
  }

  preview(ctx: RequestContext, ids: readonly CadastroBulkIdentity[]) {
    return this.transaction(ctx, 'inativar', async (q, ctx) => {
      const { plan, confirmation } = await this.inspect(ctx, ids, q);
      return { ...plan, confirmation };
    });
  }

  execute(ctx: RequestContext, raw: unknown) {
    const request = input.parse(raw);
    return this.transaction(ctx, 'inativar', async (q, ctx) => {
      const previous = await this.ledger.lock(ctx, request.batchId, q);
      if (previous) throw new AppError(409, 'BULK_BATCH_EXISTS', 'Batch already recorded; no mutation repeated');
      const current = await this.inspect(ctx, request.ids, q);
      if (current.confirmation !== request.confirmation) throw new AppError(409, 'BULK_PREVIEW_STALE', 'Preview changed; confirmation required');
      if (current.plan.blocked) throw new AppError(409, 'BULK_RECORDS_BLOCKED', 'Batch contains blocked records');
      const pairs = [];
      for (const id of request.ids) {
        const before = current.checked.rows.find(row => typeof row.id === typeof id && row.id === id);
        if (!before) throw new AppError(409, 'BULK_RECORD_MISSING', 'Record changed');
        const snapshot = structuredClone(before);
        const after = await this.adapter.inactivate(ctx, id, q);
        pairs.push({ id, before: snapshot, after });
      }
      const batch = captureAppliedCadastroBatch(request.batchId, this.adapter.entity, current.scope, pairs);
      await this.ledger.insert(ctx, batch, q);
      await this.audit.append({ ...ctx, entity: 'CadastroBulk', entityId: batch.id, action: 'inactivate',
        afterData: { entity: batch.entity, count: batch.items.length } }, q);
      return { batchId: batch.id, affected: batch.items.length };
    });
  }

  reverse(ctx: RequestContext, rawBatchId: unknown) {
    const batchId = z.string().uuid().parse(rawBatchId);
    return this.transaction(ctx, 'restaurar', async (q, ctx) => {
      const stored = await this.ledger.lock(ctx, batchId, q);
      if (!stored || stored.batch.entity !== this.adapter.entity) throw new AppError(404, 'BULK_BATCH_NOT_FOUND', 'Batch not found');
      if (stored.reversed) throw new AppError(409, 'BULK_ALREADY_REVERSED', 'Batch already reversed');
      const { rows } = await this.adapter.inspect(ctx, stored.batch.items.map(item => item.id), q);
      const plan = cadastroBulkReversalPlan(stored.batch, { groupId: ctx.groupId, empresaId: ctx.empresaId ?? null }, rows);
      if (plan.some(item => !item.reversible)) throw new AppError(409, 'BULK_REVERSAL_CONFLICT', 'External changes prevent reversal');
      for (const item of stored.batch.items) {
        const expected = this.adapter.restoredTimestamp === 'postgres_set_updated_at_json'
          ? await expectedPostgresBulkRestore(item.before, q) : item.before;
        const restored = await this.adapter.restore(ctx, item.id, q, item);
        if (!isDeepStrictEqual(restored, expected)) {
          throw new AppError(409, 'BULK_RESTORE_MISMATCH', 'Restored snapshot mismatch');
        }
        captureAppliedCadastroBatch(batchId, stored.batch.entity, stored.batch.scope,
          [{ id: item.id, before: restored, after: item.after }]);
      }
      await this.ledger.markReversed(ctx, batchId, q);
      await this.audit.append({ ...ctx, entity: 'CadastroBulk', entityId: batchId, action: 'restore',
        afterData: { entity: stored.batch.entity, count: plan.length } }, q);
      return { batchId, affected: plan.length };
    });
  }
}
