import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherEmpresaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actorId = '55555555-5555-4555-8555-555555555555';
const deniedActorId = '66666666-6666-4666-8666-666666666666';
const clienteId = '11111111-1111-4111-8111-111111111111';
const condicaoId = '22222222-2222-4222-8222-222222222222';
const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const payload = {
  cliente_empresa_id: clienteId,
  condicao_pagamento_id: condicaoId,
  validade_em: '2027-01-01T00:00:00.000Z',
  observacoes: 'Dado sintetico',
  itens: [{
    produto_id: produtoId,
    unidade_id: unidadeId,
    descricao: 'Produto sintetico',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '10',
    desconto: '1',
  }],
};

function fixture() {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(empresaId, groupId);
  tenant.link(otherEmpresaId, groupId);
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId, groupId, permissions: { Comercial: { orcamento: ['visualizar', 'criar', 'editar', 'cancelar'] } } });
  rbac.link({ actorId: deniedActorId, groupId, permissions: { Comercial: { orcamento: [] } } });
  const runtime = createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard: tenant, rbacGuard: rbac });
  const refs = runtime.orcamentoService as unknown as {
    clientes: { getEmpresaLinkById: () => Promise<unknown> };
    produtos: { getById: () => Promise<unknown> };
    unidades: { getById: () => Promise<unknown> };
    condicoes: { get: () => Promise<unknown> };
  };
  refs.clientes = { getEmpresaLinkById: async () => ({ id: clienteId, ativo: true, bloqueado: false, habilitado_operacao: true }) };
  refs.produtos = { getById: async () => ({ id: produtoId, ativo: true, unidade_medida_id: unidadeId }) };
  refs.unidades = { getById: async () => ({ id: unidadeId, ativo: true }) };
  refs.condicoes = { get: async () => ({ id: condicaoId, ativo: true }) };
  return runtime;
}

function headers(overrides: Record<string, string> = {}) {
  return {
    'content-type': 'application/json',
    'x-group-id': groupId,
    'x-empresa-id': empresaId,
    'x-actor-id': actorId,
    ...overrides,
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

test('HTTP Orcamento executa create list get update cancel e auditoria transacional', async () => {
  const runtime = fixture();
  const created = await request(runtime.app, '/api/v1/orcamentos', {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.total, '19.000000');
  const id = created.body.data.id as string;

  const listed = await request(runtime.app, '/api/v1/orcamentos?limit=1&offset=0', { headers: headers() });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.meta, { limit: 1, offset: 0, total: 1, hasMore: false });
  assert.equal(listed.body.data[0].id, id);

  const fetched = await request(runtime.app, `/api/v1/orcamentos/${id}`, { headers: headers() });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.numero, created.body.data.numero);

  const updated = await request(runtime.app, `/api/v1/orcamentos/${id}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ ...payload, itens: [{ ...payload.itens[0], quantidade: '3' }] }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.numero, created.body.data.numero);
  assert.equal(updated.body.data.total, '29.000000');

  const cancelled = await request(runtime.app, `/api/v1/orcamentos/${id}/cancelar`, { method: 'POST', headers: headers() });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'CANCELADO');
  assert.equal(cancelled.body.data.itens.length, 1);

  assert.equal((await request(runtime.app, `/api/v1/orcamentos/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) })).status, 409);
  assert.equal((await request(runtime.app, `/api/v1/orcamentos/${id}/cancelar`, { method: 'POST', headers: headers() })).status, 409);
  const audits = await runtime.auditRepo.listByEntity('Orcamento', id);
  assert.deepEqual(audits.map((entry) => entry.action), ['create', 'update', 'change_status']);
  assert.ok(audits.every((entry) => !JSON.stringify(entry).includes('Produto sintetico')));
});

test('HTTP Orcamento aplica escopo, actor e RBAC fail-closed', async () => {
  const { app } = fixture();
  assert.equal((await request(app, '/api/v1/orcamentos', { headers: { 'x-actor-id': actorId } })).status, 400);
  assert.equal((await request(app, '/api/v1/orcamentos', { headers: headers({ 'x-actor-id': '' }) })).status, 403);
  assert.equal((await request(app, '/api/v1/orcamentos', { headers: headers({ 'x-actor-id': deniedActorId }) })).status, 403);
});

test('HTTP Orcamento nao aceita tenant no body e devolve erros seguros', async () => {
  const runtime = fixture();
  const injected = await request(runtime.app, '/api/v1/orcamentos', {
    method: 'POST', headers: headers(), body: JSON.stringify({ ...payload, groupId, empresaId: otherEmpresaId }),
  });
  assert.equal(injected.status, 422);
  assert.equal((await request(runtime.app, '/api/v1/orcamentos/invalido', { headers: headers() })).status, 400);

  const created = await request(runtime.app, '/api/v1/orcamentos', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const crossTenant = await request(runtime.app, `/api/v1/orcamentos/${created.body.data.id}`, {
    headers: headers({ 'x-empresa-id': otherEmpresaId }),
  });
  assert.equal(crossTenant.status, 404);
  assert.equal(crossTenant.body.error.code, 'ORCAMENTO_NOT_FOUND');
});

test('HTTP Orcamento preserva validacoes comerciais como 422', async () => {
  const runtime = fixture();
  const refs = runtime.orcamentoService as unknown as { produtos: { getById: () => Promise<unknown> } };
  refs.produtos = { getById: async () => null };
  const result = await request(runtime.app, '/api/v1/orcamentos', {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'ORCAMENTO_PRODUTO_INVALIDO');
});

test('meta declara HTTP canonico de Orcamento e Pedido', async () => {
  const { app } = fixture();
  const result = await request(app, '/api/v1/meta');
  assert.equal(result.status, 200);
  assert.ok(result.body.preparedEntities.includes('Orcamento'));
  assert.ok(result.body.httpEntities.includes('Orcamento'));
  assert.ok(result.body.httpPilotEntities.includes('Orcamento'));
  assert.deepEqual(result.body.orcamento, {
    backendHttp: true,
    frontendHttp: true,
    pagination: true,
    tenantIntegrity: true,
    sequentialNumero: true,
    transactionalAudit: true,
    rbacFailClosed: true,
    cancelByState: true,
  });
  assert.match(result.body.note, /Pedido backend HTTP is active/);
  assert.equal(result.body.pedido.backendHttp, true);
  assert.equal(result.body.pedido.frontendHttp, true);
  assert.equal(result.body.runtime, 'ERP-RUNTIME-08B');
});

test('HTTP Orcamento aplica pesquisa e filtros tenant-scoped com validacao segura', async () => {
  const runtime = fixture();
  const first = await request(runtime.app, '/api/v1/orcamentos', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const second = await request(runtime.app, '/api/v1/orcamentos', { method: 'POST', headers: headers(), body: JSON.stringify({ ...payload, validade_em: '2028-06-15T00:00:00.000Z' }) });
  await request(runtime.app, `/api/v1/orcamentos/${second.body.data.id}/cancelar`, { method: 'POST', headers: headers() });
  const filtered = await request(runtime.app, `/api/v1/orcamentos?search=${first.body.data.numero}&status=EM_ABERTO&clienteEmpresaId=${clienteId}&validadeDe=2026-12-01&validadeAte=2027-12-31`, { headers: headers() });
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.body.data.map((row: { id: string }) => row.id), [first.body.data.id]);
  assert.equal(filtered.body.meta.total, 1);
  assert.equal((await request(runtime.app, '/api/v1/orcamentos?status=INVALIDO', { headers: headers() })).status, 422);
  assert.equal((await request(runtime.app, '/api/v1/orcamentos?validadeDe=invalida', { headers: headers() })).status, 422);
  assert.equal((await request(runtime.app, '/api/v1/orcamentos?clienteEmpresaId=invalido', { headers: headers() })).status, 400);
});