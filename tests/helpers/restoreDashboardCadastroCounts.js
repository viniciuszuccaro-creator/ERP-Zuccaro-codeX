import assert from 'node:assert/strict';

export function restoreDashboardCadastroCounts(text) {
  const restoreCountHunk = (change, previous) => {
    assert.equal(text.split(change).length, 2, `Hunk not uniquely matched: ${change.slice(0, 80)}`);
    text = text.replace(change, previous);
  };
  restoreCountHunk('import DashboardExecutiveTopSection from "@/components/dashboard/DashboardExecutiveTopSection";\nimport { buildDashboardViewModel } from "@/components/dashboard/dashboardViewModel";\n', '');
  restoreCountHunk('export default function Dashboard({ aggregateOverride = null } = {}) {', 'export default function Dashboard() {');
  restoreCountHunk(`  const canSeeCadastros = hasPermission('Cadastros', null, 'ver') || hasPermission('Cadastros', null, 'visualizar');
  const canSeeRelatorios = hasPermission('Relatorios', null, 'ver') || hasPermission('Relatorios', null, 'visualizar') || hasPermission('Relatórios', null, 'ver');\n`, '');
  restoreCountHunk('const { data: pedidos = [], isError: pedidosError, isFetching: pedidosFetching, isFetched: pedidosFetched } = useQuery({', 'const { data: pedidos = [] } = useQuery({');
  text = text.replaceAll('    refetchOnReconnect: false,\n    retry: false\n  });', '    refetchOnReconnect: false,\n    retry: false,\n    initialData: []\n  });');
  restoreCountHunk('const { data: contasReceber = [], isError: contasReceberError, isFetching: contasReceberFetching, isFetched: contasReceberFetched } = useQuery({', 'const { data: contasReceber = [] } = useQuery({');
  restoreCountHunk('const { data: contasPagar = [], isError: contasPagarError, isFetching: contasPagarFetching, isFetched: contasPagarFetched } = useQuery({', 'const { data: contasPagar = [] } = useQuery({');
  restoreCountHunk('const { data: entregas = [], isError: entregasError, isFetching: entregasFetching, isFetched: entregasFetched } = useQuery({', 'const { data: entregas = [] } = useQuery({');
  restoreCountHunk('const { data: produtos = [], isError: produtosListError, isFetching: produtosListFetching, isFetched: produtosListFetched } = useQuery({', 'const { data: produtos = [] } = useQuery({');
  restoreCountHunk('const { data: totalProdutos, isPending: produtosCountPending, isError: produtosCountError } = useQuery({', 'const { data: totalProdutos, isPending: produtosCountPending } = useQuery({');
  restoreCountHunk('const { data: clientes = [], isError: clientesListError, isFetching: clientesListFetching, isFetched: clientesListFetched } = useQuery({', 'const { data: clientes = [] } = useQuery({');
  restoreCountHunk('const { data: totalClientes, isPending: clientesCountPending, isError: clientesCountError } = useQuery({', 'const { data: totalClientes, isPending: clientesCountPending } = useQuery({');
  restoreCountHunk(`  const { data: totalColaboradoresDash, isPending: colaboradoresCountPending, isError: colaboradoresCountError } = useQuery({
    enabled: Boolean(hasContextoAtivo && canSeeRH),
    queryKey: ['colaboradores-count-dash', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],
    queryFn: async () => {
      try {
        const filtro = buildContextFilter('Colaborador', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Colaborador',
          filter: filtro
        });
        const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar colaboradores', error, { scopeType, groupId, empresaId });
        throw error;
      }
    },
    staleTime: 120000,
    retry: 1,
  });`, `  const { data: totalColaboradoresDash = 0 } = useQuery({
    enabled: Boolean(hasContextoAtivo && canSeeRH),
    queryKey: ['colaboradores-count-dash', ...contextQueryKey],
    queryFn: async () => {
      try {
        const filtro = getFiltroContexto('empresa_alocada_id', true);
        const response = await base44.functions.invoke('countEntities', {
          entityName: 'Colaborador',
          filter: filtro
        });
        return resolveDashboardCount({ countValue: response.data?.count, list: colaboradores }).total;
      } catch (error) {
        reportDashboardFailure('Falha ao contar colaboradores; usando lista carregada', error, { scopeType, groupId, empresaId });
        return resolveDashboardCount({ list: colaboradores }).total;
      }
    },
    staleTime: 120000,
    retry: 1,
  });`);
  restoreCountHunk('const { data: ordensProducao = [], isError: producaoError, isFetching: producaoFetching, isFetched: producaoFetched } = useQuery({', 'const { data: ordensProducao = [] } = useQuery({');
  restoreCountHunk('const { data: notasFiscais = [], isError: notasFiscaisError, isFetching: notasFiscaisFetching, isFetched: notasFiscaisFetched } = useQuery({', 'const { data: notasFiscais = [] } = useQuery({');
  restoreCountHunk('const { data: cobrancas = [], isError: cobrancasError, isFetching: cobrancasFetching, isFetched: cobrancasFetched } = useQuery({', 'const { data: cobrancas = [] } = useQuery({');
  restoreCountHunk(`    const params = buildKpiDrillDownParams({
      tab: kpiMeta.tab,
      kpi: kpiMeta.kpi || rota,
      periodo,
      status: kpiMeta.status,
      groupId,
      empresaId: estaNoGrupo ? null : empresaId,
      scopeType,
    });
    const url = buildKpiDrillDownUrl(rota, params);
    auditDashboardAction('abrir_modulo_por_dashboard', { rota: url, ...params });
    navigate(url);
  };

  const handleNavigateDirect = (url) => {
    if (!url) return;
    auditDashboardAction('navegar_dashboard', { rota: url, periodo, scopeType, groupId, empresaId });
    navigate(url);
  };

  const handleRefreshAll = () => {
    auditDashboardAction('atualizar_indicadores', { periodo, scopeType, groupId, empresaId });
    const dashboardKeys = new Set([
      'pedidos', 'contasReceber', 'contasPagar', 'entregas', 'colaboradores',
      'produtos', 'clientes', 'ordensProducao', 'notasFiscais', 'cobrancas',
      'produtos-count-dash', 'clientes-count', 'colaboradores-count-dash',
    ]);
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && dashboardKeys.has(q.queryKey[0]),
    });
  };

  const dashboardViewModel = buildDashboardViewModel({
    hasContextoAtivo,
    groupId,
    empresaId: estaNoGrupo ? null : empresaId,
    scopeType,
    periodo,
    permissions: {
      canSeeComercial,
      canSeeFinanceiro,
      canSeeEstoque,
      canSeeExpedicao,
      canSeeProducao,
      canSeeCRM,
      canSeeRH,
      canSeeFiscal,
    },
    queryStates: {
      pedidosPending: pedidosFetching && !pedidosFetched,
      pedidosError,
      contasReceberPending: contasReceberFetching && !contasReceberFetched,
      contasReceberError,
      contasPagarPending: contasPagarFetching && !contasPagarFetched,
      contasPagarError,
      entregasPending: entregasFetching && !entregasFetched,
      entregasError,
      producaoPending: producaoFetching && !producaoFetched,
      producaoError,
      produtosListPending: produtosListFetching && !produtosListFetched,
      produtosListError,
      clientesListPending: clientesListFetching && !clientesListFetched,
      clientesListError,
      produtosCountPending,
      produtosCountError,
      clientesCountPending,
      clientesCountError,
      colaboradoresCountPending,
      colaboradoresCountError,
      notasFiscaisPending: notasFiscaisFetching && !notasFiscaisFetched,
      notasFiscaisError,
      cobrancasPending: cobrancasFetching && !cobrancasFetched,
      cobrancasError,
    },
    counts: {
      totalClientes,
      totalProdutos,
      totalColaboradores: totalColaboradoresDash,
    },
    derived: {
      pedidosPeriodo,
      pedidosAguardandoAprovacao: pedidosAguardandoAprovacao.length,
      totalVendas,
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
      taxaConversao,
      nfAutorizadas,
      cobrancasPagas,
    },
    aggregatePayload: aggregateOverride,
  });

  const vmStates = dashboardViewModel.states;
  const vmEffective = dashboardViewModel.effectiveValues;
  const isAnyDashboardFetching = pedidosFetching || contasReceberFetching || contasPagarFetching || entregasFetching || producaoFetching;

  const statsCards = [
    {
      key: "vendas_periodo",
      title: "Vendas do Período",
      value: dashboardViewModel.formatDisplayByState(vmStates.vendas, dashboardViewModel.formatBRL, vmEffective.totalVendas),
      subtitle: \`\${vmEffective.pedidosPeriodoCount ?? pedidosPeriodo.length} pedidos\`,
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      indicatorState: vmStates.vendas,
      drillDownUrl: dashboardViewModel.drillDownUrls.vendas,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'vendas_periodo' })
    },
    {
      key: "ticket_medio",
      title: "Ticket Médio",
      value: dashboardViewModel.formatDisplayByState(vmStates.ticketMedio, dashboardViewModel.formatBRL, vmEffective.ticketMedio),
      subtitle: "por pedido válido",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      indicatorState: vmStates.ticketMedio,
      drillDownUrl: dashboardViewModel.drillDownUrls.ticketMedio,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'ticket_medio' })
    },
    {
      key: "fluxo_caixa",
      title: "Fluxo de Caixa",
      value: dashboardViewModel.formatDisplayByState(vmStates.fluxoCaixa, dashboardViewModel.formatBRL, vmEffective.fluxoCaixa),
      subtitle: \`\${(vmEffective.fluxoCaixa ?? fluxoCaixa) >= 0 ? 'Positivo' : 'Negativo'}\`,
      icon: DollarSign,
      color: fluxoCaixa >= 0 ? "from-emerald-500 to-emerald-600" : "from-orange-500 to-orange-600",
      bgColor: fluxoCaixa >= 0 ? "bg-emerald-50" : "bg-orange-50",
      textColor: fluxoCaixa >= 0 ? "text-emerald-600" : "text-orange-600",
      indicatorState: vmStates.fluxoCaixa,
      drillDownUrl: dashboardViewModel.drillDownUrls.fluxoCaixa,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'fluxo_caixa' })
    },
    {
      key: "taxa_conversao",
      title: "Taxa de Conversão",
      value: dashboardViewModel.formatDisplayByState(vmStates.conversao, (v) => \`\${v}%\`, taxaConversao),
      subtitle: "vendas/clientes",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      indicatorState: vmStates.conversao,
      drillDownUrl: dashboardViewModel.drillDownUrls.conversao,
      link: createPageUrl("Relatorios"),
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'taxa_conversao' })
    }
  ];

  // NOVOS KPIs OPERACIONAIS (Cards)
  const opsConcluidasCount = (ordensProducao || []).filter(op => ["Concluída","Concluido","Concluida","Concluído","Finalizada","Finalizado","Encerrada","Encerrado","Pronto"].includes(op?.status)).length;
  const kpisOperacionais = [
    {
      key: "otd",
      title: "OTD (On-Time)",
      value: dashboardViewModel.formatDisplayByState(vmStates.otd, (v) => \`\${v}%\`, vmEffective.otd),
      subtitle: \`\${entregasNoPrazo.length}/\${entregasConcluidas.length} entregas\`,
      icon: CheckCircle,
      color: Number(otd) >= 90 ? "text-green-600" : Number(otd) >= 70 ? "text-orange-600" : "text-red-600",
      bgColor: Number(otd) >= 90 ? "bg-green-50" : Number(otd) >= 70 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.otd,
      drillDownUrl: dashboardViewModel.drillDownUrls.otd,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'otd_entregas' })
    },
    {
      key: "peso_produzido",
      title: "Peso Produzido",
      value: dashboardViewModel.formatDisplayByState(vmStates.producao, (v) => \`\${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg\`, vmEffective.pesoProduzido),
      subtitle: \`\${opsConcluidasCount} OPs concluídas\`,
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      indicatorState: vmStates.producao,
      drillDownUrl: dashboardViewModel.drillDownUrls.producao,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'peso_produzido' })
    },
    {
      key: "aproveitamento",
      title: "Aproveitamento",
      value: dashboardViewModel.formatDisplayByState(vmStates.aproveitamento, (v) => \`\${v}%\`, vmEffective.aproveitamentoBarra),
      subtitle: "aproveitamento de barra",
      icon: Percent,
      color: Number(aproveitamentoBarra) >= 90 ? "text-green-600" : Number(aproveitamentoBarra) >= 80 ? "text-orange-600" : "text-red-600",
      bgColor: Number(aproveitamentoBarra) >= 90 ? "bg-green-50" : Number(aproveitamentoBarra) >= 80 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.aproveitamento,
      drillDownUrl: dashboardViewModel.drillDownUrls.aproveitamento,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'aproveitamento_barra' })
    },
    {
      key: "inadimplencia",
      title: "Inadimplência",
      value: dashboardViewModel.formatDisplayByState(vmStates.inadimplencia, (v) => \`\${v}%\`, vmEffective.taxaInadimplencia),
      subtitle: \`R$ \${(vmEffective.valorVencido ?? valorVencido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencido\`,
      icon: AlertCircle,
      color: Number(taxaInadimplencia) < 5 ? "text-green-600" : Number(taxaInadimplencia) < 10 ? "text-orange-600" : "text-red-600",
      bgColor: Number(taxaInadimplencia) < 5 ? "bg-green-50" : Number(taxaInadimplencia) < 10 ? "bg-orange-50" : "bg-red-50",
      indicatorState: vmStates.inadimplencia,
      drillDownUrl: dashboardViewModel.drillDownUrls.inadimplencia,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'inadimplencia', status: 'Atrasado' })
    }
  ];

  const kpiCards = [
    {
      key: "clientes_cadastrados",
      title: "Clientes Cadastrados",
      value: !canSeeCRM ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : clientesCountPending ? 'Carregando' : totalClientes ?? 'Indisponível',
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      indicatorState: vmStates.clientesCount,
      drillDownUrl: dashboardViewModel.drillDownUrls.clientes,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'clientes_cadastrados' })
    },
    {
      key: "produtos_cadastrados",
      title: "Produtos Cadastrados",
      value: !canSeeEstoque ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : produtosCountPending ? 'Carregando' : totalProdutos ?? 'Indisponível',
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      indicatorState: vmStates.produtosCount,
      drillDownUrl: dashboardViewModel.drillDownUrls.produtos,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'estoque', kpi: 'produtos_cadastrados' })
    },
    {
      key: "colaboradores",
      title: "Colaboradores",
      value: dashboardViewModel.formatDisplayByState(vmStates.colaboradoresCount, dashboardViewModel.formatInt, vmEffective.totalColaboradores),
      icon: UserCircle,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      indicatorState: vmStates.colaboradoresCount,
      drillDownUrl: createPageUrl("RH"),
      drillDown: () => handleDrillDown(createPageUrl("RH"), { kpi: 'colaboradores_ativos' })
    },
    {
      key: "entregas_pendentes",
      title: "Entregas Pendentes",
      value: dashboardViewModel.formatDisplayByState(vmStates.entregas, dashboardViewModel.formatInt, vmEffective.entregasPendentes),
      icon: Truck,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      indicatorState: vmStates.entregas,
      drillDownUrl: dashboardViewModel.drillDownUrls.entregas,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'producao', kpi: 'entregas_pendentes' })
    },
    {
      key: "estoque_baixo",
      title: "Estoque Baixo",
      value: dashboardViewModel.formatDisplayByState(vmStates.estoqueBaixo, dashboardViewModel.formatInt, vmEffective.produtosBaixoEstoque),
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      alert: Number(vmEffective.produtosBaixoEstoque) > 0,
      indicatorState: vmStates.estoqueBaixo,
      drillDownUrl: dashboardViewModel.drillDownUrls.estoque,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'estoque', kpi: 'estoque_baixo' })
    },
    {
      key: "total_pedidos",
      title: "Total Pedidos",
      value: dashboardViewModel.formatDisplayByState(vmStates.pedidosPeriodo, dashboardViewModel.formatInt, vmEffective.pedidosPeriodoCount ?? pedidos.length),
      icon: ShoppingCart,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      indicatorState: vmStates.pedidosPeriodo,
      drillDownUrl: dashboardViewModel.drillDownUrls.pedidos,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'vendas', kpi: 'pedidos_periodo' })
    },
    {
      key: "nfe_autorizadas",
      title: "NF-e Autorizadas",
      value: dashboardViewModel.formatDisplayByState(vmStates.nfAutorizadas, dashboardViewModel.formatInt, nfAutorizadas),
      icon: FileText,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      indicatorState: vmStates.nfAutorizadas,
      drillDownUrl: createPageUrl("Fiscal"),
      drillDown: () => handleDrillDown(createPageUrl("Fiscal"), { kpi: 'nfe_autorizadas' })
    },
    {
      key: "cobrancas_pagas",
      title: "Cobranças Pagas",
      value: dashboardViewModel.formatDisplayByState(vmStates.cobrancasPagas, dashboardViewModel.formatInt, cobrancasPagas),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      indicatorState: vmStates.cobrancasPagas,
      drillDownUrl: dashboardViewModel.drillDownUrls.cobrancas,
      drillDown: () => handleDrillDown(createPageUrl("Relatorios"), { tab: 'financeiro', kpi: 'cobrancas_pagas', status: 'Recebido' })
    }
  ];`, `    const params = buildKpiDrillDownParams({
      kpi: kpiMeta.kpi || rota,
      periodo,
      status: kpiMeta.status,
      groupId,
      empresaId,
      scopeType,
    });
    const url = buildKpiDrillDownUrl(rota, params);
    auditDashboardAction('abrir_modulo_por_dashboard', { rota: url, ...params });
    navigate(url);
  };

  const statsCards = [
    {
      title: "Vendas do Período",
      value: \`R$ \${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\`,
      subtitle: \`\${pedidosPeriodo.length} pedidos\`,
      icon: DollarSign,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      link: createPageUrl("Comercial"),
      drillDown: () => handleDrillDown(createPageUrl("Comercial"), { kpi: 'vendas_periodo' })
    },
    {
      title: "Ticket Médio",
      value: \`R$ \${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\`,
      subtitle: "por pedido",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      link: createPageUrl("Comercial"),
      drillDown: () => handleDrillDown(createPageUrl("Comercial"), { kpi: 'ticket_medio' })
    },
    {
      title: "Fluxo de Caixa",
      value: \`R$ \${fluxoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\`,
      subtitle: \`\${fluxoCaixa >= 0 ? 'Positivo' : 'Negativo'}\`,
      icon: DollarSign,
      color: fluxoCaixa >= 0 ? "from-emerald-500 to-emerald-600" : "from-orange-500 to-orange-600",
      bgColor: fluxoCaixa >= 0 ? "bg-emerald-50" : "bg-orange-50",
      textColor: fluxoCaixa >= 0 ? "text-emerald-600" : "text-orange-600",
      link: createPageUrl("Financeiro"),
      drillDown: () => handleDrillDown(createPageUrl("Financeiro"))
    },
    {
      title: "Taxa de Conversão",
      value: \`\${taxaConversao}%\`,
      subtitle: "vendas/clientes",
      icon: TrendingUp,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      link: createPageUrl("Comercial"),
      drillDown: () => handleDrillDown(createPageUrl("Comercial"))
    }
  ];

  // NOVOS KPIs OPERACIONAIS (Cards)
  const opsConcluidasCount = (ordensProducao || []).filter(op => ["Concluída","Concluido","Concluida","Concluído","Finalizada","Finalizado","Encerrada","Encerrado","Pronto"].includes(op?.status)).length;
  const kpisOperacionais = [
    {
      title: "OTD (On-Time)",
      value: \`\${otd}%\`,
      subtitle: \`\${entregasNoPrazo.length}/\${entregasConcluidas.length} entregas\`,
      icon: CheckCircle,
      color: Number(otd) >= 90 ? "text-green-600" : Number(otd) >= 70 ? "text-orange-600" : "text-red-600",
      bgColor: Number(otd) >= 90 ? "bg-green-50" : Number(otd) >= 70 ? "bg-orange-50" : "bg-red-50",
      drillDown: () => handleDrillDown(createPageUrl("Expedicao"))
    },
    {
      title: "Peso Produzido",
      value: \`\${pesoProduzido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg\`,
      subtitle: \`\${opsConcluidasCount} OPs concluídas\`,
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      drillDown: () => handleDrillDown(createPageUrl("Producao"))
    },
    {
      title: "Aproveitamento",
      value: \`\${aproveitamentoBarra}%\`,
      subtitle: "aproveitamento de barra",
      icon: Percent,
      color: Number(aproveitamentoBarra) >= 90 ? "text-green-600" : Number(aproveitamentoBarra) >= 80 ? "text-orange-600" : "text-red-600",
      bgColor: Number(aproveitamentoBarra) >= 90 ? "bg-green-50" : Number(aproveitamentoBarra) >= 80 ? "bg-orange-50" : "bg-red-50",
      drillDown: () => handleDrillDown(createPageUrl("Producao"))
    },
    {
      title: "Inadimplência",
      value: \`\${taxaInadimplencia}%\`,
      subtitle: \`R$ \${valorVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencido\`,
      icon: AlertCircle,
      color: Number(taxaInadimplencia) < 5 ? "text-green-600" : Number(taxaInadimplencia) < 10 ? "text-orange-600" : "text-red-600",
      bgColor: Number(taxaInadimplencia) < 5 ? "bg-green-50" : Number(taxaInadimplencia) < 10 ? "bg-orange-50" : "bg-red-50",
      drillDown: () => handleDrillDown(createPageUrl("Financeiro"))
    }
  ];

  const kpiCards = [
    {
      title: "Clientes Cadastrados",
      value: !canSeeCRM ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : clientesCountPending ? 'Carregando' : totalClientes ?? 'Indisponível',
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      drillDown: () => handleDrillDown(createPageUrl("Comercial"))
    },
    {
      title: "Produtos Cadastrados",
      value: !canSeeEstoque ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : produtosCountPending ? 'Carregando' : totalProdutos ?? 'Indisponível',
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      drillDown: () => handleDrillDown(createPageUrl("Estoque"))
    },
    {
      title: "Colaboradores",
      value: totalColaboradoresDash,
      icon: UserCircle,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      drillDown: () => handleDrillDown(createPageUrl("RH"))
    },
    {
      title: "Entregas Pendentes",
      value: entregasPendentes,
      icon: Truck,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      drillDown: () => handleDrillDown(createPageUrl("Expedicao"))
    },
    {
      title: "Estoque Baixo",
      value: produtosBaixoEstoque,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      alert: produtosBaixoEstoque > 0,
      drillDown: () => handleDrillDown(createPageUrl("Estoque"))
    },
    {
      title: "Total Pedidos",
      value: pedidos.length,
      icon: ShoppingCart,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      drillDown: () => handleDrillDown(createPageUrl("Comercial"))
    },
    {
      title: "NF-e Autorizadas",
      value: nfAutorizadas,
      icon: FileText,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      drillDown: () => handleDrillDown(createPageUrl("Fiscal"))
    },
    {
      title: "Cobranças Pagas",
      value: cobrancasPagas,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      drillDown: () => handleDrillDown(createPageUrl("Financeiro"))
    }
  ];`);
  restoreCountHunk(`      <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4">
      <DashboardHeader
        empresaAtual={empresaAtual}
        estaNoGrupo={estaNoGrupo}
        grupoAtual={grupoAtual}
        autoRefresh={autoRefresh}
        setAutoRefresh={(value) => {
          setAutoRefresh(value);
          auditDashboardAction('alterar_auto_refresh', { ativo: value });
        }}
        periodo={periodo}
        setPeriodo={(value) => {
          setPeriodo(value);
          auditDashboardAction('alterar_periodo', { periodo: value });
        }}
        periodoRange={dashboardViewModel.periodoRange}
        onRefresh={handleRefreshAll}
        isRefreshing={isAnyDashboardFetching}
        canSeeRelatorios={canSeeRelatorios}
        onOpenRelatorios={() => handleNavigateDirect(dashboardViewModel.drillDownUrls.relatoriosGeral)}
        canSeeDashboard={canSeeDashboard}
      />

      <DashboardExecutiveTopSection
        estaNoGrupo={estaNoGrupo}
        hasContextoAtivo={hasContextoAtivo}
        groupId={groupId}
        empresaId={empresaId}
        grupoAtual={grupoAtual}
        empresaAtual={empresaAtual}
        empresasDoGrupo={empresasDoGrupo}
        alternarContexto={alternarContexto}
        canSeeDashboard={canSeeDashboard}
        canSeeComercial={canSeeComercial}
        canSeeFinanceiro={canSeeFinanceiro}
        canSeeEstoque={canSeeEstoque}
        canSeeExpedicao={canSeeExpedicao}
        canSeeProducao={canSeeProducao}
        canSeeCadastros={canSeeCadastros}
        canSeeRelatorios={canSeeRelatorios}
        viewModel={dashboardViewModel}
        anomaliasCount={Array.isArray(anomaliasIA?.details) ? anomaliasIA.details.length : null}
        onRetryAll={handleRefreshAll}
        onNavigate={handleNavigateDirect}
      />

      <ErrorBoundary>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Unificado em Resumo Geral */}
        <div className="hidden" />





        <TabsContent value="resumo" className="w-full h-full overflow-y-auto space-y-5 mt-3">
          <PanelGroup direction="vertical" className="gap-2 flex-1 w-full h-full">`, `      <div className="flex-1 overflow-hidden p-6 space-y-6">
      <DashboardHeader
        empresaAtual={empresaAtual}
        estaNoGrupo={estaNoGrupo}
        grupoAtual={grupoAtual}
        autoRefresh={autoRefresh}
        setAutoRefresh={(value) => {
          setAutoRefresh(value);
          auditDashboardAction('alterar_auto_refresh', { ativo: value });
        }}
        periodo={periodo}
        setPeriodo={(value) => {
          setPeriodo(value);
          auditDashboardAction('alterar_periodo', { periodo: value });
        }}
        canSeeDashboard={canSeeDashboard}
      />

      <ErrorBoundary>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Unificado em Resumo Geral */}
        <div className="hidden" />





        <TabsContent value="resumo" className="w-full h-full overflow-y-auto space-y-6 mt-6">
          {/* Sticky KPIs principais */}
          <div className="sticky top-0 z-20 bg-gradient-to-b from-white/80 to-white/40 backdrop-blur-sm border-b border-slate-200 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="shadow-sm rounded-md bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Faturamento</div>
                  <div className="text-sm font-semibold text-slate-900">Dia: R$ {(pedidos.filter(p=>new Date(p.data_pedido||p.created_date).toDateString()===new Date().toDateString()).reduce((s,p)=>s+(p.valor_total||0),0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                  <div className="text-xs text-slate-600">Mês: R$ {pedidos.filter(p=>{const d=new Date(p.data_pedido||p.created_date);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).reduce((s,p)=>s+(p.valor_total||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-md bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Pedidos</div>
                  <div className="text-sm font-semibold text-slate-900">Abertos: {pedidosPendentes.length}</div>
                  <div className="text-xs text-slate-600">Em aprovação: {pedidosAguardandoAprovacao.length}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-md bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Estoque crítico</div>
                  <div className="text-sm font-semibold text-slate-900">Itens: {produtosBaixoEstoque}</div>
                </CardContent>
              </Card>
            </div>
          </div>
          <PanelGroup direction="vertical" className="gap-2 flex-1 w-full h-full">`);
  restoreCountHunk('import { buildContextFilter } from "@/components/lib/cadastroCountFilter";\n', '');
  restoreCountHunk('grupoAtual, empresasDoGrupo, filterInContext,', 'grupoAtual, filterInContext,');
  restoreCountHunk(`queryKey: ['produtos-count-dash', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],`, "queryKey: ['produtos-count-dash', ...contextQueryKey],");
  restoreCountHunk("const filtro = buildContextFilter('Produto', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);",
    "const filtro = getFiltroContexto('empresa_id');");
  restoreCountHunk('const { data: totalProdutos, isPending: produtosCountPending } = useQuery({',
    'const { data: totalProdutos = 0 } = useQuery({');
  restoreCountHunk(`const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar produtos', error, { scopeType, groupId, empresaId });
        throw error;`, `return resolveDashboardCount({ countValue: response.data?.count, list: produtos }).total;
      } catch (error) {
        reportDashboardFailure('Falha ao contar produtos; usando lista carregada', error, { scopeType, groupId, empresaId });
        return resolveDashboardCount({ list: produtos }).total;`);
  restoreCountHunk(`value: !canSeeEstoque ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : produtosCountPending ? 'Carregando' : totalProdutos ?? 'Indisponível',`, 'value: totalProdutos,');
  restoreCountHunk('const { data: totalClientes, isPending: clientesCountPending } = useQuery({',
    'const { data: totalClientes = 0 } = useQuery({');
  restoreCountHunk(`queryKey: ['clientes-count', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],`, "queryKey: ['clientes-count', ...contextQueryKey],");
  restoreCountHunk("const filtro = buildContextFilter('Cliente', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);",
    "const filtro = getFiltroContexto('empresa_id', true);");
  restoreCountHunk(`const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar clientes', error, { scopeType, groupId, empresaId });
        throw error;`, `return resolveDashboardCount({ countValue: response.data?.count, list: clientes }).total;
      } catch (error) {
        reportDashboardFailure('Falha ao contar clientes; usando lista carregada', error, { scopeType, groupId, empresaId });
        return resolveDashboardCount({ list: clientes }).total;`);
  restoreCountHunk('    taxaConversao,', '    clientesAtivos,\n    taxaConversao,');
  restoreCountHunk(`title: "Clientes Cadastrados",
      value: !canSeeCRM ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : clientesCountPending ? 'Carregando' : totalClientes ?? 'Indisponível',`, `title: "Clientes Ativos",
      value: clientesAtivos,`);
  return text;
}
