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
const EMPRESA_A2 = '33333333-3333-4333-8333-333333333334';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_A2 = 'dddddddd-4444-4444-8444-dddddddddddd';
const ACTOR_B = 'cccccccc-3333-4333-8333-cccccccccccc';
const ACTOR_NONE = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const CNPJ_A = '11.222.333/0001-81';
const CNPJ_B = '34.028.316/0001-03';
const DOC_A = '11222333000181';

function config() {
  return loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
}

function fixture() {
  const tenant = new InMemoryTenantGuard();
  tenant.link(EMPRESA_A, GROUP_A);
  tenant.link(EMPRESA_A2, GROUP_A);
  tenant.link(EMPRESA_B, GROUP_B);
  const rbac = new InMemoryRbacGuard();
  const cadastros = {
    cliente: ['visualizar', 'criar', 'editar', 'inativar'],
    cliente_empresa: ['visualizar', 'criar', 'editar'],
  };
  rbac.link({ actorId: ACTOR_A, groupId: GROUP_A, permissions: { Cadastros: cadastros } });
  rbac.link({ actorId: ACTOR_A2, groupId: GROUP_A, permissions: { Cadastros: cadastros } });
  rbac.link({ actorId: ACTOR_B, groupId: GROUP_B, permissions: { Cadastros: cadastros } });
  return createApp({
    config: config(),
    db: createDbClient(config()),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
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
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) as Record<string, any> : {},
      cache: response.headers.get('cache-control'),
    };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('sugestao de vinculo no grupo nao mescla, isola empresa/grupo e falha fechada', async () => {
  const runtime = fixture();
  const created = await request(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A,
      razao_social: 'Cliente sintetico vinculo',
      email: 'contato.cliente@exemplo.dev',
      telefone: '11987654321',
    }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const clienteId = created.body.data.id as string;

  const primeira = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${encodeURIComponent(CNPJ_A)}`,
    { headers: headers(ACTOR_A, GROUP_A, EMPRESA_A) },
  );
  assert.equal(primeira.status, 200);
  assert.equal(primeira.cache, 'no-store');
  assert.equal(primeira.body.data.sugestao, true);
  assert.equal(primeira.body.data.mescla, 'revisao_humana_obrigatoria');
  assert.equal(primeira.body.data.cliente_id, clienteId);
  assert.equal(primeira.body.data.group_id, GROUP_A);
  assert.equal(primeira.body.data.documento_mascarado.endsWith('81'), true);
  const cru = JSON.stringify(primeira.body);
  assert.equal(cru.includes(DOC_A), false);
  assert.equal(cru.includes('contato.cliente@exemplo.dev'), false);
  assert.equal(cru.includes('11987654321'), false);

  const segunda = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${DOC_A}`,
    { headers: headers(ACTOR_A2, GROUP_A, EMPRESA_A2) },
  );
  assert.equal(segunda.body.data.cliente_id, clienteId);
  const lista = await request(runtime.app, '/api/v1/clientes', {
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
  });
  assert.equal(lista.body.meta.total, 1);

  const outroGrupo = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${DOC_A}`,
    { headers: headers(ACTOR_B, GROUP_B, EMPRESA_B) },
  );
  assert.equal(outroGrupo.status, 200);
  assert.equal(outroGrupo.body.data.sugestao, false);
  assert.equal(outroGrupo.body.data.motivo, 'sem_match');
  assert.equal(outroGrupo.body.data.cliente_id, undefined);

  const semPermissao = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${DOC_A}`,
    { headers: headers(ACTOR_NONE, GROUP_A, EMPRESA_A) },
  );
  assert.equal(semPermissao.status, 403);

  const duplicata = await request(runtime.app, '/api/v1/clientes', {
    method: 'POST',
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A,
      razao_social: 'Tentativa de mescla',
    }),
  });
  assert.equal(duplicata.status, 409);
  const listaDepois = await request(runtime.app, '/api/v1/clientes', {
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
  });
  assert.equal(listaDepois.body.meta.total, 1);

  const ausente = await request(runtime.app, '/api/v1/clientes/sugestao-vinculo', {
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
  });
  assert.equal(ausente.body.data.motivo, 'documento_ausente');

  const outroDoc = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${encodeURIComponent(CNPJ_B)}`,
    { headers: headers(ACTOR_A, GROUP_A, EMPRESA_A) },
  );
  assert.equal(outroDoc.body.data.sugestao, false);

  const removido = await request(runtime.app, `/api/v1/clientes/${clienteId}`, {
    method: 'DELETE',
    headers: headers(ACTOR_A, GROUP_A, EMPRESA_A),
  });
  assert.equal(removido.status, 200, JSON.stringify(removido.body));
  const aposInativar = await request(
    runtime.app,
    `/api/v1/clientes/sugestao-vinculo?documento=${DOC_A}`,
    { headers: headers(ACTOR_A, GROUP_A, EMPRESA_A) },
  );
  assert.equal(aposInativar.body.data.sugestao, false);
  assert.equal(aposInativar.body.data.motivo, 'sem_match');

  const audits = (await runtime.auditRepo.listByEntity('Cliente', clienteId))
    .filter((entry) => entry.action === 'possible_duplicate');
  assert.equal(audits.length >= 2, true);
  assert.equal(JSON.stringify(audits).includes(DOC_A), false);
  assert.equal(audits.every((entry) => entry.groupId === GROUP_A), true);
});
