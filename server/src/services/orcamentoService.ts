import { AppError, isAppError } from '../api/errors.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { UnidadeMedida } from '../repositories/cadastroTypes.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { CondicaoPagamentoRepository } from '../repositories/inMemoryCondicaoPagamentoRepository.js';
import type { ProdutoRepository } from '../repositories/inMemoryProdutoRepository.js';
import { orcamentoCreateSchema, ORCAMENTO_ORIGENS, ORCAMENTO_STATUS, type Orcamento, type OrcamentoCreate, type OrcamentoOrigem, type OrcamentoRepository, type OrcamentoScope, type OrcamentoStatus, type OrcamentoWrite } from '../repositories/orcamentoTypes.js';
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
import {
  applyPromocaoOnPersist,
  type ComercialPromocaoConfigPort,
} from './comercialPromocaoPolicy.js';
import {
  buildTabelaPrecoDocumentoSnapshot,
  emptyTabelaPrecoDocumentoSnapshot,
} from './comercialTabelaSnapshot.js';
import { assertOrcamentoValidadeVigente } from './comercialOrcamentoValidadePolicy.js';
import type { TabelaPrecoRepository } from '../repositories/inMemoryTabelaPrecoRepository.js';
import type { PedidoRepository } from '../repositories/pedidoTypes.js';

const RBAC_MODULE = 'Comercial';
const RBAC_SECTION = 'orcamento';

/** Porta mínima para snapshot de preço na venda (TabelaPrecoService.resolveSalePrice). */
export type OrcamentoSalePricePort = {
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

export function orcamentoAuditSnapshot(row: Orcamento) {
  return sanitizeAuditSnapshot({
    id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, numero: row.numero,
    versao: row.versao, orcamento_raiz_id: row.orcamento_raiz_id, supersedido_por_id: row.supersedido_por_id,
    status: row.status, cliente_empresa_id: row.cliente_empresa_id,
    condicao_pagamento_id: row.condicao_pagamento_id,
    condicao_pagamento_codigo_snapshot: row.condicao_pagamento_codigo_snapshot,
    condicao_pagamento_nome_snapshot: row.condicao_pagamento_nome_snapshot,
    condicao_pagamento_parcelas_snapshot: row.condicao_pagamento_parcelas_snapshot,
    tabela_preco_id: row.tabela_preco_id,
    tabela_preco_codigo_snapshot: row.tabela_preco_codigo_snapshot,
    tabela_preco_nome_snapshot: row.tabela_preco_nome_snapshot,
    promocao_aplicada: row.promocao_aplicada,
    promocao_bps: row.promocao_bps,
    promocao_cupom: row.promocao_cupom,
    origem: row.origem, canal: row.canal, external_id: row.external_id, idempotency_key: row.idempotency_key,
    campanha: row.campanha,
    subtotal: row.subtotal, desconto: row.desconto, total: row.total, ativo: row.ativo,
    quantidade_itens: row.itens.length,
    tipos_especiais_itens: row.itens.map((item) => item.tipo_comercial ?? null),
    requer_producao_itens: row.itens.map((item) => item.requer_producao === true),
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
    /** Opcional: sem porta de custo a alçada de margem não roda (não inventa custo). */
    private readonly costs: ComercialCostPort | null = null,
    /** Opcional: config de alçada (à vista); ausente = fail-closed (não libera). */
    private readonly alcadaConfig: ComercialAlcadaConfigPort | null = null,
    /** Opcional: config de promoção; ausente = fail-closed se payload pedir promoção. */
    private readonly promocaoConfig: ComercialPromocaoConfigPort | null = null,
    /** Lookup TabelaPreco para snapshot codigo+nome quando o price port não ecoar. */
    private readonly tabelas: Pick<TabelaPrecoRepository, 'get'> | null = null,
    private readonly convertedPedidos: Pick<PedidoRepository, 'getByOrcamento'> | null = null,
  ) {}

  async create(ctx: RequestContext, payload: unknown) {
    const scope = await this.prepare(ctx, 'criar');
    const data = this.normalizeCreate(this.parse(payload));
    assertOrcamentoValidadeVigente(data.validade_em);
    try {
      return await this.repo.withTransaction(async (executor) => {
        await this.assertChannelUniqueness(scope, data, executor);
        await this.validateReferences(scope, data, executor);
        const priced = await this.applyServerPriceSnapshots(ctx, data);
        const write = await this.applyCondicaoSnapshot(scope, priced, executor);
        await this.assertDescontoAlcada(ctx, scope, write, ctx.actorId!, executor);
        const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
        const created = await this.repo.create(scope, write, executor);
        await this.auditMargemOverride(ctx, created.id, margemDecision, executor);
        await this.auditRow(ctx, 'create', null, created, executor);
        return created;
      });
    } catch (error) {
      this.rethrowChannelConflict(error);
      throw error;
    }
  }

  async get(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'visualizar');
    this.assertId(id);
    return this.requireOrcamento(scope, id);
  }

  async list(ctx: RequestContext, options: { limit?: number; offset?: number; search?: string; status?: string; clienteEmpresaId?: string; validadeDe?: string; validadeAte?: string; origem?: string } = {}) {
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
    if (options.origem && !(ORCAMENTO_ORIGENS as readonly string[]).includes(options.origem)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento origem filter');
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
      origem: options.origem as OrcamentoOrigem | undefined,
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
    assertOrcamentoValidadeVigente(data.validade_em);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      await this.repo.lockConversionChain(scope, before.orcamento_raiz_id, executor);
      const locked = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(locked);
      await this.assertChainNotConverted(scope, locked.orcamento_raiz_id, executor);
      await this.validateReferences(scope, data, executor);
      const priced = await this.applyServerPriceSnapshots(ctx, data);
      const write = await this.applyCondicaoSnapshot(scope, priced, executor);
      const criador = await this.resolveCriadorActorId('Orcamento', id);
      await this.assertDescontoAlcada(ctx, scope, write, criador, executor);
      const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
      try {
        const { previous, current } = await this.repo.createVersion(scope, id, write, executor);
        await this.auditMargemOverride(ctx, current.id, margemDecision, executor);
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
    assertOrcamentoValidadeVigente(data.validade_em);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      await this.repo.lockConversionChain(scope, before.orcamento_raiz_id, executor);
      const locked = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(locked);
      await this.assertChainNotConverted(scope, locked.orcamento_raiz_id, executor);
      if (data.origem !== undefined && data.origem !== before.origem) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', { origem: 'immutable' });
      }
      if (data.canal !== undefined && (data.canal ?? null) !== before.canal) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', { canal: 'immutable' });
      }
      if (data.external_id !== undefined && (data.external_id ?? null) !== before.external_id) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', { external_id: 'immutable' });
      }
      if (data.idempotency_key !== undefined && (data.idempotency_key ?? null) !== before.idempotency_key) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', { idempotency_key: 'immutable' });
      }
      if (data.campanha !== undefined && (data.campanha ?? null) !== before.campanha) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', { campanha: 'immutable' });
      }
      await this.validateReferences(scope, data, executor);
      const priced = await this.applyServerPriceSnapshots(ctx, data);
      const write = await this.applyCondicaoSnapshot(scope, priced, executor);
      const criador = await this.resolveCriadorActorId('Orcamento', id);
      const alcada = await this.assertDescontoAlcada(ctx, scope, write, criador, executor);
      const margemDecision = await this.assertMargemAlcada(ctx, scope, write.itens);
      const after = await this.repo.update(scope, id, write, executor);
      if (!after) this.stateConflict();
      await this.auditMargemOverride(ctx, after.id, margemDecision, executor);
      await this.auditRow(ctx, 'update', before, after, executor);
      if (alcada.aprovadaPorOutro) {
        await this.audit.append({
          groupId: ctx.groupId, empresaId: ctx.empresaId, actorId: ctx.actorId,
          actorEmail: ctx.actorEmail, entity: 'Orcamento', entityId: after.id, action: 'approve',
          beforeData: orcamentoAuditSnapshot(before),
          afterData: {
            ...orcamentoAuditSnapshot(after),
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

  async cancel(ctx: RequestContext, id: string) {
    const scope = await this.prepare(ctx, 'cancelar');
    this.assertId(id);
    return this.repo.withTransaction(async (executor) => {
      const before = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(before);
      await this.repo.lockConversionChain(scope, before.orcamento_raiz_id, executor);
      const locked = await this.requireOrcamento(scope, id, executor);
      this.requireOpen(locked);
      await this.assertChainNotConverted(scope, locked.orcamento_raiz_id, executor);
      const after = await this.repo.cancel(scope, id, executor);
      if (!after) this.stateConflict();
      await this.auditRow(ctx, 'change_status', before, after, executor);
      return after;
    });
  }

  private async assertChainNotConverted(scope: OrcamentoScope, raizId: string, executor?: DbQueryExecutor): Promise<void> {
    if (!this.convertedPedidos) throw new AppError(503, 'ORCAMENTO_CONVERSION_GUARD_UNAVAILABLE', 'Conversion guard unavailable');
    for (const version of await this.repo.listVersions(scope, raizId, executor)) {
      if (await this.convertedPedidos.getByOrcamento(scope, version.id, executor)) {
        throw new AppError(409, 'ORCAMENTO_ALREADY_CONVERTED', 'Quotation chain already converted');
      }
    }
  }

  private parse(payload: unknown): OrcamentoCreate {
    const parsed = orcamentoCreateSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid Orcamento payload', parsed.error.flatten());
    return parsed.data;
  }

  private normalizeCreate(data: OrcamentoCreate): OrcamentoCreate {
    return {
      ...data,
      origem: data.origem ?? 'MANUAL',
      canal: data.canal ?? null,
      external_id: data.external_id ?? null,
      idempotency_key: data.idempotency_key ?? null,
      campanha: data.campanha ?? null,
    };
  }

  private async assertChannelUniqueness(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    const origem = data.origem ?? 'MANUAL';
    if (data.idempotency_key) {
      const hit = await this.repo.getByIdempotencyKey(scope, origem, data.idempotency_key, executor);
      if (hit) throw new AppError(409, 'ORCAMENTO_IDEMPOTENCY_CONFLICT', 'Orcamento with same idempotency key already exists');
    }
    if (data.external_id) {
      const hit = await this.repo.getByExternalId(scope, origem, data.external_id, executor);
      if (hit) throw new AppError(409, 'ORCAMENTO_EXTERNAL_ID_CONFLICT', 'Orcamento with same external id already exists');
    }
  }

  private rethrowChannelConflict(error: unknown): void {
    const message = String((error as Error)?.message ?? error);
    const code = (error as { code?: string }).code;
    if (message.includes('ORCAMENTO_IDEMPOTENCY_CONFLICT') || (code === '23505' && message.includes('uq_orcamentos_idempotency'))) {
      throw new AppError(409, 'ORCAMENTO_IDEMPOTENCY_CONFLICT', 'Orcamento with same idempotency key already exists');
    }
    if (message.includes('ORCAMENTO_EXTERNAL_ID_CONFLICT') || (code === '23505' && message.includes('uq_orcamentos_external_id'))) {
      throw new AppError(409, 'ORCAMENTO_EXTERNAL_ID_CONFLICT', 'Orcamento with same external id already exists');
    }
  }

  /**
   * Política Onda 2: preço unitário vem do servidor (ClienteEmpresa → tabela).
   * Payload do cliente não é autoridade; cancelados não passam por aqui (requireOpen).
   */
  private async applyServerPriceSnapshots(ctx: RequestContext, data: OrcamentoCreate): Promise<OrcamentoCreate & {
    tabela_preco_id?: string | null;
    tabela_preco_codigo_snapshot?: string | null;
    tabela_preco_nome_snapshot?: string | null;
  }> {
    const itens = [];
    let tabelaId: string | null | undefined;
    let tabelaCodigo: string | null | undefined;
    let tabelaNome: string | null | undefined;
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
      if (!tabelaId && resolved.tabela_preco_id) {
        tabelaId = resolved.tabela_preco_id;
        tabelaCodigo = resolved.tabela_preco_codigo ?? null;
        tabelaNome = resolved.tabela_preco_nome ?? null;
      }
      itens.push({ ...item, preco_unitario: this.normalizeMoney(resolved.preco) });
    }
    const fromPrice = tabelaId
      ? (
        tabelaCodigo && tabelaNome
          ? buildTabelaPrecoDocumentoSnapshot(
            { id: tabelaId, codigo: tabelaCodigo, nome: tabelaNome, ativo: true },
            'ORCAMENTO',
          )
          : null
      )
      : emptyTabelaPrecoDocumentoSnapshot();
    // Se o price port não ecoou codigo/nome, tenta lookup (fail-closed se ainda faltar).
    let tabelaSnap = fromPrice;
    if (tabelaId && !tabelaSnap) {
      if (!this.tabelas) {
        throw new AppError(422, 'ORCAMENTO_TABELA_SNAPSHOT_INVALIDO', 'TabelaPreco missing codigo/nome for snapshot');
      }
      const tabela = await this.tabelas.get({ groupId: ctx.groupId, empresaId: ctx.empresaId }, tabelaId);
      tabelaSnap = buildTabelaPrecoDocumentoSnapshot(tabela, 'ORCAMENTO');
    }
    return {
      ...data,
      tabela_preco_id: tabelaId ?? null,
      ...(tabelaSnap ?? emptyTabelaPrecoDocumentoSnapshot()),
      itens,
    };
  }

  /**
   * Snapshot de condição (id+codigo+nome+parcelas) + tabela (codigo+nome) + promoção no servidor.
   * Payload `promocao` declara intenção; desconto/total vêm de applyPromocaoOnPersist (idempotente com UI pós-simular).
   */
  private async applyCondicaoSnapshot(
    scope: OrcamentoScope,
    data: OrcamentoCreate & {
      tabela_preco_id?: string | null;
      tabela_preco_codigo_snapshot?: string | null;
      tabela_preco_nome_snapshot?: string | null;
    },
    executor?: DbQueryExecutor,
  ): Promise<OrcamentoWrite> {
    const condicao = await this.condicoes.get(scope, data.condicao_pagamento_id, executor);
    const snapshot = buildCondicaoPagamentoDocumentoSnapshot(condicao, 'ORCAMENTO');
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
      } else if (this.tabelas) {
        const tabela = await this.tabelas.get(scope, data.tabela_preco_id, executor);
        tabelaSnap = buildTabelaPrecoDocumentoSnapshot(tabela, 'ORCAMENTO');
      } else {
        throw new AppError(422, 'ORCAMENTO_TABELA_SNAPSHOT_INVALIDO', 'TabelaPreco missing codigo/nome for snapshot');
      }
    }
    return {
      ...rest,
      itens: promo.items,
      tabela_preco_id: data.tabela_preco_id ?? null,
      ...snapshot,
      ...tabelaSnap,
      ...promo.snapshot,
    };
  }

  private async resolveCriadorActorId(entity: string, entityId: string): Promise<string | null> {
    const entries = await this.audit.listByEntity(entity, entityId);
    const created = entries.find((entry) => entry.action === 'create' && entry.actorId);
    return created?.actorId ?? null;
  }

  private async canAprovarComercial(ctx: RequestContext): Promise<boolean> {
    try {
      await this.rbac.assertAllowed(ctx, RBAC_MODULE, RBAC_SECTION, 'aprovar', { allowGlobalWildcard: false });
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
    scope: OrcamentoScope,
    data: OrcamentoCreate,
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
      entityLabel: 'Orçamento',
      liberadoPorAvista,
    });
  }

  private async resolveLiberacaoAvista(
    scope: OrcamentoScope,
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
    scope: OrcamentoScope,
    itens: OrcamentoCreate['itens'],
  ) {
    // Sem porta: skip sem consultar RBAC `aprovar` (não inventa custo / não mascara timeout).
    if (!this.costs) return null;
    return assertMargemDentroDaAlcadaOuAprovar({
      groupId: scope.groupId,
      empresaId: scope.empresaId,
      items: itens,
      costs: this.costs,
      canAprovar: await this.canAprovarComercial(ctx),
      entityLabel: 'Orçamento',
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
      entity: 'Orcamento',
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

  private normalizeMoney(value: string): string {
    const [i, f = ''] = String(value).split('.');
    return `${i}.${(f + '000000').slice(0, 6)}`;
  }

  private async validateReferences(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor) {
    const cliente = await this.clientes.getEmpresaLinkById(scope, data.cliente_empresa_id, executor);
    if (!cliente || !cliente.ativo || cliente.bloqueado || !cliente.habilitado_operacao) throw new AppError(422, 'ORCAMENTO_CLIENTE_INVALIDO', 'ClienteEmpresa unavailable in tenant scope');
    // Condição: existência/ativo + snapshot completo validados em applyCondicaoSnapshot (fail-closed).
    const condicao = await this.condicoes.get(scope, data.condicao_pagamento_id, executor);
    if (!condicao || !condicao.ativo) throw new AppError(422, 'ORCAMENTO_CONDICAO_INVALIDA', 'CondicaoPagamento unavailable in tenant scope');
    for (const item of data.itens) {
      if (Boolean(item.tipo_comercial) !== (item.requer_producao === true)) {
        throw new AppError(422, 'ORCAMENTO_TIPO_ESPECIAL_INVALIDO', 'Special commercial type requires explicit production flag');
      }
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
