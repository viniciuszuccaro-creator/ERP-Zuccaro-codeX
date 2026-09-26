import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const actorId = '55555555-5555-4555-8555-555555555555';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const item = {
  produto_id: produtoId,
  unidade_id: unidadeId,
  descricao: 'Produto sintetico origem',
  unidade_sigla: 'UN',
  quantidade: '1',
  preco_unitario: '10',
  desconto: '0',
};

const basePayload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'RETIRADA',
  data_entrega_solicitada: '2027-03-01T00:00:00.000Z',
  itens: [item],
};

function fixture() {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId,
    groupId,
    permissions: {
      Comercial: {
        pedido: ['visualizar', 'criar', 'editar', 'converter-pedido'],
        orcamento: ['visualizar', 'criar', 'editar'],
      },
    },
  });
  const runtime = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
  const stub = (service: any) => {
    service.clientes = { getEmpresaLinkById: async () => ({ id: clienteId, cliente_id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) };
    service.produtos = { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId, tipo_item: 'Revenda' }) };
    service.unidades = { getById: async () => ({ id: unidadeId, ativo: true }) };
    service.condicoes = { get: async () => ({ id: condicaoId, ativo: true }) };
    service.prices = { resolveSalePrice: async () => ({ preco: '10.000000' }) };
  };
  stub(runtime.pedidoService);
  stub(runtime.orcamentoService);
  Object.assign(runtime.pedidoService as any, {
    locais: { get: async () => null },
    obras: { get: async () => null },
    tabelas: { get: async () => null },
  });
  return runtime;
}

function headers() {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresaId,
    'x-actor-id': actorId,
  };
}

async function request(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return { status: response.status, body: await response.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('HTTP Pedido create default origem MANUAL', async () => {
  const { app } = fixture();
  const created = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(basePayload),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.origem, 'MANUAL');
  assert.equal(created.body.data.idempotency_key, null);
});

test('HTTP Pedido idempotency conflict → 409 exact + sem segunda persistência', async () => {
  const { app } = fixture();
  const payload = {
    ...basePayload,
    origem: 'SITE',
    canal: 'site-cpa',
    idempotency_key: 'http-idem-1',
    external_id: 'EXT-HTTP-1',
  };
  const first = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.origem, 'SITE');

  const denied = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 409);
  assert.equal(denied.body.error.code, 'PEDIDO_IDEMPOTENCY_CONFLICT');
  assert.ok(denied.body.error.requestId);

  const listed = await request(app, '/api/v1/pedidos?origem=SITE&limit=10&offset=0', {
    headers: headers(),
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.total, 1);
});

test('HTTP conversão força origem ORCAMENTO', async () => {
  const { app } = fixture();
  const quote = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      cliente_empresa_id: clienteId,
      condicao_pagamento_id: condicaoId,
      validade_em: '2027-02-01T00:00:00.000Z',
      itens: [item],
    }),
  });
  assert.equal(quote.status, 201);
  const converted = await request(app, `/api/v1/orcamentos/${quote.body.data.id}/converter-pedido`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
  });
  assert.equal(converted.status, 201);
  assert.equal(converted.body.data.origem, 'ORCAMENTO');
  assert.equal(converted.body.data.orcamento_id, quote.body.data.id);
});
