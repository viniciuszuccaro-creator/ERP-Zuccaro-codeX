/** KPI fail-closed: loading/erro/sem contexto nunca viram total/taxa 0 “pronto”. */
export function resolveRelatorioQualidadeKpiState(input) {
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

export function isRelatorioQualidadeScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function buildRelatorioQualidadeQueryKey({
  groupId,
  empresaId,
  actorId,
  sessionKey,
  periodoInicio,
  periodoFim,
}) {
  return [
    'inspecoes',
    groupId || null,
    empresaId || null,
    actorId || null,
    sessionKey || null,
    periodoInicio || null,
    periodoFim || null,
  ];
}

export function filterInspecoesPorPeriodo(rows, periodoInicio, periodoFim) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((i) => {
    const dataInsp = i?.data_inspecao || i?.created_date;
    if (!dataInsp) return false;
    const day = String(dataInsp).slice(0, 10);
    return day >= periodoInicio && day <= periodoFim;
  });
}

export function buildRelatorioQualidadeKpis(inspecoes) {
  const rows = Array.isArray(inspecoes) ? inspecoes : [];
  const totalInspecoes = rows.length;
  const aprovadas = rows.filter((i) => i.resultado === 'Aprovado').length;
  const reprovadas = rows.filter((i) => i.resultado === 'Reprovado').length;
  const revisar = rows.filter((i) => i.resultado === 'Revisar').length;
  const taxaAprovacao = totalInspecoes > 0
    ? ((aprovadas / totalInspecoes) * 100).toFixed(1)
    : '0';
  const tempoMedio = rows.length > 0
    ? rows.reduce((sum, i) => sum + (i.tempo_inspecao_min || 0), 0) / rows.length
    : 0;
  return { totalInspecoes, aprovadas, reprovadas, revisar, taxaAprovacao, tempoMedio };
}
