/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildCorteDobraBitolasQueryKey(input) {
  return [
    'bitolas-corte-dobra',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isCorteDobraScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero bitolas”. */
export function resolveCorteDobraBitolasKpiState(input) {
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
