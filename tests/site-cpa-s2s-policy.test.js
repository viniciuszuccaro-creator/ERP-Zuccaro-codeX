import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_CONTRACT_VERSION,
  SITE_CPA_ORIGIN,
  buildSiteCpaResponse,
  buildSiteCpaSignatureInput,
  constantTimeEqual,
  hmacSha256Hex,
  handleSiteCpaGatewayRequest,
  isSiteCpaRequest,
  normalizeSiteCpaRequest,
  resolveSiteCpaScope,
  validateSiteCpaContract,
  verifySiteCpaAuthentication,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const timestamp = '2026-09-13T12:00:00.000Z';
const now = Date.parse(timestamp);

const request = (overrides = {}) => ({
  origin: SITE_CPA_ORIGIN,
  version: SITE_CPA_CONTRACT_VERSION,
  operation: 'siteHealth',
  correlationId: 'corr-123',
  idempotencyKey: '',
  timestamp,
  nonce: 'nonce-1234567890abcdef',
  signature: '',
  bearerToken: 'service-token',
  contentType: 'application/json',
  requestedGroupId: '',
  requestedEmpresaId: '',
  ...overrides,
});

test('normaliza envelope e headers do contrato Site CPA', () => {
  const normalized = normalizeSiteCpaRequest({
    headers: new Headers({
      authorization: 'Bearer service-token',
      'content-type': 'application/json',
      'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-123',
      'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': 'nonce-1234567890abcdef',
      'x-site-cpa-signature': 'a'.repeat(64),
    }),
    payload: { version: '1', operation: 'siteHealth', context: { empresaId: 'cpa-aco' } },
  });
  assert.equal(normalized.origin, SITE_CPA_ORIGIN);
  assert.equal(normalized.version, '1');
  assert.equal(normalized.operation, 'siteHealth');
  assert.equal(normalized.bearerToken, 'service-token');
  assert.equal(normalized.requestedEmpresaId, 'cpa-aco');
});

test('operacao legada site* sem origem SITE_CPA nao entra no novo gateway', () => {
  assert.equal(isSiteCpaRequest({
    headers: new Headers({ 'content-type': 'application/json' }),
    payload: { version: '1', operation: 'sitePedidoCreate' },
  }), false);
  assert.equal(isSiteCpaRequest({
    headers: new Headers({ 'content-type': 'application/json', 'x-origin': 'SITE_CPA' }),
    payload: { version: '1', operation: 'sitePedidoCreate' },
  }), true);
});

test('contrato falha fechado para versao, timestamp, nonce e idempotencia invalidos', () => {
  assert.equal(validateSiteCpaContract({ request: request(), now }).ok, true);
  assert.equal(validateSiteCpaContract({ request: request({ version: '2' }), now }).code, 'site_cpa_version_unsupported');
  assert.equal(validateSiteCpaContract({
    request: request({ timestamp: '2020-01-01T00:00:00Z' }), now,
  }).code, 'site_cpa_timestamp_invalid');
  assert.equal(validateSiteCpaContract({ request: request({ nonce: 'curto' }), now }).code, 'site_cpa_nonce_invalid');
  assert.equal(validateSiteCpaContract({
    request: request({ operation: 'sitePedidoCreate' }), now,
  }).code, 'site_cpa_idempotency_required');
});

test('escopo vem do servidor e rejeita grupo ou empresa adulterados', () => {
  const config = {
    configuredGroupId: 'grupo-cpa',
    defaultEmpresaId: 'cpa-aco',
    allowedEmpresaIds: 'cpa-aco,3z',
  };
  assert.deepEqual(resolveSiteCpaScope({ request: request(), ...config }), {
    ok: true,
    groupId: 'grupo-cpa',
    empresaId: 'cpa-aco',
    scopeType: 'empresa',
  });
  assert.equal(resolveSiteCpaScope({
    request: request({ requestedEmpresaId: '3z' }), ...config,
  }).empresaId, '3z');
  assert.equal(resolveSiteCpaScope({
    request: request({ requestedEmpresaId: 'outra' }), ...config,
  }).code, 'site_cpa_empresa_forbidden');
  assert.equal(resolveSiteCpaScope({
    request: request({ requestedGroupId: 'outro-grupo' }), ...config,
  }).code, 'site_cpa_group_forbidden');
});

test('token e assinatura HMAC precisam ser validos', async () => {
  const rawBody = JSON.stringify({ version: '1', operation: 'siteHealth' });
  const base = request();
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({
    timestamp: base.timestamp,
    nonce: base.nonce,
    rawBody,
  }));
  const valid = await verifySiteCpaAuthentication({
    request: { ...base, signature },
    rawBody,
    serviceToken: 'service-token',
    hmacSecret: 'hmac-secret',
  });
  assert.equal(valid.ok, true);
  assert.equal((await verifySiteCpaAuthentication({
    request: { ...base, signature, bearerToken: 'wrong' },
    rawBody,
    serviceToken: 'service-token',
    hmacSecret: 'hmac-secret',
  })).code, 'site_cpa_token_invalid');
  assert.equal((await verifySiteCpaAuthentication({
    request: { ...base, signature: 'b'.repeat(64) },
    rawBody,
    serviceToken: 'service-token',
    hmacSecret: 'hmac-secret',
  })).code, 'site_cpa_signature_invalid');
});

test('comparacao constante e resposta nao expoem segredo', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  const response = buildSiteCpaResponse({ ok: false, request: request(), code: 'negado' });
  assert.equal(response.error.code, 'negado');
  assert.equal(response.meta.origin, SITE_CPA_ORIGIN);
  assert.equal(JSON.stringify(response).includes('service-token'), false);
});

const gatewayRequest = async ({
  body = { version: '1', operation: 'siteHealth' },
  nonce = 'nonce-1234567890abcdef',
  events = [],
  failLedger = false,
} = {}) => {
  const rawBody = JSON.stringify(body);
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({
    timestamp,
    nonce,
    rawBody,
  }));
  const createdEvents = [];
  const audits = [];
  const eventStore = {
    filter: async (filter) => {
      if (failLedger) throw new Error('ledger offline');
      return events.filter((item) => Object.entries(filter).every(([key, value]) => item[key] === value));
    },
    create: async (record) => {
      if (failLedger) throw new Error('ledger offline');
      const created = { id: `event-${createdEvents.length + 1}`, created_date: timestamp, ...record };
      createdEvents.push(created);
      return created;
    },
    update: async (id, patch) => {
      const found = createdEvents.find((item) => item.id === id);
      Object.assign(found, patch);
      return found;
    },
  };
  const base44 = {
    asServiceRole: {
      entities: {
        Empresa: { filter: async () => [{ id: 'cpa-aco', group_id: 'grupo-cpa' }] },
        IntegracaoEvento: eventStore,
        AuditLog: { create: async (record) => { audits.push(record); return record; } },
      },
    },
  };
  const envValues = {
    SITE_CPA_SERVICE_TOKEN: 'service-token',
    SITE_CPA_HMAC_SECRET: 'hmac-secret',
    SITE_CPA_GROUP_ID: 'grupo-cpa',
    SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
    SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco,3z',
  };
  const req = {
    headers: new Headers({
      authorization: 'Bearer service-token',
      'content-type': 'application/json',
      'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-123',
      'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce,
      'x-site-cpa-signature': signature,
      ...(body.operation === 'siteHealth' ? {} : { 'idempotency-key': 'idem-123' }),
    }),
  };
  const response = await handleSiteCpaGatewayRequest({
    req,
    base44,
    payload: body,
    rawBody,
    env: (name) => envValues[name] || '',
    now,
  });
  return { response, body: await response.json(), createdEvents, audits };
};

test('healthcheck S2S usa empresa padrao, audita e persiste o evento', async () => {
  const result = await gatewayRequest();
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.data.scope.groupId, 'grupo-cpa');
  assert.equal(result.body.data.scope.empresaId, 'cpa-aco');
  assert.equal(result.body.data.capabilities.CUSTOMER_RESOLVE, 'ready');
  assert.equal(result.body.data.capabilities.CATALOG_READ, 'ready');
  assert.equal(result.body.data.capabilities.ORDER_CREATE, 'ready');
  assert.equal(result.body.data.capabilities.QUOTE_CREATE, 'ready');
  assert.equal(result.body.data.capabilities.NEGOTIATION, 'ready');
  assert.equal(result.body.data.capabilities.PAYMENT, 'blocked');
  assert.equal(result.body.data.capabilities.PORTAL, 'blocked');
  assert.equal(result.body.data.capabilities.PORTAL_FINANCIAL, 'blocked');
  assert.equal(result.body.data.capabilities.PORTAL_FISCAL, 'blocked');
  assert.equal(result.body.data.capabilities.PORTAL_DOCUMENT, 'blocked');
  assert.equal(result.body.data.capabilities.DELIVERY, 'blocked');
  assert.equal(result.createdEvents[0].status, 'concluido');
  assert.equal(result.audits.length, 1);
});

test('nonce repetido e ledger indisponivel falham fechados', async () => {
  const nonce = 'nonce-repetido-123456789';
  const nonceHash = await import('../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts')
    .then(({ sha256Hex }) => sha256Hex(nonce));
  const replay = await gatewayRequest({
    nonce,
    events: [{ origem: 'SITE_CPA', group_id: 'grupo-cpa', nonce_hash: nonceHash }],
  });
  assert.equal(replay.response.status, 409);
  assert.equal(replay.body.error.code, 'site_cpa_replay_detected');

  const offline = await gatewayRequest({ failLedger: true });
  assert.equal(offline.response.status, 503);
  assert.equal(offline.body.error.code, 'site_cpa_security_ledger_unavailable');
});

test('operacao futura autenticada responde nao implementada sem sucesso falso', async () => {
  const result = await gatewayRequest({
    body: { version: '1', operation: 'sitePortalList' },
    nonce: 'nonce-portal-12345678901',
  });
  assert.equal(result.response.status, 501);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error.code, 'site_cpa_operation_not_implemented');
  assert.equal(result.createdEvents[0].status, 'rejeitado');
  assert.equal(result.audits[0].sucesso, false);
});
