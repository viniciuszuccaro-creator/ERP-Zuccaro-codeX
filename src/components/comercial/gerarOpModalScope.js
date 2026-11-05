/** Cache key: pedido + Grupo + Empresa + ator + sessão (sem token). */
export function buildGerarOpModalQueryKey(namespace, input) {
  return [
    namespace,
    input?.pedidoId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isGerarOpModalScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero produtos”. */
export function resolveGerarOpModalProdutosKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const isOpen = Boolean(input?.isOpen);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !isOpen) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function pickConfiguracaoProducao(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list[0] || null;
}
