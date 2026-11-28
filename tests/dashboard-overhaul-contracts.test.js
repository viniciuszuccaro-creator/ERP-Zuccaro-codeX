import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDashboardDerivedKpis,
  isDashboardReceivableOverdue,
  filterFinancialReportItems,
  resolveDashboardPeriodRange,
  resolveDashboardReportFiltersFromSearch,
  resolveIndicatorState,
  normalizeDashboardAggregateContract,
  buildKpiDrillDownParams,
  buildKpiDrillDownUrl,
} from "../src/components/lib/dashboardKpiPolicy.js";
import { buildDashboardViewModel } from "../src/components/dashboard/dashboardViewModel.js";

test("computeDashboardDerivedKpis calcula ticketMedio apenas sobre pedidos válidos (exclui cancelados)", () => {
  const hojeIso = new Date().toISOString();
  const result = computeDashboardDerivedKpis({
    periodo: "mes",
    pedidos: [
      { id: "p1", status: "Aprovado", valor_total: 1000, data_pedido: hojeIso },
      { id: "p2", status: "Faturado", valor_total: 2000, data_pedido: hojeIso },
      { id: "p3", status: "Cancelado", valor_total: 9000, data_pedido: hojeIso },
      { id: "p4", status: "Aguardando Aprovação", valor_total: 3000, data_pedido: hojeIso },
    ],
    contasReceber: [
      { id: "cr1", status: "Pendente", valor: 500, data_vencimento: "2026-01-01" },
      { id: "cr2", status: "Pendente", valor: 1500, data_vencimento: "2027-01-01" },
    ],
    contasPagar: [{ id: "cp1", status: "Pendente", valor: 400 }],
    produtos: [{ id: "pr1", status: "Ativo", estoque_atual: 2, estoque_minimo: 10 }],
    entregas: [],
    ordensProducao: [],
    oportunidades: [],
  });

  assert.equal(result.totalVendas, 6000);
  assert.equal(result.pedidosValidosPeriodo.length, 3);
  assert.equal(result.pedidosAguardandoAprovacao, 1);
  assert.equal(result.ticketMedio, 2000);
  assert.equal(result.produtosBaixoEstoque, 1);
  assert.equal(result.valorVencido, 500);
});

test("resolveDashboardPeriodRange gera intervalo ISO consistente para todos os períodos", () => {
  const ref = new Date(2026, 10, 28, 12, 0, 0);
  const dia = resolveDashboardPeriodRange("dia", ref);
  assert.equal(dia.data_inicio, "2026-11-28");
  assert.equal(dia.data_fim, "2026-11-28");

  const mes = resolveDashboardPeriodRange("mes", ref);
  assert.equal(mes.data_inicio, "2026-11-01");
  assert.equal(mes.data_fim, "2026-11-28");
  assert.equal(mes.label, "Este Mês");

  const ano = resolveDashboardPeriodRange("ano", ref);
  assert.equal(ano.data_inicio, "2026-01-01");
  assert.equal(ano.data_fim, "2026-11-28");
});

test("buildKpiDrillDownParams e resolveDashboardReportFiltersFromSearch preservam filtros idênticos", () => {
  const params = buildKpiDrillDownParams({
    kpi: "inadimplencia",
    tab: "financeiro",
    periodo: "mes",
    status: "Atrasado",
    groupId: "grp-cpa",
    empresaId: "emp-3z",
    scopeType: "empresa",
    referenceDate: new Date(2026, 10, 28, 12, 0, 0),
  });
  const url = buildKpiDrillDownUrl("/Relatorios", params);
  const parsed = resolveDashboardReportFiltersFromSearch(url.slice(url.indexOf("?")));

  assert.equal(parsed.fromDashboard, true);
  assert.equal(parsed.kpi, "inadimplencia");
  assert.equal(parsed.tab, "financeiro");
  assert.equal(parsed.periodo, "mes");
  assert.equal(parsed.data_inicio, "2026-11-01");
  assert.equal(parsed.data_fim, "2026-11-28");
  assert.equal(parsed.status, "Atrasado");
  assert.equal(parsed.group_id, "grp-cpa");
  assert.equal(parsed.empresa_id, "emp-3z");
  assert.equal(parsed.scopeType, "empresa");
});

test("resolveIndicatorState diferencia fail-closed: sem_contexto, sem_acesso, carregando, erro, zero_confirmado e ok", () => {
  assert.equal(resolveIndicatorState({ hasContext: false, hasPermission: true, value: 0 }).state, "sem_contexto");
  assert.equal(resolveIndicatorState({ hasContext: true, hasPermission: false, value: 10 }).state, "sem_acesso");
  assert.equal(resolveIndicatorState({ hasContext: true, hasPermission: true, isLoading: true, value: null }).state, "carregando");
  assert.equal(resolveIndicatorState({ hasContext: true, hasPermission: true, isError: true, value: 0 }).state, "erro");
  assert.equal(resolveIndicatorState({ hasContext: true, hasPermission: true, isError: false, value: null }).state, "erro");

  const zero = resolveIndicatorState({ hasContext: true, hasPermission: true, isError: false, value: 0 });
  assert.equal(zero.state, "zero_confirmado");
  assert.equal(zero.isZeroConfirmed, true);

  const okOfficial = resolveIndicatorState({ hasContext: true, hasPermission: true, value: 42, isAggregateOfficial: true });
  assert.equal(okOfficial.state, "ok");
  assert.equal(okOfficial.isAggregateOfficial, true);
});

test("normalizeDashboardAggregateContract normaliza payload sintético do contrato agregado oficial", () => {
  assert.equal(normalizeDashboardAggregateContract(null), null);
  assert.equal(normalizeDashboardAggregateContract({}), null);

  const normalized = normalizeDashboardAggregateContract({
    contractVersion: "v1",
    generated_at: "2026-11-28T11:00:00Z",
    counts: { Cliente: 120, Produto: 480, Colaborador: 32 },
    operational: {
      total_vendas: 250000,
      pedidos_validos_count: 50,
      ticket_medio: 5000,
      taxa_inadimplencia: 3.4,
      otd: 96.2,
    },
  });

  assert.ok(normalized);
  assert.equal(normalized.source, "backend_aggregate");
  assert.equal(normalized.counts.Cliente, 120);
  assert.equal(normalized.operational.totalVendas, 250000);
  assert.equal(normalized.operational.ticketMedio, 5000);
});

test("buildDashboardViewModel monta estados corretos para Grupo, CPA, 3Z, perfil restrito, erro e agregado sintético", () => {
  const baseDerived = {
    totalVendas: 45000,
    pedidosPeriodo: [{ id: "p1" }, { id: "p2" }],
    pedidosAguardandoAprovacao: 1,
    ticketMedio: 22500,
    receitasPendentes: 12000,
    despesasPendentes: 8000,
    fluxoCaixa: 4000,
    produtosBaixoEstoque: 3,
    entregasPendentes: 2,
    otd: 92.5,
    pesoProduzido: 1200,
    aproveitamentoBarra: 95,
    taxaInadimplencia: 4.5,
    valorVencido: 1500,
    amostraLimitada: false,
  };

  const fullPerms = {
    canSeeComercial: true,
    canSeeFinanceiro: true,
    canSeeEstoque: true,
    canSeeExpedicao: true,
    canSeeProducao: true,
    canSeeCRM: true,
    canSeeRH: true,
    canSeeFiscal: true,
  };

  const vmGrupo = buildDashboardViewModel({
    hasContextoAtivo: true,
    groupId: "grp-cpa",
    empresaId: null,
    scopeType: "grupo",
    periodo: "mes",
    permissions: fullPerms,
    queryStates: {},
    counts: { totalClientes: 85, totalProdutos: 340, totalColaboradores: 24 },
    derived: baseDerived,
    referenceDate: new Date(2026, 10, 28, 12, 0, 0),
  });

  assert.equal(vmGrupo.states.vendas.state, "ok");
  assert.equal(vmGrupo.states.clientesCount.state, "ok");
  assert.match(vmGrupo.drillDownUrls.vendas, /^\/Relatorios\?/);
  assert.match(vmGrupo.drillDownUrls.vendas, /tab=vendas/);
  assert.match(vmGrupo.drillDownUrls.vendas, /scopeType=grupo/);
  assert.match(vmGrupo.drillDownUrls.vendas, /group_id=grp-cpa/);
  assert.match(vmGrupo.drillDownUrls.entregas, /^\/Expedicao\?/);
  assert.match(vmGrupo.drillDownUrls.entregas, /kpi=entregas_pendentes/);
  assert.match(vmGrupo.drillDownUrls.otd, /^\/Expedicao\?/);
  assert.match(vmGrupo.drillDownUrls.otd, /kpi=otd_entregas/);
  assert.doesNotMatch(vmGrupo.drillDownUrls.entregas, /tab=producao/);
  assert.doesNotMatch(vmGrupo.drillDownUrls.otd, /tab=producao/);
  assert.match(vmGrupo.drillDownUrls.inadimplencia, /^\/Relatorios\?/);
  assert.match(vmGrupo.drillDownUrls.inadimplencia, /tab=financeiro/);
  assert.match(vmGrupo.drillDownUrls.inadimplencia, /kpi=inadimplencia/);
  assert.doesNotMatch(vmGrupo.drillDownUrls.inadimplencia, /status=Atrasado/);

  const vmRestrito = buildDashboardViewModel({
    hasContextoAtivo: true,
    groupId: "grp-cpa",
    empresaId: "emp-3z",
    scopeType: "empresa",
    periodo: "mes",
    permissions: { ...fullPerms, canSeeComercial: false, canSeeFinanceiro: false },
    queryStates: {},
    counts: { totalClientes: 10, totalProdutos: 0, totalColaboradores: 5 },
    derived: baseDerived,
  });

  assert.equal(vmRestrito.states.vendas.state, "sem_acesso");
  assert.equal(vmRestrito.states.fluxoCaixa.state, "sem_acesso");
  assert.equal(vmRestrito.states.produtosCount.state, "zero_confirmado");
  assert.match(vmRestrito.drillDownUrls.estoque, /empresa_id=emp-3z/);

  const vmErro = buildDashboardViewModel({
    hasContextoAtivo: true,
    groupId: "grp-cpa",
    empresaId: "emp-cpa",
    scopeType: "empresa",
    periodo: "semana",
    permissions: fullPerms,
    queryStates: { pedidosError: true, clientesCountError: true },
    counts: { totalClientes: null, totalProdutos: 12, totalColaboradores: 0 },
    derived: { ...baseDerived, totalVendas: 0 },
  });

  assert.equal(vmErro.states.vendas.state, "erro");
  assert.equal(vmErro.states.clientesCount.state, "erro");
  assert.equal(vmErro.states.colaboradoresCount.state, "zero_confirmado");
  assert.ok(vmErro.failedSources.includes("Pedidos"));
  assert.ok(vmErro.failedSources.includes("Clientes"));
});

test("filterFinancialReportItems e isDashboardReceivableOverdue reproduzem exatamente a inadimplência do Dashboard", () => {
  const ref = new Date("2026-11-28T12:00:00Z");
  const contasReceber = [
    { id: "r1", status: "Pendente", valor: 500, data_vencimento: "2026-09-15" }, // vencido antes do mês atual
    { id: "r2", status: "Pendente", valor: 300, data_vencimento: "2026-11-10" }, // vencido dentro do mês
    { id: "r3", status: "Atrasado", valor: 200, data_vencimento: "2026-08-01" }, // status Atrasado antigo
    { id: "r4", status: "Pendente", valor: 1500, data_vencimento: "2026-12-20" }, // a vencer
    { id: "r5", status: "Recebido", valor: 700, data_vencimento: "2026-10-01" }, // já recebido
  ];

  assert.equal(isDashboardReceivableOverdue(contasReceber[0], ref), true);
  assert.equal(isDashboardReceivableOverdue(contasReceber[1], ref), true);
  assert.equal(isDashboardReceivableOverdue(contasReceber[2], ref), true);
  assert.equal(isDashboardReceivableOverdue(contasReceber[3], ref), false);
  assert.equal(isDashboardReceivableOverdue(contasReceber[4], ref), false);

  const filtradosInadimplencia = filterFinancialReportItems(contasReceber, {
    data_inicio: "2026-11-01",
    data_fim: "2026-11-28",
    status: null,
    kpi: "inadimplencia",
    kind: "receber",
    referenceDate: ref,
  });
  assert.deepEqual(
    filtradosInadimplencia.map((c) => c.id),
    ["r1", "r2", "r3"],
  );
  const totalDrillDown = filtradosInadimplencia.reduce((s, c) => s + c.valor, 0);
  const derived = computeDashboardDerivedKpis({ periodo: "mes", contasReceber });
  assert.equal(totalDrillDown, derived.valorVencido);
});
