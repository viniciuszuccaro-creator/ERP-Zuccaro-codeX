/** Cache key canônica: namespace + Grupo + Empresa + ator + fingerprint de sessão (sem token). */
export function buildFechamentoQueryKey(namespace, input) {
  const groupId = input?.groupId ?? null;
  const empresaId = input?.empresaId ?? null;
  const actorId = input?.actorId ?? null;
  const sessionKey = input?.sessionKey ?? null;
  const extra = input?.extra ?? null;
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
 * @param {object} [input]
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveFechamentoKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
