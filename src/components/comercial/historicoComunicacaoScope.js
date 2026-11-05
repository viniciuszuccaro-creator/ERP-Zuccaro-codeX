/** Cache key: alvo + Grupo + Empresa + ator + sessão (sem token). */
export function buildHistoricoComunicacaoQueryKey(input) {
  return [
    'historico-comunicacao',
    input?.clienteId || null,
    input?.pedidoId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isHistoricoComunicacaoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * Preserva o filtro legado: pedido via pedido_id OU referencia_id;
 * cliente via cliente_id quando sem pedido.
 * @param {unknown} eventos
 * @param {{ clienteId?: string|null, pedidoId?: string|null }|null|undefined} [filtros]
 */
export function filterHistoricoComunicacaoEventos(eventos, filtros) {
  const clienteId = filtros?.clienteId || null;
  const pedidoId = filtros?.pedidoId || null;
  const rows = Array.isArray(eventos) ? eventos : [];
  if (pedidoId) {
    return rows.filter((e) => e?.referencia_id === pedidoId || e?.pedido_id === pedidoId);
  }
  if (clienteId) {
    return rows.filter((e) => e?.cliente_id === clienteId);
  }
  return rows;
}

/** KPI/contagem: loading/erro/sem contexto nunca viram zero. */
export function resolveHistoricoComunicacaoKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasTarget = Boolean(input?.clienteId || input?.pedidoId);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !hasTarget) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}
