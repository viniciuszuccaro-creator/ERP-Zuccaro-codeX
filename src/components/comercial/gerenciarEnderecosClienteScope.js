/** Cache key: cliente + Grupo + Empresa + ator + sessão (sem token). */
export function buildGerenciarEnderecosClienteQueryKey(input) {
  return [
    'cliente-enderecos',
    input?.clienteId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isGerenciarEnderecosClienteScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero endereços”. */
export function resolveGerenciarEnderecosClienteKpiState(input) {
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

export function pickClienteEnderecosFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list[0] || null;
}

export function listLocaisEntrega(cliente) {
  return Array.isArray(cliente?.locais_entrega) ? cliente.locais_entrega : [];
}
