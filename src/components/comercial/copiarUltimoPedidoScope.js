/** Cache key: cliente + Grupo + Empresa + ator + sessão (sem token). */
export function buildCopiarUltimoPedidoQueryKey(input) {
  return [
    'ultimoPedidoCliente',
    input?.clienteId || null,
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isCopiarUltimoPedidoScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** KPI: loading/erro/sem contexto nunca viram “sem último pedido”. */
export function resolveCopiarUltimoPedidoKpiState(input) {
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

/**
 * Preserva regra legado: exclui Cancelado e pega o mais recente por data_pedido.
 * Ordenação server-side preferida; desempate local se vier lote.
 * @param {unknown} pedidos
 */
export function pickUltimoPedidoNaoCancelado(pedidos) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  const ativos = rows.filter((p) => p && p.status !== 'Cancelado');
  ativos.sort((a, b) => {
    const da = a?.data_pedido ? new Date(a.data_pedido).getTime() : 0;
    const db = b?.data_pedido ? new Date(b.data_pedido).getTime() : 0;
    return db - da;
  });
  return ativos[0] || null;
}
