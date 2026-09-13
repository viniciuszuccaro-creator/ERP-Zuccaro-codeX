export const SITE_CPA_DELIVERY_LIST_OPERATION = 'siteEntregaList';
export const SITE_CPA_DELIVERY_GET_OPERATION = 'siteEntregaGet';
export const SITE_CPA_DELIVERY_TIMELINE_OPERATION = 'siteEntregaTimeline';
export const SITE_CPA_DELIVERY_PROOFS_OPERATION = 'siteEntregaComprovantes';

export const SITE_CPA_DELIVERY_OPERATIONS = new Set([
  SITE_CPA_DELIVERY_LIST_OPERATION,
  SITE_CPA_DELIVERY_GET_OPERATION,
  SITE_CPA_DELIVERY_TIMELINE_OPERATION,
  SITE_CPA_DELIVERY_PROOFS_OPERATION,
]);

const DELIVERY_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'CONSULTA']);
const text = (value) => String(value ?? '').trim();
export const normalized = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaDeliveryError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaDeliveryError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaDeliveryError(400, code);
  }
  return result || null;
};

const safeSearch = (value) => {
  const result = text(value);
  if (result.length > 100 || /[{}$<>]/.test(result)) {
    throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_filter_invalid');
  }
  return result || null;
};

const safeDate = (value) => {
  if (!value) return null;
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))) {
    throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_date_invalid');
  }
  return result;
};

const payloadData = (payload = {}) => (
  payload?.data && typeof payload.data === 'object' ? payload.data : payload
);

export const normalizeDeliveryInput = (payload = {}, operation = '') => {
  const data = payloadData(payload);
  for (const forbidden of ['url', 'path', 'fileUri', 'signedUrl', 'storagePath', 'coordinates', 'latitude', 'longitude']) {
    if (Object.prototype.hasOwnProperty.call(data, forbidden)) {
      throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_input_forbidden');
    }
  }
  const page = Number(data.page ?? 1);
  const pageSize = Number(data.pageSize ?? 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_page_invalid');
  }
  const dateFrom = safeDate(data.dataInicial || data.dateFrom);
  const dateTo = safeDate(data.dataFinal || data.dateTo);
  if (dateFrom && dateTo) {
    const days = (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86400000;
    if (days < 0 || days > 366) throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_date_range_invalid');
  }
  const input = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_delivery_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_delivery_customer_invalid', true),
    deliveryId: safeId(data.deliveryId, 'site_cpa_delivery_not_found'),
    erpOrderId: safeId(data.erpOrderId, 'site_cpa_delivery_order_not_found'),
    obraId: safeId(data.obraId, 'site_cpa_delivery_work_forbidden'),
    proofId: safeId(data.proofId, 'site_cpa_delivery_proof_not_found'),
    orderNumber: safeSearch(data.orderNumber),
    status: safeSearch(data.status),
    page,
    pageSize,
    dateFrom,
    dateTo,
  };
  if ([SITE_CPA_DELIVERY_GET_OPERATION, SITE_CPA_DELIVERY_TIMELINE_OPERATION,
    SITE_CPA_DELIVERY_PROOFS_OPERATION].includes(operation) && !input.deliveryId) {
    throw new SiteCpaDeliveryError(400, 'site_cpa_delivery_not_found');
  }
  return input;
};

export const assertDeliveryRole = (role) => {
  if (!DELIVERY_ROLES.has(normalized(role))) {
    throw new SiteCpaDeliveryError(403, 'site_cpa_delivery_forbidden');
  }
};

export const mapDeliveryStatus = (record = {}) => {
  const status = normalized(record.status);
  const pickup = normalized(record.tipo_frete || record.modalidade_entrega).includes('RETIR');
  if (status.includes('AGUARD') && status.includes('SEPAR')) return 'PENDING';
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('REAGEND')) return 'RESCHEDULED';
  if (status.includes('FRUSTR') || status.includes('OCORR') || status.includes('DEVOLV')) return 'OCCURRENCE';
  if (status.includes('PARCIAL')) return 'PARTIAL';
  if (status.includes('ENTREG') || status.includes('CONCLUID')) return pickup ? 'PICKED_UP' : 'DELIVERED';
  if (pickup && (status.includes('PRONT') || status.includes('DISPON'))) return 'PICKUP_READY';
  if (status.includes('TRANSIT') || status.includes('SAIU') || status.includes('CHEGADA')) return 'OUT_FOR_DELIVERY';
  if (status.includes('ROTA') || status.includes('ROTEIR') || status.includes('ROMANE')) return 'ROUTED';
  if (status.includes('PROGRAM') || status.includes('AGEND')) return 'SCHEDULED';
  if (status.includes('PRONT') || status.includes('CONFERID')) return 'READY';
  if (status.includes('SEPAR')) return 'SEPARATING';
  return 'PENDING';
};

export const mapTimelineEvent = (status) => {
  const mapped = mapDeliveryStatus({ status });
  const events = {
    PENDING: 'ORDER_CONFIRMED',
    SEPARATING: 'SEPARATION_STARTED',
    READY: 'SEPARATION_COMPLETED',
    SCHEDULED: 'DELIVERY_SCHEDULED',
    ROUTED: 'ROUTE_ASSIGNED',
    OUT_FOR_DELIVERY: 'VEHICLE_LEFT',
    PARTIAL: 'PARTIAL_DELIVERY',
    DELIVERED: 'DELIVERED',
    PICKUP_READY: 'PICKUP_READY',
    PICKED_UP: 'PICKED_UP',
    RESCHEDULED: 'RESCHEDULED',
    OCCURRENCE: 'OCCURRENCE_RECORDED',
    CANCELLED: 'CANCELLED',
  };
  return events[mapped] || null;
};

export const deliveryDate = (record = {}) => (
  record.data_previsao || record.data_agendada || record.data_saida || record.created_date || record.createdAt || null
);

export const withinDeliveryDates = (value, from, to) => {
  if (!from && !to) return true;
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return false;
  if (from && time < Date.parse(`${from}T00:00:00Z`)) return false;
  if (to && time > Date.parse(`${to}T23:59:59.999Z`)) return false;
  return true;
};

export const paginateDeliveries = (records, input) => {
  const start = (input.page - 1) * input.pageSize;
  return {
    items: records.slice(start, start + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    hasMore: records.length > start + input.pageSize,
  };
};
