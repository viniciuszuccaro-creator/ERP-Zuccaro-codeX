import {
  buildSiteCpaSignatureInput,
  constantTimeEqual,
  hmacSha256Hex,
  sha256Hex,
} from '../siteCpaS2SPolicy/entry.ts';
import {
  SiteCpaPaymentError,
  findSiteCpaPaymentAttempt,
  reconcileSiteCpaProviderPayment,
} from '../siteCpaPayment/entry.ts';
import {
  normalizeProviderWebhook,
  resolvePaymentProviderConfig,
} from '../siteCpaPayment/provider.ts';

const PAYMENT_WEBHOOK_ORIGIN = 'PAYMENT_PROVIDER';
const PAYMENT_WEBHOOK_OPERATION = 'sitePagamentoWebhook';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;
const text = (value) => String(value ?? '').trim();
const header = (headers, name) => text(headers?.get?.(name) || headers?.[name] || headers?.[name.toLowerCase()]);
const jsonResponse = (body, status) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

const auditWebhook = async ({ base44, scope, outcome, success, eventId = null, attemptId = null }) => {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: 'PAYMENT_PROVIDER',
    acao: success ? 'Atualizacao' : 'Bloqueio',
    modulo: 'Financeiro',
    tipo_auditoria: success ? 'integracao' : 'seguranca',
    entidade: 'ContaReceber',
    descricao: `${PAYMENT_WEBHOOK_OPERATION} ${outcome}`,
    group_id: scope?.groupId || null,
    empresa_id: scope?.empresaId || null,
    dados_novos: {
      event_id: eventId,
      payment_attempt_id: attemptId,
      outcome,
    },
    data_hora: new Date().toISOString(),
    sucesso: success === true,
  });
};

const resolveWebhookScope = async ({ base44, empresaId }) => {
  let rows;
  try {
    rows = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId }, undefined, 2);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const company = (Array.isArray(rows) ? rows : [])[0] || null;
  const groupId = text(company?.group_id || company?.grupo_id);
  if (!company || !groupId) throw new SiteCpaPaymentError(403, 'site_cpa_payment_scope_forbidden');
  return { groupId, empresaId, scopeType: 'empresa' };
};

const verifyWebhookSignature = async ({ headers, rawBody, secret, now }) => {
  const timestamp = header(headers, 'x-payment-timestamp');
  const eventId = header(headers, 'x-payment-event-id');
  const signature = header(headers, 'x-payment-signature').toLowerCase();
  const parsed = Date.parse(timestamp);
  if (!eventId || eventId.length > 160 || !Number.isFinite(parsed) || Math.abs(now - parsed) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, eventId, code: 'site_cpa_payment_signature_invalid' };
  }
  if (!/^[a-f0-9]{64}$/.test(signature) || !secret) {
    return { ok: false, eventId, code: 'site_cpa_payment_signature_invalid' };
  }
  const expected = await hmacSha256Hex(
    secret,
    buildSiteCpaSignatureInput({ timestamp, nonce: eventId, rawBody }),
  );
  return constantTimeEqual(signature, expected)
    ? { ok: true, eventId, timestamp }
    : { ok: false, eventId, code: 'site_cpa_payment_signature_invalid' };
};

const findWebhookEvent = async ({ base44, scope, eventId }) => {
  const rows = await base44.asServiceRole.entities.IntegracaoEvento.filter({
    origem: PAYMENT_WEBHOOK_ORIGIN,
    operacao: PAYMENT_WEBHOOK_OPERATION,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    idempotency_key: eventId,
  }, '-created_date', 2);
  return (Array.isArray(rows) ? rows : [])[0] || null;
};

const enforceWebhookRateLimit = async ({ base44, scope, env, now }) => {
  const configured = Number(env?.('SITE_CPA_PAYMENT_WEBHOOK_RATE_LIMIT'));
  const limit = Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 5000)
    : 300;
  let rows;
  try {
    rows = await base44.asServiceRole.entities.IntegracaoEvento.filter({
      origem: PAYMENT_WEBHOOK_ORIGIN,
      operacao: PAYMENT_WEBHOOK_OPERATION,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    }, '-created_date', limit + 1);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const windowStart = now - 60 * 1000;
  const recentCount = (Array.isArray(rows) ? rows : []).filter((item) => {
    const createdAt = Date.parse(item.created_date || item.data_hora || '');
    return Number.isFinite(createdAt) && createdAt >= windowStart && createdAt <= now;
  }).length;
  if (recentCount >= limit) throw new SiteCpaPaymentError(429, 'site_cpa_payment_rate_limited');
};

const createWebhookEvent = async ({ base44, scope, eventId, requestHash, now }) => (
  base44.asServiceRole.entities.IntegracaoEvento.create({
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    origem: PAYMENT_WEBHOOK_ORIGIN,
    operacao: PAYMENT_WEBHOOK_OPERATION,
    correlation_id: eventId,
    idempotency_key: eventId,
    nonce_hash: await sha256Hex(eventId),
    request_hash: requestHash,
    status: 'processando',
    http_status: 102,
    tentativas: 1,
    expires_at: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
    response_payload: null,
    erro_codigo: null,
  })
);

export const handleSiteCpaPaymentWebhook = async ({
  req,
  base44,
  payload = {},
  rawBody = '',
  env = () => '',
  now = Date.now(),
} = {}) => {
  if (header(req?.headers, 'x-site-cpa-payment-webhook').toLowerCase() !== 'v1') return null;
  if (new TextEncoder().encode(String(rawBody)).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'site_cpa_payment_payload_too_large' }, 413);
  }
  const empresaId = header(req.headers, 'x-erp-empresa-id');
  const provider = header(req.headers, 'x-payment-provider').toUpperCase();
  if (!empresaId || !provider) {
    return jsonResponse({ ok: false, error: 'site_cpa_payment_scope_forbidden' }, 403);
  }
  let scope;
  let config;
  try {
    scope = await resolveWebhookScope({ base44, empresaId });
    config = await resolvePaymentProviderConfig({ base44, scope, env });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.code || 'site_cpa_payment_unavailable' }, error?.status || 503);
  }
  if (!config || config.provider !== provider) {
    return jsonResponse({ ok: false, error: 'site_cpa_payment_provider_unavailable' }, 503);
  }
  const signature = await verifyWebhookSignature({
    headers: req.headers,
    rawBody,
    secret: config.webhookSecret,
    now,
  });
  if (!signature.ok) {
    try { await auditWebhook({ base44, scope, outcome: 'PAYMENT_SIGNATURE_INVALID', success: false, eventId: signature.eventId }); } catch (error) {
      console.error('[siteCpaPaymentWebhook] security audit unavailable', { error: error?.message || String(error) });
    }
    return jsonResponse({ ok: false, error: signature.code }, 401);
  }
  const requestHash = await sha256Hex(rawBody);
  let previous;
  try {
    previous = await findWebhookEvent({ base44, scope, eventId: signature.eventId });
  } catch {
    return jsonResponse({ ok: false, error: 'site_cpa_payment_unavailable' }, 503);
  }
  if (previous) {
    if (text(previous.request_hash) !== requestHash) {
      return jsonResponse({ ok: false, error: 'site_cpa_payment_idempotency_conflict' }, 409);
    }
    if (previous.status === 'concluido') {
      try { await auditWebhook({ base44, scope, outcome: 'PAYMENT_DUPLICATE_EVENT', success: true, eventId: signature.eventId }); } catch (error) {
        console.error('[siteCpaPaymentWebhook] duplicate audit unavailable', { error: error?.message || String(error) });
      }
      return jsonResponse({ ok: true, replayed: true }, 200);
    }
    return jsonResponse({ ok: false, error: 'site_cpa_payment_replay' }, 409);
  }
  try {
    await enforceWebhookRateLimit({ base44, scope, env, now });
  } catch (error) {
    const code = error?.code || 'site_cpa_payment_unavailable';
    const status = error?.status || 503;
    try { await auditWebhook({ base44, scope, outcome: code, success: false, eventId: signature.eventId }); } catch {
      return jsonResponse({ ok: false, error: 'site_cpa_audit_unavailable' }, 503);
    }
    return jsonResponse({ ok: false, error: code }, status);
  }
  let ledger;
  try {
    ledger = await createWebhookEvent({ base44, scope, eventId: signature.eventId, requestHash, now });
    await auditWebhook({ base44, scope, outcome: 'webhook_received', success: true, eventId: signature.eventId });
  } catch {
    return jsonResponse({ ok: false, error: 'site_cpa_payment_unavailable' }, 503);
  }
  try {
    const normalized = normalizeProviderWebhook(provider, payload);
    if (!normalized.paymentAttemptId || !normalized.externalProviderId) {
      throw new SiteCpaPaymentError(400, 'site_cpa_payment_not_found');
    }
    const found = await findSiteCpaPaymentAttempt({
      base44,
      scope,
      paymentAttemptId: normalized.paymentAttemptId,
    });
    if (found.attempt.provider !== provider
      || text(found.attempt.externalProviderId) !== normalized.externalProviderId) {
      throw new SiteCpaPaymentError(403, 'site_cpa_payment_scope_forbidden');
    }
    const attempt = await reconcileSiteCpaProviderPayment({
      base44,
      scope,
      request: { operation: PAYMENT_WEBHOOK_OPERATION, correlationId: signature.eventId },
      event: found.event,
      attempt: found.attempt,
      providerResult: normalized,
      now,
    });
    await auditWebhook({
      base44, scope, outcome: 'webhook_accepted', success: true,
      eventId: signature.eventId, attemptId: attempt.paymentAttemptId,
    });
    await base44.asServiceRole.entities.IntegracaoEvento.update(ledger.id, {
      status: 'concluido',
      http_status: 200,
      response_payload: {
        payment_attempt_id: attempt.paymentAttemptId,
        status: attempt.status,
        reconciliation_status: attempt.reconciliationStatus,
      },
    });
    return jsonResponse({ ok: true, replayed: false }, 200);
  } catch (error) {
    const code = error instanceof SiteCpaPaymentError ? error.code : 'site_cpa_payment_unavailable';
    const status = error instanceof SiteCpaPaymentError ? error.status : 503;
    try {
      await auditWebhook({ base44, scope, outcome: code, success: false, eventId: signature.eventId });
      await base44.asServiceRole.entities.IntegracaoEvento.update(ledger.id, {
        status: 'rejeitado', http_status: status, erro_codigo: code,
      });
    } catch {
      return jsonResponse({ ok: false, error: 'site_cpa_audit_unavailable' }, 503);
    }
    return jsonResponse({ ok: false, error: code }, status);
  }
};
