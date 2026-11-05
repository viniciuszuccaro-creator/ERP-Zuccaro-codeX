/** Cache key: Grupo + Empresa + ator + sessão + cliente (+ pedido). */
export function buildValidacaoCreditoClienteQueryKey(input) {
  return [
    'cliente-credito',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.clienteId || null,
  ];
}

export function buildValidacaoCreditoPedidosQueryKey(input) {
  return [
    'pedidos-pendentes-cliente',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
    input?.clienteId || null,
    input?.pedidoId || null,
  ];
}

export function isValidacaoCreditoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “crédito zerado”. */
export function resolveValidacaoCreditoKpiState(input) {
  const contextoValido = Boolean(input?.contextoValido);
  const hasClienteId = Boolean(input?.clienteId);
  const isLoading = Boolean(input?.isLoading);
  const isError = Boolean(input?.isError);
  const isFetching = Boolean(input?.isFetching);
  const dataDefined = Boolean(input?.dataDefined);
  if (!contextoValido || !hasClienteId) return 'unavailable';
  if (isError) return 'error';
  if (isLoading || (isFetching && !dataDefined)) return 'loading';
  return 'ready';
}

const STATUS_CREDITO_PENDENTE = new Set(['Aprovado', 'Em Produção', 'Faturado']);

/** Filtra pedidos que comprometem crédito (exclui pedido atual). */
export function filtrarPedidosComprometemCredito(pedidos, pedidoId) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  return rows.filter((p) => {
    if (!STATUS_CREDITO_PENDENTE.has(p?.status)) return false;
    if (pedidoId != null && String(p?.id) === String(pedidoId)) return false;
    return true;
  });
}
