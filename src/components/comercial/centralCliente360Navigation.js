const PEDIDO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isCanonicalComercialId = (value) => typeof value === 'string' && PEDIDO_ID.test(value);
export const isCanonicalPedidoId = isCanonicalComercialId;
let reopenRequestId = 0;

/** Bloqueia importações repetidas do mesmo tipo sem impedir retry após falha. */
export function createCentralOpenGate() {
  const pending = new Map();
  return {
    begin(kind, scopeKey) {
      if (pending.get(kind)?.scopeKey === scopeKey) return null;
      const ticket = { kind, scopeKey };
      pending.set(kind, ticket);
      return ticket;
    },
    end(ticket) {
      if (!ticket || pending.get(ticket.kind) !== ticket) return false;
      pending.delete(ticket.kind);
      return true;
    },
    reset() { pending.clear(); },
  };
}

export const centralOpenErrorMessage = () => 'Registro indisponível neste contexto. Atualize a Central e tente novamente.';

/** Abre painéis canônicos existentes; o backend continua autoridade para leitura e RBAC. */
async function openCanonicalWindow({ row, block, allowed, assertCurrent, loadPanel, openWindow, props, kind, label }) {
  if (!allowed || block?.status !== 'ok' || !isCanonicalComercialId(row?.id)
    || !Array.isArray(block.data) || !block.data.some(item => item?.id === row.id)) return false;
  assertCurrent();
  const Panel = await loadPanel();
  assertCurrent();
  openWindow(Panel, { ...props, canonicalHttp: true, initialSelectedId: row.id, reopenRequestId: ++reopenRequestId, windowMode: true }, {
    title: `${label} ${String(row.numero || '').trim()}`,
    width: 1400,
    height: 850,
    uniqueKey: `comercial-${kind}-${JSON.stringify([props.groupId, props.empresaId, props.actorId, row.id])}`,
    refreshPropsOnReuse: true,
  });
  return true;
}

export const openCentralPedidoWindow = (args) => openCanonicalWindow({ ...args, kind: 'pedido', label: 'Pedido' });
export const openCentralOrcamentoWindow = (args) => openCanonicalWindow({ ...args, kind: 'orcamento', label: 'Orçamento' });
