export const SITE_CPA_PORTAL_ORDERS_OPERATION = 'sitePortalPedidos';
export const SITE_CPA_PORTAL_ORDER_GET_OPERATION = 'sitePortalPedidoGet';
export const SITE_CPA_PORTAL_NFE_OPERATION = 'sitePortalNfe';
export const SITE_CPA_PORTAL_BOLETOS_OPERATION = 'sitePortalBoletos';
export const SITE_CPA_PORTAL_RECEIVABLES_OPERATION = 'sitePortalDuplicatas';
export const SITE_CPA_PORTAL_PAYMENTS_OPERATION = 'sitePortalPagamentos';
export const SITE_CPA_PORTAL_DOCUMENT_OPERATION = 'sitePortalDocumento';

export const SITE_CPA_PORTAL_OPERATIONS = new Set([
  SITE_CPA_PORTAL_ORDERS_OPERATION,
  SITE_CPA_PORTAL_ORDER_GET_OPERATION,
  SITE_CPA_PORTAL_NFE_OPERATION,
  SITE_CPA_PORTAL_BOLETOS_OPERATION,
  SITE_CPA_PORTAL_RECEIVABLES_OPERATION,
  SITE_CPA_PORTAL_PAYMENTS_OPERATION,
  SITE_CPA_PORTAL_DOCUMENT_OPERATION,
]);

const ORDER_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']);
const FINANCIAL_ROLES = new Set(['ADMIN_EMPRESA', 'FINANCEIRO']);
const text = (value) => String(value ?? '').trim();
const normalized = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaPortalError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaPortalError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaPortalError(400, code);
  }
  return result || null;
};

const safeSearch = (value) => {
  const result = text(value);
  if (result.length > 100 || /[{}$<>]/.test(result)) {
    throw new SiteCpaPortalError(400, 'site_cpa_portal_filter_invalid');
  }
  return result || null;
};

const safeDate = (value) => {
  if (!value) return null;
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))) {
    throw new SiteCpaPortalError(400, 'site_cpa_portal_date_invalid');
  }
  return result;
};

const dataOf = (payload = {}) => (
  payload?.data && typeof payload.data === 'object' ? payload.data : payload
);

export const normalizePortalInput = (payload = {}, operation = '') => {
  const data = dataOf(payload);
  for (const forbidden of ['url', 'path', 'fileUri', 'signedUrl', 'storagePath']) {
    if (Object.prototype.hasOwnProperty.call(data, forbidden)) {
      throw new SiteCpaPortalError(400, 'site_cpa_portal_document_input_forbidden');
    }
  }
  const page = Number(data.page ?? 1);
  const pageSize = Number(data.pageSize ?? 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new SiteCpaPortalError(400, 'site_cpa_portal_page_invalid');
  }
  const dateFrom = safeDate(data.dataInicial || data.dateFrom);
  const dateTo = safeDate(data.dataFinal || data.dateTo);
  if (dateFrom && dateTo) {
    const days = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86400000;
    if (days < 0 || days > 366) throw new SiteCpaPortalError(400, 'site_cpa_portal_date_range_invalid');
  }
  const input = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_portal_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_portal_customer_invalid', true),
    erpOrderId: safeId(data.erpOrderId, 'site_cpa_portal_order_not_found'),
    nfeId: safeId(data.nfeId, 'site_cpa_portal_nfe_not_found'),
    receivableId: safeId(data.receivableId, 'site_cpa_portal_receivable_not_found'),
    paymentAttemptId: safeId(data.paymentAttemptId, 'site_cpa_portal_payment_not_found'),
    resourceId: safeId(data.resourceId, 'site_cpa_portal_document_not_found'),
    obraId: safeId(data.obraId, 'site_cpa_portal_work_forbidden'),
    projectId: safeId(data.projectId, 'site_cpa_portal_filter_invalid'),
    externalOrderId: safeId(data.externalOrderId, 'site_cpa_portal_filter_invalid'),
    orderNumber: safeSearch(data.orderNumber),
    nfeNumber: safeSearch(data.nfeNumber),
    documentNumber: safeSearch(data.documentNumber),
    status: safeSearch(data.status),
    documentType: normalized(data.documentType),
    page,
    pageSize,
    dateFrom,
    dateTo,
  };
  if (operation === SITE_CPA_PORTAL_ORDER_GET_OPERATION && !input.erpOrderId) {
    throw new SiteCpaPortalError(400, 'site_cpa_portal_order_not_found');
  }
  if (operation === SITE_CPA_PORTAL_DOCUMENT_OPERATION) {
    if (!input.resourceId || !['DANFE', 'XML', 'BOLETO'].includes(input.documentType)) {
      throw new SiteCpaPortalError(400, 'site_cpa_portal_document_not_found');
    }
  }
  return input;
};

export const assertPortalRole = (operation, role, documentType = '') => {
  const currentRole = normalized(role);
  const financial = [
    SITE_CPA_PORTAL_BOLETOS_OPERATION,
    SITE_CPA_PORTAL_RECEIVABLES_OPERATION,
    SITE_CPA_PORTAL_PAYMENTS_OPERATION,
  ].includes(operation) || (operation === SITE_CPA_PORTAL_DOCUMENT_OPERATION && documentType === 'BOLETO');
  const allowed = financial ? FINANCIAL_ROLES : ORDER_ROLES;
  if (!allowed.has(currentRole)) throw new SiteCpaPortalError(403, 'site_cpa_portal_forbidden');
};

export const allowedWorkIdsFromLink = (link = {}) => {
  const proposed = link?.dados_propostos || {};
  const raw = proposed.allowedWorkIds || proposed.allowed_work_ids || proposed.obras_autorizadas || [];
  return new Set((Array.isArray(raw) ? raw : []).map(text).filter(Boolean));
};

export const assertAllowedWork = (allowedWorkIds, obraId) => {
  const id = text(obraId);
  if (allowedWorkIds?.size && id && !allowedWorkIds.has(id)) {
    throw new SiteCpaPortalError(403, 'site_cpa_portal_work_forbidden');
  }
};

export const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const mapOrderStatus = (value) => {
  const status = normalized(value);
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('ENTREG')) return 'DELIVERED';
  if (status.includes('TRANSIT')) return 'IN_TRANSIT';
  if (status.includes('EXPED')) return 'IN_DISPATCH';
  if (status.includes('FATUR')) return 'INVOICED';
  if (status.includes('PRODU')) return 'IN_PRODUCTION';
  if (status.includes('APROV')) return 'APPROVED';
  if (status.includes('RASCUN')) return 'DRAFT';
  return 'PENDING';
};

export const mapNfeStatus = (value) => {
  const status = normalized(value);
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('AUTORIZ')) return 'AUTHORIZED';
  if (status.includes('DENEG')) return 'DENIED';
  if (status.includes('REJEIT')) return 'REJECTED';
  if (status.includes('INUTIL')) return 'VOIDED';
  if (status.includes('PROCESS') || status.includes('TRANSMIT')) return 'PROCESSING';
  return 'PENDING';
};

export const mapReceivableStatus = (record = {}, now = Date.now()) => {
  const status = normalized(record.status);
  const amount = money(record.valor ?? record.valor_total);
  const paid = money(record.valor_recebido);
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('REVISAO') || status.includes('ANALISE')) return 'UNDER_REVIEW';
  if (paid >= amount && amount > 0) return 'PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  const dueAt = Date.parse(record.data_vencimento || '');
  if (Number.isFinite(dueAt) && dueAt < now) return 'OVERDUE';
  return 'OPEN';
};

export const isPortalVisibleOrder = (record = {}) => record.pode_ver_no_portal === true;
export const isPortalVisibleReceivable = (record = {}) => {
  if (record.visivel_no_portal === false) return false;
  if (record.visivel_no_portal === true) return true;
  return !['PAID', 'CANCELLED'].includes(mapReceivableStatus(record));
};

export const orderDate = (record = {}) => record.data_pedido || record.created_date || record.createdAt || null;
export const nfeDate = (record = {}) => record.data_emissao || record.created_date || record.createdAt || null;

export const withinDates = (value, from, to) => {
  if (!from && !to) return true;
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return false;
  if (from && time < Date.parse(`${from}T00:00:00Z`)) return false;
  if (to && time > Date.parse(`${to}T23:59:59.999Z`)) return false;
  return true;
};

export const paginate = (records, input) => {
  const start = (input.page - 1) * input.pageSize;
  const items = records.slice(start, start + input.pageSize);
  return { items, page: input.page, pageSize: input.pageSize, hasMore: records.length > start + input.pageSize };
};

export const customerIdFromNfe = (record = {}) => text(
  record.cliente_id || record.cliente_fornecedor_id || record.destinatario_id,
);

export const recordWorkId = (record = {}) => text(
  record.obra_id || record.projeto_obra_id || record.endereco_obra_id,
);

export const maskCnpj = (value) => {
  const digits = text(value).replace(/\D/g, '');
  return digits.length === 14 ? `**.***.***/${digits.slice(8, 12)}-${digits.slice(12)}` : null;
};
