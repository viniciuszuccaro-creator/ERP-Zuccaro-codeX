/** Cache key canônica: namespace + Grupo + Empresa + ator + fingerprint de sessão (sem token). */
export function buildFechamentoQueryKey(namespace, {
  groupId = null,
  empresaId = null,
  actorId = null,
  sessionKey = null,
  extra = null,
} = {}) {
  const key = [namespace, groupId || null, empresaId || null, actorId || null, sessionKey || null];
  if (extra != null) key.push(extra);
  return key;
}

/**
 * Descarta resposta tardia quando ator/sessão mudou durante o fetch.
 * @returns {boolean}
 */
export function isFechamentoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * KPI: loading/erro/sem contexto nunca viram zero.
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveFechamentoKpiState({
  contextoValido,
  isLoading,
  isError,
  isFetching,
  dataDefined,
} = {}) {
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
