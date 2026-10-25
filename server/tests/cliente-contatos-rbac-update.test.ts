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
 * Este teste prova o gate de sessão/RBAC do PATCH canônico (editar) e rejeição
 * de payload com contatos no HTTP — esconder botão não basta.
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
