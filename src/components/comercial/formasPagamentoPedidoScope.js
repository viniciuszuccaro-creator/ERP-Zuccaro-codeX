/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildFormasPagamentoPedidoQueryKey(input) {
  return [
    'formas-pagamento-pedido',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isFormasPagamentoPedidoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** Lista ativa: loading/erro/sem contexto nunca viram “zero formas”. */
export function resolveFormasPagamentoPedidoKpiState(input) {
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

export function pickFormasPagamentoAtivas(formas) {
  const rows = Array.isArray(formas) ? formas : [];
  return rows.filter((f) => f?.ativa !== false);
}
