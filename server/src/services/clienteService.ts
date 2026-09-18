import type { AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import { maskDocumento, normalizeDocumento } from '../db/documentoValidators.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import {
  CLIENTE_FORBIDDEN_FIELDS,
  clienteCreateSchema,
  clienteUpdateSchema,
  type Cliente,
} from '../repositories/clienteTypes.js';
import {
  ClienteEmpresaOperations,
  type ClienteEmpresaListOptions,
} from './clienteEmpresaOperations.js';

export type ClienteListOptions = {
  ativo?: boolean;
  search?: string;
  codigo?: string;
  documento?: string;
  orderBy?: 'codigo' | 'nome';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

function sanitizeClienteAudit(row: unknown): Record<string, unknown> | null {
  const snap = sanitizeAuditSnapshot(row);
  if (!snap) return null;
  if (snap.documento != null) snap.documento = maskDocumento(snap.documento);
  if (snap.documento_normalizado != null) {
    snap.documento_normalizado = maskDocumento(snap.documento_normalizado);
  }
  return snap;
}

export class ClienteService {
  private readonly empresaOperations: ClienteEmpresaOperations;

  constructor(
    private readonly repo: ClienteRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbacGuard: RbacGuard,
  ) {
    this.empresaOperations = new ClienteEmpresaOperations(
      repo,
      audit,
      tenantGuard,
      rbacGuard,
    );
  }

  async list(ctx: RequestContext, options: ClienteListOptions = {}) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'visualizar');
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    // Fail-safe: sem ?ativo= explícito, listar SOMENTE ativo=true.
    const ativo = typeof options.ativo === 'boolean' ? options.ativo : true;
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo,
      search: options.search,
      codigo: options.codigo,
      documento: options.documento,
      orderBy: options.orderBy,
      orderDir: options.orderDir,
      limit,
      offset,
    });
    return {
      data: page.rows,
      meta: {
        limit,
        offset,
        total: page.total,
        hasMore: offset + page.rows.length < page.total,
      },
    };
  }

  async get(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'visualizar');
    const row = await this.repo.getById({ groupId: ctx.groupId, empresaId: ctx.empresaId }, id);
    // Soft-deleted: inexistente para operação padrão (404).
    if (!row || row.ativo === false) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
    return row;
  }

  async create(ctx: RequestContext, payload: unknown) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'criar');
    this.rejectForbiddenFields(payload);
    const parsed = clienteCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Cliente payload', parsed.error.flatten());
    }
    const empresaId = parsed.data.empresa_id ?? ctx.empresaId ?? null;
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    if (empresaId) await this.empresaOperations.assertCanCreate(ctx);

    const docNorm = normalizeDocumento(parsed.data.documento ?? parsed.data.cpf_cnpj ?? '');
    if (docNorm) {
      const existing = await this.repo.findByDocumento(ctx.groupId, docNorm);
      if (existing) {
        await this.audit.append({
          groupId: ctx.groupId,
          empresaId: existing.empresa_id ?? ctx.empresaId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          entity: 'Cliente',
          entityId: existing.id,
          action: 'duplicate_block',
          beforeData: sanitizeClienteAudit(existing),
          afterData: {
            attempted_documento: maskDocumento(docNorm),
            attempted_tipo: parsed.data.tipo,
            reason: 'DUPLICATE_DOCUMENT',
          },
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
        });
        throw new AppError(409, 'DUPLICATE_DOCUMENT', 'Cliente with same CPF/CNPJ already exists in group');
      }
    }

    try {
      return await this.repo.withTransaction(async (executor) => {
        const created = await this.repo.create(
          { groupId: ctx.groupId, empresaId: ctx.empresaId },
          { ...parsed.data, empresa_id: empresaId },
          ctx.actorId,
          executor,
        );
        await this.audit.append({
          groupId: ctx.groupId,
          empresaId: created.empresa_id ?? ctx.empresaId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          entity: 'Cliente',
          entityId: created.id,
          action: 'create',
          afterData: sanitizeClienteAudit(created),
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
        }, executor);
        if (empresaId) {
          const link = await this.repo.getEmpresaLink(
            { groupId: ctx.groupId, empresaId: ctx.empresaId },
            created.id,
            empresaId,
            executor,
          );
          if (!link) {
            throw new AppError(
              500,
              'CLIENTE_EMPRESA_LINK_FAILED',
              'Cliente relationship was not created',
            );
          }
          await this.empresaOperations.auditCreatedLink(ctx, link, executor);
        }
        return created;
      });
    } catch (error) {
      await this.handleCreateConflict(ctx, error, docNorm, parsed.data.tipo);
      throw error;
    }
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'editar');
    this.rejectForbiddenFields(payload);
    const parsed = clienteUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Cliente payload', parsed.error.flatten());
    }
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const before = await this.repo.getById(scope, id);
    if (!before || before.ativo === false) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
    this.validateUpdatedIdentity(before, parsed.data);
    const empresaId = parsed.data.empresa_id === undefined ? before.empresa_id : parsed.data.empresa_id;
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);

    if (parsed.data.documento !== undefined || parsed.data.cpf_cnpj !== undefined) {
      const docNorm = normalizeDocumento(parsed.data.documento ?? parsed.data.cpf_cnpj ?? '');
      if (docNorm) {
        const existing = await this.repo.findByDocumento(ctx.groupId, docNorm);
        if (existing && existing.id !== id) {
          await this.audit.append({
            groupId: ctx.groupId,
            empresaId: existing.empresa_id ?? ctx.empresaId,
            actorId: ctx.actorId,
            actorEmail: ctx.actorEmail,
            entity: 'Cliente',
            entityId: existing.id,
            action: 'duplicate_block',
            beforeData: sanitizeClienteAudit(existing),
            afterData: {
              attempted_documento: maskDocumento(docNorm),
              attempted_cliente_id: id,
              reason: 'DUPLICATE_DOCUMENT',
            },
            requestId: ctx.requestId,
            ipAddress: ctx.ipAddress,
          });
          throw new AppError(409, 'DUPLICATE_DOCUMENT', 'Cliente with same CPF/CNPJ already exists in group');
        }
      }
    }

    let updated: Cliente | null;
    try {
      updated = await this.repo.update(scope, id, parsed.data);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
    if (!updated) throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: updated.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Cliente',
      entityId: id,
      action: 'update',
      beforeData: sanitizeClienteAudit(before),
      afterData: sanitizeClienteAudit(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }

  async softDelete(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'inativar');
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const before = await this.repo.getById(scope, id);
    if (!before || before.ativo === false) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
    const updated = await this.repo.softDelete(scope, id);
    if (!updated) throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: updated.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Cliente',
      entityId: id,
      action: 'soft_delete',
      beforeData: sanitizeClienteAudit(before),
      afterData: sanitizeClienteAudit(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }

  async restore(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'restaurar');
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const before = await this.repo.getById(scope, id);
    // Restore só de inativo existente no tenant; ativo → 404 idempotente.
    if (!before || before.ativo === true) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found for restore in tenant scope');
    }
    const updated = await this.repo.restore(scope, id);
    if (!updated) throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found for restore in tenant scope');
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: updated.empresa_id ?? ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Cliente',
      entityId: id,
      action: 'restore',
      beforeData: sanitizeClienteAudit(before),
      afterData: sanitizeClienteAudit(updated),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
    return updated;
  }

  async listEmpresaLinks(
    ctx: RequestContext,
    clienteId: string,
    options: ClienteEmpresaListOptions = {},
  ) {
    return this.empresaOperations.list(ctx, clienteId, options);
  }

  async getEmpresaLink(ctx: RequestContext, clienteId: string, empresaId: string) {
    return this.empresaOperations.get(ctx, clienteId, empresaId);
  }

  async createEmpresaLink(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    return this.empresaOperations.create(ctx, clienteId, empresaId, payload);
  }

  async updateEmpresaLink(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    return this.empresaOperations.update(ctx, clienteId, empresaId, payload);
  }

  async blockEmpresaLink(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    return this.empresaOperations.block(ctx, clienteId, empresaId, payload);
  }

  async unblockEmpresaLink(ctx: RequestContext, clienteId: string, empresaId: string) {
    return this.empresaOperations.unblock(ctx, clienteId, empresaId);
  }

  async softDeleteEmpresaLink(ctx: RequestContext, clienteId: string, empresaId: string) {
    return this.empresaOperations.softDelete(ctx, clienteId, empresaId);
  }

  async restoreEmpresaLink(ctx: RequestContext, clienteId: string, empresaId: string) {
    return this.empresaOperations.restore(ctx, clienteId, empresaId);
  }

  private async handleCreateConflict(
    ctx: RequestContext,
    error: unknown,
    docNorm: string,
    tipo: string,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message) && /documento/i.test(message)) {
      const existing = docNorm ? await this.repo.findByDocumento(ctx.groupId, docNorm) : null;
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: existing?.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'Cliente',
        entityId: existing?.id ?? null,
        action: 'duplicate_block',
        beforeData: sanitizeClienteAudit(existing),
        afterData: {
          attempted_documento: maskDocumento(docNorm),
          attempted_tipo: tipo,
          reason: 'DUPLICATE_DOCUMENT',
        },
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      });
      throw new AppError(409, 'DUPLICATE_DOCUMENT', 'Cliente with same CPF/CNPJ already exists in group');
    }
    this.rethrowConflict(error);
  }

  private rejectForbiddenFields(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const keys = Object.keys(payload as Record<string, unknown>);
    const forbidden = keys.filter((k) => (
      (CLIENTE_FORBIDDEN_FIELDS as readonly string[]).includes(k)
      || /^(limite_|credito_|tabela_preco|vendedor_|saldo_)/i.test(k)
    ));
    if (forbidden.length > 0) {
      throw new AppError(
        400,
        'OPERATIONAL_FIELD_FORBIDDEN',
        'Cliente master-data API rejects commercial/credit operational fields',
        { fields: forbidden },
      );
    }
  }

  private validateUpdatedIdentity(
    before: Cliente,
    data: ReturnType<typeof clienteUpdateSchema.parse>,
  ) {
    const candidate = clienteCreateSchema.safeParse({
      empresa_id: data.empresa_id === undefined ? before.empresa_id : data.empresa_id,
      ativo: data.ativo === undefined ? before.ativo : data.ativo,
      tipo: data.tipo ?? before.tipo,
      documento: data.documento === undefined && data.cpf_cnpj === undefined
        ? before.documento
        : (data.documento ?? data.cpf_cnpj),
      nome: data.nome === undefined ? before.nome : data.nome,
      razao_social: data.razao_social === undefined ? before.razao_social : data.razao_social,
      nome_fantasia: data.nome_fantasia === undefined ? before.nome_fantasia : data.nome_fantasia,
      nome_social: data.nome_social === undefined ? before.nome_social : data.nome_social,
      inscricao_estadual: data.inscricao_estadual === undefined
        ? before.inscricao_estadual
        : data.inscricao_estadual,
      inscricao_municipal: data.inscricao_municipal === undefined
        ? before.inscricao_municipal
        : data.inscricao_municipal,
      email: data.email === undefined ? before.email : data.email,
      telefone: data.telefone === undefined ? before.telefone : data.telefone,
      celular: data.celular === undefined ? before.celular : data.celular,
      status: data.status ?? before.status,
      origem: data.origem ?? before.origem,
      codigo_legado: data.codigo_legado === undefined ? before.codigo_legado : data.codigo_legado,
      legacy_id: data.legacy_id === undefined ? before.legacy_id : data.legacy_id,
      source_system: data.source_system === undefined ? before.source_system : data.source_system,
      migration_batch: data.migration_batch === undefined
        ? before.migration_batch
        : data.migration_batch,
      observacoes: data.observacoes === undefined ? before.observacoes : data.observacoes,
    });
    if (!candidate.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid Cliente payload',
        candidate.error.flatten(),
      );
    }
  }

  private assertPermission(ctx: RequestContext, action: RbacAction) {
    return this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'cliente', action);
  }

  private assertScope(ctx: RequestContext) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
  }

  private rethrowConflict(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      throw new AppError(409, 'CONFLICT', 'Cliente conflicts with an existing record');
    }
    if (/TENANT_FK_MISMATCH/i.test(message)) {
      throw new AppError(409, 'TENANT_FK_MISMATCH', message);
    }
  }
}
