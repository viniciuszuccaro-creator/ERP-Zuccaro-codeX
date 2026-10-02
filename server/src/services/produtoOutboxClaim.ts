import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { Scope } from './tenantCrudService.js';

export type OutboxEventStatus = 'pending' | 'processing' | 'published' | 'retry' | 'dead_letter';

export type ProdutoPublicationEvent = {
  id: string;
  groupId: string;
  empresaId: string | null;
  produtoId: string;
  requestId: string;
  eventType: 'produto.publicado';
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  lockedUntil: string | null;
  nextAttemptAt: string | null;
  publishedAt: string | null;
  deadLetterAt: string | null;
  errorMessage: string | null;
  schemaVersion: number;
  payload: Record<string, unknown>;
};

export type ClaimedPublicationEvent = {
  id: string;
  produtoId: string;
  requestId: string;
  status: 'processing';
  attempts: number;
  maxAttempts: number;
  lockedUntil: string;
  leaseToken: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
};

export function buildOutboxLeaseToken(eventId: string, lockedUntil: string): string {
  return createHash('sha256').update(`${eventId}:${lockedUntil}`).digest('hex');
}

export function assertOutboxLeaseToken(eventId: string, lockedUntil: string | null, leaseToken: string) {
  if (!lockedUntil || !leaseToken || buildOutboxLeaseToken(eventId, lockedUntil) !== leaseToken) {
    throw new AppError(409, 'OUTBOX_LEASE_MISMATCH', 'Outbox lease token does not match current lease');
  }
}

export function computeOutboxRetryAt(attempts: number, now = Date.now()): string {
  const baseMs = Math.min(60_000, 1_000 * (2 ** Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * 250);
  return new Date(now + baseMs + jitter).toISOString();
}

export type OutboxClaimRepository = {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  claimPublicationEvents(
    scope: Scope,
    options: { limit: number; leaseMs: number },
    executor?: DbQueryExecutor,
  ): Promise<ProdutoPublicationEvent[]>;
  confirmPublicationEvent(
    scope: Scope,
    eventId: string,
    leaseToken: string,
    executor?: DbQueryExecutor,
  ): Promise<ProdutoPublicationEvent | null>;
  failPublicationEvent(
    scope: Scope,
    eventId: string,
    leaseToken: string,
    errorMessage: string,
    executor?: DbQueryExecutor,
  ): Promise<ProdutoPublicationEvent | null>;
};

type Dependencies = {
  repo: OutboxClaimRepository;
  audit: AuditRepository;
  tenantGuard: TenantGuard;
  rbacGuard: RbacGuard;
};

function assertId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid outbox event id');
  }
}

async function authorize(deps: Dependencies, ctx: RequestContext) {
  if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
  if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
  if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
  await deps.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
  await deps.rbacGuard.assertAllowed(ctx, 'Cadastros', 'produto', 'publicar');
  return { groupId: ctx.groupId, empresaId: ctx.empresaId } as Scope;
}

function toClaimed(row: ProdutoPublicationEvent): ClaimedPublicationEvent {
  if (!row.lockedUntil) {
    throw new AppError(409, 'OUTBOX_LEASE_MISMATCH', 'Claimed event missing lease expiry');
  }
  return {
    id: row.id,
    produtoId: row.produtoId,
    requestId: row.requestId,
    status: 'processing',
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lockedUntil: row.lockedUntil,
    leaseToken: buildOutboxLeaseToken(row.id, row.lockedUntil),
    schemaVersion: row.schemaVersion,
    payload: row.payload,
  };
}

/** Claim concorrente de produto.publicado (tenant-scoped). Sem entrega externa. */
export async function claimProdutoPublicationEvents(
  deps: Dependencies,
  ctx: RequestContext,
  options: { limit?: number; leaseMs?: number } = {},
) {
  const scope = await authorize(deps, ctx);
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const leaseMs = Math.min(Math.max(options.leaseMs ?? 60_000, 5_000), 300_000);
  return deps.repo.withTransaction(async (executor) => {
    const claimed = await deps.repo.claimPublicationEvents(scope, { limit, leaseMs }, executor);
    for (const row of claimed) {
      await deps.audit.append({
        groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
        actorEmail: ctx.actorEmail, entity: 'IntegrationEvent', entityId: row.id, action: 'update',
        afterData: {
          event_type: 'produto.publicado', status: row.status, attempts: row.attempts,
          locked_until: row.lockedUntil, aggregate_id: row.produtoId,
        },
        requestId: ctx.requestId, ipAddress: ctx.ipAddress,
      }, executor);
    }
    return claimed.map(toClaimed);
  });
}

export async function confirmProdutoPublicationEvent(
  deps: Dependencies,
  ctx: RequestContext,
  eventId: string,
  leaseToken: string,
) {
  const scope = await authorize(deps, ctx);
  assertId(eventId);
  if (!leaseToken || typeof leaseToken !== 'string' || leaseToken.length > 128) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid outbox lease token');
  }
  return deps.repo.withTransaction(async (executor) => {
    const confirmed = await deps.repo.confirmPublicationEvent(scope, eventId, leaseToken, executor);
    if (!confirmed) throw new AppError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found in tenant scope');
    await deps.audit.append({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      actorEmail: ctx.actorEmail, entity: 'IntegrationEvent', entityId: eventId, action: 'update',
      afterData: {
        event_type: 'produto.publicado', status: confirmed.status,
        published_at: confirmed.publishedAt, aggregate_id: confirmed.produtoId,
      },
      requestId: ctx.requestId, ipAddress: ctx.ipAddress,
    }, executor);
    return {
      id: confirmed.id,
      status: confirmed.status,
      publishedAt: confirmed.publishedAt,
      produtoId: confirmed.produtoId,
    };
  });
}

export async function failProdutoPublicationEvent(
  deps: Dependencies,
  ctx: RequestContext,
  eventId: string,
  leaseToken: string,
  errorMessage: string,
) {
  const scope = await authorize(deps, ctx);
  assertId(eventId);
  if (!leaseToken || typeof leaseToken !== 'string' || leaseToken.length > 128) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid outbox lease token');
  }
  const sanitized = String(errorMessage || 'delivery_failed').trim().slice(0, 500) || 'delivery_failed';
  return deps.repo.withTransaction(async (executor) => {
    const row = await deps.repo.failPublicationEvent(scope, eventId, leaseToken, sanitized, executor);
    if (!row) throw new AppError(404, 'OUTBOX_EVENT_NOT_FOUND', 'Outbox event not found in tenant scope');
    await deps.audit.append({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      actorEmail: ctx.actorEmail, entity: 'IntegrationEvent', entityId: eventId, action: 'update',
      afterData: {
        event_type: 'produto.publicado', status: row.status, attempts: row.attempts,
        next_attempt_at: row.nextAttemptAt, dead_letter_at: row.deadLetterAt,
        aggregate_id: row.produtoId,
      },
      requestId: ctx.requestId, ipAddress: ctx.ipAddress,
    }, executor);
    return {
      id: row.id,
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.nextAttemptAt,
      deadLetterAt: row.deadLetterAt,
    };
  });
}

export function createPendingPublicationEvent(input: {
  groupId: string;
  empresaId: string | null;
  produtoId: string;
  requestId: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}): ProdutoPublicationEvent {
  return {
    id: randomUUID(),
    groupId: input.groupId,
    empresaId: input.empresaId,
    produtoId: input.produtoId,
    requestId: input.requestId,
    eventType: 'produto.publicado',
    status: 'pending',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 10,
    lockedUntil: null,
    nextAttemptAt: null,
    publishedAt: null,
    deadLetterAt: null,
    errorMessage: null,
    schemaVersion: 1,
    payload: input.payload ?? { produtoId: input.produtoId, schemaVersion: 1 },
  };
}
