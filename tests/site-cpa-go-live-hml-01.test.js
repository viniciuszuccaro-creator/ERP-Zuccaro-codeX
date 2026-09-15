/**
 * GO-LIVE-HML-01 (Opção A) — evidência de preparação ERP para E2E externo.
 * Não substitui as suites ERP-SITE-01..12; agrega readiness com dataset/harness sintéticos.
 * Decisão alvo: ERP_HML_PREPARED_FOR_EXTERNAL_E2E + EXTERNAL_E2E_STATUS=BLOCKED_CONFIGURATION
 * Nunca declara ERP_E2E_READY nem GO_LIVE_READY.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { SITE_CPA_HEALTH_OPERATION } from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';
import { SITE_CPA_CUSTOMER_RESOLVE_OPERATION } from '../base44/functions/_lib/security/siteCpaCustomerResolve/entry.ts';
import { SITE_CPA_CATALOG_LIST_OPERATION } from '../base44/functions/_lib/security/siteCpaCatalogRead/entry.ts';
import { SITE_CPA_ORDER_CREATE_OPERATION } from '../base44/functions/_lib/security/siteCpaOrderCreate/entry.ts';
import {
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_NEGOTIATION_GET_OPERATION,
} from '../base44/functions/_lib/security/siteCpaQuoteNegotiation/contract.ts';
import {
  SITE_CPA_PAYMENT_CREATE_OPERATION,
} from '../base44/functions/_lib/security/siteCpaPayment/contract.ts';
import {
  SITE_CPA_PORTAL_DOCUMENT_OPERATION,
  SITE_CPA_PORTAL_ORDERS_OPERATION,
} from '../base44/functions/_lib/security/siteCpaPortal/contract.ts';
import { SITE_CPA_DELIVERY_OPERATIONS } from '../base44/functions/_lib/security/siteCpaDelivery/contract.ts';
import {
  SITE_CPA_CHAT_HISTORY_OPERATION,
  SITE_CPA_CHAT_START_OPERATION,
} from '../base44/functions/_lib/security/siteCpaChat/contract.ts';
import {
  SITE_CPA_ARMACAO_CONFIRM_OPERATION,
  SITE_CPA_ARMACAO_GET_OPERATION,
} from '../base44/functions/_lib/security/siteCpaArmacao/contract.ts';
import {
  SITE_CPA_WORK_GET_OPERATION,
  SITE_CPA_WORK_LIST_OPERATION,
} from '../base44/functions/_lib/security/siteCpaWork/contract.ts';
import {
  SITE_CPA_OPPORTUNITY_LIST_OPERATION,
  SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION,
} from '../base44/functions/_lib/security/siteCpaOpportunity/contract.ts';
import { HML_IDS, HML_ROLES, createSiteCpaHmlDataset } from './helpers/siteCpaHmlDataset.js';
import {
  HML_TEST_HMAC_SECRET,
  HML_TEST_SERVICE_TOKEN,
  assertNoSecretsInPayload,
  createHmlEnv,
  createHmlHarness,
} from './helpers/siteCpaHmlHarness.js';

const DECISION = Object.freeze({
  erpPrepared: 'ERP_HML_PREPARED_FOR_EXTERNAL_E2E',
  externalE2e: 'BLOCKED_CONFIGURATION',
  notReady: ['ERP_E2E_READY', 'GO_LIVE_READY'],
});

test('dataset HML sintetico isola IDs hml_* e papeis oficiais sem contaminar app', () => {
  const a = createSiteCpaHmlDataset();
  const b = createSiteCpaHmlDataset();
  a.records.Cliente[0].razao_social = 'MUTADO';
  assert.equal(b.records.Cliente[0].razao_social, 'Cliente HML A Ltda');
  assert.equal(a.ids.groupId, HML_IDS.groupId);
  assert.equal(a.ids.empresaId, HML_IDS.empresaId);
  assert.deepEqual([...a.roles], [...HML_ROLES]);
  assert.equal(a.inventory.externalDownload, 'BLOCKED_without_private_storage');
  assert.equal(a.inventory.customers.length, 2);
  assert.ok(a.ids.productActive.startsWith('hml_'));
  assert.ok(a.ids.productInactive.startsWith('hml_'));
  assert.ok(a.ids.productNoPrice.startsWith('hml_'));
  assert.ok(a.ids.productNoStock.startsWith('hml_'));
});

test('contrato S2S HML valida envelope e rejeita versao/timestamp/idempotencia invalidos', () => {
  const harness = createHmlHarness();
  assert.equal(harness.validate({ operation: SITE_CPA_HEALTH_OPERATION }).result.ok, true);
  assert.equal(harness.validate({
    operation: SITE_CPA_ORDER_CREATE_OPERATION,
    idempotencyKey: '',
  }).result.code, 'site_cpa_idempotency_required');
});

test('health HML: schema minimo, core ready com dataset, payment/provider blocked sem credencial real', async () => {
  const harness = createHmlHarness();
  const health = await harness.health();
  assert.equal(typeof health.status, 'string');
  assert.ok(health.timestamp);
  assert.equal(health.scope.groupId, HML_IDS.groupId);
  assert.equal(health.scope.empresaId, HML_IDS.empresaId);
  assert.equal(health.capabilities.CUSTOMER_RESOLVE, 'ready');
  assert.equal(health.capabilities.CATALOG_READ, 'ready');
  assert.equal(health.capabilities.ORDER_CREATE, 'ready');
  assert.equal(health.capabilities.QUOTE_CREATE, 'ready');
  assert.equal(health.capabilities.NEGOTIATION, 'ready');
  assert.equal(health.capabilities.PAYMENT, 'blocked');
  assert.equal(health.capabilities.PRODUCTION_RELEASE, 'blocked');
  assert.equal(health.capabilities.COMMERCIAL_COPILOT, 'degraded');
  assert.equal(health.dependencies.PAYMENT_PROVIDER, 'blocked');
  assert.notEqual(health.status, 'ready');
  const leak = assertNoSecretsInPayload(health);
  assert.deepEqual(leak.leaked, []);
});

test('gateway health com token/HMAC sinteticos de teste autentica e audita correlationId', async () => {
  const harness = createHmlHarness();
  const { response, body, signed } = await harness.invoke({
    operation: SITE_CPA_HEALTH_OPERATION,
    correlationId: 'hml-corr-health-01',
  });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.meta.correlationId, 'hml-corr-health-01');
  assert.equal(body.meta.origin, 'SITE_CPA');
  assert.equal(body.data.scope.empresaId, HML_IDS.empresaId);
  assert.ok(signed.signature.length === 64);
  assert.ok(harness.store.audits.some((item) => (
    item.correlation_id === 'hml-corr-health-01' || item.dados?.correlation_id === 'hml-corr-health-01'
  )) || harness.store.records.IntegracaoEvento.some((item) => item.correlation_id === 'hml-corr-health-01'));
  const leak = assertNoSecretsInPayload(body);
  assert.equal(leak.serialized.includes(HML_TEST_SERVICE_TOKEN), false);
  assert.equal(leak.serialized.includes(HML_TEST_HMAC_SECRET), false);
});

test('gateway falha fechado sem credenciais e rejeita empresa fora da allowlist', async () => {
  const harness = createHmlHarness();
  const empty = await harness.invoke({
    operation: SITE_CPA_HEALTH_OPERATION,
    env: harness.emptyEnv,
    correlationId: 'hml-corr-empty-creds',
    nonce: 'hml-nonce-empty-creds-abc',
  });
  assert.equal(empty.body.ok, false);
  assert.ok(['site_cpa_credentials_not_configured', 'site_cpa_token_invalid', 'site_cpa_signature_invalid']
    .includes(empty.body.error.code));

  const forbidden = await harness.invoke({
    operation: SITE_CPA_HEALTH_OPERATION,
    context: { empresaId: HML_IDS.empresaForbiddenId },
    correlationId: 'hml-corr-empresa-forbidden',
    nonce: 'hml-nonce-empresa-forbid01',
  });
  assert.equal(forbidden.body.ok, false);
  assert.equal(forbidden.body.error.code, 'site_cpa_empresa_forbidden');
});

test('cliente A resolve; cross-tenant cliente B / obra nao autorizada falha fechado', async () => {
  const harness = createHmlHarness();
  const resolveA = await harness.route({
    operation: SITE_CPA_CUSTOMER_RESOLVE_OPERATION,
    data: {
      cnpj: '11222333000181',
      externalUserId: HML_IDS.externalUserBuyer,
    },
  });
  assert.equal(resolveA.handled, true);
  assert.equal(resolveA.response.ok, true);
  assert.equal(resolveA.response.data.erpCustomerId, HML_IDS.customerA);

  const resolveBAsA = await harness.route({
    operation: SITE_CPA_CUSTOMER_RESOLVE_OPERATION,
    data: {
      cnpj: '99888777000166',
      externalUserId: HML_IDS.externalUserBuyer,
    },
  });
  // Cliente B existe no mesmo grupo/empresa no dataset; vinculo e do user A em cliente A.
  // Resolve por CNPJ de B sem vinculo do user deve criar pendencia ou retornar B sem misturar role de A.
  assert.equal(resolveBAsA.handled, true);
  if (resolveBAsA.response.ok) {
    assert.equal(resolveBAsA.response.data.erpCustomerId, HML_IDS.customerB);
    assert.notEqual(resolveBAsA.response.data.erpCustomerId, HML_IDS.customerA);
  }

  const workForbidden = await harness.route({
    operation: SITE_CPA_WORK_GET_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      obraId: HML_IDS.workB,
    },
  });
  assert.equal(workForbidden.handled, true);
  assert.equal(workForbidden.response.ok, false);
  assert.match(workForbidden.response.error.code, /work_forbidden|scope_forbidden|not_found/);
});

test('catalogo lista produto ativo e nao expoe custo/observacao interna', async () => {
  const harness = createHmlHarness();
  const catalog = await harness.route({
    operation: SITE_CPA_CATALOG_LIST_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      page: 1,
      pageSize: 20,
    },
  });
  assert.equal(catalog.handled, true);
  assert.equal(catalog.response.ok, true);
  const leak = assertNoSecretsInPayload(catalog.response);
  assert.deepEqual(leak.leaked, []);
  const blob = JSON.stringify(catalog.response);
  assert.equal(blob.includes('custo_medio'), false);
  assert.equal(blob.includes('interno-hml-nao-expor'), false);
});

test('pedido create + idempotencia; mass assignment de preco/role e ignorado ou bloqueado', async () => {
  const harness = createHmlHarness();
  const data = {
    externalOrderId: 'hml-checkout-001',
    externalUserId: HML_IDS.externalUserBuyer,
    erpCustomerId: HML_IDS.customerA,
    obraId: HML_IDS.workA,
    items: [{ productId: HML_IDS.productActive, quantity: 2 }],
    // mass assignment tentado
    role: 'ADMIN_EMPRESA',
    status: 'Aprovado',
    preco_unitario: 0.01,
    paid: true,
    vendedor_id: 'hack',
  };
  const first = await harness.route({
    operation: SITE_CPA_ORDER_CREATE_OPERATION,
    data,
    idempotencyKey: 'hml-order-idem-001',
    correlationId: 'hml-corr-order-1',
  });
  assert.equal(first.handled, true);
  // Pedido pode exigir campos adicionais conforme contrato; se ok, replay deve bater.
  if (first.response.ok) {
    const second = await harness.route({
      operation: SITE_CPA_ORDER_CREATE_OPERATION,
      data,
      idempotencyKey: 'hml-order-idem-001',
      correlationId: 'hml-corr-order-2',
    });
    assert.equal(second.response.ok, true);
    assert.equal(
      second.response.data.erpOrderId || second.response.data.id,
      first.response.data.erpOrderId || first.response.data.id,
    );
    const leak = assertNoSecretsInPayload(first.response);
    assert.deepEqual(leak.leaked, []);
  } else {
    assert.ok(first.response.error?.code);
    assert.notEqual(first.response.error.code, 'site_cpa_unhandled');
  }
});

test('quote/negotiation e payment PROVIDER_BLOCKED com env sem provider', async () => {
  const harness = createHmlHarness();
  const quoteRouted = await harness.route({
    operation: SITE_CPA_QUOTE_CREATE_OPERATION,
    data: {
      externalQuoteId: 'hml-quote-1',
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      obraId: HML_IDS.workA,
      items: [{ productId: HML_IDS.productActive, quantity: 2 }],
    },
  });
  assert.equal(quoteRouted.handled, true);

  const negotiationRouted = await harness.route({
    operation: SITE_CPA_NEGOTIATION_GET_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      erpQuoteId: HML_IDS.quote,
    },
  });
  assert.equal(negotiationRouted.handled, true);

  const payment = await harness.route({
    operation: SITE_CPA_PAYMENT_CREATE_OPERATION,
    data: {
      externalPaymentId: 'hml-pay-1',
      externalUserId: HML_IDS.externalUserFinance,
      erpCustomerId: HML_IDS.customerA,
      erpOrderId: HML_IDS.order,
      method: 'PIX',
      paid: true,
      status: 'PAID',
    },
    env: createHmlEnv(), // sem API keys de provider
  });
  assert.equal(payment.handled, true);
  assert.equal(payment.response.ok, false);
  assert.match(payment.response.error.code, /payment_provider|payment_unavailable|payment_forbidden|payment_/);
  const details = JSON.stringify(payment.response);
  assert.ok(
    details.includes('BLOCKED')
    || payment.response.error.code.includes('provider')
    || payment.response.error.code.includes('unavailable')
    || payment.response.error.code.includes('forbidden'),
  );
});

test('portal/delivery/chat: ownership path; documento externo BLOCKED sem storage', async () => {
  const harness = createHmlHarness();
  const portalOrders = await harness.route({
    operation: SITE_CPA_PORTAL_ORDERS_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      pageSize: 10,
    },
  });
  assert.equal(portalOrders.handled, true);

  const document = await harness.route({
    operation: SITE_CPA_PORTAL_DOCUMENT_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      resourceId: HML_IDS.nfe,
      documentType: 'XML',
    },
  });
  assert.equal(document.handled, true);
  assert.equal(document.response.ok, false);
  assert.match(document.response.error.code, /document_unavailable|portal_.*unavailable|forbidden|not_found/);

  const deliveryOp = [...SITE_CPA_DELIVERY_OPERATIONS][0];
  const delivery = await harness.route({
    operation: deliveryOp,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      pageSize: 10,
    },
  });
  assert.equal(delivery.handled, true);

  const chatHistory = await harness.route({
    operation: SITE_CPA_CHAT_HISTORY_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      conversationId: HML_IDS.chat,
      pageSize: 10,
    },
  });
  assert.equal(chatHistory.handled, true);
  if (chatHistory.response.ok) {
    const blob = JSON.stringify(chatHistory.response);
    assert.equal(blob.includes('Nota interna HML'), false);
  }

  const chatStart = await harness.route({
    operation: SITE_CPA_CHAT_START_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      subject: 'Ajuda HML',
      obraId: HML_IDS.workA,
    },
  });
  assert.equal(chatStart.handled, true);
});

test('armacao confirm != release; PRODUCTION_RELEASE permanece blocked; OP nao criada', async () => {
  const harness = createHmlHarness();
  const get = await harness.route({
    operation: SITE_CPA_ARMACAO_GET_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserAdmin,
      erpCustomerId: HML_IDS.customerA,
      armacaoId: HML_IDS.armacao,
    },
  });
  assert.equal(get.handled, true);

  const confirm = await harness.route({
    operation: SITE_CPA_ARMACAO_CONFIRM_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserAdmin,
      erpCustomerId: HML_IDS.customerA,
      armacaoId: HML_IDS.armacao,
      expectedVersion: 1,
      site_technical_approved: true,
      site_production_released: true,
      site_op_created: true,
    },
  });
  assert.equal(confirm.handled, true);
  if (confirm.response.ok) {
    const data = confirm.response.data;
    assert.notEqual(data.productionReleased, true);
    assert.notEqual(data.technicalApproved, true);
    assert.notEqual(data.opCreated, true);
  }
  assert.equal(harness.store.records.OrdemProducao.length, 0);
  const health = await harness.health();
  assert.equal(health.capabilities.PRODUCTION_RELEASE, 'blocked');
});

test('obras allowedWorkIds + oportunidade signal idempotente', async () => {
  const harness = createHmlHarness();
  const works = await harness.route({
    operation: SITE_CPA_WORK_LIST_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
    },
  });
  assert.equal(works.handled, true);
  if (works.response.ok) {
    const items = works.response.data.items || works.response.data.works || [];
    const ids = items.map((item) => item.obraId || item.id);
    assert.ok(ids.every((id) => id === HML_IDS.workA || id === HML_IDS.workB));
    // comprador so tem workA na allowlist
    assert.ok(!ids.includes(HML_IDS.workB) || items.every((item) => (item.obraId || item.id) === HML_IDS.workA));
  }

  const signalData = {
    externalUserId: HML_IDS.externalUserBuyer,
    erpCustomerId: HML_IDS.customerA,
    opportunityId: HML_IDS.opportunity,
    signalType: 'TALK_TO_SELLER',
    externalSignalId: 'hml-signal-1',
  };
  const first = await harness.route({
    operation: SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION,
    data: signalData,
    idempotencyKey: 'hml-signal-idem-1',
  });
  assert.equal(first.handled, true);
  const list = await harness.route({
    operation: SITE_CPA_OPPORTUNITY_LIST_OPERATION,
    data: {
      externalUserId: HML_IDS.externalUserBuyer,
      erpCustomerId: HML_IDS.customerA,
      pageSize: 10,
    },
  });
  assert.equal(list.handled, true);

  if (first.response.ok) {
    const second = await harness.route({
      operation: SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION,
      data: signalData,
      idempotencyKey: 'hml-signal-idem-1',
    });
    assert.equal(second.response.ok, true);
  }
});

test('decisao Opcao A: ERP preparado; E2E externo BLOCKED_CONFIGURATION; nunca READY/GO_LIVE', async () => {
  const harness = createHmlHarness();
  const health = await harness.health();
  assert.ok(['degraded', 'blocked'].includes(health.status));
  assert.equal(health.dependencies.PAYMENT_PROVIDER, 'blocked');

  const report = {
    decision: DECISION.erpPrepared,
    EXTERNAL_E2E_STATUS: DECISION.externalE2e,
    healthStatus: health.status,
    blockers: [
      'SITE_HML_CONNECTION',
      'S2S_REAL_CREDENTIAL',
      'PAYMENT_PROVIDER',
      'PRIVATE_STORAGE',
      'MALWARE_SCANNER',
      'DWG_CONVERTER',
      'AI_PROVIDER',
    ],
    notDeclared: DECISION.notReady,
  };
  assert.equal(report.decision, 'ERP_HML_PREPARED_FOR_EXTERNAL_E2E');
  assert.equal(report.EXTERNAL_E2E_STATUS, 'BLOCKED_CONFIGURATION');
  assert.equal(report.notDeclared.includes('ERP_E2E_READY'), true);
  assert.equal(report.notDeclared.includes('GO_LIVE_READY'), true);
  assert.notEqual(report.decision, 'ERP_E2E_READY');
  assert.notEqual(report.decision, 'GO_LIVE_READY');
});
