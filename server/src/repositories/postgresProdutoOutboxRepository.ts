import type { DbClient } from '../db/client.js';

export type ProdutoOutboxScope = { groupId: string; empresaId: string };
export type ProdutoOutboxLease = {
  id: string;
  groupId: string;
  empresaId: string;
  attempts: number;
  lockedUntil: string;
  payload: Record<string, unknown>;
};

// This repository only manages delivery state. It never calls a channel or handles credentials.
export class PostgresProdutoOutboxRepository {
  constructor(private readonly db: DbClient) {}

  async claim(scope: ProdutoOutboxScope, limit = 10, leaseSeconds = 60): Promise<ProdutoOutboxLease[]> {
    if (!scope.groupId || !scope.empresaId) throw new Error('TENANT_SCOPE_REQUIRED');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('INVALID_LIMIT');
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) throw new Error('INVALID_LEASE');
    return this.db.withTransaction(async (tx) => {
      await tx.query(
        `UPDATE integration_events SET status='dead_letter', dead_letter_at=clock_timestamp(), locked_until=NULL
         WHERE group_id=$1 AND empresa_id=$2 AND event_type='produto.publicado'
           AND status='processing' AND attempts>=max_attempts AND locked_until<clock_timestamp()`,
        [scope.groupId, scope.empresaId],
      );
      const result = await tx.query<{
        id: string; group_id: string; empresa_id: string; attempts: number;
        locked_until: string; created_at: Date; payload: Record<string, unknown>;
      }>(
        `WITH candidates AS (
           SELECT id FROM integration_events
           WHERE group_id=$1 AND empresa_id=$2 AND event_type='produto.publicado'
             AND attempts < max_attempts
             AND (status IN ('pending','retry') OR (status='processing' AND locked_until < clock_timestamp()))
             AND (next_attempt_at IS NULL OR next_attempt_at <= clock_timestamp())
           ORDER BY created_at ASC, id ASC
           LIMIT $3 FOR UPDATE SKIP LOCKED
         )
         UPDATE integration_events AS event SET status='processing', attempts=event.attempts+1,
           locked_until=clock_timestamp()+($4::int * interval '1 second'), error_message=NULL
         FROM candidates WHERE event.id=candidates.id
         RETURNING event.id,event.group_id,event.empresa_id,event.attempts,event.locked_until::text AS locked_until,event.created_at,event.payload`,
        [scope.groupId, scope.empresaId, limit, leaseSeconds],
      );
      return result.rows.sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id)).map((row) => ({
        id: row.id, groupId: row.group_id, empresaId: row.empresa_id,
        attempts: row.attempts, lockedUntil: row.locked_until, payload: row.payload,
      }));
    });
  }

  async complete(scope: ProdutoOutboxScope, lease: Pick<ProdutoOutboxLease, 'id' | 'attempts' | 'lockedUntil'>): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE integration_events SET status='published', published_at=clock_timestamp(), locked_until=NULL
       WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND event_type='produto.publicado'
         AND status='processing' AND attempts=$4 AND locked_until=$5 AND locked_until>clock_timestamp()
       RETURNING id`,
      [lease.id, scope.groupId, scope.empresaId, lease.attempts, lease.lockedUntil],
    );
    return result.rowCount === 1;
  }

  async fail(scope: ProdutoOutboxScope, lease: Pick<ProdutoOutboxLease, 'id' | 'attempts' | 'lockedUntil'>, retrySeconds: number): Promise<'retry' | 'dead_letter' | null> {
    if (!Number.isInteger(retrySeconds) || retrySeconds < 1 || retrySeconds > 86400) throw new Error('INVALID_RETRY');
    const result = await this.db.query<{ status: 'retry' | 'dead_letter' }>(
      `UPDATE integration_events SET
         status=CASE WHEN attempts>=max_attempts THEN 'dead_letter' ELSE 'retry' END,
         next_attempt_at=CASE WHEN attempts>=max_attempts THEN NULL ELSE clock_timestamp()+($6::int * interval '1 second') END,
         dead_letter_at=CASE WHEN attempts>=max_attempts THEN clock_timestamp() ELSE NULL END,
         locked_until=NULL
       WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND event_type='produto.publicado'
         AND status='processing' AND attempts=$4 AND locked_until=$5 AND locked_until>clock_timestamp()
       RETURNING status`,
      [lease.id, scope.groupId, scope.empresaId, lease.attempts, lease.lockedUntil, retrySeconds],
    );
    return result.rows[0]?.status ?? null;
  }
}
