/** Cache key: alvo + Grupo + Empresa + ator + sessão. */
export function buildPainelGovernancaQueryKey(namespace, input) {
  return [
    namespace,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isPainelGovernancaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram zeros. */
export function resolvePainelGovernancaKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const podeVer = Boolean(input?.podeVerGovernanca);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !podeVer) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

export function countPainelGovernancaLoginsHoje(acessos, now = new Date()) {
  const rows = Array.isArray(acessos) ? acessos : [];
  const ref = now instanceof Date ? now : new Date(now);
  return rows.filter((a) =>
    a?.tipo_acao === 'Login'
    && a?.sucesso
    && a?.data_hora
    && new Date(a.data_hora).toDateString() === ref.toDateString(),
  ).length;
}

export function countPainelGovernancaTentativasFalhas(acessos, now = new Date()) {
  const rows = Array.isArray(acessos) ? acessos : [];
  const ref = now instanceof Date ? now : new Date(now);
  return rows.filter((a) =>
    !a?.sucesso
    && a?.data_hora
    && new Date(a.data_hora).toDateString() === ref.toDateString(),
  ).length;
}

export function countPainelGovernancaAltoRisco(logs) {
  const rows = Array.isArray(logs) ? logs : [];
  return rows.filter((a) => a?.nivel_risco === 'Alto' || a?.nivel_risco === 'Crítico').length;
}

export function countPainelGovernancaAlertasIa(logs) {
  const rows = Array.isArray(logs) ? logs : [];
  return rows.filter((a) => a?.alerta_ia_gerado).length;
}
