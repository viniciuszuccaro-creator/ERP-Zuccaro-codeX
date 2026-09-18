import type { AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import {
  CLIENTE_EMPRESA_SITUACOES,
  clienteEmpresaBlockSchema,
  clienteEmpresaCreateSchema,
  clienteEmpresaUpdateSchema,
  type ClienteEmpresa,
} from '../repositories/clienteTypes.js';

export type ClienteEmpresaListOptions = {
  ativo?: boolean;
  bloqueado?: boolean;
  situacaoComercial?: string;
  empresaId?: string;
  search?: string;
  orderBy?: 'empresa' | 'situacao' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export class ClienteEmpresaOperations {
  constructor(
    private readonly repo: ClienteRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(
    ctx: RequestContext,
    clienteId: string,
    options: ClienteEmpresaListOptions = {},
  ) {
    this.assertScope(ctx);
    this.assertUuid(clienteId, 'clienteId');
    await this.assertPermission(ctx, 'visualizar');
    await this.assertClienteAtivo(ctx, clienteId);
    if (
      options.situacaoComercial
      && !(CLIENTE_EMPRESA_SITUACOES as readonly string[]).includes(options.situacaoComercial)
    ) {
      this.validationError({ situacao: 'invalid' });
    }
    if (options.search && options.search.length > 200) {
      this.validationError({ search: 'max_length_200' });
    }
    const empresaId = ctx.empresaId ?? options.empresaId;
    if (ctx.empresaId && options.empresaId && options.empresaId !== ctx.empresaId) {
      this.permissionDenied();
    }
    if (empresaId) {
      this.assertUuid(empresaId, 'empresaId');
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    }
    const limit = this.pageNumber(options.limit, 50, 1, 200);
    const offset = this.pageNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await this.repo.listEmpresaLinks({
      groupId: ctx.groupId,
      empresaId,
      clienteId,
      ativo: typeof options.ativo === 'boolean' ? options.ativo : true,
      bloqueado: options.bloqueado,
      situacaoComercial: options.situacaoComercial,
      search: options.search,
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

  async assertCanCreate(ctx: RequestContext) {
    await this.assertPermission(ctx, 'criar');
  }

  async auditCreatedLink(ctx: RequestContext, row: ClienteEmpresa) {
    await this.appendAudit(ctx, 'link', null, row);
  }

  async get(ctx: RequestContext, clienteId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, empresaId, 'visualizar');
    const row = await this.repo.getEmpresaLink(this.scope(ctx), clienteId, empresaId);
    if (!row || !row.ativo) this.notFound();
    return row;
  }

  async create(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    await this.prepare(ctx, clienteId, empresaId, 'criar');
    const parsed = clienteEmpresaCreateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    this.assertConsistency(parsed.data.situacao_comercial, parsed.data.habilitado_operacao);
    const result = await this.repo.createEmpresaLink(
      this.scope(ctx), clienteId, empresaId, parsed.data, ctx.actorId,
    );
    if (!result.created) {
      if (!result.row.ativo) {
        throw new AppError(409, 'CLIENTE_EMPRESA_INACTIVE', 'Inactive relationship requires restore');
      }
      return result;
    }
    await this.appendAudit(ctx, 'link', null, result.row);
    return result;
  }

  async update(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    await this.prepare(ctx, clienteId, empresaId, 'editar');
    const parsed = clienteEmpresaUpdateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    const before = await this.requireActive(ctx, clienteId, empresaId);
    this.assertConsistency(
      parsed.data.situacao_comercial ?? before.situacao_comercial,
      parsed.data.habilitado_operacao ?? before.habilitado_operacao,
    );
    const updated = await this.repo.updateEmpresaLink(
      this.scope(ctx), clienteId, empresaId, parsed.data, ctx.actorId,
    );
    if (!updated) this.notFound();
    await this.appendAudit(ctx, 'update', before, updated);
    return updated;
  }

  async block(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    payload: unknown,
  ) {
    await this.prepare(ctx, clienteId, empresaId, 'bloquear');
    const parsed = clienteEmpresaBlockSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    const before = await this.requireActive(ctx, clienteId, empresaId);
    if (before.bloqueado) return before;
    const updated = await this.repo.setEmpresaLinkBlocked(
      this.scope(ctx), clienteId, empresaId, true, ctx.actorId, parsed.data.motivo,
    );
    if (!updated) this.notFound();
    await this.appendAudit(ctx, 'block', before, updated);
    return updated;
  }

  async unblock(ctx: RequestContext, clienteId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, empresaId, 'bloquear');
    const before = await this.requireActive(ctx, clienteId, empresaId);
    if (!before.bloqueado) return before;
    const updated = await this.repo.setEmpresaLinkBlocked(
      this.scope(ctx), clienteId, empresaId, false, ctx.actorId,
    );
    if (!updated) this.notFound();
    await this.appendAudit(ctx, 'unblock', before, updated);
    return updated;
  }

  async softDelete(ctx: RequestContext, clienteId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, empresaId, 'inativar');
    const before = await this.requireActive(ctx, clienteId, empresaId);
    const updated = await this.repo.softDeleteEmpresaLink(
      this.scope(ctx), clienteId, empresaId, ctx.actorId,
    );
    if (!updated) this.notFound();
    await this.appendAudit(ctx, 'inactivate', before, updated);
    return updated;
  }

  async restore(ctx: RequestContext, clienteId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, empresaId, 'restaurar');
    const before = await this.repo.getEmpresaLink(this.scope(ctx), clienteId, empresaId);
    if (!before || before.ativo) this.notFound();
    const updated = await this.repo.restoreEmpresaLink(
      this.scope(ctx), clienteId, empresaId, ctx.actorId,
    );
    if (!updated) this.notFound();
    await this.appendAudit(ctx, 'restore', before, updated);
    return updated;
  }

  private async prepare(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
    action: RbacAction,
  ) {
    this.assertScope(ctx);
    this.assertUuid(clienteId, 'clienteId');
    this.assertUuid(empresaId, 'empresaId');
    await this.assertPermission(ctx, action);
    if (ctx.empresaId && ctx.empresaId !== empresaId) this.permissionDenied();
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    await this.assertClienteAtivo(ctx, clienteId);
  }

  private async assertClienteAtivo(ctx: RequestContext, clienteId: string) {
    const cliente = await this.repo.getById(this.scope(ctx), clienteId);
    if (!cliente || !cliente.ativo) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
  }

  private async requireActive(
    ctx: RequestContext,
    clienteId: string,
    empresaId: string,
  ) {
    const row = await this.repo.getEmpresaLink(this.scope(ctx), clienteId, empresaId);
    if (!row || !row.ativo) this.notFound();
    return row;
  }

  private appendAudit(
    ctx: RequestContext,
    action: 'link' | 'update' | 'block' | 'unblock' | 'inactivate' | 'restore',
    before: ClienteEmpresa | null,
    after: ClienteEmpresa,
  ) {
    return this.audit.append({
      groupId: ctx.groupId,
      empresaId: after.empresa_id,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'ClienteEmpresa',
      entityId: after.id,
      action,
      beforeData: before ? sanitizeAuditSnapshot(before) : undefined,
      afterData: sanitizeAuditSnapshot(after),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    });
  }

  private assertConsistency(situacao: string, habilitado: boolean) {
    if (habilitado && situacao !== 'ATIVO') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Only ATIVO relationship can be enabled for operation',
      );
    }
  }

  private assertPermission(ctx: RequestContext, action: RbacAction) {
    return this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'cliente_empresa', action);
  }

  private scope(ctx: RequestContext) {
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private assertScope(ctx: RequestContext) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
  }

  private assertUuid(value: string, field: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`);
    }
  }

  private pageNumber(value: number | undefined, fallback: number, min: number, max: number) {
    if (value !== undefined && !Number.isFinite(value)) {
      this.validationError({ pagination: 'invalid_number' });
    }
    return Math.min(Math.max(Math.trunc(value ?? fallback), min), max);
  }

  private permissionDenied(): never {
    throw new AppError(403, 'PERMISSION_DENIED', 'Permission denied');
  }

  private validationError(details: unknown): never {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ClienteEmpresa payload', details);
  }

  private notFound(): never {
    throw new AppError(404, 'CLIENTE_EMPRESA_NOT_FOUND', 'Relationship not found in tenant scope');
  }
}
