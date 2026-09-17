import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig, publicConfigView } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { listMigrationFiles } from '../src/db/migrate.ts';
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

test('migrations are ordered and foundation + runtime-02/03/04 files exist', () => {
  const files = listMigrationFiles();
  assert.deepEqual(files, [
    '001_foundation.sql',
    '002_rls_foundation.sql',
    '003_marcas_pilot.sql',
    '004_tenant_integrity.sql',
    '005_cadastros_simples.sql',
    '006_produtos_base.sql',
    '007_produtos_master_data.sql',
    '008_produtos_fk_tenant.sql',
    '009_clientes_master_data.sql',
  ]);
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
