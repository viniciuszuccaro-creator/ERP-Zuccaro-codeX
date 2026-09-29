import { AppError, isAppError } from '../api/errors.js';
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
import { PEDIDO_ORIGENS, PEDIDO_STATUS, PEDIDO_TIPOS_COMERCIAIS, pedidoCreateSchema, type Pedido, type PedidoCreate, type PedidoCreateResolved, type PedidoOrigem, type PedidoRepository, type PedidoScope, type PedidoStatus, type PedidoTipoComercial, type PedidoWrite } from '../repositories/pedidoTypes.js';
import { aggregatePedidoTipoComercial, resolveItemTipoComercial } from './comercialTipoComercialPolicy.js';
import type { TenantEntityRepository } from './tenantCrudService.js';
import {
  assertDescontoDentroDaAlcadaOuAprovar,
  descontoExcedeAlcadaLivre,
  type DescontoAlcadaDecisao,
} from './comercialDescontoAlcadaPolicy.js';
import {
  assertMargemDentroDaAlcadaOuAprovar,
  type ComercialCostPort,
} from './comercialMargemAlcadaPolicy.js';
import {
  deveLiberarDescontoSemAprovarPorAvista,
  type ComercialAlcadaConfigPort,
} from './comercialCondicaoAvistaPolicy.js';
import { buildCondicaoPagamentoDocumentoSnapshot } from './comercialCondicaoSnapshot.js';
import { resolveOrcamentoConvertSnapshots } from './comercialConvertSnapshotPolicy.js';
import {
  applyPromocaoOnPersist,
  type ComercialPromocaoConfigPort,
} from './comercialPromocaoPolicy.js';
import {
  buildTabelaPrecoDocumentoSnapshot,
  emptyTabelaPrecoDocumentoSnapshot,
} from './comercialTabelaSnapshot.js';
import { assertOrcamentoValidadeVigente } from './comercialOrcamentoValidadePolicy.js';
import { z } from 'zod';

const conversionSchema = z.object({
  tipo_operacao: z.enum(['ENTREGA', 'RETIRADA']),
  data_entrega_solicitada: z.string().datetime(),
  cliente_local_id: z.string().uuid().nullable().optional(),
  obra_id: z.string().uuid().nullable().optional(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().trim().max(1000).transform((value) => {
    const cleaned = value
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/javascript:\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || undefined;
  }).optional(),
  canal: z.string().trim().min(1).max(80).nullable().optional(),
  external_id: z.string().trim().min(1).max(160).nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(160).nullable().optional(),
}).strict();

/** Porta mínima para snapshot de preço na venda direta (não usada na conversão de Orçamento). */
export type PedidoSalePricePort = {
  resolveSalePrice(
    ctx: RequestContext,
    input: { clienteEmpresaId: string; produtoId: string; unidadeMedidaId: string },
  ): Promise<{
    preco: string;
    tabela_preco_id?: string;
    tabela_preco_codigo?: string;
    tabela_preco_nome?: string;
  } | null>;
};

export type { ComercialCostPort, ComercialAlcadaConfigPort, ComercialPromocaoConfigPort };

export function pedidoAuditSnapshot(row: Pedido) {
  return sanitizeAuditSnapshot({
    id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, numero: row.numero, status: row.status,
    cliente_empresa_id: row.cliente_empresa_id, cliente_local_id: row.cliente_local_id, obra_id: row.obra_id,
    tabela_preco_id: row.tabela_preco_id,
    tabela_preco_codigo_snapshot: row.tabela_preco_codigo_snapshot,
    tabela_preco_nome_snapshot: row.tabela_preco_nome_snapshot,
    condicao_pagamento_id: row.condicao_pagamento_id,
    condicao_pagamento_codigo_snapshot: row.condicao_pagamento_codigo_snapshot,
    condicao_pagamento_nome_snapshot: row.condicao_pagamento_nome_snapshot,
    condicao_pagamento_parcelas_snapshot: row.condicao_pagamento_parcelas_snapshot,
    promocao_aplicada: row.promocao_aplicada,
    promocao_bps: row.promocao_bps,
    promocao_cupom: row.promocao_cupom,
    orcamento_id: row.orcamento_id, vendedor_id: row.vendedor_id, tipo_operacao: row.tipo_operacao,
    data_entrega_solicitada: row.data_entrega_solicitada, subtotal: row.subtotal, desconto: row.desconto,
    total: row.total, ativo: row.ativo, quantidade_itens: row.itens.length,
    requer_producao: row.itens.some((item) => item.requer_producao),
    origem: row.origem, canal: row.canal, external_id: row.external_id, idempotency_key: row.idempotency_key,
    tipo_comercial: row.tipo_comercial,
    tipos_itens: row.itens.map((item) => item.tipo_comercial_snapshot),
  });
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
    private readonly prices: PedidoSalePricePort,
    /** Opcional: sem porta de custo a alçada de margem não roda (não inventa custo). */
    private readonly costs: ComercialCostPort | null = null,
    /** Opcional: config de alçada (à vista); ausente = fail-closed (não libera). */
    private readonly alcadaConfig: ComercialAlcadaConfigPort | null = null,
    /** Opcional: config de promoção; ausente = fail-closed se payload pedir promoção. */
    private readonly promocaoConfig: ComercialPromocaoConfigPort | null = null,
  ) {}

  async create(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar');
    const data = this.normalizeCreate(this.parse(payload));
    if (data.orcamento_id) throw new AppError(422, 'PEDIDO_ORIGEM_INVALIDA', 'Use quotation conversion endpoint');
    if (data.origem === 'ORCAMENTO') {
      throw new AppError(422, 'PEDIDO_ORIGEM_INVALIDA', 'Use quotation conversion endpoint for ORCAMENTO origin');
    }
    try {
      return await this.repo.withTransaction(async (executor) => {
        await this.assertChannelUniqueness(scope, data, executor);
        await this.validateReferences(scope, data, executor);
        const priced = await this.applyServerPriceSnapshots(ctx, data);
        const resolved = await this.applyTipoComercialSnapshots(scope, priced, executor);
        const write = await this.applyCondicaoSnapshot(scope, resolved, executor);
        await this.assertDescontoAlcada(ctx, scope, write, ctx.actorId!, executor);
        const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
        const created = await this.repo.create(scope, write, ctx.actorId!, executor);
        await this.auditMargemOverride(ctx, created.id, margemDecision, executor);
        await this.auditRow(ctx, 'create', null, created, executor);
        return created;
      });
    } catch (error) {
      this.rethrowChannelConflict(error);
      throw error;
    }
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
        assertOrcamentoValidadeVigente(quote.validade_em);
        // Não-retroatividade: preserva preco_unitario e snapshots já gravados no Orçamento.
        const draft = {
          ...parsed.data,
          origem: 'ORCAMENTO' as const,
          orcamento_id: quote.id,
          cliente_empresa_id: quote.cliente_empresa_id,
          condicao_pagamento_id: quote.condicao_pagamento_id,
          tabela_preco_id: parsed.data.tabela_preco_id ?? quote.tabela_preco_id ?? null,
          observacoes: parsed.data.observacoes ?? quote.observacoes ?? undefined,
          itens: quote.itens.map((item) => ({
            produto_id: item.produto_id,
            unidade_id: item.unidade_id,
            descricao: item.descricao,
            unidade_sigla: item.unidade_sigla,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            desconto: item.desconto ?? '0',
            requer_producao: false,
          })),
        };
        const dataParsed = pedidoCreateSchema.safeParse(draft);
        if (!dataParsed.success) this.validation(dataParsed.error.flatten());
        const data: PedidoCreate = this.normalizeCreate(dataParsed.data);
        await this.assertChannelUniqueness(scope, data, executor);
        await this.validateReferences(scope, data, executor);
        // Não-retroatividade: copia snapshots do Orçamento; pós-031 fail-closed se incompletos.
        // Legado pré-029 sem nenhum campo de condição ainda resolve condição ao vivo.
        const convertSnaps = await resolveOrcamentoConvertSnapshots(quote, {
          resolveLegacyCondicao: async () => this.condicoes.get(scope, data.condicao_pagamento_id, executor),
        });
        const resolved = await this.applyTipoComercialSnapshots(scope, data, executor);
        const { promocao: _ignored, ...rest } = resolved;
        const write: PedidoWrite = { ...rest, ...convertSnaps };
        // Segregação: aprovador do desconto ≠ criador do Orçamento (à vista com regra explícita dispensa alçada).
        const criadorOrcamento = await this.resolveCriadorActorId('Orcamento', orcamentoId);
        const alcada = await this.assertDescontoAlcada(ctx, scope, write, criadorOrcamento, executor);
        const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
        const created = await this.repo.create(scope, write, ctx.actorId!, executor);
        await this.auditMargemOverride(ctx, created.id, margemDecision, executor);
        await this.auditRow(ctx, 'create', null, created, executor);
        if (alcada.aprovadaPorOutro) {
          await this.audit.append({
            groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
            actorEmail: ctx.actorEmail, entity: 'Pedido', entityId: created.id, action: 'approve',
            afterData: {
              ...pedidoAuditSnapshot(created),
              desconto_alcada: {
                aprovada_por_outro: true,
                desconto_bps: alcada.descontoBps,
                criador_actor_id: criadorOrcamento,
                origem: 'ORCAMENTO',
                orcamento_id: orcamentoId,
              },
            },
            requestId: ctx.requestId, ipAddress: ctx.ipAddress,
          }, executor);
        }
        return created;
      });
    } catch (error) {
      // Canal/idempotency/external_id antes de ORCAMENTO_ALREADY_CONVERTED (ambos são 23505).
      this.rethrowChannelConflict(error);
      if ((error as { code?: string }).code === '23505' || String((error as Error).message).includes('ALREADY_CONVERTED')) {
        this.convertedConflict();
      }
      throw error;
    }
  }

  async get(ctx: RequestContext, id: string) { const scope = await this.prepare(ctx, 'visualizar'); this.assertId(id, 'pedidoId'); return this.requirePedido(scope, id); }
  async history(ctx: RequestContext, id: string) { const scope = await this.prepare(ctx, 'visualizar'); this.assertId(id, 'pedidoId'); await this.requirePedido(scope, id); return this.repo.history(scope, id); }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number; search?: string; status?: string; clienteEmpresaId?: string; tipoOperacao?: string; origem?: string; tipoComercial?: string } = {}) {
    const scope = await this.prepare(ctx, 'visualizar');
    const limit = Math.min(200, Math.max(1, Number.isFinite(options.limit) ? Math.trunc(options.limit!) : 50));
    const offset = Math.max(0, Number.isFinite(options.offset) ? Math.trunc(options.offset!) : 0);
    const search = options.search?.trim();
    if (search && search.length > 80) this.validation({ search: 'max_length_80' });
    if (options.status && !PEDIDO_STATUS.includes(options.status as PedidoStatus)) this.validation({ status: 'invalid' });
    if (options.clienteEmpresaId) this.assertId(options.clienteEmpresaId, 'clienteEmpresaId');
    if (options.tipoOperacao && !['ENTREGA', 'RETIRADA'].includes(options.tipoOperacao)) this.validation({ tipoOperacao: 'invalid' });
    if (options.origem && !PEDIDO_ORIGENS.includes(options.origem as PedidoOrigem)) this.validation({ origem: 'invalid' });
    if (options.tipoComercial && !PEDIDO_TIPOS_COMERCIAIS.includes(options.tipoComercial as PedidoTipoComercial)) {
      this.validation({ tipoComercial: 'invalid' });
    }
    const page = await this.repo.list(scope, limit, offset, undefined, {
      search: search || undefined,
      status: options.status as PedidoStatus | undefined,
      clienteEmpresaId: options.clienteEmpresaId,
      tipoOperacao: options.tipoOperacao as 'ENTREGA' | 'RETIRADA' | undefined,
      origem: options.origem as PedidoOrigem | undefined,
      tipoComercial: options.tipoComercial as PedidoTipoComercial | undefined,
    });
    return { data: page.rows, meta: { limit, offset, total: page.total, hasMore: offset + page.rows.length < page.total } };
  }

  async update(ctx: RequestContext, id: string, payload: unknown) {
    const scope = await this.prepare(ctx, 'editar'); this.assertId(id, 'pedidoId'); const data = this.parse(payload);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requirePedido(scope, id, executor);
      this.requireOpen(before);
      if ((data.orcamento_id ?? null) !== before.orcamento_id) this.validation({ orcamento_id: 'immutable' });
      if (data.origem !== undefined && data.origem !== before.origem) this.validation({ origem: 'immutable' });
      if (data.canal !== undefined && (data.canal ?? null) !== before.canal) this.validation({ canal: 'immutable' });
      if (data.external_id !== undefined && (data.external_id ?? null) !== before.external_id) this.validation({ external_id: 'immutable' });
      if (data.idempotency_key !== undefined && (data.idempotency_key ?? null) !== before.idempotency_key) {
        this.validation({ idempotency_key: 'immutable' });
      }
      await this.validateReferences(scope, data, executor);
      // Pedido originado de Orçamento: não reconsultar tabela (não-retroatividade).
      const priced = before.orcamento_id ? data : await this.applyServerPriceSnapshots(ctx, data);
      // Documento aberto: re-snapshot da condição atual; conversão já copiou o snapshot do Orçamento.
      const resolved = await this.applyTipoComercialSnapshots(scope, priced, executor);
      const write = await this.applyCondicaoSnapshot(scope, resolved, executor);
      const criador = await this.resolveCriadorActorId('Pedido', id);
      const alcada = await this.assertDescontoAlcada(ctx, scope, write, criador, executor);
      const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
      const after = await this.repo.update(scope, id, write, ctx.actorId!, executor);
      if (!after) this.stateConflict();
      await this.auditMargemOverride(ctx, after.id, margemDecision, executor);
      await this.auditRow(ctx, 'update', before, after, executor);
      if (alcada.aprovadaPorOutro) {
        await this.audit.append({
          groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
          actorEmail: ctx.actorEmail, entity: 'Pedido', entityId: after.id, action: 'approve',
          beforeData: pedidoAuditSnapshot(before),
          afterData: {
            ...pedidoAuditSnapshot(after),
            desconto_alcada: {
              aprovada_por_outro: true,
              desconto_bps: alcada.descontoBps,
              criador_actor_id: criador,
            },
          },
          requestId: ctx.requestId, ipAddress: ctx.ipAddress,
        }, executor);
      }
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

  /**
   * Cancel fail-closed (simetria Orçamento): RBAC `cancelar` após tenant,
   * somente EM_ABERTO, auditoria before/after na mesma transação, repetição → 409.
   * Não apaga itens/histórico; motivo opcional vai ao histórico (não à auditoria sanitizada).
   */
  async cancel(ctx: RequestContext, id: string, motivo?: unknown) {
    const scope = await this.prepare(ctx, 'cancelar');
    this.assertId(id, 'pedidoId');
    if (motivo !== undefined && (typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.length > 500)) {
      this.validation({ motivo: 'invalid' });
    }
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requirePedido(scope, id, executor);
      this.requireOpen(before);
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

  private normalizeCreate(data: PedidoCreate): PedidoCreate {
    return {
      ...data,
      origem: data.origem ?? (data.orcamento_id ? 'ORCAMENTO' : 'MANUAL'),
      canal: data.canal ?? null,
      external_id: data.external_id ?? null,
      idempotency_key: data.idempotency_key ?? null,
    };
  }

  private async applyServerPriceSnapshots(ctx: RequestContext, data: PedidoCreate): Promise<PedidoCreate & {
    tabela_preco_codigo_snapshot?: string | null;
    tabela_preco_nome_snapshot?: string | null;
  }> {
    const itens = [];
    let tabelaId: string | null | undefined = data.tabela_preco_id;
    let tabelaCodigo: string | null | undefined;
    let tabelaNome: string | null | undefined;
    for (const item of data.itens) {
      const resolved = await this.prices.resolveSalePrice(ctx, {
        clienteEmpresaId: data.cliente_empresa_id,
        produtoId: item.produto_id,
        unidadeMedidaId: item.unidade_id,
      });
      if (!resolved?.preco) {
        throw new AppError(422, 'PEDIDO_PRECO_INDISPONIVEL', 'Price unavailable for product/unit in authorized table', {
          produto_id: item.produto_id,
          unidade_id: item.unidade_id,
        });
      }
      if (!tabelaId && resolved.tabela_preco_id) tabelaId = resolved.tabela_preco_id;
      if (resolved.tabela_preco_id && resolved.tabela_preco_id === tabelaId) {
        if (resolved.tabela_preco_codigo) tabelaCodigo = resolved.tabela_preco_codigo;
        if (resolved.tabela_preco_nome) tabelaNome = resolved.tabela_preco_nome;
      }
      itens.push({ ...item, preco_unitario: this.normalizeMoney(resolved.preco) });
    }
    let tabelaSnap = emptyTabelaPrecoDocumentoSnapshot();
    if (tabelaId) {
      if (tabelaCodigo && tabelaNome) {
        tabelaSnap = buildTabelaPrecoDocumentoSnapshot(
          { id: tabelaId, codigo: tabelaCodigo, nome: tabelaNome, ativo: true },
          'PEDIDO',
        );
      } else {
        const tabela = await this.tabelas.get({ groupId: ctx.groupId, empresaId: ctx.empresaId }, tabelaId);
        tabelaSnap = buildTabelaPrecoDocumentoSnapshot(tabela, 'PEDIDO');
      }
    }
    return {
      ...data,
      tabela_preco_id: tabelaId ?? data.tabela_preco_id ?? null,
      ...tabelaSnap,
      itens,
    };
  }

  private async applyCondicaoSnapshot(
    scope: PedidoScope,
    data: PedidoCreateResolved & {
      tabela_preco_codigo_snapshot?: string | null;
      tabela_preco_nome_snapshot?: string | null;
    },
    executor?: DbQueryExecutor,
  ): Promise<PedidoWrite> {
    const condicao = await this.condicoes.get(scope, data.condicao_pagamento_id, executor);
    const snapshot = buildCondicaoPagamentoDocumentoSnapshot(condicao, 'PEDIDO');
    const cfg = this.promocaoConfig
      ? await this.promocaoConfig.getPromocaoConfig({
        groupId: scope.groupId,
        empresaId: scope.empresaId,
      })
      : null;
    const { promocao: _ignored, ...rest } = data;
    const promo = applyPromocaoOnPersist({
      promocao: data.promocao,
      config: cfg,
      items: data.itens,
    });
    let tabelaSnap = emptyTabelaPrecoDocumentoSnapshot();
    if (data.tabela_preco_id) {
      if (data.tabela_preco_codigo_snapshot && data.tabela_preco_nome_snapshot) {
        tabelaSnap = {
          tabela_preco_codigo_snapshot: data.tabela_preco_codigo_snapshot,
          tabela_preco_nome_snapshot: data.tabela_preco_nome_snapshot,
        };
      } else {
        const tabela = await this.tabelas.get(
          { groupId: scope.groupId, empresaId: scope.empresaId },
          data.tabela_preco_id,
          executor,
        );
        tabelaSnap = buildTabelaPrecoDocumentoSnapshot(tabela, 'PEDIDO');
      }
    }
    return { ...rest, itens: promo.items, ...snapshot, ...tabelaSnap, ...promo.snapshot };
  }

  private normalizeMoney(value: string): string {
    const [i, f = ''] = String(value).split('.');
    return `${i}.${(f + '000000').slice(0, 6)}`;
  }

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

  private async applyTipoComercialSnapshots(
    scope: PedidoScope,
    data: PedidoCreate,
    _executor?: DbQueryExecutor,
  ): Promise<PedidoCreateResolved> {
    const itens = [];
    for (const item of data.itens) {
      const product = await this.produtos.getById(scope, item.produto_id);
      const resolved = resolveItemTipoComercial({
        produtoTipoItem: product?.tipo_item,
        requerProducao: item.requer_producao,
        hint: item.tipo_comercial,
      });
      if (!resolved.ok) {
        throw new AppError(422, 'PEDIDO_TIPO_COMERCIAL_INVALIDO', 'Commercial type hint not allowed for product/item', {
          produto_id: item.produto_id,
          reason: resolved.reason,
        });
      }
      const { tipo_comercial: _hint, ...rest } = item;
      itens.push({ ...rest, tipo_comercial_snapshot: resolved.tipo });
    }
    return {
      ...data,
      tipo_comercial: aggregatePedidoTipoComercial(itens.map((item) => item.tipo_comercial_snapshot)),
      itens,
    };
  }

  private async prepare(ctx: RequestContext, action: RbacAction): Promise<PedidoScope> {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!ctx.actorId) throw new AppError(403, 'ACTOR_REQUIRED', 'actorId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    await this.rbac.assertAllowed(ctx, 'Comercial', 'pedido', action, { allowGlobalWildcard: false });
    return { groupId: ctx.groupId, empresaId: ctx.empresaId };
  }

  private async resolveCriadorActorId(entity: string, entityId: string): Promise<string | null> {
    const entries = await this.audit.listByEntity(entity, entityId);
    const created = entries.find((entry) => entry.action === 'create' && entry.actorId);
    return created?.actorId ?? null;
  }

  private async canAprovarComercial(ctx: RequestContext): Promise<boolean> {
    try {
      await this.rbac.assertAllowed(ctx, 'Comercial', 'pedido', 'aprovar', { allowGlobalWildcard: false });
      return true;
    } catch (error) {
      if (isAppError(error) && error.code === 'PERMISSION_DENIED') {
        return false;
      }
      throw error;
    }
  }

  private async assertDescontoAlcada(
    ctx: RequestContext,
    scope: PedidoScope,
    data: PedidoCreate,
    criadorActorId: string | null,
    executor?: DbQueryExecutor,
  ): Promise<DescontoAlcadaDecisao> {
    const liberadoPorAvista = await this.resolveLiberacaoAvista(scope, data.condicao_pagamento_id, executor);
    if (!liberadoPorAvista && !descontoExcedeAlcadaLivre(data.itens)) {
      return { aprovacaoExigida: false, aprovadaPorOutro: false, descontoBps: 0 };
    }

    return assertDescontoDentroDaAlcadaOuAprovar({
      items: data.itens,
      canAprovar: liberadoPorAvista ? false : await this.canAprovarComercial(ctx),
      actorId: ctx.actorId!,
      criadorActorId,
      entityLabel: 'Pedido',
      liberadoPorAvista,
    });
  }

  private async resolveLiberacaoAvista(
    scope: PedidoScope,
    condicaoId: string,
    executor?: DbQueryExecutor,
  ): Promise<boolean> {
    if (!this.alcadaConfig) return false;
    const cfg = await this.alcadaConfig.getConfig({
      groupId: scope.groupId,
      empresaId: scope.empresaId,
    });
    if (cfg?.avistaLiberaDescontoSemAprovar !== true) return false;
    const condicao = await this.condicoes.get(scope, condicaoId, executor);
    return deveLiberarDescontoSemAprovarPorAvista({
      parcelas: condicao?.parcelas,
      regraPermite: true,
    });
  }

  private async assertMargemAlcada(
    ctx: RequestContext,
    scope: PedidoScope,
    itens: PedidoCreate['itens'],
  ) {
    // Sem porta: skip sem consultar RBAC `aprovar` (não inventa custo / não mascara timeout).
    if (!this.costs) return null;
    return assertMargemDentroDaAlcadaOuAprovar({
      groupId: scope.groupId,
      empresaId: scope.empresaId,
      items: itens,
      costs: this.costs,
      canAprovar: await this.canAprovarComercial(ctx),
      entityLabel: 'Pedido',
    });
  }

  private async auditMargemOverride(
    ctx: RequestContext,
    entityId: string,
    decision: Awaited<ReturnType<typeof assertMargemDentroDaAlcadaOuAprovar>>,
    executor?: DbQueryExecutor,
  ) {
    if (!decision?.overridden) return;
    await this.audit.append({
      groupId: ctx.groupId,
      empresaId: ctx.empresaId,
      actorId: ctx.actorId,
      actorEmail: ctx.actorEmail,
      entity: 'Pedido',
      entityId,
      action: 'approve',
      afterData: {
        margem_alcada_override: true,
        margem_avaliacao: decision.evaluated,
      },
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
    }, executor);
  }

  private async requirePedido(scope: PedidoScope, id: string, executor?: DbQueryExecutor) { const row = await this.repo.get(scope, id, executor); if (!row) throw new AppError(404, 'PEDIDO_NOT_FOUND', 'Pedido not found'); return row; }
  private requireOpen(row: Pedido) {
    if (row.status !== 'EM_ABERTO') this.stateConflict();
  }
  private async auditRow(ctx: RequestContext, action: AuditAction, before: Pedido | null, after: Pedido, executor?: DbQueryExecutor) { await this.audit.append({ groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId, actorEmail: ctx.actorEmail, entity: 'Pedido', entityId: after.id, action, beforeData: before ? pedidoAuditSnapshot(before) : undefined, afterData: pedidoAuditSnapshot(after), requestId: ctx.requestId, ipAddress: ctx.ipAddress }, executor); }
  private assertId(id: string, field: string) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${field}`); }
  private validation(details: unknown): never { throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Pedido payload', details); }
  private stateConflict(): never { throw new AppError(409, 'PEDIDO_STATE_CONFLICT', 'Pedido state does not allow this operation'); }
  private convertedConflict(): never { throw new AppError(409, 'ORCAMENTO_ALREADY_CONVERTED', 'Orcamento already converted to Pedido'); }

  private async assertChannelUniqueness(scope: PedidoScope, data: PedidoCreate, executor?: DbQueryExecutor) {
    const origem = data.origem ?? 'MANUAL';
    if (data.idempotency_key) {
      const hit = await this.repo.getByIdempotencyKey(scope, origem, data.idempotency_key, executor);
      if (hit) throw new AppError(409, 'PEDIDO_IDEMPOTENCY_CONFLICT', 'Pedido with same idempotency key already exists');
    }
    if (data.external_id) {
      const hit = await this.repo.getByExternalId(scope, origem, data.external_id, executor);
      if (hit) throw new AppError(409, 'PEDIDO_EXTERNAL_ID_CONFLICT', 'Pedido with same external id already exists');
    }
  }

  private rethrowChannelConflict(error: unknown): void {
    const message = String((error as Error)?.message ?? error);
    const code = (error as { code?: string }).code;
    if (message.includes('PEDIDO_IDEMPOTENCY_CONFLICT') || (code === '23505' && message.includes('uq_pedidos_idempotency'))) {
      throw new AppError(409, 'PEDIDO_IDEMPOTENCY_CONFLICT', 'Pedido with same idempotency key already exists');
    }
    if (message.includes('PEDIDO_EXTERNAL_ID_CONFLICT') || (code === '23505' && message.includes('uq_pedidos_external_id'))) {
      throw new AppError(409, 'PEDIDO_EXTERNAL_ID_CONFLICT', 'Pedido with same external id already exists');
    }
  }
}
