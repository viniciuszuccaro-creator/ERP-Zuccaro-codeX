/** KPI: loading/erro/sem contexto nunca viram “0 registros” nas abas. */
export function resolvePainelColaboradorKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasColaboradorId = Boolean(input?.colaboradorId);
  const painelAberto = Boolean(input?.painelAberto);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!painelAberto) return 'idle';
  if (!contextoValido || !hasColaboradorId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isPainelColaboradorScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function painelColaboradorKpiLabel(kpi) {
  if (kpi === 'loading') return 'Carregando…';
  if (kpi === 'error') return 'Erro ≠ lista vazia';
  if (kpi === 'unavailable' || kpi === 'idle') return 'Contexto indisponível';
  return null;
}
