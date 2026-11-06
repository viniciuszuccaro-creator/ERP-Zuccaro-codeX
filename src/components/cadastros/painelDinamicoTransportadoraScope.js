/** KPI: loading/erro/sem contexto nunca viram “0 entregas / 0%”. */
export function resolvePainelTransportadoraKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasTransportadoraId = Boolean(input?.transportadoraId);
  const painelAberto = Boolean(input?.painelAberto);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!painelAberto) return 'idle';
  if (!contextoValido || !hasTransportadoraId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function isPainelTransportadoraScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function countPainelTransportadoraEntregasRealizadas(entregas) {
  const rows = Array.isArray(entregas) ? entregas : [];
  return rows.filter((e) => e?.status === 'Entregue').length;
}

export function countPainelTransportadoraEntregasFrustradas(entregas) {
  const rows = Array.isArray(entregas) ? entregas : [];
  return rows.filter((e) => e?.status === 'Entrega Frustrada').length;
}

export function computePainelTransportadoraTaxaSucesso(entregas) {
  const rows = Array.isArray(entregas) ? entregas : [];
  if (rows.length === 0) return 0;
  const realizadas = countPainelTransportadoraEntregasRealizadas(rows);
  return Number(((realizadas / rows.length) * 100).toFixed(1));
}
