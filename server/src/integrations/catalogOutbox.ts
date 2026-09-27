import { z } from 'zod';
import { randomInt } from 'node:crypto';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { AppError } from '../api/errors.js';
import { assertIntegrationEventsReady } from './saleIngress.js';
import { PostgresProdutoRepository } from '../repositories/postgresProdutoRepository.js';
import { digest } from './saleIngressContract.js';

const scope = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid(), requestId: z.string().min(1).max(128) });
export const catalogSignalSchema = z.object({ produtoId: z.string().uuid(), codigo: z.string().max(100).regex(/^[^<>\u0000-\u001f\u007f]*$/).nullable(),
  workflowStatus: z.literal('PUBLICADO'), schemaVersion: z.literal(1) }).strict();
export type CatalogLease = { id: string; produtoId: string; key: string; attempt: number; expiresAt: string; payload: unknown };
export type PublishedSignal = { id: string; key: string; attempt: number; createdAt: string };
export type ReconciliationState = 'CONSISTENT' | 'MISSING' | 'CONFLICT' | 'UNAVAILABLE';
type Event = { id: string; idempotency_key: string; attempts: number; max_attempts: number; status: string;
  locked_until: Date; payload: unknown; aggregate_id: string };
const leaseSchema = z.object({ id: z.string().uuid(), key: z.string().min(1).max(512), attempt: z.number().int().positive(), expiresAt: z.string().datetime() });
const reprocessSelection = z.array(z.object({id:z.string().uuid().transform(v=>v.toLowerCase()),
  additionalAttempts:z.number().int().min(1).max(10)}).strict()).min(1).max(25)
  .refine(items=>new Set(items.map(i=>i.id)).size===items.length);
export type CatalogReprocessSelection = z.input<typeof reprocessSelection>;

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
        AND attempts=$4 AND locked_until=$5::timestamptz AND idempotency_key=$6 AND locked_until>clock_timestamp() FOR UPDATE`,
      [lease.id, ctx.groupId, ctx.empresaId, lease.attempt, lease.expiresAt, lease.key]);
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

  async reprocess(ctx:RequestContext,id:string,additionalAttempts:number):Promise<void>;
  async reprocess(ctx:RequestContext,selection:CatalogReprocessSelection):Promise<{scheduled:string[]}>;
  async reprocess(ctx: RequestContext, input: string|CatalogReprocessSelection, additionalAttempts?: number):Promise<void|{scheduled:string[]}> {
    await this.authorize(ctx, 'catalogo-reprocessamento', 'editar');
    const parsed=reprocessSelection.safeParse(typeof input==='string'?[{id:input,additionalAttempts}]:input);
    if (!parsed.success || (typeof input!=='string'&&additionalAttempts!==undefined)) {
      throw new AppError(422, 'OUTBOX_REPROCESS_INVALID', 'Explicit bounded retry budget required');
    }
    return this.scoped(ctx, async (tx) => {
      const ids=parsed.data.map(i=>i.id);
      // Lock every eligible row in one stable order, then validate completeness before any write.
      const result = await tx.query<Event>("SELECT * FROM integration_events WHERE id=ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3 AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto' AND status='dead_letter' ORDER BY id FOR UPDATE", [ids, ctx.groupId, ctx.empresaId]);
      if(result.rows.length!==ids.length)throw new AppError(404,'OUTBOX_EVENT_NOT_FOUND','Event not available');
      for(const event of result.rows){
        const budget=parsed.data.find(i=>i.id===event.id)!.additionalAttempts;
        // Keep attempts monotonically increasing: an old worker can never acquire the new lease version.
        await tx.query("UPDATE integration_events SET updated_at=clock_timestamp(),status='retry',max_attempts=attempts+$4,next_attempt_at=NULL,dead_letter_at=NULL,locked_until=NULL,error_message=NULL WHERE id=$1 AND group_id=$2 AND empresa_id=$3", [event.id, ctx.groupId, ctx.empresaId, budget]);
        await this.audit(ctx, tx, event, 'retry', event.attempts, undefined, event.attempts + budget);
      }
      if(typeof input!=='string')return {scheduled:ids};
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

  /** Read-only operator triage; no raw payload/key/provider message and no implicit retry. */
  async failures(ctx: RequestContext, limit = 20, cursor?: { id: string; createdAt: string }) {
    await this.authorize(ctx, 'catalogo', 'visualizar');
    const parsed = z.object({ limit: z.number().int().min(1).max(100),
      cursor: z.object({ id: z.string().uuid(), createdAt: z.string().datetime() }).strict().optional(),
    }).safeParse({ limit,cursor });
    if (!parsed.success) throw new AppError(422, 'CATALOG_PAGE_INVALID', 'Invalid page');
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<{ id: string; status: 'retry'|'dead_letter'|'processing'; attempts: number;
        maxAttempts: number; createdAt: string; nextAttemptAt: Date|null; lockedUntil: Date|null; code: string|null }>(`
        SELECT id,status,attempts,max_attempts AS "maxAttempts",
          to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
          next_attempt_at AS "nextAttemptAt",locked_until AS "lockedUntil",
          CASE WHEN error_message IN ('CATALOG_PAYLOAD_INVALID','CATALOG_SOURCE_CHANGED','CATALOG_RECEIPT_INVALID',
            'CATALOG_PROVIDER_UNAVAILABLE','CATALOG_RUN_INTERRUPTED','ATTEMPTS_EXHAUSTED','OUTBOX_KEY_REQUIRED') THEN error_message
            WHEN error_message IS NULL THEN NULL ELSE 'OUTBOX_ERROR_REDACTED' END AS code
        FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source='ERP'
          AND event_type='produto.publicado' AND aggregate_type='Produto'
          AND (status IN ('retry','dead_letter') OR (status='processing' AND (locked_until IS NULL OR locked_until<=statement_timestamp())))
          AND ($3::uuid IS NULL OR (created_at,id)>($4::timestamptz,$3::uuid))
        ORDER BY created_at,id LIMIT $5`,[ctx.groupId,ctx.empresaId,cursor?.id??null,cursor?.createdAt??null,limit+1]);
      const items = result.rows.slice(0,limit), hasMore = result.rows.length>limit;
      const last = items.at(-1);
      await this.guards.auditRepo.append({ ...ctx,entity:'IntegracaoEvento',action:'read',
        afterData:{ operation:'catalog.failures',examined:items.length,limit,hasMore } },tx);
      return { items,hasMore,nextCursor:hasMore&&last?{id:last.id,createdAt:last.createdAt}:null,
        scope:'COMPANY',reprocessApplied:false };
    });
  }

  /** Latest unresolved ACK observations in the current publication attempt; historical scans remain intact. */
  async divergences(ctx: RequestContext, limit = 20, cursor?: { id: string; createdAt: string }) {
    await this.authorize(ctx, 'catalogo', 'visualizar');
    const parsed = z.object({ limit: z.number().int().min(1).max(100),
      cursor: z.object({ id: z.string().uuid(), createdAt: z.string().datetime() }).strict().optional(),
    }).safeParse({ limit,cursor });
    if (!parsed.success) throw new AppError(422, 'CATALOG_PAGE_INVALID', 'Invalid page');
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<{ id: string; sourceId: string; sourceAttempt: number; observer: string;
        state: 'MISSING'|'CONFLICT'|'UNAVAILABLE'; createdAt: string }>(`
        WITH latest AS (
          SELECT DISTINCT ON (r.aggregate_id,r.payload->>'observer') r.id,r.aggregate_id,r.created_at,
            q.attempts,r.payload->>'observer' AS observer,r.payload->>'state' AS state
          FROM integration_events r JOIN integration_events q ON q.id=r.aggregate_id
            AND q.group_id=$1 AND q.empresa_id=$2 AND q.source='ERP' AND q.event_type='produto.publicado'
            AND q.aggregate_type='Produto' AND q.status='published'
          WHERE r.group_id=$1 AND r.empresa_id=$2 AND r.source='ERP' AND r.event_type='catalogo.reconciliado'
            AND r.aggregate_type='IntegracaoEvento' AND r.status='processed'
            AND r.payload->>'sourceAttempt'=q.attempts::text
          ORDER BY r.aggregate_id,r.payload->>'observer',r.created_at DESC,r.id DESC
        ) SELECT id,aggregate_id AS "sourceId",attempts AS "sourceAttempt",
          CASE WHEN observer ~ '^[a-zA-Z0-9_-]{1,64}$' THEN observer ELSE 'OBSERVER_REDACTED' END AS observer,state,
          to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
        FROM latest WHERE state IN ('MISSING','CONFLICT','UNAVAILABLE')
          AND ($3::uuid IS NULL OR (created_at,id)>($4::timestamptz,$3::uuid))
        ORDER BY created_at,id LIMIT $5`,[ctx.groupId,ctx.empresaId,cursor?.id??null,cursor?.createdAt??null,limit+1]);
      const items=result.rows.slice(0,limit),hasMore=result.rows.length>limit,last=items.at(-1);
      await this.guards.auditRepo.append({ ...ctx,entity:'IntegracaoEvento',action:'read',
        afterData:{ operation:'catalog.divergences',examined:items.length,limit,hasMore } },tx);
      return { items,hasMore,nextCursor:hasMore&&last?{id:last.id,createdAt:last.createdAt}:null,
        scope:'COMPANY',correctionApplied:false };
    });
  }

  /** Operational snapshot of this company's existing queue; thresholds are caller-supplied, never commercial defaults. */
  async health(ctx: RequestContext, overdueSeconds: number) {
    await this.authorize(ctx, 'catalogo', 'visualizar');
    if (!Number.isInteger(overdueSeconds) || overdueSeconds < 1 || overdueSeconds > 604800) {
      throw new AppError(422, 'CATALOG_HEALTH_INVALID', 'Explicit bounded monitoring threshold required');
    }
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<{ backlog: number; overdue: number; expiredLeases: number; deadLetter: number; unknownStatus: number;
        oldestBacklogSeconds: number | null; consistent: number; divergent: number; unavailable: number; unreconciled: number }>(`
        WITH queue AS (
          SELECT * FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source='ERP'
          AND event_type='produto.publicado' AND aggregate_type='Produto'
        ), latest AS (
          SELECT q.id, observation.state FROM queue q CROSS JOIN LATERAL (
            SELECT DISTINCT ON (r.payload->>'observer') r.payload->>'state' AS state
            FROM integration_events r WHERE r.group_id=$1 AND r.empresa_id=$2 AND r.source='ERP'
            AND r.event_type='catalogo.reconciliado' AND r.aggregate_type='IntegracaoEvento'
            AND r.aggregate_id=q.id AND r.status='processed' AND r.payload->>'sourceAttempt'=q.attempts::text
            ORDER BY r.payload->>'observer',r.created_at DESC,r.id DESC
          ) observation WHERE q.status='published'
        )
        SELECT count(*) FILTER(WHERE status IN ('pending','retry','processing'))::int AS backlog,
          count(*) FILTER(WHERE status IN ('pending','retry','processing') AND created_at < statement_timestamp()-($3*interval '1 second'))::int AS overdue,
          count(*) FILTER(WHERE status='processing' AND (locked_until IS NULL OR locked_until<=statement_timestamp()))::int AS "expiredLeases",
          count(*) FILTER(WHERE status='dead_letter')::int AS "deadLetter",
          count(*) FILTER(WHERE status NOT IN ('pending','retry','processing','published','dead_letter','cancelled'))::int AS "unknownStatus",
          floor(extract(epoch FROM statement_timestamp()-min(created_at) FILTER(WHERE status IN ('pending','retry','processing'))))::int AS "oldestBacklogSeconds",
          (SELECT count(*)::int FROM latest WHERE state='CONSISTENT') AS consistent,
          (SELECT count(*)::int FROM latest WHERE state IN ('MISSING','CONFLICT')) AS divergent,
          (SELECT count(*)::int FROM latest WHERE state='UNAVAILABLE') AS unavailable,
          (SELECT count(*)::int FROM queue q WHERE q.status='published' AND NOT EXISTS(SELECT 1 FROM latest l WHERE l.id=q.id)) AS unreconciled
        FROM queue`, [ctx.groupId,ctx.empresaId,overdueSeconds]);
      const snapshot = { ...result.rows[0], overdueThresholdSeconds: overdueSeconds, scope: 'COMPANY', correctiveActionApplied: false };
      await this.guards.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', action: 'read', afterData: snapshot }, tx);
      return snapshot;
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

  async publishedPage(ctx: RequestContext, limit: number, cursor?: { id: string; createdAt: string }) {
    await this.authorize(ctx, 'catalogo-reconciliacao', 'editar');
    const options = z.object({ limit: z.number().int().min(1).max(100), cursor: z.object({ id: z.string().uuid(), createdAt: z.string().datetime() }).optional() }).safeParse({ limit, cursor });
    if (!options.success) throw new AppError(422, 'CATALOG_PAGE_INVALID', 'Invalid page');
    return this.scoped(ctx, async (tx) => {
      const result = await tx.query<PublishedSignal>(`SELECT id,idempotency_key AS key,attempts AS attempt,
        to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
        FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND source='ERP' AND event_type='produto.publicado'
        AND aggregate_type='Produto' AND status='published' AND idempotency_key IS NOT NULL
        AND ($3::uuid IS NULL OR (created_at,id)>($4::timestamptz,$3::uuid))
        ORDER BY created_at,id LIMIT $5`, [ctx.groupId, ctx.empresaId, cursor?.id ?? null, cursor?.createdAt ?? null, limit + 1]);
      const items = result.rows.slice(0, limit); const hasMore = result.rows.length > limit;
      const last = items.at(-1);
      await this.guards.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', action: 'read', afterData: { examined: items.length, hasMore, limit } }, tx);
      return { items, hasMore, nextCursor: hasMore && last ? { id: last.id, createdAt: last.createdAt } : null };
    });
  }

  async recordReconciliation(ctx: RequestContext, source: PublishedSignal, observer: string, scanKey: string, state: ReconciliationState, observedHash: string | null) {
    await this.authorize(ctx, 'catalogo-reconciliacao', 'editar');
    const parsed = z.object({ source: z.object({ id: z.string().uuid(), key: z.string().min(1).max(512), attempt: z.number().int().positive(), createdAt: z.string().datetime() }),
      observer: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), scanKey: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      state: z.enum(['CONSISTENT','MISSING','CONFLICT','UNAVAILABLE']), observedHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    }).safeParse({ source, observer, scanKey, state, observedHash });
    if (!parsed.success) throw new AppError(422, 'CATALOG_OBSERVATION_INVALID', 'Invalid observation');
    const payload = { sourceId: source.id, sourceAttempt: source.attempt, observer, state, observedHash };
    const hash = digest(JSON.stringify(payload));
    const key = `catalog-reconcile:v1:${digest(JSON.stringify([ctx.groupId,ctx.empresaId,observer,scanKey,source.id,source.attempt]))}`;
    return this.scoped(ctx, async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      const valid = await tx.query(`SELECT id FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3
        AND source='ERP' AND event_type='produto.publicado' AND aggregate_type='Produto' AND status='published'
        AND idempotency_key=$4 AND attempts=$5 FOR SHARE`, [source.id,ctx.groupId,ctx.empresaId,source.key,source.attempt]);
      if (!valid.rows.length) throw new AppError(409, 'CATALOG_SOURCE_CHANGED', 'Source changed during reconciliation');
      const existing = await tx.query<{ payload_checksum: string }>('SELECT payload_checksum FROM integration_events WHERE group_id=$1 AND empresa_id=$2 AND idempotency_key=$3', [ctx.groupId,ctx.empresaId,key]);
      if (existing.rows[0]) {
        if (existing.rows[0].payload_checksum !== hash) throw new AppError(409, 'CATALOG_SCAN_CONFLICT', 'Scan already recorded differently');
        return { replayed: true };
      }
      const result = await tx.query<{ id: string }>(`INSERT INTO integration_events(group_id,empresa_id,source,event_type,idempotency_key,payload,status,schema_version,aggregate_type,aggregate_id,payload_checksum)
        VALUES($1,$2,'ERP','catalogo.reconciliado',$3,$4::jsonb,'processed',1,'IntegracaoEvento',$5,$6) RETURNING id`, [ctx.groupId,ctx.empresaId,key,JSON.stringify(payload),source.id,hash]);
      await this.guards.auditRepo.append({ ...ctx, entity: 'IntegracaoEvento', entityId: result.rows[0].id, action: 'create', afterData: payload }, tx);
      return { replayed: false };
    });
  }
}
