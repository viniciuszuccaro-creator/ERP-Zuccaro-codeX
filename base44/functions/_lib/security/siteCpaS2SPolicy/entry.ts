import { paymentCapability } from '../siteCpaPayment/provider.ts';
import { portalCapabilities } from '../siteCpaPortal/entry.ts';
import { deliveryCapability } from '../siteCpaDelivery/entry.ts';
import { chatCapability } from '../siteCpaChat/entry.ts';
import { armationCapabilities } from '../siteCpaArmacao/entry.ts';
import { workCapabilities } from '../siteCpaWork/entry.ts';
import { routeSiteCpaOperation } from '../siteCpaOperationRouter/entry.ts';

export const SITE_CPA_ORIGIN = 'SITE_CPA';
export const SITE_CPA_CONTRACT_VERSION = '1';
export const SITE_CPA_HEALTH_OPERATION = 'siteHealth';

const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 120;
const DEFAULT_RATE_WINDOW_MS = 60 * 1000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;

const text = (value) => String(value ?? '').trim();
const header = (headers, name) => text(headers?.get?.(name) || headers?.[name] || headers?.[name.toLowerCase()]);
const csv = (value) => text(value).split(',').map((item) => item.trim()).filter(Boolean);

export const constantTimeEqual = (left, right) => {
  const a = text(left);
  const b = text(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
};

const bytesToHex = (bytes) => Array.from(new Uint8Array(bytes))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

export const sha256Hex = async (value, cryptoApi = globalThis.crypto) => {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  return bytesToHex(await cryptoApi.subtle.digest('SHA-256', bytes));
};

export const hmacSha256Hex = async (secret, value, cryptoApi = globalThis.crypto) => {
  const key = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(text(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await cryptoApi.subtle.sign('HMAC', key, new TextEncoder().encode(String(value ?? '')));
  return bytesToHex(signature);
};

export const buildSiteCpaSignatureInput = ({ timestamp, nonce, rawBody }) => [
  text(timestamp),
  text(nonce),
  String(rawBody ?? ''),
].join('.');

export const normalizeSiteCpaRequest = ({ headers, payload = {} } = {}) => ({
  origin: text(header(headers, 'x-origin') || payload.origin || payload.origem).toUpperCase(),
  version: text(payload.version || payload.contractVersion),
  operation: text(payload.operation || payload.action),
  correlationId: text(header(headers, 'x-correlation-id') || payload.correlationId),
  idempotencyKey: text(header(headers, 'idempotency-key') || payload.idempotencyKey),
  timestamp: text(header(headers, 'x-site-cpa-timestamp')),
  nonce: text(header(headers, 'x-site-cpa-nonce')),
  signature: text(header(headers, 'x-site-cpa-signature')).toLowerCase(),
  contentType: text(header(headers, 'content-type')).toLowerCase(),
  bearerToken: text(header(headers, 'authorization')).replace(/^Bearer\s+/i, ''),
  requestedGroupId: text(payload?.context?.groupId || payload?.context?.group_id || payload.groupId || payload.group_id),
  requestedEmpresaId: text(payload?.context?.empresaId || payload?.context?.empresa_id || payload.empresaId || payload.empresa_id),
});

export const isSiteCpaRequest = ({ headers, payload = {} } = {}) => {
  const request = normalizeSiteCpaRequest({ headers, payload });
  return request.origin === SITE_CPA_ORIGIN;
};

export const validateSiteCpaContract = ({ request, now = Date.now(), clockSkewMs = DEFAULT_CLOCK_SKEW_MS } = {}) => {
  if (request?.origin !== SITE_CPA_ORIGIN) return { ok: false, status: 400, code: 'site_cpa_origin_required' };
  if (request?.version !== SITE_CPA_CONTRACT_VERSION) return { ok: false, status: 400, code: 'site_cpa_version_unsupported' };
  if (!request?.contentType?.startsWith('application/json')) {
    return { ok: false, status: 415, code: 'site_cpa_content_type_invalid' };
  }
  if (!request?.operation || !/^site[A-Z][A-Za-z0-9]*$/.test(request.operation)) {
    return { ok: false, status: 400, code: 'site_cpa_operation_invalid' };
  }
  if (!request?.correlationId || request.correlationId.length > 128) {
    return { ok: false, status: 400, code: 'site_cpa_correlation_invalid' };
  }
  if (!request?.nonce || request.nonce.length < 16 || request.nonce.length > 160) {
    return { ok: false, status: 400, code: 'site_cpa_nonce_invalid' };
  }
  const timestamp = Date.parse(request?.timestamp || '');
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > clockSkewMs) {
    return { ok: false, status: 401, code: 'site_cpa_timestamp_invalid' };
  }
  if (request.operation !== SITE_CPA_HEALTH_OPERATION && (!request.idempotencyKey || request.idempotencyKey.length > 160)) {
    return { ok: false, status: 400, code: 'site_cpa_idempotency_required' };
  }
  return { ok: true, status: 200, code: null };
};

export const resolveSiteCpaScope = ({ request, configuredGroupId, defaultEmpresaId, allowedEmpresaIds = [] } = {}) => {
  const groupId = text(configuredGroupId);
  const fallbackEmpresaId = text(defaultEmpresaId);
  const allowed = new Set((Array.isArray(allowedEmpresaIds) ? allowedEmpresaIds : csv(allowedEmpresaIds)).map(text));
  const requestedGroupId = text(request?.requestedGroupId);
  const requestedEmpresaId = text(request?.requestedEmpresaId);

  if (!groupId || !fallbackEmpresaId || !allowed.size || !allowed.has(fallbackEmpresaId)) {
    return { ok: false, status: 503, code: 'site_cpa_scope_not_configured' };
  }
  if (requestedGroupId && requestedGroupId !== groupId) {
    return { ok: false, status: 403, code: 'site_cpa_group_forbidden' };
  }
  const empresaId = requestedEmpresaId || fallbackEmpresaId;
  if (!allowed.has(empresaId)) return { ok: false, status: 403, code: 'site_cpa_empresa_forbidden' };
  return { ok: true, groupId, empresaId, scopeType: 'empresa' };
};

export const verifySiteCpaAuthentication = async ({
  request,
  rawBody,
  serviceToken,
  hmacSecret,
  cryptoApi = globalThis.crypto,
} = {}) => {
  if (!text(serviceToken) || !text(hmacSecret)) return { ok: false, status: 503, code: 'site_cpa_credentials_not_configured' };
  if (!constantTimeEqual(request?.bearerToken, serviceToken)) return { ok: false, status: 401, code: 'site_cpa_token_invalid' };
  if (!/^[a-f0-9]{64}$/i.test(request?.signature || '')) return { ok: false, status: 401, code: 'site_cpa_signature_invalid' };
  const expected = await hmacSha256Hex(
    hmacSecret,
    buildSiteCpaSignatureInput({ timestamp: request.timestamp, nonce: request.nonce, rawBody }),
    cryptoApi,
  );
  return constantTimeEqual(request.signature, expected)
    ? { ok: true, status: 200, code: null }
    : { ok: false, status: 401, code: 'site_cpa_signature_invalid' };
};

export const buildSiteCpaResponse = ({
  ok,
  data = null,
  code = null,
  message = null,
  request = {},
  replayed = false,
  details = null,
} = {}) => ({
  ok: ok === true,
  data: ok === true ? data : null,
  error: ok === true ? null : {
    code: code || 'site_cpa_error',
    message: message || code || 'site_cpa_error',
    ...(details ? { details } : {}),
  },
  meta: {
    version: SITE_CPA_CONTRACT_VERSION,
    origin: SITE_CPA_ORIGIN,
    operation: request.operation || null,
    correlationId: request.correlationId || null,
    idempotencyKey: request.idempotencyKey || null,
    replayed: replayed === true,
  },
});

const jsonResponse = (body, status) => Response.json(body, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const errorResponse = ({ request, status, code, message, details }) => jsonResponse(
  buildSiteCpaResponse({ ok: false, request, code, message, details }),
  status,
);

const envNumber = (env, name, fallback) => {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const eventSnapshot = ({
  request,
  scope,
  requestHash,
  nonceHash,
  status,
  httpStatus,
  responsePayload = null,
  errorCode = null,
}) => ({
  group_id: scope.groupId,
  empresa_id: scope.empresaId,
  origem: SITE_CPA_ORIGIN,
  operacao: request.operation,
  correlation_id: request.correlationId,
  idempotency_key: request.idempotencyKey || null,
  nonce_hash: nonceHash,
  request_hash: requestHash,
  status,
  http_status: httpStatus,
  tentativas: 1,
  expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
  response_payload: responsePayload,
  erro_codigo: errorCode,
});

const validateConfiguredCompany = async (base44, scope) => {
  const companies = await base44.asServiceRole.entities.Empresa.filter({ id: scope.empresaId }, undefined, 1);
  const company = Array.isArray(companies) ? companies[0] : null;
  const companyGroupId = text(company?.group_id || company?.grupo_id);
  return Boolean(company && companyGroupId === scope.groupId);
};

const enforcePersistentReplayAndRateLimit = async ({
  base44,
  request,
  scope,
  requestHash,
  nonceHash,
  env,
  now,
}) => {
  const events = base44.asServiceRole.entities.IntegracaoEvento;
  const replay = await events.filter({
    origem: SITE_CPA_ORIGIN,
    group_id: scope.groupId,
    nonce_hash: nonceHash,
  }, '-created_date', 1);
  if (replay?.length) return { ok: false, status: 409, code: 'site_cpa_replay_detected' };

  if (request.idempotencyKey) {
    const matches = await events.filter({
      origem: SITE_CPA_ORIGIN,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      operacao: request.operation,
      idempotency_key: request.idempotencyKey,
    }, '-created_date', 1);
    const previous = matches?.[0] || null;
    if (previous && previous.request_hash !== requestHash) {
      return { ok: false, status: 409, code: 'site_cpa_idempotency_conflict' };
    }
    if (previous?.status === 'concluido' && previous.response_payload) {
      return {
        ok: true,
        replayed: true,
        response: previous.response_payload,
        status: Number(previous.http_status || 200),
      };
    }
  }

  const limit = envNumber(env, 'SITE_CPA_RATE_LIMIT', DEFAULT_RATE_LIMIT);
  const windowMs = envNumber(env, 'SITE_CPA_RATE_WINDOW_MS', DEFAULT_RATE_WINDOW_MS);
  const recent = await events.filter({
    origem: SITE_CPA_ORIGIN,
    group_id: scope.groupId,
  }, '-created_date', limit + 1);
  const withinWindow = (recent || []).filter((item) => {
    const createdAt = Date.parse(item.created_date || item.data_hora || '');
    return Number.isFinite(createdAt) && now - createdAt <= windowMs;
  });
  if (withinWindow.length >= limit) return { ok: false, status: 429, code: 'site_cpa_rate_limited' };
  return { ok: true, replayed: false };
};

const auditSiteCpaEvent = async ({ base44, request, scope, status, code = null }) => {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: SITE_CPA_ORIGIN,
    acao: status === 'concluido' ? 'Execucao' : 'Bloqueio',
    modulo: 'Integracoes',
    tipo_auditoria: status === 'concluido' ? 'integracao' : 'seguranca',
    entidade: SITE_CPA_ORIGIN,
    descricao: `${request.operation} ${status}`,
    empresa_id: scope.empresaId,
    group_id: scope.groupId,
    dados_novos: {
      operation: request.operation,
      correlation_id: request.correlationId,
      idempotency_key: request.idempotencyKey || null,
      status,
      error_code: code,
    },
    data_hora: new Date().toISOString(),
    sucesso: status === 'concluido',
  });
};

export const handleSiteCpaGatewayRequest = async ({
  req,
  base44,
  payload,
  rawBody,
  env,
  now = Date.now(),
} = {}) => {
  if (!isSiteCpaRequest({ headers: req.headers, payload })) return null;
  const request = normalizeSiteCpaRequest({ headers: req.headers, payload });
  if (new TextEncoder().encode(String(rawBody ?? '')).byteLength > MAX_BODY_BYTES) {
    return errorResponse({ request, status: 413, code: 'site_cpa_payload_too_large' });
  }
  const contract = validateSiteCpaContract({ request, now });
  if (!contract.ok) return errorResponse({ request, ...contract });

  const authentication = await verifySiteCpaAuthentication({
    request,
    rawBody,
    serviceToken: env('SITE_CPA_SERVICE_TOKEN'),
    hmacSecret: env('SITE_CPA_HMAC_SECRET'),
  });
  if (!authentication.ok) return errorResponse({ request, ...authentication });

  const scope = resolveSiteCpaScope({
    request,
    configuredGroupId: env('SITE_CPA_GROUP_ID'),
    defaultEmpresaId: env('SITE_CPA_DEFAULT_EMPRESA_ID'),
    allowedEmpresaIds: env('SITE_CPA_ALLOWED_EMPRESA_IDS'),
  });
  if (!scope.ok) return errorResponse({ request, ...scope });

  try {
    if (!await validateConfiguredCompany(base44, scope)) {
      return errorResponse({ request, status: 403, code: 'site_cpa_company_scope_invalid' });
    }
  } catch {
    return errorResponse({ request, status: 503, code: 'site_cpa_company_lookup_unavailable' });
  }

  const requestHash = await sha256Hex(rawBody);
  const nonceHash = await sha256Hex(request.nonce);
  let gate;
  try {
    gate = await enforcePersistentReplayAndRateLimit({
      base44, request, scope, requestHash, nonceHash, env, now,
    });
  } catch {
    return errorResponse({ request, status: 503, code: 'site_cpa_security_ledger_unavailable' });
  }
  if (!gate.ok) return errorResponse({ request, ...gate });
  if (gate.replayed) {
    return jsonResponse({
      ...gate.response,
      meta: { ...gate.response.meta, replayed: true },
    }, gate.status);
  }

  let event;
  try {
    event = await base44.asServiceRole.entities.IntegracaoEvento.create(eventSnapshot({
      request,
      scope,
      requestHash,
      nonceHash,
      status: 'processando',
      httpStatus: 102,
    }));
  } catch {
    return errorResponse({ request, status: 503, code: 'site_cpa_security_ledger_unavailable' });
  }

  const finish = async ({ status, body, eventStatus, errorCode = null }) => {
    try {
      await auditSiteCpaEvent({ base44, request, scope, status: eventStatus, code: errorCode });
      await base44.asServiceRole.entities.IntegracaoEvento.update(event.id, {
        status: eventStatus,
        http_status: status,
        response_payload: body,
        erro_codigo: errorCode,
      });
      return jsonResponse(body, status);
    } catch {
      return errorResponse({ request, status: 503, code: 'site_cpa_audit_unavailable' });
    }
  };

  if (request.operation === SITE_CPA_HEALTH_OPERATION) {
    const paymentState = await paymentCapability({ base44, scope, env });
    const portalStates = await portalCapabilities({ base44, scope });
    const deliveryState = await deliveryCapability({ base44, scope });
    const chatState = await chatCapability({ base44, scope });
    const armationStates = await armationCapabilities({ base44, scope });
    const workStates = await workCapabilities({ base44, scope });
    const aggregateWorkState = [armationStates.WORK, workStates.WORK].includes('blocked')
      ? 'blocked' : [armationStates.WORK, workStates.WORK].includes('degraded') ? 'degraded' : 'ready';
    const body = buildSiteCpaResponse({
      ok: true,
      request,
      data: {
        status: 'ok',
        contractVersion: SITE_CPA_CONTRACT_VERSION,
        origin: SITE_CPA_ORIGIN,
        scope: {
          groupId: scope.groupId,
          empresaId: scope.empresaId,
          scopeType: scope.scopeType,
        },
        capabilities: {
          CUSTOMER_RESOLVE: 'ready',
          CATALOG_READ: 'ready',
          ORDER_CREATE: 'ready',
          QUOTE_CREATE: 'ready',
          NEGOTIATION: 'ready',
          PAYMENT: paymentState,
          ...portalStates,
          DELIVERY: deliveryState,
          CHAT: chatState,
          ...armationStates,
          ...workStates,
          WORK: aggregateWorkState,
        },
      },
    });
    return finish({ status: 200, body, eventStatus: 'concluido' });
  }

  const routed = await routeSiteCpaOperation({
    base44, payload, scope, request, env, now, buildResponse: buildSiteCpaResponse,
  });
  if (routed.handled) {
    return finish(routed);
  }

  const body = buildSiteCpaResponse({
    ok: false,
    request,
    code: 'site_cpa_operation_not_implemented',
  });
  return finish({
    status: 501,
    body,
    eventStatus: 'rejeitado',
    errorCode: 'site_cpa_operation_not_implemented',
  });
};
