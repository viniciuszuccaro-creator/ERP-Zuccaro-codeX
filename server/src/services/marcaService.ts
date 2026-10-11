import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { AuditRepository } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { InMemoryRbacGuard, type RbacGuard, type RbacAction } from '../db/rbacGuard.js';
import {
  marcaCreateSchema,
  marcaUpdateSchema,
  type Marca,
  type MarcaRepository,
} from '../repositories/marcaTypes.js';

export class MarcaService {
  constructor(
    private readonly repo: MarcaRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard = new InMemoryRbacGuard(),
    private readonly db?: DbClient,
  ) {}

  async list(ctx: RequestContext, options: { ativo?: boolean; search?: string; limit?: number } = {}) {
    return this.mutate(ctx, async executor => {
      await this.prepare(ctx, 'visualizar', executor);
      return this.repo.list({ groupId: ctx.groupId, empresaId: ctx.empresaId, ativo: options.ativo, search: options.search, limit: options.limit }, executor);
    });
  }

  async get(ctx: RequestContext, id: string, executor?: DbQueryExecutor) {
    const read = async (q?: DbQueryExecutor) => {
      await this.prepare(ctx, 'visualizar', q);
      const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id, q);
      if (!row) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
      return row;
    };
    return executor ? read(executor) : this.mutate(ctx, read);
  }
  async create(ctx: RequestContext, payload: unknown) {
    return this.mutate(ctx, q => this.createWithExecutor(ctx, payload, q));
  }

  private async createWithExecutor(ctx: RequestContext, payload: unknown, executor?: DbQueryExecutor) {
    await this.prepare(ctx, 'criar', executor);
    const parsed = marcaCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
    const empresaId = parsed.data.empresa_id ?? ctx.empresaId ?? null;
    await this.assertTargetScope(ctx, empresaId, 'criar', executor);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId, executor);
    const created = await this.repo.create(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      parsed.data,
      executor,
    );
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: created.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Marca',
      entityId: created.id,
      action: 'create',
      afterData: sanitizeMarca(created),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
    return created;
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    return this.mutate(ctx, q => this.updateWithExecutor(ctx, id, payload, q));
  }

  private async updateWithExecutor(ctx: RequestContext, id: string, payload: unknown, executor?: DbQueryExecutor) {
    await this.prepare(ctx, 'editar', executor);
    const parsed = marcaUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
    const before = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id, executor, true);
    if (!before) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    const empresaId = parsed.data.empresa_id === undefined ? before.empresa_id : parsed.data.empresa_id;
    await this.assertTargetScope(ctx, empresaId, 'editar', executor);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId, executor);

    const updated = await this.repo.update(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      id,
      parsed.data,
      executor,
    );
    if (!updated) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');

    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: updated.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Marca',
      entityId: updated.id,
      action: 'update',
      beforeData: sanitizeMarca(before),
      afterData: sanitizeMarca(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
    return updated;
  }

  async softDelete(ctx: RequestContext, id: string) {
    return this.mutate(ctx, q => this.softDeleteWithExecutor(ctx, id, q));
  }

  private async softDeleteWithExecutor(ctx: RequestContext, id: string, executor?: DbQueryExecutor) {
    await this.prepare(ctx, 'inativar', executor);
    const before = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id, executor, true);
    if (!before) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    const updated = await this.repo.softDelete({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id, executor);
    if (!updated) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');

    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: updated.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Marca',
      entityId: updated.id,
      action: 'soft_delete',
      beforeData: sanitizeMarca(before),
      afterData: sanitizeMarca(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
    return updated;
  }

  private async mutate<T>(ctx: RequestContext, fn: (q?: DbQueryExecutor) => Promise<T>): Promise<T> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!this.db) return fn();
    return this.db.withTransaction(async q => {
      await q.query("SELECT set_config('app.group_id', $1, true), set_config('app.empresa_id', $2, true)", [ctx.groupId, ctx.empresaId ?? '']);
      return fn(q);
    });
  }

  private async assertTargetScope(ctx: RequestContext, empresaId: string | null | undefined, action: RbacAction, executor?: DbQueryExecutor) {
    if (ctx.empresaId && empresaId !== ctx.empresaId) {
      throw new AppError(403, 'ACTOR_SCOPE_DENIED', 'Marca target must remain in the selected company');
    }
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId, executor);
    await this.rbac.assertAllowed({ ...ctx, empresaId }, 'Cadastros', 'marca', action, { allowGlobalWildcard: false, executor });
  }

  private async prepare(ctx: RequestContext, action: RbacAction, executor?: DbQueryExecutor) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId, executor);
    await this.rbac.assertAllowed(ctx, 'Cadastros', 'marca', action, { allowGlobalWildcard: false, executor });
  }
}

function sanitizeMarca(row: Marca) {
  return sanitizeAuditSnapshot(row);
}
