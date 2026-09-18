import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import {
  CLIENTE_LOCAL_FINALIDADES,
  buildClienteLocalFingerprint,
} from '../src/repositories/clienteLocalTypes.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A2 = '33333333-3333-4333-8333-333333333334';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ACTOR_COMPANY_A = 'cccccccc-3333-4333-8333-cccccccccccc';
const ACTOR_COMPANY_A2 = 'dddddddd-4444-4444-8444-dddddddddddd';
const ACTOR_VIEW = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const ACTOR_NO_PRIMARY = 'ffffffff-6666-4666-8666-ffffffffffff';
const LOCAL_ACTIONS = [
  'visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'principal',
];
const CLIENT_ACTIONS = ['visualizar', 'criar'];
const RELATION_ACTIONS = ['visualizar', 'criar', 'bloquear'];

function tenantGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_A2, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function rbacGuard() {
  const guard = new InMemoryRbacGuard();
  guard.link({
    actorId: ACTOR_A,
    groupId: GROUP_A,
    permissions: {
      Cadastros: {
        cliente: CLIENT_ACTIONS,
        cliente_empresa: RELATION_ACTIONS,
        cliente_local: LOCAL_ACTIONS,
      },
    },
  });
  guard.link({
    actorId: ACTOR_B,
    groupId: GROUP_B,
    permissions: { Cadastros: { cliente_local: LOCAL_ACTIONS } },
  });
  guard.link({
    actorId: ACTOR_COMPANY_A,
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    permissions: { Cadastros: { cliente_local: LOCAL_ACTIONS } },
  });
  guard.link({
    actorId: ACTOR_COMPANY_A2,
    groupId: GROUP_A,
    empresaId: EMPRESA_A2,
    permissions: { Cadastros: { cliente_local: LOCAL_ACTIONS } },
  });
  guard.link({
    actorId: ACTOR_VIEW,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente_local: ['visualizar'] } },
  });
  guard.link({
    actorId: ACTOR_NO_PRIMARY,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente_local: ['visualizar', 'editar'] } },
  });
  return guard;
}

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    PORT: '3080',
    CORS_ORIGINS: 'http://localhost:5173',
    REQUIRE_DATABASE: 'false',
  });
}

function groupHeaders(actorId = ACTOR_A) {
  return {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-actor-id': actorId,
  };
}

function localPayload(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Local Sintetico',
    cep: '00000-001',
    logradouro: 'Rua Sintetica A',
    numero: 'S/N',
    complemento: 'Bloco A',
    bairro: 'Bairro Dev',
    cidade: 'Cidade Dev',
    uf: 'sp',
    pais: 'Brasil',
    finalidades: [{ finalidade: 'CADASTRAL', principal: true }],
    ...overrides,
  };
}

test('migration 011 é convergente, sem Obra, com integridade/principal/RLS', async () => {
  const db = new PGlite();
  try {
    const migrationDir = join(__dirname, '../migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => /^\d{3}_.*\.sql$/.test(file))
      .sort();
    assert.ok(files.includes('011_cliente_locais.sql'));
    assert.ok(files.includes('012_obras.sql'));
    assert.ok(files.indexOf('011_cliente_locais.sql') < files.indexOf('012_obras.sql'));
    for (const file of files) {
      await db.exec(
        readFileSync(join(migrationDir, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    const migration = readFileSync(join(migrationDir, '011_cliente_locais.sql'), 'utf8');
    await db.exec(migration);
    assert.doesNotMatch(migration, /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?obras/i);
    assert.doesNotMatch(migration, /\bmd5\s*\(/i);
    assert.doesNotMatch(
      migration.match(/CREATE TABLE IF NOT EXISTS cliente_local_finalidades[\s\S]*$/)?.[0] ?? '',
      /'OBRA'/,
    );

    const seed = readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    const localCount = await db.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM cliente_locais',
    );
    assert.equal(localCount.rows[0].total, 4);
    const purposesA = await db.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM cliente_local_finalidades
      WHERE cliente_local_id='${SEED_IDS.clienteLocalA}' AND ativo=true
    `);
    assert.equal(purposesA.rows[0].total, 3);
    const manualCoordinates = await db.query<{
      coordinate_source: string;
      geocode_status: string;
      geocoded_at: string | null;
    }>(`
      SELECT coordinate_source, geocode_status, geocoded_at
      FROM cliente_locais WHERE id='${SEED_IDS.clienteLocalB}'
    `);
    assert.deepEqual(manualCoordinates.rows, [{
      coordinate_source: 'MANUAL',
      geocode_status: 'NAO_GEOCODIFICADO',
      geocoded_at: null,
    }]);
    await assert.rejects(
      () => db.exec(`
        UPDATE cliente_locais SET longitude=NULL
        WHERE id='${SEED_IDS.clienteLocalB}'
      `),
      /chk_cliente_locais_geo/,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE cliente_locais SET latitude=91
        WHERE id='${SEED_IDS.clienteLocalB}'
      `),
      /chk_cliente_locais_geo/,
    );
    const internalFingerprint = await db.query<{ endereco_fingerprint: string }>(`
      SELECT endereco_fingerprint
      FROM cliente_locais WHERE id='${SEED_IDS.clienteLocalA}'
    `);
    assert.equal(
      internalFingerprint.rows[0].endereco_fingerprint,
      buildClienteLocalFingerprint(SEED_IDS.groupA, SEED_IDS.clientePjA, {
        cep: '00000001',
        logradouro: 'RUA SINTETICA A',
        numero: 'S/N',
        complemento: 'BLOCO A',
        cidade: 'CIDADE DEV A',
        uf: 'SP',
      }),
    );

    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_locais (
          group_id, cliente_id, nome, cep, logradouro, numero, bairro, cidade, uf
        ) VALUES (
          '${SEED_IDS.groupB}', '${SEED_IDS.clientePjA}', 'Cross', '00000009',
          'Rua Cross', '1', 'Bairro', 'Cidade', 'SP'
        )
      `),
      /TENANT_FK_MISMATCH/,
    );
    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_local_finalidades (
          group_id, cliente_id, cliente_local_id, finalidade, principal
        ) VALUES (
          '${SEED_IDS.groupA}', '${SEED_IDS.clientePjA}',
          '${SEED_IDS.clienteLocalC}', 'ENTREGA', true
        )
      `),
      /unique|duplicate/i,
    );

    const rls = await db.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid IN ('cliente_locais'::regclass, 'cliente_local_finalidades'::regclass)
      ORDER BY relname
    `);
    assert.equal(rls.rows.length, 2);
    assert.ok(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));

    await db.exec(`
      CREATE ROLE runtime06a_probe NOLOGIN;
      GRANT USAGE ON SCHEMA public TO runtime06a_probe;
      GRANT SELECT ON cliente_locais, cliente_local_finalidades TO runtime06a_probe;
      SET ROLE runtime06a_probe;
    `);
    assert.equal(
      (await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM cliente_locais',
      )).rows[0].total,
      0,
    );
    assert.equal(
      (await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM cliente_local_finalidades',
      )).rows[0].total,
      0,
    );
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
});

test('API ClienteLocal cobre multifinalidade, principal, tenant, geo e lifecycle', async () => {
  const appConfig = testConfig();
  const db = createDbClient(appConfig);
  const runtime = createApp({
    config: appConfig,
    db,
    useMemory: true,
    tenantGuard: tenantGuard(),
    rbacGuard: rbacGuard(),
  });
  const { app, clienteLocalService, auditRepo } = runtime;
  const cliente = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'Cliente Local E2E',
    }),
  });
  const clienteId = cliente.data.id as string;
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: '{}',
  });
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A2}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: '{}',
  });
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A2}/block`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({ motivo: 'Empresa A2 bloqueada para E2E' }),
  });

  const base = `/api/v1/clientes/${clienteId}/locais`;
  const localA = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Matriz Multifinalidade',
      finalidades: [
        { finalidade: 'CADASTRAL', principal: true },
        { finalidade: 'FISCAL', principal: true },
        { finalidade: 'COBRANCA', principal: true },
      ],
    })),
  });
  assert.equal(localA.data.finalidades.length, 3);
  assert.equal(localA.data.uf, 'SP');
  assert.equal(localA.data.cep, '00000001');
  assert.equal('endereco_fingerprint' in localA.data, false);

  const localB = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Entrega Principal B',
      cep: '00000002',
      logradouro: 'Avenida Sintetica B',
      numero: '100-A',
      complemento: null,
      latitude: 0,
      longitude: 0,
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    })),
  });
  assert.equal(localB.data.coordinate_source, 'MANUAL');
  assert.equal(localB.data.geocode_status, 'NAO_GEOCODIFICADO');
  assert.equal(localB.data.geocoded_at, null);

  const localC = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Entrega C fora primeira pagina',
      cep: '00000003',
      logradouro: 'Estrada Sintetica C',
      numero: 'KM 12',
      complemento: 'Portao 2',
      cidade: 'Outra Cidade',
      uf: 'MG',
      finalidades: [{ finalidade: 'ENTREGA', principal: false }],
    })),
  });

  const switched = await fetchOk(app, `${base}/${localC.data.id}/finalidades`, {
    method: 'PUT',
    headers: groupHeaders(),
    body: JSON.stringify({
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
  });
  assert.equal(switched.data.finalidades[0].principal, true);
  const oldPrimary = await fetchOk(app, `${base}/${localB.data.id}`, {
    headers: groupHeaders(),
  });
  assert.equal(oldPrimary.data.finalidades[0].principal, false);

  const context = {
    requestId: 'principal-concurrency',
    groupId: GROUP_A,
    actorId: ACTOR_A,
    scopeType: 'grupo' as const,
  };
  await Promise.all([
    clienteLocalService.setFinalidades(context, clienteId, localB.data.id, {
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
    clienteLocalService.setFinalidades(context, clienteId, localC.data.id, {
      finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    }),
  ]);
  const principals = await clienteLocalService.list(context, clienteId, {
    finalidade: 'ENTREGA',
    principal: true,
  });
  assert.equal(principals.meta.total, 1);

  const page = await fetchOk(app, `${base}?limit=1&offset=0&order_by=nome`, {
    headers: groupHeaders(),
  });
  assert.equal(page.data.length, 1);
  assert.equal(page.meta.total, 3);
  assert.equal(page.meta.hasMore, true);
  const search = await fetchOk(
    app,
    `${base}?search=${encodeURIComponent('fora primeira pagina')}`,
    { headers: groupHeaders() },
  );
  assert.equal(search.data.length, 1);
  const filter = await fetchOk(app, `${base}?cidade=Outra%20Cidade&uf=MG&finalidade=ENTREGA`, {
    headers: groupHeaders(),
  });
  assert.equal(filter.data.length, 1);

  const updated = await fetchOk(app, `${base}/${localA.data.id}`, {
    method: 'PATCH',
    headers: groupHeaders(),
    body: JSON.stringify({ referencia: '<script>Portaria</script>' }),
  });
  assert.equal(updated.data.referencia.includes('<'), false);

  const duplicate = await fetchStatus(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Duplicado',
      cep: '00000001',
      logradouro: ' RUA   SINTETICA A ',
      numero: 's/n',
      complemento: 'BLOCO-A',
      finalidades: [{ finalidade: 'OUTRO', principal: false }],
    })),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.error.code, 'POSSIBLE_DUPLICATE');

  const differentComplement = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Mesmo Predio Sala 2',
      complemento: 'Sala 2',
      finalidades: [{ finalidade: 'OUTRO', principal: false }],
    })),
  });
  assert.ok(differentComplement.data.id);

  const gpsLocal = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      nome: 'Local GPS sem geocoding',
      cep: '00000005',
      logradouro: 'Rua GPS',
      latitude: -10,
      longitude: -20,
      coordinate_source: 'GPS',
      finalidades: [{ finalidade: 'OUTRO', principal: false }],
    })),
  });
  assert.equal(gpsLocal.data.coordinate_source, 'GPS');
  assert.equal(gpsLocal.data.geocode_status, 'NAO_GEOCODIFICADO');
  assert.equal(gpsLocal.data.geocoded_at, null);

  for (const coordinates of [
    { latitude: 1 },
    { longitude: 1 },
    { latitude: 91, longitude: 0 },
    { latitude: -91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: 0, longitude: -181 },
  ]) {
    const invalid = await fetchStatus(app, base, {
      method: 'POST',
      headers: groupHeaders(),
      body: JSON.stringify(localPayload({
        nome: `Geo invalido ${JSON.stringify(coordinates)}`,
        cep: `000000${String(10 + Object.keys(coordinates).length).slice(-2)}`,
        complemento: JSON.stringify(coordinates),
        ...coordinates,
      })),
    });
    assert.equal(invalid.statusCode, 400);
  }

  const companyA = await fetchStatus(app, `${base}/${localA.data.id}`, {
    headers: {
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-id': ACTOR_COMPANY_A,
    },
  });
  assert.equal(companyA.statusCode, 200);
  const companyA2 = await fetchStatus(app, `${base}/${localA.data.id}`, {
    headers: {
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A2,
      'x-actor-id': ACTOR_COMPANY_A2,
    },
  });
  assert.equal(companyA2.statusCode, 403);
  const crossTenant = await fetchStatus(app, `${base}/${localA.data.id}`, {
    headers: { 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_B },
  });
  assert.equal(crossTenant.statusCode, 404);

  const cannotDeletePrimary = await fetchStatus(app, `${base}/${localA.data.id}`, {
    method: 'DELETE',
    headers: groupHeaders(),
  });
  assert.equal(cannotDeletePrimary.statusCode, 409);
  await fetchOk(app, `${base}/${localA.data.id}/finalidades`, {
    method: 'PUT',
    headers: groupHeaders(),
    body: JSON.stringify({
      finalidades: [
        { finalidade: 'CADASTRAL', principal: false },
        { finalidade: 'FISCAL', principal: false },
        { finalidade: 'COBRANCA', principal: false },
      ],
    }),
  });
  await fetchOk(app, `${base}/${localA.data.id}`, {
    method: 'DELETE',
    headers: groupHeaders(),
  });
  assert.equal((await fetchStatus(app, `${base}/${localA.data.id}`, {
    headers: groupHeaders(),
  })).statusCode, 404);
  const inactive = await fetchOk(app, `${base}?ativo=false`, { headers: groupHeaders() });
  assert.ok(inactive.data.some((row: { id: string }) => row.id === localA.data.id));
  const restored = await fetchOk(app, `${base}/${localA.data.id}/restore`, {
    method: 'POST',
    headers: groupHeaders(),
  });
  assert.equal(restored.data.ativo, true);

  const logs = await auditRepo.listByEntity('ClienteLocal', localA.data.id);
  assert.deepEqual(
    logs.map((entry) => entry.action),
    ['create', 'update', 'set_purposes', 'soft_delete', 'restore'],
  );
  const serializedAudit = JSON.stringify(logs);
  assert.equal(serializedAudit.includes('Rua Sintetica'), false);
  assert.equal(serializedAudit.includes('00000001'), false);
  assert.equal(serializedAudit.includes('Bloco A'), false);

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.ok(['ERP-RUNTIME-06A', 'ERP-RUNTIME-06B'].includes(meta.runtime));
  assert.equal(meta.clienteLocal.frontendHttp, false);
  assert.ok(!meta.httpPilotEntities.includes('ClienteLocal'));
  assert.ok(CLIENTE_LOCAL_FINALIDADES.every((purpose) => purpose !== 'OBRA'));
});

test('RBAC ClienteLocal separa uso, edição, lifecycle e principal', async () => {
  const appConfig = testConfig();
  const db = createDbClient(appConfig);
  const { app } = createApp({
    config: appConfig,
    db,
    useMemory: true,
    tenantGuard: tenantGuard(),
    rbacGuard: rbacGuard(),
  });
  const cliente = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: '529.982.247-25',
      nome: 'Cliente RBAC Local',
    }),
  });
  const base = `/api/v1/clientes/${cliente.data.id}/locais`;
  const local = await fetchOk(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload()),
  });
  const viewHeaders = groupHeaders(ACTOR_VIEW);
  assert.equal((await fetchStatus(app, base, { headers: viewHeaders })).statusCode, 200);
  assert.equal((await fetchStatus(app, base, {
    method: 'POST', headers: viewHeaders, body: JSON.stringify(localPayload({ cep: '00000009' })),
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, `${base}/${local.data.id}`, {
    method: 'PATCH', headers: viewHeaders, body: JSON.stringify({ nome: 'Negado' }),
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, `${base}/${local.data.id}`, {
    method: 'DELETE', headers: viewHeaders,
  })).statusCode, 403);

  const noPrimary = groupHeaders(ACTOR_NO_PRIMARY);
  assert.equal((await fetchStatus(app, `${base}/${local.data.id}/finalidades`, {
    method: 'PUT',
    headers: noPrimary,
    body: JSON.stringify({
      finalidades: [{ finalidade: 'CADASTRAL', principal: false }],
    }),
  })).statusCode, 403);

  await fetchOk(app, `${base}/${local.data.id}/finalidades`, {
    method: 'PUT',
    headers: groupHeaders(),
    body: JSON.stringify({
      finalidades: [{ finalidade: 'CADASTRAL', principal: false }],
    }),
  });
  await fetchOk(app, `${base}/${local.data.id}`, {
    method: 'DELETE',
    headers: groupHeaders(),
  });
  assert.equal((await fetchStatus(app, `${base}/${local.data.id}/restore`, {
    method: 'POST', headers: viewHeaders,
  })).statusCode, 403);

  const noActor = await fetchStatus(app, base, {
    headers: { 'x-group-id': GROUP_A },
  });
  assert.equal(noActor.statusCode, 403);
  const massAssignment = await fetchStatus(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({ ...localPayload({ cep: '00000008' }), group_id: GROUP_B }),
  });
  assert.equal(massAssignment.statusCode, 400);
});

async function fetchStatus(
  app: ReturnType<typeof createApp>['app'],
  path: string,
  init: RequestInit = {},
) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to bind server');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    const text = await response.text();
    return { statusCode: response.status, body: text ? JSON.parse(text) : null };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function fetchOk(
  app: ReturnType<typeof createApp>['app'],
  path: string,
  init: RequestInit = {},
) {
  const response = await fetchStatus(app, path, init);
  assert.ok(
    response.statusCode >= 200 && response.statusCode < 300,
    JSON.stringify(response.body),
  );
  return response.body;
}
