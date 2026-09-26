import { z } from 'zod';
import { randomInt } from 'node:crypto';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { AppError } from '../api/errors.js';
import { assertIntegrationEventsReady } from './saleIngress.js';
import { PostgresProdutoRepository } from '../repositories/postgresProdutoRepository.js';

const scope = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid(), requestId: z.string().min(1).max(128) });
export const catalogSignalSchema = z.object({ produtoId: z.string().uuid(), codigo: z.string().max(100).regex(/^[^<>\u0000-\u001f\u007f]*$/).nullable(),
  workflowStatus: z.literal('PUBLICADO'), schemaVersion: z.literal(1) }).strict();
export type CatalogLease = { id: string; produtoId: string; key: string; attempt: number; expiresAt: string; payload: unknown };
type Event = { id: string; idempotency_key: string; attempts: number; max_attempts: number; status: string;
  locked_until: Date; payload: unknown; aggregate_id: string };
const leaseSchema = z.object({ id: z.string().uuid(), attempt: z.number().int().positive(), expiresAt: z.string().datetime() });

/** Operates existing Produto publication events only. No provider, schema or parallel queue. */
export class CatalogOutbox {
  constructor(private readonly db: DbClient, private readonly guards: { auditRepo: AuditRepository; tenantGuard: TenantGuard; rbacGuard: RbacGuard }) {}

  private async authorize(ctx: RequestContext, section = 'catalogo', action: 'publicar' | 'editar' | 'visualizar' = 'publicar') {
    if (!scope.safeParse(ctx).success || ctx.scopeType !== 'empresa') throw new AppError(403, 'OUTBOX_SCOPE_REQUIRED', 'Explicit company scope required');
    await this.guards.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.guards.rbacGuard.assertAllowed(ctx, 'Integracoes', section, action, { allowGlobalWildcard: false });
    await assertIntegrationEventsReady(this.db);
  }

  private async scoped<T>(ctx: RequestContext, fn: (tx: DbQueryExecutor) => Promise<T>) {
    return this.db.withTransaction(async (tx) => {
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)", [ctx.groupId, ctx.empresaId]);
      return fn(tx);
    });
  }

  private async audit(ctx: RequestContext, tx: DbQueryExecutor, event: Event, status: string, attempts: number, code?: string, budget?: number) {
    await this.guards.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: event.id, action: 'update',
      beforeData: { status: event.status, attempts: event.attempts, maxAttempts: event.max_attempts },
      afterData: { status, attempts, maxAttempts: budget ?? event.max_attempts, ...(code ? { code } : {}) } }, tx);
  }

  async claim(ctx: RequestContext, limit = 10, leaseSeconds = 30): Promise<CatalogLease[]> {
    await this.authorize(ctx);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 300) {
      throw new AppError(422, 'OUTBOX_CLAIM_INVALID', 'Invalid claim bounds');
    }
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<Event>(`SELECT * FROM integration_events WHERE group_id=$1 AND empresa_id=$2
        AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto'
        AND ((status IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=clock_timestamp()))
          OR (status='processing' AND locked_until<=clock_timestamp()))
        ORDER BY created_at,id LIMIT $3 FOR UPDATE SKIP LOCKED`, [ctx.groupId, ctx.empresaId, limit]);
      const leases: CatalogLease[] = [];
      for (const event of result.rows) {
        if (event.attempts >= event.max_attempts || !event.idempotency_key) {
          const code = event.idempotency_key ? 'ATTEMPTS_EXHAUSTED' : 'OUTBOX_KEY_REQUIRED';
          await tx.query("UPDATE integration_events SET updated_at=clock_timestamp(),status='dead_letter',dead_letter_at=clock_timestamp(),locked_until=NULL,error_message=$4 WHERE id=$1 AND group_id=$2 AND empresa_id=$3", [event.id, ctx.groupId, ctx.empresaId, code]);
          await this.audit(ctx, tx, event, 'dead_letter', event.attempts, code); continue;
        }
        const changed = await tx.query<Event>(`UPDATE integration_events SET updated_at=clock_timestamp(),status='processing', attempts=attempts+1,
          locked_until=date_trunc('milliseconds',clock_timestamp())+($4*interval '1 second'), next_attempt_at=NULL
          WHERE id=$1 AND group_id=$2 AND empresa_id=$3 RETURNING *`, [event.id, ctx.groupId, ctx.empresaId, leaseSeconds]);
        const row = changed.rows[0];
        await this.audit(ctx, tx, event, 'processing', row.attempts);
        leases.push({ id: row.id, produtoId: row.aggregate_id, key: row.idempotency_key, attempt: row.attempts, expiresAt: row.locked_until.toISOString(), payload: row.payload });
      }
      return leases;
    });
  }

  async finish(ctx: RequestContext, lease: CatalogLease, outcome: { status: 'published' } | { status: 'retry' | 'dead_letter'; code: string }) {
    await this.authorize(ctx);
    if (!leaseSchema.safeParse(lease).success || !['published','retry','dead_letter'].includes(outcome.status)
      || ('code' in outcome && !/^[A-Z0-9_]{1,64}$/.test(outcome.code))) throw new AppError(422, 'OUTBOX_OUTCOME_INVALID', 'Invalid outcome');
    return this.scoped(ctx, async (tx) => {
      const selected = await tx.query<Event>(`SELECT * FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3
        AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto' AND status='processing'
        AND attempts=$4 AND locked_until=$5::timestamptz AND locked_until>clock_timestamp() FOR UPDATE`,
      [lease.id, ctx.groupId, ctx.empresaId, lease.attempt, lease.expiresAt]);
      const event = selected.rows[0];
      if (!event) throw new AppError(409, 'OUTBOX_LEASE_STALE', 'Lease is stale or unavailable');
      const status = outcome.status === 'retry' && event.attempts >= event.max_attempts ? 'dead_letter' : outcome.status;
      const code = 'code' in outcome ? outcome.code : null;
      const delay = Math.min(300, 2 ** Math.min(event.attempts, 8) + randomInt(0, 4));
      await tx.query(`UPDATE integration_events SET updated_at=clock_timestamp(),status=$4,locked_until=NULL,error_message=$5,
        next_attempt_at=CASE WHEN $4='retry' THEN clock_timestamp()+($6*interval '1 second') ELSE NULL END,
        published_at=CASE WHEN $4='published' THEN clock_timestamp() ELSE published_at END,
        dead_letter_at=CASE WHEN $4='dead_letter' THEN clock_timestamp() ELSE dead_letter_at END
        WHERE id=$1 AND group_id=$2 AND empresa_id=$3`, [event.id, ctx.groupId, ctx.empresaId, status, code, delay]);
      await this.audit(ctx, tx, event, status, event.attempts, code ?? undefined);
      return status;
    });
  }

  async reprocess(ctx: RequestContext, id: string, additionalAttempts: number) {
    await this.authorize(ctx, 'catalogo-reprocessamento', 'editar');
    if (!z.string().uuid().safeParse(id).success || !Number.isInteger(additionalAttempts) || additionalAttempts < 1 || additionalAttempts > 10) {
      throw new AppError(422, 'OUTBOX_REPROCESS_INVALID', 'Explicit bounded retry budget required');
    }
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<Event>("SELECT * FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto' AND status='dead_letter' FOR UPDATE", [id, ctx.groupId, ctx.empresaId]);
      const event = result.rows[0];
      if (!event) throw new AppError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Event not available');
      // Keep attempts monotonically increasing: an old worker can never acquire the new lease version.
      await tx.query("UPDATE integration_events SET updated_at=clock_timestamp(),status='retry',max_attempts=attempts+$4,next_attempt_at=NULL,dead_letter_at=NULL,locked_until=NULL,error_message=NULL WHERE id=$1 AND group_id=$2 AND empresa_id=$3", [id, ctx.groupId, ctx.empresaId, additionalAttempts]);
      await this.audit(ctx, tx, event, 'retry', event.attempts, undefined, event.attempts + additionalAttempts);
    });
  }

  async summary(ctx: RequestContext) {
    await this.authorize(ctx, 'catalogo', 'visualizar');
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<{ status: string; total: number }>("SELECT CASE WHEN status IN ('pending','processing','published','retry','dead_letter','cancelled') THEN status ELSE 'unknown' END status,count(*)::int total FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto' GROUP BY 1 ORDER BY 1", [ctx.groupId, ctx.empresaId]);
      await this.guards.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', action: 'read', afterData: { counts: result.rows } }, tx);
      return result.rows;
    });
  }

  async isPublishable(ctx: RequestContext, lease: CatalogLease, codigo: string | null) {
    await this.authorize(ctx);
    return this.scoped(ctx, async (tx) => {
      const product = await new PostgresProdutoRepository(this.db).getById(
        { groupId: ctx.groupId, empresaId: ctx.empresaId }, lease.produtoId, tx);
      return Boolean(product?.ativo && product.workflow_status === 'PUBLICADO' && product.codigo === codigo);
    });
  }
}
