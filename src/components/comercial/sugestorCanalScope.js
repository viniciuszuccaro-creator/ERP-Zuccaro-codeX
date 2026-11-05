/** Cache key: cliente + Grupo + Empresa + ator + sessão (sem token). */
export function buildSugestorCanalQueryKey(namespace, input) {
  return [
    namespace,
    input?.clienteId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isSugestorCanalScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * KPI/widget: loading/erro/sem contexto nunca viram “zero pedidos” (null silencioso).
 * @returns {'unavailable'|'loading'|'error'|'ready'}
 */
export function resolveSugestorCanalKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasCliente = Boolean(input?.clienteId);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !hasCliente) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
