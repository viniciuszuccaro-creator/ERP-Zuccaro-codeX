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
 * KPI: pedidos/contagens pendentes ou em falha nunca viram zero.
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
