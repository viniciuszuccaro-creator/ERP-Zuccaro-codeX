import { AppError } from '../api/errors.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { ClienteLocalRepository } from '../repositories/inMemoryClienteLocalRepository.js';
import type { ObraRepository, ObraScope } from '../repositories/inMemoryObraRepository.js';
import { InMemoryObraRepository } from '../repositories/inMemoryObraRepository.js';
import {
  OBRA_STATUS,
  OBRA_USOS,
  obraCreateSchema,
  obraLocalInputSchema,
  obraUpdateSchema,
  obraAuditSnapshot,
  publicObra,
  type Obra,
} from '../repositories/obraTypes.js';

export type ObraListOptions = {
  ativo?: boolean;
  status?: string;
  operacional?: boolean;
  search?: string;
  cidade?: string;
  uf?: string;
  orderBy?: 'nome' | 'codigo' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export class ObraService {
  constructor(
    private readonly repo: ObraRepository,
    private readonly clienteRepo: ClienteRepository,
    private readonly localRepo: ClienteLocalRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(ctx: RequestContext, clienteId: string, options: ObraListOptions = {}) {
    await this.prepare(ctx, clienteId, 'visualizar', { allowIneligible: true });
    if (options.status && !(OBRA_STATUS as readonly string[]).includes(options.status)) {
      this.validationError({ status: 'invalid' });
    }
    if (options.search && options.search.length > 200) this.validationError({ search: 'max_length_200' });
    if (options.operacional && ctx.empresaId) {
      await this.assertEligible(ctx, clienteId, true);
    }
    const limit = this.pageNumber(options.limit, 50, 1, 200);
    const offset = this.pageNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      clienteId,
      empresaId: ctx.empresaId,
      ativo: typeof options.ativo === 'boolean' ? options.ativo : true,
      status: options.status,
      operacional: options.operacional,
      search: options.search,
      cidade: options.cidade,
      uf: options.uf,
      orderBy: options.orderBy,
      orderDir: options.orderDir,
      limit,
      offset,
    });
    return {
      data: page.rows.map(publicObra),
      meta: {
        limit,
        offset,
        total: page.total,
        hasMore: offset + page.rows.length < page.total,
      },
    };
  }

  async get(ctx: RequestContext, clienteId: string, obraId: string) {
    await this.prepare(ctx, clienteId, 'visualizar', { allowIneligible: true, obraId });
    const obra = await this.repo.get(this.scope(ctx, clienteId), obraId);
    if (!obra || !obra.ativo) this.notFound();
    return publicObra(obra);
  }

  async create(ctx: RequestContext, clienteId: string, payload: unknown) {
    await this.prepare(ctx, clienteId, 'criar', { requireEligible: true, requireEmpresa: true });
    const parsed = obraCreateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    if (parsed.data.locais.some((row) => row.principal)) {
      await this.assertPermission(ctx, 'principal');
    }
    await this.assertPermission(ctx, 'vincular-empresa');
    await this.assertPermission(ctx, 'vincular-local');
    const locals = [];
    for (const row of parsed.data.locais) {
      locals.push(await this.requireLocal(ctx, clienteId, row.cliente_local_id));
    }
    this.hydrateMemory(ctx, clienteId, locals);
    const principalId = parsed.data.locais.find((row) => row.principal)?.cliente_local_id;
    try {
      const obra = await this.repo.withTransaction(async (executor) => {
        const duplicate = await this.repo.findPossibleDuplicate(
          this.scope(ctx, clienteId),
          parsed.data.nome,
          principalId!,
          undefined,
          executor,
        );
        if (duplicate && !parsed.data.confirm_possible_duplicate) {
          throw new AppError(409, 'POSSIBLE_DUPLICATE', 'Possible duplicate Obra');
        }
        const created = await this.repo.create(
          this.scope(ctx, clienteId), parsed.data, ctx.actorId, executor,
        );
        if (duplicate && parsed.data.confirm_possible_duplicate) {
          await this.appendAudit(ctx, 'possible_duplicate_override', created, created, executor);
        }
        await this.appendAudit(ctx, 'create', created, created, executor);
        return created;
      });
      return publicObra(obra);
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async update(ctx: RequestContext, clienteId: string, obraId: string, payload: unknown) {
    await this.prepare(ctx, clienteId, 'editar', { requireEligible: true, obraId });
    const parsed = obraUpdateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.update(
        this.scope(ctx, clienteId), obraId, parsed.data, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      const action: AuditAction = parsed.data.status && parsed.data.status !== before.status
        ? 'change_status'
        : 'update';
      await this.appendAudit(ctx, action, before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async softDelete(ctx: RequestContext, clienteId: string, obraId: string) {
    await this.prepare(ctx, clienteId, 'inativar', { requireEligible: true, obraId });
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.softDelete(
        this.scope(ctx, clienteId), obraId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'inactivate', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async restore(ctx: RequestContext, clienteId: string, obraId: string) {
    await this.prepare(ctx, clienteId, 'restaurar', { requireEligible: true, obraId });
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.repo.get(
        { groupId: ctx.groupId, clienteId }, obraId, executor,
      );
      if (!before || before.ativo) this.notFound();
      const after = await this.repo.restore(
        this.scope(ctx, clienteId), obraId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'restore', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async linkEmpresa(ctx: RequestContext, clienteId: string, obraId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, 'vincular-empresa', { requireEligible: true, obraId });
    this.assertUuid(empresaId, 'empresaId');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    await this.assertEligible({ ...ctx, empresaId }, clienteId, true);
    this.hydrateMemory({ ...ctx, empresaId }, clienteId, []);
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.linkEmpresa(
        this.scope(ctx, clienteId), obraId, empresaId, ctx.actorId, executor,
      );
      await this.appendAudit(ctx, 'link', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async unlinkEmpresa(ctx: RequestContext, clienteId: string, obraId: string, empresaId: string) {
    await this.prepare(ctx, clienteId, 'vincular-empresa', { requireEligible: true, obraId });
    this.assertUuid(empresaId, 'empresaId');
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.unlinkEmpresa(
        this.scope(ctx, clienteId), obraId, empresaId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'inactivate', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async restoreEmpresa(ctx: RequestContext, clienteId: string, obraId: string, empresaId: string) {
    return this.linkEmpresa(ctx, clienteId, obraId, empresaId);
  }

  async linkLocal(ctx: RequestContext, clienteId: string, obraId: string, payload: unknown) {
    await this.prepare(ctx, clienteId, 'vincular-local', { requireEligible: true, obraId });
    const parsed = obraLocalInputSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    if (parsed.data.principal) await this.assertPermission(ctx, 'principal');
    const local = await this.requireLocal(ctx, clienteId, parsed.data.cliente_local_id);
    this.hydrateMemory(ctx, clienteId, [local]);
    const updated = await this.repo.withTransaction(async (executor) => {
      await this.repo.lock(this.scope(ctx, clienteId), obraId, executor);
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.linkLocal(
        this.scope(ctx, clienteId), obraId, parsed.data, ctx.actorId, executor,
      );
      await this.appendAudit(
        ctx,
        parsed.data.principal ? 'change_primary_local' : 'link',
        before,
        after,
        executor,
      );
      return after;
    });
    return publicObra(updated);
  }

  async unlinkLocal(ctx: RequestContext, clienteId: string, obraId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'vincular-local', { requireEligible: true, obraId });
    this.assertUuid(localId, 'localId');
    const updated = await this.repo.withTransaction(async (executor) => {
      await this.repo.lock(this.scope(ctx, clienteId), obraId, executor);
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const target = before.locais.find((row) => row.cliente_local_id === localId && row.ativo);
      if (!target) this.notFound();
      if (target.principal) {
        throw new AppError(409, 'OBRA_PRIMARY_LOCAL_REQUIRED', 'Replace primary local before unlink');
      }
      const after = await this.repo.unlinkLocal(
        this.scope(ctx, clienteId), obraId, localId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'inactivate', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async restoreLocal(ctx: RequestContext, clienteId: string, obraId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'vincular-local', { requireEligible: true, obraId });
    this.assertUuid(localId, 'localId');
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.restoreLocal(
        this.scope(ctx, clienteId), obraId, localId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'restore', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async setPrincipal(ctx: RequestContext, clienteId: string, obraId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'principal', { requireEligible: true, obraId });
    this.assertUuid(localId, 'localId');
    const updated = await this.repo.withTransaction(async (executor) => {
      await this.repo.lock(this.scope(ctx, clienteId), obraId, executor);
      const before = await this.requireActive(ctx, clienteId, obraId, executor);
      const after = await this.repo.setPrincipal(
        this.scope(ctx, clienteId), obraId, localId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'change_primary_local', before, after, executor);
      return after;
    });
    return publicObra(updated);
  }

  async findActiveObraUsingLocal(groupId: string, localId: string, executor?: DbQueryExecutor) {
    return this.repo.findActiveObraUsingLocal(groupId, localId, executor);
  }

  private async prepare(
    ctx: RequestContext,
    clienteId: string,
    action: RbacAction,
    options: {
      allowIneligible?: boolean;
      requireEligible?: boolean;
      requireEmpresa?: boolean;
      obraId?: string;
    } = {},
  ) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    this.assertUuid(clienteId, 'clienteId');
    if (options.obraId) this.assertUuid(options.obraId, 'obraId');
    await this.assertPermission(ctx, action);
    const cliente = await this.clienteRepo.getById(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      clienteId,
    );
    if (!cliente || !cliente.ativo) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
    if (options.requireEmpresa && !ctx.empresaId) {
      throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required to create Obra');
    }
    if (ctx.empresaId) {
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
      const relation = await this.clienteRepo.getEmpresaLink(
        { groupId: ctx.groupId, empresaId: ctx.empresaId },
        clienteId,
        ctx.empresaId,
      );
      if (!relation) {
        if (options.allowIneligible) {
          throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
        }
        throw new AppError(403, 'CLIENTE_EMPRESA_REQUIRED', 'ClienteEmpresa is required');
      }
      if (options.requireEligible && !relation.elegivel_operacao) {
        throw new AppError(403, 'CLIENTE_EMPRESA_NOT_ELIGIBLE', 'Cliente not eligible in company');
      }
      if (!options.allowIneligible && !options.requireEligible && !relation.elegivel_operacao) {
        throw new AppError(403, 'CLIENTE_EMPRESA_NOT_ELIGIBLE', 'Cliente not eligible in company');
      }
    }
  }

  private async assertEligible(ctx: RequestContext, clienteId: string, required: boolean) {
    if (!ctx.empresaId) return;
    const relation = await this.clienteRepo.getEmpresaLink(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      clienteId,
      ctx.empresaId,
    );
    if (!relation || (required && !relation.elegivel_operacao)) {
      throw new AppError(403, 'CLIENTE_EMPRESA_NOT_ELIGIBLE', 'Cliente not eligible in company');
    }
  }

  private async requireLocal(ctx: RequestContext, clienteId: string, localId: string) {
    const local = await this.localRepo.get({ groupId: ctx.groupId, clienteId }, localId);
    if (!local || !local.ativo) {
      throw new AppError(404, 'CLIENTE_LOCAL_NOT_FOUND', 'ClienteLocal not found in tenant scope');
    }
    if (local.group_id !== ctx.groupId || local.cliente_id !== clienteId) {
      throw new AppError(404, 'CLIENTE_LOCAL_NOT_FOUND', 'ClienteLocal not found in tenant scope');
    }
    return local;
  }

  private hydrateMemory(
    ctx: RequestContext,
    clienteId: string,
    locals: Array<{ id: string; group_id: string; cliente_id: string; nome: string; cidade: string; uf: string }>,
  ) {
    if (!(this.repo instanceof InMemoryObraRepository)) return;
    const memory = this.repo;
    if (ctx.empresaId) memory.seedClienteEmpresa(ctx.groupId, clienteId, ctx.empresaId);
    locals.forEach((local) => memory.seedLocal({
      id: local.id,
      group_id: local.group_id,
      cliente_id: local.cliente_id,
      nome: local.nome,
      cidade: local.cidade,
      uf: local.uf,
    }));
  }

  private async requireActive(
    ctx: RequestContext,
    clienteId: string,
    obraId: string,
    executor?: DbQueryExecutor,
  ) {
    const obra = await this.repo.get(
      { groupId: ctx.groupId, clienteId }, obraId, executor,
    );
    if (!obra || !obra.ativo) this.notFound();
    return obra;
  }

  private appendAudit(
    ctx: RequestContext,
    action: AuditAction,
    before: Obra,
    after: Obra,
    executor?: DbQueryExecutor,
  ) {
    return this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Obra',
      entityId: after.id,
      action,
      beforeData: action === 'create' ? undefined : obraAuditSnapshot(before),
      afterData: obraAuditSnapshot(after),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private scope(ctx: RequestContext, clienteId: string): ObraScope {
    return { groupId: ctx.groupId, clienteId, empresaId: ctx.empresaId };
  }

  private assertPermission(ctx: RequestContext, action: RbacAction) {
    return this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'obra', action);
  }

  private pageNumber(value: number | undefined, fallback: number, min: number, max: number) {
    if (value !== undefined && !Number.isFinite(value)) this.validationError({ pagination: 'invalid_number' });
    return Math.min(Math.max(Math.trunc(value ?? fallback), min), max);
  }

  private assertUuid(value: string, field: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`);
    }
  }

  private rethrowKnown(error: unknown) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('POSSIBLE_DUPLICATE')) {
      throw new AppError(409, 'POSSIBLE_DUPLICATE', 'Possible duplicate Obra');
    }
    if (message.includes('CLIENTE_EMPRESA_REQUIRED')) {
      throw new AppError(403, 'CLIENTE_EMPRESA_REQUIRED', 'ClienteEmpresa is required');
    }
    if (message.includes('TENANT_FK_MISMATCH')) {
      throw new AppError(404, 'CLIENTE_LOCAL_NOT_FOUND', 'ClienteLocal not found in tenant scope');
    }
    if (message.includes('EMPRESA_ID_REQUIRED')) {
      throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required to create Obra');
    }
  }

  private validationError(details: unknown): never {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Obra payload', details);
  }

  private notFound(): never {
    throw new AppError(404, 'OBRA_NOT_FOUND', 'Obra not found in tenant scope');
  }
}

export { OBRA_USOS };
