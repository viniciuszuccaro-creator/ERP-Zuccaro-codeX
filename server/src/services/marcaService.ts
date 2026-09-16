import type { AuditRepository } from '../audit/types.js';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
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
  ) {}

  async list(ctx: RequestContext, options: { ativo?: boolean; search?: string; limit?: number } = {}) {
    this.assertScope(ctx);
    return this.repo.list({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo: options.ativo,
      search: options.search,
      limit: options.limit,
    });
  }

  async get(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!row) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');
    return row;
  }

  async create(ctx: RequestContext, payload: unknown) {
    this.assertScope(ctx);
    const parsed = marcaCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
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
    this.assertScope(ctx);
    const parsed = marcaUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid marca payload', parsed.error.flatten());
    }
    const before = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    if (!before) throw new AppError(404, 'MARCA_NOT_FOUND', 'Marca not found in tenant scope');

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
    this.assertScope(ctx);
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

  private assertScope(ctx: RequestContext) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
  }
}

function sanitizeMarca(row: Marca) {
  return {
    id: row.id,
    group_id: row.group_id,
    empresa_id: row.empresa_id,
    nome_marca: row.nome_marca,
    descricao: row.descricao,
    ativo: row.ativo,
    updated_at: row.updated_at,
  };
}
