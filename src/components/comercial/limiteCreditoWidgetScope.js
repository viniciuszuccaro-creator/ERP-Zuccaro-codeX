/** Cache key: cliente + Grupo + Empresa + ator + sessão (sem token). */
export function buildLimiteCreditoWidgetQueryKey(input) {
  return [
    'contasReceberCliente',
    input?.clienteId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isLimiteCreditoWidgetScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “zero utilizado”. */
export function resolveLimiteCreditoWidgetKpiState(input) {
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

/** Soma contas Pendente/Atrasado (contrato legado do widget). */
export function sumContasReceberPendentes(contas) {
  const rows = Array.isArray(contas) ? contas : [];
  return rows
    .filter((c) => c?.status === 'Pendente' || c?.status === 'Atrasado')
    .reduce((sum, c) => sum + (c?.valor || 0), 0);
}
