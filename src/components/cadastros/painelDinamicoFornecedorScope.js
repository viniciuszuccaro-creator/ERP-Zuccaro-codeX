/** KPI: loading/erro/sem contexto nunca viram “R$ 0 / 0 ordens”. */
export function resolvePainelFornecedorKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasFornecedorId = Boolean(input?.fornecedorId);
  const painelAberto = Boolean(input?.painelAberto);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!painelAberto) return 'idle';
  if (!contextoValido || !hasFornecedorId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isPainelFornecedorScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function sumPainelFornecedorTotalCompras(ordens) {
  const rows = Array.isArray(ordens) ? ordens : [];
  return rows
    .filter((o) => o?.status !== 'Cancelada')
    .reduce((sum, o) => sum + (o?.valor_total || 0), 0);
}
