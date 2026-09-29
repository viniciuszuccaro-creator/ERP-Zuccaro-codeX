/**
 * Simulação comercial antes de gravar (Onda 2) — reutiliza ports de preço, condição e promoção.
 * Não persiste, não audita mutação; apenas recalcula no servidor com fail-closed multiempresa/RBAC.
 */
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { calculateOrcamento } from '../repositories/orcamentoTypes.js';
import {
  computeDescontoBps,
  descontoExcedeAlcadaLivre,
  DESCONTO_ALCADA_LIVRE_BPS_DEFAULT,
} from './comercialDescontoAlcadaPolicy.js';
import {
  aplicarDescontoPromocional,
  type ComercialPromocaoConfigPort,
} from './comercialPromocaoPolicy.js';
import { buildParcelaSchedule } from './comercialParcelaSchedulePolicy.js';
import {
  snapshotCondicaoParaDocumento,
  type CondicaoResolucaoRow,
} from './comercialCondicaoResolucaoPolicy.js';
import type { CondicaoPagamentoService } from './condicaoPagamentoService.js';

const money = z.string().regex(/^\d+(\.\d{1,6})?$/);
const itemSchema = z.object({
  produto_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  descricao: z.string().trim().min(1).max(240),
  unidade_sigla: z.string().trim().min(1).max(12),
  quantidade: money,
  /** Ignorado pelo servidor — preço vem do resolveSalePrice. */
  preco_unitario: money.optional(),
  desconto: money.optional(),
}).strict();

const simulateSchema = z.object({
  cliente_empresa_id: z.string().uuid(),
  /** Se omitido, resolve fail-closed: ClienteEmpresa → padrão Empresa → erro sem condição. */
  condicao_pagamento_id: z.string().uuid().optional(),
  base_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  itens: z.array(itemSchema).min(1).max(1000),
  promocao: z.object({
    bps: z.number().int().positive().max(10000),
    cupom: z.string().trim().max(64).optional(),
  }).strict().optional(),
}).strict();

export type SalePricePort = {
  resolveSalePrice(
    ctx: RequestContext,
    input: { clienteEmpresaId: string; produtoId: string; unidadeMedidaId: string; businessDate?: string },
  ): Promise<{ preco: string; tabela_preco_id?: string } | null>;
};

export class ComercialSimulacaoVendaService {
  constructor(
    private readonly tenantGuard: TenantGuard,
    private readonly rbac: RbacGuard,
    private readonly prices: SalePricePort,
    private readonly condicoes: Pick<CondicaoPagamentoService, 'resolveForClienteEmpresa' | 'getAuthorizedInScope'>,
    private readonly promocaoConfig: ComercialPromocaoConfigPort | null = null,
  ) {}

  async simular(ctx: RequestContext, payload: unknown) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
    // Fail-closed: precisa visualizar orçamento ou pedido no Comercial.
    await this.assertComercialVisualizar(ctx);

    const parsed = simulateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid simulação payload', parsed.error.flatten());
    }
    const data = parsed.data;
    const businessDate = data.base_date ?? new Date().toISOString().slice(0, 10);

    const pricedItems = [];
    for (const item of data.itens) {
      const resolved = await this.prices.resolveSalePrice(ctx, {
        clienteEmpresaId: data.cliente_empresa_id,
        produtoId: item.produto_id,
        unidadeMedidaId: item.unidade_id,
        businessDate,
      });
      if (!resolved?.preco) {
        throw new AppError(422, 'SIMULACAO_PRECO_INDISPONIVEL', 'Price unavailable for product/unit', {
          produto_id: item.produto_id,
          unidade_id: item.unidade_id,
        });
      }
      pricedItems.push({
        ...item,
        preco_unitario: this.normalizeMoney(resolved.preco),
        desconto: item.desconto ?? '0.000000',
        tabela_preco_id: resolved.tabela_preco_id ?? null,
      });
    }

    let promocaoAplicada: { aplicada: boolean; promocaoBps: number } | null = null;
    let itemsForTotals = pricedItems;
    if (data.promocao) {
      const cfg = this.promocaoConfig
        ? await this.promocaoConfig.getPromocaoConfig({
          groupId: ctx.groupId,
          empresaId: ctx.empresaId,
        })
        : null;
      const applied = aplicarDescontoPromocional({
        items: pricedItems,
        promocaoBps: data.promocao.bps,
        config: cfg,
        cupom: data.promocao.cupom,
      });
      itemsForTotals = applied.items;
      promocaoAplicada = { aplicada: applied.aplicada, promocaoBps: applied.promocaoBps };
    }

    const totals = calculateOrcamento(itemsForTotals.map((item) => ({
      produto_id: item.produto_id,
      unidade_id: item.unidade_id,
      descricao: item.descricao,
      unidade_sigla: item.unidade_sigla,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      desconto: item.desconto,
    })));

    const condicao = await this.resolveCondicao(ctx, data.cliente_empresa_id, data.condicao_pagamento_id);
    const snapshot = snapshotCondicaoParaDocumento(condicao);
    if (!snapshot) {
      throw new AppError(422, 'SIMULACAO_CONDICAO_INDISPONIVEL', 'CondicaoPagamento unavailable for simulation');
    }

    const parcelas = buildParcelaSchedule({
      total: totals.total,
      parcelas: snapshot.parcelas,
      baseDate: businessDate,
    });

    const descontoInfo = computeDescontoBps(itemsForTotals);
    const exigeAlcada = descontoExcedeAlcadaLivre(itemsForTotals, DESCONTO_ALCADA_LIVRE_BPS_DEFAULT);

    return {
      group_id: ctx.groupId,
      empresa_id: ctx.empresaId,
      cliente_empresa_id: data.cliente_empresa_id,
      base_date: businessDate,
      condicao: snapshot,
      promocao: promocaoAplicada,
      itens: totals.itens.map((item, index) => ({
        ...item,
        tabela_preco_id: itemsForTotals[index]?.tabela_preco_id ?? null,
      })),
      subtotal: totals.subtotal,
      desconto: totals.desconto,
      total: totals.total,
      desconto_bps: descontoInfo.descontoBps,
      aprovacao_desconto_exigida: exigeAlcada,
      parcelas,
    };
  }

  private async resolveCondicao(
    ctx: RequestContext,
    clienteEmpresaId: string,
    condicaoPagamentoId: string | undefined,
  ): Promise<CondicaoResolucaoRow | null> {
    if (condicaoPagamentoId) {
      const row = await this.condicoes.getAuthorizedInScope(ctx, condicaoPagamentoId);
      if (!row?.ativo) {
        throw new AppError(422, 'SIMULACAO_CONDICAO_INDISPONIVEL', 'CondicaoPagamento unavailable in tenant scope');
      }
      return {
        id: row.id,
        codigo: row.codigo,
        nome: row.nome,
        ativo: row.ativo,
        parcelas: (row.parcelas ?? []).map((p: any) => ({
          ordem: p.ordem,
          dias: p.dias,
          percentual: String(p.percentual),
          ativo: p.ativo !== false,
        })),
      };
    }
    const resolved = await this.condicoes.resolveForClienteEmpresa(ctx, clienteEmpresaId);
    return resolved.condicao;
  }

  private async assertComercialVisualizar(ctx: RequestContext) {
    try {
      await this.rbac.assertAllowed(ctx, 'Comercial', 'orcamento', 'visualizar', { allowGlobalWildcard: false });
      return;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'PERMISSION_DENIED') throw error;
    }
    await this.rbac.assertAllowed(ctx, 'Comercial', 'pedido', 'visualizar', { allowGlobalWildcard: false });
  }

  private normalizeMoney(value: string): string {
    const raw = String(value).trim();
    if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid money amount');
    }
    const [whole, fraction = ''] = raw.split('.');
    return `${whole}.${`${fraction}000000`.slice(0, 6)}`;
  }
}
