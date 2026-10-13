const PEDIDO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isCanonicalPedidoId = (value) => typeof value === 'string' && PEDIDO_ID.test(value);

/** Abre o painel canônico existente; o backend continua autoridade para leitura e RBAC. */
export async function openCentralPedidoWindow({ row, block, allowed, assertCurrent, loadPanel, openWindow, props }) {
  if (!allowed || block?.status !== 'ok' || !isCanonicalPedidoId(row?.id)
    || !Array.isArray(block.data) || !block.data.some(item => item?.id === row.id)) return false;
  assertCurrent();
  const Panel = await loadPanel();
  assertCurrent();
  openWindow(Panel, { ...props, canonicalHttp: true, initialSelectedId: row.id, windowMode: true }, {
    title: `Pedido ${String(row.numero || '').trim()}`,
    width: 1400,
    height: 850,
    uniqueKey: `comercial-pedido-${JSON.stringify([props.groupId, props.empresaId, props.actorId, row.id])}`,
  });
  return true;
}
