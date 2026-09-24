import { calculateItem, calculateTotals, decimalToMicros, microsToDecimal } from './orcamentoUiPolicy.js';

export const PEDIDO_STATUS_LABELS = {
  EM_ABERTO: 'Em aberto', EM_PRODUCAO: 'Em produção', PRONTO_ENTREGA: 'Pronto para entrega',
  PRONTO_RETIRADA: 'Pronto para retirada', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};

export function canUsePedidoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (!hasPermission('Comercial', 'pedido', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

export function nextPedidoStatus(row) {
  if (!row) return null;
  const ready = row.tipo_operacao === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
  if (row.status === 'EM_ABERTO') return row.itens?.some((item) => item.requer_producao) ? 'EM_PRODUCAO' : ready;
  if (row.status === 'EM_PRODUCAO') return ready;
  if (row.status === ready) return 'FINALIZADO';
  return null;
}

export function buildPedidoPayload(form) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.tipo_operacao || !form.data_entrega_solicitada) throw new Error('Preencha cliente, condição, operação e data de entrega.');
  if (!Array.isArray(form.itens) || form.itens.length === 0) throw new Error('Inclua pelo menos um item.');
  form.itens.forEach(calculateItem);
  return {
    cliente_empresa_id: form.cliente_empresa_id,
    cliente_local_id: form.cliente_local_id || undefined,
    obra_id: form.obra_id || undefined,
    tabela_preco_id: form.tabela_preco_id || undefined,
    condicao_pagamento_id: form.condicao_pagamento_id,
    orcamento_id: form.orcamento_id || undefined,
    tipo_operacao: form.tipo_operacao,
    data_entrega_solicitada: new Date(`${form.data_entrega_solicitada}T12:00:00`).toISOString(),
    observacoes: String(form.observacoes || '').trim() || undefined,
    itens: form.itens.map((item) => ({
      produto_id: item.produto_id,
      unidade_id: item.unidade_id,
      descricao: String(item.descricao || '').trim(),
      unidade_sigla: String(item.unidade_sigla || '').trim(),
      quantidade: microsToDecimal(decimalToMicros(item.quantidade)),
      preco_unitario: microsToDecimal(decimalToMicros(item.preco_unitario)),
      desconto: microsToDecimal(decimalToMicros(item.desconto || '0')),
      requer_producao: Boolean(item.requer_producao),
    })),
  };
}

export function calculatePedidoTotals(items) {
  const total = calculateTotals(items);
  return { subtotal: microsToDecimal(total.subtotal), desconto: microsToDecimal(total.desconto), total: microsToDecimal(total.total) };
}
