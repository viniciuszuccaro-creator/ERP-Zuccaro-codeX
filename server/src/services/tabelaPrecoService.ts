import { AppError } from '../api/errors.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { TabelaPrecoRepository, TabelaPrecoScope } from '../repositories/inMemoryTabelaPrecoRepository.js';
import {
  businessDateSaoPaulo,
  publicTabelaPreco,
  publicTabelaPrecoItem,
  tabelaPrecoAuditSnapshot,
  tabelaPrecoCreateSchema,
  tabelaPrecoEmpresaAuditSnapshot,
  tabelaPrecoItemAuditSnapshot,
  tabelaPrecoItemCreateSchema,
  tabelaPrecoItemUpdateSchema,
  tabelaPrecoUpdateSchema,
  type TabelaPreco,
  type TabelaPrecoItem,
} from '../repositories/tabelaPrecoTypes.js';

export type TabelaPrecoListOptions = {
  ativo?: boolean;
  vigente?: boolean;
  ehPadrao?: boolean;
  search?: string;
  orderBy?: 'nome' | 'codigo' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export class TabelaPrecoService {
  constructor(
    private readonly repo: TabelaPrecoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbacGuard: RbacGuard,
  ) {}

  async list(ctx: RequestContext, options: TabelaPrecoListOptions = {}) {
    await this.prepare(ctx, 'visualizar', { requireEmpresa: true });
    if (options.search && options.search.length > 200) this.validationError({ search: 'max_length_200' });
    const limit = this.pageNumber(options.limit, 50, 1, 200);
    const offset = this.pageNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await this.repo.listPage({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      ativo: typeof options.ativo === 'boolean' ? options.ativo : true,
      vigenteEm: options.vigente ? businessDateSaoPaulo() : undefined,
      ehPadrao: options.ehPadrao,
      search: options.search,
      orderBy: options.orderBy,
      orderDir: options.orderDir,
      limit,
      offset,
    });
    return {
      data: page.rows.map((row) => publicTabelaPreco(row, { empresaId: ctx.empresaId })),
      meta: {
        limit,
        offset,
        total: page.total,
        hasMore: offset + page.rows.length < page.total,
      },
    };
  }

  async get(ctx: RequestContext, tabelaId: string) {
    await this.prepare(ctx, 'visualizar', { requireEmpresa: true, tabelaId });
    const tabela = await this.repo.get(this.scope(ctx), tabelaId);
    if (!tabela || !tabela.ativo) this.notFound();
    return publicTabelaPreco(tabela, { empresaId: ctx.empresaId });
  }

  async create(ctx: RequestContext, payload: unknown) {
    await this.prepare(ctx, 'criar', { requireEmpresa: true });
    const parsed = tabelaPrecoCreateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    try {
      const tabela = await this.repo.withTransaction(async (executor) => {
        const created = await this.repo.create(
          { groupId: ctx.groupId, empresaId: ctx.empresaId! },
          parsed.data,
          ctx.actorId,
          executor,
        );
        await this.appendTabelaAudit(ctx, 'create', null, created, executor);
        return created;
      });
      return publicTabelaPreco(tabela, { empresaId: ctx.empresaId });
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async update(ctx: RequestContext, tabelaId: string, payload: unknown) {
    await this.prepare(ctx, 'editar', { requireEmpresa: true, tabelaId });
    const parsed = tabelaPrecoUpdateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    try {
      const updated = await this.repo.withTransaction(async (executor) => {
        const before = await this.requireActive(ctx, tabelaId, executor);
        if (
          parsed.data.vigencia_inicio
          && parsed.data.vigencia_fim === undefined
          && before.vigencia_fim
          && before.vigencia_fim < parsed.data.vigencia_inicio
        ) {
          this.validationError({ vigencia_fim: 'vigencia_fim_before_inicio' });
        }
        const after = await this.repo.update(this.scope(ctx), tabelaId, parsed.data, ctx.actorId, executor);
        if (!after) this.notFound();
        await this.appendTabelaAudit(ctx, 'update', before, after, executor);
        return after;
      });
      return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async softDelete(ctx: RequestContext, tabelaId: string) {
    await this.prepare(ctx, 'inativar', { requireEmpresa: true, tabelaId });
    const updated = await this.repo.withTransaction(async (executor) => {
      const before = await this.requireActive(ctx, tabelaId, executor);
      if (await this.repo.hasActivePadrao(ctx.groupId, tabelaId, executor)) {
        throw new AppError(409, 'TABELA_PRECO_IN_USE', 'Tabela is empresa default; unset padrao first');
      }
      const refs = await this.repo.countActiveClienteEmpresaRefs(ctx.groupId, tabelaId, executor);
      if (refs > 0) {
        throw new AppError(409, 'TABELA_PRECO_IN_USE', 'Tabela referenced by active ClienteEmpresa');
      }
      const after = await this.repo.softDelete(this.scope(ctx), tabelaId, ctx.actorId, executor);
      if (!after) this.notFound();
      await this.appendTabelaAudit(ctx, 'inactivate', before, after, executor);
      return after;
    });
    return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
  }

  async restore(ctx: RequestContext, tabelaId: string) {
    await this.prepare(ctx, 'restaurar', { requireEmpresa: true, tabelaId });
    try {
      const updated = await this.repo.withTransaction(async (executor) => {
        const before = await this.repo.get({ groupId: ctx.groupId }, tabelaId, executor);
        if (!before || before.ativo) this.notFound();
        const after = await this.repo.restore({ groupId: ctx.groupId }, tabelaId, ctx.actorId, executor);
        if (!after) this.notFound();
        await this.appendTabelaAudit(ctx, 'restore', before, after, executor);
        return after;
      });
      return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async linkEmpresa(ctx: RequestContext, tabelaId: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', { requireEmpresa: true, tabelaId });
    this.assertUuid(empresaId, 'empresaId');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    const updated = await this.repo.withTransaction(async (executor) => {
      await this.requireActive(ctx, tabelaId, executor);
      const after = await this.repo.linkEmpresa(this.scope(ctx), tabelaId, empresaId, ctx.actorId, executor);
      const link = after.empresas.find((row) => row.empresa_id === empresaId)!;
      await this.appendLinkAudit(ctx, 'link', tabelaId, link, executor);
      return after;
    });
    return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
  }

  async unlinkEmpresa(ctx: RequestContext, tabelaId: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', { requireEmpresa: true, tabelaId });
    this.assertUuid(empresaId, 'empresaId');
    try {
      const updated = await this.repo.withTransaction(async (executor) => {
        const before = await this.requireActive(ctx, tabelaId, executor);
        const beforeLink = before.empresas.find((row) => row.empresa_id === empresaId);
        const after = await this.repo.unlinkEmpresa(this.scope(ctx), tabelaId, empresaId, ctx.actorId, executor);
        if (!after) this.notFound();
        const afterLink = after.empresas.find((row) => row.empresa_id === empresaId);
        await this.appendLinkAudit(
          ctx,
          'inactivate',
          tabelaId,
          afterLink ?? {
            tabela_preco_id: tabelaId,
            empresa_id: empresaId,
            eh_padrao: false,
            ativo: false,
          },
          executor,
          beforeLink,
        );
        return after;
      });
      return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async restoreEmpresa(ctx: RequestContext, tabelaId: string, empresaId: string) {
    await this.prepare(ctx, 'vincular-empresa', { requireEmpresa: true, tabelaId });
    this.assertUuid(empresaId, 'empresaId');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, empresaId);
    const updated = await this.repo.withTransaction(async (executor) => {
      await this.requireActive(ctx, tabelaId, executor);
      const after = await this.repo.restoreEmpresa(this.scope(ctx), tabelaId, empresaId, ctx.actorId, executor);
      const link = after.empresas.find((row) => row.empresa_id === empresaId)!;
      await this.appendLinkAudit(ctx, 'restore', tabelaId, link, executor);
      return after;
    });
    return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
  }

  async setPadrao(ctx: RequestContext, tabelaId: string) {
    await this.prepare(ctx, 'definir-padrao', { requireEmpresa: true, tabelaId });
    try {
      const updated = await this.repo.withTransaction(async (executor) => {
        await this.requireActive(ctx, tabelaId, executor);
        const after = await this.repo.setPadrao(
          { groupId: ctx.groupId, empresaId: ctx.empresaId! },
          tabelaId,
          ctx.actorId,
          executor,
        );
        const link = after.empresas.find((row) => row.empresa_id === ctx.empresaId)!;
        await this.appendLinkAudit(ctx, 'update', tabelaId, link, executor);
        return after;
      });
      return publicTabelaPreco(updated, { empresaId: ctx.empresaId });
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async listItens(ctx: RequestContext, tabelaId: string, options: { ativo?: boolean; limit?: number; offset?: number } = {}) {
    await this.prepare(ctx, 'visualizar', { requireEmpresa: true, tabelaId });
    await this.requireActive(ctx, tabelaId);
    const limit = this.pageNumber(options.limit, 50, 1, 500);
    const offset = this.pageNumber(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await this.repo.listItens({
      groupId: ctx.groupId,
      tabelaPrecoId: tabelaId,
      ativo: typeof options.ativo === 'boolean' ? options.ativo : true,
      limit,
      offset,
    });
    return {
      data: page.rows.map(publicTabelaPrecoItem),
      meta: {
        limit,
        offset,
        total: page.total,
        hasMore: offset + page.rows.length < page.total,
      },
    };
  }

  async createItem(ctx: RequestContext, tabelaId: string, payload: unknown) {
    await this.prepare(ctx, 'gerenciar-itens', { requireEmpresa: true, tabelaId });
    const parsed = tabelaPrecoItemCreateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    await this.assertProdutoUnidade(ctx, parsed.data.produto_id, parsed.data.unidade_medida_id);
    try {
      const item = await this.repo.withTransaction(async (executor) => {
        await this.requireActive(ctx, tabelaId, executor);
        const created = await this.repo.createItem(
          this.scope(ctx), tabelaId, parsed.data, ctx.actorId, executor,
        );
        await this.appendItemAudit(ctx, 'create', null, created, executor);
        return created;
      });
      return publicTabelaPrecoItem(item);
    } catch (error) {
      this.rethrowKnown(error);
      throw error;
    }
  }

  async updateItem(ctx: RequestContext, tabelaId: string, itemId: string, payload: unknown) {
    await this.prepare(ctx, 'gerenciar-itens', { requireEmpresa: true, tabelaId });
    const parsed = tabelaPrecoItemUpdateSchema.safeParse(payload);
    if (!parsed.success) this.validationError(parsed.error.flatten());
    const item = await this.repo.withTransaction(async (executor) => {
      await this.requireActive(ctx, tabelaId, executor);
      const before = await this.repo.getItem(this.scope(ctx), tabelaId, itemId, executor);
      if (!before || !before.ativo) this.notFound();
      const after = await this.repo.updateItem(
        this.scope(ctx), tabelaId, itemId, parsed.data, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendItemAudit(ctx, 'update', before, after, executor);
      return after;
    });
    return publicTabelaPrecoItem(item);
  }

  async softDeleteItem(ctx: RequestContext, tabelaId: string, itemId: string) {
    await this.prepare(ctx, 'gerenciar-itens', { requireEmpresa: true, tabelaId });
    const item = await this.repo.withTransaction(async (executor) => {
      await this.requireActive(ctx, tabelaId, executor);
      const before = await this.repo.getItem(this.scope(ctx), tabelaId, itemId, executor);
      if (!before || !before.ativo) this.notFound();
      const after = await this.repo.softDeleteItem(
        this.scope(ctx), tabelaId, itemId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendItemAudit(ctx, 'inactivate', before, after, executor);
      return after;
    });
    return publicTabelaPrecoItem(item);
  }

  async restoreItem(ctx: RequestContext, tabelaId: string, itemId: string) {
    await this.prepare(ctx, 'gerenciar-itens', { requireEmpresa: true, tabelaId });
    const item = await this.repo.withTransaction(async (executor) => {
      await this.requireActive(ctx, tabelaId, executor);
      const before = await this.repo.getItem(this.scope(ctx), tabelaId, itemId, executor);
      if (!before || before.ativo) this.notFound();
      const after = await this.repo.restoreItem(
        this.scope(ctx), tabelaId, itemId, ctx.actorId, executor,
      );
      if (!after) this.notFound();
      await this.appendItemAudit(ctx, 'restore', before, after, executor);
      return after;
    });
    return publicTabelaPrecoItem(item);
  }

  async assertAuthorizedTabela(ctx: RequestContext, tabelaId: string) {
    if (!ctx.empresaId) {
      throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    }
    this.assertUuid(tabelaId, 'tabela_preco_id');
    const ok = await this.repo.isAuthorizedForEmpresa(ctx.groupId, tabelaId, ctx.empresaId);
    if (!ok) {
      throw new AppError(404, 'TABELA_PRECO_NOT_FOUND', 'TabelaPreco not found');
    }
  }

  async resolvePrice(
    ctx: RequestContext,
    input: {
      clienteEmpresaTabelaId?: string | null;
      produtoId: string;
      unidadeMedidaId: string;
      businessDate?: string;
    },
  ) {
    await this.prepare(ctx, 'visualizar', { requireEmpresa: true });
    return this.repo.resolvePrice({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId!,
      clienteEmpresaTabelaId: input.clienteEmpresaTabelaId,
      produtoId: input.produtoId,
      unidadeMedidaId: input.unidadeMedidaId,
      businessDate: input.businessDate ?? businessDateSaoPaulo(),
    });
  }

  private async assertProdutoUnidade(ctx: RequestContext, produtoId: string, unidadeId: string) {
    const ctxInfo = await this.repo.getProdutoUnidadeContext(ctx.groupId, produtoId, unidadeId);
    if (!ctxInfo || !ctxInfo.produtoAtivo || !ctxInfo.unidadeAtivo) {
      throw new AppError(404, 'PRODUTO_UNIDADE_NOT_FOUND', 'Produto/unidade not found in group');
    }
    const principalOk = ctxInfo.unidadePrincipalId === unidadeId;
    const secondaryOk = ctxInfo.unidadesSecundarias
      .map((s) => s.toLowerCase())
      .includes(ctxInfo.unidadeSigla.toLowerCase());
    if (!principalOk && !secondaryOk) {
      throw new AppError(422, 'UNIDADE_NOT_ALLOWED', 'Unidade not allowed for produto');
    }
  }

  private async prepare(
    ctx: RequestContext,
    action: RbacAction,
    options: { requireEmpresa?: boolean; tabelaId?: string } = {},
  ) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (options.requireEmpresa && !ctx.empresaId) {
      throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    }
    if (ctx.empresaId) {
      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    }
    await this.assertPermission(ctx, action);
    if (options.tabelaId) {
      this.assertUuid(options.tabelaId, 'tabelaId');
      const row = await this.repo.get(this.scope(ctx), options.tabelaId);
      if (!row) this.notFound();
    }
  }

  private async requireActive(ctx: RequestContext, tabelaId: string, executor?: DbQueryExecutor) {
    const row = await this.repo.get(this.scope(ctx), tabelaId, executor);
    if (!row || !row.ativo) this.notFound();
    return row;
  }

  private scope(ctx: RequestContext): TabelaPrecoScope {
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private async assertPermission(ctx: RequestContext, action: RbacAction) {
    await this.rbacGuard.assertAllowed(ctx, 'Cadastros', 'tabela_preco', action);
  }

  private async appendTabelaAudit(
    ctx: RequestContext,
    action: AuditAction,
    before: TabelaPreco | null,
    after: TabelaPreco,
    executor?: DbQueryExecutor,
  ) {
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'TabelaPreco',
      entityId: after.id,
      action,
      beforeData: before ? sanitizeAuditSnapshot(tabelaPrecoAuditSnapshot(before)) : undefined,
      afterData: sanitizeAuditSnapshot(tabelaPrecoAuditSnapshot(after)),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private async appendLinkAudit(
    ctx: RequestContext,
    action: AuditAction,
    tabelaId: string,
    link: { tabela_preco_id: string; empresa_id: string; eh_padrao: boolean; ativo: boolean },
    executor?: DbQueryExecutor,
    before?: { tabela_preco_id: string; empresa_id: string; eh_padrao: boolean; ativo: boolean },
  ) {
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'TabelaPrecoEmpresa',
      entityId: tabelaId,
      action,
      beforeData: before ? sanitizeAuditSnapshot(tabelaPrecoEmpresaAuditSnapshot(before)) : undefined,
      afterData: sanitizeAuditSnapshot(tabelaPrecoEmpresaAuditSnapshot(link)),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private async appendItemAudit(
    ctx: RequestContext,
    action: AuditAction,
    before: TabelaPrecoItem | null,
    after: TabelaPrecoItem,
    executor?: DbQueryExecutor,
  ) {
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'TabelaPrecoItem',
      entityId: after.id,
      action,
      beforeData: before ? sanitizeAuditSnapshot(tabelaPrecoItemAuditSnapshot(before)) : undefined,
      afterData: sanitizeAuditSnapshot(tabelaPrecoItemAuditSnapshot(after)),
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private rethrowKnown(error: unknown) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    if (code === 'TABELA_PRECO_OWNER_REQUIRED' || message.includes('TABELA_PRECO_OWNER_REQUIRED')) {
      throw new AppError(409, 'TABELA_PRECO_OWNER_REQUIRED', 'Owner empresa authorization cannot be removed');
    }
    if (code === 'TABELA_PRECO_NOT_AUTHORIZED' || message.includes('TABELA_PRECO_NOT_AUTHORIZED')) {
      throw new AppError(404, 'TABELA_PRECO_NOT_FOUND', 'TabelaPreco not found');
    }
    if (
      message.includes('uq_tabelas_preco_origem_nome_ativo')
      || message.includes('uq_tabela_preco_empresas_padrao_ativo')
      || message.includes('tabela_preco_itens_tabela_preco_id_produto_id_unidade_medida_id_key')
      || message.includes('duplicate key')
    ) {
      throw new AppError(409, 'CONFLICT', 'Conflict on unique constraint');
    }
    if (message.includes('TENANT_FK_MISMATCH')) {
      throw new AppError(404, 'TABELA_PRECO_NOT_FOUND', 'TabelaPreco not found');
    }
  }

  private pageNumber(value: number | undefined, fallback: number, min: number, max: number) {
    if (value == null || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }

  private assertUuid(value: string, field: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`);
    }
  }

  private validationError(details: unknown): never {
    throw new AppError(422, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  private notFound(): never {
    throw new AppError(404, 'TABELA_PRECO_NOT_FOUND', 'TabelaPreco not found');
  }
}
