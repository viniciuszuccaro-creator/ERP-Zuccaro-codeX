/**
 * Escopo multi-ator para AcoesRapidasGlobal (#542).
 * Cache e ações não reutilizam clientes entre atores/sessões no mesmo Grupo/Empresa.
 */

export function resolveAcoesRapidasClientesKpiState(input) {
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

export function isAcoesRapidasScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null)
    && (expected?.groupId || null) === (live?.groupId || null)
    && (expected?.empresaId || null) === (live?.empresaId || null);
}

export function buildAcoesRapidasClientesQueryKey({
  groupId,
  empresaId,
  actorId,
  sessionKey,
}) {
  return [
    'clientes',
    'acoes-rapidas',
    groupId || null,
    empresaId || null,
    actorId || null,
    sessionKey || null,
  ];
}

/**
 * Cliente pronto para abrir novoPedido; null se loading/erro/stale/sem contexto.
 * @param {{ kpiState: string, clientes: unknown, scopeExpected: object, scopeLive: object }} input
 */
export function resolveClientesParaNovoPedido(input) {
  if (input?.kpiState !== 'ready') return null;
  if (!isAcoesRapidasScopeCurrent(input.scopeExpected, input.scopeLive)) return null;
  return Array.isArray(input.clientes) ? input.clientes : null;
}
