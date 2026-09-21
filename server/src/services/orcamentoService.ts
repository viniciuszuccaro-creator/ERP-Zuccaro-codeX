import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { UnidadeMedida } from '../repositories/cadastroTypes.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import { orcamentoCreateSchema, type Orcamento, type OrcamentoCreate, type OrcamentoRepository, type OrcamentoScope } from '../repositories/orcamentoTypes.js';
import type { TenantEntityRepository } from './tenantCrudService.js';

export class OrcamentoService {
  constructor(
    private readonly repo: OrcamentoRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly clientes: Pick<ClienteRepository, 'getEmpresaLinkById'>,
    private readonly produtos: Pick<ProdutoRepository, 'getById'>,
    private readonly unidades: Pick<TenantEntityRepository<UnidadeMedida, never, never>, 'getById'>,
    private readonly condicoes: Pick<CondicaoPagamentoRepository, 'get'>,
  ) {}

  async create(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx);
    const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      await this.validateReferences(scope, data, executor);
      return this.repo.create(scope, data, executor);
    });
  }

  async get(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx);
    this.assertId(id);
    return this.requireOrcamento(scope, id);
  }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number } = {}) {
    const scope = await this.prepare(ctx);
    const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50)));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const page = await this.repo.list(scope, limit, offset);
    return { data: page.rows, meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total } };
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    const scope = await this.prepare(ctx);
    this.assertId(id);
    const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      const current = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(current);
      await this.validateReferences(scope, data, executor);
      const updated = await this.repo.update(scope, id, data, executor);
      if (!updated) throw new AppError(409, 'ORCAMENTO_STATE_CONFLICT', 'Orcamento is not open');
      return updated;
    });
  }

  async cancel(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx);
    this.assertId(id);
    return this.repo.withTransaction(async (executor) => {
      const current = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(current);
      const cancelled = await this.repo.cancel(scope, id, executor);
      if (!cancelled) throw new AppError(409, 'ORCAMENTO_STATE_CONFLICT', 'Orcamento is not open');
      return cancelled;
    });
  }

  private parse(payload: unknown): OrcamentoCreate {
    const parsed = orcamentoCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', parsed.error.flatten());
    return parsed.data;
  }

  private async validateReferences(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    const cliente = await this.clientes.getEmpresaLinkById(scope, data.cliente_empresa_id, executor);
    if (!cliente || !cliente.ativo || cliente.bloqueado || !cliente.habilitado_operacao) throw new AppError(422, 'ORCAMENTO_CLIENTE_INVALIDO', 'ClienteEmpresa unavailable in tenant scope');
    const condicao = await this.condicoes.get(scope, data.condicao_pagamento_id, executor);
    if (!condicao || !condicao.ativo) throw new AppError(422, 'ORCAMENTO_CONDICAO_INVALIDA', 'CondicaoPagamento unavailable in tenant scope');
    for (const item of data.itens) {
      const produto = await this.produtos.getById(scope, item.produto_id);
      if (!produto || !produto.ativo) throw new AppError(422, 'ORCAMENTO_PRODUTO_INVALIDO', 'Produto unavailable in tenant scope');
      if (produto.unidade_medida_id !== item.unidade_id) throw new AppError(422, 'ORCAMENTO_UNIDADE_INVALIDA', 'Unidade is not the principal product unit');
      const unidade = await this.unidades.getById({ groupId: scope.groupId }, item.unidade_id);
      if (!unidade || !unidade.ativo) throw new AppError(422, 'ORCAMENTO_UNIDADE_INVALIDA', 'Unidade unavailable in tenant scope');
    }
  }

  private async requireOrcamento(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor): Promise<Orcamento> {
    const row = await this.repo.get(scope, id, executor);
    if (!row) throw new AppError(404, 'ORCAMENTO_NOT_FOUND', 'Orcamento not found');
    return row;
  }

  private requireOpen(row: Orcamento) {
    if (row.status !== 'EM_ABERTO') throw new AppError(409, 'ORCAMENTO_STATE_CONFLICT', 'Orcamento is not open');
  }

  private async prepare(ctx: RequestContext): Promise<OrcamentoScope> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private assertId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid orcamentoId');
  }
}