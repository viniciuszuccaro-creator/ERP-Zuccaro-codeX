import { AppError } from '../api/errors.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { UnidadeMedida } from '../repositories/cadastroTypes.js';
import type { ClienteLocalRepository } from '../repositories/inMemoryClienteLocalRepository.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import type { ObraRepository } from '../repositories/inMemoryObraRepository.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import type { TabelaPrecoRepository } from '../repositories/inMemoryTabelaPrecoRepository.js';
import type { OrcamentoRepository } from '../repositories/orcamentoTypes.js';
import { PEDIDO_STATUS, pedidoCreateSchema, type Pedido, type PedidoCreate, type PedidoRepository, type PedidoScope, type PedidoStatus } from '../repositories/pedidoTypes.js';
import type { TenantEntityRepository } from './tenantCrudService.js';
import { z } from 'zod';

const conversionSchema = z.object({
  tipo_operacao: z.enum(['ENTREGA', 'RETIRADA']),
  data_entrega_solicitada: z.string().datetime(),
  cliente_local_id: z.string().uuid().nullable().optional(),
  obra_id: z.string().uuid().nullable().optional(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().trim().max(1000).optional(),
}).strict();

export function pedidoAuditSnapshot(row: Pedido) {
  return sanitizeAuditSnapshot({ id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, numero: row.numero, status: row.status, cliente_empresa_id: row.cliente_empresa_id, cliente_local_id: row.cliente_local_id, obra_id: row.obra_id, tabela_preco_id: row.tabela_preco_id, condicao_pagamento_id: row.condicao_pagamento_id, orcamento_id: row.orcamento_id, vendedor_id: row.vendedor_id, tipo_operacao: row.tipo_operacao, data_entrega_solicitada: row.data_entrega_solicitada, subtotal: row.subtotal, desconto: row.desconto, total: row.total, ativo: row.ativo, quantidade_itens: row.itens.length, requer_producao: row.itens.some((item) => item.requer_producao) });
}

export class PedidoService {
  constructor(
    private readonly repo: PedidoRepository,
    private readonly orcamentos: OrcamentoRepository,
    private readonly audit: AuditRepository,
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard,
    private readonly clientes: Pick<ClienteRepository, 'getEmpresaLinkById'>,
    private readonly produtos: Pick<ProdutoRepository, 'getById'>,
    private readonly unidades: Pick<TenantEntityRepository<UnidadeMedida, never, never>, 'getById'>,
    private readonly condicoes: Pick<CondicaoPagamentoRepository, 'get'>,
    private readonly locais: Pick<ClienteLocalRepository, 'get'>,
    private readonly obras: Pick<ObraRepository, 'get'>,
    private readonly tabelas: Pick<TabelaPrecoRepository, 'get'>,
  ) {}

  async create(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar');
    const data = this.parse(payload);
    if (data.orcamento_id) throw new AppError(422, 'PEDIDO_ORIGEM_INVALIDA', 'Use quotation conversion endpoint');
    return this.repo.withTransaction(async (executor) => {
      await this.validateReferences(scope, data, executor);
      const created = await this.repo.create(scope, data, ctx.actorId!, executor);
      await this.auditRow(ctx, 'create', null, created, executor);
      return created;
    });
  }

  async convert(ctx: RequestContext, orcamentoId: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'converter-pedido');
    this.assertId(orcamentoId, 'orcamentoId');
    const parsed = conversionSchema.safeParse(payload);
    if (!parsed.success) this.validation(parsed.error.flatten());
    try {
      return await this.repo.withTransaction(async (executor) => {
        if (await this.repo.getByOrcamento(scope, orcamentoId, executor)) this.convertedConflict();
        const quote = await this.orcamentos.get(scope, orcamentoId, executor);
        if (!quote) throw new AppError(404, 'ORCAMENTO_NOT_FOUND', 'Orcamento not found');
        if (quote.status !== 'EM_ABERTO') throw new AppError(409, 'ORCAMENTO_STATE_CONFLICT', 'Orcamento is not open');
        const data: PedidoCreate = pedidoCreateSchema.parse({ ...parsed.data, orcamento_id: quote.id, cliente_empresa_id: quote.cliente_empresa_id, condicao_pagamento_id: quote.condicao_pagamento_id, observacoes: parsed.data.observacoes ?? quote.observacoes ?? undefined, itens: quote.itens.map((item) => ({ produto_id: item.produto_id, unidade_id: item.unidade_id, descricao: item.descricao, unidade_sigla: item.unidade_sigla, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, requer_producao: false })) });
        await this.validateReferences(scope, data, executor);
        const created = await this.repo.create(scope, data, ctx.actorId!, executor);
        await this.auditRow(ctx, 'create', null, created, executor);
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505' || String((error as Error).message).includes('ALREADY_CONVERTED')) this.convertedConflict();
      throw error;
    }
  }

  async get(ctx: RequestContext, id: string) { const scope = await this.prepare(ctx, 'visualizar'); this.assertId(id, 'pedidoId'); return this.requirePedido(scope, id); }
  async history(ctx: RequestContext, id: string) { const scope = await this.prepare(ctx, 'visualizar'); this.assertId(id, 'pedidoId'); await this.requirePedido(scope, id); return this.repo.history(scope, id); }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number; search?: string; status?: string; clienteEmpresaId?: string; tipoOperacao?: string } = {}) {
    const scope = await this.prepare(ctx, 'visualizar');
    const limit = Math.min(200, Math.max(1, Number.isFinite(options.limit) ? Math.trunc(options.limit!) : 50));
    const offset = Math.max(0, Number.isFinite(options.offset) ? Math.trunc(options.offset!) : 0);
    const search = options.search?.trim();
    if (search && search.length > 80) this.validation({ search: 'max_length_80' });
    if (options.status && !PEDIDO_STATUS.includes(options.status as PedidoStatus)) this.validation({ status: 'invalid' });
    if (options.clienteEmpresaId) this.assertId(options.clienteEmpresaId, 'clienteEmpresaId');
    if (options.tipoOperacao && !['ENTREGA', 'RETIRADA'].includes(options.tipoOperacao)) this.validation({ tipoOperacao: 'invalid' });
    const page = await this.repo.list(scope, limit, offset, undefined, { search: search || undefined, status: options.status as PedidoStatus | undefined, clienteEmpresaId: options.clienteEmpresaId, tipoOperacao: options.tipoOperacao as 'ENTREGA' | 'RETIRADA' | undefined });
    return { data: page.rows, meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total } };
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'editar'); this.assertId(id, 'pedidoId'); const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requirePedido(scope, id, executor);
      if (before.status !== 'EM_ABERTO') this.stateConflict();
      if ((data.orcamento_id ?? null) !== before.orcamento_id) this.validation({ orcamento_id: 'immutable' });
      await this.validateReferences(scope, data, executor);
      const after = await this.repo.update(scope, id, data, ctx.actorId!, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'update', before, after, executor);
      return after;
    });
  }

  async transition(ctx: RequestContext, id: string, target: unknown, motivo?: unknown) {
    const scope = await this.prepare(ctx, 'alterar-status'); this.assertId(id, 'pedidoId');
    if (typeof target !== 'string' || !PEDIDO_STATUS.includes(target as PedidoStatus) || target === 'CANCELADO') this.validation({ status: 'invalid' });
    if (motivo !== undefined && (typeof motivo !== 'string' || motivo.length > 500)) this.validation({ motivo: 'invalid' });
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requirePedido(scope, id, executor);
      if (!this.allowedTransition(before, target as PedidoStatus)) this.stateConflict();
      const after = await this.repo.changeStatus(scope, id, target as PedidoStatus, ctx.actorId!, motivo as string | undefined, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'change_status', before, after, executor);
      return after;
    });
  }

  async cancel(ctx: RequestContext, id: string, motivo?: unknown) {
    const scope = await this.prepare(ctx, 'cancelar'); this.assertId(id, 'pedidoId');
    if (motivo !== undefined && (typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.length > 500)) this.validation({ motivo: 'invalid' });
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requirePedido(scope, id, executor);
      if (before.status !== 'EM_ABERTO') this.stateConflict();
      const after = await this.repo.changeStatus(scope, id, 'CANCELADO', ctx.actorId!, motivo as string | undefined, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'change_status', before, after, executor);
      return after;
    });
  }

  private allowedTransition(row: Pedido, target: PedidoStatus) {
    const ready = row.tipo_operacao === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
    if (row.status === 'EM_ABERTO') return row.itens.some((item) => item.requer_producao) ? target === 'EM_PRODUCAO' : target === ready;
    if (row.status === 'EM_PRODUCAO') return target === ready;
    if (row.status === ready) return target === 'FINALIZADO';
    return false;
  }

  private parse(payload: unknown) { const parsed = pedidoCreateSchema.safeParse(payload); if (!parsed.success) this.validation(parsed.error.flatten()); return parsed.data; }
  private async validateReferences(scope: PedidoScope, data: PedidoCreate, executor?: DbQueryExecutor) {
    const link = await this.clientes.getEmpresaLinkById(scope, data.cliente_empresa_id, executor);
    if (!link || !link.ativo || link.bloqueado || !link.habilitado_operacao) throw new AppError(422, 'PEDIDO_CLIENTE_INVALIDO', 'ClienteEmpresa unavailable in tenant scope');
    if (data.cliente_local_id && !(await this.locais.get({ groupId: scope.groupId, clienteId: link.cliente_id }, data.cliente_local_id, executor))?.ativo) throw new AppError(422, 'PEDIDO_LOCAL_INVALIDO', 'ClienteLocal unavailable in tenant scope');
    if (data.obra_id && !(await this.obras.get({ groupId: scope.groupId, clienteId: link.cliente_id, empresaId: scope.empresaId }, data.obra_id, executor))?.ativo) throw new AppError(422, 'PEDIDO_OBRA_INVALIDA', 'Obra unavailable in tenant scope');
    if (data.tabela_preco_id && !(await this.tabelas.get({ groupId: scope.groupId, empresaId: scope.empresaId }, data.tabela_preco_id, executor))?.ativo) throw new AppError(422, 'PEDIDO_TABELA_INVALIDA', 'TabelaPreco unavailable in tenant scope');
    if (!(await this.condicoes.get(scope, data.condicao_pagamento_id, executor))?.ativo) throw new AppError(422, 'PEDIDO_CONDICAO_INVALIDA', 'CondicaoPagamento unavailable in tenant scope');
    for (const item of data.itens) {
      const product = await this.produtos.getById(scope, item.produto_id);
      if (!product?.ativo) throw new AppError(422, 'PEDIDO_PRODUTO_INVALIDO', 'Produto unavailable in tenant scope');
      if (product.unidade_medida_id !== item.unidade_id || !(await this.unidades.getById({ groupId: scope.groupId }, item.unidade_id))?.ativo) throw new AppError(422, 'PEDIDO_UNIDADE_INVALIDA', 'Unidade unavailable for product');
    }
  }

  private async prepare(ctx: RequestContext, action: RbacAction): Promise<PedidoScope> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.rbac.assertAllowed(ctx, 'Comercial', 'pedido', action, { allowGlobalWildcard: false });
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }
  private async requirePedido(scope: PedidoScope, id: string, executor?: DbQueryExecutor) { const row = await this.repo.get(scope, id, executor); if (!row) throw new AppError(404, 'PEDIDO_NOT_FOUND', 'Pedido not found'); return row; }
  private async auditRow(ctx: RequestContext, action: AuditAction, before: Pedido | null, after: Pedido, executor?: DbQueryExecutor) { await this.audit.append({ groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId, actorEmail: ctx.actorEmail, entity: 'Pedido', entityId: after.id, action, beforeData: before ? pedidoAuditSnapshot(before) : undefined, afterData: pedidoAuditSnapshot(after), requestId: ctx.requestId, ipAddress: ctx.ipAddress }, executor); }
  private assertId(id: string, field: string) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`); }
  private validation(details: unknown): never { throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Pedido payload', details); }
  private stateConflict(): never { throw new AppError(409, 'PEDIDO_STATE_CONFLICT', 'Pedido state does not allow this operation'); }
  private convertedConflict(): never { throw new AppError(409, 'ORCAMENTO_ALREADY_CONVERTED', 'Orcamento already converted to Pedido'); }
}
