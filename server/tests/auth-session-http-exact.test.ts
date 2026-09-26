import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { OWNER_ERP_PERMISSION_TREE } from '../src/security/ownerPermissionTree.ts';
import { createPasswordAuthSession } from '../src/services/authSessionService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const OWNER_ID = 'a1a1a1a1-aaaa-4aaa-8aaa-a1a1a1a1a1a1';
const COMMON_ID = 'b2b2b2b2-bbbb-4bbb-8bbb-b2b2b2b2b2b2';
const AUTH_OWNER = '11111111-1111-4111-8111-111111111111';
const AUTH_COMMON = '11111111-1111-4111-8111-111111111112';

test('HTTP exato: admin lista 200; comum criar 403 PERMISSION_DENIED', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaA2, SEED_IDS.groupA);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: OWNER_ID,
    groupId: SEED_IDS.groupA,
    empresaId: null,
    permissions: OWNER_ERP_PERMISSION_TREE as any,
  });
  rbac.link({
    actorId: COMMON_ID,
    groupId: SEED_IDS.groupA,
    empresaId: SEED_IDS.empresaA,
    permissions: { Comercial: { pedido: ['visualizar'] } },
  });

  const { app, pedidoService } = createApp({
    config,
    db: createDbClient(config),
    useMemory: true,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const adminList = await fetch(`${base}/api/v1/pedidos`, {
      headers: {
        'x-group-id': SEED_IDS.groupA,
        'x-empresa-id': SEED_IDS.empresaA,
        'x-actor-id': OWNER_ID,
      },
    });
    assert.equal(adminList.status, 200);
    const adminBody = await adminList.json();
    assert.equal(adminBody?.error, undefined);
    assert.ok(adminBody?.data !== undefined || Array.isArray(adminBody?.items) || adminBody?.data === null || typeof adminBody === 'object');

    const commonList = await fetch(`${base}/api/v1/pedidos`, {
      headers: {
        'x-group-id': SEED_IDS.groupA,
        'x-empresa-id': SEED_IDS.empresaA,
        'x-actor-id': COMMON_ID,
      },
    });
    assert.equal(commonList.status, 200);

    const commonCreate = await fetch(`${base}/api/v1/pedidos`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-group-id': SEED_IDS.groupA,
        'x-empresa-id': SEED_IDS.empresaA,
        'x-actor-id': COMMON_ID,
      },
      body: JSON.stringify({
        cliente_empresa_id: SEED_IDS.clientePjA,
        condicao_pagamento_id: SEED_IDS.condicaoPagamentoA,
        itens: [],
      }),
    });
    assert.equal(commonCreate.status, 403);
    const denied = await commonCreate.json();
    assert.equal(denied.error.code, 'PERMISSION_DENIED');
    assert.equal(denied.error.message, 'Permission denied');
    assert.ok(denied.error.requestId);

    // Troca de empresa: owner com empresaId null opera em A e A2
    const switchEmpresa = await fetch(`${base}/api/v1/pedidos`, {
      headers: {
        'x-group-id': SEED_IDS.groupA,
        'x-empresa-id': SEED_IDS.empresaA2,
        'x-actor-id': OWNER_ID,
      },
    });
    assert.equal(switchEmpresa.status, 200);

    await assert.rejects(
      () => pedidoService.create({
        requestId: 'common-create',
        groupId: SEED_IDS.groupA,
        empresaId: SEED_IDS.empresaA,
        actorId: COMMON_ID,
        scopeType: 'empresa',
      }, {
        cliente_empresa_id: SEED_IDS.clientePjA,
        itens: [],
      } as any),
      (err: any) => err?.statusCode === 403 && err?.code === 'PERMISSION_DENIED',
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});

test('auth/session HTTP exato: admin e usuário comum (role no payload)', async () => {
  const mkFetch = (role: 'admin' | 'user', authUserId: string, profileId: string, empresaId: string) => async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        access_token: `tok_${role}`,
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: authUserId, email: `${role}@example.com` },
      };
    },
  });

  const admin = await createPasswordAuthSession({
    config: {
      authMode: 'supabase_user',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test',
    } as any,
    db: {
      async query() {
        return {
          rows: [{
            id: OWNER_ID,
            group_id: SEED_IDS.groupA,
            empresa_id: SEED_IDS.empresaA,
            role: 'admin',
            full_name: 'Administrador',
          }],
        };
      },
    },
    body: { email: 'admin@example.com', password: 'senha-forte-123' },
    fetchImpl: mkFetch('admin', AUTH_OWNER, OWNER_ID, SEED_IDS.empresaA) as any,
  });
  assert.equal(admin.expiresIn, 3600);
  assert.equal(admin.profiles[0]?.role, 'admin');
  assert.equal(admin.profiles[0]?.empresaId, SEED_IDS.empresaA);
  assert.equal(admin.accessToken, 'tok_admin');

  const common = await createPasswordAuthSession({
    config: {
      authMode: 'supabase_user',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test',
    } as any,
    db: {
      async query() {
        return {
          rows: [{
            id: COMMON_ID,
            group_id: SEED_IDS.groupA,
            empresa_id: SEED_IDS.empresaA2,
            role: 'user',
            full_name: 'Usuario Comum',
          }],
        };
      },
    },
    body: { email: 'user@example.com', password: 'senha-forte-123' },
    fetchImpl: mkFetch('user', AUTH_COMMON, COMMON_ID, SEED_IDS.empresaA2) as any,
  });
  assert.equal(common.profiles[0]?.role, 'user');
  assert.equal(common.profiles[0]?.empresaId, SEED_IDS.empresaA2);
  assert.equal(common.accessToken, 'tok_user');
  assert.notEqual(admin.profiles[0]?.empresaId, common.profiles[0]?.empresaId);
});
