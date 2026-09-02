import { stockAudit } from '../estoque/auditUtils.js';

// Helper: auditoria padronizada para reservas/movimentos gerados a partir do Pedido
export async function auditPedidoReserva(base44, user, { pedido, movimentos }) {
  await stockAudit(base44, user, {
    acao: 'Criacao',
    entidade: 'MovimentacaoEstoque',
    registro_id: pedido?.id || null,
    descricao: `Movimentações geradas a partir do Pedido ${pedido?.numero_pedido || pedido?.id || ''}`,
    empresa_id: pedido?.empresa_id || null,
    group_id: pedido?.group_id || pedido?.grupo_id || null,
    dados_novos: { quantidade_movimentos: Array.isArray(movimentos) ? movimentos.length : (movimentos?.length || 0) }
  });
}
