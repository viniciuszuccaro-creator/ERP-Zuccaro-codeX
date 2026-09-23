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
  produtoEquivalenteCreateSchema,
  produtoEquivalenteUpdateSchema,
  produtoMidiaCreateSchema,
  produtoVarianteCreateSchema,
  produtoVarianteUpdateSchema,
  type ProdutoEquivalenteCreate,
  type ProdutoEquivalenteUpdate,
  type ProdutoVarianteCreate,
  type ProdutoVarianteUpdate,
  type Produto,
  type ProdutoMidia,
  type ProdutoCreate,
  type ProdutoUpdate,
} from '../repositories/produtoTypes.js';

import { checkProdutoMidiaPath, confirmProdutoMidia, listProdutoMidias, rejectExpiredProdutoMidia, reserveProdutoMidia } from './produtoMidiaFlow.js';
import { NotImplementedStorage, type StoragePort } from './storagePort.js';
const WORKFLOW_TRANSITIONS: Record<Produto['workflow_status'], Produto['workflow_status'][]> = {
  RASCUNHO: ['EM_REVISAO'],
  EM_REVISAO: ['RASCUNHO', 'APROVADO'],
  APROVADO: ['EM_REVISAO', 'PUBLICADO'],
  PUBLICADO: ['INATIVO'],
  INATIVO: ['RASCUNHO'],
};


const WORKFLOW_ACTION: Record<Produto['workflow_status'], RbacAction> = {
  RASCUNHO: 'editar',
  EM_REVISAO: 'editar',
  APROVADO: 'aprovar-conteudo',
  PUBLICADO: 'publicar',
  INATIVO: 'inativar',
};

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
    private readonly storage: StoragePort = new NotImplementedStorage(),
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
    this.assertEmpresaOwnership(ctx, empresaId);
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
      this.assertEmpresaOwnership(ctx, empresaId);
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

  async changeWorkflowStatus(ctx: RequestContext, id: string, targetInput: unknown) {
    this.assertScope(ctx);
    if (typeof targetInput !== 'string' || !Object.hasOwn(WORKFLOW_TRANSITIONS, targetInput)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto workflow status');
    }
    const target = targetInput as Produto['workflow_status'];
    await this.assertPermission(ctx, WORKFLOW_ACTION[target]);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const before = await this.repo.getById(scope, id, executor, { forUpdate: true });
      if (!before || before.ativo === false) {
        throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      }
      if (!WORKFLOW_TRANSITIONS[before.workflow_status].includes(target)) {
        throw new AppError(409, 'PRODUTO_WORKFLOW_CONFLICT', 'Produto workflow transition is not allowed');
      }
      const updated = await this.repo.changeWorkflowStatus(scope, id, target, executor);
      if (!updated) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      if (target === 'PUBLICADO') {
        await this.repo.appendPublicationEvent(scope, updated, ctx.requestId, executor);
      }
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: updated.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'Produto',
        entityId: id,
        action: target === 'APROVADO' ? 'approve' : target === 'PUBLICADO' ? 'publish' : 'change_status',
        beforeData: sanitizeAuditSnapshot({ workflow_status: before.workflow_status }),
        afterData: sanitizeAuditSnapshot({ workflow_status: updated.workflow_status }),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, executor);
      return updated;
    });
  }
  /** Garante que CRUD de Produto nao aceita campos transacionais. */
  async listMidias(ctx: RequestContext, produtoId: string, page?: { limit: number; offset: number }) {
    return listProdutoMidias({
      repo: this.repo, audit: this.audit, tenantGuard: this.tenantGuard,
      rbacGuard: this.rbacGuard, storage: this.storage,
    }, ctx, produtoId, page);
  }

  async reserveMidia(ctx: RequestContext, produtoId: string, payload: unknown) {
    return reserveProdutoMidia({
      repo: this.repo, audit: this.audit, tenantGuard: this.tenantGuard,
      rbacGuard: this.rbacGuard, storage: this.storage,
    }, ctx, produtoId, payload);
  }

  async confirmMidia(ctx: RequestContext, produtoId: string, mediaId: string, attemptId: string) {
    return confirmProdutoMidia({
      repo: this.repo, audit: this.audit, tenantGuard: this.tenantGuard,
      rbacGuard: this.rbacGuard, storage: this.storage,
    }, ctx, produtoId, mediaId, attemptId);
  }
  async rejectExpiredMidia(ctx: RequestContext, produtoId: string, mediaId: string) {
    return rejectExpiredProdutoMidia({
      repo: this.repo, audit: this.audit, tenantGuard: this.tenantGuard,
      rbacGuard: this.rbacGuard, storage: this.storage,
    }, ctx, produtoId, mediaId);
  }
  async registerMidia(ctx: RequestContext, produtoId: string, payload: unknown) {
    this.assertScope(ctx);
    this.assertRelationId(produtoId);
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required for media');
    await this.assertPermission(ctx, 'editar');
    if (!ctx.actorId) throw new AppError(403, 'PERMISSION_DENIED', 'Actor is required for media');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    const parsed = produtoMidiaCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto media payload', parsed.error.flatten());
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const produto = await this.repo.getById(scope, produtoId);
    if (!produto || !produto.ativo || produto.empresa_id !== ctx.empresaId) {
      throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    }
    const data = parsed.data;
    checkProdutoMidiaPath(ctx, produtoId, data);
    const verified = await this.storage.confirmUpload({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      entity: 'Produto', entityId: produtoId,
      storageKey: data.storage_key, fileName: data.nome_arquivo,
      mimeType: data.mime_type, sizeBytes: data.tamanho_bytes, sha256: data.sha256,
    });
    if (verified.storageKey !== data.storage_key || verified.fileName !== data.nome_arquivo
      || verified.mimeType !== data.mime_type || verified.sizeBytes !== data.tamanho_bytes
      || verified.sha256 !== data.sha256 || verified.version !== data.versao) {
      throw new AppError(409, 'STORAGE_METADATA_MISMATCH', 'Media metadata differs from verified object');
    }
    return this.repo.withTransaction(async (executor) => {
      const locked = await this.repo.getById(scope, produtoId, executor, { forUpdate: true });
      if (!locked || !locked.ativo || locked.empresa_id !== ctx.empresaId) {
        throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      }
      let row;
      try {
        row = await this.repo.createMidia(scope, produtoId, data, executor);
      } catch (error) { this.rethrowConflict(error); throw error; }
      if (!row) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
        actorEmail: ctx.actorEmail, entity: 'ProdutoMidia', entityId: row.id,
        action: 'create',
        afterData: { categoria: row.categoria, versao: row.versao, status: row.status, tamanho_bytes: row.tamanho_bytes },
        requestId: ctx.requestId, ipAddress: ctx.ipAddress,
      }, executor);
      return row;
    });
  }

  async deactivateMidia(ctx: RequestContext, produtoId: string, midiaId: string) {
    this.assertScope(ctx);
    this.assertRelationId(produtoId);
    this.assertRelationId(midiaId);
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required for media');
    await this.assertPermission(ctx, 'editar');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const produto = await this.repo.getById(scope, produtoId, executor, { forUpdate: true });
      if (!produto || !produto.ativo || produto.empresa_id !== ctx.empresaId) {
        throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      }
      const before = (await this.repo.listMidias(scope, produtoId, executor)).find((row) => row.id === midiaId);
      if (!before) throw new AppError(404, 'PRODUTO_MIDIA_NOT_FOUND', 'Media not found in tenant scope');
      const after = await this.repo.deactivateMidia(scope, produtoId, midiaId, executor);
      if (!after) throw new AppError(404, 'PRODUTO_MIDIA_NOT_FOUND', 'Media not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
        actorEmail: ctx.actorEmail, entity: 'ProdutoMidia', entityId: midiaId,
        action: 'soft_delete',
        beforeData: { categoria: before.categoria, versao: before.versao, status: before.status },
        afterData: { categoria: after.categoria, versao: after.versao, status: after.status },
        requestId: ctx.requestId, ipAddress: ctx.ipAddress,
      }, executor);
      return after;
    });
  }
  async listVariants(ctx: RequestContext, id: string) { return this.listRelations(ctx, id, 'variantes'); }

  async listEquivalents(ctx: RequestContext, id: string) { return this.listRelations(ctx, id, 'equivalentes'); }

  private async listRelations(ctx: RequestContext, id: string, kind: 'variantes' | 'equivalentes') {
    this.assertScope(ctx);
    this.assertRelationId(id);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.assertPermission(ctx, 'visualizar');
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    const produto = await this.repo.getById(scope, id);
    if (!produto || produto.ativo === false) {
      throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
    }
    return kind === 'variantes'
      ? this.repo.listVariants(scope, id)
      : this.repo.listEquivalents(scope, id);
  }


  async createVariant(ctx: RequestContext, produtoId: string, payload: unknown) {
    const parsed = produtoVarianteCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto variante payload', parsed.error.flatten());
    return this.mutateVariant(ctx, produtoId, 'create', undefined, parsed.data);
  }

  async updateVariant(ctx: RequestContext, produtoId: string, variantId: string, payload: unknown) {
    const parsed = produtoVarianteUpdateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto variante payload', parsed.error.flatten());
    return this.mutateVariant(ctx, produtoId, 'update', variantId, parsed.data);
  }

  async deactivateVariant(ctx: RequestContext, produtoId: string, variantId: string) {
    return this.mutateVariant(ctx, produtoId, 'deactivate', variantId);
  }

  private async mutateVariant(ctx: RequestContext, produtoId: string, operation: 'create' | 'update' | 'deactivate', variantId?: string, data?: ProdutoVarianteCreate | ProdutoVarianteUpdate) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'editar');
    this.assertRelationId(produtoId);
    if (variantId) this.assertRelationId(variantId);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const produto = await this.repo.getById(scope, produtoId, executor, { forUpdate: true });
      if (!produto || !produto.ativo) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, produto.empresa_id);
      const ownerScope = { groupId: ctx.groupId, empresaId: produto.empresa_id ?? undefined };
      const before = variantId ? (await this.repo.listVariants(ownerScope, produtoId, executor)).find((row) => row.id === variantId) : undefined;
      if (operation !== 'create' && !before) throw new AppError(404, 'PRODUTO_VARIANTE_NOT_FOUND', 'Produto variante not found in tenant scope');
      let result;
      try {
        result = operation === 'create'
          ? await this.repo.createVariant(ownerScope, produtoId, data as ProdutoVarianteCreate, executor)
          : operation === 'update'
            ? await this.repo.updateVariant(ownerScope, produtoId, variantId!, data as ProdutoVarianteUpdate, executor)
            : await this.repo.deactivateVariant(ownerScope, produtoId, variantId!, executor);
      } catch (error) {
        this.rethrowConflict(error);
        throw error;
      }
      if (!result) throw new AppError(404, 'PRODUTO_VARIANTE_NOT_FOUND', 'Produto variante not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId,
        empresaId: result.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        entity: 'ProdutoVariante',
        entityId: result.id,
        action: operation === 'create' ? 'create' : operation === 'update' ? 'update' : 'soft_delete',
        beforeData: before ? sanitizeAuditSnapshot(before) : undefined,
        afterData: sanitizeAuditSnapshot(result),
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
      }, executor);
      return result;
    });
  }

  async createEquivalent(ctx: RequestContext, produtoId: string, payload: unknown) {
    const parsed = produtoEquivalenteCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto equivalente payload', parsed.error.flatten());
    return this.mutateEquivalent(ctx, produtoId, 'create', undefined, parsed.data);
  }

  async updateEquivalent(ctx: RequestContext, produtoId: string, equivalentId: string, payload: unknown) {
    const parsed = produtoEquivalenteUpdateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto equivalente payload', parsed.error.flatten());
    return this.mutateEquivalent(ctx, produtoId, 'update', equivalentId, parsed.data);
  }

  async deactivateEquivalent(ctx: RequestContext, produtoId: string, equivalentId: string) {
    return this.mutateEquivalent(ctx, produtoId, 'deactivate', equivalentId);
  }

  private async mutateEquivalent(
    ctx: RequestContext,
    produtoId: string,
    operation: 'create' | 'update' | 'deactivate',
    equivalentId?: string,
    data?: ProdutoEquivalenteCreate | ProdutoEquivalenteUpdate,
  ) {
    this.assertScope(ctx);
    await this.assertPermission(ctx, 'editar');
    this.assertRelationId(produtoId);
    if (equivalentId) this.assertRelationId(equivalentId);
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    const scope = { groupId: ctx.groupId, empresaId: ctx.empresaId };
    return this.repo.withTransaction(async (executor) => {
      const produto = await this.repo.getById(scope, produtoId, executor, { forUpdate: true });
      if (!produto || !produto.ativo) throw new AppError(404, 'PRODUTO_NOT_FOUND', 'Produto not found in tenant scope');
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, produto.empresa_id);
      const ownerScope = { groupId: ctx.groupId, empresaId: produto.empresa_id ?? undefined };
      if (operation === 'create') {
        const targetId = (data as ProdutoEquivalenteCreate).produto_equivalente_id;
        if (targetId === produtoId) {
          throw new AppError(400, 'PRODUTO_EQUIVALENTE_SELF', 'Produto cannot be equivalent to itself');
        }
        const target = await this.repo.getById(ownerScope, targetId, executor, { forUpdate: true });
        if (!target || !target.ativo || target.empresa_id !== produto.empresa_id) {
          throw new AppError(404, 'PRODUTO_EQUIVALENTE_TARGET_NOT_FOUND', 'Equivalent Produto not found in tenant scope');
        }
      }
      const before = equivalentId
        ? (await this.repo.listEquivalents(ownerScope, produtoId, executor)).find((row) => row.id === equivalentId)
        : undefined;
      if (operation !== 'create' && !before) {
        throw new AppError(404, 'PRODUTO_EQUIVALENTE_NOT_FOUND', 'Produto equivalente not found in tenant scope');
      }
      if (operation === 'update' && before) {
        const target = await this.repo.getById(ownerScope, before.produto_equivalente_id, executor, { forUpdate: true });
        if (!target || !target.ativo || target.empresa_id !== produto.empresa_id) {
          throw new AppError(404, 'PRODUTO_EQUIVALENTE_TARGET_NOT_FOUND', 'Equivalent Produto not found in tenant scope');
        }
      }
      let result;
      try {
        result = operation === 'create'
          ? await this.repo.createEquivalent(ownerScope, produtoId, data as ProdutoEquivalenteCreate, executor)
          : operation === 'update'
            ? await this.repo.updateEquivalent(ownerScope, produtoId, equivalentId!, data as ProdutoEquivalenteUpdate, executor)
            : await this.repo.deactivateEquivalent(ownerScope, produtoId, equivalentId!, executor);
      } catch (error) {
        this.rethrowConflict(error);
        throw error;
      }
      if (!result) throw new AppError(404, 'PRODUTO_EQUIVALENTE_NOT_FOUND', 'Produto equivalente not found in tenant scope');
      await this.audit.append({
        groupId: ctx.groupId, empresaId: result.empresa_id ?? ctx.empresaId,
        actorId: ctx.actorId, actorEmail: ctx.actorEmail, entity: 'ProdutoEquivalente', entityId: result.id,
        action: operation === 'create' ? 'create' : operation === 'update' ? 'update' : 'soft_delete',
        beforeData: before ? sanitizeAuditSnapshot(before) : undefined,
        afterData: sanitizeAuditSnapshot(result), requestId: ctx.requestId, ipAddress: ctx.ipAddress,
      }, executor);
      return result;
    });
  }

  /** Garante que CRUD de Produto nao aceita campos transacionais. */
  assertNoStockSideEffects(payload: unknown) {
    this.rejectOperationalFields(payload);
  }
  private assertRelationId(id: string) {
    if (!produtoEquivalenteCreateSchema.shape.produto_equivalente_id.safeParse(id).success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Produto relation id');
    }
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

  private assertEmpresaOwnership(ctx: RequestContext, empresaId: string | null) {
    if (ctx.empresaId && empresaId !== ctx.empresaId) {
      throw new AppError(403, 'EMPRESA_SCOPE_FORBIDDEN', 'Produto ownership outside current empresa scope');
    }
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
