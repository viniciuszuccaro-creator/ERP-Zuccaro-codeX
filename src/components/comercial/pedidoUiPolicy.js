import { calculateItem, calculateTotals, decimalToMicros, microsToDecimal } from './orcamentoUiPolicy.js';

export const PEDIDO_STATUS_LABELS = {
  EM_ABERTO: 'Em aberto', EM_PRODUCAO: 'Em produção', PRONTO_ENTREGA: 'Pronto para entrega',
  PRONTO_RETIRADA: 'Pronto para retirada', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};

export const PEDIDO_ORIGEM_LABELS = {
  MANUAL: 'Manual',
  ORCAMENTO: 'Orçamento',
  SITE: 'Site',
  PORTAL_B2B: 'Portal B2B',
  APP: 'App',
  CHATBOT: 'Chatbot',
  MARKETPLACE: 'Marketplace',
  IMPORTACAO: 'Importação',
};

export const PEDIDO_TIPO_COMERCIAL_LABELS = {
  REVENDA: 'Revenda',
  ARMADO: 'Armado',
  CORTE_DOBRA: 'Corte e dobra',
  FABRICADO: 'Fabricado',
  KIT: 'Kit',
  SERVICO: 'Serviço',
  MISTO: 'Misto',
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
  const campanha = String(form.campanha || '').trim();
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
    campanha: campanha || undefined,
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

const PEDIDO_ANEXO_MIME = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
};

/** Metadados DAM do Pedido (path tenant + sha256); registro HTTP sem upload assinado neste checkpoint. */
export function preparePedidoAnexoFile(file, { groupId, empresaId, pedidoId, version = 1, maxBytes = 52_428_800 }) {
  if (!groupId || !empresaId || !pedidoId) throw new Error('Pedido e empresa canônicos obrigatórios para anexo');
  const originalName = String(file?.name || '');
  const unsafeName = [...originalName].some((character) => {
    const code = character.codePointAt(0);
    return code === 47 || code === 92 || code <= 31 || (code >= 127 && code <= 159)
      || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  });
  if (!originalName.trim() || originalName.length > 255 || unsafeName) throw new Error('Nome de arquivo inválido');
  const extension = originalName.split('.').pop()?.toLowerCase();
  const allowed = PEDIDO_ANEXO_MIME[file?.type];
  if (!allowed || !allowed.includes(extension)) throw new Error('Formato não permitido (PDF/PNG/JPEG/WebP)');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxBytes) throw new Error('Tamanho de arquivo inválido');
  const safeName = originalName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
  const storageKey = `groups/${groupId}/companies/${empresaId}/pedidos/${pedidoId}/documents/${crypto.randomUUID()}-${safeName}`;
  return {
    storage_key: storageKey,
    nome_arquivo: originalName,
    mime_type: file.type,
    tamanho_bytes: file.size,
    versao: version,
  };
}
