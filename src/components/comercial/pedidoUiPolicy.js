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
import { sanitizeObservacoesText, evaluateComercialCancelMotivoUiGate, clampComercialCancelMotivo, COMERCIAL_CANCEL_MOTIVO_MAX, COMERCIAL_CANCEL_MOTIVO_MIN } from './comercialListHttpUiPolicy.js';

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
  const snapshotGap = comercialDocumentoSnapshotGapHint(row, { purpose: 'print', entityLabel: 'pedido' });
  if (snapshotGap) {
    return { blockPrint: true, mode: 'snapshot_gap', hint: snapshotGap };
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
  const snapshotGap = comercialDocumentoSnapshotGapHint(row, { purpose: 'print', entityLabel: 'pedido' });
  if (snapshotGap) {
    return { blockShare: true, mode: 'snapshot_gap', hint: snapshotGap };
  }
  return { blockShare: false, mode: 'ready', hint: null };
}


/**
 * Resumo do painel de detalhe do Pedido (somente leitura).
 * Fail-closed: sem row/itens não inventa; avisa snapshot incompleto pós-031.
 */
export function resolvePedidoDetailSummaryUiState(row, { clienteNome = '' } = {}) {
  if (!row || !row.numero) {
    return { mode: 'missing', hint: 'Pedido indisponível (fail-closed).', fields: null, snapshotGap: null };
  }
  if (!Array.isArray(row.itens)) {
    return { mode: 'invalid', hint: 'Itens do pedido indisponíveis (fail-closed).', fields: null, snapshotGap: null };
  }
  const snapshotGap = pedidoDocumentoSnapshotGapHint(row);
  const condicao = [row.condicao_pagamento_codigo_snapshot, row.condicao_pagamento_nome_snapshot]
    .filter(Boolean).join(' — ') || null;
  const tabela = [row.tabela_preco_codigo_snapshot, row.tabela_preco_nome_snapshot]
    .filter(Boolean).join(' — ') || null;
  return {
    mode: snapshotGap ? 'snapshot_gap' : 'ready',
    hint: snapshotGap || null,
    snapshotGap,
    fields: {
      numero: row.numero,
      status: row.status,
      clienteNome: clienteNome || '—',
      condicao: condicao || '—',
      tabela: tabela || (row.tabela_preco_id ? String(row.tabela_preco_id) : '—'),
      tipoOperacao: row.tipo_operacao === 'ENTREGA' ? 'Entrega' : row.tipo_operacao === 'RETIRADA' ? 'Retirada' : (row.tipo_operacao || '—'),
      dataEntrega: row.data_entrega_solicitada || null,
      observacoes: row.observacoes || '',
      subtotal: row.subtotal,
      desconto: row.desconto,
      total: row.total,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      promocaoAplicada: row.promocao_aplicada === true,
    },
  };
}

export function canUsePedidoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (typeof hasPermission !== 'function') return false;
  if (!hasPermission('Comercial', 'pedido', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

/** Imprimir/PDF: só imprimir|exportar — sem fallback visualizar (fail-closed RBAC). */
export function resolvePedidoPrintPermission(hasPermission) {
  return canUsePedidoAction(hasPermission, 'imprimir')
    || canUsePedidoAction(hasPermission, 'exportar');
}

/** Compartilhar: só compartilhar|notificar — sem cascata de visualizar/imprimir. */
export function resolvePedidoSharePermission(hasPermission) {
  return canUsePedidoAction(hasPermission, 'compartilhar')
    || canUsePedidoAction(hasPermission, 'notificar');
}

/** Cancel disable when unauthorized or not EM_ABERTO (incl. already CANCELADO). */
export function isPedidoCancelDisabled(hasPermission, status) {
  return !canUsePedidoAction(hasPermission, 'cancelar', status);
}

/** Limite alinhado ao pedidoService.cancel (3–500). */
export const PEDIDO_CANCEL_MOTIVO_MIN = COMERCIAL_CANCEL_MOTIVO_MIN;
export const PEDIDO_CANCEL_MOTIVO_MAX = COMERCIAL_CANCEL_MOTIVO_MAX;

/**
 * Motivo de cancelamento Pedido — fail-closed (Onda 5: cancelamento exige motivo).
 * @param {unknown} motivo
 */
export function evaluatePedidoCancelMotivoUiGate(motivo) {
  return evaluateComercialCancelMotivoUiGate(motivo);
}

/** Clamp do textarea de motivo. */
export function clampPedidoCancelMotivo(value) {
  return clampComercialCancelMotivo(value);
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
 * Motivo opcional na transição de status Pedido (API aceita ausente; max 500).
 * Vazio não bloqueia; excedente bloqueia confirm.
 * @param {unknown} motivo
 */
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

/**
 * Gate fail-closed para abrir/confirmar avanço de status.
 * @param {{ row?: object, groupId?: string, empresaId?: string, canTransition?: boolean }} [input]
 */
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

/**
 * Estado UI do Histórico do Pedido (empty ≠ erro; loading/error fail-closed).
 * @param {{ events?: unknown, isLoading?: boolean, isError?: boolean, errorMessage?: string | null }} [input]
 */
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
    return {
      mode: 'invalid',
      hint: 'Histórico indisponível (fail-closed).',
      events: [],
      canRetry: true,
    };
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

/** Hoje civil YYYY-MM-DD (local) — paridade Orçamento validade / min= do input date. */
export function todayPedidoEntregaCalendarDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
 * Gate UI: data solicitada sempre obrigatória (schema Zod/backend).
 * ENTREGA: também hoje+ (calendário local). RETIRADA: presença ok; passado permitido.
 * @param {{ tipoOperacao?: string, dataEntregaSolicitada?: string, now?: Date | number }} input
 * @returns {{
 *   blockSave: boolean,
 *   hint: string | null,
 *   mode: 'missing' | 'invalid' | 'past' | 'ready' | 'optional',
 *   minDay: string,
 * }}
 */
export function evaluatePedidoDataEntregaUiGate(input = {}) {
  const tipo = String(input.tipoOperacao || '').trim().toUpperCase();
  const minDay = todayPedidoEntregaCalendarDay(input.now);
  const raw = String(input.dataEntregaSolicitada || '').trim();
  if (!raw) {
    return {
      blockSave: true,
      hint: tipo === 'ENTREGA'
        ? 'Entrega exige data solicitada pelo cliente (hoje ou futura) — fail-closed.'
        : 'Informe a data solicitada do Pedido (obrigatória no schema) — fail-closed.',
      mode: 'missing',
      minDay,
    };
  }
  const day = toPedidoEntregaCalendarDay(raw);
  if (!day) {
    return {
      blockSave: true,
      hint: 'Data de entrega do cliente inválida — informe uma data válida (fail-closed).',
      mode: 'invalid',
      minDay,
    };
  }
  if (tipo === 'ENTREGA' && isPedidoDataEntregaPassada(raw, input.now)) {
    return {
      blockSave: true,
      hint: 'Data de entrega do cliente no passado — informe hoje ou futura (fail-closed).',
      mode: 'past',
      minDay,
    };
  }
  return {
    blockSave: false,
    hint: null,
    mode: tipo === 'ENTREGA' ? 'ready' : 'optional',
    minDay,
  };
}

export function buildPedidoPayload(form, options = {}) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.tipo_operacao) {
    throw new Error('Preencha cliente, condição e operação.');
  }
  const dataGate = evaluatePedidoDataEntregaUiGate({
    tipoOperacao: form.tipo_operacao,
    dataEntregaSolicitada: form.data_entrega_solicitada,
    now: options.now,
  });
  if (dataGate.blockSave) throw new Error(dataGate.hint || 'Data de entrega do cliente inválida.');
  if (!String(form.data_entrega_solicitada || '').trim()) {
    throw new Error('Preencha a data solicitada do Pedido.');
  }
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
