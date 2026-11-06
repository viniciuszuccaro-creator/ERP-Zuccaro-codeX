/** Cache key canônica: Grupo + Empresa + ator + fingerprint de sessão (sem token). */
export function buildParametrosOrigemQueryKey(input) {
  const groupId = input?.groupId ?? null;
  const empresaId = input?.empresaId ?? null;
  const actorId = input?.actorId ?? null;
  const sessionKey = input?.sessionKey ?? null;
  return ['parametros-origem-pedido', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildPedidosUltimosOrigemQueryKey(input) {
  const groupId = input?.groupId ?? null;
  const empresaId = input?.empresaId ?? null;
  const actorId = input?.actorId ?? null;
  const sessionKey = input?.sessionKey ?? null;
  return ['pedidos-ultimos', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

/**
 * Descarta resposta tardia quando ator/sessão mudou durante o fetch.
 * @returns {boolean} true se ainda é o escopo esperado
 */
export function isParametrosOrigemScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * KPI de parâmetros (lista de canais): pendente/erro nunca vira zero.
 * @param {object} [input]
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveParametrosOrigemKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const podeVer = Boolean(input?.podeVer);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !podeVer) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

/**
 * KPI agregado de métricas de Pedido (#544): só ready quando parâmetros E pedidos
 * estão válidos. Pedido pendente/erro ≠ zero em card/export/insight.
 * @param {object} [input]
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveParametrosOrigemMetricasKpiState(input) {
  const paramsState = resolveParametrosOrigemKpiState({
    contextoValido: input?.contextoValido,
    podeVer: input?.podeVer,
    isLoading: input?.isLoading,
    isError: input?.isError,
    isFetching: input?.isFetching,
    dataDefined: input?.dataDefined,
  });
  if (paramsState !== 'ready') return paramsState;

  const pedidosIsError = Boolean(input?.pedidosIsError);
  const pedidosIsLoading = Boolean(input?.pedidosIsLoading);
  const pedidosIsFetching = Boolean(input?.pedidosIsFetching);
  const pedidosDataDefined = Boolean(input?.pedidosDataDefined);
  if (pedidosIsError) return 'error';
  if (pedidosIsLoading || (pedidosIsFetching && !pedidosDataDefined)) return 'loading';
  return 'ready';
}

/** Export/insight só quando métricas de Pedido estão ready. */
export function canExportParametrosOrigemMetricas(metricasKpiState) {
  return metricasKpiState === 'ready';
}
