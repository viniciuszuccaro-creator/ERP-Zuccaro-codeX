import {
  customerIdFromNfe,
  mapNfeStatus,
  mapOrderStatus,
  mapReceivableStatus,
  money,
  recordWorkId,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const first = (...values) => values.find((value) => text(value)) ?? null;

const publicOrderItems = (order = {}) => {
  const source = order.itens || order.itens_revenda || order.itens_producao || [];
  return (Array.isArray(source) ? source : []).slice(0, 500).map((item) => ({
    erpProductId: first(item.produto_id, item.erpProductId),
    sku: first(item.sku, item.codigo_produto, item.codigo),
    name: first(item.nome_produto, item.produto_nome, item.descricao, item.nome),
    spec: first(item.erp_spec_code, item.especificacao, item.medida),
    quantity: Number(item.quantidade || item.quantity || 0),
    commercialUnit: first(item.unidade, item.unidade_comercial, item.commercialUnit),
    unitPrice: money(item.preco_unitario ?? item.valor_unitario ?? item.unitPrice),
    lineTotal: money(item.valor_total ?? item.total ?? item.lineTotal),
  }));
};

export const publicOrder = (order = {}, detailed = false) => ({
  erpOrderId: order.id,
  orderNumber: first(order.numero_pedido, order.numero, order.codigo),
  externalOrderId: first(order.site_external_order_id, order.external_order_id),
  status: mapOrderStatus(order.status),
  origin: first(order.origem_pedido, order.origem, 'ERP'),
  createdAt: first(order.data_pedido, order.created_date),
  total: money(order.valor_total),
  deliveryMode: first(order.modalidade_entrega, order.tipo_entrega, order.delivery_mode),
  requestedDeliveryDate: first(order.data_entrega_solicitada, order.data_previsao_entrega),
  paymentStatus: first(order.status_pagamento, order.payment_status),
  seller: order.vendedor_id || order.vendedor_nome ? {
    sellerId: first(order.vendedor_id, order.responsavel_id),
    sellerName: first(order.vendedor_nome, order.responsavel_nome),
  } : null,
  obraId: recordWorkId(order) || null,
  projectId: first(order.projeto_id, order.project_id),
  ...(detailed ? { items: publicOrderItems(order) } : {}),
  source: 'ERP',
  updatedAt: first(order.updated_date, order.created_date),
});

const documentFileAvailable = (record, type) => {
  const fields = type === 'XML'
    ? [record.xml_file_uri, record.arquivo_xml_uri]
    : [record.danfe_file_uri, record.pdf_file_uri, record.arquivo_danfe_uri];
  return fields.some((value) => text(value));
};

export const publicNfe = (record = {}) => ({
  nfeId: record.id,
  number: first(record.numero, record.numero_nfe),
  series: first(record.serie, record.serie_nfe),
  accessKeyMasked: text(record.chave_acesso)
    ? `${text(record.chave_acesso).slice(0, 4)}...${text(record.chave_acesso).slice(-4)}`
    : null,
  issuedAt: first(record.data_emissao, record.created_date),
  total: money(record.valor_total ?? record.valor_nota),
  status: mapNfeStatus(record.status),
  erpOrderId: first(record.pedido_id, record.order_id),
  obraId: recordWorkId(record) || null,
  documentsAvailable: {
    danfe: documentFileAvailable(record, 'DANFE'),
    xml: documentFileAvailable(record, 'XML'),
  },
  source: 'ERP',
  updatedAt: first(record.updated_date, record.created_date),
});

export const publicReceivable = (record = {}, now = Date.now(), includeBilling = false) => {
  const amount = money(record.valor ?? record.valor_total);
  const paidAmount = money(record.valor_recebido);
  const status = mapReceivableStatus(record, now);
  return {
    receivableId: record.id,
    documentNumber: first(record.numero_documento, record.documento, record.descricao),
    installment: first(record.parcela, record.numero_parcela),
    dueDate: first(record.data_vencimento, record.vencimento),
    amount,
    openAmount: money(Math.max(0, amount - paidAmount)),
    paidAmount,
    paidAt: first(record.data_recebimento, record.data_pagamento, record.data_baixa),
    status,
    erpOrderId: first(record.pedido_id, record.origem_documento_id),
    nfeRef: first(record.nota_fiscal_id, record.nfe_id),
    obraId: recordWorkId(record) || null,
    ...(includeBilling ? {
      billingMethod: first(record.forma_cobranca, record.forma_pagamento),
      barcode: first(record.boleto_linha_digitavel, record.linha_digitavel),
      documentAvailable: Boolean(first(record.boleto_file_uri, record.arquivo_boleto_uri)),
    } : {}),
    source: 'ERP',
    updatedAt: first(record.updated_date, record.created_date),
  };
};

export const isBoleto = (record = {}) => {
  const method = text(record.forma_cobranca || record.forma_pagamento).toUpperCase();
  return method.includes('BOLETO') || Boolean(
    first(record.boleto_linha_digitavel, record.linha_digitavel, record.boleto_file_uri, record.id_cobranca_externa),
  );
};

export const paymentAttemptFromEvent = (event = {}) => event?.response_payload?.attempt || null;

export const publicPayment = (attempt = {}) => ({
  paymentAttemptId: attempt.paymentAttemptId,
  method: attempt.method || null,
  amount: money(attempt.amount),
  paidAmount: money(attempt.paidAmount),
  status: attempt.status || 'UNDER_REVIEW',
  paidAt: attempt.paidAt || null,
  erpOrderId: attempt.erpOrderId || null,
  reconciliationStatus: attempt.reconciliationStatus || 'PENDING',
  createdAt: attempt.createdAt || null,
  updatedAt: attempt.updatedAt || attempt.createdAt || null,
  source: 'ERP',
});

export const nfeBelongsToCustomer = (record, customerId) => customerIdFromNfe(record) === text(customerId);
