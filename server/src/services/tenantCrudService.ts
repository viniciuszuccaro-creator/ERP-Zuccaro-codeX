import { z } from 'zod';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import type { TenantGuard } from '../db/tenantGuard.js';

export type ListOptions = {
  ativo?: boolean;
  search?: string;
  limit?: number;
};

export type Scope = { groupId: string; empresaId?: string | null };

export interface TenantEntityRepository<TRow, TCreate, TUpdate> {
  list(filter: Scope & ListOptions): Promise<TRow[]>;
  getById(scope: Scope, id: string): Promise<TRow | null>;
  create(scope: Scope, data: TCreate): Promise<TRow>;
  update(scope: Scope, id: string, data: TUpdate): Promise<TRow | null>;
  softDelete(scope: Scope, id: string): Promise<TRow | null>;
}

type FactoryOptions<TRow, TCreate, TUpdate> = {
  entityName: string;
  notFoundCode: string;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<TUpdate>;
  /**
   * Opcional. Default: snapshot completo via sanitizeAuditSnapshot
   * (todos os campos do row, menos secrets).
   */
  sanitize?: (row: TRow) => unknown;
  getEmpresaId: (row: TRow) => string | null | undefined;
  resolveEmpresaIdFromCreate: (data: TCreate, scope: Scope) => string | null | undefined;
  resolveEmpresaIdFromUpdate: (data: TUpdate, current: TRow) => string | null | undefined;
};

export class TenantCrudService<TRow, TCreate, TUpdate> {
  constructor(
    private readonly repo: TenantEntityRepository<TRow, TCreate, TUpdate>,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly opts: FactoryOptions<TRow, TCreate, TUpdate>,
  ) {}

  private snapshot(row: TRow): unknown {
    if (this.opts.sanitize) {
      return this.opts.sanitize(row);
    }
    return sanitizeAuditSnapshot(row);
  }

  async list(ctx: RequestContext, options: ListOptions = {}) {
    this.assertScope(ctx);
    return this.repo.list({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ...options,
    });
  }

  async get(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!row) {
      throw new AppError(404, this.opts.notFoundCode, `${this.opts.entityName} not found in tenant scope`);
    }
    return row;
  }

  async create(ctx: RequestContext, payload: unknown) {
    this.assertScope(ctx);
    const parsed = this.opts.createSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${this.opts.entityName} payload`, parsed.error.flatten());
    }
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const empresaId = this.opts.resolveEmpresaIdFromCreate(parsed.data, scope);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    let created: TRow;
    try {
      created = await this.repo.create(scope, parsed.data);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: this.opts.getEmpresaId(created) ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: this.opts.entityName,
      entityId: String((created as { id: string }).id),
      action: 'create',
      afterData: this.snapshot(created),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return created;
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    this.assertScope(ctx);
    const parsed = this.opts.updateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${this.opts.entityName} payload`, parsed.error.flatten());
    }
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const before = await this.repo.getById(scope, id);
    if (!before) {
      throw new AppError(404, this.opts.notFoundCode, `${this.opts.entityName} not found in tenant scope`);
    }
    const empresaId = this.opts.resolveEmpresaIdFromUpdate(parsed.data, before);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    let updated: TRow | null;
    try {
      updated = await this.repo.update(scope, id, parsed.data);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
    if (!updated) {
      throw new AppError(404, this.opts.notFoundCode, `${this.opts.entityName} not found in tenant scope`);
    }
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: this.opts.getEmpresaId(updated) ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: this.opts.entityName,
      entityId: id,
      action: 'update',
      beforeData: this.snapshot(before),
      afterData: this.snapshot(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }

  async softDelete(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const before = await this.repo.getById(scope, id);
    if (!before) {
      throw new AppError(404, this.opts.notFoundCode, `${this.opts.entityName} not found in tenant scope`);
    }
    const updated = await this.repo.softDelete(scope, id);
    if (!updated) {
      throw new AppError(404, this.opts.notFoundCode, `${this.opts.entityName} not found in tenant scope`);
    }
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: this.opts.getEmpresaId(updated) ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: this.opts.entityName,
      entityId: id,
      action: 'soft_delete',
      beforeData: this.snapshot(before),
      afterData: this.snapshot(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }

  private assertScope(ctx: RequestContext) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
  }

  private rethrowConflict(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      throw new AppError(409, 'CONFLICT', `${this.opts.entityName} conflicts with an existing record`);
    }
  }
}

export { z };
