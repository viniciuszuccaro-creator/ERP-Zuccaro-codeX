/** Cache key: cliente + Grupo + Empresa + ator + sessão (sem token). */
export function buildPerfilRiscoClienteQueryKey(input) {
  return [
    'cliente-risco',
    input?.clienteId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isPerfilRiscoClienteScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI/widget: loading/erro/sem contexto nunca viram ausência silenciosa. */
export function resolvePerfilRiscoClienteKpiState(input) {
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

/** Primeiro Cliente do escopo (filterInContext por id). */
export function pickClienteRiscoFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list[0] || null;
}
