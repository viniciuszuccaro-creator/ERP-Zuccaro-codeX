import {
  buildComercialDocumentoResumoTexto,
  calculateItem,
  calculateTotals,
  collectItemLineIssues,
  comercialDocumentoSnapshotGapHint,
  decimalToMicros,
  evaluateItemLinesGate,
  microsToDecimal,
  openComercialResumoTextoWindow,
  resolveComercialResumoPreviewState,
  resolvePromocaoPayloadRef,
} from './orcamentoUiPolicy.js';
import { sanitizeObservacoesText } from './comercialListHttpUiPolicy.js';

export { collectItemLineIssues, evaluateItemLinesGate, openComercialResumoTextoWindow };

/** Snapshot gap pós-031 no Pedido (mesmo contrato do Orçamento). */
export function pedidoDocumentoSnapshotGapHint(row) {
  return comercialDocumentoSnapshotGapHint(row, { purpose: 'resumo', entityLabel: 'pedido' });
}

/** Resumo texto read-only do Pedido carregado + snapshots. */
export function buildPedidoResumoTexto(row, options = {}) {
  return buildComercialDocumentoResumoTexto(row, { ...options, kind: 'PEDIDO' });
}

/** Estado do painel/janela de resumo texto do Pedido (fail-closed). */
export function resolvePedidoResumoPreviewState(row, options = {}) {
  return resolveComercialResumoPreviewState(row, { ...options, kind: 'PEDIDO', entityLabel: 'pedido' });
}

export const PEDIDO_STATUS_LABELS = {
  EM_ABERTO: 'Em aberto', EM_PRODUCAO: 'Em produção', PRONTO_ENTREGA: 'Pronto para entrega',
  PRONTO_RETIRADA: 'Pronto para retirada', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};


/** Gate fail-closed para Imprimir/PDF do Pedido canônico (contexto + permissão + documento). */
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


/** Texto revisável para WhatsApp/e-mail (sem envio externo; clipboard only). */
export function buildPedidoShareText(pedido, { empresaNome = 'Empresa', clienteNome = 'Cliente', statusLabel = '' } = {}) {
  if (!pedido?.numero) throw new Error('Pedido inválido para compartilhamento');
  const status = statusLabel
    || (PEDIDO_STATUS_LABELS[pedido.status] || pedido.status || '—');
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

/** Gate fail-closed para compartilhar texto do Pedido (contexto + permissão + documento). */
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

export function canUsePedidoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (typeof hasPermission !== 'function') return false;
  if (!hasPermission('Comercial', 'pedido', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

/** Cancel disable when unauthorized or not EM_ABERTO (incl. already CANCELADO). */
export function isPedidoCancelDisabled(hasPermission, status) {
  return !canUsePedidoAction(hasPermission, 'cancelar', status);
}

/** Limite alinhado ao pedidoService.cancel (3–500). */
export const PEDIDO_CANCEL_MOTIVO_MIN = 3;
export const PEDIDO_CANCEL_MOTIVO_MAX = 500;

/**
 * Motivo de cancelamento Pedido — fail-closed (Onda 5: cancelamento exige motivo).
 * @param {unknown} motivo
 * @returns {{
 *   motivo: string,
 *   length: number,
 *   blockConfirm: boolean,
 *   hint: string | null,
 *   counterLabel: string,
 * }}
 */
export function evaluatePedidoCancelMotivoUiGate(motivo) {
  const raw = String(motivo ?? '');
  const trimmed = raw.trim();
  const length = raw.length;
  if (!trimmed) {
    return {
      motivo: '',
      length,
      blockConfirm: true,
      hint: 'Informe o motivo do cancelamento (mínimo 3 caracteres).',
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  if (trimmed.length < PEDIDO_CANCEL_MOTIVO_MIN) {
    return {
      motivo: trimmed,
      length,
      blockConfirm: true,
      hint: `Motivo muito curto (mínimo ${PEDIDO_CANCEL_MOTIVO_MIN} caracteres).`,
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  if (length > PEDIDO_CANCEL_MOTIVO_MAX) {
    return {
      motivo: trimmed.slice(0, PEDIDO_CANCEL_MOTIVO_MAX),
      length,
      blockConfirm: true,
      hint: `Motivo excede ${PEDIDO_CANCEL_MOTIVO_MAX} caracteres.`,
      counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
    };
  }
  return {
    motivo: trimmed.slice(0, PEDIDO_CANCEL_MOTIVO_MAX),
    length,
    blockConfirm: false,
    hint: null,
    counterLabel: `${length}/${PEDIDO_CANCEL_MOTIVO_MAX}`,
  };
}

/** Clamp do textarea de motivo. */
export function clampPedidoCancelMotivo(value) {
  return String(value ?? '').slice(0, PEDIDO_CANCEL_MOTIVO_MAX);
}

export function nextPedidoStatus(row) {
  if (!row) return null;
  const ready = row.tipo_operacao === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
  if (row.status === 'EM_ABERTO') return row.itens?.some((item) => item.requer_producao) ? 'EM_PRODUCAO' : ready;
  if (row.status === 'EM_PRODUCAO') return ready;
  if (row.status === ready) return 'FINALIZADO';
  return null;
}

/**
 * Dia civil YYYY-MM-DD a partir de date-only ou ISO (UTC calendar day).
 * @param {unknown} value
 * @returns {string | null}
 */
export function toPedidoEntregaCalendarDay(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Hoje em YYYY-MM-DD (UTC), alinhado ao policy do servidor. */
export function todayPedidoEntregaCalendarDay(now = new Date()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Data solicitada no passado (dia civil anterior a hoje). Ausente/inválida → true (fail-closed na ENTREGA).
 * @param {unknown} dataEntregaSolicitada
 * @param {Date | number} [now]
 */
export function isPedidoDataEntregaPassada(dataEntregaSolicitada, now = new Date()) {
  const day = toPedidoEntregaCalendarDay(dataEntregaSolicitada);
  if (!day) return true;
  return day < todayPedidoEntregaCalendarDay(now);
}

/**
 * Gate UI: Data de Entrega do Cliente obrigatória e hoje+ quando modalidade ENTREGA.
 * RETIRADA: não bloqueia por este gate (campo permanece no formulário/schema).
 * @param {{ tipoOperacao?: string, dataEntregaSolicitada?: string, now?: Date | number }} input
 */
export function evaluatePedidoDataEntregaUiGate(input = {}) {
  const tipo = String(input.tipoOperacao || '').trim().toUpperCase();
  if (tipo !== 'ENTREGA') {
    return { blockSave: false, hint: null, mode: 'optional' };
  }
  const raw = String(input.dataEntregaSolicitada || '').trim();
  if (!raw) {
    return {
      blockSave: true,
      hint: 'Entrega exige data solicitada pelo cliente (hoje ou futura) — fail-closed.',
      mode: 'missing',
    };
  }
  const day = toPedidoEntregaCalendarDay(raw);
  if (!day) {
    return {
      blockSave: true,
      hint: 'Data de entrega do cliente inválida — informe uma data válida (fail-closed).',
      mode: 'invalid',
    };
  }
  if (isPedidoDataEntregaPassada(raw, input.now)) {
    return {
      blockSave: true,
      hint: 'Data de entrega do cliente no passado — informe hoje ou futura (fail-closed).',
      mode: 'past',
    };
  }
  return { blockSave: false, hint: null, mode: 'ready' };
}

export function buildPedidoPayload(form, options = {}) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.tipo_operacao || !form.data_entrega_solicitada) throw new Error('Preencha cliente, condição, operação e data de entrega.');
  const dataGate = evaluatePedidoDataEntregaUiGate({
    tipoOperacao: form.tipo_operacao,
    dataEntregaSolicitada: form.data_entrega_solicitada,
    now: options.now,
  });
  if (dataGate.blockSave) throw new Error(dataGate.hint || 'Data de entrega do cliente inválida.');
  if (!Array.isArray(form.itens) || form.itens.length === 0) throw new Error('Inclua pelo menos um item.');
  form.itens.forEach(calculateItem);
  /** @type {Record<string, unknown>} */
  const payload = {
    cliente_empresa_id: form.cliente_empresa_id,
    cliente_local_id: form.cliente_local_id || undefined,
    obra_id: form.obra_id || undefined,
    tabela_preco_id: form.tabela_preco_id || undefined,
    condicao_pagamento_id: form.condicao_pagamento_id,
    orcamento_id: form.orcamento_id || undefined,
    tipo_operacao: form.tipo_operacao,
    data_entrega_solicitada: new Date(`${form.data_entrega_solicitada}T12:00:00`).toISOString(),
    observacoes: sanitizeObservacoesText(form.observacoes) || undefined,
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
  const promocao = resolvePromocaoPayloadRef(form, options);
  if (promocao) payload.promocao = promocao;
  return payload;
}

export function calculatePedidoTotals(items) {
  const total = calculateTotals(items);
  return { subtotal: microsToDecimal(total.subtotal), desconto: microsToDecimal(total.desconto), total: microsToDecimal(total.total) };
}

/**
 * Mapeia documento Pedido HTTP → formulário de edição (reload pós-save / openEdit).
 * Não inclui snapshots — use collectPersistedCommercialSnapshots na UI.
 * @param {object} row
 */
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
