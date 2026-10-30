import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Clock,
  DollarSign,
  FileText,
  Truck,
  CheckCircle2,
  Plus,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { resolveErpBackendMode } from "@/api/runtimeBackend";
import {
  loadPedidosHistoricoHttp,
  historicoSessionCacheKey,
} from "./HistoricoProdutosCliente";

const PEDIDOS_PAGE_LIMIT = 50;
const AUX_PAGE_LIMIT = 20;

/**
 * Status cancelado (legado string ou canônico HTTP).
 * @param {{ status?: string } | null | undefined} pedido
 */
export function isHistoricoPedidoCancelado(pedido) {
  const s = String(pedido?.status || "").toUpperCase();
  return s === "CANCELADO" || s === "CANCELLED";
}

/**
 * Valor do pedido: legado `valor_total` ou canônico HTTP `total`.
 * @param {{ valor_total?: number, total?: number } | null | undefined} pedido
 * @returns {number}
 */
export function historicoPedidoValorTotal(pedido) {
  const raw = pedido?.valor_total ?? pedido?.total;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * AGENTS §11: não publicar KPIs monetários pela 1ª página quando há mais registros.
 * Contagem pode usar `meta.total`; somas/ticket/taxa só com página completa.
 * @param {{ hasMore?: boolean, total?: number } | null | undefined} meta
 * @param {unknown[] | null | undefined} pedidos
 */
export function isHistoricoClientePedidosPageComplete(meta, pedidos) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  if (meta?.hasMore) return false;
  const total = Number(meta?.total);
  if (Number.isFinite(total) && total > rows.length) return false;
  return true;
}

/**
 * Taxa de entrega a partir do status do Pedido só no legado (`Entregue`).
 * HTTP canônico (`PEDIDO_STATUS`) termina em `FINALIZADO`; entrega comprovada
 * vive na entidade Entrega — sem adapter auxiliar, taxa fica indisponível (≠ 0%).
 *
 * @param {{
 *   pedidos?: Array<{
 *     status?: string,
 *     valor_total?: number,
 *     total?: number,
 *     data_pedido?: string,
 *     created_at?: string,
 *     itens?: unknown[],
 *     itens_revenda?: unknown[],
 *     itens_armado_padrao?: unknown[],
 *   }>,
 *   meta?: { hasMore?: boolean, total?: number, limit?: number, offset?: number } | null,
 *   deliveryRateFromPedidoStatus?: boolean,
 * }} [options]
 */
export function resolveHistoricoClienteKpisFromPage({
  pedidos,
  meta,
  deliveryRateFromPedidoStatus = false,
} = {}) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  const complete = isHistoricoClientePedidosPageComplete(meta, rows);
  const totalMeta = Number(meta?.total);
  const qtdFromMeta = Number.isFinite(totalMeta) ? totalMeta : null;
  if (!complete) {
    return {
      moneyIncomplete: true,
      totalPedidos: qtdFromMeta,
      ticketMedio: null,
      valorTotalHistorico: null,
      taxaEntrega: null,
    };
  }
  const ativos = rows.filter((p) => !isHistoricoPedidoCancelado(p));
  const valorTotalHistorico = ativos.reduce((sum, p) => sum + historicoPedidoValorTotal(p), 0);
  const totalPedidos = rows.length;
  const ticketMedio = ativos.length > 0 ? valorTotalHistorico / ativos.length : 0;
  let taxaEntrega = /** @type {number|null} */ (null);
  if (deliveryRateFromPedidoStatus) {
    const pedidosEntregues = rows.filter((p) => {
      const s = String(p?.status || "").toUpperCase();
      return s === "ENTREGUE" || s === "DELIVERED";
    }).length;
    taxaEntrega = totalPedidos > 0 ? (pedidosEntregues / totalPedidos) * 100 : 0;
  }
  return {
    moneyIncomplete: false,
    totalPedidos,
    ticketMedio,
    valorTotalHistorico,
    taxaEntrega,
  };
}

/**
 * Top 20 a partir de itens legado (`itens_*`) e canônico HTTP (`itens`).
 * @param {Array<{
 *   data_pedido?: string,
 *   created_at?: string,
 *   itens?: Array<{ produto_id?: string, descricao?: string, quantidade?: number, total?: number, valor_total?: number, subtotal?: number }>,
 *   itens_revenda?: Array<{ produto_id?: string, descricao?: string, quantidade?: number, valor_item?: number, valor_total?: number, total?: number }>,
 *   itens_armado_padrao?: Array<{ peca_id?: string, descricao_peca?: string, quantidade?: number, preco_venda_total?: number, valor_total?: number, total?: number }>,
 * }> | null | undefined} pedidos
 */
export function computeHistoricoClienteTopProdutos(pedidos) {
  /** @type {Record<string, { produto_id: string|null, descricao: string, quantidade_total: number, valor_total: number, frequencia: number, ultima_compra: string|null, tipo?: string, preco_medio: number }>} */
  const mapaProdutos = {};
  const list = Array.isArray(pedidos) ? pedidos : [];

  /**
   * @param {string|number|null|undefined} key
   * @param {{ produto_id?: string|null, descricao?: string, quantidade?: number, valor?: number, tipo?: string }} patch
   * @param {string|null|undefined} dataPedido
   */
  const bump = (key, patch, dataPedido) => {
    if (key == null || key === "") return;
    const mapKey = String(key);
    if (!mapaProdutos[mapKey]) {
      mapaProdutos[mapKey] = {
        produto_id: patch.produto_id || null,
        descricao: patch.descricao || "-",
        quantidade_total: 0,
        valor_total: 0,
        frequencia: 0,
        ultima_compra: dataPedido || null,
        tipo: patch.tipo,
        preco_medio: 0,
      };
    }
    const row = mapaProdutos[mapKey];
    row.quantidade_total += Number(patch.quantidade) || 0;
    row.valor_total += Number(patch.valor) || 0;
    row.frequencia += 1;
    if (dataPedido && (!row.ultima_compra || dataPedido > row.ultima_compra)) {
      row.ultima_compra = dataPedido;
    }
  };

  list.forEach((pedido) => {
    const dataPedido = pedido.data_pedido || pedido.created_at || null;
    (pedido.itens_revenda || []).forEach((item) => {
      bump(
        item.produto_id || item.descricao,
        {
          produto_id: item.produto_id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor: item.valor_item ?? item.valor_total ?? item.total,
        },
        dataPedido,
      );
    });
    (pedido.itens_armado_padrao || []).forEach((item) => {
      bump(
        item.peca_id || item.descricao_peca,
        {
          produto_id: item.peca_id,
          descricao: item.descricao_peca,
          quantidade: item.quantidade,
          valor: item.preco_venda_total ?? item.valor_total ?? item.total,
          tipo: "Armado",
        },
        dataPedido,
      );
    });
    if (Array.isArray(pedido.itens) && pedido.itens.length) {
      pedido.itens.forEach((item) => {
        bump(
          item.produto_id || item.descricao,
          {
            produto_id: item.produto_id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor: item.total ?? item.valor_total ?? item.subtotal,
          },
          dataPedido,
        );
      });
    }
  });

  return Object.values(mapaProdutos)
    .sort((a, b) => b.quantidade_total - a.quantidade_total)
    .slice(0, 20)
    .map((p) => ({
      ...p,
      preco_medio: p.quantidade_total > 0 ? p.valor_total / p.quantidade_total : 0,
    }));
}

/**
 * V21.1.2-R1 - HISTÓRICO EXPANDIDO DO CLIENTE (melhoria no existente)
 * Top 20 / auditoria NF-e / entregas / pagamentos / add-to-pedido.
 * Keep both: ≠ HistoricoProdutosCliente (linhas de produto) e ≠ DetalhesCliente (ficha KPIs).
 * HTTP: pedidos via loadPedidosHistoricoHttp; auxiliares sem adapter → fail-closed (≠ lista vazia).
 */
export default function HistoricoClienteTab({ formData, setFormData: _setFormData, onAdicionarItemAoPedido }) {
  const clienteId = formData?.cliente_id || null;
  const { filterInContext, empresaAtual, grupoAtual, contexto } = useContextoVisual();
  const { hasPermission } = usePermissions();

  const groupId =
    formData?.group_id ||
    formData?.grupo_id ||
    grupoAtual?.id ||
    empresaAtual?.group_id ||
    empresaAtual?.grupo_id ||
    null;
  const empresaId =
    formData?.empresa_id ||
    formData?.empresa_dona_id ||
    (contexto === "empresa" ? empresaAtual?.id : null);
  const contextoValido = Boolean(groupId || empresaId);
  const httpMode = resolveErpBackendMode() === "http";
  const sessionSnapshot = readErpHttpSession();
  const sessionActorId = sessionSnapshot?.actorId || null;
  const sessionCacheKey = historicoSessionCacheKey(sessionSnapshot);
  const podeVisualizar =
    hasPermission("Comercial.Pedido.visualizar") ||
    hasPermission("CRM.Cliente.visualizar") ||
    hasPermission("Cadastros.Cliente.visualizar") ||
    hasPermission("comercial", "visualizar_pedido");
  const consultaPedidosHabilitada = Boolean(
    clienteId
      && contextoValido
      && podeVisualizar
      && (!httpMode || (empresaId && sessionActorId && sessionCacheKey)),
  );
  // Auxiliares (CR/Entrega/NF) ainda sem list HTTP por cliente — só legado com contexto.
  const consultaAuxLegado = Boolean(clienteId && contextoValido && podeVisualizar && !httpMode);

  const {
    data: pedidosPage,
    isError: pedidosErro,
    isFetching: pedidosFetching,
    error: pedidosError,
  } = useQuery({
    queryKey: [
      "historico-cliente-tab-pedidos",
      clienteId,
      groupId,
      empresaId,
      contexto,
      sessionActorId,
      sessionCacheKey,
      httpMode ? "http" : "legado",
    ],
    queryFn: async ({ signal }) => {
      if (!clienteId || !contextoValido || !podeVisualizar) {
        throw Object.assign(new Error("Histórico bloqueado: contexto ou permissão ausente."), {
          code: "HISTORICO_TAB_CONTEXT_DENIED",
        });
      }
      if (httpMode) {
        if (!empresaId) {
          throw Object.assign(new Error("Histórico HTTP exige empresa no contexto."), {
            code: "EMPRESA_CONTEXT_REQUIRED",
          });
        }
        return loadPedidosHistoricoHttp({
          clienteId,
          groupId,
          empresaId,
          signal,
          limit: PEDIDOS_PAGE_LIMIT,
          offset: 0,
          expectedActorId: sessionActorId,
          expectedSessionKey: sessionCacheKey,
        });
      }
      const rows = await filterInContext("Pedido", { cliente_id: clienteId }, "-data_pedido", PEDIDOS_PAGE_LIMIT);
      const data = Array.isArray(rows) ? rows : [];
      return {
        data,
        meta: { limit: PEDIDOS_PAGE_LIMIT, offset: 0, total: data.length, hasMore: false },
      };
    },
    enabled: consultaPedidosHabilitada,
    staleTime: 60_000,
    retry: false,
  });

  const { data: contasReceber = [], isError: contasErro } = useQuery({
    queryKey: ["historico-cliente-tab-contas", clienteId, groupId, empresaId, "legado"],
    queryFn: () => filterInContext("ContaReceber", { cliente_id: clienteId }, "-data_vencimento", AUX_PAGE_LIMIT),
    enabled: consultaAuxLegado,
    retry: false,
  });

  const { data: entregas = [], isError: entregasErro } = useQuery({
    queryKey: ["historico-cliente-tab-entregas", clienteId, groupId, empresaId, "legado"],
    queryFn: () => filterInContext("Entrega", { cliente_id: clienteId }, "-created_date", AUX_PAGE_LIMIT),
    enabled: consultaAuxLegado,
    retry: false,
  });

  const { data: notasFiscais = [], isError: nfErro } = useQuery({
    queryKey: ["historico-cliente-tab-nfe", clienteId, groupId, empresaId, "legado"],
    queryFn: () =>
      filterInContext("NotaFiscal", { cliente_fornecedor_id: clienteId }, "-data_emissao", AUX_PAGE_LIMIT),
    enabled: consultaAuxLegado,
    retry: false,
  });

  const pedidos = Array.isArray(pedidosPage?.data) ? pedidosPage.data : [];
  const kpisDisponiveis = consultaPedidosHabilitada && !pedidosErro && pedidosPage != null;
  const resolved = kpisDisponiveis
    ? resolveHistoricoClienteKpisFromPage({
        pedidos,
        meta: pedidosPage?.meta,
        // HTTP: status Pedido ≠ prova de entrega (FINALIZADO ≠ ENTREGUE); auxiliares fail-closed.
        deliveryRateFromPedidoStatus: !httpMode,
      })
    : {
        moneyIncomplete: false,
        totalPedidos: null,
        ticketMedio: null,
        valorTotalHistorico: null,
        taxaEntrega: null,
      };
  const produtosFrequentes = useMemo(
    () => (kpisDisponiveis && !resolved.moneyIncomplete ? computeHistoricoClienteTopProdutos(pedidos) : []),
    [kpisDisponiveis, resolved.moneyIncomplete, pedidos],
  );

  const contasList = Array.isArray(contasReceber) ? contasReceber : [];
  const entregasList = Array.isArray(entregas) ? entregas : [];
  const nfList = Array.isArray(notasFiscais) ? notasFiscais : [];
  const contasPagas = contasList.filter((c) => c.status === "Recebido").length;
  const contasAtrasadas = contasList.filter((c) => c.status === "Atrasado").length;

  const fmtMoney = (n) =>
    n == null ? "—" : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtCount = (n) => (n == null ? "—" : String(n));
  const fmtPct = (n) => (n == null ? "—" : `${n.toFixed(0)}%`);

  const httpPedidosIndisponivel =
    httpMode && podeVisualizar && contextoValido && (!consultaPedidosHabilitada || pedidosErro);
  const httpAuxIndisponivel = httpMode && podeVisualizar && contextoValido;

  if (!clienteId) {
    return (
      <div className="text-center py-12 text-slate-500" data-action="historico-cliente-tab-sem-cliente">
        <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p>Selecione um cliente para ver o histórico</p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full space-y-6"
      data-context-required="true"
      data-permission="Comercial.Pedido.visualizar"
      data-action="historico-cliente-tab"
    >
      <Alert className="border-sky-200 bg-sky-50">
        <BarChart3 className="w-4 h-4 text-sky-700" />
        <AlertDescription className="text-sm text-sky-900">
          <strong>Histórico expandido do cliente:</strong> Top 20 produtos, auditoria de NF-e, entregas e pagamentos.
          Capacidade distinta do Histórico de Produtos (linhas) — keep both.
        </AlertDescription>
      </Alert>

      {(!contextoValido || !podeVisualizar) && (
        <Alert className="border-amber-200 bg-amber-50" data-action="historico-cliente-tab-contexto-negado">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Histórico exige contexto de grupo/empresa e permissão para visualizar pedidos ou clientes.
          </AlertDescription>
        </Alert>
      )}

      {httpPedidosIndisponivel && (
        <Alert
          className="border-sky-200 bg-sky-50"
          data-action="historico-cliente-tab-pedidos-http-indisponivel"
        >
          <ShieldAlert className="h-4 w-4 text-sky-700" />
          <AlertDescription className="text-sky-900">
            {pedidosError?.message
              || "Pedidos do cliente indisponíveis em HTTP até sessão/empresa válidos. Não use R$ 0,00 como “sem compras”."}
          </AlertDescription>
        </Alert>
      )}

      {httpAuxIndisponivel && (
        <Alert
          className="border-slate-200 bg-slate-50"
          data-action="historico-cliente-tab-auxiliar-http-indisponivel"
        >
          <ShieldAlert className="h-4 w-4 text-slate-600" />
          <AlertDescription className="text-slate-800">
            NF-e, entregas e contas a receber por cliente ainda sem listagem HTTP canônica neste painel —
            seções auxiliares ficam indisponíveis (fail-closed), sem inventar lista vazia.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-action="historico-cliente-tab-kpis">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-sky-700" />
              <div>
                <p className="text-xs text-slate-600">Total Pedidos</p>
                <p className="text-2xl font-bold text-sky-800">
                  {pedidosFetching && !kpisDisponiveis ? "…" : fmtCount(resolved.totalPedidos)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-700" />
              <div>
                <p className="text-xs text-slate-600">Ticket Médio</p>
                <p className="text-2xl font-bold text-emerald-800">
                  {pedidosFetching && !kpisDisponiveis
                    ? "…"
                    : resolved.moneyIncomplete
                      ? "—"
                      : fmtMoney(resolved.ticketMedio)}
                </p>
                {resolved.moneyIncomplete && (
                  <p className="text-[10px] text-slate-500" data-action="historico-cliente-tab-kpi-incompleto">
                    Página incompleta — agregação monetária indisponível
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xs text-slate-600">Taxa Entrega</p>
                <p className="text-2xl font-bold text-orange-600">
                  {pedidosFetching && !kpisDisponiveis
                    ? "…"
                    : resolved.taxaEntrega == null
                      ? "—"
                      : fmtPct(resolved.taxaEntrega)}
                </p>
                {httpMode && kpisDisponiveis && !resolved.moneyIncomplete && resolved.taxaEntrega == null && (
                  <p className="text-[10px] text-slate-500" data-action="historico-cliente-tab-taxa-http-indisponivel">
                    Exige Entrega HTTP — não inferir 0% de Pedido.FINALIZADO
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-sky-700" />
              <div>
                <p className="text-xs text-slate-600">Pagamentos</p>
                {httpAuxIndisponivel || contasErro ? (
                  <p className="text-lg font-bold text-slate-500">—</p>
                ) : (
                  <>
                    <p className="text-lg font-bold text-emerald-700">{contasPagas} OK</p>
                    {contasAtrasadas > 0 && (
                      <p className="text-sm font-semibold text-red-600">{contasAtrasadas} Atrasadas</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-r from-sky-50 to-slate-50 border-b">
          <CardTitle className="flex items-center gap-2 text-sky-900">
            <TrendingUp className="w-5 h-5 text-sky-700" />
            Top 20 Produtos Mais Comprados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {pedidosFetching && !kpisDisponiveis ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto" />
              <p className="text-sm text-slate-600 mt-2">Analisando histórico...</p>
            </div>
          ) : !kpisDisponiveis || pedidosErro ? (
            <div className="text-center py-8 text-slate-500" data-action="historico-cliente-tab-top-indisponivel">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Top produtos indisponível neste contexto (fail-closed).</p>
            </div>
          ) : resolved.moneyIncomplete ? (
            <div className="text-center py-8 text-slate-500" data-action="historico-cliente-tab-top-incompleto">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Há mais pedidos além desta página — Top 20 não é publicado pela 1ª página.</p>
            </div>
          ) : produtosFrequentes.length > 0 ? (
            <div className="space-y-2">
              {produtosFrequentes.map((produto, idx) => (
                <div
                  key={`${produto.produto_id || produto.descricao}-${idx}`}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-sky-700 text-white">#{idx + 1}</Badge>
                      <p className="font-semibold text-sm">{produto.descricao}</p>
                      {produto.tipo && (
                        <Badge variant="outline" className="text-xs">{produto.tipo}</Badge>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-slate-600">
                      <span>Qtd Total: <strong>{produto.quantidade_total.toFixed(2)}</strong></span>
                      <span>Frequência: <strong>{produto.frequencia}x</strong></span>
                      <span>Média: <strong>R$ {produto.preco_medio.toFixed(2)}</strong></span>
                      <span>
                        Última:{" "}
                        <strong>
                          {produto.ultima_compra
                            ? new Date(produto.ultima_compra).toLocaleDateString("pt-BR")
                            : "—"}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAdicionarItemAoPedido && onAdicionarItemAoPedido(produto)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum histórico de compras encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-emerald-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            Notas Fiscais Emitidas
            {!httpAuxIndisponivel && !nfErro ? ` (${nfList.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {httpAuxIndisponivel || nfErro ? (
            <p className="text-center text-slate-500 py-4" data-action="historico-cliente-tab-nfe-indisponivel">
              NF-e indisponível neste modo (fail-closed).
            </p>
          ) : nfList.length > 0 ? (
            <div className="space-y-2">
              {nfList.slice(0, 10).map((nf) => (
                <div key={nf.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">NF-e {nf.numero} - Série {nf.serie}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(nf.data_emissao).toLocaleDateString("pt-BR")} •
                      R$ {(nf.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Badge
                    className={
                      nf.status === "Autorizada"
                        ? "bg-green-600"
                        : nf.status === "Cancelada"
                          ? "bg-red-600"
                          : "bg-orange-600"
                    }
                  >
                    {nf.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">Nenhuma NF-e encontrada</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-orange-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            Histórico de Entregas
            {!httpAuxIndisponivel && !entregasErro ? ` (${entregasList.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {httpAuxIndisponivel || entregasErro ? (
            <p className="text-center text-slate-500 py-4" data-action="historico-cliente-tab-entregas-indisponivel">
              Entregas indisponíveis neste modo (fail-closed).
            </p>
          ) : entregasList.length > 0 ? (
            <div className="space-y-2">
              {entregasList.slice(0, 10).map((entrega) => (
                <div key={entrega.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">
                      {entrega.endereco_entrega_completo?.cidade || "Endereço não especificado"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Previsão:{" "}
                      {entrega.data_previsao
                        ? new Date(entrega.data_previsao).toLocaleDateString("pt-BR")
                        : "-"}{" "}
                      •
                      {entrega.peso_total_kg && ` ${entrega.peso_total_kg} kg`} •
                      {entrega.km_rodado && ` ${entrega.km_rodado} km`}
                    </p>
                  </div>
                  <Badge
                    className={
                      entrega.status === "Entregue"
                        ? "bg-green-600"
                        : entrega.status === "Em Trânsito"
                          ? "bg-blue-600"
                          : entrega.status === "Entrega Frustrada"
                            ? "bg-red-600"
                            : "bg-orange-600"
                    }
                  >
                    {entrega.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">Nenhuma entrega registrada</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-sky-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-sky-700" />
            Histórico Financeiro
            {!httpAuxIndisponivel && !contasErro ? ` (${contasList.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {httpAuxIndisponivel || contasErro ? (
            <p className="text-center text-slate-500 py-4" data-action="historico-cliente-tab-contas-indisponivel">
              Contas a receber indisponíveis neste modo (fail-closed).
            </p>
          ) : contasList.length > 0 ? (
            <div className="space-y-2">
              {contasList.slice(0, 10).map((conta) => (
                <div key={conta.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold text-sm">{conta.descricao}</p>
                    <p className="text-xs text-slate-600">
                      Vencimento: {new Date(conta.data_vencimento).toLocaleDateString("pt-BR")} •
                      R$ {(conta.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      {conta.forma_recebimento && ` • ${conta.forma_recebimento}`}
                    </p>
                  </div>
                  <Badge
                    className={
                      conta.status === "Recebido"
                        ? "bg-green-600"
                        : conta.status === "Atrasado"
                          ? "bg-red-600"
                          : "bg-orange-600"
                    }
                  >
                    {conta.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">Nenhuma movimentação financeira</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sky-900">
            <CheckCircle2 className="w-5 h-5" />
            Resumo do Relacionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Total Faturado (escopo carregado)</p>
              <p className="text-xl font-bold text-emerald-700">
                {resolved.moneyIncomplete || !kpisDisponiveis
                  ? "—"
                  : fmtMoney(resolved.valorTotalHistorico)}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Produtos Diferentes</p>
              <p className="text-xl font-bold text-sky-800">
                {resolved.moneyIncomplete || !kpisDisponiveis ? "—" : produtosFrequentes.length}
              </p>
            </div>
            <div>
              <p className="text-slate-600">NF-e Emitidas</p>
              <p className="text-xl font-bold text-sky-800">
                {httpAuxIndisponivel || nfErro ? "—" : nfList.length}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Entregas Realizadas</p>
              <p className="text-xl font-bold text-orange-600">
                {httpAuxIndisponivel || entregasErro ? "—" : entregasList.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
