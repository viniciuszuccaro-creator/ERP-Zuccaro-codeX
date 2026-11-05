/** Cache key por entidade: Grupo + Empresa + ator + sessão + cliente. */
export function buildDetalhesCadastroQueryKey(namespace, input) {
  return [
    namespace,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.clienteId || null,
  ];
}

export function isDetalhesCadastroScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero registros”. */
export function resolveDetalhesCadastroKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasClienteId = Boolean(input?.clienteId);
  const isClienteTipo = Boolean(input?.isClienteTipo);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!isClienteTipo) return 'idle';
  if (!contextoValido || !hasClienteId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function sumDetalhesCadastroTotalVendas(pedidos) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  return rows.reduce((sum, p) => sum + (p?.valor_total || 0), 0);
}

export function sumDetalhesCadastroTotalReceber(contas) {
  const rows = Array.isArray(contas) ? contas : [];
  return rows
    .filter((c) => c?.status === 'Pendente')
    .reduce((sum, c) => sum + (c?.valor || 0), 0);
}

export function countDetalhesCadastroContasAtrasadas(contas, now = new Date()) {
  const rows = Array.isArray(contas) ? contas : [];
  const ref = now instanceof Date ? now : new Date(now);
  return rows.filter((c) =>
    c?.status === 'Pendente' && c?.data_vencimento && new Date(c.data_vencimento) < ref
  ).length;
}
