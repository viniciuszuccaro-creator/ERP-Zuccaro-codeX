import type { AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import { AppError } from '../api/errors.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ProdutoRelationGuard } from '../db/produtoRelationGuard.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import {
  PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS,
  isProdutoTipoCanonico,
  produtoCreateSchema,
  produtoUpdateSchema,
  type Produto,
  type ProdutoCreate,
  type ProdutoUpdate,
} from '../repositories/produtoTypes.js';

export type ProdutoListOptions = {
  ativo?: boolean;
  search?: string;
  codigo?: string;
  codigoBarras?: string;
  limit?: number;
  offset?: number;
};

export class ProdutoService {
  constructor(
    private readonly repo: ProdutoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly relationGuard: ProdutoRelationGuard,
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(ctx: RequestContext, options: ProdutoListOptions = {}) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'visualizar');
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    // Fail-safe operacional: sem ?ativo= explícito, listar SOMENTE ativo=true.
    // Search/count/paginação usam o mesmo filtro (meta.total alinhado aos rows).
    const ativo = typeof options.ativo === 'boolean' ? options.ativo : true;
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo,
      search: options.search,
      codigo: options.codigo,
      codigoBarras: options.codigoBarras,
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
    // Endpoint operacional: soft-deleted (ativo=false) trata-se como inexistente (404).
    if (!row || row.ativo === false) {
      throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    }
    return row;
  }

  async create(ctx: RequestContext, payload: unknown) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'criar');
    this.rejectOperationalFields(payload);
    const parsed = produtoCreateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto payload', parsed.error.flatten());
    }
    this.assertTipoItem(parsed.data.tipo_item);
    const empresaId = parsed.data.empresa_id ?? ctx.empresaId ?? null;
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    await this.assertRelations(ctx.groupId, parsed.data);
    return this.repo.withTransaction(async (executor) => {
      let created: Produto;
      try {
        created = await this.repo.create(
          { groupId: ctx.groupId, empresaId: ctx.empresaId },
          parsed.data,
          executor,
        );
      } catch (error) {
        this.rethrowConflict(error);
        throw error;
      }
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: created.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'Produto',
        entityId: created.id,
        action: 'create',
        afterData: sanitizeAuditSnapshot(created),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, executor);
      return created;
    });
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'editar');
    this.rejectOperationalFields(payload);
    const parsed = produtoUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto payload', parsed.error.flatten());
    }
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getById(scope, id, executor, { forUpdate: true });
      // A existencia, atividade e classificacao sao validadas sobre a linha bloqueada.
      if (!before || before.ativo === false) {
        throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      }
      if (parsed.data.tipo_item !== undefined) {
        this.assertTipoItem(parsed.data.tipo_item, before.tipo_item);
      }
      const empresaId = parsed.data.empresa_id === undefined ? before.empresa_id : parsed.data.empresa_id;
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
      await this.assertRelations(ctx.groupId, { ...before, ...parsed.data });
      let updated: Produto | null;
      try {
        updated = await this.repo.update(scope, id, parsed.data, executor);
      } catch (error) {
        this.rethrowConflict(error);
        throw error;
      }
      if (!updated) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: updated.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'Produto',
        entityId: id,
        action: 'update',
        beforeData: sanitizeAuditSnapshot(before),
        afterData: sanitizeAuditSnapshot(updated),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, executor);
      return updated;
    });
  }

  async softDelete(ctx: RequestContext, id: string) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'inativar');
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getById(scope, id, executor, { forUpdate: true });
      // Idempotente: ja inativo -> 404, sem auditoria enganosa false->false.
      if (!before || before.ativo === false) {
        throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      }
      const updated = await this.repo.softDelete(scope, id, executor);
      if (!updated) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: updated.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'Produto',
        entityId: id,
        action: 'soft_delete',
        beforeData: sanitizeAuditSnapshot(before),
        afterData: sanitizeAuditSnapshot(updated),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, executor);
      return updated;
    });
  }

  /** Garante que CRUD de Produto nao aceita campos transacionais. */
  assertNoStockSideEffects(payload: unknown) {
    this.rejectOperationalFields(payload);
  }

  private async assertRelations(groupId: string, data: {
    marca_id?: string | null;
    unidade_medida_id?: string | null;
    grupo_produto_id?: string | null;
    setor_atividade_id?: string | null;
  }) {
    await this.relationGuard.assertRelationsInGroup(groupId, {
      marcaId: data.marca_id,
      unidadeMedidaId: data.unidade_medida_id,
      grupoProdutoId: data.grupo_produto_id,
      setorAtividadeId: data.setor_atividade_id,
    });
  }

  private rejectOperationalFields(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const keys = Object.keys(payload as Record<string, unknown>);
    const forbidden = keys.filter((k) => (
      PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS.includes(k)
      || /^(estoque_|saldo_|custo_|preco_)/i.test(k)
    ));
    if (forbidden.length > 0) {
      throw new AppError(
        400,
        'OPERATIONAL_FIELD_FORBIDDEN',
        'Produto master-data API rejects transactional/operational fields',
        { fields: forbidden },
      );
    }
  }

  private assertTipoItem(value: string, currentLegacyValue?: string) {
    const preservesLegacy = currentLegacyValue !== undefined && value === currentLegacyValue;
    if (!isProdutoTipoCanonico(value) && !preservesLegacy) {
      throw new AppError(
        400,
        'PRODUTO_TIPO_INVALIDO',
        'Produto tipo_item must use the canonical classification',
      );
    }
  }

  private assertPermission(ctx: RequestContext, action: RbacAction) {
    return this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'produto', action);
  }

  private assertScope(ctx: RequestContext) {
    if (!ctx.groupId) {
      throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    }
  }

  private rethrowConflict(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      throw new AppError(409, 'CONFLICT', 'Produto conflicts with an existing record');
    }
    if (/TENANT_FK_MISMATCH/i.test(message)) {
      throw new AppError(409, 'TENANT_FK_MISMATCH', message);
    }
  }
}
