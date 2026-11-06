/** Cache key canônica: namespace + Grupo + Empresa + ator + fingerprint de sessão (sem token).
 * Namespace raiz (`pedidos`, `movimentacoes`, …) preserva invalidateQueries dos mutadores legados.
 */
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
 * Descarta resposta tardia quando ator/sessão/grupo/empresa mudou.
 * @returns {boolean}
 */
export function isFechamentoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null)
    && (expected?.groupId || null) === (live?.groupId || null)
    && (expected?.empresaId || null) === (live?.empresaId || null);
}

/**
 * KPI: loading/erro/sem contexto nunca viram zero.
 * Aceita agregação de dependências (Pedido + auxiliares).
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

/**
 * Agrega Pedido + movimentações + contas + entregas (#545).
 * Pedido ready/vazio + auxiliar pendente → loading (Itens Baixados ≠ 0).
 */
export function resolveFechamentoDashboardKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  if (!contextoValido) return 'unavailable';

  const anyError = Boolean(
    input?.pedidosIsError
    || input?.movIsError
    || input?.contasIsError
    || input?.entregasIsError,
  );
  if (anyError) return 'error';

  const anyLoading = Boolean(
    input?.pedidosIsLoading
    || input?.movIsLoading
    || input?.contasIsLoading
    || input?.entregasIsLoading
    || (
      (input?.pedidosIsFetching && !input?.pedidosDataDefined)
      || (input?.movIsFetching && !input?.movDataDefined)
      || (input?.contasIsFetching && !input?.contasDataDefined)
      || (input?.entregasIsFetching && !input?.entregasDataDefined)
    ),
  );
  if (anyLoading) return 'loading';

  const allDefined = Boolean(
    input?.pedidosDataDefined
    && input?.movDataDefined
    && input?.contasDataDefined
    && input?.entregasDataDefined,
  );
  if (!allDefined) return 'loading';
  return 'ready';
}
