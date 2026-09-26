import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import type { ComercialCostPort } from '../src/services/comercialMargemAlcadaPolicy.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const creatorId = '55555555-5555-4555-8555-555555555555';
const approverId = '77777777-7777-4777-8777-777777777777';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const itemBase = {
  produto_id: produtoId,
  unidade_id: unidadeId,
  descricao: 'Produto sintetico margem',
  unidade_sigla: 'UN',
  quantidade: '1',
  preco_unitario: '10',
  desconto: '0',
};

const payloadOrc = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  observacoes: 'Margem HTTP',
  itens: [itemBase],
};

const payloadPed = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  tipo_operacao: 'RETIRADA',
  data_entrega_solicitada: '2027-02-01T00:00:00.000Z',
  itens: [itemBase],
};

function stubCost(custo: string, minimaBps = 0): ComercialCostPort {
  return {
    getUnitCost: async () => ({ custo_unitario: custo, margem_minima_bps: minimaBps }),
  };
}

function fixture(options: { price?: string; costs?: ComercialCostPort | null } = {}) {
  const price = options.price ?? '10.000000';
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
    costPort: options.costs === undefined ? null : options.costs,
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

function assertDeniedMargem(res: { status: number; body: any }) {
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'MARGEM_ALCADA_DENIED');
  assert.match(res.body.error.message, /margem abaixo da mínima exige permissão de aprovar/i);
  assert.ok(res.body.error.requestId);
}

test('HTTP Orçamento: sem CostPort → create ok (não inventa custo)', async () => {
  const { app } = fixture({ costs: null });
  const res = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(res.status, 201);
});

test('HTTP Orçamento create: custo > preço sem aprovar → 403 e sem persistência', async () => {
  const { app, auditRepo } = fixture({ costs: stubCost('15') });
  const denied = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(payloadOrc),
  });
  assertDeniedMargem(denied);

  const listed = await request(app, '/api/v1/orcamentos?limit=10&offset=0', {
    headers: headers(approverId),
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.total, 0);

  const allowed = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.body.data.total, '10.000000');

  const audits = await auditRepo.listByEntity('Orcamento', allowed.body.data.id);
  const approve = audits.filter((a) => a.action === 'approve');
  assert.equal(approve.length, 1);
  const after = approve[0].afterData as {
    margem_alcada_override?: boolean;
    margem_avaliacao?: Array<{ cost: string; abaixo_da_minima: boolean }>;
  };
  assert.equal(after.margem_alcada_override, true);
  assert.ok(Array.isArray(after.margem_avaliacao));
  assert.equal(after.margem_avaliacao![0].cost, '15.000000');
  assert.equal(after.margem_avaliacao![0].abaixo_da_minima, true);
  assert.equal(typeof after.margem_avaliacao![0].cost, 'string');
});

test('HTTP Pedido create: margem abaixo sem aprovar → 403', async () => {
  const { app } = fixture({ costs: stubCost('12') });
  const denied = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(payloadPed),
  });
  assertDeniedMargem(denied);

  const allowed = await request(app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(approverId),
    body: JSON.stringify(payloadPed),
  });
  assert.equal(allowed.status, 201);
});

test('HTTP Orçamento update no mesmo runtime: custo sobe → 403', async () => {
  const costsMutable: { current: ComercialCostPort } = {
    current: stubCost('5'),
  };
  const port: ComercialCostPort = {
    getUnitCost: (input) => costsMutable.current.getUnitCost(input),
  };
  const { app } = fixture({ costs: port });

  const created = await request(app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(creatorId),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  costsMutable.current = stubCost('20');
  const denied = await request(app, `/api/v1/orcamentos/${id}`, {
    method: 'PATCH',
    headers: headers(creatorId),
    body: JSON.stringify(payloadOrc),
  });
  assertDeniedMargem(denied);

  const ok = await request(app, `/api/v1/orcamentos/${id}`, {
    method: 'PATCH',
    headers: headers(approverId),
    body: JSON.stringify(payloadOrc),
  });
  assert.equal(ok.status, 200);
});
