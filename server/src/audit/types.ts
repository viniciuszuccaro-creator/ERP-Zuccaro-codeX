export type TenantScope = {
  groupId: string;
  empresaId?: string | null;
};

export type ActorContext = {
  actorId?: string | null;
  actorEmail?: string | null;
};

export type RequestContext = TenantScope & ActorContext & {
  requestId: string;
  ipAddress?: string | null;
};

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'soft_delete'
  | 'restore'
  | 'duplicate_block'
  | 'read';

export type AuditEntry = {
  groupId?: string | null;
  empresaId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  entity: string;
  entityId?: string | null;
  action: AuditAction;
  beforeData?: unknown;
  afterData?: unknown;
  requestId?: string | null;
  ipAddress?: string | null;
};

export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  listByEntity(entity: string, entityId: string): Promise<AuditEntry[]>;
}
