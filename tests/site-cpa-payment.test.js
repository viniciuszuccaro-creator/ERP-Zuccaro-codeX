import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SiteCpaPaymentError,
  resolveSiteCpaPaymentOperation,
} from '../base44/functions/_lib/security/siteCpaPayment/entry.ts';
import {
  buildSiteCpaSignatureInput,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';
import { handleSiteCpaPaymentWebhook } from '../base44/functions/_lib/security/siteCpaPaymentWebhook/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const now = Date.parse('2026-09-13T15:00:00.000Z');
const envValues = {
  SITE_CPA_PAYMENT_API_KEY_CPA_ACO: 'provider-key',
  SITE_CPA_PAYMENT_WEBHOOK_SECRET_CPA_ACO: 'webhook-secret',
  SITE_CPA_PAYMENT_CUSTOMER_ID_CPA_ACO: 'provider-customer-1',
};
const env = (name) => envValues[name] || '';

const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente CPA Ltda', cnpj: '11222333000181', ...overrides,
});
const link = (overrides = {}) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'FINANCEIRO' },
  ...overrides,
});
const order = (overrides = {}) => ({
  id: 'order-1', tipo: 'Pedido', origem_pedido: 'SITE_CPA', group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco', cliente_id: 'customer-1', site_external_user_id: 'site-user-1',
  status: 'Aprovado', status_pagamento: 'Pendente', pagamento_confirmado: false, valor_total: 125.5,
  ...overrides,
});
const receivable = (overrides = {}) => ({
  id: 'receivable-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  pedido_id: 'order-1', valor: 125.5, valor_recebido: 25.5, status: 'Pendente',
  data_vencimento: '2026-09-20', detalhes_pagamento: {}, ...overrides,
});
const gateway = (overrides = {}) => ({
  id: 'gateway-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', ativo: true,
  provedor: 'Asaas', tipos_pagamento_suportados: ['PIX', 'Boleto'], prioridade: 1,
  chave_api_secreta: 'must-not-be-used', webhook_secret: 'must-not-be-used',
  ...overrides,
});
const createInput = (overrides = {}) => ({
  externalPaymentId: 'site-payment-1', externalUserId: 'site-user-1',
  erpCustomerId: 'customer-1', erpOrderId: 'order-1', method: 'PIX', ...overrides,
});
const lookupInput = (paymentAttemptId, overrides = {}) => ({
  paymentAttemptId, externalUserId: 'site-user-1', erpCustomerId: 'customer-1',
  erpOrderId: 'order-1', ...overrides,
});

const matches = (actual, expected) => {
  if (expected && typeof expected === 'object' && '$in' in expected) {
    return expected.$in.map(String).includes(String(actual));
  }
  return actual === expected;
};

const createState = ({
  customers = [customer()], links = [link()], orders = [order()], receivables = [receivable()],
  gateways = [gateway()], events = [], failEntity = null,
} = {}) => {
  const audits = [];
  const data = {
    Cliente: customers,
    SolicitacaoAprovacao: links,
    Pedido: orders,
    ContaReceber: receivables,
    ConfiguracaoGatewayPagamento: gateways,
    GatewayPagamento: [],
    IntegracaoEvento: events,
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }],
  };
  const entities = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((row) => Object.entries(filter).every(([key, value]) => matches(row[key], value)));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name.toLowerCase()}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const record = rows.find((item) => item.id === id);
      if (!record) throw new Error(`${name} missing`);
      Object.assign(record, patch, { updated_date: new Date(now).toISOString() });
      return record;
    },
  }]));
  entities.AuditLog = {
    create: async (record) => {
      if (failEntity === 'AuditLog') throw new Error('audit unavailable');
      audits.push(record);
      return record;
    },
  };
  return { base44: { asServiceRole: { entities } }, audits, events, orders, receivables };
};

const fakeProvider = (overrides = {}) => ({
  create: async ({ attempt }) => ({
    externalProviderId: 'asaas-payment-1', status: 'PENDING', expiresAt: '2026-09-20',
    providerPublicData: { paymentId: 'asaas-payment-1', qrCodeText: 'safe-pix-payload' },
    amountSeen: attempt.amount,
  }),
  status: async () => ({ status: 'PENDING', paidAmount: 0, paidAt: null }),
  cancel: async () => ({ status: 'CANCELLED' }),
  ...overrides,
});

const call = (state, operation, data, providerApi = fakeProvider()) => resolveSiteCpaPaymentOperation({
  base44: state.base44,
  payload: { data },
  scope,
  request: { operation, correlationId: `corr-${operation}` },
  env,
  now,
  providerApi,
});

const rejectsCode = async (promise, code, status) => {
  await assert.rejects(promise, (error) => (
    error instanceof SiteCpaPaymentError && error.code === code && error.status === status
  ));
};

test('create usa saldo oficial, persiste tentativa no ledger e nao expoe segredos', async () => {
  const state = createState();
  let amountSeen = 0;
  const result = await call(state, 'sitePagamentoCreate', createInput(), fakeProvider({
    create: async ({ attempt }) => {
      amountSeen = attempt.amount;
      return {
        externalProviderId: 'asaas-payment-1', status: 'PENDING', expiresAt: '2026-09-20',
        providerPublicData: { paymentId: 'asaas-payment-1', qrCodeText: 'safe-pix-payload' },
      };
    },
  }));
  assert.equal(amountSeen, 100);
  assert.equal(result.amount, 100);
  assert.equal(result.status, 'PENDING');
  assert.match(result.paymentAttemptId, /^PAY-/);
  assert.equal(state.receivables[0].id_cobranca_externa, 'asaas-payment-1');
  assert.equal(state.events[0].origem, 'SITE_CPA_PAYMENT');
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['provider-key', 'webhook-secret', 'chave_api', 'custo', 'margem', 'cartao']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('campos de autoridade financeira e return URL externa sao rejeitados', async () => {
  await rejectsCode(call(createState(), 'sitePagamentoCreate', createInput({ amount: 1 })), 'site_cpa_payment_payload_forbidden', 400);
  await rejectsCode(call(createState(), 'sitePagamentoCreate', createInput({ paid: true })), 'site_cpa_payment_payload_forbidden', 400);
  await rejectsCode(call(createState(), 'sitePagamentoCreate', createInput({ returnUrl: 'https://evil.example' })), 'site_cpa_payment_return_url_invalid', 400);
});

test('cliente, Pedido e ContaReceber precisam existir no mesmo escopo e ownership', async () => {
  await rejectsCode(call(createState({ links: [] }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_customer_invalid', 403);
  await rejectsCode(call(createState({ orders: [order({ empresa_id: '3z' })] }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_order_invalid', 404);
  await rejectsCode(call(createState({ orders: [order({ cliente_id: 'customer-2' })] }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_scope_forbidden', 403);
  await rejectsCode(call(createState({ receivables: [] }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_receivable_pending', 422);
});

test('titulo pago e parcelas ambiguas nao geram cobranca avulsa ou duplicada', async () => {
  await rejectsCode(call(createState({
    receivables: [receivable({ status: 'Recebido', valor_recebido: 125.5 })],
  }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_already_paid', 409);
  await rejectsCode(call(createState({
    receivables: [receivable(), receivable({ id: 'receivable-2' })],
  }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_receivable_ambiguous', 409);
});

test('provedor sem credencial de ambiente ou metodo real falha fechado sem simulacao', async () => {
  const state = createState();
  await assert.rejects(resolveSiteCpaPaymentOperation({
    base44: state.base44, payload: { data: createInput() }, scope,
    request: { operation: 'sitePagamentoCreate', correlationId: 'corr-provider' },
    env: () => '', now, providerApi: fakeProvider(),
  }), (error) => error.code === 'site_cpa_payment_provider_unavailable');
  await rejectsCode(call(createState(), 'sitePagamentoCreate', createInput({ method: 'CARD' })), 'site_cpa_payment_method_invalid', 422);
});

test('externalPaymentId e hash tornam create idempotente e detectam conflito', async () => {
  const state = createState();
  let creates = 0;
  const providerApi = fakeProvider({ create: async () => {
    creates += 1;
    return { externalProviderId: 'asaas-payment-1', status: 'PENDING', providerPublicData: { paymentId: 'asaas-payment-1' } };
  } });
  const first = await call(state, 'sitePagamentoCreate', createInput(), providerApi);
  const replay = await call(state, 'sitePagamentoCreate', createInput(), providerApi);
  assert.equal(replay.paymentAttemptId, first.paymentAttemptId);
  assert.equal(creates, 1);
  await rejectsCode(
    call(state, 'sitePagamentoCreate', createInput({ method: 'BOLETO' }), providerApi),
    'site_cpa_payment_idempotency_conflict', 409,
  );
});

test('timeout do provider permanece PROCESSING e nao assume sucesso ou falha', async () => {
  const state = createState();
  const result = await call(state, 'sitePagamentoCreate', createInput(), fakeProvider({
    create: async () => { throw new SiteCpaPaymentError(202, 'site_cpa_payment_provider_processing'); },
  }));
  assert.equal(result.status, 'PROCESSING');
  assert.equal(state.receivables[0].valor_recebido, 25.5);
});

test('status oficial pago baixa ContaReceber uma vez e apenas atualiza financeiro do Pedido', async () => {
  const state = createState();
  const created = await call(state, 'sitePagamentoCreate', createInput());
  const paidProvider = fakeProvider({
    status: async () => ({ status: 'PAID', paidAmount: 100, paidAt: '2026-09-13T14:00:00.000Z' }),
  });
  const paid = await call(state, 'sitePagamentoStatus', lookupInput(created.paymentAttemptId), paidProvider);
  assert.equal(paid.status, 'PAID');
  assert.equal(paid.reconciliationStatus, 'MATCHED');
  assert.equal(state.receivables[0].valor_recebido, 125.5);
  assert.equal(state.receivables[0].status, 'Recebido');
  assert.equal(state.orders[0].status_pagamento, 'Pago');
  assert.equal(state.orders[0].pagamento_confirmado, true);
  assert.equal(state.orders[0].status, 'Aprovado');
  const replay = await call(state, 'sitePagamentoStatus', lookupInput(created.paymentAttemptId), paidProvider);
  assert.equal(replay.status, 'PAID');
  assert.equal(state.receivables[0].valor_recebido, 125.5);
});

test('pagamento parcial preserva saldo e excesso vai para revisao manual sem baixa', async () => {
  const partialState = createState();
  const partialCreated = await call(partialState, 'sitePagamentoCreate', createInput());
  const partial = await call(partialState, 'sitePagamentoStatus', lookupInput(partialCreated.paymentAttemptId), fakeProvider({
    status: async () => ({ status: 'PAID', paidAmount: 40, paidAt: '2026-09-13' }),
  }));
  assert.equal(partial.status, 'PARTIALLY_PAID');
  assert.equal(partial.reconciliationStatus, 'PARTIAL');
  assert.equal(partialState.receivables[0].valor_recebido, 65.5);

  const excessState = createState();
  const excessCreated = await call(excessState, 'sitePagamentoCreate', createInput());
  const excess = await call(excessState, 'sitePagamentoStatus', lookupInput(excessCreated.paymentAttemptId), fakeProvider({
    status: async () => ({ status: 'PAID', paidAmount: 110, paidAt: '2026-09-13' }),
  }));
  assert.equal(excess.status, 'UNDER_REVIEW');
  assert.equal(excess.reconciliationStatus, 'MANUAL_REVIEW');
  assert.equal(excessState.receivables[0].valor_recebido, 25.5);
});

test('cancelamento permitido e idempotente; pagamento liquidado nao e desaprovado', async () => {
  const state = createState();
  const created = await call(state, 'sitePagamentoCreate', createInput());
  const cancelled = await call(state, 'sitePagamentoCancel', lookupInput(created.paymentAttemptId, { reason: '<b>desistiu</b>' }));
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal((await call(state, 'sitePagamentoCancel', lookupInput(created.paymentAttemptId))).status, 'CANCELLED');

  const paidState = createState();
  const paidCreated = await call(paidState, 'sitePagamentoCreate', createInput());
  await call(paidState, 'sitePagamentoStatus', lookupInput(paidCreated.paymentAttemptId), fakeProvider({
    status: async () => ({ status: 'PAID', paidAmount: 100, paidAt: '2026-09-13' }),
  }));
  await rejectsCode(
    call(paidState, 'sitePagamentoCancel', lookupInput(paidCreated.paymentAttemptId)),
    'site_cpa_payment_not_cancelable', 422,
  );
});

test('paymentAttemptId adulterado e Cliente cruzado falham fechados', async () => {
  const state = createState();
  const created = await call(state, 'sitePagamentoCreate', createInput());
  await rejectsCode(call(state, 'sitePagamentoStatus', lookupInput('PAY-UNKNOWN')), 'site_cpa_payment_not_found', 404);
  await rejectsCode(call(state, 'sitePagamentoStatus', lookupInput(created.paymentAttemptId, {
    erpCustomerId: 'customer-2',
  })), 'site_cpa_payment_customer_invalid', 403);
});

const signedWebhook = async ({
  state,
  payload,
  eventId = 'provider-event-1',
  signatureSecret = 'webhook-secret',
  timestampMs = now,
  environment = env,
}) => {
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(timestampMs).toISOString();
  const signature = await hmacSha256Hex(
    signatureSecret,
    buildSiteCpaSignatureInput({ timestamp, nonce: eventId, rawBody }),
  );
  return handleSiteCpaPaymentWebhook({
    req: { headers: new Headers({
      'x-site-cpa-payment-webhook': 'v1',
      'x-erp-empresa-id': 'cpa-aco',
      'x-payment-provider': 'ASAAS',
      'x-payment-event-id': eventId,
      'x-payment-timestamp': timestamp,
      'x-payment-signature': signature,
    }) },
    base44: state.base44,
    payload,
    rawBody,
    env: environment,
    now,
  });
};

test('webhook HMAC liquida uma vez e repeticao responde idempotente', async () => {
  const state = createState();
  const created = await call(state, 'sitePagamentoCreate', createInput());
  const payload = {
    id: 'provider-event-body-1',
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'asaas-payment-1', externalReference: created.paymentAttemptId,
      status: 'RECEIVED', value: 100, paymentDate: '2026-09-13',
    },
  };
  const first = await signedWebhook({ state, payload });
  assert.equal(first.status, 200);
  assert.equal(state.receivables[0].valor_recebido, 125.5);
  const replay = await signedWebhook({ state, payload });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).replayed, true);
  assert.equal(state.receivables[0].valor_recebido, 125.5);
});

test('webhook rejeita assinatura, timestamp e referencia cross-tenant', async () => {
  const invalidState = createState();
  const invalid = await signedWebhook({
    state: invalidState,
    payload: { payment: { id: 'x', externalReference: 'PAY-X', status: 'RECEIVED', value: 100 } },
    signatureSecret: 'wrong-secret',
  });
  assert.equal(invalid.status, 401);
  assert.equal(invalidState.receivables[0].valor_recebido, 25.5);

  const stale = await signedWebhook({
    state: createState(),
    payload: { payment: { id: 'x', externalReference: 'PAY-X', status: 'RECEIVED', value: 100 } },
    eventId: 'provider-event-stale',
    timestampMs: now - 10 * 60 * 1000,
  });
  assert.equal(stale.status, 401);

  const crossState = createState();
  const created = await call(crossState, 'sitePagamentoCreate', createInput());
  const cross = await signedWebhook({
    state: crossState,
    payload: { payment: {
      id: 'other-provider-payment', externalReference: created.paymentAttemptId,
      status: 'RECEIVED', value: 100,
    } },
    eventId: 'provider-event-cross',
  });
  assert.equal(cross.status, 403);
  assert.equal(crossState.receivables[0].valor_recebido, 25.5);
});

test('webhook aplica rate limit por empresa sem bloquear replay concluido', async () => {
  const state = createState({ events: [{
    id: 'recent-event', origem: 'PAYMENT_PROVIDER', operacao: 'sitePagamentoWebhook',
    group_id: 'grupo-cpa', empresa_id: 'cpa-aco', idempotency_key: 'different-event',
    created_date: new Date(now).toISOString(), status: 'concluido', request_hash: 'other',
  }] });
  const response = await signedWebhook({
    state,
    payload: { payment: { id: 'x', externalReference: 'PAY-X', status: 'PENDING', value: 100 } },
    eventId: 'provider-event-rate-limited',
    environment: (name) => (name === 'SITE_CPA_PAYMENT_WEBHOOK_RATE_LIMIT' ? '1' : env(name)),
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, 'site_cpa_payment_rate_limited');
  assert.equal(state.events.length, 1);
});

test('falha de auditoria ou persistencia encerra sem sucesso falso', async () => {
  await rejectsCode(call(createState({ failEntity: 'AuditLog' }), 'sitePagamentoCreate', createInput()), 'site_cpa_audit_unavailable', 503);
  await rejectsCode(call(createState({ failEntity: 'ContaReceber' }), 'sitePagamentoCreate', createInput()), 'site_cpa_payment_unavailable', 503);
});
