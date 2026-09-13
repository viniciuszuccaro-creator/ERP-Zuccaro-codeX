export const SITE_CPA_QUOTE_CREATE_OPERATION = 'siteOrcamentoCreate';
export const SITE_CPA_QUOTE_GET_OPERATION = 'siteOrcamentoGet';
export const SITE_CPA_NEGOTIATION_GET_OPERATION = 'siteNegociacaoGet';
export const SITE_CPA_NEGOTIATION_RESPOND_OPERATION = 'siteNegociacaoResponder';

export const QUOTE_OPERATIONS = new Set([
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_QUOTE_GET_OPERATION,
  SITE_CPA_NEGOTIATION_GET_OPERATION,
  SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
]);

export const QUOTE_SOURCES = new Set([
  'MATERIAL_LIST', 'CART', 'MANUAL_QUOTE', 'ARMACAO', 'REPURCHASE', 'AI_QUOTE_AGENT',
]);

export const NEGOTIATION_ACTIONS = new Set([
  'REQUEST_BETTER_PRICE', 'REQUEST_CHANGE', 'COUNTER_PROPOSAL', 'ACCEPT', 'REJECT',
]);

const MAX_CATALOG_ITEMS = 50;
const MAX_CUSTOM_ITEMS = 20;
const MAX_NOTES_LENGTH = 1000;
const text = (value) => String(value ?? '').trim();
const normalize = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const money = (value) => Math.round(Number(value) * 100) / 100;

export class SiteCpaQuoteError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaQuoteError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const safeQuoteId = (value, code, required = false) => {
  const id = text(value);
  if ((!id && required) || id.length > 160 || (id && !/^[A-Za-z0-9._:@/-]+$/.test(id))) {
    throw new SiteCpaQuoteError(400, code);
  }
  return id || null;
};

export const sanitizeQuoteText = (value, maxLength = MAX_NOTES_LENGTH) => text(value)
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .slice(0, maxLength);

const normalizeQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SiteCpaQuoteError(400, 'site_cpa_quote_item_invalid');
  }
  return quantity;
};

const normalizeDeliveryMode = (value) => {
  const mode = normalize(value || 'PICKUP');
  if (mode === 'PICKUP' || mode === 'RETIRADA') return 'PICKUP';
  if (mode === 'DELIVERY' || mode === 'ENTREGA') return 'DELIVERY';
  throw new SiteCpaQuoteError(400, 'site_cpa_quote_delivery_invalid');
};

export const normalizeQuoteCreateInput = (payload = {}) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const source = normalize(data?.source);
  if (!QUOTE_SOURCES.has(source)) throw new SiteCpaQuoteError(400, 'site_cpa_quote_source_invalid');
  const catalogItems = Array.isArray(data?.items) ? data.items : [];
  const customItems = Array.isArray(data?.customItems) ? data.customItems : [];
  if ((!catalogItems.length && !customItems.length)
    || catalogItems.length > MAX_CATALOG_ITEMS || customItems.length > MAX_CUSTOM_ITEMS) {
    throw new SiteCpaQuoteError(400, 'site_cpa_quote_item_invalid');
  }
  const seen = new Set();
  const items = catalogItems.map((item) => {
    const erpProductId = safeQuoteId(item?.erpProductId, 'site_cpa_quote_item_invalid', true);
    if (seen.has(erpProductId)) throw new SiteCpaQuoteError(400, 'site_cpa_quote_item_invalid');
    seen.add(erpProductId);
    return {
      erpProductId,
      quantity: normalizeQuantity(item?.quantity),
      erpSpecCode: safeQuoteId(item?.erpSpecCode, 'site_cpa_quote_item_invalid'),
      commercialUnit: text(item?.commercialUnit).toUpperCase() || null,
    };
  });
  const requests = customItems.map((item, index) => {
    const description = sanitizeQuoteText(item?.description || item?.name, 300);
    if (!description) throw new SiteCpaQuoteError(400, 'site_cpa_quote_custom_item_invalid');
    return {
      customItemRef: safeQuoteId(item?.customItemRef || `CUSTOM-${index + 1}`, 'site_cpa_quote_custom_item_invalid', true),
      description,
      quantity: normalizeQuantity(item?.quantity),
      commercialUnit: text(item?.commercialUnit).toUpperCase().slice(0, 20) || null,
      specification: sanitizeQuoteText(item?.specification, 500) || null,
    };
  });
  const deliveryMode = normalizeDeliveryMode(data?.deliveryMode);
  const requestedDeliveryDate = text(data?.requestedDeliveryDate);
  if (requestedDeliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDeliveryDate)) {
    throw new SiteCpaQuoteError(400, 'site_cpa_quote_delivery_invalid');
  }
  return {
    externalQuoteId: safeQuoteId(data?.externalQuoteId, 'site_cpa_quote_external_id_invalid', true),
    externalUserId: safeQuoteId(data?.externalUserId || data?.siteUserId, 'site_cpa_quote_customer_invalid', true),
    erpCustomerId: safeQuoteId(data?.erpCustomerId, 'site_cpa_quote_customer_invalid', true),
    source,
    items,
    customItems: requests,
    deliveryMode,
    addressId: safeQuoteId(data?.addressId, 'site_cpa_quote_address_invalid'),
    requestedDeliveryDate: requestedDeliveryDate || null,
    paymentPreference: data?.paymentPreference ?? null,
    purchaseOrderReference: sanitizeQuoteText(data?.purchaseOrderReference, 120) || null,
    obraId: safeQuoteId(data?.obraId, 'site_cpa_quote_work_invalid'),
    projectId: safeQuoteId(data?.projectId, 'site_cpa_quote_project_invalid'),
    costCenterId: safeQuoteId(data?.costCenterId, 'site_cpa_quote_cost_center_invalid'),
    materialListId: safeQuoteId(data?.materialListId, 'site_cpa_quote_reference_invalid'),
    armacaoPackageId: safeQuoteId(data?.armacaoPackageId, 'site_cpa_quote_reference_invalid'),
    armacaoRevision: sanitizeQuoteText(data?.armacaoRevision, 80) || null,
    notes: sanitizeQuoteText(data?.notes) || null,
  };
};

export const normalizeQuoteLookupInput = (payload = {}) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const erpQuoteId = safeQuoteId(data?.erpQuoteId, 'site_cpa_quote_id_invalid');
  const externalQuoteId = safeQuoteId(data?.externalQuoteId, 'site_cpa_quote_id_invalid');
  if (!erpQuoteId && !externalQuoteId) throw new SiteCpaQuoteError(400, 'site_cpa_quote_id_invalid');
  return {
    erpQuoteId,
    externalQuoteId,
    externalUserId: safeQuoteId(data?.externalUserId || data?.siteUserId, 'site_cpa_quote_customer_invalid', true),
    erpCustomerId: safeQuoteId(data?.erpCustomerId, 'site_cpa_quote_customer_invalid', true),
  };
};

export const normalizeNegotiationResponseInput = (payload = {}) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const lookup = normalizeQuoteLookupInput(data);
  const action = normalize(data?.action);
  if (!NEGOTIATION_ACTIONS.has(action)) {
    throw new SiteCpaQuoteError(400, 'site_cpa_negotiation_action_invalid');
  }
  const expectedProposalVersion = Number(data?.expectedProposalVersion);
  if (!Number.isInteger(expectedProposalVersion) || expectedProposalVersion < 1) {
    throw new SiteCpaQuoteError(400, 'site_cpa_negotiation_version_required');
  }
  return {
    ...lookup,
    action,
    expectedProposalVersion,
    externalResponseId: safeQuoteId(data?.externalResponseId, 'site_cpa_negotiation_response_id_invalid', true),
    message: sanitizeQuoteText(data?.message) || null,
    requestedTerms: sanitizeQuoteText(data?.requestedTerms, 500) || null,
  };
};

export const quoteStatus = (quote, now = Date.now()) => {
  const raw = normalize(quote?.site_proposal_status || quote?.status);
  if (raw === 'ACEITO' || raw === 'ACCEPTED') return 'ACCEPTED';
  if (raw === 'RECUSADO' || raw === 'REJECTED') return 'REJECTED';
  if (raw === 'ALTERACAO SOLICITADA' || raw === 'CHANGE_REQUESTED') return 'CHANGE_REQUESTED';
  if (quote?.data_validade && Date.parse(`${quote.data_validade}T23:59:59.999Z`) < now) return 'EXPIRED';
  return quote?.site_proposal_ready === true ? 'CUSTOMER_REVIEW' : 'UNDER_REVIEW';
};

export const buildQuoteResponse = (quote, { includeTimeline = false, replayed = false, now = Date.now() } = {}) => {
  const proposalReady = quote?.site_proposal_ready === true;
  const response = {
    erpQuoteId: quote.id,
    quoteNumber: quote.numero_pedido || null,
    externalQuoteId: quote.origem_externa_id || null,
    sourceType: quote.site_quote_source || null,
    status: quoteStatus(quote, now),
    proposalVersion: Number(quote.proposta_versao || 1),
    validUntil: quote.data_validade || null,
    customer: { erpCustomerId: quote.cliente_id || null },
    seller: {
      sellerId: quote.vendedor_id || null,
      sellerName: quote.vendedor || null,
      assignmentStatus: quote.vendedor_id ? 'ASSIGNED' : 'UNASSIGNED',
    },
    items: (Array.isArray(quote.itens_revenda) ? quote.itens_revenda : []).map((item) => ({
      erpProductId: item.produto_id || null,
      customItemRef: item.custom_item_ref || null,
      description: item.descricao || null,
      quantity: item.quantidade,
      commercialUnit: item.unidade || null,
      unitPrice: item.preco_unitario == null ? null : money(item.preco_unitario),
      lineTotal: item.valor_item == null ? null : money(item.valor_item),
      status: item.status_site || null,
    })),
    totals: {
      subtotal: proposalReady ? money(quote.valor_produtos || 0) : null,
      discount: proposalReady ? money(quote.desconto_geral_pedido_valor || 0) : null,
      freight: quote.frete_status === 'Confirmado' ? money(quote.valor_frete || 0) : null,
      total: proposalReady ? money(quote.valor_total || 0) : null,
    },
    freightStatus: quote.frete_status === 'Pendente' ? 'PENDING' : 'CONFIRMED',
    paymentTerms: quote.forma_pagamento || null,
    deliveryMode: quote.tipo_frete === 'Retirada' ? 'PICKUP' : 'DELIVERY',
    requestedDeliveryDate: quote.data_prevista_entrega || null,
    notesPublic: quote.observacoes_publicas || null,
    linkedOrderId: quote.pedido_convertido_id || null,
    createdAt: quote.created_date || quote.data_pedido || null,
    updatedAt: quote.updated_date || quote.created_date || null,
    source: 'ERP',
    replayed,
  };
  if (includeTimeline) {
    response.timeline = (Array.isArray(quote.negociacao_timeline) ? quote.negociacao_timeline : [])
      .map((event) => ({
        eventId: event.event_id || null,
        type: event.tipo || null,
        actor: event.ator || null,
        proposalVersion: event.proposta_versao || null,
        message: event.mensagem || null,
        createdAt: event.data_hora || null,
      }));
  }
  return response;
};
