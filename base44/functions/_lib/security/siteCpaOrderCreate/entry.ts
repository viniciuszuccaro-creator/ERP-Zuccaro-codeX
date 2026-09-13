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

export const SITE_CPA_ORDER_CREATE_OPERATION = 'sitePedidoCreate';

const MAX_ITEMS = 50;
const MAX_NOTES_LENGTH = 1000;
const MAX_REFERENCE_LENGTH = 120;
const BUYER_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR']);
const text = (value) => String(value ?? '').trim();
const money = (value) => Math.round(Number(value) * 100) / 100;
const normalize = (value) => text(value)
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const updatedAt = (record) => record?.updated_date || record?.updatedAt || record?.created_date || null;

export class SiteCpaOrderError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaOrderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const id = text(value);
  if ((!id && required) || id.length > 160 || (id && !/^[A-Za-z0-9._:@/-]+$/.test(id))) {
    throw new SiteCpaOrderError(400, code);
  }
  return id || null;
};

const sanitizeText = (value, maxLength) => text(value)
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .slice(0, maxLength);

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

const normalizeDeliveryMode = (value) => {
  const mode = normalize(value);
  if (mode === 'DELIVERY' || mode === 'ENTREGA') return 'DELIVERY';
  if (mode === 'PICKUP' || mode === 'RETIRADA') return 'PICKUP';
  throw new SiteCpaOrderError(400, 'site_cpa_order_delivery_mode_invalid');
};

const normalizeRequestedDate = (value, now) => {
  if (!text(value)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) {
    throw new SiteCpaOrderError(400, 'site_cpa_order_delivery_date_invalid');
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || parsed < new Date(now).setUTCHours(0, 0, 0, 0)) {
    throw new SiteCpaOrderError(400, 'site_cpa_order_delivery_date_invalid');
  }
  return text(value);
};

export const normalizeSiteCpaOrderInput = (payload = {}, now = Date.now()) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const externalOrderId = safeId(data?.externalOrderId, 'site_cpa_order_external_id_invalid', true);
  const externalUserId = safeId(
    data?.externalUserId || data?.siteUserId,
    'site_cpa_order_customer_invalid',
    true,
  );
  const erpCustomerId = safeId(data?.erpCustomerId, 'site_cpa_order_customer_invalid', true);
  if (!Array.isArray(data?.items) || data.items.length < 1 || data.items.length > MAX_ITEMS) {
    throw new SiteCpaOrderError(400, 'site_cpa_order_item_invalid');
  }
  const seen = new Set();
  const items = data.items.map((item) => {
    const erpProductId = safeId(item?.erpProductId, 'site_cpa_order_item_invalid', true);
    if (seen.has(erpProductId)) throw new SiteCpaOrderError(400, 'site_cpa_order_item_invalid');
    seen.add(erpProductId);
    const quantity = Number(item?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new SiteCpaOrderError(400, 'site_cpa_order_item_invalid');
    }
    const submittedPrice = item?.unitPrice ?? item?.expectedUnitPrice;
    if (submittedPrice !== undefined && submittedPrice !== null && submittedPrice !== '') {
      const parsed = Number(submittedPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new SiteCpaOrderError(400, 'site_cpa_order_item_invalid');
      }
    }
    return {
      erpProductId,
      quantity,
      erpSpecCode: safeId(item?.erpSpecCode, 'site_cpa_order_item_invalid'),
      commercialUnit: text(item?.commercialUnit).toUpperCase() || null,
      submittedPrice: submittedPrice === undefined || submittedPrice === null || submittedPrice === ''
        ? null
        : money(submittedPrice),
    };
  });
  const notes = sanitizeText(data?.notes, MAX_NOTES_LENGTH);
  const purchaseOrderReference = sanitizeText(data?.purchaseOrderReference, MAX_REFERENCE_LENGTH);
  return {
    externalOrderId,
    externalUserId,
    erpCustomerId,
    items,
    deliveryMode: normalizeDeliveryMode(data?.deliveryMode),
    addressId: safeId(data?.addressId, 'site_cpa_order_address_invalid'),
    requestedDeliveryDate: normalizeRequestedDate(data?.requestedDeliveryDate, now),
    paymentPreference: data?.paymentPreference ?? null,
    purchaseOrderReference: purchaseOrderReference || null,
    obraId: safeId(data?.obraId, 'site_cpa_order_work_invalid'),
    projectId: safeId(data?.projectId, 'site_cpa_order_project_invalid'),
    costCenterId: safeId(data?.costCenterId, 'site_cpa_order_cost_center_invalid'),
    notes: notes || null,
  };
};

const loadScopedProducts = async (base44, scope, productIds) => {
  let rows;
  try {
    rows = await base44.asServiceRole.entities.Produto.filter({
      group_id: scope.groupId,
      id: { $in: productIds },
    }, undefined, productIds.length);
  } catch {
    throw new SiteCpaOrderError(503, 'site_cpa_order_stock_unavailable');
  }
  return (Array.isArray(rows) ? rows : []).filter((row) => customerBelongsToScope(row, scope));
};

const assertMultiple = (quantity, multiple) => {
  if (!multiple || multiple <= 0) return true;
  const ratio = quantity / multiple;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
};

const resolveOrderItems = async ({ base44, scope, input, request, now }) => {
  let catalog;
  try {
    catalog = await resolveSiteCpaCatalog({
      base44,
      scope,
      request,
      now,
      payload: {
        data: {
          productIds: input.items.map((item) => item.erpProductId),
          page: 1,
          pageSize: input.items.length,
          erpCustomerId: input.erpCustomerId,
          externalUserId: input.externalUserId,
        },
      },
    });
  } catch (error) {
    if (error instanceof SiteCpaCatalogError) {
      const code = error.code === 'site_cpa_customer_context_invalid'
        ? 'site_cpa_order_customer_invalid'
        : error.code === 'site_cpa_catalog_scope_forbidden'
          ? 'site_cpa_order_scope_forbidden'
          : 'site_cpa_order_unavailable';
      throw new SiteCpaOrderError(error.status, code);
    }
    throw new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
  }
  const catalogById = new Map(catalog.items.map((item) => [text(item.erpProductId), item]));
  const products = await loadScopedProducts(base44, scope, input.items.map((item) => item.erpProductId));
  const productsById = new Map(products.map((item) => [text(item.id), item]));
  const priceChanges = [];
  const stockChanges = [];
  const confirmed = input.items.map((requested) => {
    const item = catalogById.get(requested.erpProductId);
    const product = productsById.get(requested.erpProductId);
    if (!item || !product || !item.active) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_item_invalid');
    }
    if (item.availability === 'UNKNOWN') {
      throw new SiteCpaOrderError(503, 'site_cpa_order_stock_unavailable');
    }
    if (item.quoteRequired || !item.sellable || item.price === null) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_quote_required', undefined, {
        erpProductId: requested.erpProductId,
      });
    }
    if (requested.erpSpecCode && requested.erpSpecCode !== text(item.erpSpecCode)) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_item_invalid');
    }
    if (requested.commercialUnit && requested.commercialUnit !== text(item.commercialUnit).toUpperCase()) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_item_invalid');
    }
    if (item.minQty && requested.quantity < item.minQty) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_item_invalid');
    }
    if (!assertMultiple(requested.quantity, item.saleMultiple)) {
      throw new SiteCpaOrderError(422, 'site_cpa_order_item_invalid');
    }
    if (requested.submittedPrice !== null && requested.submittedPrice !== money(item.price)) {
      priceChanges.push({
        erpProductId: requested.erpProductId,
        currentUnitPrice: money(item.price),
        commercialUnit: item.commercialUnit,
      });
    }
    const onHand = Number(product.estoque_atual);
    const reserved = Number(product.estoque_reservado ?? product.quantidade_reservada ?? 0);
    const explicitAvailable = product.estoque_disponivel;
    const available = explicitAvailable === null || explicitAvailable === undefined || explicitAvailable === ''
      ? (Number.isFinite(onHand) ? onHand - (Number.isFinite(reserved) ? reserved : 0) : null)
      : Number(explicitAvailable);
    const orderable = product.permite_encomenda === true || product.sob_encomenda === true;
    if (available === null || !Number.isFinite(available)) {
      throw new SiteCpaOrderError(503, 'site_cpa_order_stock_unavailable');
    }
    if (available < requested.quantity && !orderable) {
      stockChanges.push({
        erpProductId: requested.erpProductId,
        availability: available > 0 ? 'PARTIAL' : 'OUT_OF_STOCK',
      });
    }
    const lineTotal = money(item.price * requested.quantity);
    return {
      produto_id: product.id,
      codigo_sku: item.sku,
      descricao: item.name,
      unidade: item.commercialUnit,
      especificacao_codigo: item.erpSpecCode,
      quantidade: requested.quantity,
      preco_base_produto: money(item.price),
      preco_tabela: item.priceSource === 'CUSTOMER_PRICE_TABLE' ? money(item.price) : null,
      preco_unitario_bruto: money(item.price),
      preco_unitario: money(item.price),
      valor_item: lineTotal,
      situacao_item: available >= requested.quantity ? 'Em Estoque' : 'Sob Encomenda',
      status_site: available >= requested.quantity ? 'CONFIRMED' : 'AVAILABLE_TO_ORDER',
    };
  });
  if (priceChanges.length) {
    throw new SiteCpaOrderError(409, 'site_cpa_order_price_changed', 'PRICE_CHANGED', {
      state: 'PRICE_CHANGED',
      items: priceChanges,
    });
  }
  if (stockChanges.length) {
    throw new SiteCpaOrderError(409, 'site_cpa_order_stock_changed', 'STOCK_CHANGED', {
      state: 'STOCK_CHANGED',
      items: stockChanges,
    });
  }
  return {
    items: confirmed,
    tableId: catalog.items.find((item) => item.priceTableId)?.priceTableId || null,
    tableName: catalog.items.find((item) => item.priceTableName)?.priceTableName || null,
  };
};

const resolvePaymentCondition = async ({ base44, scope, customer, preference }) => {
  const commercial = customer?.condicao_comercial || {};
  const officialId = text(commercial.forma_pagamento_padrao_id);
  const officialName = text(
    commercial.forma_pagamento_padrao_nome || commercial.condicao_pagamento,
  );
  const requestedId = typeof preference === 'object'
    ? text(preference?.paymentMethodId || preference?.id)
    : text(preference);
  if (!officialId && !officialName) {
    throw new SiteCpaOrderError(422, 'site_cpa_order_payment_condition_invalid');
  }
  if (requestedId && ![officialId, officialName].filter(Boolean).includes(requestedId)) {
    throw new SiteCpaOrderError(422, 'site_cpa_order_payment_condition_invalid');
  }
  if (!officialId) return { id: null, name: officialName, creditRequired: normalize(officialName) !== 'A VISTA' };
  let methods;
  try {
    methods = await base44.asServiceRole.entities.FormaPagamento.filter({
      id: officialId,
      group_id: scope.groupId,
    }, undefined, 2);
  } catch {
    throw new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
  }
  const method = (Array.isArray(methods) ? methods : []).find((item) => (
    customerBelongsToScope(item, scope) && item?.ativo !== false
  ));
  if (!method) throw new SiteCpaOrderError(422, 'site_cpa_order_payment_condition_invalid');
  const name = text(method.descricao || method.nome || officialName);
  return { id: method.id, name, creditRequired: normalize(name) !== 'A VISTA' };
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
    throw new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
  }
  const record = (Array.isArray(rows) ? rows : []).find((item) => customerBelongsToScope(item, scope));
  const ownerId = text(record?.cliente_id || record?.customer_id);
  if (!record || (ownerId && ownerId !== customerId) || (requireCustomer && !ownerId)) {
    throw new SiteCpaOrderError(403, 'site_cpa_order_scope_forbidden');
  }
  return record;
};

const auditOrder = async ({ base44, scope, request, input, order, outcome, success }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Criacao' : 'Bloqueio',
      modulo: 'Comercial',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'Pedido',
      registro_id: order?.id || null,
      descricao: `sitePedidoCreate ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_novos: {
        operation: SITE_CPA_ORDER_CREATE_OPERATION,
        correlation_id: request?.correlationId || null,
        external_order_id: input?.externalOrderId || null,
        customer_id: input?.erpCustomerId || null,
        order_id: order?.id || null,
        item_count: input?.items?.length || 0,
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaOrderError(503, 'site_cpa_audit_unavailable');
  }
};

const orderResponse = (order, replayed = false) => ({
  erpOrderId: order.id,
  orderNumber: order.numero_pedido || null,
  externalOrderId: order.origem_externa_id || null,
  status: order.status,
  createdAt: order.created_date || order.data_pedido || null,
  seller: {
    sellerId: order.vendedor_id || null,
    sellerName: order.vendedor || null,
    assignmentStatus: order.vendedor_id ? 'ASSIGNED' : 'UNASSIGNED',
  },
  totals: {
    products: money(order.valor_produtos || 0),
    freight: money(order.valor_frete || 0),
    total: money(order.valor_total || 0),
  },
  items: (Array.isArray(order.itens_revenda) ? order.itens_revenda : []).map((item) => ({
    erpProductId: item.produto_id,
    quantity: item.quantidade,
    commercialUnit: item.unidade,
    unitPrice: money(item.preco_unitario),
    lineTotal: money(item.valor_item),
    status: item.status_site || 'CONFIRMED',
  })),
  deliveryMode: order.tipo_frete === 'Retirada' ? 'PICKUP' : 'DELIVERY',
  requestedDeliveryDate: order.data_prevista_entrega || null,
  paymentStatus: 'PENDING',
  nextAction: order.frete_status === 'Pendente'
    ? 'FREIGHT_CONFIRMATION'
    : order.vendedor_id ? 'ORDER_APPROVAL' : 'SELLER_ASSIGNMENT',
  source: 'ERP',
  replayed,
});

export const resolveSiteCpaOrderCreate = async ({
  base44,
  payload = {},
  scope,
  request,
  now = Date.now(),
} = {}) => {
  let input;
  try {
    input = normalizeSiteCpaOrderInput(payload, now);
    const customerContext = await resolveApprovedSiteCustomerContext({
      base44,
      scope,
      erpCustomerId: input.erpCustomerId,
      externalUserId: input.externalUserId,
    });
    if (!BUYER_ROLES.has(customerContext.role)) {
      throw new SiteCpaOrderError(403, 'site_cpa_order_customer_invalid');
    }
    const payloadHash = await sha256(stableStringify(input));
    let existing;
    try {
      const rows = await base44.asServiceRole.entities.Pedido.filter({
        group_id: scope.groupId,
        empresa_id: scope.empresaId,
        origem_pedido: 'SITE_CPA',
        origem_externa_id: input.externalOrderId,
      }, '-created_date', 2);
      existing = (Array.isArray(rows) ? rows : [])[0] || null;
    } catch {
      throw new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
    }
    if (existing) {
      const sameOwner = text(existing.cliente_id) === input.erpCustomerId
        && text(existing.site_external_user_id) === input.externalUserId;
      if (!sameOwner || text(existing.origem_payload_hash) !== payloadHash) {
        throw new SiteCpaOrderError(409, 'site_cpa_order_idempotency_conflict');
      }
      await auditOrder({ base44, scope, request, input, order: existing, outcome: 'order_replayed', success: true });
      return orderResponse(existing, true);
    }

    const addresses = buildCustomerAddresses(customerContext.customer);
    let address = null;
    if (input.deliveryMode === 'DELIVERY') {
      address = addresses.find((item) => text(item.addressId) === text(input.addressId)) || null;
      if (!address) throw new SiteCpaOrderError(403, 'site_cpa_order_address_invalid');
    }
    if (input.obraId) {
      const work = addresses.find((item) => (
        text(item.addressId) === input.obraId && item.type === 'OBRA'
      ));
      if (!work) throw new SiteCpaOrderError(403, 'site_cpa_order_work_invalid');
    }
    await validateReference({
      base44, scope, entityName: 'Projeto', id: input.projectId,
      customerId: input.erpCustomerId, requireCustomer: true,
    });
    await validateReference({
      base44, scope, entityName: 'CentroCusto', id: input.costCenterId,
      customerId: input.erpCustomerId, requireCustomer: false,
    });

    const confirmed = await resolveOrderItems({ base44, scope, input, request, now });
    const payment = await resolvePaymentCondition({
      base44, scope, customer: customerContext.customer, preference: input.paymentPreference,
    });
    const productsTotal = money(confirmed.items.reduce((sum, item) => sum + item.valor_item, 0));
    if (payment.creditRequired) {
      const commercial = customerContext.customer?.condicao_comercial || {};
      const availableCredit = Number(commercial.limite_credito || 0)
        - Number(commercial.limite_credito_utilizado || 0);
      if (!Number.isFinite(availableCredit) || availableCredit + 0.009 < productsTotal) {
        throw new SiteCpaOrderError(422, 'site_cpa_order_credit_blocked');
      }
    }
    const seller = await resolveSiteCpaSeller(base44, scope, customerContext.customer);
    const safeExternal = input.externalOrderId.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24).toUpperCase();
    const orderNumber = `SITE-${safeExternal}-${payloadHash.slice(0, 8).toUpperCase()}`;
    const orderPayload = {
      numero_pedido: orderNumber,
      tipo: 'Pedido',
      tipo_pedido: 'Revenda',
      origem: 'SITE_CPA',
      origem_pedido: 'SITE_CPA',
      canal_venda: 'Site B2B',
      origem_externa_id: input.externalOrderId,
      origem_payload_hash: payloadHash,
      site_external_user_id: input.externalUserId,
      contract_version: '1',
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      cliente_id: customerContext.customer.id,
      cliente_nome: text(
        customerContext.customer.razao_social
        || customerContext.customer.nome_fantasia
        || customerContext.customer.nome,
      ),
      vendedor_id: seller.sellerId,
      vendedor: seller.sellerName,
      data_pedido: new Date(now).toISOString().slice(0, 10),
      data_prevista_entrega: input.requestedDeliveryDate,
      status: 'Aguardando Aprovação',
      status_aprovacao: 'pendente',
      status_pagamento: 'Pendente',
      tipo_frete: input.deliveryMode === 'PICKUP' ? 'Retirada' : 'CIF',
      frete_status: input.deliveryMode === 'PICKUP' ? 'Nao Aplicavel' : 'Pendente',
      valor_frete: 0,
      endereco_entrega_principal: address,
      forma_pagamento_id: payment.id,
      forma_pagamento: payment.name,
      tabela_preco_id: confirmed.tableId,
      tabela_preco_nome: confirmed.tableName,
      itens_revenda: confirmed.items,
      valor_produtos: productsTotal,
      valor_total: productsTotal,
      desconto_geral_pedido_percentual: 0,
      desconto_geral_pedido_valor: 0,
      ordem_compra_cliente: input.purchaseOrderReference,
      obra_destino_id: input.obraId,
      projeto_id: input.projectId,
      centro_custo_id: input.costCenterId,
      observacoes: input.notes,
      reserva_estoque_ao_criar: false,
      pagamento_confirmado: false,
    };
    await auditOrder({ base44, scope, request, input, outcome: 'order_requested', success: true });
    let created;
    try {
      created = await base44.asServiceRole.entities.Pedido.create(orderPayload);
    } catch {
      throw new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
    }
    await auditOrder({ base44, scope, request, input, order: created, outcome: 'order_created', success: true });
    return orderResponse({ ...orderPayload, ...created });
  } catch (error) {
    const failure = error instanceof SiteCpaOrderError
      ? error
      : error instanceof SiteCpaCustomerError
        ? new SiteCpaOrderError(error.status === 503 ? 503 : 403, 'site_cpa_order_customer_invalid')
        : new SiteCpaOrderError(503, 'site_cpa_order_unavailable');
    if (failure.code !== 'site_cpa_audit_unavailable' && input) {
      await auditOrder({
        base44, scope, request, input, outcome: failure.code, success: false,
      });
    }
    throw failure;
  }
};
