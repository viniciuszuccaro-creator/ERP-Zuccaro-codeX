import { AppError } from '../api/errors.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { UnidadeMedida } from '../repositories/cadastroTypes.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import { orcamentoCreateSchema, ORCAMENTO_STATUS, type Orcamento, type OrcamentoCreate, type OrcamentoRepository, type OrcamentoScope, type OrcamentoStatus } from '../repositories/orcamentoTypes.js';
import type { TenantEntityRepository } from './tenantCrudService.js';

const RBAC_MODULE = 'Comercial';
const RBAC_SECTION = 'orcamento';

/** Porta mínima para snapshot de preço na venda (TabelaPrecoService.resolveSalePrice). */
export type OrcamentoSalePricePort = {
  resolveSalePrice(
    ctx: RequestContext,
    input: { clienteEmpresaId: string; produtoId: string; unidadeMedidaId: string },
  ): Promise<{ preco: string } | null>;
};

export function orcamentoAuditSnapshot(row: Orcamento) {
  return sanitizeAuditSnapshot({
    id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, numero: row.numero,
    versao: row.versao, orcamento_raiz_id: row.orcamento_raiz_id, supersedido_por_id: row.supersedido_por_id,
    status: row.status, cliente_empresa_id: row.cliente_empresa_id,
    condicao_pagamento_id: row.condicao_pagamento_id, subtotal: row.subtotal,
    desconto: row.desconto, total: row.total, ativo: row.ativo,
    quantidade_itens: row.itens.length,
  });
}

export class OrcamentoService {
  constructor(
    private readonly repo: OrcamentoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard,
    private readonly clientes: Pick<ClienteRepository, 'getEmpresaLinkById'>,
    private readonly produtos: Pick<ProdutoRepository, 'getById'>,
    private readonly unidades: Pick<TenantEntityRepository<UnidadeMedida, never, never>, 'getById'>,
    private readonly condicoes: Pick<CondicaoPagamentoRepository, 'get'>,
    private readonly prices: OrcamentoSalePricePort,
  ) {}

  async create(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar');
    const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      await this.validateReferences(scope, data, executor);
      const priced = await this.applyServerPriceSnapshots(ctx, data);
      const created = await this.repo.create(scope, priced, executor);
      await this.auditRow(ctx, 'create', null, created, executor);
      return created;
    });
  }

  async get(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar');
    this.assertId(id);
    return this.requireOrcamento(scope, id);
  }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number; search?: string; status?: string; clienteEmpresaId?: string; validadeDe?: string; validadeAte?: string } = {}) {
    const scope = await this.prepare(ctx, 'visualizar');
    const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit!) : 50;
    const requestedOffset = Number.isFinite(options.offset) ? Math.trunc(options.offset!) : 0;
    const limit = Math.min(200, Math.max(1, requestedLimit));
    const offset = Math.max(0, requestedOffset);
    const search = options.search?.trim();
    if (search && search.length > 80) throw new AppError(422, 'VALIDATION_ERROR', 'Search is too long');
    if (options.status && !(ORCAMENTO_STATUS as readonly string[]).includes(options.status)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento status filter');
    }
    if (options.clienteEmpresaId) this.assertId(options.clienteEmpresaId);
    const validadeDe = this.parseFilterDate(options.validadeDe, false);
    const validadeAte = this.parseFilterDate(options.validadeAte, true);
    if (validadeDe && validadeAte && validadeDe > validadeAte) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid validity period');
    const page = await this.repo.list(scope, limit, offset, undefined, {
      search: search || undefined,
      status: options.status as OrcamentoStatus | undefined,
      clienteEmpresaId: options.clienteEmpresaId,
      validadeDe,
      validadeAte,
    });
    return { data: page.rows, meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total } };
  }

  async listVersions(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar');
    this.assertId(id);
    const current = await this.requireOrcamento(scope, id);
    return this.repo.listVersions(scope, current.orcamento_raiz_id);
  }

  async createVersion(ctx: RequestContext, id: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'versionar');
    this.assertId(id);
    const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      await this.validateReferences(scope, data, executor);
      const priced = await this.applyServerPriceSnapshots(ctx, data);
      try {
        const { previous, current } = await this.repo.createVersion(scope, id, priced, executor);
        await this.auditRow(ctx, 'update', before, previous, executor);
        await this.auditRow(ctx, 'create', null, current, executor);
        return current;
      } catch (error) {
        if (String((error as Error).message).includes('ORCAMENTO_STATE_CONFLICT')) this.stateConflict();
        throw error;
      }
    });
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'editar');
    this.assertId(id);
    const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      await this.validateReferences(scope, data, executor);
      const priced = await this.applyServerPriceSnapshots(ctx, data);
      const after = await this.repo.update(scope, id, priced, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'update', before, after, executor);
      return after;
    });
  }

  async cancel(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'cancelar');
    this.assertId(id);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      const after = await this.repo.cancel(scope, id, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'change_status', before, after, executor);
      return after;
    });
  }

  private parse(payload: unknown): OrcamentoCreate {
    const parsed = orcamentoCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', parsed.error.flatten());
    return parsed.data;
  }

  /**
   * Política Onda 2: preço unitário vem do servidor (ClienteEmpresa → tabela).
   * Payload do cliente não é autoridade; cancelados não passam por aqui (requireOpen).
   */
  private async applyServerPriceSnapshots(ctx: RequestContext, data: OrcamentoCreate): Promise<OrcamentoCreate> {
    const itens = [];
    for (const item of data.itens) {
      const resolved = await this.prices.resolveSalePrice(ctx, {
        clienteEmpresaId: data.cliente_empresa_id,
        produtoId: item.produto_id,
        unidadeMedidaId: item.unidade_id,
      });
      if (!resolved?.preco) {
        throw new AppError(422, 'ORCAMENTO_PRECO_INDISPONIVEL', 'Price unavailable for product/unit in authorized table', {
          produto_id: item.produto_id,
          unidade_id: item.unidade_id,
        });
      }
      itens.push({ ...item, preco_unitario: this.normalizeMoney(resolved.preco) });
    }
    return { ...data, itens };
  }

  private normalizeMoney(value: string): string {
    const [i, f = ''] = String(value).split('.');
    return `${i}.${(f + '000000').slice(0, 6)}`;
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
    if (row.status !== 'EM_ABERTO') this.stateConflict();
  }

  private stateConflict(): never {
    throw new AppError(409, 'ORCAMENTO_STATE_CONFLICT', 'Orcamento is not open');
  }

  private async prepare(ctx: RequestContext, action: RbacAction): Promise<OrcamentoScope> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.rbac.assertAllowed(ctx, RBAC_MODULE, RBAC_SECTION, action, { allowGlobalWildcard: false });
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private async auditRow(ctx: RequestContext, action: AuditAction, before: Orcamento | null, after: Orcamento, executor?: DbQueryExecutor) {
    await this.audit.append({
      groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
      actorEmail: ctx.actorEmail, entity: 'Orcamento', entityId: after.id, action,
      beforeData: before ? orcamentoAuditSnapshot(before) : undefined,
      afterData: orcamentoAuditSnapshot(after), requestId: ctx.requestId, ipAddress: ctx.ipAddress,
    }, executor);
  }

  private parseFilterDate(value: string | undefined, endOfDay: boolean) {
    if (!value) return undefined;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid validity date filter');
    return date.toISOString();
  }
  private assertId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid orcamentoId');
  }
}
