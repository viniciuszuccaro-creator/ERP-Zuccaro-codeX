import assert from 'node:assert/strict';
import test from 'node:test';

import { SITE_CPA_HEALTH_OPERATION } from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';
import { buildSiteCpaHealth, coreSiteCapabilities } from '../base44/functions/_lib/security/siteCpaS2SPolicy/health.ts';
import { SITE_CPA_CUSTOMER_RESOLVE_OPERATION } from '../base44/functions/_lib/security/siteCpaCustomerResolve/entry.ts';
import { SITE_CPA_CATALOG_LIST_OPERATION } from '../base44/functions/_lib/security/siteCpaCatalogRead/entry.ts';
import { SITE_CPA_ORDER_CREATE_OPERATION } from '../base44/functions/_lib/security/siteCpaOrderCreate/entry.ts';
import { QUOTE_OPERATIONS } from '../base44/functions/_lib/security/siteCpaQuoteNegotiation/contract.ts';
import { SITE_CPA_PAYMENT_CANCEL_OPERATION, SITE_CPA_PAYMENT_CREATE_OPERATION,
  SITE_CPA_PAYMENT_STATUS_OPERATION } from '../base44/functions/_lib/security/siteCpaPayment/contract.ts';
import { SITE_CPA_PORTAL_OPERATIONS } from '../base44/functions/_lib/security/siteCpaPortal/contract.ts';
import { SITE_CPA_DELIVERY_OPERATIONS } from '../base44/functions/_lib/security/siteCpaDelivery/contract.ts';
import { SITE_CPA_CHAT_OPERATIONS } from '../base44/functions/_lib/security/siteCpaChat/contract.ts';
import { SITE_CPA_ARMACAO_OPERATIONS } from '../base44/functions/_lib/security/siteCpaArmacao/contract.ts';
import { SITE_CPA_WORK_OPERATIONS } from '../base44/functions/_lib/security/siteCpaWork/contract.ts';
import { SITE_CPA_OPPORTUNITY_OPERATIONS } from '../base44/functions/_lib/security/siteCpaOpportunity/contract.ts';
import { routeSiteCpaOperation } from '../base44/functions/_lib/security/siteCpaOperationRouter/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const publicOperations = [
  SITE_CPA_HEALTH_OPERATION, SITE_CPA_CUSTOMER_RESOLVE_OPERATION, SITE_CPA_CATALOG_LIST_OPERATION,
  SITE_CPA_ORDER_CREATE_OPERATION, ...QUOTE_OPERATIONS,
  SITE_CPA_PAYMENT_CREATE_OPERATION, SITE_CPA_PAYMENT_STATUS_OPERATION, SITE_CPA_PAYMENT_CANCEL_OPERATION,
  ...SITE_CPA_PORTAL_OPERATIONS, ...SITE_CPA_DELIVERY_OPERATIONS, ...SITE_CPA_CHAT_OPERATIONS,
  ...SITE_CPA_ARMACAO_OPERATIONS, ...SITE_CPA_WORK_OPERATIONS, ...SITE_CPA_OPPORTUNITY_OPERATIONS,
];

test('inventário oficial possui 43 operations únicas e todas as operations de domínio estão roteadas', async () => {
  assert.equal(publicOperations.length, 43);
  assert.equal(new Set(publicOperations).size, publicOperations.length);
  assert.equal(publicOperations.every((operation) => /^site[A-Z][A-Za-z0-9]*$/.test(operation)), true);
  for (const operation of publicOperations.filter((item) => item !== SITE_CPA_HEALTH_OPERATION)) {
    const routed = await routeSiteCpaOperation({
      base44: {}, payload: {}, scope, request: { operation, correlationId: 'hml-correlation' },
      env: () => '', now: Date.now(),
      buildResponse: ({ ok, code }) => ({ ok, error: ok ? null : { code } }),
    });
    assert.equal(routed.handled, true, `${operation} sem roteamento`);
  }
});

const createHealthBase44 = () => {
  const names = [
    'Cliente', 'SolicitacaoAprovacao', 'Produto', 'CatalogoWeb', 'GrupoProduto', 'UnidadeMedida',
    'FormaPagamento', 'Pedido', 'AuditLog', 'Oportunidade', 'NotaFiscal', 'ContaReceber',
    'IntegracaoEvento', 'Entrega', 'ConversaOmnicanal', 'MensagemOmnicanal', 'Projeto', 'CentroCusto',
  ];
  const entities = Object.fromEntries(names.map((name) => [name, {
    filter: async () => [], create: async (record) => ({ id: `${name}-1`, ...record }),
    update: async (_id, patch) => patch,
  }]));
  return { asServiceRole: { entities, integrations: { Core: {
    CreateFileSignedUrl: async () => ({ signed_url: 'signed' }),
  } } } };
};

test('health só marca core ready após sondar contratos reais e degrada blockers externos', async () => {
  const base44 = createHealthBase44();
  assert.deepEqual(await coreSiteCapabilities({ base44, scope }), {
    CUSTOMER_RESOLVE: 'ready', CATALOG_READ: 'ready', ORDER_CREATE: 'ready',
    QUOTE_CREATE: 'ready', NEGOTIATION: 'ready',
  });
  const health = await buildSiteCpaHealth({
    base44, scope, env: () => '', now: Date.parse('2026-09-13T18:00:00.000Z'),
    contractVersion: '1', origin: 'SITE_CPA',
  });
  assert.equal(health.status, 'degraded');
  assert.equal(health.timestamp, '2026-09-13T18:00:00.000Z');
  assert.equal(health.capabilities.PRODUCTION_RELEASE, 'blocked');
  assert.equal(health.capabilities.COMMERCIAL_COPILOT, 'degraded');
  assert.equal(health.dependencies.PAYMENT_PROVIDER, 'blocked');
  assert.equal(health.dependencies.AI_PROVIDER, 'not_verified');
  assert.equal(JSON.stringify(health).includes('secret'), false);
});

test('health bloqueia o ERP para E2E quando capability central não está disponível', async () => {
  const base44 = createHealthBase44();
  delete base44.asServiceRole.entities.Produto;
  const health = await buildSiteCpaHealth({ base44, scope, env: () => '', now: 0,
    contractVersion: '1', origin: 'SITE_CPA' });
  assert.equal(health.status, 'blocked');
  assert.equal(health.capabilities.CATALOG_READ, 'blocked');
  assert.equal(health.capabilities.ORDER_CREATE, 'blocked');
});
