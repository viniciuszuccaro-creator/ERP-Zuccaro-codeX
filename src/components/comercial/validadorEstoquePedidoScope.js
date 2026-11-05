/** Cache key: Grupo + Empresa + ator + sessão (+ fonte local|http). */
export function buildValidadorEstoqueProdutosQueryKey(input) {
  return [
    'produtos-estoque-validacao',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.fonte || null,
  ];
}

export function isValidadorEstoqueScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * KPI: loading/erro/sem contexto nunca viram “zero produtos” / “estoque insuficiente”.
 * HTTP advisory (fonteLocalAutoritativa=false) → ready com catálogo vazio intencional.
 */
export function resolveValidadorEstoqueProdutosKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const fonteLocalAutoritativa = Boolean(input?.fonteLocalAutoritativa);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);

  if (!contextoValido) return 'unavailable';
  if (!fonteLocalAutoritativa) return 'ready';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
