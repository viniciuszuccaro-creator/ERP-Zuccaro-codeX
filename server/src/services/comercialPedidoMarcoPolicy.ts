import type { PedidoStatus } from '../repositories/pedidoTypes.js';

/**
 * Marcos comerciais do Pedido (Onda 5).
 * Após sair de EM_ABERTO, mutações comerciais (editar itens/totais, cancelar, anexar) ficam bloqueadas.
 * Transições de status continuam via endpoint dedicado + RBAC alterar-status.
 */
export function isPedidoComercialmenteEditavel(status: PedidoStatus): boolean {
  return status === 'EM_ABERTO';
}

export function isPedidoEmMarcoCritico(status: PedidoStatus): boolean {
  return status === 'EM_PRODUCAO'
    || status === 'PRONTO_ENTREGA'
    || status === 'PRONTO_RETIRADA'
    || status === 'FINALIZADO';
}

export function assertPedidoComercialmenteEditavel(status: PedidoStatus): { ok: true } | { ok: false; reason: 'marco_critico' | 'cancelado' | 'estado_invalido' } {
  if (status === 'EM_ABERTO') return { ok: true };
  if (status === 'CANCELADO') return { ok: false, reason: 'cancelado' };
  if (isPedidoEmMarcoCritico(status)) return { ok: false, reason: 'marco_critico' };
  return { ok: false, reason: 'estado_invalido' };
}
