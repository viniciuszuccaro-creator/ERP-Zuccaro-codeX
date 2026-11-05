/** KPI: loading/erro/sem contexto nunca viram “0 pendentes / tudo conciliado”. */
export function resolvePainelConciliacaoKpiState(input) {
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

export function isPainelConciliacaoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

export function assertPainelConciliacaoEmpresaMatch(propEmpresaId, resolvedEmpresaId) {
  const prop = propEmpresaId == null || propEmpresaId === '' ? null : String(propEmpresaId);
  const resolved = resolvedEmpresaId == null || resolvedEmpresaId === '' ? null : String(resolvedEmpresaId);
  if (prop && resolved && prop !== resolved) {
    throw Object.assign(new Error('PAINEL_CONCILIACAO_EMPRESA_MISMATCH'), {
      code: 'PAINEL_CONCILIACAO_EMPRESA_MISMATCH',
    });
  }
  const effective = resolved || prop;
  if (!effective) {
    throw Object.assign(new Error('PAINEL_CONCILIACAO_SCOPE_BLOCKED'), {
      code: 'PAINEL_CONCILIACAO_SCOPE_BLOCKED',
    });
  }
  return effective;
}

export function buildPainelConciliacaoTituloUpdate(tipo, extrato) {
  if (tipo === 'receber') {
    return {
      status: 'Recebido',
      data_recebimento: extrato?.data_movimento,
      valor_recebido: extrato?.valor,
    };
  }
  return {
    status: 'Pago',
    data_pagamento: extrato?.data_movimento,
    valor_pago: extrato?.valor,
  };
}

export function buildPainelConciliacaoExtratoUpdate(tipo, tituloId) {
  return {
    conciliado: true,
    conciliado_com_tipo: tipo === 'receber' ? 'ContaReceber' : 'ContaPagar',
    conciliado_com_id: tituloId,
    conciliado_por: 'Sistema',
    data_conciliacao: new Date().toISOString(),
  };
}
