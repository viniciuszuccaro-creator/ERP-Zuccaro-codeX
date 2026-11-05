/** Cache key: Grupo + Empresa + ator + sessão (sem token). */
export function buildWizardEtapa1ParametrosOrigemQueryKey(input) {
  return [
    'wizard-etapa1-parametros-origem',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function buildWizardEtapa1EnderecosClienteQueryKey(input) {
  return [
    'wizard-etapa1-enderecos-cliente',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.clienteId || null,
  ];
}

export function isWizardEtapa1ScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “0 canais”. */
export function resolveWizardEtapa1ParametrosKpiState(input) {
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

/** Extrai locais_entrega do Cliente (getInContext ou filter). */
export function pickLocaisEntregaFromCliente(cliente) {
  if (!cliente || typeof cliente !== 'object') return [];
  return Array.isArray(cliente.locais_entrega) ? cliente.locais_entrega : [];
}
