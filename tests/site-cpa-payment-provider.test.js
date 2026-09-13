import assert from 'node:assert/strict';
import test from 'node:test';

import { SiteCpaPaymentError } from '../base44/functions/_lib/security/siteCpaPayment/contract.ts';
import {
  cancelProviderPayment,
  createProviderPayment,
  mapProviderStatus,
  paymentCapability,
  resolvePaymentProviderConfig,
} from '../base44/functions/_lib/security/siteCpaPayment/provider.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const gateway = (overrides = {}) => ({
  id: 'gateway-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', ativo: true,
  provedor: 'Asaas', tipos_pagamento_suportados: ['PIX', 'Boleto'], prioridade: 1,
  chave_api_secreta: 'persisted-secret-must-be-ignored',
  webhook_secret: 'persisted-webhook-must-be-ignored',
  ...overrides,
});
const base44For = (records = [gateway()]) => ({
  asServiceRole: { entities: {
    ConfiguracaoGatewayPagamento: { filter: async () => records },
    GatewayPagamento: { filter: async () => [] },
  } },
});
const envFor = (values = {}) => (name) => ({
  SITE_CPA_PAYMENT_API_KEY_CPA_ACO: 'env-api-key',
  SITE_CPA_PAYMENT_WEBHOOK_SECRET_CPA_ACO: 'env-webhook-secret',
  SITE_CPA_PAYMENT_CUSTOMER_ID_CPA_ACO: 'provider-customer-1',
  ...values,
})[name] || '';
const attempt = (overrides = {}) => ({
  paymentAttemptId: 'PAY-123', erpOrderId: 'order-1', method: 'PIX', amount: 100, ...overrides,
});
const receivable = { id: 'receivable-1', data_vencimento: '2026-09-20' };
const customer = { id: 'customer-1', razao_social: 'Cliente CPA', cnpj: '11222333000181' };

test('configuracao usa cadastro existente, mas segredos exclusivamente do ambiente', async () => {
  const config = await resolvePaymentProviderConfig({ base44: base44For(), scope, env: envFor(), customerId: customer.id });
  assert.equal(config.provider, 'ASAAS');
  assert.deepEqual(config.methods, ['PIX', 'BOLETO']);
  assert.equal(config.apiKey, 'env-api-key');
  assert.equal(config.webhookSecret, 'env-webhook-secret');
  assert.notEqual(config.apiKey, 'persisted-secret-must-be-ignored');
  assert.equal(await paymentCapability({ base44: base44For(), scope, env: envFor() }), 'ready');
  assert.equal(await paymentCapability({ base44: base44For(), scope, env: () => '' }), 'blocked');
  assert.equal(await paymentCapability({
    base44: base44For(), scope,
    env: envFor({ SITE_CPA_PAYMENT_CUSTOMER_ID_CPA_ACO: '' }),
  }), 'blocked');
});

test('Asaas cria PIX real com valor oficial, referencia e idempotencia', async () => {
  const config = await resolvePaymentProviderConfig({ base44: base44For(), scope, env: envFor(), customerId: customer.id });
  let captured;
  const result = await createProviderPayment({
    config, attempt: attempt(), receivable, customer,
    fetchApi: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        id: 'asaas-1', status: 'PENDING', invoiceUrl: 'https://asaas.example/invoice/1',
        pixQrCodeText: 'pix-payload', dueDate: '2026-09-20',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(captured.url, 'https://api.asaas.com/api/v3/payments');
  assert.equal(captured.init.headers['Idempotency-Key'], 'PAY-123');
  assert.equal(captured.body.value, 100);
  assert.equal(captured.body.externalReference, 'PAY-123');
  assert.equal(captured.body.billingType, 'PIX');
  assert.equal(result.status, 'PENDING');
  assert.equal(result.providerPublicData.qrCodeText, 'pix-payload');
  assert.equal(JSON.stringify(result).includes('env-api-key'), false);
});

test('Juno reutiliza boleto real e nao oferece PIX, cartao ou simulacao', async () => {
  const records = [gateway({ provedor: 'Juno', tipos_pagamento_suportados: ['Boleto', 'PIX'] })];
  const config = await resolvePaymentProviderConfig({ base44: base44For(records), scope, env: envFor(), customerId: customer.id });
  assert.deepEqual(config.methods, ['BOLETO']);
  let captured;
  const result = await createProviderPayment({
    config, attempt: attempt({ method: 'BOLETO' }), receivable, customer,
    fetchApi: async (url, init) => {
      captured = { url, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ data: [{
        id: 'juno-1', status: 'ACTIVE', link: 'https://juno.example/charge/1',
        billetDetails: { barcodeNumber: '123456' }, dueDate: '2026-09-20',
      }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(captured.url, 'https://api.juno.com.br/charges');
  assert.equal(captured.body.charge.amount, '100.00');
  assert.equal(result.externalProviderId, 'juno-1');
  await assert.rejects(
    createProviderPayment({ config, attempt: attempt({ method: 'PIX' }), receivable, customer, fetchApi: async () => null }),
    (error) => error instanceof SiteCpaPaymentError && error.code === 'site_cpa_payment_method_invalid',
  );
});

test('mapeamento desconhecido falha seguro e cancelamento so usa provider suportado', async () => {
  assert.equal(mapProviderStatus('ASAAS', 'RECEIVED'), 'PAID');
  assert.equal(mapProviderStatus('JUNO', 'CHARGEBACK'), 'CHARGEBACK');
  assert.equal(mapProviderStatus('ASAAS', 'NEW_UNKNOWN_STATUS'), 'UNDER_REVIEW');
  const asaas = await resolvePaymentProviderConfig({ base44: base44For(), scope, env: envFor(), customerId: customer.id });
  const cancelled = await cancelProviderPayment({
    config: asaas,
    externalProviderId: 'asaas-1',
    fetchApi: async (url, init) => {
      assert.equal(url, 'https://api.asaas.com/api/v3/payments/asaas-1');
      assert.equal(init.method, 'DELETE');
      return new Response(JSON.stringify({ status: 'CANCELLED' }), { status: 200 });
    },
  });
  assert.equal(cancelled.status, 'CANCELLED');
  const juno = await resolvePaymentProviderConfig({
    base44: base44For([gateway({ provedor: 'Juno', tipos_pagamento_suportados: ['Boleto'] })]),
    scope, env: envFor(), customerId: customer.id,
  });
  await assert.rejects(
    cancelProviderPayment({ config: juno, externalProviderId: 'juno-1' }),
    (error) => error.code === 'site_cpa_payment_not_cancelable',
  );
});
