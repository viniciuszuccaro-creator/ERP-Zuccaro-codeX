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
import { CLIENTE_LOCAL_FINALIDADES } from '../src/repositories/clienteLocalTypes.ts';
import { normalizeObraNome, obraCreateSchema, obraLocalInputSchema, obraUpdateSchema, publicObra } from '../src/repositories/obraTypes.ts';
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
const OBRA_ACTIONS = [
  'visualizar', 'criar', 'editar', 'inativar', 'restaurar',
  'vincular-empresa', 'vincular-local', 'principal',
];
const LOCAL_ACTIONS = [
  'visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'principal',
];
const CLIENT_ACTIONS = ['visualizar', 'criar'];
const RELATION_ACTIONS = ['visualizar', 'criar', 'bloquear', 'editar'];

function tenantGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_A2, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function rbacGuard() {
  const guard = new InMemoryRbacGuard();
  const cadastros = {
    cliente: CLIENT_ACTIONS,
    cliente_empresa: RELATION_ACTIONS,
    cliente_local: LOCAL_ACTIONS,
    obra: OBRA_ACTIONS,
  };
  guard.link({ actorId: ACTOR_A, groupId: GROUP_A, permissions: { Cadastros: cadastros } });
  guard.link({ actorId: ACTOR_B, groupId: GROUP_B, permissions: { Cadastros: cadastros } });
  guard.link({
    actorId: ACTOR_COMPANY_A, groupId: GROUP_A, empresaId: EMPRESA_A,
    permissions: { Cadastros: cadastros },
  });
  guard.link({
    actorId: ACTOR_COMPANY_A2, groupId: GROUP_A, empresaId: EMPRESA_A2,
    permissions: { Cadastros: cadastros },
  });
  guard.link({
    actorId: ACTOR_VIEW, groupId: GROUP_A,
    permissions: { Cadastros: { obra: ['visualizar'], cliente: ['visualizar'], cliente_local: ['visualizar'] } },
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

function groupHeaders(actorId = ACTOR_A, empresaId?: string) {
  return {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-actor-id': actorId,
    ...(empresaId ? { 'x-empresa-id': empresaId } : {}),
  };
}

function localPayload(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Local Sintetico Obra',
    cep: '00000-011',
    logradouro: 'Rua Obra Sintetica',
    numero: '10',
    bairro: 'Bairro Dev',
    cidade: 'Cidade Dev',
    uf: 'sp',
    pais: 'Brasil',
    finalidades: [{ finalidade: 'ENTREGA', principal: true }],
    ...overrides,
  };
}

test('payload Obra exige um principal e rejeita mass assignment', () => {
  const invalid = obraCreateSchema.safeParse({ nome: 'X', locais: [] });
  assert.equal(invalid.success, false);
  const twoPrincipals = obraCreateSchema.safeParse({
    nome: 'X',
    locais: [
      { cliente_local_id: SEED_IDS.clienteLocalA, uso_na_obra: 'FISICO', principal: true },
      { cliente_local_id: SEED_IDS.clienteLocalB, uso_na_obra: 'ENTREGA', principal: true },
    ],
  });
  assert.equal(twoPrincipals.success, false);
  const extra = obraCreateSchema.safeParse({
    nome: 'X',
    group_id: GROUP_A,
    codigo: '000099',
    locais: [
      { cliente_local_id: SEED_IDS.clienteLocalA, uso_na_obra: 'FISICO', principal: true },
    ],
  });
  assert.equal(extra.success, false);
  const patchExtra = obraUpdateSchema.safeParse({
    nome: 'Y',
    group_id: GROUP_A,
    cliente_id: SEED_IDS.clientePjA,
    codigo: '000002',
    empresa_id: EMPRESA_A,
    logradouro: 'Rua X',
  });
  assert.equal(patchExtra.success, false);
  assert.equal(obraLocalInputSchema.safeParse({
    cliente_local_id: SEED_IDS.clienteLocalA,
    uso_na_obra: 'FISICO',
    principal: true,
    group_id: GROUP_A,
    cep: '00000000',
  }).success, false);
  assert.equal(normalizeObraNome('  Obra   Principal A '), 'obra principal a');
  assert.equal(normalizeObraNome('OBRA PRINCIPAL A'), 'obra principal a');
  assert.ok(CLIENTE_LOCAL_FINALIDADES.every((item) => item !== 'OBRA'));
  assert.equal('logradouro' in publicObra({
    id: '1', group_id: GROUP_A, cliente_id: SEED_IDS.clientePjA, codigo: '000001',
    nome: 'N', status: 'ATIVA', observacao: null, ativo: true, origem: 'ERP',
    legacy_id: null, legacy_code: null, source_system: null, migration_batch: null,
    imported_at: null, created_by: null, updated_by: null, created_at: '', updated_at: '',
    empresas: [], locais: [],
  }), false);
});

test('PostgreSQL: migration 012 é convergente, RLS, tenant e principal único', async () => {
  const db = new PGlite();
  try {
    const migrationDir = join(__dirname, '../migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => /^\d{3}_.*\.sql$/.test(file))
      .sort();
    assert.equal(files.at(-1), '012_obras.sql');
    assert.ok(files.includes('011_cliente_locais.sql'));
    for (const file of files) {
      await db.exec(
        readFileSync(join(migrationDir, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    const migration = readFileSync(join(migrationDir, '012_obras.sql'), 'utf8');
    await db.exec(migration);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS obras/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS obra_empresas/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS obra_locais/);
    assert.doesNotMatch(migration, /logradouro|latitude|longitude|cep/);
    assert.doesNotMatch(migration, /'OBRA'/);

    const seed = readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    const obras = await db.query<{ total: number }>('SELECT count(*)::int AS total FROM obras');
    assert.equal(obras.rows[0].total, 2);

    await assert.rejects(
      () => db.exec(`
        INSERT INTO obras (group_id, cliente_id, codigo, nome)
        VALUES ('${SEED_IDS.groupB}', '${SEED_IDS.clientePjA}', '000009', 'Cross')
      `),
      /TENANT_FK_MISMATCH/,
    );
    await assert.rejects(
      () => db.exec(`
        INSERT INTO obra_locais (group_id, obra_id, cliente_local_id, uso_na_obra, principal)
        VALUES (
          '${SEED_IDS.groupA}', '${SEED_IDS.obraA}', '${SEED_IDS.clienteLocalB1}', 'ENTREGA', false
        )
      `),
      /TENANT_FK_MISMATCH/,
    );
    await assert.rejects(
      () => db.exec(`
        INSERT INTO obra_empresas (group_id, obra_id, empresa_id)
        VALUES ('${SEED_IDS.groupA}', '${SEED_IDS.obraA}', '${SEED_IDS.empresaB}')
      `),
      /TENANT_FK_MISMATCH|CLIENTE_EMPRESA_REQUIRED/,
    );
    await assert.rejects(
      () => db.exec(`
        INSERT INTO obra_locais (group_id, obra_id, cliente_local_id, uso_na_obra, principal)
        VALUES (
          '${SEED_IDS.groupA}', '${SEED_IDS.obraA}', '${SEED_IDS.clienteLocalC}', 'FISICO', true
        )
      `),
      /uq_obra_locais_principal|unique/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obras SET group_id='${SEED_IDS.groupB}'
        WHERE id='${SEED_IDS.obraA}'
      `),
      /TENANT_FK_MISMATCH|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obras SET cliente_id='${SEED_IDS.clientePjB}'
        WHERE id='${SEED_IDS.obraA}'
      `),
      /TENANT_FK_MISMATCH|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obra_empresas SET empresa_id='${SEED_IDS.empresaB}'
        WHERE obra_id='${SEED_IDS.obraA}'
      `),
      /TENANT_FK_MISMATCH|CLIENTE_EMPRESA_REQUIRED|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obra_empresas SET group_id='${SEED_IDS.groupB}'
        WHERE obra_id='${SEED_IDS.obraA}'
      `),
      /TENANT_FK_MISMATCH|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obra_locais SET cliente_local_id='${SEED_IDS.clienteLocalB1}'
        WHERE obra_id='${SEED_IDS.obraA}' AND principal=true
      `),
      /TENANT_FK_MISMATCH|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obra_locais SET group_id='${SEED_IDS.groupB}'
        WHERE obra_id='${SEED_IDS.obraA}' AND principal=true
      `),
      /TENANT_FK_MISMATCH|foreign key|violat/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE obra_locais SET principal=true, ativo=false
        WHERE obra_id='${SEED_IDS.obraA}' AND cliente_local_id='${SEED_IDS.clienteLocalB}'
      `),
      /check|principal/i,
    );

    const rls = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE oid IN ('obras'::regclass, 'obra_empresas'::regclass, 'obra_locais'::regclass)
    `);
    assert.equal(rls.rows.length, 3);
    assert.ok(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));

    await db.exec(`
      CREATE ROLE runtime06b_probe NOLOGIN;
      GRANT USAGE ON SCHEMA public TO runtime06b_probe;
      GRANT SELECT ON obras, obra_empresas, obra_locais TO runtime06b_probe;
      SET ROLE runtime06b_probe;
    `);
    assert.equal((await db.query<{ total: number }>('SELECT count(*)::int AS total FROM obras')).rows[0].total, 0);
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
});

test('API Obra cobre create atômico, tenant, RBAC, lifecycle, duplicidade e paginação', async () => {
  const appConfig = testConfig();
  const db = createDbClient(appConfig);
  const runtime = createApp({
    config: appConfig,
    db,
    useMemory: true,
    tenantGuard: tenantGuard(),
    rbacGuard: rbacGuard(),
  });
  const { app, auditRepo } = runtime;

  const cliente = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'Cliente Obra E2E',
    }),
  });
  const clienteId = cliente.data.id as string;
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A}`, {
    method: 'POST', headers: groupHeaders(), body: '{}',
  });
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A2}`, {
    method: 'POST', headers: groupHeaders(), body: '{}',
  });
  const localA = await fetchOk(app, `/api/v1/clientes/${clienteId}/locais`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({ cep: '00000011', nome: 'Local Fisico' })),
  });
  const localB = await fetchOk(app, `/api/v1/clientes/${clienteId}/locais`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({
      cep: '00000012', nome: 'Local Entrega', numero: '20', logradouro: 'Av Entrega',
    })),
  });

  const base = `/api/v1/clientes/${clienteId}/obras`;
  const company = groupHeaders(ACTOR_COMPANY_A, EMPRESA_A);
  assert.equal((await fetchStatus(app, base, {
    headers: { 'content-type': 'application/json', 'x-group-id': GROUP_A },
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, base, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      nome: 'Obra Sem Empresa',
      locais: [{ cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  })).statusCode, 400);

  const created = await fetchOk(app, base, {
    method: 'POST',
    headers: company,
    body: JSON.stringify({
      nome: 'Obra Principal A',
      observacao: 'Obs segura',
      locais: [
        { cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true },
        { cliente_local_id: localB.data.id, uso_na_obra: 'ENTREGA', principal: false },
      ],
    }),
  });
  assert.equal(created.data.codigo, '000001');
  assert.equal(created.data.status, 'ATIVA');
  assert.equal(created.data.local_principal.id, localA.data.id);
  assert.equal(created.data.empresas[0].empresa_id, EMPRESA_A);
  const empresas = await fetchOk(app, `${base}/${created.data.id}/empresas`, { headers: company });
  assert.equal(empresas.data[0].empresa_id, EMPRESA_A);
  const locais = await fetchOk(app, `${base}/${created.data.id}/locais`, { headers: company });
  assert.equal(locais.data.length, 2);
  assert.equal('cep' in created.data, false);
  assert.equal('logradouro' in created.data, false);

  assert.equal((await fetchStatus(app, base, {
    method: 'POST',
    headers: company,
    body: JSON.stringify({ nome: 'Sem local', locais: [] }),
  })).statusCode, 400);

  const duplicate = await fetchStatus(app, base, {
    method: 'POST',
    headers: company,
    body: JSON.stringify({
      nome: 'Obra Principal A',
      locais: [{ cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  });
  assert.equal(duplicate.statusCode, 409);
  const overridden = await fetchOk(app, base, {
    method: 'POST',
    headers: company,
    body: JSON.stringify({
      nome: 'Obra Principal A',
      confirm_possible_duplicate: true,
      locais: [{ cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  });
  assert.equal(overridden.data.codigo, '000002');

  const otherClient = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: '529.982.247-25',
      nome: 'Outro Cliente',
    }),
  });
  assert.equal((await fetchStatus(app, `/api/v1/clientes/${otherClient.data.id}/obras/${created.data.id}`, {
    headers: company,
  })).statusCode, 404);
  const otherLocal = await fetchOk(app, `/api/v1/clientes/${otherClient.data.id}/locais`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify(localPayload({ cep: '00000013', nome: 'Local Outro Cliente' })),
  });
  const beforeCount = await fetchOk(app, `${base}?limit=200`, { headers: company });
  assert.equal((await fetchStatus(app, base, {
    method: 'POST',
    headers: company,
    body: JSON.stringify({
      nome: 'Obra Local Cruzado',
      locais: [{ cliente_local_id: otherLocal.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  })).statusCode, 404);
  const afterCount = await fetchOk(app, `${base}?limit=200`, { headers: company });
  assert.equal(afterCount.meta.total, beforeCount.meta.total);

  const a2 = groupHeaders(ACTOR_COMPANY_A2, EMPRESA_A2);
  const histA2BeforeLink = await fetchOk(app, base, { headers: a2 });
  assert.equal(histA2BeforeLink.data.length, 0);

  await fetchOk(app, `${base}/${created.data.id}/empresas/${EMPRESA_A2}`, {
    method: 'POST', headers: groupHeaders(),
  });
  const payloadA = await fetchOk(app, `${base}/${created.data.id}`, { headers: company });
  assert.deepEqual(payloadA.data.empresas.map((row: { empresa_id: string }) => row.empresa_id), [EMPRESA_A]);
  assert.equal('cep' in (payloadA.data.local_principal ?? {}), false);
  assert.equal('logradouro' in (payloadA.data.local_principal ?? {}), false);
  const payloadGroup = await fetchOk(app, `${base}/${created.data.id}`, { headers: groupHeaders() });
  assert.ok(payloadGroup.data.empresas.some((row: { empresa_id: string }) => row.empresa_id === EMPRESA_A2));
  await fetchOk(app, `/api/v1/clientes/${clienteId}/empresas/${EMPRESA_A2}/block`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({ motivo: 'A2 bloqueada' }),
  });
  assert.equal((await fetchStatus(app, `${base}?operacional=true`, { headers: a2 })).statusCode, 403);
  assert.equal((await fetchStatus(app, base, {
    method: 'POST',
    headers: a2,
    body: JSON.stringify({
      nome: 'Obra A2 bloqueada',
      locais: [{ cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  })).statusCode, 403);
  const histAfterLink = await fetchOk(app, base, { headers: a2 });
  assert.ok(histAfterLink.data.some((row: { id: string }) => row.id === created.data.id));

  const paused = await fetchOk(app, `${base}/${created.data.id}`, {
    method: 'PATCH',
    headers: company,
    body: JSON.stringify({ status: 'PAUSADA' }),
  });
  assert.equal(paused.data.status, 'PAUSADA');
  const operacional = await fetchOk(app, `${base}?operacional=true`, { headers: company });
  assert.equal(operacional.data.some((row: { id: string }) => row.id === created.data.id), false);

  await fetchOk(app, `${base}/${created.data.id}`, {
    method: 'PATCH', headers: company, body: JSON.stringify({ status: 'ATIVA' }),
  });
  const localBMaster = await fetchStatus(app, `/api/v1/clientes/${clienteId}/locais/${localB.data.id}`, {
    method: 'DELETE', headers: groupHeaders(),
  });
  assert.equal(localBMaster.statusCode, 409);
  const localAMaster = await fetchStatus(app, `/api/v1/clientes/${clienteId}/locais/${localA.data.id}`, {
    method: 'DELETE', headers: groupHeaders(),
  });
  assert.equal(localAMaster.statusCode, 409);
  const primaryBlocked = await fetchStatus(app, `${base}/${created.data.id}/locais/${localA.data.id}`, {
    method: 'DELETE', headers: company,
  });
  assert.equal(primaryBlocked.statusCode, 409);
  const missingPrincipal = await fetchStatus(app, `${base}/${created.data.id}/locais/${SEED_IDS.clienteLocalC}/principal`, {
    method: 'POST', headers: company,
  });
  assert.equal(missingPrincipal.statusCode, 404);
  const stillA = await fetchOk(app, `${base}/${created.data.id}`, { headers: company });
  assert.equal(stillA.data.local_principal.id, localA.data.id);
  await fetchOk(app, `${base}/${created.data.id}/locais/${localB.data.id}/principal`, {
    method: 'POST', headers: company,
  });
  await fetchOk(app, `${base}/${created.data.id}/locais/${localA.data.id}`, {
    method: 'DELETE', headers: company,
  });

  const inUse = await fetchStatus(app, `/api/v1/clientes/${clienteId}/locais/${localB.data.id}`, {
    method: 'DELETE', headers: groupHeaders(),
  });
  assert.equal(inUse.statusCode, 409);

  await fetchOk(app, `${base}/${created.data.id}`, { method: 'DELETE', headers: company });
  assert.equal((await fetchStatus(app, `${base}/${created.data.id}`, { headers: company })).statusCode, 404);
  const restored = await fetchOk(app, `${base}/${created.data.id}/restore`, {
    method: 'POST', headers: company,
  });
  assert.equal(restored.data.ativo, true);
  assert.equal(restored.data.codigo, '000001');

  const restoredLocal = await fetchOk(app, `${base}/${created.data.id}/locais/${localA.data.id}/restore`, {
    method: 'POST', headers: company,
  });
  assert.equal(restoredLocal.data.locais.find((row: { cliente_local_id: string }) => row.cliente_local_id === localA.data.id).principal, false);
  assert.equal(restoredLocal.data.local_principal.id, localB.data.id);

  await fetchOk(app, `${base}/${created.data.id}/empresas/${EMPRESA_A}`, {
    method: 'DELETE', headers: groupHeaders(),
  });
  await fetchOk(app, `${base}/${created.data.id}`, { method: 'DELETE', headers: groupHeaders() });
  const inactiveHist = await fetchOk(app, `${base}?ativo=false`, { headers: groupHeaders() });
  assert.ok(inactiveHist.data.some((row: { id: string }) => row.id === created.data.id));
  const restoredIdentity = await fetchOk(app, `${base}/${created.data.id}/restore`, {
    method: 'POST', headers: groupHeaders(),
  });
  assert.equal(restoredIdentity.data.id, created.data.id);
  assert.equal(restoredIdentity.data.codigo, '000001');
  assert.equal(restoredIdentity.data.empresas.some((row: { empresa_id: string }) => row.empresa_id === EMPRESA_A), false);
  assert.equal((await fetchStatus(app, `${base}/${created.data.id}`, { headers: company })).statusCode, 404);
  const operacionalAfterRestore = await fetchOk(app, `${base}?operacional=true`, { headers: company });
  assert.equal(operacionalAfterRestore.data.some((row: { id: string }) => row.id === created.data.id), false);
  const histGroup = await fetchOk(app, `${base}/${created.data.id}`, { headers: groupHeaders() });
  assert.equal(histGroup.data.codigo, '000001');

  assert.equal((await fetchStatus(app, `${base}?operacional=true`, { headers: groupHeaders() })).statusCode, 400);

  const page = await fetchOk(app, `${base}?limit=1&offset=0&order_by=codigo`, { headers: groupHeaders() });
  assert.equal(page.meta.limit, 1);
  assert.equal(page.meta.total, 2);
  assert.equal(page.meta.hasMore, true);

  const logs = await auditRepo.listByEntity('Obra', created.data.id);
  assert.ok(logs.some((entry) => entry.action === 'create'));
  const serialized = JSON.stringify(logs);
  assert.equal(serialized.includes('Rua Obra Sintetica'), false);
  assert.equal(serialized.includes('00000011'), false);

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.equal(meta.runtime, 'ERP-RUNTIME-06B');
  assert.equal(meta.obra.frontendHttp, false);
  assert.equal(meta.obra.optionalOnPedido, true);
  assert.ok(!meta.httpPilotEntities.includes('Obra'));
  assert.ok(!meta.httpPilotEntities.includes('ClienteLocal'));

  const viewHeaders = groupHeaders(ACTOR_VIEW);
  assert.equal((await fetchStatus(app, base, { headers: viewHeaders })).statusCode, 200);
  assert.equal((await fetchStatus(app, base, {
    method: 'POST',
    headers: viewHeaders,
    body: JSON.stringify({
      nome: 'Obra Principal A',
      confirm_possible_duplicate: true,
      locais: [{ cliente_local_id: localA.data.id, uso_na_obra: 'FISICO', principal: true }],
    }),
  })).statusCode, 403);

  const cross = await fetchStatus(app, base, {
    headers: { 'content-type': 'application/json', 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_B },
  });
  assert.equal(cross.statusCode, 404);
});

test('PostgreSQL concorrência de código e principal único', async () => {
  const pg = new PGlite();
  try {
    const migrations = join(__dirname, '../migrations');
    for (const file of readdirSync(migrations).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      await pg.exec(
        readFileSync(join(migrations, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
    const codes = await Promise.all([
      pg.query<{ codigo: string }>(`SELECT reserve_entity_codigo('${SEED_IDS.groupA}', 'Obra', 6) AS codigo`),
      pg.query<{ codigo: string }>(`SELECT reserve_entity_codigo('${SEED_IDS.groupA}', 'Obra', 6) AS codigo`),
    ]);
    const values = codes.map((row) => row.rows[0].codigo);
    assert.notEqual(values[0], values[1]);
    assert.equal(new Set(values).size, 2);

    await pg.exec(`
      INSERT INTO obras (id, group_id, cliente_id, codigo, nome)
      VALUES (
        '11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01',
        '${SEED_IDS.groupA}', '${SEED_IDS.clientePjA}', '${values[0]}', 'CONC A'
      );
      INSERT INTO obra_empresas (group_id, obra_id, empresa_id)
      VALUES (
        '${SEED_IDS.groupA}', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01', '${SEED_IDS.empresaA}'
      );
      INSERT INTO obra_locais (group_id, obra_id, cliente_local_id, uso_na_obra, principal)
      VALUES (
        '${SEED_IDS.groupA}', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01',
        '${SEED_IDS.clienteLocalC}', 'FISICO', true
      ), (
        '${SEED_IDS.groupA}', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01',
        '${SEED_IDS.clienteLocalA}', 'ENTREGA', false
      );
    `);
    await Promise.allSettled([
      pg.exec(`
        BEGIN;
        SELECT id FROM obras WHERE id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01' FOR UPDATE;
        UPDATE obra_locais SET principal=false
          WHERE obra_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01' AND principal=true AND ativo=true;
        UPDATE obra_locais SET principal=true
          WHERE obra_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01'
            AND cliente_local_id='${SEED_IDS.clienteLocalA}' AND ativo=true;
        COMMIT;
      `),
      pg.exec(`
        BEGIN;
        SELECT id FROM obras WHERE id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01' FOR UPDATE;
        UPDATE obra_locais SET principal=false
          WHERE obra_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01' AND principal=true AND ativo=true;
        UPDATE obra_locais SET principal=true
          WHERE obra_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01'
            AND cliente_local_id='${SEED_IDS.clienteLocalC}' AND ativo=true;
        COMMIT;
      `),
    ]);
    const principals = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM obra_locais
      WHERE obra_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa01' AND principal=true AND ativo=true
    `);
    assert.equal(principals.rows[0].total, 1);
  } finally {
    await pg.close();
  }
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
