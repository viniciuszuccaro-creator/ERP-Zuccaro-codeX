import { calculateItem, calculateTotals, decimalToMicros, microsToDecimal } from './orcamentoUiPolicy.js';

export const PEDIDO_STATUS_LABELS = {
  EM_ABERTO: 'Em aberto', EM_PRODUCAO: 'Em produção', PRONTO_ENTREGA: 'Pronto para entrega',
  PRONTO_RETIRADA: 'Pronto para retirada', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};

/** Alinhado ao pedidoService.cancel (3–500). */
export const PEDIDO_CANCEL_MOTIVO_MIN = 3;
export const PEDIDO_CANCEL_MOTIVO_MAX = 500;

export function canUsePedidoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (typeof hasPermission !== 'function') return false;
  if (!hasPermission('Comercial', 'pedido', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

export function isPedidoCancelDisabled(hasPermission, status) {
  return !canUsePedidoAction(hasPermission, 'cancelar', status);
}

export function clampPedidoCancelMotivo(value) {
  return String(value ?? '').slice(0, PEDIDO_CANCEL_MOTIVO_MAX);
}

/** Motivo obrigatório no cancelamento (fail-closed). */
export function evaluatePedidoCancelMotivoUiGate(motivo) {
  const raw = String(motivo ?? '');
  const trimmed = raw.trim();
  const length = raw.length;
  if (trimmed.length < PEDIDO_CANCEL_MOTIVO_MIN) {
    return {
      motivo: trimmed,
      length,
      blockConfirm: true,
      required: true,
      hint: `Informe o motivo (mínimo ${PEDIDO_CANCEL_MOTIVO_MIN} caracteres).`,
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  if (length > PEDIDO_CANCEL_MOTIVO_MAX) {
    return {
      motivo: trimmed.slice(0, PEDIDO_CANCEL_MOTIVO_MAX),
      length,
      blockConfirm: true,
      required: true,
      hint: `Motivo excede ${PEDIDO_CANCEL_MOTIVO_MAX} caracteres.`,
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  return {
    motivo: trimmed,
    length,
    blockConfirm: false,
    required: true,
    hint: null,
    counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
  };
}

/** Motivo opcional na transição de status (max 500). */
export function evaluatePedidoStatusMotivoUiGate(motivo) {
  const raw = String(motivo ?? '');
  const trimmed = raw.trim();
  const length = raw.length;
  if (length > PEDIDO_CANCEL_MOTIVO_MAX) {
    return {
      motivo: trimmed.slice(0, PEDIDO_CANCEL_MOTIVO_MAX),
      length,
      blockConfirm: true,
      required: false,
      hint: `Motivo excede ${PEDIDO_CANCEL_MOTIVO_MAX} caracteres.`,
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  return {
    motivo: trimmed,
    length,
    blockConfirm: false,
    required: false,
    hint: null,
    counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
  };
}

export function nextPedidoStatus(row) {
  if (!row) return null;
  const ready = row.tipo_operacao === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
  if (row.status === 'EM_ABERTO') return row.itens?.some((item) => item.requer_producao) ? 'EM_PRODUCAO' : ready;
  if (row.status === 'EM_PRODUCAO') return ready;
  if (row.status === ready) return 'FINALIZADO';
  return null;
}

export function evaluatePedidoStatusTransitionUiGate({ row, groupId, empresaId, canTransition } = {}) {
  if (!groupId || !empresaId) {
    return { blockTransition: true, mode: 'context', target: null, hint: 'Selecione grupo e empresa antes de alterar o status.' };
  }
  if (!canTransition) {
    return { blockTransition: true, mode: 'permission', target: null, hint: 'Sem permissão para alterar status do pedido.' };
  }
  const target = nextPedidoStatus(row);
  if (!row || !target) {
    return { blockTransition: true, mode: 'unavailable', target: null, hint: 'Não há próximo status disponível para este pedido.' };
  }
  return { blockTransition: false, mode: 'ready', target, hint: null };
}

/** empty ≠ erro; loading/error fail-closed. */
export function resolvePedidoHistoryUiState({ events, isLoading, isError, errorMessage } = {}) {
  if (isLoading) {
    return { mode: 'loading', hint: 'Carregando histórico...', events: [], canRetry: false };
  }
  if (isError) {
    return {
      mode: 'error',
      hint: errorMessage || 'Não foi possível carregar o histórico (fail-closed). Não trate como lista vazia.',
      events: [],
      canRetry: true,
    };
  }
  const list = Array.isArray(events) ? events : null;
  if (!list) {
    return { mode: 'invalid', hint: 'Histórico indisponível (fail-closed).', events: [], canRetry: true };
  }
  if (list.length === 0) {
    return {
      mode: 'empty',
      hint: 'Nenhum evento de status registrado para este pedido nesta empresa.',
      events: [],
      canRetry: false,
    };
  }
  return { mode: 'ready', hint: null, events: list, canRetry: false };
}

export function evaluatePedidoPrintPdfUiGate({ row, groupId, empresaId, canPrint } = {}) {
  if (!groupId || !empresaId) {
    return { blockPrint: true, mode: 'context', hint: 'Selecione grupo e empresa antes de imprimir.' };
  }
  if (!canPrint) {
    return { blockPrint: true, mode: 'permission', hint: 'Sem permissão para imprimir pedido.' };
  }
  if (!row || !(row.numero || row.numero_pedido)) {
    return { blockPrint: true, mode: 'missing', hint: 'Pedido indisponível para impressão (fail-closed).' };
  }
  if (!Array.isArray(row.itens)) {
    return { blockPrint: true, mode: 'invalid', hint: 'Itens do pedido indisponíveis (fail-closed).' };
  }
  return { blockPrint: false, mode: 'ready', hint: null };
}

export function buildPedidoShareText(pedido, { empresaNome = 'Empresa', clienteNome = 'Cliente', statusLabel = '' } = {}) {
  if (!pedido?.numero) throw new Error('Pedido inválido para compartilhamento');
  const status = statusLabel || (PEDIDO_STATUS_LABELS[pedido.status] || pedido.status || '—');
  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pedido.total || 0));
  const operacao = pedido.tipo_operacao === 'ENTREGA' ? 'Entrega'
    : pedido.tipo_operacao === 'RETIRADA' ? 'Retirada'
    : (pedido.tipo_operacao || '—');
  const dataEntrega = pedido.data_entrega_solicitada
    ? new Intl.DateTimeFormat('pt-BR').format(new Date(pedido.data_entrega_solicitada))
    : '—';
  return [
    `${empresaNome} - Pedido ${pedido.numero}`,
    `Cliente: ${clienteNome}`,
    `Status: ${status}`,
    `Operação: ${operacao}`,
    `Data solicitada: ${dataEntrega}`,
    `Total: ${total}`,
    'O documento completo deve ser conferido no ERP antes do envio.',
  ].join('\n');
}

export function evaluatePedidoShareUiGate({ row, groupId, empresaId, canShare } = {}) {
  if (!groupId || !empresaId) {
    return { blockShare: true, mode: 'context', hint: 'Selecione grupo e empresa antes de compartilhar.' };
  }
  if (!canShare) {
    return { blockShare: true, mode: 'permission', hint: 'Sem permissão para compartilhar pedido.' };
  }
  if (!row || !row.numero) {
    return { blockShare: true, mode: 'missing', hint: 'Pedido indisponível para compartilhamento (fail-closed).' };
  }
  return { blockShare: false, mode: 'ready', hint: null };
}

export function mapPedidoRowToForm(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('Pedido inválido para recarregar o formulário.');
  }
  return {
    cliente_empresa_id: row.cliente_empresa_id || '',
    cliente_local_id: row.cliente_local_id || '',
    obra_id: row.obra_id || '',
    tabela_preco_id: row.tabela_preco_id || '',
    condicao_pagamento_id: row.condicao_pagamento_id || '',
    tipo_operacao: row.tipo_operacao || 'ENTREGA',
    data_entrega_solicitada: String(row.data_entrega_solicitada || '').slice(0, 10),
    observacoes: row.observacoes || '',
    itens: Array.isArray(row.itens)
      ? row.itens.map((item) => ({
        produto_id: item.produto_id,
        unidade_id: item.unidade_id,
        descricao: item.descricao,
        unidade_sigla: item.unidade_sigla,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto: item.desconto,
        requer_producao: Boolean(item.requer_producao),
      }))
      : [],
  };
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
