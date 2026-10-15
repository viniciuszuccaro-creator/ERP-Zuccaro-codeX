import type { AuditRepository } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
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
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(ctx: RequestContext, options: { ativo?: boolean; search?: string; limit?: number } = {}) {
    await this.prepare(ctx, 'visualizar');
    return this.repo.list({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo: options.ativo,
      search: options.search,
      limit: options.limit,
    });
  }

  async get(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'visualizar');
    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!row) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    return row;
  }

  async create(ctx: RequestContext, payload: unknown) {
    await this.prepare(ctx, 'criar');
    const parsed = marcaCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
    const empresaId = parsed.data.empresa_id ?? ctx.empresaId ?? null;
    await this.assertTargetScope(ctx, empresaId, 'criar');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    const created = await this.repo.create(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      parsed.data,
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
    });
    return created;
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    await this.prepare(ctx, 'editar');
    const parsed = marcaUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
    const before = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!before) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    const empresaId = parsed.data.empresa_id === undefined ? before.empresa_id : parsed.data.empresa_id;
    await this.assertTargetScope(ctx, empresaId, 'editar');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);

    const updated = await this.repo.update(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      id,
      parsed.data,
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
    });
    return updated;
  }

  async softDelete(ctx: RequestContext, id: string) {
    await this.prepare(ctx, 'inativar');
    const before = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!before) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    const updated = await this.repo.softDelete({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
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
    });
    return updated;
  }

  private async assertTargetScope(
    ctx: RequestContext,
    empresaId: string | null | undefined,
    action: RbacAction,
  ) {
    // Com empresa selecionada, payload não pode redirecionar para outra filial nem virar mestre compartilhado.
    if (ctx.empresaId && empresaId !== ctx.empresaId) {
      throw new AppError(403, 'ACTOR_SCOPE_DENIED', 'Marca target must remain in the selected company');
    }
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    await this.rbacGuard.assertAllowed(
      { ...ctx, empresaId },
      'Cadastros',
      'marca',
      action,
      { allowGlobalWildcard: false },
    );
  }

  private async prepare(ctx: RequestContext, action: RbacAction) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    // Sem wildcard global: Marca exige grant explícito Cadastros.marca (alinha #278 Codex).
    await this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'marca', action, { allowGlobalWildcard: false });
  }
}

function sanitizeMarca(row: Marca) {
  return sanitizeAuditSnapshot(row);
}
