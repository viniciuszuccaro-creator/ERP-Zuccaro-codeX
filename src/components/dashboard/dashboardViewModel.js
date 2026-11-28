import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Truck,
  AlertCircle,
  Users,
  Package,
} from "lucide-react";
import {
  buildKpiDrillDownParams,
  buildKpiDrillDownUrl,
  normalizeDashboardAggregateContract,
  resolveDashboardPeriodRange,
  resolveIndicatorState,
} from "../lib/dashboardKpiPolicy.js";

const formatBRL = (value) =>
  `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatInt = (value) => Number(value || 0).toLocaleString("pt-BR");

const formatDisplayByState = (indicatorState, formatter, rawValue) => {
  const st = indicatorState?.state;
  if (st === "sem_contexto") return "Sem contexto";
  if (st === "sem_acesso") return "Sem acesso";
  if (st === "carregando") return "Carregando...";
  if (st === "erro") return "Indisponível";
  return formatter(rawValue);
};

/**
 * Monta o view-model completo do Dashboard Executivo combinando:
 * - contagens canônicas (countEntities: Cliente, Produto, Colaborador)
 * - agregados oficiais de período (quando disponíveis no backend Codex) ou derivados com transparência
 * - estados fail-closed (sem_contexto | sem_acesso | carregando | erro | zero_confirmado | ok)
 * - URLs de drill-down para Relatórios preservando período, data_inicio, data_fim e escopo multiempresa
 */
export function buildDashboardViewModel(/** @type {any} */ {
  hasContextoAtivo = false,
  groupId = null,
  empresaId = null,
  scopeType = "empresa",
  periodo = "mes",
  permissions = {},
  queryStates = {},
  counts = {},
  derived = {},
  aggregatePayload = null,
  referenceDate = new Date(),
} = {}) {
  const official = normalizeDashboardAggregateContract(aggregatePayload);
  const officialAggregateActive = Boolean(official?.operational);
  const periodoRange = resolveDashboardPeriodRange(periodo, referenceDate);

  const reportUrl = (tab, kpi, status = "") =>
    buildKpiDrillDownUrl(
      "/Relatorios",
      buildKpiDrillDownParams({
        tab,
        kpi,
        periodo: periodoRange.periodo,
        status,
        groupId,
        empresaId: scopeType === "grupo" ? null : empresaId,
        scopeType,
        referenceDate,
      }),
    );

  const p = {
    comercial: Boolean(permissions.canSeeComercial),
    financeiro: Boolean(permissions.canSeeFinanceiro),
    estoque: Boolean(permissions.canSeeEstoque),
    expedicao: Boolean(permissions.canSeeExpedicao),
    producao: Boolean(permissions.canSeeProducao),
    crm: Boolean(permissions.canSeeCRM),
    rh: Boolean(permissions.canSeeRH),
    fiscal: Boolean(permissions.canSeeFiscal),
  };

  const q = queryStates || {};

  // Valores efetivos (prioriza agregado oficial quando disponível; nunca inventa zero em erro)
  const totalVendas = official?.operational?.totalVendas ?? derived.totalVendas;
  const pedidosPeriodoCount = official?.operational?.pedidosPeriodoCount ?? (Array.isArray(derived.pedidosPeriodo) ? derived.pedidosPeriodo.length : null);
  const pedidosAguardando = official?.operational?.pedidosAguardandoAprovacao ?? derived.pedidosAguardandoAprovacao ?? null;
  const ticketMedio = official?.operational?.ticketMedio ?? derived.ticketMedio;
  const receitasPendentes = official?.operational?.receitasPendentes ?? derived.receitasPendentes;
  const despesasPendentes = official?.operational?.despesasPendentes ?? derived.despesasPendentes;
  const fluxoCaixa = official?.operational?.fluxoCaixa ?? derived.fluxoCaixa;
  const produtosBaixoEstoque = official?.operational?.produtosBaixoEstoque ?? derived.produtosBaixoEstoque;
  const entregasPendentes = official?.operational?.entregasPendentes ?? derived.entregasPendentes;
  const otd = official?.operational?.otd ?? derived.otd;
  const pesoProduzido = official?.operational?.pesoProduzido ?? derived.pesoProduzido;
  const aproveitamentoBarra = official?.operational?.aproveitamentoBarra ?? derived.aproveitamentoBarra;
  const taxaInadimplencia = official?.operational?.taxaInadimplencia ?? derived.taxaInadimplencia;
  const valorVencido = official?.operational?.valorVencido ?? derived.valorVencido;

  const totalClientes = official?.counts?.Cliente ?? counts.totalClientes ?? null;
  const totalProdutos = official?.counts?.Produto ?? counts.totalProdutos ?? null;
  const totalColaboradores = official?.counts?.Colaborador ?? counts.totalColaboradores ?? null;

  const isPartialOperational = !officialAggregateActive && Boolean(derived.amostraLimitada);

  const states = {
    vendas: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.comercial,
      isLoading: !officialAggregateActive && Boolean(q.pedidosPending),
      isError: !officialAggregateActive && Boolean(q.pedidosError),
      value: totalVendas,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    pedidosPeriodo: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.comercial,
      isLoading: !officialAggregateActive && Boolean(q.pedidosPending),
      isError: !officialAggregateActive && Boolean(q.pedidosError),
      value: pedidosPeriodoCount,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    ticketMedio: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.comercial,
      isLoading: !officialAggregateActive && Boolean(q.pedidosPending),
      isError: !officialAggregateActive && Boolean(q.pedidosError),
      value: ticketMedio,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    receber: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.financeiro,
      isLoading: !officialAggregateActive && Boolean(q.contasReceberPending),
      isError: !officialAggregateActive && Boolean(q.contasReceberError),
      value: receitasPendentes,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    pagar: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.financeiro,
      isLoading: !officialAggregateActive && Boolean(q.contasPagarPending),
      isError: !officialAggregateActive && Boolean(q.contasPagarError),
      value: despesasPendentes,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    fluxoCaixa: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.financeiro,
      isLoading: !officialAggregateActive && Boolean(q.contasReceberPending || q.contasPagarPending),
      isError: !officialAggregateActive && Boolean(q.contasReceberError || q.contasPagarError),
      value: fluxoCaixa,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    entregas: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.expedicao,
      isLoading: !officialAggregateActive && Boolean(q.entregasPending),
      isError: !officialAggregateActive && Boolean(q.entregasError),
      value: entregasPendentes,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    otd: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.expedicao,
      isLoading: !officialAggregateActive && Boolean(q.entregasPending),
      isError: !officialAggregateActive && Boolean(q.entregasError),
      value: otd,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    producao: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.producao,
      isLoading: !officialAggregateActive && Boolean(q.producaoPending),
      isError: !officialAggregateActive && Boolean(q.producaoError),
      value: pesoProduzido,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    aproveitamento: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.producao,
      isLoading: !officialAggregateActive && Boolean(q.producaoPending),
      isError: !officialAggregateActive && Boolean(q.producaoError),
      value: aproveitamentoBarra,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    inadimplencia: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.financeiro,
      isLoading: !officialAggregateActive && Boolean(q.contasReceberPending),
      isError: !officialAggregateActive && Boolean(q.contasReceberError),
      value: taxaInadimplencia,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    estoqueBaixo: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.estoque,
      isLoading: !officialAggregateActive && Boolean(q.produtosListPending),
      isError: !officialAggregateActive && Boolean(q.produtosListError),
      value: produtosBaixoEstoque,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    clientesCount: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.crm,
      isLoading: Boolean(q.clientesCountPending),
      isError: Boolean(q.clientesCountError),
      value: totalClientes,
      isAggregateOfficial: true,
    }),
    produtosCount: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.estoque,
      isLoading: Boolean(q.produtosCountPending),
      isError: Boolean(q.produtosCountError),
      value: totalProdutos,
      isAggregateOfficial: true,
    }),
    colaboradoresCount: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.rh,
      isLoading: Boolean(q.colaboradoresCountPending),
      isError: Boolean(q.colaboradoresCountError),
      value: totalColaboradores,
      isAggregateOfficial: true,
    }),
    conversao: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.comercial && p.crm,
      isLoading: Boolean(q.pedidosPending || q.clientesListPending),
      isError: Boolean(q.pedidosError || q.clientesListError),
      value: derived.taxaConversao,
      isPartial: isPartialOperational,
      isAggregateOfficial: officialAggregateActive,
    }),
    nfAutorizadas: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.fiscal || p.financeiro || p.comercial,
      isLoading: Boolean(q.notasFiscaisPending),
      isError: Boolean(q.notasFiscaisError),
      value: derived.nfAutorizadas,
      isAggregateOfficial: officialAggregateActive,
    }),
    cobrancasPagas: resolveIndicatorState({
      hasContext: hasContextoAtivo,
      hasPermission: p.financeiro,
      isLoading: Boolean(q.cobrancasPending),
      isError: Boolean(q.cobrancasError),
      value: derived.cobrancasPagas,
      isAggregateOfficial: officialAggregateActive,
    }),
  };

  const failedSources = [
    p.comercial && q.pedidosError && "Pedidos",
    p.financeiro && (q.contasReceberError || q.contasPagarError) && "Financeiro",
    p.expedicao && q.entregasError && "Entregas",
    p.producao && q.producaoError && "Produção",
    p.estoque && (q.produtosCountError || q.produtosListError) && "Produtos/Estoque",
    p.crm && q.clientesCountError && "Clientes",
    p.rh && q.colaboradoresCountError && "Colaboradores",
  ].filter(Boolean);

  const drillDownUrls = {
    vendas: reportUrl("vendas", "vendas_periodo"),
    pedidos: reportUrl("vendas", "pedidos_periodo"),
    pedidosAprovacao: reportUrl("vendas", "pedidos_aprovacao", "Aguardando Aprovação"),
    ticketMedio: reportUrl("vendas", "ticket_medio"),
    conversao: reportUrl("vendas", "taxa_conversao"),
    receber: reportUrl("financeiro", "contas_receber", "Pendente"),
    pagar: reportUrl("financeiro", "contas_pagar", "Pendente"),
    fluxoCaixa: reportUrl("financeiro", "fluxo_caixa"),
    inadimplencia: reportUrl("financeiro", "inadimplencia", "Atrasado"),
    anomalia: reportUrl("financeiro", "anomalias_financeiras"),
    cobrancas: reportUrl("financeiro", "cobrancas_pagas", "Recebido"),
    estoque: reportUrl("estoque", "estoque_baixo"),
    produtos: reportUrl("estoque", "produtos_cadastrados"),
    producao: reportUrl("producao", "peso_produzido"),
    aproveitamento: reportUrl("producao", "aproveitamento_barra"),
    entregas: reportUrl("producao", "entregas_pendentes"),
    otd: reportUrl("producao", "otd_entregas"),
    clientes: reportUrl("vendas", "clientes_cadastrados"),
    relatoriosGeral: reportUrl("vendas", "resumo_periodo"),
  };

  const stripItems = [
    {
      key: "vendas_periodo",
      label: `Vendas (${periodoRange.label})`,
      icon: DollarSign,
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      formattedValue: formatDisplayByState(states.vendas, formatBRL, totalVendas),
      sublabel: states.pedidosPeriodo.state === "ok" || states.pedidosPeriodo.state === "zero_confirmado"
        ? `${formatInt(pedidosPeriodoCount)} pedido(s)`
        : periodoRange.label,
      indicatorState: states.vendas,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Comercial.visualizar",
      drillDownUrl: drillDownUrls.vendas,
    },
    {
      key: "pedidos_periodo",
      label: "Pedidos no Período",
      icon: ShoppingCart,
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      formattedValue: formatDisplayByState(states.pedidosPeriodo, formatInt, pedidosPeriodoCount),
      sublabel: Number(pedidosAguardando) > 0 ? `${pedidosAguardando} em aprovação` : periodoRange.label,
      indicatorState: states.pedidosPeriodo,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Comercial.visualizar",
      drillDownUrl: drillDownUrls.pedidos,
    },
    {
      key: "contas_receber",
      label: "A Receber",
      icon: TrendingUp,
      color: "text-teal-700",
      bgColor: "bg-teal-50",
      formattedValue: formatDisplayByState(states.receber, formatBRL, receitasPendentes),
      sublabel: "Títulos pendentes",
      indicatorState: states.receber,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Financeiro.visualizar",
      drillDownUrl: drillDownUrls.receber,
    },
    {
      key: "contas_pagar",
      label: "A Pagar",
      icon: TrendingDown,
      color: "text-orange-700",
      bgColor: "bg-orange-50",
      formattedValue: formatDisplayByState(states.pagar, formatBRL, despesasPendentes),
      sublabel: "Despesas pendentes",
      indicatorState: states.pagar,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Financeiro.visualizar",
      drillDownUrl: drillDownUrls.pagar,
    },
    {
      key: "entregas_pendentes",
      label: "Entregas Pendentes",
      icon: Truck,
      color: "text-sky-700",
      bgColor: "bg-sky-50",
      formattedValue: formatDisplayByState(states.entregas, formatInt, entregasPendentes),
      sublabel: "Expedição ativa",
      indicatorState: states.entregas,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Expedicao.visualizar",
      drillDownUrl: drillDownUrls.entregas,
    },
    {
      key: "estoque_baixo",
      label: "Estoque Crítico",
      icon: AlertCircle,
      color: "text-red-700",
      bgColor: "bg-red-50",
      formattedValue: formatDisplayByState(states.estoqueBaixo, formatInt, produtosBaixoEstoque),
      sublabel: "Abaixo do mínimo",
      indicatorState: states.estoqueBaixo,
      alert: Number(produtosBaixoEstoque) > 0,
      source: officialAggregateActive ? "official" : "derived",
      permission: "Estoque.visualizar",
      drillDownUrl: drillDownUrls.estoque,
    },
    {
      key: "clientes_canonico",
      label: "Clientes",
      icon: Users,
      color: "text-indigo-700",
      bgColor: "bg-indigo-50",
      formattedValue: formatDisplayByState(states.clientesCount, formatInt, totalClientes),
      sublabel: "Total no escopo",
      indicatorState: states.clientesCount,
      source: "canonical",
      permission: "CRM.visualizar",
      drillDownUrl: drillDownUrls.clientes,
    },
    {
      key: "produtos_canonico",
      label: "Produtos",
      icon: Package,
      color: "text-violet-700",
      bgColor: "bg-violet-50",
      formattedValue: formatDisplayByState(states.produtosCount, formatInt, totalProdutos),
      sublabel: "Catálogo no escopo",
      indicatorState: states.produtosCount,
      source: "canonical",
      permission: "Estoque.visualizar",
      drillDownUrl: drillDownUrls.produtos,
    },
  ];

  return {
    officialAggregateActive,
    periodoRange,
    states,
    failedSources,
    drillDownUrls,
    stripItems,
    effectiveValues: {
      totalVendas,
      pedidosPeriodoCount,
      pedidosAguardando,
      ticketMedio,
      receitasPendentes,
      despesasPendentes,
      fluxoCaixa,
      produtosBaixoEstoque,
      entregasPendentes,
      otd,
      pesoProduzido,
      aproveitamentoBarra,
      taxaInadimplencia,
      valorVencido,
      totalClientes,
      totalProdutos,
      totalColaboradores,
    },
    formatDisplayByState,
    formatBRL,
    formatInt,
  };
}
