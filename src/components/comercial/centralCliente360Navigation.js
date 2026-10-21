import { z } from 'zod';

const PEDIDO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENTE_ID = z.string().uuid();

export const isCanonicalComercialId = (value) => typeof value === 'string' && PEDIDO_ID.test(value);
export const isCanonicalPedidoId = isCanonicalComercialId;
export const isCanonicalClienteId = (value) => CLIENTE_ID.safeParse(value).success;
let reopenRequestId = 0;

/** Bloqueia importações repetidas do mesmo tipo sem impedir retry após falha. */
export function createCentralOpenGate() {
  const pending = new Map();
  let generation = 0;
  return {
    begin(kind, scopeKey) {
      if (pending.get(kind)?.scopeKey === scopeKey) return null;
      const ticket = { kind, scopeKey, generation };
      pending.set(kind, ticket);
      return ticket;
    },
    isCurrent(ticket) { return Boolean(ticket && ticket.generation === generation && pending.get(ticket.kind) === ticket); },
    end(ticket) {
      if (!ticket || pending.get(ticket.kind) !== ticket) return false;
      pending.delete(ticket.kind);
      return true;
    },
    reset() { generation++; pending.clear(); },
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

/** Ephemeral exact-session receipt. Token stays in this closure, never in window props/keys. */
export function createCentralClienteNavigationReceipt({ groupId, empresaId, actorId, token, scopeType = undefined }) {
  if (!groupId || (!empresaId && scopeType !== 'grupo') || !actorId || typeof token !== 'string' || !token.trim()) return null;
  const expectedGroup = groupId, expectedEmpresa = empresaId || null, expectedActor = actorId, expectedToken = token.trim();
  return Object.freeze({
    groupId: expectedGroup, empresaId: expectedEmpresa, actorId: expectedActor,
    isCurrent(rendered, session) {
      return Boolean(rendered && session && rendered.groupId === expectedGroup && (rendered.empresaId || null) === expectedEmpresa
        && session.groupId === expectedGroup && (session.empresaId || null) === expectedEmpresa && session.actorId === expectedActor
        && (expectedEmpresa !== null || (session.scopeType === 'grupo' && !session.profileEmpresaId))
        && typeof session.token === 'string' && session.token.trim() === expectedToken);
    },
  });
}

/** Reuses ClientesTab/V24 and its complete-read editor; never constructs a client from the Central projection. */
export async function openCentralClienteWindow({ clienteId, identity, allowed, assertCurrent, loadPanel, openWindow, scope, renderedScope = undefined }) {
  if (!allowed || !isCanonicalClienteId(clienteId) || identity?.id !== clienteId) return false;
  const rendered = renderedScope || scope;
  if (!scope || rendered?.groupId !== scope.groupId) return false;
  const receipt = createCentralClienteNavigationReceipt({ ...scope, empresaId: rendered.empresaId, scopeType: rendered.scopeType });
  if (!receipt) return false;
  assertCurrent();
  const Panel = await loadPanel();
  assertCurrent();
  openWindow(Panel, { windowMode: true, initialClienteId: clienteId, navigationReceipt: receipt, reopenRequestId: ++reopenRequestId }, {
    title: 'Cliente · cadastro canônico', width: 1500, height: 850,
    uniqueKey: `central-cliente-cadastro-${JSON.stringify([receipt.groupId, receipt.empresaId, receipt.actorId, clienteId])}`,
    refreshPropsOnReuse: true,
  });
  return true;
}
