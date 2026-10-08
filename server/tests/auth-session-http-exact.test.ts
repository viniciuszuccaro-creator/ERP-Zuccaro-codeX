import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { OWNER_ERP_PERMISSION_TREE } from '../src/security/ownerPermissionTree.ts';
import { createPasswordAuthSession, resolveSessionEntityGuard } from '../src/services/authSessionService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const OWNER_ID = 'a1a1a1a1-aaaa-4aaa-8aaa-a1a1a1a1a1a1';
const COMMON_ID = 'b2b2b2b2-bbbb-4bbb-8bbb-b2b2b2b2b2b2';
const AUTH_OWNER = '11111111-1111-4111-8111-111111111111';
const AUTH_COMMON = '11111111-1111-4111-8111-111111111112';

test('guard HTTP revalida Bearer/perfil; owner em grupo/A/A2, filial isolada e revogação imediata', async () => {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false', ERP_AUTH_MODE: 'supabase_user', SUPABASE_URL: 'https://auth.synthetic.test', SUPABASE_ANON_KEY: 'synthetic' });
  let permissions: any = OWNER_ERP_PERMISSION_TREE;
  let company: string | null = null;
  const db = {
    async query(sql: string, values: any[]) {
      if (sql.includes('FROM profiles')) {
        assert.equal(values[0], AUTH_OWNER);
        return { rows: [{ id: OWNER_ID, group_id: SEED_IDS.groupA, empresa_id: company, empresa_id_raw: company, role: company ? 'user' : 'admin', full_name: 'Synthetic Owner', permissoes: permissions, group_name: 'Synthetic Group' }] };
      }
      if (sql.includes('FROM empresas')) return { rows: [SEED_IDS.empresaA, SEED_IDS.empresaA2].filter(id => !company || id === company).map(id => ({ id, group_id: SEED_IDS.groupA, razao_social: 'Synthetic Company', nome_fantasia: null, cnpj: '12345678000199', status: 'Ativa' })) };
      throw new Error('Unexpected SQL');
    },
  };
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith(config.supabaseUrl!)) return new Response(JSON.stringify({ id: AUTH_OWNER }), { status: init.headers.Authorization === 'Bearer synthetic-valid' ? 200 : 401 });
    return nativeFetch(url, init);
  }) as typeof fetch;
  const { app } = createApp({ config, db: db as any, useMemory: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const guard = { profile_id: OWNER_ID, group_id: SEED_IDS.groupA, empresa_id: null as string | null, module: 'Comercial', section: null, action: 'visualizar' };
  const check = async (overrides: any = {}, bearer: string | null = 'synthetic-valid') => {
    const headers: any = { 'x-actor-id': OWNER_ID, 'x-group-id': SEED_IDS.groupA };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return nativeFetch(`http://127.0.0.1:${address.port}/api/v1/auth/session?guard=${encodeURIComponent(JSON.stringify({ ...guard, ...overrides }))}`, { headers });
  };
  const allows = async (overrides: any, expected: boolean) => {
    const response = await check(overrides); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.deepEqual(body, { data: { allowed: expected } });
  };
  try {
    for (const empresa_id of [null, SEED_IDS.empresaA, SEED_IDS.empresaA2]) {
      for (const module of Object.keys(OWNER_ERP_PERMISSION_TREE)) await allows({ empresa_id, module }, true);
    }
    await allows({ profile_id: COMMON_ID }, false);
    await allows({ group_id: SEED_IDS.groupB }, false);
    await allows({ empresa_id: SEED_IDS.empresaB }, false);
    await allows({ module: 'Modulo inexistente' }, false);
    // Exact metadata contract sent by Layout entity and sensitive-function wrappers.
    await allows({ empresa_id: SEED_IDS.empresaA, section: 'pedido', action: 'criar', entity_name: 'Pedido', operation: 'create' }, true);
    await allows({ module: 'Sistema', section: ['Configurações', 'Gerais'], function_name: 'upsertConfig', action: 'editar' }, true);
    for (const section of ['Fiscal', 'Integrações', 'IA', 'ConflictPolicy', 'Notificações']) await allows({ module: 'Sistema', section: ['Configurações', section] }, true);
    await allows({ module: 'Sistema', section: ['Segurança', 'Monitoramento', 'AcessoRealtime'] }, true);
    await allows({ module: 'Sistema', section: ['Segurança', 'Backup'], action: 'restaurar' }, true);
    await allows({ module: 'Sistema', section: 'Auditoria', action: 'excluir' }, false);
    await allows({ module: 'Modulo inexistente', function_name: 'upsertConfig', entity_name: 'Pedido', operation: 'create' }, false);
    assert.equal((await check({ entity_name: 'x'.repeat(121) })).status, 422);
    assert.equal((await check({}, null)).status, 401);
    assert.equal((await check({}, 'expired')).status, 401);
    assert.equal((await check({ role: 'admin', permissoes: { '*': ['visualizar'] } })).status, 422);
    permissions = { Comercial: { pedido: ['visualizar'] } };
    company = SEED_IDS.empresaA;
    await allows({ empresa_id: company, section: 'pedido' }, true);
    await allows({ empresa_id: company, section: 'pedido', action: 'criar' }, false);
    await allows({ empresa_id: SEED_IDS.empresaA2 }, false);
    await allows({ empresa_id: null }, false);
    permissions = {};
    await allows({ empresa_id: company }, false);
    permissions = { '*': ['visualizar'], Comercial: { '*': ['visualizar'] } };
    await allows({ empresa_id: company }, false);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});

test('guard exige contexto coerente e reconhece vocabulário explícito existente', () => {
  const profile: any = { id: OWNER_ID, groupId: SEED_IDS.groupA, empresaId: null, role: 'admin', permissoes: OWNER_ERP_PERMISSION_TREE, empresas: [{ id: SEED_IDS.empresaA }] };
  const guard = { profile_id: OWNER_ID, group_id: SEED_IDS.groupA, empresa_id: null, module: 'Dashboard Corporativo', section: ['Corporativo'], action: 'ver' };
  assert.equal(resolveSessionEntityGuard([profile], guard), true);
  assert.equal(resolveSessionEntityGuard([profile], { ...guard, scope_type: 'company' }), false);
  assert.equal(resolveSessionEntityGuard([profile], { ...guard, empresa_id: SEED_IDS.empresaA, scope_type: 'group' }), false);
  assert.throws(() => resolveSessionEntityGuard([profile], { ...guard, group_id: undefined }));
  profile.role = 'user';
  assert.equal(resolveSessionEntityGuard([profile], guard), false);
});

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
