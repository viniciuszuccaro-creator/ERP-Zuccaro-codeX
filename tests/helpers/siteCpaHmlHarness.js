/**
 * Harness S2S de preparação GO-LIVE-HML-01 (Opção A).
 * Reutiliza hmacSha256Hex / validateSiteCpaContract / routeSiteCpaOperation / handleSiteCpaGatewayRequest.
 * Credenciais sintéticas de teste — nunca de produção.
 */

import {
  SITE_CPA_CONTRACT_VERSION,
  SITE_CPA_HEALTH_OPERATION,
  SITE_CPA_ORIGIN,
  buildSiteCpaResponse,
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
  normalizeSiteCpaRequest,
  validateSiteCpaContract,
} from '../../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';
import { buildSiteCpaHealth } from '../../base44/functions/_lib/security/siteCpaS2SPolicy/health.ts';
import { routeSiteCpaOperation } from '../../base44/functions/_lib/security/siteCpaOperationRouter/entry.ts';
import { createSiteCpaHmlDataset } from './siteCpaHmlDataset.js';

/** Segredos sintéticos claramente marcados — não são credenciais reais. */
export const HML_TEST_SERVICE_TOKEN = 'hml-test-service-token-not-a-real-secret';
export const HML_TEST_HMAC_SECRET = 'hml-test-hmac-not-a-real-secret';

export const HML_TEST_NOW = Date.parse('2026-09-15T12:00:00.000Z');
export const HML_TEST_TIMESTAMP = '2026-09-15T12:00:00.000Z';

const text = (value) => String(value ?? '').trim();

const matchesFilter = (record, filter = {}) => Object.entries(filter).every(([key, expected]) => {
  const actual = record[key];
  if (expected && typeof expected === 'object' && '$in' in expected) {
    return expected.$in.map(String).includes(String(actual));
  }
  return actual === expected;
});

export const createHmlEnv = (overrides = {}) => {
  const dataset = createSiteCpaHmlDataset();
  const values = {
    SITE_CPA_SERVICE_TOKEN: HML_TEST_SERVICE_TOKEN,
    SITE_CPA_HMAC_SECRET: HML_TEST_HMAC_SECRET,
    SITE_CPA_GROUP_ID: dataset.ids.groupId,
    SITE_CPA_DEFAULT_EMPRESA_ID: dataset.ids.empresaId,
    SITE_CPA_ALLOWED_EMPRESA_IDS: dataset.ids.empresaId,
    SITE_CPA_RATE_LIMIT: '120',
    SITE_CPA_RATE_WINDOW_MS: '60000',
    // Payment / provider deliberadamente vazios → PROVIDER_BLOCKED honesto
    SITE_CPA_PAYMENT_API_KEY: '',
    SITE_CPA_PAYMENT_WEBHOOK_SECRET: '',
    SITE_CPA_PAYMENT_CUSTOMER_ID: '',
    SITE_CPA_PAYMENT_WEBHOOK_RATE_LIMIT: '',
    ...overrides,
  };
  return (name) => values[name] ?? '';
};

/** Env vazio (sem credenciais) — health/credentials fail-closed. */
export const emptyHmlEnv = () => () => '';

export const createHmlEntityStore = (dataset) => {
  const audits = [];
  const records = structuredClone(dataset.records);
  const entityNames = Object.keys(records);

  const makeEntity = (name) => {
    const rows = () => records[name];
    return {
      filter: async (filter = {}, _order, _limit) => {
        if (!rows()) throw new Error(`${name} unavailable`);
        return rows().filter((row) => matchesFilter(row, filter));
      },
      create: async (record) => {
        if (!rows()) throw new Error(`${name} unavailable`);
        const created = {
          id: record.id || `hml_${name.toLowerCase()}_${rows().length + 1}`,
          created_date: HML_TEST_TIMESTAMP,
          updated_date: HML_TEST_TIMESTAMP,
          ...record,
        };
        rows().push(created);
        return created;
      },
      update: async (id, patch) => {
        const found = rows()?.find((row) => row.id === id);
        if (!found) throw new Error(`${name} missing`);
        Object.assign(found, patch, { updated_date: HML_TEST_TIMESTAMP });
        return found;
      },
    };
  };

  const entities = Object.fromEntries(entityNames.map((name) => [name, makeEntity(name)]));
  entities.AuditLog = {
    create: async (record) => {
      const created = { id: `hml_audit_${audits.length + 1}`, ...record };
      audits.push(created);
      return created;
    },
  };

  const base44 = {
    asServiceRole: {
      entities,
      integrations: {
        Core: {
          // Sem storage real → download externo permanece BLOCKED / unavailable
          CreateFileSignedUrl: async () => {
            throw new Error('private_storage_not_configured');
          },
        },
      },
    },
  };

  return { base44, records, audits, dataset };
};

export const buildSignedHmlRequest = async ({
  operation,
  data = {},
  context = {},
  correlationId = `hml-corr-${operation}`,
  idempotencyKey = operation === SITE_CPA_HEALTH_OPERATION ? '' : `hml-idem-${operation}-${Date.now()}`,
  nonce = `hml-nonce-${operation}-abcdef12`,
  timestamp = HML_TEST_TIMESTAMP,
  env = createHmlEnv(),
  extraPayload = {},
} = {}) => {
  const payload = {
    version: SITE_CPA_CONTRACT_VERSION,
    origin: SITE_CPA_ORIGIN,
    operation,
    correlationId,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    context: {
      groupId: context.groupId,
      empresaId: context.empresaId,
      ...context,
    },
    data,
    ...extraPayload,
  };
  const rawBody = JSON.stringify(payload);
  const hmacSecret = env('SITE_CPA_HMAC_SECRET') || HML_TEST_HMAC_SECRET;
  const serviceToken = env('SITE_CPA_SERVICE_TOKEN') || HML_TEST_SERVICE_TOKEN;
  const signature = await hmacSha256Hex(
    hmacSecret,
    buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }),
  );
  const headers = new Headers({
    authorization: `Bearer ${serviceToken}`,
    'content-type': 'application/json',
    'x-origin': SITE_CPA_ORIGIN,
    'x-correlation-id': correlationId,
    'x-site-cpa-timestamp': timestamp,
    'x-site-cpa-nonce': nonce,
    'x-site-cpa-signature': signature,
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  });
  return { payload, rawBody, headers, signature, correlationId, idempotencyKey, nonce, timestamp };
};

export const invokeHmlGateway = async ({
  store,
  operation,
  data = {},
  context = {},
  env = createHmlEnv(),
  now = HML_TEST_NOW,
  idempotencyKey,
  correlationId,
  nonce,
} = {}) => {
  const signed = await buildSignedHmlRequest({
    operation,
    data,
    context: {
      groupId: store.dataset.ids.groupId,
      empresaId: store.dataset.ids.empresaId,
      ...context,
    },
    env,
    idempotencyKey,
    correlationId,
    nonce,
  });
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: signed.headers },
    base44: store.base44,
    payload: signed.payload,
    rawBody: signed.rawBody,
    env,
    now,
  });
  const body = await response.json();
  return { response, body, signed, audits: store.audits };
};

export const validateHmlContract = ({ operation, correlationId = 'hml-corr', idempotencyKey = 'hml-idem', now = HML_TEST_NOW } = {}) => {
  const request = normalizeSiteCpaRequest({
    headers: new Headers({
      authorization: `Bearer ${HML_TEST_SERVICE_TOKEN}`,
      'content-type': 'application/json',
      'x-origin': SITE_CPA_ORIGIN,
      'x-correlation-id': correlationId,
      'x-site-cpa-timestamp': HML_TEST_TIMESTAMP,
      'x-site-cpa-nonce': 'hml-nonce-abcdefghijklmnop',
      'x-site-cpa-signature': 'a'.repeat(64),
      ...(operation === SITE_CPA_HEALTH_OPERATION ? {} : { 'idempotency-key': idempotencyKey }),
    }),
    payload: {
      version: SITE_CPA_CONTRACT_VERSION,
      operation,
      correlationId,
      idempotencyKey: operation === SITE_CPA_HEALTH_OPERATION ? '' : idempotencyKey,
    },
  });
  return { request, result: validateSiteCpaContract({ request, now }) };
};

export const routeHmlOperation = async ({
  store,
  operation,
  data = {},
  env = createHmlEnv(),
  now = HML_TEST_NOW,
  correlationId = `hml-route-${operation}`,
  idempotencyKey = `hml-route-idem-${operation}`,
} = {}) => {
  const routed = await routeSiteCpaOperation({
    base44: store.base44,
    payload: { data },
    scope: store.dataset.scope,
    request: { operation, correlationId, idempotencyKey },
    env,
    now,
    buildResponse: buildSiteCpaResponse,
  });
  return {
    ...routed,
    // Alias estável para os testes de readiness (router nativo usa `body`).
    response: routed.body,
  };
};

export const probeHmlHealth = async ({ store, env = createHmlEnv(), now = HML_TEST_NOW } = {}) => (
  buildSiteCpaHealth({
    base44: store.base44,
    scope: store.dataset.scope,
    env,
    now,
    contractVersion: SITE_CPA_CONTRACT_VERSION,
    origin: SITE_CPA_ORIGIN,
  })
);

export const createHmlHarness = (datasetOverrides = {}) => {
  const dataset = createSiteCpaHmlDataset(datasetOverrides);
  const store = createHmlEntityStore(dataset);
  const env = createHmlEnv();
  return {
    dataset,
    store,
    env,
    emptyEnv: emptyHmlEnv(),
    ids: dataset.ids,
    scope: dataset.scope,
    invoke: (args) => invokeHmlGateway({ store, env, ...args }),
    route: (args) => routeHmlOperation({ store, env, ...args }),
    health: (args = {}) => probeHmlHealth({ store, env, ...args }),
    healthEmptyEnv: () => probeHmlHealth({ store, env: emptyHmlEnv() }),
    validate: validateHmlContract,
  };
};

export const assertNoSecretsInPayload = (value) => {
  const serialized = JSON.stringify(value);
  const forbidden = [
    HML_TEST_SERVICE_TOKEN,
    HML_TEST_HMAC_SECRET,
    'provider-key',
    'webhook-secret',
    'chave_api',
    'password',
    'custo_medio',
    'margem_minima',
    'Nota interna HML',
    'interno-hml-nao-expor',
  ];
  return {
    serialized,
    leaked: forbidden.filter((item) => text(item) && serialized.includes(item)),
  };
};
