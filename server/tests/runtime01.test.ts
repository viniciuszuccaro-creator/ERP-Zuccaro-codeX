import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import test from 'node:test';
import type { QueryResult, QueryResultRow } from 'pg';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig, publicConfigView } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { listMigrationFiles } from '../src/db/migrate.ts';
import { createSupabaseAuthMiddleware, requestIdMiddleware, scopeMiddleware } from '../src/middleware/requestContext.ts';
import { createErrorHandler } from '../src/middleware/errorHandler.ts';
import { InMemoryMarcaRepository } from '../src/repositories/inMemoryMarcaRepository.ts';
import { MarcaService } from '../src/services/marcaService.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    PORT: '3080',
    CORS_ORIGINS: 'http://localhost:5173,https://erp-dev.cpaferroeaco.com.br',
    REQUIRE_DATABASE: 'false',
    ...overrides,
  });
}

function linkedGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function profileDb(profileId: string, authorize = (authUserId: string, groupId: string, empresaId: string | null) =>
  authUserId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' && groupId === GROUP_A && empresaId === EMPRESA_A) {
  const db = createDbClient(testConfig());
  const calls: unknown[][] = [];
  db.query = async <T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
    assert.match(sql, /p\.auth_user_id = \$1/);
    assert.match(sql, /p\.ativo = true/);
    assert.match(sql, /p\.group_id = \$2/);
    assert.match(sql, /e\.group_id = \$2/);
    assert.match(sql, /p\.empresa_id IS NULL OR p\.empresa_id = \$3/);
    calls.push(params ?? []);
    const [authUserId, groupId, empresaId] = params ?? [];
    const rows = authorize(String(authUserId), String(groupId), empresaId == null ? null : String(empresaId))
      ? [{ id: profileId } as T] : [];
    return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
  };
  return { db, calls };
}

test('config load and public view never expose secrets', () => {
  const config = testConfig({
    DATABASE_URL: 'postgresql://user:secret@localhost:5432/erp',
    SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role',
    SUPABASE_ANON_KEY: 'anon-key',
  });
  const view = publicConfigView(config);
  const serialized = JSON.stringify(view);
  assert.equal(view.databaseConfigured, true);
  assert.doesNotMatch(serialized, /secret/i);
  assert.doesNotMatch(serialized, /service-role/i);
  assert.doesNotMatch(serialized, /postgresql:\/\//);
});

test('migrations include foundation through 030 in canonical order', () => {
  const files = listMigrationFiles();
  const requiredThrough012 = [
    '001_foundation.sql',
    '002_rls_foundation.sql',
    '003_marcas_pilot.sql',
    '004_tenant_integrity.sql',
    '005_cadastros_simples.sql',
    '006_produtos_base.sql',
    '007_produtos_master_data.sql',
    '008_produtos_fk_tenant.sql',
    '009_clientes_master_data.sql',
    '010_cliente_empresas_comercial.sql',
    '011_cliente_locais.sql',
    '012_obras.sql',
  ];
  for (const file of requiredThrough012) {
    assert.ok(files.includes(file), `missing ${file}`);
  }
  for (let i = 1; i < requiredThrough012.length; i += 1) {
    assert.ok(
      files.indexOf(requiredThrough012[i - 1]) < files.indexOf(requiredThrough012[i]),
      `${requiredThrough012[i - 1]} must precede ${requiredThrough012[i]}`,
    );
  }
  assert.ok(files.includes('013_tabelas_preco.sql'));
  assert.ok(files.indexOf('012_obras.sql') < files.indexOf('013_tabelas_preco.sql'));
  assert.ok(files.includes('014_condicoes_pagamento.sql'));
  assert.ok(files.indexOf('013_tabelas_preco.sql') < files.indexOf('014_condicoes_pagamento.sql'));
  assert.ok(files.includes('015_condicoes_pagamento_hardening.sql'));
  assert.ok(files.indexOf('014_condicoes_pagamento.sql') < files.indexOf('015_condicoes_pagamento_hardening.sql'));
  assert.ok(files.includes('016_orcamentos_comercial_360.sql'));
  assert.ok(files.indexOf('015_condicoes_pagamento_hardening.sql') < files.indexOf('016_orcamentos_comercial_360.sql'));
  assert.ok(files.includes('017_pedidos_comercial_360.sql'));
  assert.ok(files.indexOf('016_orcamentos_comercial_360.sql') < files.indexOf('017_pedidos_comercial_360.sql'));
  assert.ok(files.includes('018_produto_pim_dam_outbox.sql'));
  assert.ok(files.indexOf('017_pedidos_comercial_360.sql') < files.indexOf('018_produto_pim_dam_outbox.sql'));
  assert.ok(files.includes('019_produto_relacoes_tenant.sql'));
  assert.ok(files.indexOf('018_produto_pim_dam_outbox.sql') < files.indexOf('019_produto_relacoes_tenant.sql'));
  assert.ok(files.includes('020_produto_midia_storage_key_unique.sql'));
  assert.ok(files.indexOf('019_produto_relacoes_tenant.sql') < files.indexOf('020_produto_midia_storage_key_unique.sql'));
  assert.ok(files.includes('021_produto_midia_upload_reservation.sql'));
  assert.ok(files.indexOf('020_produto_midia_storage_key_unique.sql') < files.indexOf('021_produto_midia_upload_reservation.sql'));
  assert.ok(files.includes('022_produto_midia_scan_evidence.sql'));
  assert.ok(files.indexOf('021_produto_midia_upload_reservation.sql') < files.indexOf('022_produto_midia_scan_evidence.sql'));
  assert.ok(files.includes('023_produto_material_norma.sql'));
  assert.ok(files.indexOf('022_produto_midia_scan_evidence.sql') < files.indexOf('023_produto_material_norma.sql'));
  assert.ok(files.includes('024_produto_canais_rascunho.sql'));
  assert.ok(files.indexOf('023_produto_material_norma.sql') < files.indexOf('024_produto_canais_rascunho.sql'));
  assert.ok(files.includes('025_pedidos_origem_canal_idempotency.sql'));
  assert.ok(files.indexOf('024_produto_canais_rascunho.sql') < files.indexOf('025_pedidos_origem_canal_idempotency.sql'));
  assert.ok(files.includes('026_pedidos_tipo_comercial.sql'));
  assert.ok(files.indexOf('025_pedidos_origem_canal_idempotency.sql') < files.indexOf('026_pedidos_tipo_comercial.sql'));
  assert.ok(files.includes('027_orcamentos_versao.sql'));
  assert.ok(files.indexOf('026_pedidos_tipo_comercial.sql') < files.indexOf('027_orcamentos_versao.sql'));
  assert.ok(files.includes('028_orcamentos_origem_canal_idempotency.sql'));
  assert.ok(files.indexOf('027_orcamentos_versao.sql') < files.indexOf('028_orcamentos_origem_canal_idempotency.sql'));
  assert.ok(files.includes('029_orcamentos_anexos.sql'));
  assert.ok(files.indexOf('028_orcamentos_origem_canal_idempotency.sql') < files.indexOf('029_orcamentos_anexos.sql'));
  assert.ok(files.includes('030_pedidos_anexos.sql'));
  assert.ok(files.indexOf('029_orcamentos_anexos.sql') < files.indexOf('030_pedidos_anexos.sql'));
  assert.equal(files.at(-1), '030_pedidos_anexos.sql');
});

test('marca service validates payload and audits create/update/soft-delete', async () => {
  const repo = new InMemoryMarcaRepository();
  const audit = new InMemoryAuditRepository();
  const service = new MarcaService(repo, audit, linkedGuard());
  const ctx = {
    requestId: 'req-1',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorId: 'actor-1',
    actorEmail: 'dev@example.com',
  };

  await assert.rejects(
    () => service.create(ctx, { nome_marca: '' }),
    /Invalid marca payload/,
  );

  const created = await service.create(ctx, { nome_marca: 'Gerdau Teste', pais_origem: 'Brasil' });
  assert.equal(created.group_id, GROUP_A);
  assert.equal(created.empresa_id, EMPRESA_A);

  const updated = await service.update(ctx, created.id, { descricao: 'Aco' });
  assert.equal(updated.descricao, 'Aco');

  const deleted = await service.softDelete(ctx, created.id);
  assert.equal(deleted.ativo, false);

  const logs = await audit.listByEntity('Marca', created.id);
  assert.equal(logs.length, 3);
  assert.deepEqual(logs.map((l) => l.action), ['create', 'update', 'soft_delete']);
  assert.ok(logs.every((l) => l.requestId === 'req-1'));
  assert.ok(logs.every((l) => l.groupId === GROUP_A));
  const updateLog = logs.find((l) => l.action === 'update');
  assert.equal((updateLog?.beforeData as { nome_marca: string }).nome_marca, 'Gerdau Teste');
  assert.equal((updateLog?.beforeData as { pais_origem: string }).pais_origem, 'Brasil');
  assert.equal((updateLog?.afterData as { descricao: string }).descricao, 'Aco');
  assert.equal((updateLog?.afterData as { pais_origem: string }).pais_origem, 'Brasil');
});

test('multiempresa scope isolates groups', async () => {
  const repo = new InMemoryMarcaRepository();
  const audit = new InMemoryAuditRepository();
  const service = new MarcaService(repo, audit, linkedGuard());

  const a = await service.create({
    requestId: 'r-a',
    groupId: GROUP_A,
  }, { nome_marca: 'Marca A' });

  await service.create({
    requestId: 'r-b',
    groupId: GROUP_B,
  }, { nome_marca: 'Marca B' });

  const listA = await service.list({ requestId: 'r-list', groupId: GROUP_A });
  assert.equal(listA.length, 1);
  assert.equal(listA[0].id, a.id);

  await assert.rejects(
    () => service.get({ requestId: 'r-x', groupId: GROUP_B }, a.id),
    /not found/i,
  );
});

test('GET /health and /ready with memory harness', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: true, tenantGuard: linkedGuard() });

  const healthRes = await fetchOk(app, '/health');
  assert.equal(healthRes.status, 'ok');
  assert.equal(healthRes.environment, 'dev');
  assert.ok(healthRes.timestamp);
  assert.ok(healthRes.version);

  const readyRes = await fetchStatus(app, '/ready');
  assert.equal(readyRes.statusCode, 503);
  assert.equal(readyRes.body.status, 'not_ready');
});

test('API piloto Marca end-to-end via harness', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app, auditRepo } = createApp({ config, db, useMemory: true, tenantGuard: linkedGuard() });

  const createRes = await fetchStatus(app, '/api/v1/marcas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-email': 'piloto@example.com',
      'x-request-id': 'pilot-req-1',
    },
    body: JSON.stringify({ nome_marca: 'Belgo', categoria: 'Longos' }),
  });
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.data.nome_marca, 'Belgo');
  assert.equal(createRes.headers.get('x-request-id'), 'pilot-req-1');

  const id = createRes.body.data.id;
  const listRes = await fetchOk(app, '/api/v1/marcas', {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(listRes.data.length, 1);

  const getRes = await fetchOk(app, `/api/v1/marcas/${id}`, {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(getRes.data.id, id);

  const patchRes = await fetchOk(app, `/api/v1/marcas/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
    },
    body: JSON.stringify({ descricao: 'Atualizada' }),
  });
  assert.equal(patchRes.data.descricao, 'Atualizada');

  const delRes = await fetchOk(app, `/api/v1/marcas/${id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(delRes.data.ativo, false);

  if ('entries' in auditRepo) {
    assert.ok(auditRepo.entries.length >= 3);
  }
});

test('API rejects missing group scope', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: true, tenantGuard: linkedGuard() });
  const res = await fetchStatus(app, '/api/v1/marcas');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'GROUP_ID_REQUIRED');
});

test('API rejects invalid payload', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({ config, db, useMemory: true, tenantGuard: linkedGuard() });
  const res = await fetchStatus(app, '/api/v1/marcas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-group-id': GROUP_A,
    },
    body: JSON.stringify({ nome_marca: '' }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('integration postgres ready when DATABASE_URL present (optional)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not available in this environment');
    return;
  }
  const config = testConfig({
    DATABASE_URL: process.env.DATABASE_URL,
    REQUIRE_DATABASE: 'true',
  });
  const db = createDbClient(config);
  const ok = await db.checkConnection();
  assert.equal(ok, true);
  await db.end();
});
test('Supabase Auth middleware derives actor from verified user and rejects spoofed headers', async () => {
  const authUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const profileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const { db, calls: profileCalls } = profileDb(profileId);
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const app = express();
  app.use(requestIdMiddleware);
  app.use(createSupabaseAuthMiddleware({
    supabaseUrl: 'http://supabase.internal', anonKey: 'synthetic-anon-key', db,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers });
      return new Response(JSON.stringify({ id: authUserId, email: 'user@example.test' }), { status: 200 });
    },
  }));
  app.use(scopeMiddleware);
  app.get('/identity', (req, res) => res.json({ actorId: req.actorId, actorEmail: req.actorEmail, groupId: req.groupId, empresaId: req.empresaId }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(createErrorHandler(testConfig()));
  const authenticated = await fetchStatus(app, '/identity', { headers: {
    authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A,
  } });
  assert.equal(authenticated.statusCode, 200);
  assert.deepEqual(authenticated.body, { actorId: profileId, actorEmail: 'user@example.test', groupId: GROUP_A, empresaId: EMPRESA_A });
  assert.equal(calls[0].url, 'http://supabase.internal/auth/v1/user');
  assert.equal((calls[0].headers as Record<string, string>).apikey, 'synthetic-anon-key');
  assert.equal((calls[0].headers as Record<string, string>).Authorization, 'Bearer synthetic.jwt.token');
  assert.deepEqual(profileCalls[0], [authUserId, GROUP_A, EMPRESA_A]);
  assert.equal((await fetchStatus(app, '/identity', { headers: { 'x-actor-id': profileId } })).statusCode, 401);
  assert.equal((await fetchStatus(app, '/identity', { headers: {
    authorization: 'Bearer synthetic.jwt.token', 'x-actor-id': authUserId, 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A,
  } })).statusCode, 403);

  assert.equal((await fetchStatus(app, '/identity', { headers: {
    authorization: 'Bearer synthetic.jwt.token', 'x-actor-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A,
  } })).statusCode, 403);
  assert.equal((await fetchStatus(app, '/health')).statusCode, 200);
  assert.equal(calls.length, 3);
});

test('Supabase Auth middleware fails closed on invalid token, malformed identity and outage', async () => {
  const outcomes = [
    { fetchImpl: async () => new Response('{}', { status: 401 }), expected: 401 },
    { fetchImpl: async () => new Response(JSON.stringify({ id: 'not-a-uuid' }), { status: 200 }), expected: 401 },
    { fetchImpl: async () => { throw new Error('network synthetic'); }, expected: 503 },
  ];
  for (const outcome of outcomes) {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(createSupabaseAuthMiddleware({
      supabaseUrl: 'http://supabase.internal', anonKey: 'synthetic-anon-key', db: profileDb('cccccccc-cccc-4ccc-8ccc-cccccccccccc').db, fetchImpl: outcome.fetchImpl,
    }));
    app.use(scopeMiddleware);
    app.get('/identity', (_req, res) => res.json({ ok: true }));
    app.use(createErrorHandler(testConfig()));
    const response = await fetchStatus(app, '/identity', { headers: { authorization: 'Bearer synthetic.jwt.token' } });
    assert.equal(response.statusCode, outcome.expected);
    assert.equal(JSON.stringify(response.body).includes('synthetic.jwt.token'), false);
  }
});

test('production config requires verified Supabase Auth and never permits actor headers mode', () => {
  assert.throws(() => testConfig({ ERP_ENV: 'prod', ERP_AUTH_MODE: 'dev_headers' }), /forbidden outside development/);
  assert.throws(() => testConfig({ ERP_ENV: 'hml', ERP_AUTH_MODE: 'dev_headers' }), /forbidden outside development/);
  assert.throws(() => testConfig({ ERP_ENV: 'hml' }), /SUPABASE_URL and SUPABASE_ANON_KEY/);
  assert.throws(() => testConfig({ ERP_ENV: 'prod' }), /SUPABASE_URL and SUPABASE_ANON_KEY/);
  const config = testConfig({ ERP_ENV: 'prod', SUPABASE_URL: 'http://supabase.internal', SUPABASE_ANON_KEY: 'synthetic-anon-key' });
  assert.equal(config.authMode, 'supabase_user');
  assert.equal(JSON.stringify(publicConfigView(config)).includes('synthetic-anon-key'), false);
});

test('createApp enforces verified identity before tenant scope and exposes truthful auth mode', async () => {
  const authUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const profileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const config = testConfig({ ERP_AUTH_MODE: 'supabase_user', SUPABASE_URL: 'http://supabase.internal', SUPABASE_ANON_KEY: 'synthetic-anon-key' });
  const { db } = profileDb(profileId);
  let validations = 0;
  const { app } = createApp({
    config, db, useMemory: true, tenantGuard: linkedGuard(),
    authFetchImpl: async () => {
      validations += 1;
      return new Response(JSON.stringify({ id: authUserId, email: 'user@example.test' }), { status: 200 });
    },
  });
  const meta = await fetchStatus(app, '/api/v1/meta');
  assert.equal(meta.statusCode, 200);
  assert.equal(meta.body.auth.mode, 'supabase_user');
  assert.equal(validations, 0);
  const path = '/api/v1/marcas';
  const scope = { 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A };
  const missing = await fetchStatus(app, path, { headers: { ...scope, 'x-actor-id': profileId } });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.body.error.code, 'AUTH_REQUIRED');
  const spoofed = await fetchStatus(app, path, { headers: {
    ...scope, authorization: 'Bearer synthetic.jwt.token', 'x-actor-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  } });
  assert.equal(spoofed.statusCode, 403);
  const valid = await fetchStatus(app, path, { headers: { ...scope, authorization: 'Bearer synthetic.jwt.token' } });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.data.length, 0);
  assert.equal(validations, 2);
  const otherGroup = await fetchStatus(app, path, { headers: {
    authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_B, 'x-empresa-id': EMPRESA_B,
  } });
  assert.equal(otherGroup.statusCode, 403);
  assert.equal(otherGroup.body.error.code, 'ACTOR_SCOPE_DENIED');
  const otherCompany = await fetchStatus(app, path, { method: 'POST', headers: {
    authorization: 'Bearer synthetic.jwt.token', 'content-type': 'application/json', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_B,
  }, body: JSON.stringify({ nome_marca: 'Nao criar' }) });
  assert.equal(otherCompany.statusCode, 403);
  assert.equal(otherCompany.body.error.code, 'ACTOR_SCOPE_DENIED');
  const withoutGroup = await fetchStatus(app, path, { headers: { authorization: 'Bearer synthetic.jwt.token' } });
  assert.equal(withoutGroup.statusCode, 400);
  assert.equal((await fetchStatus(app, path, { headers: { ...scope, authorization: 'Bearer synthetic.jwt.token' } })).body.data.length, 0);
  const absent = profileDb(profileId, () => false);
  const absentApp = createApp({ config, db: absent.db, useMemory: true, tenantGuard: linkedGuard(),
    authFetchImpl: async () => new Response(JSON.stringify({ id: authUserId }), { status: 200 }),
  }).app;
  const noProfile = await fetchStatus(absentApp, path, { headers: { ...scope, authorization: 'Bearer synthetic.jwt.token' } });
  assert.equal(noProfile.statusCode, 403);
  const outage = profileDb(profileId);
  outage.db.query = async () => { throw new Error('synthetic database outage'); };
  const outageApp = createApp({ config, db: outage.db, useMemory: true, tenantGuard: linkedGuard(),
    authFetchImpl: async () => new Response(JSON.stringify({ id: authUserId }), { status: 200 }),
  }).app;
  const unavailable = await fetchStatus(outageApp, path, { headers: { ...scope, authorization: 'Bearer synthetic.jwt.token' } });
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error.code, 'PROFILE_UNAVAILABLE');
});

test('PostgreSQL real: Supabase identity maps to active ERP profile and scoped company',
  { skip: !process.env.DATABASE_URL && 'DATABASE_URL not available in this environment' }, async () => {
    const config = testConfig({ DATABASE_URL: process.env.DATABASE_URL! });
    const db = createDbClient(config);
    const authUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const profileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    try {
      await db.withTransaction(async (executor) => {
        await executor.query('CREATE TEMP TABLE profiles (id uuid, auth_user_id uuid, ativo boolean, group_id uuid, empresa_id uuid) ON COMMIT DROP');
        await executor.query('CREATE TEMP TABLE empresas (id uuid, group_id uuid) ON COMMIT DROP');
        await executor.query('INSERT INTO empresas (id, group_id) VALUES ($1, $2), ($3, $4)', [EMPRESA_A, GROUP_A, EMPRESA_B, GROUP_B]);
        await executor.query('INSERT INTO profiles (id, auth_user_id, ativo, group_id, empresa_id) VALUES ($1, $2, true, $3, $4)', [profileId, authUserId, GROUP_A, EMPRESA_A]);
        const app = express();
        app.use(requestIdMiddleware);
        app.use(createSupabaseAuthMiddleware({
          supabaseUrl: 'http://supabase.internal', anonKey: 'synthetic-anon-key', db: executor,
          fetchImpl: async () => new Response(JSON.stringify({ id: authUserId, email: 'user@example.test' }), { status: 200 }),
        }));
        app.use(scopeMiddleware);
        app.get('/identity', (req, res) => res.json({ actorId: req.actorId, groupId: req.groupId, empresaId: req.empresaId }));
        app.use(createErrorHandler(config));
        const authorized = await fetchStatus(app, '/identity', { headers: {
          authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A,
        } });
        assert.equal(authorized.statusCode, 200);
        assert.deepEqual(authorized.body, { actorId: profileId, groupId: GROUP_A, empresaId: EMPRESA_A });
        const otherGroup = await fetchStatus(app, '/identity', { headers: {
          authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_B, 'x-empresa-id': EMPRESA_B,
        } });
        assert.equal(otherGroup.statusCode, 403);
        const otherCompany = await fetchStatus(app, '/identity', { headers: {
          authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_B,
        } });
        assert.equal(otherCompany.statusCode, 403);
        const groupView = await fetchStatus(app, '/identity', { headers: {
          authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_A,
        } });
        assert.equal(groupView.statusCode, 403);
        await executor.query('UPDATE profiles SET ativo = false WHERE id = $1', [profileId]);
        const inactive = await fetchStatus(app, '/identity', { headers: {
          authorization: 'Bearer synthetic.jwt.token', 'x-group-id': GROUP_A, 'x-empresa-id': EMPRESA_A,
        } });
        assert.equal(inactive.statusCode, 403);
      });
    } finally {
      await db.end();
    }
  });

async function fetchStatus(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Unable to bind test server');
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    return { statusCode: response.status, body, headers: response.headers };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function fetchOk(app: ReturnType<typeof createApp>['app'], path: string, init: RequestInit = {}) {
  const res = await fetchStatus(app, path, init);
  assert.ok(res.statusCode >= 200 && res.statusCode < 300, JSON.stringify(res.body));
  return res.body;
}

void randomUUID;
