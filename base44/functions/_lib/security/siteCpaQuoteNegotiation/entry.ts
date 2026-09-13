import {
  SiteCpaCustomerError,
  buildCustomerAddresses,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
  resolveSiteCpaSeller,
} from '../siteCpaCustomerResolve/entry.ts';
import {
  SiteCpaCatalogError,
  resolveSiteCpaCatalog,
} from '../siteCpaCatalogRead/entry.ts';
import {
  SiteCpaOrderError,
  resolveSiteCpaOrderCreate,
} from '../siteCpaOrderCreate/entry.ts';
import {
  QUOTE_OPERATIONS,
  SITE_CPA_NEGOTIATION_GET_OPERATION,
  SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_QUOTE_GET_OPERATION,
  SiteCpaQuoteError,
  buildQuoteResponse,
  normalizeNegotiationResponseInput,
  normalizeQuoteCreateInput,
  normalizeQuoteLookupInput,
  quoteStatus,
} from './contract.ts';
import { ensureQuoteOpportunity } from './crm.ts';

export {
  SITE_CPA_NEGOTIATION_GET_OPERATION,
  SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_QUOTE_GET_OPERATION,
  SiteCpaQuoteError,
  buildQuoteResponse,
  normalizeNegotiationResponseInput,
  normalizeQuoteCreateInput,
  normalizeQuoteLookupInput,
} from './contract.ts';

const BUYER_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR']);
const CHANGE_ACTIONS = new Set(['REQUEST_BETTER_PRICE', 'REQUEST_CHANGE', 'COUNTER_PROPOSAL']);
const DEFAULT_VALIDITY_DAYS = 7;
const text = (value) => String(value ?? '').trim();
const money = (value) => Math.round(Number(value) * 100) / 100;

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = async (value, cryptoApi = globalThis.crypto) => {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const assertMultiple = (quantity, multiple) => {
  if (!multiple || multiple <= 0) return true;
  const ratio = quantity / multiple;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
};

const mapDependencyError = (error) => {
  if (error instanceof SiteCpaQuoteError) return error;
  if (error instanceof SiteCpaCustomerError) {
    return new SiteCpaQuoteError(error.status === 503 ? 503 : 403, 'site_cpa_quote_customer_invalid');
  }
  if (error instanceof SiteCpaCatalogError) {
    return new SiteCpaQuoteError(error.status, error.code === 'site_cpa_catalog_scope_forbidden'
      ? 'site_cpa_quote_scope_forbidden' : 'site_cpa_quote_catalog_unavailable');
  }
  if (error instanceof SiteCpaOrderError) {
    const orderCode = error.code === 'site_cpa_order_price_changed'
      ? 'site_cpa_quote_proposal_stale'
      : error.code === 'site_cpa_order_stock_changed'
        ? 'site_cpa_quote_stock_changed'
        : 'site_cpa_quote_conversion_blocked';
    return new SiteCpaQuoteError(error.status, orderCode, error.message, error.details);
  }
  return new SiteCpaQuoteError(503, 'site_cpa_quote_unavailable');
};

const auditQuote = async ({ base44, scope, request, quote, input, outcome, success }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Atualizacao' : 'Bloqueio',
      modulo: 'Comercial',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'Pedido',
      registro_id: quote?.id || null,
      descricao: `${request?.operation || 'siteQuote'} ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_novos: {
        operation: request?.operation || null,
        correlation_id: request?.correlationId || null,
        external_quote_id: input?.externalQuoteId || quote?.origem_externa_id || null,
        customer_id: input?.erpCustomerId || quote?.cliente_id || null,
        quote_id: quote?.id || null,
        item_count: input?.items?.length || quote?.itens_revenda?.length || 0,
        proposal_version: Number(quote?.proposta_versao || input?.expectedProposalVersion || 1),
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_audit_unavailable');
  }
};

const resolveCustomer = async ({ base44, scope, input }) => {
  const context = await resolveApprovedSiteCustomerContext({
    base44,
    scope,
    erpCustomerId: input.erpCustomerId,
    externalUserId: input.externalUserId,
  });
  if (!BUYER_ROLES.has(context.role)) {
    throw new SiteCpaQuoteError(403, 'site_cpa_quote_customer_invalid');
  }
  return context;
};

const validateReference = async ({ base44, scope, entityName, id, customerId, requireCustomer }) => {
  if (!id) return null;
  let rows;
  try {
    rows = await base44.asServiceRole.entities[entityName].filter({
      id,
      group_id: scope.groupId,
    }, undefined, 2);
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_quote_unavailable');
  }
  const record = (Array.isArray(rows) ? rows : []).find((item) => customerBelongsToScope(item, scope));
  const ownerId = text(record?.cliente_id || record?.customer_id);
  if (!record || (ownerId && ownerId !== customerId) || (requireCustomer && !ownerId)) {
    throw new SiteCpaQuoteError(403, 'site_cpa_quote_scope_forbidden');
  }
  return record;
};

const resolveCatalogItems = async ({ base44, scope, request, input, now }) => {
  if (!input.items.length) return { items: [], tableId: null, tableName: null, needsReview: false };
  const catalog = await resolveSiteCpaCatalog({
    base44,
    scope,
    request,
    now,
    payload: { data: {
      productIds: input.items.map((item) => item.erpProductId),
      page: 1,
      pageSize: input.items.length,
      erpCustomerId: input.erpCustomerId,
      externalUserId: input.externalUserId,
    } },
  });
  const byId = new Map(catalog.items.map((item) => [text(item.erpProductId), item]));
  let needsReview = false;
  const items = input.items.map((requested) => {
    const product = byId.get(requested.erpProductId);
    if (!product || !product.active) throw new SiteCpaQuoteError(422, 'site_cpa_quote_item_invalid');
    if (requested.erpSpecCode && requested.erpSpecCode !== text(product.erpSpecCode)) {
      throw new SiteCpaQuoteError(422, 'site_cpa_quote_item_invalid');
    }
    if (requested.commercialUnit && requested.commercialUnit !== text(product.commercialUnit).toUpperCase()) {
      throw new SiteCpaQuoteError(422, 'site_cpa_quote_item_invalid');
    }
    if (product.minQty && requested.quantity < product.minQty) {
      throw new SiteCpaQuoteError(422, 'site_cpa_quote_item_invalid');
    }
    if (!assertMultiple(requested.quantity, product.saleMultiple)) {
      throw new SiteCpaQuoteError(422, 'site_cpa_quote_item_invalid');
    }
    const unitPrice = product.price == null ? null : money(product.price);
    if (unitPrice === null) needsReview = true;
    return {
      produto_id: product.erpProductId,
      codigo_sku: product.sku,
      descricao: product.name,
      unidade: product.commercialUnit,
      especificacao_codigo: product.erpSpecCode,
      quantidade: requested.quantity,
      preco_unitario: unitPrice,
      valor_item: unitPrice === null ? null : money(unitPrice * requested.quantity),
      status_site: unitPrice === null ? 'PRICE_REVIEW_REQUIRED' : 'QUOTED',
    };
  });
  return {
    items,
    tableId: catalog.items.find((item) => item.priceTableId)?.priceTableId || null,
    tableName: catalog.items.find((item) => item.priceTableName)?.priceTableName || null,
    needsReview,
  };
};

const resolvePaymentTerms = (customer, preference) => {
  const commercial = customer?.condicao_comercial || {};
  const id = text(commercial.forma_pagamento_padrao_id) || null;
  const name = text(commercial.forma_pagamento_padrao_nome || commercial.condicao_pagamento) || null;
  const requested = typeof preference === 'object'
    ? text(preference?.paymentMethodId || preference?.id)
    : text(preference);
  if (requested && ![id, name].filter(Boolean).includes(requested)) {
    throw new SiteCpaQuoteError(422, 'site_cpa_quote_payment_condition_invalid');
  }
  return { id, name };
};

const loadQuote = async ({ base44, scope, input }) => {
  const filter = {
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    tipo: 'Orçamento',
    origem_pedido: 'SITE_CPA',
    ...(input.erpQuoteId ? { id: input.erpQuoteId } : { origem_externa_id: input.externalQuoteId }),
  };
  let rows;
  try {
    rows = await base44.asServiceRole.entities.Pedido.filter(filter, '-created_date', 2);
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_quote_unavailable');
  }
  const quote = (Array.isArray(rows) ? rows : []).find((item) => customerBelongsToScope(item, scope));
  if (!quote) throw new SiteCpaQuoteError(404, 'site_cpa_quote_not_found');
  if (text(quote.cliente_id) !== input.erpCustomerId
    || text(quote.site_external_user_id) !== input.externalUserId) {
    throw new SiteCpaQuoteError(403, 'site_cpa_quote_scope_forbidden');
  }
  return quote;
};

const createQuote = async ({ base44, payload, scope, request, now }) => {
  const input = normalizeQuoteCreateInput(payload);
  const customerContext = await resolveCustomer({ base44, scope, input });
  const payloadHash = await sha256(stableStringify(input));
  const existingRows = await base44.asServiceRole.entities.Pedido.filter({
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    tipo: 'Orçamento',
    origem_pedido: 'SITE_CPA',
    origem_externa_id: input.externalQuoteId,
  }, '-created_date', 2);
  const existing = (Array.isArray(existingRows) ? existingRows : [])[0] || null;
  if (existing) {
    const sameOwner = text(existing.cliente_id) === input.erpCustomerId
      && text(existing.site_external_user_id) === input.externalUserId;
    if (!sameOwner || text(existing.origem_payload_hash) !== payloadHash) {
      throw new SiteCpaQuoteError(409, 'site_cpa_quote_idempotency_conflict');
    }
    await ensureQuoteOpportunity({ base44, scope, quote: existing });
    await auditQuote({ base44, scope, request, input, quote: existing, outcome: 'quote_replayed', success: true });
    return buildQuoteResponse(existing, { replayed: true, now });
  }

  const addresses = buildCustomerAddresses(customerContext.customer);
  let address = null;
  if (input.deliveryMode === 'DELIVERY') {
    address = addresses.find((item) => text(item.addressId) === input.addressId) || null;
    if (!address) throw new SiteCpaQuoteError(403, 'site_cpa_quote_address_invalid');
  }
  if (input.obraId && !addresses.some((item) => text(item.addressId) === input.obraId && item.type === 'OBRA')) {
    throw new SiteCpaQuoteError(403, 'site_cpa_quote_work_invalid');
  }
  await validateReference({
    base44, scope, entityName: 'Projeto', id: input.projectId,
    customerId: input.erpCustomerId, requireCustomer: true,
  });
  await validateReference({
    base44, scope, entityName: 'CentroCusto', id: input.costCenterId,
    customerId: input.erpCustomerId, requireCustomer: false,
  });

  const catalog = await resolveCatalogItems({ base44, scope, request, input, now });
  const customItems = input.customItems.map((item) => ({
    produto_id: null,
    custom_item_ref: item.customItemRef,
    descricao: item.description,
    especificacao_solicitada: item.specification,
    unidade: item.commercialUnit,
    quantidade: item.quantity,
    preco_unitario: null,
    valor_item: null,
    status_site: 'SELLER_REVIEW_REQUIRED',
  }));
  const seller = await resolveSiteCpaSeller(base44, scope, customerContext.customer);
  const payment = resolvePaymentTerms(customerContext.customer, input.paymentPreference);
  const productTotal = money(catalog.items.reduce((sum, item) => sum + Number(item.valor_item || 0), 0));
  const freightPending = input.deliveryMode === 'DELIVERY';
  const proposalReady = !catalog.needsReview && !customItems.length && !freightPending && Boolean(seller.sellerId);
  const createdAt = new Date(now).toISOString();
  const validUntil = new Date(now + DEFAULT_VALIDITY_DAYS * 86400000).toISOString().slice(0, 10);
  const safeExternal = input.externalQuoteId.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24).toUpperCase();
  const quoteNumber = `ORC-SITE-${safeExternal}-${payloadHash.slice(0, 8).toUpperCase()}`;
  const proposalSnapshot = {
    versao: 1,
    status: proposalReady ? 'CUSTOMER_REVIEW' : 'UNDER_REVIEW',
    data_hora: createdAt,
    data_validade: validUntil,
    valor_produtos: productTotal,
    valor_frete: freightPending ? null : 0,
    valor_total: proposalReady ? productTotal : null,
    itens: [...catalog.items, ...customItems],
    tabela_preco_id: catalog.tableId,
  };
  const quotePayload = {
    numero_pedido: quoteNumber,
    tipo: 'Orçamento',
    tipo_pedido: 'Revenda',
    origem: 'SITE_CPA',
    origem_pedido: 'SITE_CPA',
    canal_venda: 'Site B2B',
    origem_externa_id: input.externalQuoteId,
    origem_payload_hash: payloadHash,
    site_external_user_id: input.externalUserId,
    site_quote_source: input.source,
    contract_version: '1',
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    cliente_id: customerContext.customer.id,
    cliente_nome: text(customerContext.customer.razao_social
      || customerContext.customer.nome_fantasia || customerContext.customer.nome),
    vendedor_id: seller.sellerId,
    vendedor: seller.sellerName,
    data_pedido: createdAt.slice(0, 10),
    data_validade: validUntil,
    data_prevista_entrega: input.requestedDeliveryDate,
    status: proposalReady ? 'Aguardando Aprovação' : 'Em Análise',
    status_aprovacao: 'pendente',
    site_proposal_status: proposalReady ? 'CUSTOMER_REVIEW' : 'UNDER_REVIEW',
    site_proposal_ready: proposalReady,
    proposta_versao: 1,
    proposta_historico: [proposalSnapshot],
    negociacao_timeline: [{
      event_id: `CREATED-${payloadHash.slice(0, 16)}`,
      tipo: 'QUOTE_CREATED',
      ator: 'SITE_CPA',
      proposta_versao: 1,
      mensagem: null,
      data_hora: createdAt,
    }],
    tipo_frete: input.deliveryMode === 'PICKUP' ? 'Retirada' : 'CIF',
    frete_status: freightPending ? 'Pendente' : 'Confirmado',
    valor_frete: 0,
    endereco_entrega_principal: address,
    forma_pagamento_id: payment.id,
    forma_pagamento: payment.name,
    tabela_preco_id: catalog.tableId,
    tabela_preco_nome: catalog.tableName,
    itens_revenda: [...catalog.items, ...customItems],
    valor_produtos: productTotal,
    valor_total: productTotal,
    desconto_geral_pedido_percentual: 0,
    desconto_geral_pedido_valor: 0,
    ordem_compra_cliente: input.purchaseOrderReference,
    obra_destino_id: input.obraId,
    projeto_id: input.projectId,
    centro_custo_id: input.costCenterId,
    site_material_list_id: input.materialListId,
    site_armacao_package_id: input.armacaoPackageId,
    site_armacao_revision: input.armacaoRevision,
    observacoes_publicas: input.notes,
    reserva_estoque_ao_criar: false,
    pagamento_confirmado: false,
  };
  await auditQuote({ base44, scope, request, input, outcome: 'quote_requested', success: true });
  let created;
  try {
    created = await base44.asServiceRole.entities.Pedido.create(quotePayload);
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_quote_unavailable');
  }
  const quote = { ...quotePayload, ...created };
  await ensureQuoteOpportunity({ base44, scope, quote });
  await auditQuote({ base44, scope, request, input, quote, outcome: 'quote_created', success: true });
  return buildQuoteResponse(quote, { now });
};

const getQuote = async ({ base44, payload, scope, request, now, includeTimeline }) => {
  const input = normalizeQuoteLookupInput(payload);
  await resolveCustomer({ base44, scope, input });
  const quote = await loadQuote({ base44, scope, input });
  await auditQuote({ base44, scope, request, input, quote, outcome: 'quote_read', success: true });
  return buildQuoteResponse(quote, { includeTimeline, now });
};

const appendChangeRequest = async ({ base44, scope, input, quote, request, now }) => {
  const timeline = Array.isArray(quote.negociacao_timeline) ? quote.negociacao_timeline : [];
  const existing = timeline.find((item) => text(item.event_id) === input.externalResponseId);
  if (existing) return buildQuoteResponse(quote, { includeTimeline: true, replayed: true, now });
  const approvalPayload = {
    tipo_solicitacao: 'revisao_orcamento_site',
    entidade_alvo: 'Pedido',
    entidade_alvo_id: quote.id,
    status: 'pendente',
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    solicitante: 'SITE_CPA',
    motivo: input.message || input.requestedTerms || input.action,
    dados_propostos: {
      source: 'SITE_CPA',
      action: input.action,
      external_response_id: input.externalResponseId,
      proposal_version: input.expectedProposalVersion,
      requested_terms: input.requestedTerms,
    },
  };
  try {
    await base44.asServiceRole.entities.SolicitacaoAprovacao.create(approvalPayload);
  } catch {
    throw new SiteCpaQuoteError(503, 'site_cpa_negotiation_unavailable');
  }
  const event = {
    event_id: input.externalResponseId,
    tipo: input.action,
    ator: 'CUSTOMER',
    proposta_versao: input.expectedProposalVersion,
    mensagem: input.message || input.requestedTerms,
    data_hora: new Date(now).toISOString(),
  };
  const updated = await base44.asServiceRole.entities.Pedido.update(quote.id, {
    status: 'Alteração Solicitada',
    status_aprovacao: 'pendente',
    site_proposal_status: 'CHANGE_REQUESTED',
    negociacao_timeline: [...timeline, event],
  });
  const result = { ...quote, ...updated };
  await auditQuote({ base44, scope, request, input, quote: result, outcome: input.action.toLowerCase(), success: true });
  return buildQuoteResponse(result, { includeTimeline: true, now });
};

const acceptQuote = async ({ base44, scope, input, quote, request, now }) => {
  if (!quote.site_proposal_ready || quoteStatus(quote, now) !== 'CUSTOMER_REVIEW') {
    throw new SiteCpaQuoteError(422, 'site_cpa_quote_not_acceptable');
  }
  const catalogItems = (Array.isArray(quote.itens_revenda) ? quote.itens_revenda : []);
  if (!catalogItems.length || catalogItems.some((item) => !item.produto_id || item.preco_unitario == null)) {
    throw new SiteCpaQuoteError(422, 'site_cpa_quote_not_acceptable');
  }
  const order = await resolveSiteCpaOrderCreate({
    base44,
    scope,
    request,
    now,
    payload: { data: {
      externalOrderId: `QUOTE-${quote.origem_externa_id}`,
      externalUserId: input.externalUserId,
      erpCustomerId: input.erpCustomerId,
      items: catalogItems.map((item) => ({
        erpProductId: item.produto_id,
        quantity: item.quantidade,
        erpSpecCode: item.especificacao_codigo || null,
        commercialUnit: item.unidade || null,
        unitPrice: item.preco_unitario,
      })),
      deliveryMode: quote.tipo_frete === 'Retirada' ? 'PICKUP' : 'DELIVERY',
      addressId: quote.endereco_entrega_principal?.addressId || quote.endereco_entrega_principal?.id || null,
      requestedDeliveryDate: quote.data_prevista_entrega || null,
      paymentPreference: quote.forma_pagamento_id || quote.forma_pagamento || null,
      purchaseOrderReference: quote.ordem_compra_cliente || null,
      obraId: quote.obra_destino_id || null,
      projectId: quote.projeto_id || null,
      costCenterId: quote.centro_custo_id || null,
      notes: `Convertido do orçamento ${quote.numero_pedido || quote.id}`,
    } },
  });
  const timeline = Array.isArray(quote.negociacao_timeline) ? quote.negociacao_timeline : [];
  const event = {
    event_id: input.externalResponseId,
    tipo: 'ACCEPTED',
    ator: 'CUSTOMER',
    proposta_versao: input.expectedProposalVersion,
    mensagem: input.message,
    data_hora: new Date(now).toISOString(),
  };
  const updated = await base44.asServiceRole.entities.Pedido.update(quote.id, {
    status: 'Aceito',
    status_aprovacao: 'aprovado',
    site_proposal_status: 'ACCEPTED',
    data_aprovacao: event.data_hora,
    pedido_convertido_id: order.erpOrderId,
    negociacao_timeline: [...timeline, event],
  });
  const result = { ...quote, ...updated };
  await auditQuote({ base44, scope, request, input, quote: result, outcome: 'quote_accepted', success: true });
  return { ...buildQuoteResponse(result, { includeTimeline: true, now }), order };
};

const rejectQuote = async ({ base44, scope, input, quote, request, now }) => {
  const timeline = Array.isArray(quote.negociacao_timeline) ? quote.negociacao_timeline : [];
  const event = {
    event_id: input.externalResponseId,
    tipo: 'REJECTED',
    ator: 'CUSTOMER',
    proposta_versao: input.expectedProposalVersion,
    mensagem: input.message,
    data_hora: new Date(now).toISOString(),
  };
  const updated = await base44.asServiceRole.entities.Pedido.update(quote.id, {
    status: 'Recusado',
    status_aprovacao: 'rejeitado',
    site_proposal_status: 'REJECTED',
    negociacao_timeline: [...timeline, event],
  });
  const result = { ...quote, ...updated };
  await auditQuote({ base44, scope, request, input, quote: result, outcome: 'quote_rejected', success: true });
  return buildQuoteResponse(result, { includeTimeline: true, now });
};

const respondNegotiation = async ({ base44, payload, scope, request, now }) => {
  const input = normalizeNegotiationResponseInput(payload);
  await resolveCustomer({ base44, scope, input });
  const quote = await loadQuote({ base44, scope, input });
  const version = Number(quote.proposta_versao || 1);
  if (version !== input.expectedProposalVersion) {
    throw new SiteCpaQuoteError(409, 'site_cpa_negotiation_version_conflict', undefined, {
      currentProposalVersion: version,
    });
  }
  const timeline = Array.isArray(quote.negociacao_timeline) ? quote.negociacao_timeline : [];
  if (timeline.some((event) => text(event.event_id) === input.externalResponseId)) {
    return buildQuoteResponse(quote, { includeTimeline: true, replayed: true, now });
  }
  const currentStatus = quoteStatus(quote, now);
  if (currentStatus === 'EXPIRED') throw new SiteCpaQuoteError(410, 'site_cpa_quote_expired');
  if (currentStatus === 'ACCEPTED' || currentStatus === 'REJECTED') {
    throw new SiteCpaQuoteError(409, 'site_cpa_negotiation_closed');
  }
  if (CHANGE_ACTIONS.has(input.action)) {
    return appendChangeRequest({ base44, scope, input, quote, request, now });
  }
  if (input.action === 'ACCEPT') {
    return acceptQuote({ base44, scope, input, quote, request, now });
  }
  return rejectQuote({ base44, scope, input, quote, request, now });
};

export const resolveSiteCpaQuoteOperation = async ({
  base44,
  payload = {},
  scope,
  request,
  now = Date.now(),
} = {}) => {
  if (!QUOTE_OPERATIONS.has(request?.operation)) {
    throw new SiteCpaQuoteError(501, 'site_cpa_quote_operation_not_implemented');
  }
  try {
    if (request.operation === SITE_CPA_QUOTE_CREATE_OPERATION) {
      return await createQuote({ base44, payload, scope, request, now });
    }
    if (request.operation === SITE_CPA_QUOTE_GET_OPERATION) {
      return await getQuote({ base44, payload, scope, request, now, includeTimeline: false });
    }
    if (request.operation === SITE_CPA_NEGOTIATION_GET_OPERATION) {
      return await getQuote({ base44, payload, scope, request, now, includeTimeline: true });
    }
    return await respondNegotiation({ base44, payload, scope, request, now });
  } catch (error) {
    const failure = mapDependencyError(error);
    if (failure.code !== 'site_cpa_audit_unavailable') {
      let input = null;
      try {
        input = request.operation === SITE_CPA_QUOTE_CREATE_OPERATION
          ? normalizeQuoteCreateInput(payload)
          : request.operation === SITE_CPA_NEGOTIATION_RESPOND_OPERATION
            ? normalizeNegotiationResponseInput(payload)
            : normalizeQuoteLookupInput(payload);
      } catch {
        // Invalid payloads are already represented by the stable outer failure.
      }
      if (input) {
        await auditQuote({ base44, scope, request, input, outcome: failure.code, success: false });
      }
    }
    throw failure;
  }
};
