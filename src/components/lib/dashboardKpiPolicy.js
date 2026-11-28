const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** Soft cap used by list-based KPI loads — totals from a full page are unreliable when hit. */
export const DASHBOARD_LIST_SOFT_LIMIT = 9999;
export const DASHBOARD_REALTIME_LIMIT = 500;

/**
 * @param {{ groupId?: string | null, empresaId?: string | null, scopeType?: string }} [context]
 */
export const assertDashboardContext = ({ groupId, empresaId, scopeType = 'empresa' } = {}) => {
  if (!firstText(groupId)) {
    throw new Error('Grupo obrigatorio para dashboard.');
  }
  if (scopeType !== 'grupo' && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para dashboard no escopo empresa.');
  }
  return true;
};

/**
 * @param {{
 *   scopeType?: string,
 *   groupId?: string | null,
 *   requestedEmpresaId?: string | null,
 *   currentEmpresa?: { id?: string, group_id?: string, grupo_id?: string } | null,
 *   groupCompanies?: Array<{ id?: string, group_id?: string, grupo_id?: string }>,
 * }} [input]
 */
export const resolveRealtimeDashboardScope = ({
  scopeType = 'empresa',
  groupId = null,
  requestedEmpresaId = null,
  currentEmpresa = null,
  groupCompanies = [],
} = {}) => {
  const normalizedGroupId = firstText(groupId);
  const normalizedScope = scopeType === 'grupo' ? 'grupo' : 'empresa';
  if (!normalizedGroupId) {
    return { valid: false, error: 'Grupo obrigatorio para dashboard.', groupId: null, empresaId: null, scopeType: normalizedScope };
  }
  if (normalizedScope === 'grupo') {
    return { valid: true, error: '', groupId: normalizedGroupId, empresaId: null, scopeType: normalizedScope };
  }

  const empresaId = firstText(requestedEmpresaId, currentEmpresa?.id);
  if (!empresaId) {
    return { valid: false, error: 'Empresa obrigatoria para dashboard no escopo empresa.', groupId: normalizedGroupId, empresaId: null, scopeType: normalizedScope };
  }
  const currentEmpresaGroupId = firstText(currentEmpresa?.group_id, currentEmpresa?.grupo_id);
  const currentAllowed = currentEmpresa?.id === empresaId && currentEmpresaGroupId === normalizedGroupId;
  const listedAllowed = (Array.isArray(groupCompanies) ? groupCompanies : []).some((empresa) => (
    empresa?.id === empresaId && firstText(empresa?.group_id, empresa?.grupo_id, normalizedGroupId) === normalizedGroupId
  ));
  if (!currentAllowed && !listedAllowed) {
    return { valid: false, error: 'Empresa nao pertence ao Grupo selecionado.', groupId: normalizedGroupId, empresaId: null, scopeType: normalizedScope };
  }
  return { valid: true, error: '', groupId: normalizedGroupId, empresaId, scopeType: normalizedScope };
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

/** @param {{ countValue?: unknown, list?: any[], softLimit?: number }} [input] */
export const resolveDashboardCount = ({ countValue, list = [], softLimit = DASHBOARD_LIST_SOFT_LIMIT } = {}) => {
  const counted = typeof countValue === 'number' || (typeof countValue === 'string' && countValue.trim())
    ? Number(countValue) : NaN;
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

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PERIOD_LABELS = {
  dia: 'Hoje',
  semana: 'Últimos 7 dias',
  mes: 'Este Mês',
  trimestre: 'Trimestre',
  ano: 'Este Ano',
};

/**
 * Resolve intervalo ISO (YYYY-MM-DD) idêntico para Dashboard e Relatórios.
 * @param {string} [periodo]
 * @param {Date | string | number} [referenceDate]
 */
export const resolveDashboardPeriodRange = (periodo = 'mes', referenceDate = new Date()) => {
  const normalized = PERIOD_LABELS[periodo] ? periodo : 'mes';
  const ref = referenceDate instanceof Date ? new Date(referenceDate.getTime()) : new Date(referenceDate);
  const hoje = Number.isNaN(ref.getTime()) ? new Date() : ref;
  const end = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let start = new Date(end.getTime());

  if (normalized === 'semana') {
    start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (normalized === 'mes') {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (normalized === 'trimestre') {
    const firstMonth = Math.floor(end.getMonth() / 3) * 3;
    start = new Date(end.getFullYear(), firstMonth, 1);
  } else if (normalized === 'ano') {
    start = new Date(end.getFullYear(), 0, 1);
  }

  return {
    periodo: normalized,
    label: PERIOD_LABELS[normalized],
    data_inicio: toIsoDate(start),
    data_fim: toIsoDate(end),
  };
};

export const resolveDashboardReportFiltersFromSearch = (search = '') => {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const origem = firstText(params.get('origem'));
  const periodoParam = firstText(params.get('periodo'));
  const range = periodoParam ? resolveDashboardPeriodRange(periodoParam) : null;
  const dataInicioParam = firstText(params.get('data_inicio'));
  const dataFimParam = firstText(params.get('data_fim'));
  const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  return {
    fromDashboard: origem === 'dashboard',
    origem: origem || null,
    tab: firstText(params.get('tab')) || null,
    kpi: firstText(params.get('kpi')) || null,
    periodo: range?.periodo || null,
    periodoLabel: range?.label || null,
    data_inicio: isIsoDate(dataInicioParam) ? dataInicioParam : (range?.data_inicio || null),
    data_fim: isIsoDate(dataFimParam) ? dataFimParam : (range?.data_fim || null),
    status: firstText(params.get('status')) || null,
    group_id: firstText(params.get('group_id')) || null,
    empresa_id: firstText(params.get('empresa_id')) || null,
    scopeType: firstText(params.get('scopeType')) || null,
  };
};

/**
 * Classifica o estado canônico de um indicador do Dashboard (fail-closed):
 * nunca confunde erro/indisponível/sem acesso/carregando com zero confirmado.
 * @param {{
 *   hasContext?: boolean,
 *   hasPermission?: boolean,
 *   isLoading?: boolean,
 *   isError?: boolean,
 *   value?: number | string | null,
 *   isPartial?: boolean,
 *   isAggregateOfficial?: boolean,
 * }} [input]
 */
export const resolveIndicatorState = ({
  hasContext = true,
  hasPermission = true,
  isLoading = false,
  isError = false,
  value = null,
  isPartial = false,
  isAggregateOfficial = false,
} = {}) => {
  if (!hasContext) {
    return { state: 'sem_contexto', label: 'Selecione contexto', isZeroConfirmed: false, isPartial: false, isAggregateOfficial: false };
  }
  if (!hasPermission) {
    return { state: 'sem_acesso', label: 'Sem acesso', isZeroConfirmed: false, isPartial: false, isAggregateOfficial: false };
  }
  if (isLoading) {
    return { state: 'carregando', label: 'Carregando...', isZeroConfirmed: false, isPartial: false, isAggregateOfficial: false };
  }
  if (isError || value === null || value === undefined || value === '') {
    return { state: 'erro', label: 'Indisponível', isZeroConfirmed: false, isPartial: false, isAggregateOfficial: false };
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { state: 'erro', label: 'Indisponível', isZeroConfirmed: false, isPartial: false, isAggregateOfficial: false };
  }
  if (numeric === 0) {
    return { state: 'zero_confirmado', label: 'Zero confirmado', isZeroConfirmed: true, isPartial: Boolean(isPartial), isAggregateOfficial: Boolean(isAggregateOfficial) };
  }
  return { state: 'ok', label: 'Confirmado', isZeroConfirmed: false, isPartial: Boolean(isPartial), isAggregateOfficial: Boolean(isAggregateOfficial) };
};

/**
 * Adaptador para o contrato oficial de agregados de período do backend Codex
 * (ex.: GET /api/v1/dashboard/aggregates ou invoke('dashboardAggregates')).
 * Retorna null quando ausente ou inválido (mantendo modo fail-closed / derivado transparente).
 * @param {any} payload
 */
export const normalizeDashboardAggregateContract = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const operational = payload.operational && typeof payload.operational === 'object' ? payload.operational : null;
  const counts = payload.counts && typeof payload.counts === 'object' ? payload.counts : null;
  if (!operational && !counts) return null;

  const numOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    contractVersion: firstText(payload.contractVersion, payload.version, 'v1'),
    source: 'backend_aggregate',
    generatedAt: firstText(payload.generatedAt, payload.generated_at) || null,
    scope: payload.scope && typeof payload.scope === 'object' ? {
      groupId: firstText(payload.scope.groupId, payload.scope.group_id) || null,
      empresaId: firstText(payload.scope.empresaId, payload.scope.empresa_id) || null,
      scopeType: firstText(payload.scope.scopeType, payload.scope.scope_type) || 'empresa',
    } : null,
    period: payload.period && typeof payload.period === 'object' ? {
      periodo: firstText(payload.period.periodo) || 'mes',
      data_inicio: firstText(payload.period.data_inicio) || null,
      data_fim: firstText(payload.period.data_fim) || null,
    } : null,
    counts: counts ? {
      Cliente: numOrNull(counts.Cliente ?? counts.clientes),
      Produto: numOrNull(counts.Produto ?? counts.produtos),
      Colaborador: numOrNull(counts.Colaborador ?? counts.colaboradores),
      Fornecedor: numOrNull(counts.Fornecedor ?? counts.fornecedores),
    } : null,
    operational: operational ? {
      totalVendas: numOrNull(operational.totalVendas ?? operational.total_vendas),
      pedidosPeriodoCount: numOrNull(operational.pedidosPeriodoCount ?? operational.pedidos_periodo_count),
      pedidosValidosCount: numOrNull(operational.pedidosValidosCount ?? operational.pedidos_validos_count),
      pedidosAguardandoAprovacao: numOrNull(operational.pedidosAguardandoAprovacao ?? operational.pedidos_aguardando_aprovacao),
      ticketMedio: numOrNull(operational.ticketMedio ?? operational.ticket_medio),
      receitasPendentes: numOrNull(operational.receitasPendentes ?? operational.receitas_pendentes),
      despesasPendentes: numOrNull(operational.despesasPendentes ?? operational.despesas_pendentes),
      fluxoCaixa: numOrNull(operational.fluxoCaixa ?? operational.fluxo_caixa),
      produtosBaixoEstoque: numOrNull(operational.produtosBaixoEstoque ?? operational.produtos_baixo_estoque),
      entregasPendentes: numOrNull(operational.entregasPendentes ?? operational.entregas_pendentes),
      otd: numOrNull(operational.otd),
      pesoProduzido: numOrNull(operational.pesoProduzido ?? operational.peso_produzido),
      aproveitamentoBarra: numOrNull(operational.aproveitamentoBarra ?? operational.aproveitamento_barra),
      taxaInadimplencia: numOrNull(operational.taxaInadimplencia ?? operational.taxa_inadimplencia),
      valorVencido: numOrNull(operational.valorVencido ?? operational.valor_vencido),
    } : null,
  };
};

export const buildKpiDrillDownParams = ({
  tab = '',
  kpi = '',
  periodo = 'mes',
  status = '',
  groupId = null,
  empresaId = null,
  scopeType = 'empresa',
  referenceDate = new Date(),
} = {}) => {
  const range = resolveDashboardPeriodRange(periodo, referenceDate);
  return {
    tab: firstText(tab) || undefined,
    origem: 'dashboard',
    kpi: firstText(kpi),
    periodo: range.periodo,
    data_inicio: range.data_inicio,
    data_fim: range.data_fim,
    status: firstText(status) || undefined,
    group_id: firstText(groupId) || undefined,
    empresa_id: firstText(empresaId) || undefined,
    scopeType: firstText(scopeType) || 'empresa',
  };
};

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

export const isDashboardReceivableOverdue = (conta, referenceDate = new Date()) => {
  if (!conta) return false;
  if (String(conta.status || '').toLowerCase() === 'atrasado') return true;
  if (conta.status !== 'Pendente' || !conta.data_vencimento) return false;
  const due = new Date(conta.data_vencimento);
  if (Number.isNaN(due.getTime())) return false;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return due < ref;
};

export const filterFinancialReportItems = (
  lista = [],
  {
    campo = 'data_vencimento',
    data_inicio = '',
    data_fim = '',
    status = null,
    kpi = null,
    kind = 'receber',
    referenceDate = new Date(),
  } = {},
) => {
  const rows = Array.isArray(lista) ? lista : [];
  if (kpi === 'inadimplencia' && kind === 'receber') {
    return rows.filter((item) => isDashboardReceivableOverdue(item, referenceDate));
  }
  if (kpi === 'contas_receber' && kind === 'receber') {
    return rows.filter((item) => String(item?.status || '').toLowerCase() === 'pendente');
  }
  if (kpi === 'contas_pagar' && kind === 'pagar') {
    return rows.filter((item) => String(item?.status || '').toLowerCase() === 'pendente');
  }

  const ini = data_inicio ? new Date(data_inicio) : null;
  const fim = data_fim ? new Date(`${data_fim}T23:59:59`) : null;
  const expectedStatus = status ? String(status).toLowerCase() : null;

  return rows.filter((item) => {
    const rawDate = item?.[campo] || item?.created_date;
    const d = new Date(rawDate);
    if (ini && !Number.isNaN(ini.getTime()) && !(d >= ini)) return false;
    if (fim && !Number.isNaN(fim.getTime()) && !(d <= fim)) return false;
    if (expectedStatus && String(item?.status || '').toLowerCase() !== expectedStatus) return false;
    return true;
  });
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
  const pedidosValidosPeriodo = pedidosPeriodo.filter((p) => p.status !== 'Cancelado');
  const pedidosAguardandoAprovacao = pedidosPeriodo.filter((p) => p.status === 'Aguardando Aprovação').length;
  const totalVendas = pedidosValidosPeriodo
    .reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const ticketMedio = pedidosValidosPeriodo.length > 0 ? totalVendas / pedidosValidosPeriodo.length : 0;
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
  const contasVencidas = (contasReceber || []).filter((c) => isDashboardReceivableOverdue(c));
  const valorVencido = contasVencidas.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalContas = (contasReceber || [])
    .filter((c) => c.status === 'Pendente' || String(c.status || '').toLowerCase() === 'atrasado')
    .reduce((sum, c) => sum + (c.valor || 0), 0);
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
    pedidosValidosPeriodo,
    pedidosAguardandoAprovacao,
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
