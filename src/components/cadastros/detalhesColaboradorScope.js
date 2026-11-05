/** Cache key por entidade: Grupo + Empresa + ator + sessão + colaborador. */
export function buildDetalhesColaboradorQueryKey(namespace, input) {
  return [
    namespace,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.colaboradorId || null,
  ];
}

export function isDetalhesColaboradorScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero registros”. */
export function resolveDetalhesColaboradorKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasId = Boolean(input?.colaboradorId);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !hasId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function filterPontosDoMes(pontos, now = new Date()) {
  const rows = Array.isArray(pontos) ? pontos : [];
  const ref = now instanceof Date ? now : new Date(now);
  return rows.filter((p) => {
    if (!p?.data) return false;
    const dataP = new Date(p.data);
    return dataP.getMonth() === ref.getMonth() && dataP.getFullYear() === ref.getFullYear();
  });
}

export function sumHorasTrabalhadas(pontos) {
  const rows = Array.isArray(pontos) ? pontos : [];
  return rows.reduce((sum, p) => sum + (p?.horas_trabalhadas || 0), 0);
}

export function sumHorasExtras(pontos) {
  const rows = Array.isArray(pontos) ? pontos : [];
  return rows.reduce((sum, p) => sum + (p?.horas_extras || 0), 0);
}

export function filterFeriasAtivas(ferias) {
  const rows = Array.isArray(ferias) ? ferias : [];
  return rows.filter((f) => f?.status === 'Em Gozo' || f?.status === 'Aprovado');
}
