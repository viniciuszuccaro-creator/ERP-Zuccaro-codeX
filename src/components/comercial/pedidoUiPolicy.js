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

export function canUsePedidoAction(hasPermission, action, status = 'EM_ABERTO') {
  if (typeof hasPermission !== 'function') return false;
  if (!hasPermission('Comercial', 'pedido', action)) return false;
  return ['editar', 'cancelar'].includes(action) ? status === 'EM_ABERTO' : true;
}

/** Cancel UI: disable when unauthorized or not EM_ABERTO (incl. already CANCELADO). */
export function isPedidoCancelDisabled(hasPermission, status) {
  return !canUsePedidoAction(hasPermission, 'cancelar', status);
}

export function nextPedidoStatus(row) {
  if (!row) return null;
  const ready = row.tipo_operacao === 'ENTREGA' ? 'PRONTO_ENTREGA' : 'PRONTO_RETIRADA';
  if (row.status === 'EM_ABERTO') return row.itens?.some((item) => item.requer_producao) ? 'EM_PRODUCAO' : ready;
  if (row.status === 'EM_PRODUCAO') return ready;
  if (row.status === ready) return 'FINALIZADO';
  return null;
}

export function buildPedidoPayload(form, options = {}) {
  if (!form.cliente_empresa_id || !form.condicao_pagamento_id || !form.tipo_operacao || !form.data_entrega_solicitada) throw new Error('Preencha cliente, condição, operação e data de entrega.');
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
