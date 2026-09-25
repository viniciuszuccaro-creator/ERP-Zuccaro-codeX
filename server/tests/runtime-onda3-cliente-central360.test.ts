import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_FULL = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_CLIENTE_ONLY = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ACTOR_GROUP_B = 'cccccccc-3333-4333-8333-cccccccccccc';
const CONDICAO_ID = '55555555-5555-4555-8555-555555555555';
const PRODUTO_ID = '66666666-6666-4666-8666-666666666666';
const UNIDADE_ID = '77777777-7777-4777-8777-777777777777';
const CNPJ_A = '11.222.333/0001-81';
const CNPJ_B = '34.028.316/0001-03';

function config() {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    REQUIRE_DATABASE: 'false',
  });
}

function fixture(permissions: {
  full?: Record<string, unknown>;
  clienteOnly?: Record<string, unknown>;
  groupB?: Record<string, unknown>;
} = {}) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA_A, GROUP_A);
  tenant.link(EMPRESA_B, GROUP_B);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: ACTOR_FULL,
    groupId: GROUP_A,
    permissions: permissions.full ?? {
      Cadastros: {
        cliente: ['visualizar', 'criar', 'editar'],
        cliente_empresa: ['visualizar', 'criar', 'editar'],
        cliente_local: ['visualizar', 'criar', 'editar', 'principal'],
        obra: ['visualizar', 'criar', 'editar', 'principal', 'vincular-local', 'vincular-empresa'],
      },
      Comercial: {
        orcamento: ['visualizar', 'criar'],
        pedido: ['visualizar', 'criar'],
      },
    },
  });
  rbac.link({
    actorId: ACTOR_CLIENTE_ONLY,
    groupId: GROUP_A,
    permissions: permissions.clienteOnly ?? {
      Cadastros: { cliente: ['visualizar'] },
    },
  });
  rbac.link({
    actorId: ACTOR_GROUP_B,
    groupId: GROUP_B,
    permissions: permissions.groupB ?? {
      Cadastros: {
        cliente: ['visualizar', 'criar'],
        cliente_empresa: ['visualizar', 'criar'],
        cliente_local: ['visualizar', 'criar', 'principal'],
        obra: ['visualizar', 'criar', 'principal', 'vincular-local', 'vincular-empresa'],
      },
      Comercial: {
        orcamento: ['visualizar', 'criar'],
        pedido: ['visualizar', 'criar'],
      },
    },
  });
  const runtime = createApp({
    config: config(),
    db: createDbClient(config()),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
  const refs = runtime.orcamentoService as unknown as {
    clientes: { getEmpresaLinkById: (scope: unknown, id: string) => Promise<unknown> };
    produtos: { getById: () => Promise<unknown> };
    unidades: { getById: () => Promise<unknown> };
    condicoes: { get: () => Promise<unknown> };
  };
  const pedidoRefs = runtime.pedidoService as unknown as Record<string, unknown>;
  const resolveCliente = async (_scope: unknown, id: string) => ({
    id,
    ativo: true,
    bloqueado: false,
    habilitado_operacao: true,
  });
  const produtos = { getById: async () => ({ id: PRODUTO_ID, ativo: true, unidade_medida_id: UNIDADE_ID }) };
  const unidades = { getById: async () => ({ id: UNIDADE_ID, ativo: true }) };
  const condicoes = { get: async () => ({ id: CONDICAO_ID, ativo: true }) };
  const clientes = { getEmpresaLinkById: resolveCliente };
  Object.assign(refs, { clientes, produtos, unidades, condicoes });
  Object.assign(pedidoRefs, {
    clientes,
    produtos,
    unidades,
    condicoes,
    locais: { get: async () => null },
    obras: { get: async () => null },
    tabelas: { get: async () => null },
  });
  return runtime;
}

function headers(actorId: string, groupId: string, empresaId: string) {
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
    return { status: response.status, body: await response.json() as any, cache: response.headers.get('cache-control') };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function seedClienteComercial(runtime: ReturnType<typeof fixture>, actorId: string, groupId: string, empresaId: string, documento: string) {
  const cliente = await request(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento,
      razao_social: `Cliente sintetico ${documento}`,
    }),
  });
  assert.equal(cliente.status, 201);
  const clienteId = cliente.body.data.id as string;

  const link = await request(runtime.app, `/api/v1/clientes/${clienteId}/empresas/${empresaId}`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({}),
  });
  assert.ok(link.status === 201 || link.status === 200);
  const clienteEmpresaId = link.body.data.id as string;

  const orcamentoPayload = {
    cliente_empresa_id: clienteEmpresaId,
    condicao_pagamento_id: CONDICAO_ID,
    validade_em: '2027-01-01T00:00:00.000Z',
    observacoes: 'Central 360 sintetico',
    itens: [{
      produto_id: PRODUTO_ID,
      unidade_id: UNIDADE_ID,
      descricao: 'Item sintetico',
      unidade_sigla: 'UN',
      quantidade: '2',
      preco_unitario: '10',
      desconto: '0',
    }],
  };
  const orcamento = await request(runtime.app, '/api/v1/orcamentos', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify(orcamentoPayload),
  });
  assert.equal(orcamento.status, 201);

  const pedido = await request(runtime.app, '/api/v1/pedidos', {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      cliente_empresa_id: clienteEmpresaId,
      condicao_pagamento_id: CONDICAO_ID,
      tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-01-15T00:00:00.000Z',
      observacoes: 'Central 360 sintetico',
      itens: [{ ...orcamentoPayload.itens[0], requer_producao: false }],
    }),
  });
  assert.equal(pedido.status, 201, JSON.stringify(pedido.body));

  const local = await request(runtime.app, `/api/v1/clientes/${clienteId}/locais`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      nome: 'Local Central 360',
      cep: '01310100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      uf: 'SP',
      pais: 'Brasil',
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
  });
  assert.equal(local.status, 201, JSON.stringify(local.body));
  const localId = local.body.data.id as string;

  const obra = await request(runtime.app, `/api/v1/clientes/${clienteId}/obras`, {
    method: 'POST',
    headers: headers(actorId, groupId, empresaId),
    body: JSON.stringify({
      nome: 'Obra Central 360',
      locais: [{ cliente_local_id: localId, uso_na_obra: 'FISICO', principal: true }],
    }),
  });
  assert.equal(obra.status, 201, JSON.stringify(obra.body));

  return {
    clienteId,
    clienteEmpresaId,
    orcamentoId: orcamento.body.data.id as string,
    pedidoId: pedido.body.data.id as string,
    localId,
    obraId: obra.body.data.id as string,
  };
}

test('Central 360 compoe identidade + blocos comerciais canonicos com documento mascarado', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  const result = await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360?orcamentos_limit=10&pedidos_limit=10`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );

  assert.equal(result.status, 200);
  assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.identity.id, seeded.clienteId);
  assert.equal(result.body.data.identity.documento, '**.***.***/****-81');
  assert.equal(result.body.data.empresaLink.id, seeded.clienteEmpresaId);
  assert.equal(result.body.data.blocks.empresas.status, 'ok');
  assert.equal(result.body.data.blocks.locais.status, 'ok');
  assert.equal(result.body.data.blocks.obras.status, 'ok');
  assert.equal(result.body.data.blocks.orcamentos.status, 'ok');
  assert.equal(result.body.data.blocks.pedidos.status, 'ok');
  assert.equal(result.body.data.blocks.crm.status, 'skipped');
  assert.equal(result.body.data.blocks.crm.code, 'CRM_CANONICAL_HTTP_PENDING');
  assert.equal(result.body.data.blocks.orcamentos.data[0].id, seeded.orcamentoId);
  assert.equal(result.body.data.blocks.pedidos.data[0].id, seeded.pedidoId);
  assert.equal(result.body.data.blocks.locais.data[0].id, seeded.localId);
  assert.equal(result.body.data.blocks.obras.data[0].id, seeded.obraId);
  assert.equal(result.body.data.blocks.orcamentos.data[0].quantidade_itens, 1);
  assert.ok(!JSON.stringify(result.body.data.blocks.locais.data[0]).includes('logradouro'));
  assert.ok(!JSON.stringify(result.body).includes('endereco_fingerprint'));
  assert.equal(result.body.data.meta.clienteEmpresaId, seeded.clienteEmpresaId);
  assert.equal(result.body.data.meta.groupId, GROUP_A);
  assert.equal(result.body.data.meta.empresaId, EMPRESA_A);
  assert.ok(!JSON.stringify(result.body).includes('Item sintetico'));
});

test('Central 360 aplica RBAC parcial por bloco e isola tenant A/B', async () => {
  const runtime = fixture();
  const seededA = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);
  const seededB = await seedClienteComercial(runtime, ACTOR_GROUP_B, GROUP_B, EMPRESA_B, CNPJ_B);

  const partial = await request(
    runtime.app,
    `/api/v1/clientes/${seededA.clienteId}/central-360`,
    { headers: headers(ACTOR_CLIENTE_ONLY, GROUP_A, EMPRESA_A) },
  );
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.identity.id, seededA.clienteId);
  assert.equal(partial.body.data.blocks.empresas.status, 'forbidden');
  assert.equal(partial.body.data.blocks.locais.status, 'forbidden');
  assert.equal(partial.body.data.blocks.obras.status, 'forbidden');
  assert.equal(partial.body.data.blocks.orcamentos.status, 'forbidden');
  assert.equal(partial.body.data.blocks.pedidos.status, 'forbidden');
  assert.equal(partial.body.data.blocks.crm.status, 'skipped');
  assert.equal(partial.body.data.empresaLink, null);
  assert.deepEqual(partial.body.data.blocks.orcamentos.data, []);
  assert.deepEqual(partial.body.data.blocks.pedidos.data, []);
  assert.deepEqual(partial.body.data.blocks.locais.data, []);
  assert.deepEqual(partial.body.data.blocks.obras.data, []);

  const cross = await request(
    runtime.app,
    `/api/v1/clientes/${seededA.clienteId}/central-360`,
    { headers: headers(ACTOR_GROUP_B, GROUP_B, EMPRESA_B) },
  );
  assert.equal(cross.status, 404);
  assert.equal(cross.body.error.code, 'CLIENTE_NOT_FOUND');

  const ownB = await request(
    runtime.app,
    `/api/v1/clientes/${seededB.clienteId}/central-360`,
    { headers: headers(ACTOR_GROUP_B, GROUP_B, EMPRESA_B) },
  );
  assert.equal(ownB.status, 200);
  assert.equal(ownB.body.data.identity.id, seededB.clienteId);
  assert.equal(ownB.body.data.blocks.orcamentos.data[0].id, seededB.orcamentoId);
});

test('Central 360 exige escopo tenant e nao mistura orcamentos de outro ClienteEmpresa', async () => {
  const runtime = fixture();
  const seeded = await seedClienteComercial(runtime, ACTOR_FULL, GROUP_A, EMPRESA_A, CNPJ_A);

  assert.equal((await request(
    runtime.app,
    `/api/v1/clientes/${seeded.clienteId}/central-360`,
    { headers: { 'x-actor-id': ACTOR_FULL } },
  )).status, 400);

  const second = await request(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_B,
      razao_social: 'Outro cliente sintetico',
    }),
  });
  assert.equal(second.status, 201);
  const secondId = second.body.data.id as string;
  const secondLink = await request(runtime.app, `/api/v1/clientes/${secondId}/empresas/${EMPRESA_A}`, {
    method: 'POST',
    headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A),
    body: JSON.stringify({}),
  });
  assert.ok(secondLink.status === 201 || secondLink.status === 200);

  const view = await request(
    runtime.app,
    `/api/v1/clientes/${secondId}/central-360`,
    { headers: headers(ACTOR_FULL, GROUP_A, EMPRESA_A) },
  );
  assert.equal(view.status, 200);
  assert.equal(view.body.data.blocks.orcamentos.meta.total, 0);
  assert.equal(view.body.data.blocks.pedidos.meta.total, 0);
  assert.equal(view.body.data.empresaLink.id, secondLink.body.data.id);
});
