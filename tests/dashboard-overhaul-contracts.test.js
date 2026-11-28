import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isDateInCalendarRange,
  computeDashboardDerivedKpis,
  isDashboardReceivableOverdue,
  filterFinancialReportItems,
  filtrarPorPeriodoDashboard,
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

test("filtrarPorPeriodoDashboard('semana') usa o mesmo intervalo de calendário do drill-down", () => {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7, 10, 0, 0);
  const oitoDiasAtras = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 8, 23, 0, 0);
  assert.equal(filtrarPorPeriodoDashboard(seteDiasAtras.toISOString(), 'semana'), true);
  assert.equal(filtrarPorPeriodoDashboard(oitoDiasAtras.toISOString(), 'semana'), false);
  assert.equal(filtrarPorPeriodoDashboard(hoje.toISOString(), 'semana'), true);
});

test("filterFinancialReportItems não aplica status de receber às contas a pagar", () => {
  const ref = new Date("2026-11-28T12:00:00Z");
  const pagar = [
    { id: "p1", status: "Pendente", valor: 100, data_vencimento: "2026-11-10" },
    { id: "p2", status: "Pago", valor: 50, data_vencimento: "2026-11-12" },
  ];
  const cobrancasPagas = filterFinancialReportItems(pagar, {
    data_inicio: "2026-11-01", data_fim: "2026-11-28", status: "Recebido",
    kpi: "cobrancas_pagas", kind: "pagar", referenceDate: ref,
  });
  assert.deepEqual(cobrancasPagas.map((c) => c.id), ["p1", "p2"]);

  const contasPagar = filterFinancialReportItems(pagar, {
    data_inicio: "2026-11-01", data_fim: "2026-11-28", status: "Pendente",
    kpi: "contas_pagar", kind: "pagar", referenceDate: ref,
  });
  assert.deepEqual(contasPagar.map((c) => c.id), ["p1"]);
});

test("KPI de aguardando aprovação conta além de 8 e só o status do drill-down", () => {
  const hoje = new Date().toISOString();
  const pedidos = Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`, status: "Aguardando Aprovação", valor_total: 10, data_pedido: hoje,
  }));
  pedidos.push({ id: "sp", status: "Aprovado", status_aprovacao: "pendente", valor_total: 10, data_pedido: hoje });
  const derived = computeDashboardDerivedKpis({ periodo: "mes", pedidos });
  assert.equal(derived.pedidosAguardandoAprovacao, 10);
});

test("isDashboardReceivableOverdue compara data YYYY-MM-DD em calendário local (não meia-noite UTC)", () => {
  const localDay27Late = new Date(2026, 10, 27, 23, 30, 0);
  const localDay28Noon = new Date(2026, 10, 28, 12, 0, 0);
  const tituloDia28 = { id: "t28", status: "Pendente", valor: 100, data_vencimento: "2026-11-28" };
  const tituloDia27 = { id: "t27", status: "Pendente", valor: 100, data_vencimento: "2026-11-27" };
  const tituloInvalido = { id: "tinv", status: "Pendente", valor: 100, data_vencimento: "2026-02-31" };

  assert.equal(isDashboardReceivableOverdue(tituloDia28, localDay27Late), false);
  assert.equal(isDashboardReceivableOverdue(tituloDia28, localDay28Noon), false);
  assert.equal(isDashboardReceivableOverdue(tituloDia27, localDay28Noon), true);
  assert.equal(isDashboardReceivableOverdue(tituloInvalido, localDay28Noon), false);
});

test("filterFinancialReportItems mantém escopo coerente entre receber e pagar nos KPIs do Dashboard", () => {
  const ref = new Date(2026, 10, 28, 12, 0, 0);
  const receber = [
    { id: "r-old", status: "Pendente", valor: 500, data_vencimento: "2026-08-10" },
    { id: "r-cur", status: "Pendente", valor: 300, data_vencimento: "2026-11-15" },
    { id: "r-rec", status: "Recebido", valor: 200, data_vencimento: "2026-11-10" },
  ];
  const pagar = [
    { id: "p-old", status: "Pendente", valor: 400, data_vencimento: "2026-09-05" },
    { id: "p-cur", status: "Pendente", valor: 100, data_vencimento: "2026-11-20" },
    { id: "p-pag", status: "Pago", valor: 50, data_vencimento: "2026-11-18" },
  ];
  const opts = { data_inicio: "2026-11-01", data_fim: "2026-11-28", referenceDate: ref };

  // Inadimplência não mistura contas a pagar do período no saldo
  assert.deepEqual(
    filterFinancialReportItems(pagar, { ...opts, kpi: "inadimplencia", kind: "pagar" }),
    [],
  );

  // KPIs de carteira pendente aplicam o mesmo escopo em ambos os lados
  for (const kpi of ["fluxo_caixa", "contas_receber", "contas_pagar"]) {
    const rec = filterFinancialReportItems(receber, { ...opts, kpi, kind: "receber" });
    const pag = filterFinancialReportItems(pagar, { ...opts, kpi, kind: "pagar" });
    assert.deepEqual(rec.map((i) => i.id), ["r-old", "r-cur"]);
    assert.deepEqual(pag.map((i) => i.id), ["p-old", "p-cur"]);
  }
});

test("Dashboard alinha drill-down de entregas_pendentes e otd_entregas para Expedicao", () => {
  const src = readFileSync("src/pages/Dashboard.jsx", "utf8");
  assert.match(src, /handleDrillDown\(createPageUrl\("Expedicao"\),\s*\{\s*kpi:\s*'entregas_pendentes'\s*\}\)/);
  assert.match(src, /handleDrillDown\(createPageUrl\("Expedicao"\),\s*\{\s*kpi:\s*'otd_entregas'\s*\}\)/);
  assert.doesNotMatch(src, /tab:\s*'producao',\s*kpi:\s*'entregas_pendentes'/);
  assert.doesNotMatch(src, /tab:\s*'producao',\s*kpi:\s*'otd_entregas'/);
});

test("relatórios de Vendas, Estoque, DRE e Produção filtram por intervalo de calendário compartilhado com o Dashboard", () => {
  for (const file of ["RelatorioVendas", "RelatorioEstoque", "RelatorioDRE", "RelatorioProducao"]) {
    const src = readFileSync(`src/components/relatorios/${file}.jsx`, "utf8");
    assert.match(src, /import \{[^}]*isDateInCalendarRange[^}]*\} from "@\/components\/lib\/dashboardKpiPolicy"/, file);
    assert.match(src, /isDateInCalendarRange\(/, file);
    assert.doesNotMatch(src, /new Date\(filtros\.data_inicio/, file);
  }
});

test("data SQL em meia-noite UTC conta no dia de calendário, inclusive no primeiro dia do intervalo", () => {
  const ref = new Date(2026, 10, 28, 12, 0, 0);
  assert.equal(isDateInCalendarRange("2026-11-01T00:00:00.000Z", "2026-11-01", "2026-11-07"), true);
  assert.equal(isDateInCalendarRange("2026-11-01T00:00:00Z", "2026-11-01", "2026-11-01"), true);
  assert.equal(isDateInCalendarRange("2026-10-31T00:00:00.000Z", "2026-11-01", "2026-11-07"), false);
  assert.equal(isDateInCalendarRange("2026-11-08T00:00:00.000Z", "2026-11-01", "2026-11-07"), false);
  assert.equal(
    isDashboardReceivableOverdue({ status: "Pendente", data_vencimento: "2026-11-28T00:00:00.000Z" }, ref),
    false,
  );
  assert.equal(
    isDashboardReceivableOverdue({ status: "Pendente", data_vencimento: "2026-11-27T00:00:00.000Z" }, ref),
    true,
  );
});

test("timestamp de instante real continua no dia local, não no dia UTC", () => {
  const instanteLocal = new Date(2026, 10, 1, 0, 30, 0).toISOString();
  assert.equal(isDateInCalendarRange(instanteLocal, "2026-11-01", "2026-11-07"), true);
  const diaAnteriorLocal = new Date(2026, 9, 31, 23, 30, 0).toISOString();
  assert.equal(isDateInCalendarRange(diaAnteriorLocal, "2026-11-01", "2026-11-07"), false);
});

test("semana do Dashboard aceita data SQL em meia-noite UTC do primeiro dia da janela", () => {
  const hoje = new Date();
  const tresDiasAtras = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 3);
  const chave = `${tresDiasAtras.getFullYear()}-${String(tresDiasAtras.getMonth() + 1).padStart(2, "0")}-${String(tresDiasAtras.getDate()).padStart(2, "0")}`;
  assert.equal(filtrarPorPeriodoDashboard(`${chave}T00:00:00.000Z`, "semana"), true);
});

test("filtrarPorPeriodoDashboard preserva primeiro dia de dia/mes/trimestre/ano para YYYY-MM-DD e meia-noite UTC", () => {
  const ref = new Date(2026, 10, 28, 12, 0, 0);
  assert.equal(filtrarPorPeriodoDashboard("2026-11-28", "dia", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-11-28T00:00:00.000Z", "dia", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-11-01", "mes", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-11-01T00:00:00.000Z", "mes", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-10-31", "mes", ref), false);
  assert.equal(filtrarPorPeriodoDashboard("2026-10-01", "trimestre", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-10-01T00:00:00.000Z", "trimestre", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-09-30", "trimestre", ref), false);
  assert.equal(filtrarPorPeriodoDashboard("2026-01-01", "ano", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2026-01-01T00:00:00.000Z", "ano", ref), true);
  assert.equal(filtrarPorPeriodoDashboard("2025-12-31", "ano", ref), false);
});

test("Dashboard usa um único predicado de aguardando aprovação para chip, lista e drill-down", () => {
  const src = readFileSync("src/pages/Dashboard.jsx", "utf8");
  assert.match(src, /const pedidosAguardandoAprovacaoPeriodo = pedidosPeriodo\.filter\(p => p\?\.status === 'Aguardando Aprovação'\);/);
  assert.match(src, /const totalAguardandoAprovacaoPeriodo = pedidosAguardandoAprovacaoPeriodo\.length;/);
  assert.match(src, /const pedidosAguardandoAprovacao = pedidosAguardandoAprovacaoPeriodo\.slice\(0, 8\);/);
  assert.match(src, /<Badge className="bg-red-100 text-red-700">\{totalAguardandoAprovacaoPeriodo\}<\/Badge>/);
  assert.match(src, /Exibindo \{pedidosAguardandoAprovacao\.length\} de \{totalAguardandoAprovacaoPeriodo\} no período\./);
});
