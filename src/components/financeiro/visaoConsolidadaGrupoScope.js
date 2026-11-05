/** KPI: loading/erro/sem contexto nunca viram “R$ 0,00”. */
export function resolveVisaoConsolidadaKpiState(input) {
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

export function isVisaoConsolidadaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertVisaoConsolidadaGroupMatch(propGroupId, resolvedGroupId) {
  const prop = propGroupId == null || propGroupId === '' ? null : String(propGroupId);
  const resolved = resolvedGroupId == null || resolvedGroupId === '' ? null : String(resolvedGroupId);
  if (prop && resolved && prop !== resolved) {
    const err = Object.assign(
      new Error('VISAO_CONSOLIDADA_GROUP_MISMATCH'),
      { code: 'VISAO_CONSOLIDADA_GROUP_MISMATCH' },
    );
    throw err;
  }
  return resolved || prop;
}

export function sumVisaoConsolidadaPendente(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((c) => c?.status === 'Pendente')
    .reduce((acc, c) => acc + (c?.valor || 0), 0);
}

export function sumVisaoConsolidadaAtrasado(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((c) => c?.status === 'Atrasado')
    .reduce((acc, c) => acc + (c?.valor || 0), 0);
}

export function buildVisaoConsolidadaPorEmpresa(empresas, contasPagar, contasReceber) {
  const emps = Array.isArray(empresas) ? empresas : [];
  const pagar = Array.isArray(contasPagar) ? contasPagar : [];
  const receber = Array.isArray(contasReceber) ? contasReceber : [];
  return emps.map((emp) => {
    const pagarEmpresa = pagar
      .filter((c) => c?.empresa_id === emp.id && c?.status === 'Pendente')
      .reduce((acc, c) => acc + (c?.valor || 0), 0);
    const receberEmpresa = receber
      .filter((c) => c?.empresa_id === emp.id && c?.status === 'Pendente')
      .reduce((acc, c) => acc + (c?.valor || 0), 0);
    return {
      empresaId: emp.id,
      empresa: emp.nome_fantasia || emp.razao_social,
      pagar: pagarEmpresa,
      receber: receberEmpresa,
      saldo: receberEmpresa - pagarEmpresa,
    };
  });
}
