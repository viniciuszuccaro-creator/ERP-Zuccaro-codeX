/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildPedidosRetiradaQueryKey(input) {
  return [
    'pedidos-retirada',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isPedidosRetiradaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero pedidos”. */
export function resolvePedidosRetiradaKpiState(input) {
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
