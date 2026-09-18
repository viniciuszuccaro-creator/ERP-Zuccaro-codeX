import type { DbClient } from '../db/client.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { AuditEntry, AuditRepository } from './types.js';

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly db: DbClient) {}

  async append(entry: AuditEntry, executor?: DbQueryExecutor): Promise<void> {
    await (executor ?? this.db).query(
      `INSERT INTO audit_logs (
        group_id, empresa_id, actor_id, actor_email,
        entity, entity_id, action, before_data, after_data,
        request_id, ip_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
      [
        entry.groupId ?? null,
        entry.empresaId ?? null,
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.entity,
        entry.entityId ?? null,
        entry.action,
        entry.beforeData == null ? null : JSON.stringify(entry.beforeData),
        entry.afterData == null ? null : JSON.stringify(entry.afterData),
        entry.requestId ?? null,
        entry.ipAddress ?? null,
      ],
    );
  }

  async listByEntity(entity: string, entityId: string): Promise<AuditEntry[]> {
    const result = await this.db.query<{
      group_id: string | null;
      empresa_id: string | null;
      actor_id: string | null;
      actor_email: string | null;
      entity: string;
      entity_id: string | null;
      action: AuditEntry['action'];
      before_data: unknown;
      after_data: unknown;
      request_id: string | null;
      ip_address: string | null;
    }>(
      `SELECT group_id, empresa_id, actor_id, actor_email, entity, entity_id, action,
              before_data, after_data, request_id, ip_address
       FROM audit_logs
       WHERE entity = $1 AND entity_id = $2
       ORDER BY created_at ASC`,
      [entity, entityId],
    );

    return result.rows.map((row) => ({
      groupId: row.group_id,
      empresaId: row.empresa_id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      entity: row.entity,
      entityId: row.entity_id,
      action: row.action,
      beforeData: row.before_data,
      afterData: row.after_data,
      requestId: row.request_id,
      ipAddress: row.ip_address,
    }));
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry, _executor?: DbQueryExecutor): Promise<void> {
    this.entries.push({ ...entry });
  }

  async listByEntity(entity: string, entityId: string): Promise<AuditEntry[]> {
    return this.entries.filter((e) => e.entity === entity && e.entityId === entityId);
  }
}
