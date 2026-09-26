import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const creatorId = '55555555-5555-4555-8555-555555555555';
const approverId = '77777777-7777-4777-8777-777777777777';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const itemComDesconto = {
  produto_id: produtoId,
  unidade_id: unidadeId,
  descricao: 'Produto sintetico',
  unidade_sigla: 'UN',
  quantidade: '2',
  preco_unitario: '10',
  desconto: '1',
};

const itemSubBp = {
  ...itemComDesconto,
  quantidade: '1',
  preco_unitario: '1000',
  desconto: '0.01',
};

const itemSemDesconto = {
  ...itemComDesconto,
  desconto: '0',
};

const payloadComDesconto = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  observacoes: 'Alcada HTTP',
  itens: [itemComDesconto],
};

function fixture(price = '10.000000') {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: creatorId,
    groupId,
    permissions: {
      Comercial: {
        orcamento: ['visualizar', 'criar', 'editar'],
        pedido: ['visualizar', 'criar', 'editar', 'converter-pedido'],
      },
    },
  });
  rbac.link({
    actorId: approverId,
    groupId,
    permissions: {
      Comercial: {
        orcamento: ['visualizar', 'criar', 'editar', 'aprovar'],
        pedido: ['visualizar', 'criar', 'editar', 'aprovar', 'converter-pedido'],
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
  const stubRefs = (service: any) => {
    service.clientes = { getEmpresaLinkById: async () => ({ id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) };
    service.produtos = { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) };
    service.unidades = { getById: async () => ({ id: unidadeId, ativo: true }) };
    service.condicoes = { get: async () => ({ id: condicaoId, ativo: true }) };
    service.prices = { resolveSalePrice: async () => ({ preco: price }) };
  };
  stubRefs(runtime.orcamentoService);
  stubRefs(runtime.pedidoService);
  return runtime;
}

function headers(actorId: string) {
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

function assertDeniedAlcada(res: { status: number; body: any }) {
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'DESCONTO_ALCADA_DENIED');
  assert.match(res.body.error.message, /alçada livre exige permissão de aprovar/i);
  assert.ok(res.body.error.requestId);
}

test('HTTP Orçamento create: sem aprovar → 403 e nenhuma persistência', async () => {
  const { app } = fixture();
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(payloadComDesconto),
  });
  assertDeniedAlcada(denied);

  const listed = await request(app, '/api/v1/orcamentos?limit=10&offset=0', {
    headers: headers(approverId),
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.total, 0);
  assert.equal(listed.body.data.length, 0);

  const allowed = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify(payloadComDesconto),
  });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.body.data.total, '19.000000');
});

test('HTTP Orçamento create: desconto < 1 bp sem aprovar → 403 (regressão truncamento)', async () => {
  const { app } = fixture('1000.000000');
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({
      ...payloadComDesconto,
      itens: [itemSubBp],
    }),
  });
  assertDeniedAlcada(denied);
  const listed = await request(app, '/api/v1/orcamentos?limit=10&offset=0', {
    headers: headers(approverId),
  });
  assert.equal(listed.body.meta.total, 0);
});

test('HTTP Orçamento update: sem aprovar → 403 e documento inalterado', async () => {
  const { app } = fixture();
  const created = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify({ ...payloadComDesconto, itens: [itemSemDesconto] }),
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id as string;
  assert.equal(created.body.data.total, '20.000000');

  const denied = await request(app, `/api/v1/orcamentos/${id}`, {
    method: 'PATCH',
    headers: headers(creatorId),
    body: JSON.stringify(payloadComDesconto),
  });
  assertDeniedAlcada(denied);

  const fetched = await request(app, `/api/v1/orcamentos/${id}`, {
    headers: headers(approverId),
  });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.total, '20.000000');
  assert.equal(fetched.body.data.itens[0].desconto, '0.000000');
});

test('HTTP Pedido create: sem aprovar → 403 e nenhuma persistência', async () => {
  const { app } = fixture();
  const pedidoPayload = {
    cliente_empresa_id: clienteId,
    condicao_pagamento_id: condicaoId,
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    itens: [itemComDesconto],
  };
  const denied = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(pedidoPayload),
  });
  assertDeniedAlcada(denied);

  const listed = await request(app, '/api/v1/pedidos?limit=10&offset=0', {
    headers: headers(approverId),
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.total, 0);

  const allowed = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify(pedidoPayload),
  });
  assert.equal(allowed.status, 201);
});

test('HTTP Pedido convert: orçamento com desconto sem aprovar → 403 e sem pedido', async () => {
  const { app } = fixture();
  const quote = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify(payloadComDesconto),
  });
  assert.equal(quote.status, 201);
  const orcId = quote.body.data.id as string;

  const denied = await request(app, `/api/v1/orcamentos/${orcId}/converter-pedido`, {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify({
      tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
  });
  assertDeniedAlcada(denied);

  const pedidos = await request(app, '/api/v1/pedidos?limit=10&offset=0', {
    headers: headers(approverId),
  });
  assert.equal(pedidos.body.meta.total, 0);

  const allowed = await request(app, `/api/v1/orcamentos/${orcId}/converter-pedido`, {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify({
      tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    }),
  });
  assert.equal(allowed.status, 201);
});
