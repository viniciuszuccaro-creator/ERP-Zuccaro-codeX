import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SiteCpaOrderError,
  normalizeSiteCpaOrderInput,
  resolveSiteCpaOrderCreate,
} from '../base44/functions/_lib/security/siteCpaOrderCreate/entry.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const request = { correlationId: 'corr-order', operation: 'sitePedidoCreate' };
const now = Date.parse('2026-09-13T12:00:00.000Z');

const product = (overrides = {}) => ({
  id: 'prod-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  codigo: 'ACO-10',
  descricao: 'Vergalhao CA-50 10 mm',
  grupo_produto_id: 'cat-aco',
  status: 'Ativo',
  unidade_medida_id: 'unit-kg',
  unidade_medida: 'KG',
  codigo_especificacao: 'SPEC-10',
  exibir_no_site: true,
  preco_venda: 12.5,
  estoque_atual: 100,
  estoque_reservado: 10,
  quantidade_minima_venda: 2,
  multiplo_venda: 2,
  custo_medio: 7,
  margem_minima_percentual: 10,
  fornecedor_id: 'supplier-1',
  observacoes: 'nao expor',
  updated_date: '2026-09-13T11:00:00.000Z',
  ...overrides,
});

const customer = (overrides = {}) => ({
  id: 'customer-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  status: 'Ativo',
  razao_social: 'Cliente CPA Ltda',
  vendedor_responsavel_id: 'seller-1',
  endereco_principal: {
    id: 'addr-main',
    tipo: 'ENTREGA',
    logradouro: 'Rua A',
    numero: '10',
    cidade: 'Sao Paulo',
    estado: 'SP',
    cep: '01001000',
  },
  locais_entrega: [{
    id: 'work-1',
    tipo: 'OBRA',
    obra: true,
    logradouro: 'Obra B',
    numero: '20',
    cidade: 'Sao Paulo',
    estado: 'SP',
    ativo: true,
  }],
  condicao_comercial: {
    tabela_preco_id: 'table-1',
    forma_pagamento_padrao_id: 'payment-1',
    forma_pagamento_padrao_nome: 'Boleto 30 dias',
    limite_credito: 10000,
    limite_credito_utilizado: 100,
  },
  ...overrides,
});

const approvedLink = (overrides = {}) => ({
  id: 'link-1',
  tipo_solicitacao: 'vinculo_site_cpa_cliente',
  entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  status: 'aprovado',
  dados_propostos: {
    source: 'SITE_CPA',
    externalUserId: 'site-user-1',
    role: 'COMPRADOR',
    allWorks: true,
  },
  ...overrides,
});

const baseInput = (overrides = {}) => ({
  externalOrderId: 'checkout-1001',
  externalUserId: 'site-user-1',
  erpCustomerId: 'customer-1',
  items: [{
    erpProductId: 'prod-1',
    quantity: 2,
    erpSpecCode: 'SPEC-10',
    commercialUnit: 'KG',
    unitPrice: 10,
  }],
  deliveryMode: 'PICKUP',
  requestedDeliveryDate: '2026-09-20',
  purchaseOrderReference: 'OC-CLIENTE-1',
  notes: 'Entregar com cuidado',
  ...overrides,
});

const createState = ({
  products = [product()],
  customers = [customer()],
  links = [approvedLink()],
  tables = [{ id: 'table-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', nome: 'Tabela B2B', ativo: true }],
  priceItems = [{ id: 'price-1', tabela_preco_id: 'table-1', produto_id: 'prod-1', preco: 10, ativo: true }],
  payments = [{ id: 'payment-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', descricao: 'Boleto 30 dias', ativo: true }],
  sellers = [{ id: 'seller-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', nome_completo: 'Vendedor CPA', ativo: true }],
  projects = [{ id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', ativo: true }],
  costCenters = [{ id: 'cost-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', obra_id: 'work-1', projeto_id: 'project-1', ativo: true }],
  orders = [],
  failEntity = null,
} = {}) => {
  const audits = [];
  const data = {
    Produto: products,
    CatalogoWeb: [],
    GrupoProduto: [{ id: 'cat-aco', group_id: 'grupo-cpa', nome_grupo: 'Acos', ativo: true }],
    UnidadeMedida: [{ id: 'unit-kg', group_id: 'grupo-cpa', sigla: 'KG', ativo: true }],
    Cliente: customers,
    SolicitacaoAprovacao: links,
    TabelaPreco: tables,
    TabelaPrecoItem: priceItems,
    FormaPagamento: payments,
    Colaborador: sellers,
    Projeto: projects,
    CentroCusto: costCenters,
    Pedido: orders,
  };
  const matches = (actual, expected) => {
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.map(String).includes(String(actual));
    }
    return actual === expected;
  };
  const entities = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, {
    filter: async (filter) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((row) => Object.entries(filter).every(([key, value]) => matches(row[key], value)));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name.toLowerCase()}-${rows.length + 1}`, created_date: '2026-09-13T12:00:00.000Z', ...record };
      rows.push(created);
      return created;
    },
  }]));
  entities.AuditLog = {
    create: async (record) => {
      if (failEntity === 'AuditLog') throw new Error('audit unavailable');
      audits.push(record);
      return record;
    },
  };
  return { base44: { asServiceRole: { entities } }, audits, orders };
};

const createOrder = (state, input = baseInput()) => resolveSiteCpaOrderCreate({
  base44: state.base44,
  payload: { data: input },
  scope,
  request,
  now,
});

const rejectsCode = async (promise, code, status) => {
  await assert.rejects(promise, (error) => (
    error instanceof SiteCpaOrderError && error.code === code && error.status === status
  ));
};

test('normaliza limites, sanitiza texto e rejeita payload ambiguo', () => {
  const normalized = normalizeSiteCpaOrderInput(baseInput({ notes: '<b>ok</b>\u0000' }), now);
  assert.equal(normalized.notes, 'bok/b');
  assert.throws(() => normalizeSiteCpaOrderInput(baseInput({ items: [] }), now));
  assert.throws(() => normalizeSiteCpaOrderInput(baseInput({ deliveryMode: 'DRONE' }), now));
  assert.throws(() => normalizeSiteCpaOrderInput(baseInput({
    items: [baseInput().items[0], baseInput().items[0]],
  }), now));
});

test('cria Pedido real com totais oficiais, origem, aprovacao e pagamento pendentes', async () => {
  const state = createState();
  const result = await createOrder(state);
  assert.equal(result.erpOrderId, 'pedido-1');
  assert.match(result.orderNumber, /^SITE-CHECKOUT-1001-/);
  assert.equal(result.status, 'Aguardando Aprovação');
  assert.equal(result.totals.products, 20);
  assert.equal(result.totals.total, 20);
  assert.equal(result.items[0].unitPrice, 10);
  assert.equal(result.paymentStatus, 'PENDING');
  assert.equal(state.orders[0].origem_pedido, 'SITE_CPA');
  assert.equal(state.orders[0].status_aprovacao, 'pendente');
  assert.equal(state.orders[0].pagamento_confirmado, false);
  assert.equal(state.orders[0].reserva_estoque_ao_criar, false);
  assert.equal(state.audits.some((item) => item.descricao.includes('order_created')), true);
});

test('ignora totais, desconto, frete, seller e sellable enviados pelo Site', async () => {
  const state = createState();
  const result = await createOrder(state, {
    ...baseInput(),
    total: 1,
    subtotal: 1,
    discount: 99,
    freight: 999,
    sellerId: 'attacker',
    sellable: true,
  });
  assert.equal(result.totals.total, 20);
  assert.equal(result.totals.freight, 0);
  assert.equal(result.seller.sellerId, 'seller-1');
});

test('delivery exige endereco oficial do Cliente e pickup nao exige endereco', async () => {
  const delivery = await createOrder(createState(), baseInput({
    deliveryMode: 'DELIVERY', addressId: 'addr-main',
  }));
  assert.equal(delivery.deliveryMode, 'DELIVERY');
  assert.equal(delivery.nextAction, 'FREIGHT_CONFIRMATION');
  await rejectsCode(
    createOrder(createState(), baseInput({ deliveryMode: 'DELIVERY', addressId: 'other-address' })),
    'site_cpa_order_address_invalid',
    403,
  );
  assert.equal((await createOrder(createState())).deliveryMode, 'PICKUP');
});

test('Cliente exige vinculo aprovado, papel comprador e mesmo escopo', async () => {
  await rejectsCode(createOrder(createState({ links: [] })), 'site_cpa_order_customer_invalid', 403);
  await rejectsCode(createOrder(createState({
    links: [approvedLink({ dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role: 'CONSULTA' } })],
  })), 'site_cpa_order_customer_invalid', 403);
  await rejectsCode(createOrder(createState({
    customers: [customer({ empresa_id: '3z' })],
  })), 'site_cpa_order_customer_invalid', 403);
});

test('produto precisa estar ativo, publicado, no escopo e com spec/unidade oficiais', async () => {
  await rejectsCode(createOrder(createState({ products: [product({ status: 'Inativo' })] })), 'site_cpa_order_item_invalid', 422);
  await rejectsCode(createOrder(createState({ products: [product({ empresa_id: '3z' })] })), 'site_cpa_order_item_invalid', 422);
  await rejectsCode(createOrder(createState(), baseInput({
    items: [{ ...baseInput().items[0], erpSpecCode: 'SPEC-FALSA' }],
  })), 'site_cpa_order_item_invalid', 422);
  await rejectsCode(createOrder(createState(), baseInput({
    items: [{ ...baseInput().items[0], commercialUnit: 'UN' }],
  })), 'site_cpa_order_item_invalid', 422);
});

test('quantidade respeita minimo e multiplo oficiais', async () => {
  await rejectsCode(createOrder(createState(), baseInput({
    items: [{ ...baseInput().items[0], quantity: 1 }],
  })), 'site_cpa_order_item_invalid', 422);
  await rejectsCode(createOrder(createState(), baseInput({
    items: [{ ...baseInput().items[0], quantity: 3 }],
  })), 'site_cpa_order_item_invalid', 422);
});

test('produto sem preco ou venda direta exige orçamento e nao cria Pedido', async () => {
  const state = createState({ priceItems: [] });
  await rejectsCode(createOrder(state), 'site_cpa_order_quote_required', 422);
  assert.equal(state.orders.length, 0);
});

test('mudanca de preco retorna snapshot atual e nao cria Pedido', async () => {
  const state = createState();
  await assert.rejects(createOrder(state, baseInput({
    items: [{ ...baseInput().items[0], unitPrice: 9.5 }],
  })), (error) => {
    assert.equal(error.code, 'site_cpa_order_price_changed');
    assert.equal(error.status, 409);
    assert.equal(error.details.items[0].currentUnitPrice, 10);
    return true;
  });
  assert.equal(state.orders.length, 0);
});

test('estoque alterado bloqueia sem parcial silencioso', async () => {
  const state = createState({ products: [product({ estoque_atual: 11, estoque_reservado: 10 })] });
  await rejectsCode(createOrder(state), 'site_cpa_order_stock_changed', 409);
  assert.equal(state.orders.length, 0);
});

test('produto sob encomenda usa fluxo existente e dependencia de estoque falha fechada', async () => {
  const orderable = await createOrder(createState({
    products: [product({ estoque_atual: 0, estoque_reservado: 0, permite_encomenda: true })],
  }));
  assert.equal(orderable.items[0].status, 'AVAILABLE_TO_ORDER');
  await rejectsCode(
    createOrder(createState({ products: [product({ estoque_atual: null, estoque_disponivel: null })] })),
    'site_cpa_order_stock_unavailable',
    503,
  );
});

test('condicao deve ser oficial e credito insuficiente bloqueia sem expor limite', async () => {
  await rejectsCode(createOrder(createState(), baseInput({ paymentPreference: 'payment-other' })), 'site_cpa_order_payment_condition_invalid', 422);
  const state = createState({
    customers: [customer({
      condicao_comercial: {
        tabela_preco_id: 'table-1',
        forma_pagamento_padrao_id: 'payment-1',
        limite_credito: 10,
        limite_credito_utilizado: 0,
      },
    })],
  });
  await rejectsCode(createOrder(state), 'site_cpa_order_credit_blocked', 422);
  assert.equal(state.orders.length, 0);
});

test('vendedor inativo nao e inventado e pedido segue para atribuicao', async () => {
  const result = await createOrder(createState({ sellers: [] }));
  assert.equal(result.seller.assignmentStatus, 'UNASSIGNED');
  assert.equal(result.nextAction, 'SELLER_ASSIGNMENT');
});

test('obra, Projeto e Centro de Custo validam ownership e escopo', async () => {
  const result = await createOrder(createState(), baseInput({
    obraId: 'work-1', projectId: 'project-1', costCenterId: 'cost-1',
  }));
  assert.equal(result.erpOrderId, 'pedido-1');
  await rejectsCode(createOrder(createState(), baseInput({ obraId: 'other-work' })), 'site_cpa_order_work_invalid', 403);
  await rejectsCode(createOrder(createState({
    projects: [{ id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-2' }],
  }), baseInput({ projectId: 'project-1' })), 'site_cpa_order_scope_forbidden', 403);
});

test('externalOrderId repete mesmo Pedido e conflito de payload retorna 409', async () => {
  const state = createState();
  const first = await createOrder(state);
  const replay = await createOrder(state);
  assert.equal(replay.erpOrderId, first.erpOrderId);
  assert.equal(replay.replayed, true);
  await rejectsCode(createOrder(state, baseInput({ notes: 'payload diferente' })), 'site_cpa_order_idempotency_conflict', 409);
  assert.equal(state.orders.length, 1);
});

test('resposta e persistencia nao incluem custo, margem, banco ou segredo', async () => {
  const state = createState();
  const result = await createOrder(state);
  const serialized = JSON.stringify({ result, order: state.orders[0] }).toLowerCase();
  for (const forbidden of ['custo_medio', 'margem_minima', 'markup', 'fornecedor_id', 'dados_bancarios', 'service-token']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('falha de auditoria ou escrita do Pedido encerra sem sucesso falso', async () => {
  await rejectsCode(createOrder(createState({ failEntity: 'AuditLog' })), 'site_cpa_audit_unavailable', 503);
  await rejectsCode(createOrder(createState({ failEntity: 'Pedido' })), 'site_cpa_order_unavailable', 503);
});

test('sitePedidoCreate atravessa gateway, ledger e retorna 201', async () => {
  const state = createState();
  const events = [];
  Object.assign(state.base44.asServiceRole.entities, {
    Empresa: { filter: async () => [{ id: 'cpa-aco', group_id: 'grupo-cpa' }] },
    IntegracaoEvento: {
      filter: async () => [],
      create: async (record) => {
        const created = { id: 'event-order', created_date: '2026-09-13T12:00:00.000Z', ...record };
        events.push(created);
        return created;
      },
      update: async (id, patch) => {
        const event = events.find((item) => item.id === id);
        Object.assign(event, patch);
        return event;
      },
    },
  });
  const body = { version: '1', operation: 'sitePedidoCreate', data: baseInput() };
  const rawBody = JSON.stringify(body);
  const timestamp = '2026-09-13T12:00:00.000Z';
  const nonce = 'nonce-order-1234567890';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({
      authorization: 'Bearer service-token',
      'content-type': 'application/json',
      'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-order-gateway',
      'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce,
      'x-site-cpa-signature': signature,
      'idempotency-key': 'idem-order-gateway',
    }) },
    base44: state.base44,
    payload: body,
    rawBody,
    env: (name) => ({
      SITE_CPA_SERVICE_TOKEN: 'service-token',
      SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa',
      SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco,3z',
    })[name] || '',
    now,
  });
  const responseBody = await response.json();
  assert.equal(response.status, 201);
  assert.equal(responseBody.data.erpOrderId, 'pedido-1');
  assert.equal(events[0].status, 'concluido');
});

test('Pedido S2S pendente nao reserva estoque antes da aprovacao', async () => {
  const source = await readFile(new URL('../base44/functions/onPedidoCreated/entry.ts', import.meta.url), 'utf8');
  assert.match(source, /reserva_estoque_ao_criar !== false/);
  assert.match(source, /if \(dataEnriched\?\.reserva_estoque_ao_criar !== false\)[\s\S]*assertPermission/);
});
