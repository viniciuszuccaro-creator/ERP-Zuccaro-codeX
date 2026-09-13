import {
  SiteCpaPaymentError,
  canonicalPaymentStatus,
  money,
  normalizePaymentMethod,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const envCompanySuffix = (empresaId) => text(empresaId).replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
const readEnv = (env, name, empresaId) => (
  text(env?.(`${name}_${envCompanySuffix(empresaId)}`)) || text(env?.(name))
);
const providerName = (record) => text(record?.provedor || record?.gateway).toUpperCase();

const normalizeConfiguredMethods = (record) => {
  const raw = record?.tipos_pagamento_suportados || record?.metodos || record?.formas_pagamento || [];
  return (Array.isArray(raw) ? raw : String(raw || '').split(','))
    .map((item) => {
      try { return normalizePaymentMethod(item); } catch { return null; }
    })
    .filter(Boolean);
};

const loadGatewayRecord = async (base44, scope) => {
  for (const entityName of ['ConfiguracaoGatewayPagamento', 'GatewayPagamento']) {
    const entity = base44.asServiceRole.entities[entityName];
    if (!entity?.filter) continue;
    let rows;
    try {
      rows = await entity.filter({
        group_id: scope.groupId,
        empresa_id: scope.empresaId,
        ativo: true,
      }, 'prioridade', 5);
    } catch {
      throw new SiteCpaPaymentError(503, 'site_cpa_payment_provider_unavailable');
    }
    const record = (Array.isArray(rows) ? rows : []).find((item) => (
      text(item.group_id || item.grupo_id) === text(scope.groupId)
      && text(item.empresa_id) === text(scope.empresaId)
      && item.ativo !== false
    ));
    if (record) return record;
  }
  return null;
};

export const resolvePaymentProviderConfig = async ({ base44, scope, env, customerId = null } = {}) => {
  const record = await loadGatewayRecord(base44, scope);
  if (!record) return null;
  const provider = providerName(record);
  const providerMethods = provider === 'ASAAS' ? ['PIX', 'BOLETO'] : provider === 'JUNO' ? ['BOLETO'] : [];
  const configuredMethods = normalizeConfiguredMethods(record);
  const methods = providerMethods.filter((method) => configuredMethods.includes(method));
  const apiKey = readEnv(env, 'SITE_CPA_PAYMENT_API_KEY', scope.empresaId);
  const webhookSecret = readEnv(env, 'SITE_CPA_PAYMENT_WEBHOOK_SECRET', scope.empresaId);
  const extras = record.configuracoes_extras || {};
  const hasCustomerMapping = Boolean(Object.keys(extras?.customers_map || {}).length);
  const customerIdFromMap = customerId ? text(extras?.customers_map?.[customerId]) : '';
  const providerCustomerId = customerIdFromMap
    || readEnv(env, 'SITE_CPA_PAYMENT_CUSTOMER_ID', scope.empresaId)
    || text(extras?.customer_id_default);
  if (!providerMethods.length || !methods.length || !apiKey || !webhookSecret) return null;
  return {
    id: record.id,
    provider,
    methods,
    apiKey,
    webhookSecret,
    providerCustomerId,
    customerResolutionReady: Boolean(providerCustomerId || hasCustomerMapping),
    empresaId: scope.empresaId,
    groupId: scope.groupId,
  };
};

export const paymentCapability = async ({ base44, scope, env } = {}) => {
  try {
    const config = await resolvePaymentProviderConfig({ base44, scope, env });
    return config?.customerResolutionReady ? 'ready' : 'blocked';
  } catch {
    return 'degraded';
  }
};

const jsonOrEmpty = async (response) => {
  try { return await response.json(); } catch { return {}; }
};

const providerError = (status = 503, code = 'site_cpa_payment_provider_unavailable', details = null) => (
  new SiteCpaPaymentError(status, code, undefined, details)
);

const statusFromAsaas = (value) => ({
  PENDING: 'PENDING', RECEIVED: 'PAID', CONFIRMED: 'PAID', OVERDUE: 'EXPIRED',
  REFUNDED: 'REFUNDED', REFUND_REQUESTED: 'UNDER_REVIEW', CHARGEBACK_REQUESTED: 'UNDER_REVIEW',
  CHARGEBACK_DISPUTE: 'UNDER_REVIEW', AWAITING_CHARGEBACK_REVERSAL: 'UNDER_REVIEW',
  CANCELLED: 'CANCELLED', CANCELED: 'CANCELLED', FAILED: 'FAILED',
  DUNNING_REQUESTED: 'PROCESSING', DUNNING_RECEIVED: 'PAID', AWAITING_RISK_ANALYSIS: 'UNDER_REVIEW',
})[text(value).toUpperCase()] || 'UNDER_REVIEW';

const statusFromJuno = (value) => ({
  ACTIVE: 'PENDING', PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED', FAILED: 'FAILED', EXPIRED: 'EXPIRED', REFUNDED: 'REFUNDED',
  CHARGEBACK: 'CHARGEBACK', UNDER_REVIEW: 'UNDER_REVIEW',
})[text(value).toUpperCase()] || 'UNDER_REVIEW';

export const mapProviderStatus = (provider, value) => (
  provider === 'ASAAS' ? statusFromAsaas(value) : provider === 'JUNO' ? statusFromJuno(value) : 'UNDER_REVIEW'
);

const publicData = (provider, data = {}) => {
  if (provider === 'ASAAS') {
    return {
      paymentId: data.id || null,
      qrCode: data.pixQrCode || data.pixQrCodeId || null,
      qrCodeText: data.pixQrCodeText || data.pixCopyPaste || null,
      documentUrl: data.bankSlipUrl || data.invoiceUrl || null,
      paymentUrl: data.invoiceUrl || null,
      barcode: data.identificationField || data.bankSlipBarcode || null,
      dueDate: data.dueDate || null,
    };
  }
  const charge = Array.isArray(data?.data) ? data.data[0] : data;
  return {
    paymentId: charge?.id || null,
    documentUrl: charge?.billetDetails?.bankSlipUrl || charge?.link || null,
    paymentUrl: charge?.link || null,
    barcode: charge?.billetDetails?.barcodeNumber || null,
    dueDate: charge?.dueDate || null,
  };
};

const requestProvider = async ({ url, init, fetchApi, timeoutMs = 12000 }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchApi(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw providerError(202, 'site_cpa_payment_provider_processing', { state: 'PROCESSING' });
    }
    throw providerError();
  } finally {
    clearTimeout(timeout);
  }
};

const asaasHeaders = (config) => ({ 'Content-Type': 'application/json', access_token: config.apiKey });
const junoHeaders = (config) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` });

export const createProviderPayment = async ({ config, attempt, receivable, customer, fetchApi = fetch } = {}) => {
  if (!config?.methods?.includes(attempt.method) || !config.providerCustomerId) {
    throw providerError(422, 'site_cpa_payment_method_invalid');
  }
  let url;
  let init;
  if (config.provider === 'ASAAS') {
    url = 'https://api.asaas.com/api/v3/payments';
    init = {
      method: 'POST',
      headers: { ...asaasHeaders(config), 'Idempotency-Key': attempt.paymentAttemptId },
      body: JSON.stringify({
        customer: config.providerCustomerId,
        billingType: attempt.method,
        value: money(attempt.amount),
        dueDate: receivable.data_vencimento,
        externalReference: attempt.paymentAttemptId,
        description: `Pedido ${attempt.erpOrderId}`,
      }),
    };
  } else if (config.provider === 'JUNO') {
    url = 'https://api.juno.com.br/charges';
    init = {
      method: 'POST',
      headers: { ...junoHeaders(config), 'Idempotency-Key': attempt.paymentAttemptId },
      body: JSON.stringify({
        charge: {
          description: `Pedido ${attempt.erpOrderId}`,
          amount: money(attempt.amount).toFixed(2),
          dueDate: receivable.data_vencimento,
          references: [attempt.paymentAttemptId],
        },
        billing: {
          name: customer.razao_social || customer.nome_fantasia || customer.nome,
          document: customer.cnpj || customer.cpf_cnpj || customer.documento || null,
        },
      }),
    };
  } else {
    throw providerError();
  }
  const response = await requestProvider({ url, init, fetchApi });
  const data = await jsonOrEmpty(response);
  if (!response.ok) throw providerError(response.status >= 500 ? 503 : 422);
  const output = publicData(config.provider, data);
  if (!output.paymentId) throw providerError();
  return {
    externalProviderId: output.paymentId,
    status: mapProviderStatus(config.provider, data?.status || data?.data?.[0]?.status),
    expiresAt: data?.expirationDate || output.dueDate || null,
    providerPublicData: output,
  };
};

export const getProviderPayment = async ({ config, externalProviderId, fetchApi = fetch } = {}) => {
  const encodedId = encodeURIComponent(text(externalProviderId));
  const asaas = config.provider === 'ASAAS';
  const url = asaas
    ? `https://api.asaas.com/api/v3/payments/${encodedId}`
    : `https://api.juno.com.br/charges/${encodedId}`;
  const response = await requestProvider({
    url,
    init: { method: 'GET', headers: asaas ? asaasHeaders(config) : junoHeaders(config) },
    fetchApi,
  });
  const data = await jsonOrEmpty(response);
  if (!response.ok) throw providerError(response.status === 404 ? 404 : 503, 'site_cpa_payment_provider_unavailable');
  const charge = Array.isArray(data?.data) ? data.data[0] : data;
  return {
    status: mapProviderStatus(config.provider, charge?.status),
    paidAmount: money(charge?.value ?? charge?.amount ?? 0),
    paidAt: charge?.paymentDate || charge?.confirmedDate || charge?.paidAt || null,
  };
};

export const cancelProviderPayment = async ({ config, externalProviderId, fetchApi = fetch } = {}) => {
  if (config.provider !== 'ASAAS') {
    throw providerError(422, 'site_cpa_payment_not_cancelable');
  }
  const response = await requestProvider({
    url: `https://api.asaas.com/api/v3/payments/${encodeURIComponent(text(externalProviderId))}`,
    init: { method: 'DELETE', headers: asaasHeaders(config) },
    fetchApi,
  });
  const data = await jsonOrEmpty(response);
  if (!response.ok) throw providerError(response.status >= 500 ? 503 : 422, 'site_cpa_payment_not_cancelable');
  return { status: canonicalPaymentStatus(mapProviderStatus(config.provider, data?.status || 'CANCELLED')) };
};

export const normalizeProviderWebhook = (provider, payload = {}) => {
  const source = provider === 'ASAAS' ? (payload.payment || payload.data || payload) : (payload?.data?.charge || payload.charge || payload);
  return {
    eventId: text(payload.eventId || payload.id || payload.event_id),
    externalProviderId: text(source?.id || source?.paymentId),
    paymentAttemptId: text(source?.externalReference || source?.reference || source?.references?.[0]),
    status: mapProviderStatus(provider, source?.status || payload?.event || payload?.type),
    paidAmount: money(source?.value ?? source?.netValue ?? source?.amount ?? 0),
    paidAt: source?.confirmedDate || source?.paymentDate || source?.date || null,
  };
};
