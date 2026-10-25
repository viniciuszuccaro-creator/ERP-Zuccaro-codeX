import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

/**
 * Contatos/endereços do Cliente na UI local passam por updateInContext + podeEditar.
 * O schema HTTP de Cliente é .strict() e NÃO aceita `contatos`/`locais_entrega`.
 *
 * Camadas cobertas neste arquivo:
 * - serviço: PERMISSION_DENIED no update sem editar
 * - HTTP PATCH /api/v1/clientes/:id: 403 real + sem mutação persistida (GET)
 * - HTTP: payload com `contatos` → VALIDATION_ERROR (não bypassa RBAC)
 *
 * Esconder botão na UI não basta; este arquivo prova bloqueio de mutação.
 */

const GROUP = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR_EDIT = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_VIEW = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

function config() {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    REQUIRE_DATABASE: 'false',
  });
}

function fixture() {
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA, GROUP);
  const rbac = new InMemoryRbacGuard();
  const cadastrosEdit = {
    cliente: ['visualizar', 'criar', 'editar'],
    cliente_empresa: ['visualizar', 'criar', 'editar'],
    cliente_local: ['visualizar', 'criar', 'editar', 'principal'],
  };
  rbac.link({
    actorId: ACTOR_EDIT,
    groupId: GROUP,
    permissions: { Cadastros: cadastrosEdit },
  });
  rbac.link({
    actorId: ACTOR_VIEW,
    groupId: GROUP,
    permissions: {
      Cadastros: {
        cliente: ['visualizar'],
        cliente_empresa: ['visualizar'],
        cliente_local: ['visualizar'],
      },
    },
  });
  return createApp({
    config: config(),
    db: createDbClient(config()),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
}

function ctx(actorId: string, requestId: string) {
  return {
    groupId: GROUP,
    empresaId: EMPRESA,
    actorId,
    actorEmail: `${actorId}@test.dev`,
    requestId,
    ipAddress: '127.0.0.1',
  };
}

function headers(actorId: string) {
  return {
    'content-type': 'application/json',
    'x-group-id': GROUP,
    'x-empresa-id': EMPRESA,
    'x-actor-id': actorId,
  };
}

async function http(
  app: ReturnType<typeof createApp>['app'],
  path: string,
  init: RequestInit = {},
) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return { status: response.status, body: await response.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('serviço: viewer sem editar recebe PERMISSION_DENIED no update (sessão/RBAC)', async () => {
  const runtime = fixture();
  const created = await runtime.clienteService.create(ctx(ACTOR_EDIT, 'c1'), {
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'Cliente Contatos RBAC',
    email: 'contato.rbac@exemplo.dev',
    telefone: '11987654321',
  });
  assert.ok(created?.id);
  await assert.rejects(
    () => runtime.clienteService.update(ctx(ACTOR_VIEW, 'u1'), created.id, { observacoes: 'tentativa sem editar' }),
    (err: any) => err?.statusCode === 403 && err?.code === 'PERMISSION_DENIED',
  );
  const reloaded = await runtime.clienteService.get(ctx(ACTOR_EDIT, 'g1'), created.id);
  assert.notEqual(reloaded?.observacoes, 'tentativa sem editar');
});

test('serviço: payload com contatos é rejeitado pelo schema strict (não bypassa RBAC)', async () => {
  const runtime = fixture();
  const created = await runtime.clienteService.create(ctx(ACTOR_EDIT, 'c2'), {
    tipo: 'Pessoa Jurídica',
    documento: '34.028.316/0001-03',
    razao_social: 'Cliente Contatos Schema',
    email: 'schema.rbac@exemplo.dev',
    telefone: '11987654322',
  });
  assert.ok(created?.id);
  await assert.rejects(
    () => runtime.clienteService.update(ctx(ACTOR_EDIT, 'u2'), created.id, {
      contatos: [{ nome: 'X', tipo: 'Telefone', valor: '11', principal: true }],
    }),
    (err: any) => err?.statusCode === 400 && err?.code === 'VALIDATION_ERROR',
  );
});

test('HTTP PATCH: viewer recebe 403 e não persiste mutação (GET inalterado)', async () => {
  const runtime = fixture();
  const created = await http(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(ACTOR_EDIT),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: '60.746.948/0001-12',
      razao_social: 'Cliente HTTP RBAC',
      email: 'http.rbac@exemplo.dev',
      telefone: '11987654323',
      observacoes: 'original-safe',
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.id;
  assert.ok(id);

  const denied = await http(runtime.app, `/api/v1/clientes/${id}`, {
    method: 'PATCH',
    headers: headers(ACTOR_VIEW),
    body: JSON.stringify({ observacoes: 'mutacao-proibida' }),
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body?.error?.code, 'PERMISSION_DENIED');

  const got = await http(runtime.app, `/api/v1/clientes/${id}`, {
    method: 'GET',
    headers: headers(ACTOR_EDIT),
  });
  assert.equal(got.status, 200);
  assert.equal(got.body.data.observacoes, 'original-safe');
});

test('HTTP PATCH: editor autorizado muta; payload com contatos continua 400', async () => {
  const runtime = fixture();
  const created = await http(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(ACTOR_EDIT),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: '04.252.011/0001-10',
      razao_social: 'Cliente HTTP OK',
      email: 'http.ok@exemplo.dev',
      telefone: '11987654324',
      observacoes: 'antes',
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.id;

  const ok = await http(runtime.app, `/api/v1/clientes/${id}`, {
    method: 'PATCH',
    headers: headers(ACTOR_EDIT),
    body: JSON.stringify({ observacoes: 'depois-autorizado' }),
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.observacoes, 'depois-autorizado');

  const withContatos = await http(runtime.app, `/api/v1/clientes/${id}`, {
    method: 'PATCH',
    headers: headers(ACTOR_EDIT),
    body: JSON.stringify({
      observacoes: 'com-contatos',
      contatos: [{ nome: 'X', tipo: 'Telefone', valor: '11', principal: true }],
    }),
  });
  assert.equal(withContatos.status, 400);
  assert.equal(withContatos.body?.error?.code, 'VALIDATION_ERROR');

  const got = await http(runtime.app, `/api/v1/clientes/${id}`, {
    method: 'GET',
    headers: headers(ACTOR_EDIT),
  });
  assert.equal(got.body.data.observacoes, 'depois-autorizado');
});
