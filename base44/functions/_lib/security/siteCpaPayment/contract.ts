export const SITE_CPA_PAYMENT_CREATE_OPERATION = 'sitePagamentoCreate';
export const SITE_CPA_PAYMENT_STATUS_OPERATION = 'sitePagamentoStatus';
export const SITE_CPA_PAYMENT_CANCEL_OPERATION = 'sitePagamentoCancel';
export const SITE_CPA_PAYMENT_ATTEMPT_OPERATION = 'sitePagamentoAttempt';
export const SITE_CPA_PAYMENT_EVENT_ORIGIN = 'SITE_CPA_PAYMENT';

export const PAYMENT_STATUSES = new Set([
  'PENDING', 'PROCESSING', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'FAILED',
  'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK', 'UNDER_REVIEW',
]);

export const TERMINAL_PAYMENT_STATUSES = new Set([
  'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK',
]);

const AUTHORITY_FIELDS = [
  'amount', 'paid', 'approved', 'settled', 'paymentStatus', 'providerStatus',
  'transactionId', 'bankSlipStatus', 'pixStatus',
];
const ALLOWED_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO']);
const text = (value) => String(value ?? '').trim();

export class SiteCpaPaymentError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaPaymentError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = true) => {
  const id = text(value);
  if ((!id && required) || id.length > 160 || (id && !/^[A-Za-z0-9._:@/-]+$/.test(id))) {
    throw new SiteCpaPaymentError(400, code);
  }
  return id || null;
};

const dataOf = (payload = {}) => (
  payload?.data && typeof payload.data === 'object' ? payload.data : payload
);

const rejectAuthorityFields = (data) => {
  const found = AUTHORITY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (found.length) {
    throw new SiteCpaPaymentError(400, 'site_cpa_payment_payload_forbidden', undefined, { fields: found });
  }
};

export const normalizePaymentMethod = (value) => {
  const normalized = text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  const aliases = {
    PIX: 'PIX', BOLETO: 'BOLETO', CARD: 'CARD', CARTAO: 'CARD',
    CREDIT_CARD: 'CARD', PAYMENT_LINK: 'PAYMENT_LINK', LINK: 'PAYMENT_LINK',
  };
  const method = aliases[normalized];
  if (!method) throw new SiteCpaPaymentError(400, 'site_cpa_payment_method_invalid');
  return method;
};

const commonInput = (data) => ({
  externalUserId: safeId(data?.externalUserId || data?.siteUserId, 'site_cpa_payment_customer_invalid'),
  erpCustomerId: safeId(data?.erpCustomerId, 'site_cpa_payment_customer_invalid'),
  erpOrderId: safeId(data?.erpOrderId, 'site_cpa_payment_order_invalid'),
});

export const normalizePaymentCreateInput = (payload = {}) => {
  const data = dataOf(payload);
  rejectAuthorityFields(data);
  const returnUrl = text(data?.returnUrl);
  if (returnUrl && (!returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.length > 300)) {
    throw new SiteCpaPaymentError(400, 'site_cpa_payment_return_url_invalid');
  }
  return {
    ...commonInput(data),
    externalPaymentId: safeId(data?.externalPaymentId, 'site_cpa_payment_external_id_invalid'),
    receivableId: safeId(data?.receivableId, 'site_cpa_payment_receivable_invalid', false),
    method: normalizePaymentMethod(data?.method),
    returnUrl: returnUrl || null,
  };
};

export const normalizePaymentLookupInput = (payload = {}) => {
  const data = dataOf(payload);
  rejectAuthorityFields(data);
  return {
    ...commonInput(data),
    paymentAttemptId: safeId(data?.paymentAttemptId, 'site_cpa_payment_not_found'),
  };
};

export const normalizePaymentCancelInput = (payload = {}) => {
  const data = dataOf(payload);
  const input = normalizePaymentLookupInput(payload);
  const reason = text(data?.reason).replace(/[<>]/g, '').slice(0, 300);
  return { ...input, reason: reason || null };
};

export const assertPaymentRole = (role) => {
  if (!ALLOWED_ROLES.has(text(role).toUpperCase())) {
    throw new SiteCpaPaymentError(403, 'site_cpa_payment_customer_invalid');
  }
};

export const money = (value) => Math.round(Number(value) * 100) / 100;

export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const sha256 = async (value, cryptoApi = globalThis.crypto) => {
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(String(value ?? '')));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const paymentAttemptIdFor = async ({ scope, input }) => {
  const digest = await sha256(stableStringify({
    groupId: scope.groupId,
    empresaId: scope.empresaId,
    erpOrderId: input.erpOrderId,
    externalPaymentId: input.externalPaymentId,
  }));
  return `PAY-${digest.slice(0, 28).toUpperCase()}`;
};

export const canonicalPaymentStatus = (value) => {
  const status = text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  return PAYMENT_STATUSES.has(status) ? status : 'UNDER_REVIEW';
};

export const paymentPublicResponse = (attempt = {}) => ({
  paymentAttemptId: attempt.paymentAttemptId,
  erpOrderId: attempt.erpOrderId,
  method: attempt.method,
  amount: money(attempt.amount || 0),
  status: canonicalPaymentStatus(attempt.status),
  paidAmount: money(attempt.paidAmount || 0),
  paidAt: attempt.paidAt || null,
  expiresAt: attempt.expiresAt || null,
  reconciliationStatus: attempt.reconciliationStatus || 'PENDING',
  providerPublicData: attempt.providerPublicData || null,
  nextAction: attempt.nextAction || null,
  createdAt: attempt.createdAt || null,
  updatedAt: attempt.updatedAt || attempt.createdAt || null,
  source: 'ERP',
});
