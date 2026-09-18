import { AppError } from '../api/errors.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteLocalRepository } from '../repositories/inMemoryClienteLocalRepository.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import {
  CLIENTE_LOCAL_FINALIDADES,
  clienteLocalCreateSchema,
  clienteLocalFinalidadesSchema,
  clienteLocalUpdateSchema,
  type ClienteLocal,
  type ClienteLocalFinalidadeInput,
} from '../repositories/clienteLocalTypes.js';

export type ClienteLocalListOptions = {
  ativo?: boolean;
  finalidade?: string;
  principal?: boolean;
  cidade?: string;
  uf?: string;
  search?: string;
  orderBy?: 'nome' | 'cidade' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

function auditSnapshot(local: ClienteLocal) {
  return sanitizeAuditSnapshot({
    id: local.id,
    group_id: local.group_id,
    cliente_id: local.cliente_id,
    nome: local.nome,
    cidade: local.cidade,
    uf: local.uf,
    pais: local.pais,
    possui_coordenadas: local.latitude != null && local.longitude != null,
    coordinate_source: local.coordinate_source,
    geocode_status: local.geocode_status,
    geocode_source: local.geocode_source,
    geocode_precision: local.geocode_precision,
    ativo: local.ativo,
    origem: local.origem,
    finalidades: local.finalidades.map((row) => ({
      finalidade: row.finalidade,
      principal: row.principal,
      ativo: row.ativo,
    })),
    updated_at: local.updated_at,
  });
}

function publicLocal(local: ClienteLocal) {
  const { endereco_fingerprint: _fingerprint, ...publicData } = local;
  return publicData;
}

export class ClienteLocalService {
  constructor(
    private readonly repo: ClienteLocalRepository,
    private readonly clienteRepo: ClienteRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(
    ctx: RequestContext,
    clienteId: string,
    options: ClienteLocalListOptions = {},
  ) {
    await this.prepare(ctx, clienteId, 'visualizar');
    if (
      options.finalidade
      && !(CLIENTE_LOCAL_FINALIDADES as readonly string[]).includes(options.finalidade)
    ) this.validationError({ finalidade: 'invalid' });
    if (options.search && options.search.length > 200) {
      this.validationError({ search: 'max_length_200' });
    }
    const limit = this.pageNumber(options.limit, 50, 1, 200);
    const offset = this.pageNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      clienteId,
      ativo: typeof options.ativo === 'boolean' ? options.ativo : true,
      finalidade: options.finalidade,
      principal: options.principal,
      cidade: options.cidade,
      uf: options.uf,
      search: options.search,
      orderBy: options.orderBy,
      orderDir: options.orderDir,
      limit,
      offset,
    });
    return {
      data: page.rows.map(publicLocal),
      meta: {
        limit,
        offset,
        total: page.total,
        hasMore: offset + page.rows.length < page.total,
      },
    };
  }

  async get(ctx: RequestContext, clienteId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'visualizar', localId);
    const local = await this.repo.get(this.scope(ctx, clienteId), localId);
    if (!local || !local.ativo) this.notFound();
    return publicLocal(local);
  }

  async create(ctx: RequestContext, clienteId: string, payload: unknown) {
    await this.prepare(ctx, clienteId, 'criar');
    const parsed = clienteLocalCreateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    if (parsed.data.finalidades.some((purpose) => purpose.principal)) {
      await this.assertPermission(ctx, 'principal');
    }
    try {
      const local = await this.repo.withTransaction(async (executor) => {
        const created = await this.repo.create(
          this.scope(ctx, clienteId),
          parsed.data,
          ctx.actorId,
          executor,
        );
        await this.audit.append({
          groupId: ctx.groupId,
          empresaId: ctx.empresaId,
          actorId: ctx.actorId,
          actorEmail: ctx.actorEmail,
          entity: 'ClienteLocal',
          entityId: created.id,
          action: 'create',
          afterData: auditSnapshot(created),
          requestId: ctx.requestId,
          ipAddress: ctx.ipAddress,
        }, executor);
        return created;
      });
      return publicLocal(local);
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(
    ctx: RequestContext,
    clienteId: string,
    localId: string,
    payload: unknown,
  ) {
    await this.prepare(ctx, clienteId, 'editar', localId);
    const parsed = clienteLocalUpdateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    try {
      const updated = await this.repo.withTransaction(async (executor) => {
        const before = await this.requireActive(ctx, clienteId, localId, executor);
        this.validateCandidate(before, parsed.data);
        const after = await this.repo.update(
          this.scope(ctx, clienteId),
          localId,
          parsed.data,
          ctx.actorId,
          executor,
        );
        if (!after) this.notFound();
        await this.appendAudit(ctx, 'update', before, after, executor);
        return after;
      });
      return publicLocal(updated);
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async setFinalidades(
    ctx: RequestContext,
    clienteId: string,
    localId: string,
    payload: unknown,
  ) {
    await this.prepare(ctx, clienteId, 'editar', localId);
    const parsed = clienteLocalFinalidadesSchema.safeParse(
      (payload as { finalidades?: unknown })?.finalidades,
    );
    if (!parsed.success) this.validationError(parsed.error.flatten());
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, localId, executor);
      if (this.principalChanged(before, parsed.data)) {
        await this.assertPermission(ctx, 'principal');
      }
      const after = await this.repo.replaceFinalidades(
        this.scope(ctx, clienteId),
        localId,
        parsed.data,
        ctx.actorId,
        executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'set_purposes', before, after, executor);
      return after;
    });
    return publicLocal(updated);
  }

  async softDelete(ctx: RequestContext, clienteId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'inativar', localId);
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, clienteId, localId, executor);
      if (before.finalidades.some((purpose) => purpose.principal)) {
        throw new AppError(
          409,
          'CLIENTE_LOCAL_IS_PRIMARY',
          'Remove primary purposes before inactivating local',
        );
      }
      const after = await this.repo.softDelete(
        this.scope(ctx, clienteId), localId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'soft_delete', before, after, executor);
      return after;
    });
    return publicLocal(updated);
  }

  async restore(ctx: RequestContext, clienteId: string, localId: string) {
    await this.prepare(ctx, clienteId, 'restaurar', localId);
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.repo.get(this.scope(ctx, clienteId), localId, executor);
      if (!before || before.ativo) this.notFound();
      const after = await this.repo.restore(
        this.scope(ctx, clienteId), localId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendAudit(ctx, 'restore', before, after, executor);
      return after;
    });
    return publicLocal(updated);
  }

  private async prepare(
    ctx: RequestContext,
    clienteId: string,
    action: RbacAction,
    localId?: string,
  ) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    this.assertUuid(clienteId, 'clienteId');
    if (localId) this.assertUuid(localId, 'localId');
    await this.assertPermission(ctx, action);
    const cliente = await this.clienteRepo.getById(
      { groupId: ctx.groupId, empresaId: ctx.empresaId },
      clienteId,
    );
    if (!cliente || !cliente.ativo) {
      throw new AppError(404, 'CLIENTE_NOT_FOUND', 'Cliente not found in tenant scope');
    }
    if (ctx.empresaId) {
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
      const relation = await this.clienteRepo.getEmpresaLink(
        { groupId: ctx.groupId, empresaId: ctx.empresaId },
        clienteId,
        ctx.empresaId,
      );
      if (!relation?.elegivel_operacao) {
        throw new AppError(403, 'CLIENTE_EMPRESA_NOT_ELIGIBLE', 'Cliente not eligible in company');
      }
    }
  }

  private async requireActive(
    ctx: RequestContext,
    clienteId: string,
    localId: string,
    executor?: import('../db/client.js').DbQueryExecutor,
  ) {
    const local = await this.repo.get(this.scope(ctx, clienteId), localId, executor);
    if (!local || !local.ativo) this.notFound();
    return local;
  }

  private appendAudit(
    ctx: RequestContext,
    action: 'update' | 'set_purposes' | 'soft_delete' | 'restore',
    before: ClienteLocal,
    after: ClienteLocal,
    executor?: import('../db/client.js').DbQueryExecutor,
  ) {
    return this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'ClienteLocal',
      entityId: after.id,
      action,
      beforeData: auditSnapshot(before),
      afterData: auditSnapshot(after),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private validateCandidate(before: ClienteLocal, update: Record<string, unknown>) {
    const candidate = clienteLocalCreateSchema.safeParse({
      nome: before.nome,
      cep: before.cep,
      logradouro: before.logradouro,
      numero: before.numero,
      complemento: before.complemento,
      bairro: before.bairro,
      cidade: before.cidade,
      uf: before.uf,
      pais: before.pais,
      referencia: before.referencia,
      latitude: before.latitude,
      longitude: before.longitude,
      coordinate_source: before.coordinate_source,
      geocode_status: before.geocode_status,
      geocode_source: before.geocode_source,
      geocode_precision: before.geocode_precision,
      geocoded_at: before.geocoded_at,
      origem: before.origem,
      legacy_id: before.legacy_id,
      legacy_code: before.legacy_code,
      source_system: before.source_system,
      migration_batch: before.migration_batch,
      imported_at: before.imported_at,
      finalidades: before.finalidades.map((row) => ({
        finalidade: row.finalidade,
        principal: row.principal,
      })),
      ...update,
    });
    if (!candidate.success) this.validationError(candidate.error.flatten());
  }

  private principalChanged(
    before: ClienteLocal,
    next: ClienteLocalFinalidadeInput[],
  ) {
    const current = new Map(before.finalidades.map((row) => [row.finalidade, row.principal]));
    return next.some((row) => current.get(row.finalidade) !== row.principal)
      || before.finalidades.some(
        (row) => row.principal && !next.some((candidate) => candidate.finalidade === row.finalidade),
      );
  }

  private assertPermission(ctx: RequestContext, action: RbacAction) {
    return this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'cliente_local', action);
  }

  private scope(ctx: RequestContext, clienteId: string) {
    return { groupId: ctx.groupId, clienteId };
  }

  private pageNumber(value: number | undefined, fallback: number, min: number, max: number) {
    if (value !== undefined && !Number.isFinite(value)) {
      this.validationError({ pagination: 'invalid_number' });
    }
    return Math.min(Math.max(Math.trunc(value ?? fallback), min), max);
  }

  private assertUuid(value: string, field: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`);
    }
  }

  private rethrowDuplicate(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('POSSIBLE_DUPLICATE')) {
      throw new AppError(409, 'POSSIBLE_DUPLICATE', 'Possible duplicate ClienteLocal');
    }
  }

  private validationError(details: unknown): never {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid ClienteLocal payload', details);
  }

  private notFound(): never {
    throw new AppError(404, 'CLIENTE_LOCAL_NOT_FOUND', 'ClienteLocal not found in tenant scope');
  }
}
