export const SITE_CPA_OPPORTUNITY_LIST_OPERATION = 'siteOportunidadeList';
export const SITE_CPA_OPPORTUNITY_GET_OPERATION = 'siteOportunidadeGet';
export const SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION = 'siteOportunidadeContext';
export const SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION = 'siteOportunidadeSignal';

export const SITE_CPA_OPPORTUNITY_OPERATIONS = new Set([
  SITE_CPA_OPPORTUNITY_LIST_OPERATION,
  SITE_CPA_OPPORTUNITY_GET_OPERATION,
  SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION,
  SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION,
]);

export const OPPORTUNITY_LIMITS = Object.freeze({ pageSize: 100, contextItems: 25, signalText: 500 });
export const OPPORTUNITY_SIGNAL_TYPES = new Set([
  'CLIENT_REQUESTED_CONTACT', 'BETTER_PRICE_REQUESTED', 'TALK_TO_SELLER',
]);

const READ_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']);
const SIGNAL_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR']);
const text = (value) => String(value ?? '').trim();
export const normalizedOpportunityValue = (value) => text(value)
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaOpportunityError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaOpportunityError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaOpportunityError(400, code);
  }
  return result || null;
};

const safeText = (value, max, code) => {
  const result = text(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (result.length > max || /<\/?[A-Za-z!][^>]*>|javascript\s*:|\b(?:eval|exec|system)\s*\(/i.test(result)) {
    throw new SiteCpaOpportunityError(400, code);
  }
  return result || null;
};

const dataOf = (payload = {}) => payload?.data && typeof payload.data === 'object' ? payload.data : payload;

export const normalizeOpportunityInput = (payload = {}, operation = '') => {
  const data = dataOf(payload);
  for (const field of [
    'groupId', 'group_id', 'empresaId', 'empresa_id', 'sellerId', 'vendedorId', 'role',
    'priority', 'score', 'probability', 'status', 'price', 'discount', 'credit', 'payment',
    'productionReleased', 'sendMessage', 'closeOpportunity', 'nextActionExecuted',
  ]) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      throw new SiteCpaOpportunityError(400, 'site_cpa_opportunity_authority_input_forbidden');
    }
  }
  const page = Number(data.page ?? 1);
  const pageSize = Number(data.pageSize ?? 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize)
    || pageSize < 1 || pageSize > OPPORTUNITY_LIMITS.pageSize) {
    throw new SiteCpaOpportunityError(400, 'site_cpa_opportunity_page_invalid');
  }
  const signalType = normalizedOpportunityValue(data.signalType || data.type);
  const input = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_opportunity_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_opportunity_customer_invalid', true),
    opportunityId: safeId(data.opportunityId || data.erpOpportunityId, 'site_cpa_opportunity_not_found'),
    externalSignalId: safeId(data.externalSignalId, 'site_cpa_opportunity_signal_invalid'),
    signalType: signalType || null,
    erpQuoteId: safeId(data.erpQuoteId, 'site_cpa_opportunity_context_invalid'),
    erpOrderId: safeId(data.erpOrderId, 'site_cpa_opportunity_context_invalid'),
    conversationId: safeId(data.conversationId, 'site_cpa_opportunity_context_invalid'),
    obraId: safeId(data.obraId, 'site_cpa_opportunity_context_invalid'),
    projectId: safeId(data.projectId, 'site_cpa_opportunity_context_invalid'),
    message: safeText(data.message || data.reason, OPPORTUNITY_LIMITS.signalText,
      'site_cpa_opportunity_signal_invalid'),
    page,
    pageSize,
  };
  if ([SITE_CPA_OPPORTUNITY_GET_OPERATION, SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION].includes(operation)
    && operation === SITE_CPA_OPPORTUNITY_GET_OPERATION && !input.opportunityId) {
    throw new SiteCpaOpportunityError(400, 'site_cpa_opportunity_not_found');
  }
  if (operation === SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION) {
    if (!input.externalSignalId || !OPPORTUNITY_SIGNAL_TYPES.has(input.signalType)) {
      throw new SiteCpaOpportunityError(400, 'site_cpa_opportunity_signal_invalid');
    }
  }
  return input;
};

export const assertOpportunityRole = (role, operation) => {
  const allowed = operation === SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION ? SIGNAL_ROLES : READ_ROLES;
  if (!allowed.has(normalizedOpportunityValue(role))) {
    throw new SiteCpaOpportunityError(403, 'site_cpa_opportunity_forbidden');
  }
};

export const mapOpportunityStatus = (record = {}) => {
  const status = normalizedOpportunityValue(record.status || record.etapa);
  if (status.includes('GANH') || status === 'WON') return 'WON';
  if (status.includes('PERD') || status === 'LOST') return 'LOST';
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('CLIENTE')) return 'WAITING_CUSTOMER';
  if (status.includes('VENDEDOR') || status.includes('AGUARD')) return 'WAITING_SELLER';
  if (status.includes('ANDAMENTO') || status.includes('NEGOCI') || status.includes('PROPOST')) return 'IN_PROGRESS';
  return 'OPEN';
};

export const paginateOpportunities = (records, input) => {
  const start = (input.page - 1) * input.pageSize;
  return {
    items: records.slice(start, start + input.pageSize), page: input.page, pageSize: input.pageSize,
    total: records.length, hasMore: records.length > start + input.pageSize,
  };
};
