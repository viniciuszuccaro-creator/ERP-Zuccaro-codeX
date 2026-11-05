/** Cache key canônica: Grupo + Empresa + ator + fingerprint de sessão (sem token). */
export function buildParametrosOrigemQueryKey({
  groupId = null,
  empresaId = null,
  actorId = null,
  sessionKey = null,
} = {}) {
  return ['parametros-origem-pedido', groupId || null, empresaId || null, actorId || null, sessionKey || null];
}

export function buildPedidosUltimosOrigemQueryKey({
  groupId = null,
  empresaId = null,
  actorId = null,
  sessionKey = null,
} = {}) {
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
 * KPI: pedidos/contagens pendentes ou em falha nunca viram zero.
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveParametrosOrigemKpiState({
  contextoValido,
  podeVer,
  isLoading,
  isError,
  isFetching,
  dataDefined,
} = {}) {
  if (!contextoValido || !podeVer) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
