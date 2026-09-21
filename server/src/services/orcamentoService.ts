import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import { orcamentoCreateSchema, type OrcamentoRepository, type OrcamentoScope } from '../repositories/orcamentoTypes.js';
import type { UnidadeMedida } from '../repositories/cadastroTypes.js';
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
    const parsed = orcamentoCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', parsed.error.flatten());

    for (const item of parsed.data.itens) {
      const produto = await this.produtos.getById(scope, item.produto_id);
      if (!produto || !produto.ativo) throw new AppError(422, 'ORCAMENTO_PRODUTO_INVALIDO', 'Produto unavailable in tenant scope');
      if (produto.unidade_medida_id !== item.unidade_id) throw new AppError(422, 'ORCAMENTO_UNIDADE_INVALIDA', 'Unidade is not the principal product unit');
      const unidade = await this.unidades.getById({ groupId: scope.groupId }, item.unidade_id);
      if (!unidade || !unidade.ativo) throw new AppError(422, 'ORCAMENTO_UNIDADE_INVALIDA', 'Unidade unavailable in tenant scope');
    }

    return this.repo.withTransaction(async (executor) => {
      const cliente = await this.clientes.getEmpresaLinkById(scope, parsed.data.cliente_empresa_id, executor);
      if (!cliente || !cliente.ativo || cliente.bloqueado || !cliente.habilitado_operacao) throw new AppError(422, 'ORCAMENTO_CLIENTE_INVALIDO', 'ClienteEmpresa unavailable in tenant scope');
      const condicao = await this.condicoes.get(scope, parsed.data.condicao_pagamento_id, executor);
      if (!condicao || !condicao.ativo) throw new AppError(422, 'ORCAMENTO_CONDICAO_INVALIDA', 'CondicaoPagamento unavailable in tenant scope');
      return this.repo.create(scope, parsed.data, executor);
    });
  }

  async get(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx);
    this.assertId(id);
    const row = await this.repo.get(scope, id);
    if (!row) throw new AppError(404, 'ORCAMENTO_NOT_FOUND', 'Orcamento not found');
    return row;
  }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number } = {}) {
    const scope = await this.prepare(ctx);
    const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? 50)));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const page = await this.repo.list(scope, limit, offset);
    return { data: page.rows, meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total } };
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