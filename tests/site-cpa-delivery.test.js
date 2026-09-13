import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_DELIVERY_GET_OPERATION,
  SITE_CPA_DELIVERY_LIST_OPERATION,
  SITE_CPA_DELIVERY_PROOFS_OPERATION,
  SITE_CPA_DELIVERY_TIMELINE_OPERATION,
  SiteCpaDeliveryError,
  deliveryCapability,
  resolveSiteCpaDeliveryOperation,
} from '../base44/functions/_lib/security/siteCpaDelivery/entry.ts';
import {
  mapDeliveryStatus,
  normalizeDeliveryInput,
} from '../base44/functions/_lib/security/siteCpaDelivery/contract.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const now = Date.parse('2026-09-13T18:00:00.000Z');
const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo', ...overrides,
});
const link = (role = 'ADMIN_EMPRESA', allowedWorkIds = []) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role, allowedWorkIds },
});
const order = (overrides = {}) => ({
  id: 'order-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  numero_pedido: 'PED-100', pode_ver_no_portal: true, obra_id: 'obra-1',
  itens_revenda: [{ produto_id: 'prod-1', nome_produto: 'Vergalhao', quantidade: 10,
    unidade: 'UN', custo: 12, margem: 20 }], ...overrides,
});
const delivery = (overrides = {}) => ({
  id: 'delivery-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  pedido_id: 'order-1', numero_pedido: 'PED-100', status: 'Em Transito', obra_id: 'obra-1',
  data_previsao: '2026-09-20', motorista: 'Carlos', motorista_telefone: '11999999999',
  placa: 'ABC1D23', rota_id: 'route-secret', coordenadas: { latitude: -1, longitude: -2 },
  endereco_entrega_completo: { logradouro: 'Avenida Principal', numero: '123', bairro: 'Centro',
    cidade: 'Sao Paulo', estado: 'SP', cep: '00000000', latitude: -1, longitude: -2 },
  historico_status: [
    { status: 'Aguardando Separacao', data_hora: '2026-09-10T10:00:00Z', observacao: 'nota interna' },
    { status: 'Em Separacao', data_hora: '2026-09-11T10:00:00Z', localizacao: { latitude: -1 } },
    { status: 'Em Transito', data_hora: '2026-09-12T10:00:00Z', usuario: 'motorista@interno' },
  ],
  observacoes: 'nao expor', custo_frete: 50, margem: 20, ...overrides,
});

const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);
const createState = ({
  role = 'ADMIN_EMPRESA', allowedWorkIds = [], customers = [customer()], orders = [order()],
  deliveries = [delivery()], signer = true, failEntity = null,
} = {}) => {
  const audits = [];
  const signed = [];
  const events = [];
  const records = {
    Cliente: customers,
    SolicitacaoAprovacao: [link(role, allowedWorkIds)],
    Pedido: orders,
    Entrega: deliveries,
    IntegracaoEvento: events,
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }],
    NotaFiscal: [],
    ContaReceber: [],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, filter));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, patch) => {
      const found = rows.find((record) => record.id === id);
      if (!found) throw new Error(`${name} missing`);
      Object.assign(found, patch);
      return found;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  const Core = signer ? { CreateFileSignedUrl: async ({ file_uri, expires_in }) => {
    signed.push({ file_uri, expires_in });
    return { signed_url: `https://signed.example/proof?expires=${expires_in}` };
  } } : {};
  return { base44: { asServiceRole: { entities, integrations: { Core } } }, audits, signed };
};

const input = (overrides = {}) => ({
  externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides,
});
const call = (state, operation, data = {}) => resolveSiteCpaDeliveryOperation({
  base44: state.base44,
  payload: { data: input(data) },
  scope,
  request: { operation, correlationId: `corr-${operation}` },
  now,
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaDeliveryError && error.code === code && error.status === status
));

test('entrada limita paginacao e datas e rejeita caminhos ou coordenadas do Site', () => {
  assert.equal(normalizeDeliveryInput({ data: input({ page: 2, pageSize: 100 }) }).page, 2);
  assert.throws(() => normalizeDeliveryInput({ data: input({ pageSize: 101 }) }), /page_invalid/);
  assert.throws(() => normalizeDeliveryInput({ data: input({ dateFrom: '2025-01-01', dateTo: '2026-09-13' }) }), /date_range/);
  assert.throws(() => normalizeDeliveryInput({ data: input({ path: '../proof' }) }), /input_forbidden/);
  assert.throws(() => normalizeDeliveryInput({ data: input({ latitude: -1 }) }), /input_forbidden/);
});

test('status externos cobrem separacao, rota, parcial, entrega e retirada', () => {
  assert.equal(mapDeliveryStatus({ status: 'Em Separacao' }), 'SEPARATING');
  assert.equal(mapDeliveryStatus({ status: 'Roteirizada' }), 'ROUTED');
  assert.equal(mapDeliveryStatus({ status: 'Entrega Parcial' }), 'PARTIAL');
  assert.equal(mapDeliveryStatus({ status: 'Entregue' }), 'DELIVERED');
  assert.equal(mapDeliveryStatus({ status: 'Pronto para Expedir', tipo_frete: 'Retirada' }), 'PICKUP_READY');
  assert.equal(mapDeliveryStatus({ status: 'Entregue', tipo_frete: 'Retirada' }), 'PICKED_UP');
});

test('retirada nao publica endereco, rota, motorista ou veiculo', async () => {
  const state = createState({ deliveries: [delivery({ tipo_frete: 'Retirada', status: 'Pronto para Expedir' })] });
  const result = await call(state, SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' });
  assert.equal(result.delivery.deliveryMode, 'PICKUP');
  assert.equal(result.delivery.status, 'PICKUP_READY');
  assert.equal(result.delivery.addressSummary, null);
  assert.equal(result.delivery.route, null);
  assert.equal(result.delivery.driverName, null);
  assert.equal(result.delivery.vehicleLabel, null);
});

test('lista e pagina multiplas entregas do mesmo Pedido sem assumir relacao um para um', async () => {
  const state = createState({ deliveries: [
    delivery(),
    delivery({ id: 'delivery-2', status: 'Programada', data_previsao: '2026-09-25' }),
  ] });
  const first = await call(state, SITE_CPA_DELIVERY_LIST_OPERATION, { page: 1, pageSize: 1 });
  const second = await call(state, SITE_CPA_DELIVERY_LIST_OPERATION, { page: 2, pageSize: 1 });
  assert.equal(first.items.length, 1);
  assert.equal(first.hasMore, true);
  assert.equal(second.items[0].deliveryId, 'delivery-2');
  assert.equal(first.items[0].route.assigned, true);
  assert.equal(JSON.stringify(first).includes('route-secret'), false);
});

test('filtros seguros aplicam status, periodo, obra e numero do Pedido', async () => {
  const state = createState({ deliveries: [
    delivery(),
    delivery({ id: 'delivery-2', status: 'Entregue', data_previsao: '2026-08-01' }),
  ] });
  const result = await call(state, SITE_CPA_DELIVERY_LIST_OPERATION, {
    status: 'OUT_FOR_DELIVERY', dateFrom: '2026-09-01', dateTo: '2026-09-30',
    obraId: 'obra-1', orderNumber: 'PED-100',
  });
  assert.deepEqual(result.items.map((item) => item.deliveryId), ['delivery-1']);
});

test('detalhe calcula item entregue somente quando os dados oficiais permitem', async () => {
  const state = createState({ deliveries: [delivery({
    status: 'Entrega Parcial',
    itens_entrega: [{ produto_id: 'prod-1', nome_produto: 'Vergalhao', quantidade_pedida: 10,
      quantidade_planejada: 8, quantidade_entregue: 3, unidade: 'UN', custo: 12 }],
    entrega_parcial: { ativada: true, quantidade_entregue: 3 },
    ocorrencias: [{ id: 'occ-1', tipo: 'Avaria', data_hora: '2026-09-12T12:00:00Z',
      descricao: 'nota interna', descricao_publica: 'Mercadoria em conferencia' }],
  })] });
  const result = await call(state, SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' });
  const item = result.delivery.items[0];
  assert.equal(result.delivery.partial, true);
  assert.equal(item.quantityDelivered, 3);
  assert.equal(item.quantityRemaining, 5);
  assert.equal(result.delivery.occurrences[0].publicNote, 'Mercadoria em conferencia');
  assert.equal(result.delivery.addressSummary.streetMasked.endsWith('***'), true);
});

test('detalhe minimiza resposta e nunca retorna custo, margem, telefone, GPS ou notas internas', async () => {
  const result = await call(createState(), SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' });
  const serialized = JSON.stringify(result);
  for (const forbidden of ['11999999999', 'nota interna', 'route-secret', 'custo_frete', 'margem', 'latitude', 'longitude', '00000000']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(result.delivery.items[0].quantityDelivered, null);
});

test('timeline retorna somente eventos persistidos em ordem e omite observacao, usuario e localizacao', async () => {
  const state = createState({ deliveries: [delivery({
    ocorrencias: [{ tipo: 'Cliente Ausente', data_hora: '2026-09-12T12:00:00Z', descricao: 'interno' }],
  })] });
  const result = await call(state, SITE_CPA_DELIVERY_TIMELINE_OPERATION, { deliveryId: 'delivery-1' });
  assert.deepEqual(result.events.map((event) => event.type), [
    'ORDER_CONFIRMED', 'SEPARATION_STARTED', 'VEHICLE_LEFT', 'OCCURRENCE_RECORDED',
  ]);
  const serialized = JSON.stringify(result.events);
  assert.equal(serialized.includes('nota interna'), false);
  assert.equal(serialized.includes('motorista@interno'), false);
  assert.equal(serialized.includes('latitude'), false);
});

test('comprovantes privados recebem URL assinada curta e documento mascarado', async () => {
  const state = createState({ deliveries: [delivery({ comprovante_entrega: {
    nome_recebedor: 'Maria', documento_recebedor: '12345678901',
    foto_file_uri: 'private/delivery/proof-1.jpg', data_hora_recebimento: '2026-09-12T13:00:00Z',
  } })] });
  const result = await call(state, SITE_CPA_DELIVERY_PROOFS_OPERATION, { deliveryId: 'delivery-1' });
  assert.equal(result.proofs[0].type, 'DELIVERY_PHOTO');
  assert.equal(result.proofs[0].expiresIn, 300);
  assert.equal(result.proofs[0].metadata.receiverDocumentMasked, '***.***.***-01');
  assert.deepEqual(state.signed, [{ file_uri: 'private/delivery/proof-1.jpg', expires_in: 300 }]);
  assert.equal(JSON.stringify(result).includes('private/delivery'), false);
  assert.equal(JSON.stringify(result).includes('12345678901'), false);
});

test('URL publica, base64, traversal e storage indisponivel nao viram comprovante', async () => {
  for (const value of ['https://public.example/proof.jpg', 'data:image/png;base64,abc', '../secret.jpg']) {
    await rejects(call(createState({ deliveries: [delivery({ comprovante_entrega: { foto_comprovante: value } })] }),
      SITE_CPA_DELIVERY_PROOFS_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_proof_not_found', 404);
  }
  await rejects(call(createState({ signer: false, deliveries: [delivery({ comprovante_entrega: {
    foto_file_uri: 'private/delivery/proof.jpg',
  } })] }), SITE_CPA_DELIVERY_PROOFS_OPERATION, { deliveryId: 'delivery-1' }),
  'site_cpa_delivery_document_unavailable', 503);
});

test('ownership bloqueia Cliente, Pedido, Grupo, Empresa e identificador adulterados', async () => {
  await rejects(call(createState({ deliveries: [delivery({ cliente_id: 'customer-2' })] }),
    SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_scope_forbidden', 403);
  await rejects(call(createState({ orders: [order({ cliente_id: 'customer-2' })] }),
    SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_scope_forbidden', 403);
  await rejects(call(createState({ deliveries: [delivery({ group_id: 'other-group' })] }),
    SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_not_found', 404);
  await rejects(call(createState({ deliveries: [delivery({ empresa_id: '3z' })] }),
    SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_not_found', 404);
  await rejects(call(createState(), SITE_CPA_DELIVERY_GET_OPERATION,
    { deliveryId: 'delivery-1', erpOrderId: 'order-tampered' }), 'site_cpa_delivery_scope_forbidden', 403);
});

test('restricao de obra vale para filtro e recurso carregado', async () => {
  const state = createState({ allowedWorkIds: ['obra-2'] });
  await rejects(call(state, SITE_CPA_DELIVERY_LIST_OPERATION, { obraId: 'obra-1' }),
    'site_cpa_delivery_work_forbidden', 403);
  await rejects(call(state, SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }),
    'site_cpa_delivery_scope_forbidden', 403);
});

test('matriz RBAC permite administracao, compras e consulta, mas nao concede logistica ao financeiro', async () => {
  for (const role of ['ADMIN_EMPRESA', 'COMPRADOR', 'CONSULTA']) {
    const result = await call(createState({ role }), SITE_CPA_DELIVERY_LIST_OPERATION);
    assert.equal(result.items.length, 1);
  }
  await rejects(call(createState({ role: 'FINANCEIRO' }), SITE_CPA_DELIVERY_LIST_OPERATION),
    'site_cpa_delivery_forbidden', 403);
});

test('entrega sem vinculo confiavel com Pedido e dependencias indisponiveis falham fechadas', async () => {
  await rejects(call(createState({ deliveries: [delivery({ pedido_id: null })] }),
    SITE_CPA_DELIVERY_GET_OPERATION, { deliveryId: 'delivery-1' }), 'site_cpa_delivery_order_link_unavailable', 503);
  await rejects(call(createState({ failEntity: 'Entrega' }), SITE_CPA_DELIVERY_LIST_OPERATION),
    'site_cpa_delivery_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_DELIVERY_LIST_OPERATION),
    'site_cpa_audit_unavailable', 503);
});

test('capability reflete logistica completa, comprovante degradado e vinculo bloqueado', async () => {
  assert.equal(await deliveryCapability({ base44: createState().base44, scope }), 'ready');
  assert.equal(await deliveryCapability({ base44: createState({ signer: false }).base44, scope }), 'degraded');
  assert.equal(await deliveryCapability({ base44: createState({ failEntity: 'Pedido' }).base44, scope }), 'blocked');
});

test('siteEntregaList atravessa autenticacao, replay ledger e gateway v1', async () => {
  const state = createState();
  const payload = { version: '1', operation: SITE_CPA_DELIVERY_LIST_OPERATION, data: input({ pageSize: 10 }) };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(now).toISOString();
  const nonce = 'nonce-delivery-1234567890';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({
      authorization: 'Bearer service-token', 'content-type': 'application/json', 'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-delivery-list', 'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce, 'x-site-cpa-signature': signature, 'idempotency-key': 'idem-delivery-list',
    }) },
    base44: state.base44, payload, rawBody,
    env: (name) => ({ SITE_CPA_SERVICE_TOKEN: 'service-token', SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa', SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco' })[name] || '',
    now,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.items[0].deliveryId, 'delivery-1');
  assert.equal(state.audits.some((audit) => audit.descricao === 'siteEntregaList allowed'), true);
});
