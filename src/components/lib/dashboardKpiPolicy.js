const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** Soft cap used by list-based KPI loads — totals from a full page are unreliable when hit. */
export const DASHBOARD_LIST_SOFT_LIMIT = 9999;
export const DASHBOARD_REALTIME_LIMIT = 500;

export const assertDashboardContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para dashboard.');
  }
  if (scopeType !== 'grupo' && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para dashboard no escopo empresa.');
  }
  return true;
};

export const buildDashboardQueryKey = ({
  prefix = 'dashboard',
  userId = null,
  groupId = null,
  empresaId = null,
  scopeType = 'empresa',
  periodo = null,
  extra = [],
} = {}) => ([
  prefix,
  firstText(userId) || 'anon',
  firstText(scopeType) || 'empresa',
  firstText(groupId) || 'sem-grupo',
  firstText(empresaId) || 'sem-empresa',
  ...(periodo ? [periodo] : []),
  ...(Array.isArray(extra) ? extra : []),
]);

export const isCappedListUnreliable = (list = [], softLimit = DASHBOARD_LIST_SOFT_LIMIT) => (
  Array.isArray(list) && list.length >= softLimit
);

export const resolveDashboardCount = ({ countValue, list = [], softLimit = DASHBOARD_LIST_SOFT_LIMIT } = {}) => {
  const counted = Number(countValue);
  if (Number.isFinite(counted) && counted >= 0) {
    return { total: counted, fonte: 'count', confiavel: true };
  }
  const len = Array.isArray(list) ? list.length : 0;
  return {
    total: len,
    fonte: 'lista',
    confiavel: !isCappedListUnreliable(list, softLimit),
  };
};

export const filtrarPorPeriodoDashboard = (data, periodo = 'mes') => {
  if (!data) return false;
  const hoje = new Date();
  const dataComparacao = new Date(data);
  if (Number.isNaN(dataComparacao.getTime())) return false;

  if (periodo === 'dia') {
    return dataComparacao.toDateString() === hoje.toDateString();
  }
  if (periodo === 'semana') {
    const semanaAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
    return dataComparacao >= semanaAtras && dataComparacao <= hoje;
  }
  if (periodo === 'mes') {
    return dataComparacao.getMonth() === hoje.getMonth()
      && dataComparacao.getFullYear() === hoje.getFullYear();
  }
  if (periodo === 'trimestre') {
    const trimestre = Math.floor(hoje.getMonth() / 3);
    const trimestreData = Math.floor(dataComparacao.getMonth() / 3);
    return trimestreData === trimestre && dataComparacao.getFullYear() === hoje.getFullYear();
  }
  if (periodo === 'ano') {
    return dataComparacao.getFullYear() === hoje.getFullYear();
  }
  return true;
};

export const buildKpiDrillDownParams = ({
  kpi = '',
  periodo = 'mes',
  status = '',
  groupId = null,
  empresaId = null,
  scopeType = 'empresa',
} = {}) => ({
  origem: 'dashboard',
  kpi: firstText(kpi),
  periodo: firstText(periodo) || 'mes',
  status: firstText(status) || undefined,
  group_id: firstText(groupId) || undefined,
  empresa_id: firstText(empresaId) || undefined,
  scopeType: firstText(scopeType) || 'empresa',
});

export const buildKpiDrillDownUrl = (basePath, params = {}) => {
  const path = firstText(basePath) || '/';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
};

export const buildVendasPorMesFromPedidos = (pedidos = []) => {
  const meses = {};
  const year = new Date().getFullYear();
  (Array.isArray(pedidos) ? pedidos : []).forEach((p) => {
    if (p.status === 'Cancelado' || !p.data_pedido) return;
    const date = new Date(p.data_pedido);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
    const mesKey = date.toLocaleDateString('pt-BR', { month: 'short' });
    if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, valor: 0 };
    meses[mesKey].valor += Number(p.valor_total || 0) || 0;
  });
  const monthOrder = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return Object.values(meses).sort((a, b) => (
    monthOrder.indexOf(String(a.mes || '').toLowerCase().replace('.', ''))
    - monthOrder.indexOf(String(b.mes || '').toLowerCase().replace('.', ''))
  ));
};

export const resolveMetaOperacional = ({ entregasHoje = 0, valorHoje = 0 } = {}) => {
  const entregasDia = Math.max(entregasHoje, 1);
  const valorDia = Math.max(valorHoje, 1);
  return {
    entregasDia,
    valorDia,
    fonte: 'derivada_do_dia',
  };
};

export const computeRealtimeKpisFromStores = ({
  pedidos = [],
  contas = [],
  ops = [],
  entregas = [],
} = {}) => {
  const hoje = new Date().toISOString().split('T')[0];
  const pedidosHoje = (pedidos || []).filter((p) => {
    const data = String(p.data_pedido || p.created_date || '').split('T')[0];
    return data === hoje;
  });
  const valorPedidosHoje = pedidosHoje.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const contasVencendoHoje = (contas || []).filter((c) => c.data_vencimento === hoje && c.status === 'Pendente');
  const valorAReceberHoje = contasVencendoHoje.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
  const opsEmAndamento = (ops || []).filter((op) => (
    ['Liberada', 'Em Corte', 'Em Dobra', 'Em Armação', 'Em Produção', 'Produzindo'].includes(op.status)
  ));
  const mediaPercentualConclusao = opsEmAndamento.length > 0
    ? opsEmAndamento.reduce((sum, op) => sum + (op.percentual_conclusao || 0), 0) / opsEmAndamento.length
    : 0;
  const entregasHoje = (entregas || []).filter((e) => {
    const prev = e.data_previsao || e.data_prevista;
    const entrega = e.data_entrega || e.data_entrega_real;
    return prev === hoje || (entrega && String(entrega).split('T')[0] === hoje);
  });
  const entregasPendentes = entregasHoje.filter((e) => (
    ['Aguardando Separação', 'Em Separação', 'Pronto para Expedir', 'Saiu para Entrega', 'Em Trânsito'].includes(e.status)
  )).length;
  const entregasRealizadas = entregasHoje.filter((e) => e.status === 'Entregue').length;

  return {
    pedidos: {
      hoje: pedidosHoje.length,
      valorHoje: valorPedidosHoje,
      aguardandoAprovacao: (pedidos || []).filter((p) => p.status === 'Aguardando Aprovação').length,
      emProducao: (pedidos || []).filter((p) => p.status === 'Em Produção').length,
      amostraLimitada: isCappedListUnreliable(pedidos, DASHBOARD_REALTIME_LIMIT),
    },
    financeiro: {
      vencendoHoje: contasVencendoHoje.length,
      valorHoje: valorAReceberHoje,
      atrasados: (contas || []).filter((c) => c.status === 'Atrasado').length,
      recebidosHoje: (contas || []).filter((c) => String(c.data_recebimento || '').split('T')[0] === hoje).length,
      amostraLimitada: isCappedListUnreliable(contas, DASHBOARD_REALTIME_LIMIT),
    },
    producao: {
      opsEmAndamento: opsEmAndamento.length,
      percentualMedio: Math.round(mediaPercentualConclusao),
      opsAtrasadas: (ops || []).filter((op) => {
        if (!op.data_prevista_conclusao) return false;
        const previsao = new Date(op.data_prevista_conclusao);
        return previsao < new Date() && !['Finalizada', 'Cancelada'].includes(op.status);
      }).length,
      opsFinalizadasHoje: (ops || []).filter((op) => String(op.data_conclusao_real || '').split('T')[0] === hoje).length,
      amostraLimitada: isCappedListUnreliable(ops, DASHBOARD_REALTIME_LIMIT),
    },
    expedicao: {
      entregasHoje: entregasHoje.length,
      pendentes: entregasPendentes,
      realizadas: entregasRealizadas,
      emRota: (entregas || []).filter((e) => ['Saiu para Entrega', 'Em Trânsito'].includes(e.status)).length,
      amostraLimitada: isCappedListUnreliable(entregas, DASHBOARD_REALTIME_LIMIT),
    },
    ultimaAtualizacao: new Date().toISOString(),
  };
};

export const computeDashboardDerivedKpis = ({
  pedidos = [],
  contasReceber = [],
  contasPagar = [],
  entregas = [],
  ordensProducao = [],
  colaboradores = [],
  clientes = [],
  produtos = [],
  periodo = 'mes',
} = {}) => {
  const inPeriodo = (data) => filtrarPorPeriodoDashboard(data, periodo);
  const pedidosPeriodo = (pedidos || []).filter((p) => p.data_pedido && inPeriodo(p.data_pedido));
  const totalVendas = pedidosPeriodo
    .filter((p) => p.status !== 'Cancelado')
    .reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const ticketMedio = pedidosPeriodo.length > 0 ? totalVendas / pedidosPeriodo.length : 0;
  const receitasPendentes = (contasReceber || [])
    .filter((c) => c.status === 'Pendente')
    .reduce((sum, c) => sum + (c.valor || 0), 0);
  const despesasPendentes = (contasPagar || [])
    .filter((c) => c.status === 'Pendente')
    .reduce((sum, c) => sum + (c.valor || 0), 0);
  const fluxoCaixa = receitasPendentes - despesasPendentes;
  const produtosBaixoEstoque = (produtos || []).filter(
    (p) => p.estoque_atual <= p.estoque_minimo && p.status === 'Ativo',
  ).length;
  const colaboradoresAtivos = (colaboradores || []).filter((c) => (c.status || 'Ativo') !== 'Inativo' && (c.status || 'Ativo') !== 'Afastado').length;
  const clientesAtivos = (clientes || []).filter((c) => (c.status || 'Ativo') !== 'Inativo' && (c.status || 'Ativo') !== 'Bloqueado').length;
  const taxaConversao = clientesAtivos > 0
    ? ((pedidosPeriodo.filter((p) => p.status !== 'Cancelado').length / clientesAtivos) * 100).toFixed(1)
    : 0;
  const entregasPendentes = (entregas || []).filter((e) => e.status !== 'Entregue' && e.status !== 'Devolvido').length;
  const entregasConcluidas = (entregas || []).filter((e) => e.status === 'Entregue' && e.data_entrega);
  const entregasNoPrazo = entregasConcluidas.filter((e) => {
    if (!e.data_previsao || !e.data_entrega) return false;
    return new Date(e.data_entrega) <= new Date(e.data_previsao);
  });
  const otd = entregasConcluidas.length > 0
    ? ((entregasNoPrazo.length / entregasConcluidas.length) * 100).toFixed(1)
    : 0;
  const opsConcluidas = (ordensProducao || []).filter(
    (op) => op.status === 'Concluída' && op.data_conclusao_real && inPeriodo(op.data_conclusao_real),
  );
  const pesoProduzido = opsConcluidas.reduce((sum, op) => (
    sum + ((op.quantidade_produzida || 0) * (op.peso_unitario_kg || 0))
  ), 0);
  const opsNoPeriodo = (ordensProducao || []).filter((op) => op.data_emissao && inPeriodo(op.data_emissao));
  const totalPlanejado = opsNoPeriodo.reduce((sum, op) => sum + (op.quantidade_planejada || 0), 0);
  const totalProduzido = opsNoPeriodo.reduce((sum, op) => sum + (op.quantidade_produzida || 0), 0);
  const totalRefugado = opsNoPeriodo.reduce((sum, op) => sum + (op.quantidade_refugada || 0), 0);
  const aproveitamentoBarra = totalPlanejado > 0
    ? (((totalProduzido - totalRefugado) / totalPlanejado) * 100).toFixed(1)
    : 0;
  const contasVencidas = (contasReceber || []).filter((c) => {
    if (c.status !== 'Pendente' || !c.data_vencimento) return false;
    return new Date(c.data_vencimento) < new Date();
  });
  const valorVencido = contasVencidas.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalContas = (contasReceber || []).filter((c) => c.status === 'Pendente').reduce((sum, c) => sum + (c.valor || 0), 0);
  const taxaInadimplencia = totalContas > 0 ? ((valorVencido / totalContas) * 100).toFixed(1) : 0;

  const vendasPorStatus = pedidosPeriodo.reduce((acc, p) => {
    const status = p.status || 'Indefinido';
    if (!acc[status]) acc[status] = { nome: status, valor: 0, quantidade: 0 };
    acc[status].valor += p.valor_total || 0;
    acc[status].quantidade += 1;
    return acc;
  }, {});

  const vendasUltimos30Dias = Array.from({ length: 30 }, (_, i) => {
    const data = new Date();
    data.setDate(data.getDate() - (29 - i));
    const dataStr = data.toISOString().split('T')[0];
    const vendasDia = (pedidos || [])
      .filter((p) => p.data_pedido === dataStr && p.status !== 'Cancelado')
      .reduce((sum, p) => sum + (p.valor_total || 0), 0);
    return { dia: `${data.getDate()}/${data.getMonth() + 1}`, valor: vendasDia };
  });

  const fluxo7Dias = Array.from({ length: 7 }, (_, i) => {
    const data = new Date();
    data.setDate(data.getDate() - (6 - i));
    const dataStr = data.toISOString().split('T')[0];
    const recebimentos = (contasReceber || [])
      .filter((c) => c.data_recebimento === dataStr)
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    const pagamentos = (contasPagar || [])
      .filter((c) => c.data_pagamento === dataStr)
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    return { dia: `${data.getDate()}/${data.getMonth() + 1}`, receitas: recebimentos, despesas: pagamentos, saldo: recebimentos - pagamentos };
  });

  const produtosComMovimento = (pedidos || [])
    .filter((p) => p.itens && p.data_pedido && inPeriodo(p.data_pedido))
    .flatMap((p) => p.itens || [])
    .reduce((acc, item) => {
      const key = item.descricao;
      if (!acc[key]) acc[key] = { nome: key, quantidade: 0, valor: 0 };
      acc[key].quantidade += item.quantidade || 0;
      acc[key].valor += item.valor_total || 0;
      return acc;
    }, {});

  const vendasPorMesData = (() => {
    const meses = {};
    (pedidos || []).forEach((p) => {
      if (p.status !== 'Cancelado' && p.data_pedido) {
        const date = new Date(p.data_pedido);
        if (date.toString() !== 'Invalid Date' && date.getFullYear() === new Date().getFullYear()) {
          const mesKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, valor: 0 };
          meses[mesKey].valor += p.valor_total || 0;
        }
      }
    });
    const monthOrder = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return Object.values(meses).sort((a, b) => {
      const [aMonthStr, aYearStr] = a.mes.split('/');
      const [bMonthStr, bYearStr] = b.mes.split('/');
      const aMonthIdx = monthOrder.indexOf(aMonthStr.toLowerCase());
      const bMonthIdx = monthOrder.indexOf(bMonthStr.toLowerCase());
      const aYear = parseInt(aYearStr, 10) + 2000;
      const bYear = parseInt(bYearStr, 10) + 2000;
      if (aYear !== bYear) return aYear - bYear;
      return aMonthIdx - bMonthIdx;
    });
  })();

  const top5ClientesData = (() => {
    const porCliente = {};
    (pedidos || []).forEach((p) => {
      if (p.status !== 'Cancelado' && p.cliente_nome) {
        if (!porCliente[p.cliente_nome]) porCliente[p.cliente_nome] = 0;
        porCliente[p.cliente_nome] += p.valor_total || 0;
      }
    });
    return Object.entries(porCliente)
      .map(([cliente, valor]) => ({ cliente, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  })();

  const statusPedidosDataAll = (() => {
    const porStatus = {};
    (pedidos || []).forEach((p) => {
      const status = p.status || 'Indefinido';
      if (!porStatus[status]) porStatus[status] = 0;
      porStatus[status] += 1;
    });
    return Object.entries(porStatus).map(([status, quantidade]) => ({ status, quantidade }));
  })();

  const fluxoCaixaMensalData = (() => {
    const meses = {};
    const currentYear = new Date().getFullYear();
    const getMonthKey = (dateString) => {
      const date = new Date(dateString);
      if (date.toString() === 'Invalid Date') return null;
      if (date.getFullYear() !== currentYear) return null;
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    };
    (contasReceber || [])
      .filter((c) => c.status === 'Recebido' && c.data_recebimento)
      .forEach((c) => {
        const mesKey = getMonthKey(c.data_recebimento);
        if (mesKey) {
          if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, entradas: 0, saidas: 0 };
          meses[mesKey].entradas += c.valor_recebido || c.valor || 0;
        }
      });
    (contasPagar || [])
      .filter((c) => c.status === 'Pago' && c.data_pagamento)
      .forEach((c) => {
        const mesKey = getMonthKey(c.data_pagamento);
        if (mesKey) {
          if (!meses[mesKey]) meses[mesKey] = { mes: mesKey, entradas: 0, saidas: 0 };
          meses[mesKey].saidas += c.valor_pago || c.valor || 0;
        }
      });
    const monthOrder = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return Object.values(meses).sort((a, b) => {
      const [aMonthStr, aYearStr] = a.mes.split('/');
      const [bMonthStr, bYearStr] = b.mes.split('/');
      const aMonthIdx = monthOrder.indexOf(aMonthStr.toLowerCase());
      const bMonthIdx = monthOrder.indexOf(bMonthStr.toLowerCase());
      const aYear = parseInt(aYearStr, 10) + 2000;
      const bYear = parseInt(bYearStr, 10) + 2000;
      if (aYear !== bYear) return aYear - bYear;
      return aMonthIdx - bMonthIdx;
    });
  })();

  return {
    pedidosPeriodo,
    totalVendas,
    ticketMedio,
    receitasPendentes,
    despesasPendentes,
    fluxoCaixa,
    produtosBaixoEstoque,
    colaboradoresAtivos,
    clientesAtivos,
    taxaConversao,
    entregasPendentes,
    otd,
    entregasNoPrazo,
    entregasConcluidas,
    pesoProduzido,
    aproveitamentoBarra,
    taxaInadimplencia,
    valorVencido,
    dadosVendasStatus: Object.values(vendasPorStatus),
    vendasUltimos30Dias,
    fluxo7Dias,
    topProdutos: Object.values(produtosComMovimento).sort((a, b) => b.valor - a.valor).slice(0, 5),
    vendasPorMesData,
    top5ClientesData,
    statusPedidosDataAll,
    fluxoCaixaMensalData,
    amostraLimitada: isCappedListUnreliable(pedidos) || isCappedListUnreliable(contasReceber),
  };
};
