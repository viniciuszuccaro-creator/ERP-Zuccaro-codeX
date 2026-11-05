/** KPI: loading/erro/sem contexto nunca viram “zero registros”. */
export function resolvePainelDinamicoKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasClienteId = Boolean(input?.clienteId);
  const painelAberto = Boolean(input?.painelAberto);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!painelAberto) return 'idle';
  if (!contextoValido || !hasClienteId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isPainelDinamicoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function sumPainelDinamicoTotalVendas(pedidos) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  return rows
    .filter((p) => p?.status !== 'Cancelado')
    .reduce((sum, p) => sum + (p?.valor_total || 0), 0);
}

export function sumPainelDinamicoTotalEmAberto(contas) {
  const rows = Array.isArray(contas) ? contas : [];
  return rows
    .filter((c) => c?.status === 'Pendente' || c?.status === 'Atrasado')
    .reduce((sum, c) => sum + (c?.valor || 0), 0);
}
