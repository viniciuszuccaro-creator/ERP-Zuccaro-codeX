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
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A2 = '33333333-3333-4333-8333-333333333334';
const EMPRESA_A3 = '33333333-3333-4333-8333-333333333335';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_GROUP_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_GROUP_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ACTOR_EMPRESA_A = 'cccccccc-3333-4333-8333-cccccccccccc';
const ACTOR_VIEW_ONLY = 'dddddddd-4444-4444-8444-dddddddddddd';
const ACTOR_CREATE_ONLY = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
const ACTOR_CLIENT_ONLY = 'ffffffff-6666-4666-8666-ffffffffffff';
const RELATION_ACTIONS = [
  'visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'bloquear',
];
const CLIENT_ACTIONS = ['visualizar', 'criar', 'editar', 'inativar', 'restaurar'];

function tenantGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_A2, GROUP_A);
  guard.link(EMPRESA_A3, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function rbacGuard() {
  const guard = new InMemoryRbacGuard();
  guard.link({
    actorId: ACTOR_GROUP_A,
    groupId: GROUP_A,
    permissions: {
      Cadastros: { cliente: CLIENT_ACTIONS, cliente_empresa: RELATION_ACTIONS },
    },
  });
  guard.link({
    actorId: ACTOR_GROUP_B,
    groupId: GROUP_B,
    permissions: {
      Cadastros: { cliente: CLIENT_ACTIONS, cliente_empresa: RELATION_ACTIONS },
    },
  });
  guard.link({
    actorId: ACTOR_EMPRESA_A,
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    permissions: { Cadastros: { cliente_empresa: RELATION_ACTIONS } },
  });
  guard.link({
    actorId: ACTOR_VIEW_ONLY,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente_empresa: ['visualizar'] } },
  });
  guard.link({
    actorId: ACTOR_CREATE_ONLY,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente_empresa: ['criar'] } },
  });
  guard.link({
    actorId: ACTOR_CLIENT_ONLY,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente: ['criar'] } },
  });
  return guard;
}

function config() {
  return loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    PORT: '3080',
    CORS_ORIGINS: 'http://localhost:5173',
    REQUIRE_DATABASE: 'false',
  });
}

function groupHeaders(actorId = ACTOR_GROUP_A) {
  return {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-actor-id': actorId,
  };
}

test('PostgreSQL: migration 010 é convergente, íntegra, única e RLS', async () => {
  const db = new PGlite();
  try {
    const migrationDir = join(__dirname, '../migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => /^\d{3}_.*\.sql$/.test(file))
      .sort();
    assert.ok(files.includes('010_cliente_empresas_comercial.sql'));
    for (const file of files) {
      const sql = readFileSync(join(migrationDir, file), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, '');
      await db.exec(sql);
    }
    // Convergência fora do migrator: segunda execução também é segura.
    await db.exec(readFileSync(
      join(migrationDir, '010_cliente_empresas_comercial.sql'),
      'utf8',
    ));

    const seed = readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8');
    await db.exec(seed);
    await db.exec(seed);

    const linksA = await db.query<{ total: number }>(`
      SELECT count(*)::int AS total
      FROM cliente_empresas
      WHERE cliente_id = '${SEED_IDS.clientePjA}'
        AND group_id = '${SEED_IDS.groupA}'
    `);
    assert.equal(linksA.rows[0].total, 2);
    const a2 = await db.query<{ bloqueado: boolean; motivo_bloqueio: string }>(`
      SELECT bloqueado, motivo_bloqueio
      FROM cliente_empresas
      WHERE cliente_id = '${SEED_IDS.clientePjA}'
        AND empresa_id = '${SEED_IDS.empresaA2}'
    `);
    assert.equal(a2.rows[0].bloqueado, true);
    assert.equal(a2.rows[0].motivo_bloqueio, 'Bloqueio sintetico para E2E');

    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id)
        VALUES ('${SEED_IDS.groupB}', '${SEED_IDS.clientePjA}', '${SEED_IDS.empresaB}')
      `),
      /TENANT_FK_MISMATCH: cliente_id/,
    );
    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id)
        VALUES ('${SEED_IDS.groupA}', '${SEED_IDS.clientePjA}', '${SEED_IDS.empresaA}')
      `),
      /unique|duplicate/i,
    );
    await assert.rejects(
      () => db.exec(`
        UPDATE cliente_empresas
        SET bloqueado=true, motivo_bloqueio=NULL
        WHERE cliente_id='${SEED_IDS.clientePjA}'
          AND empresa_id='${SEED_IDS.empresaA}'
      `),
      /chk_cliente_empresas_bloqueio/,
    );

    const rls = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE oid='cliente_empresas'::regclass
    `);
    assert.equal(rls.rows[0].relrowsecurity, true);
    assert.equal(rls.rows[0].relforcerowsecurity, true);

    const forbiddenColumns = await db.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='cliente_empresas'
        AND column_name IN (
          'saldo_devedor', 'limite_credito', 'limite_utilizado', 'preco_efetivo',
          'estoque', 'endereco', 'contato', 'pedido_id', 'vendedor_id',
          'tabela_preco_id', 'forma_pagamento_id'
        )
    `);
    assert.deepEqual(forbiddenColumns.rows, []);
  } finally {
    await db.close();
  }
});

test('API ClienteEmpresa: tenant, lifecycle, paginação, concorrência e auditoria', async () => {
  const appConfig = config();
  const db = createDbClient(appConfig);
  const runtime = createApp({
    config: appConfig,
    db,
    useMemory: true,
    tenantGuard: tenantGuard(),
    rbacGuard: rbacGuard(),
  });
  const { app, clienteService, auditRepo } = runtime;

  const cliente = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: '11.222.333/0001-81',
      razao_social: 'CLIENTE EMPRESA E2E',
    }),
  });
  const clienteId = cliente.data.id as string;
  const base = `/api/v1/clientes/${clienteId}/empresas`;

  const linkedA = await fetchOk(app, `${base}/${EMPRESA_A}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      observacao_comercial: 'Liberado Empresa A',
      origem: 'ERP',
    }),
  });
  assert.equal(linkedA.data.elegivel_operacao, true);

  const linkedA2 = await fetchOk(app, `${base}/${EMPRESA_A2}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({
      observacao_comercial: 'Registro fora da primeira pagina',
      origem: 'MIGRACAO',
      legacy_id: 'A2-LEGACY',
    }),
  });
  assert.equal(linkedA2.data.empresa_id, EMPRESA_A2);
  const prospectA2 = await fetchOk(app, `${base}/${EMPRESA_A2}`, {
    method: 'PATCH',
    headers: groupHeaders(),
    body: JSON.stringify({
      situacao_comercial: 'PROSPECT',
      habilitado_operacao: false,
    }),
  });
  assert.equal(prospectA2.data.elegivel_operacao, false);
  const prospectFilter = await fetchOk(app, `${base}?situacao=PROSPECT`, {
    headers: groupHeaders(),
  });
  assert.equal(prospectFilter.data.length, 1);
  assert.equal(prospectFilter.data[0].empresa_id, EMPRESA_A2);

  // Repetição sequencial e concorrente não cria segunda linha.
  const repeated = await fetchStatus(app, `${base}/${EMPRESA_A}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: '{}',
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.body.data.id, linkedA.data.id);

  const ctx = {
    requestId: 'concurrent-link',
    groupId: GROUP_A,
    actorId: ACTOR_GROUP_A,
    scopeType: 'grupo' as const,
  };
  const [concurrentA, concurrentB] = await Promise.all([
    clienteService.createEmpresaLink(ctx, clienteId, EMPRESA_A3, {}),
    clienteService.createEmpresaLink(ctx, clienteId, EMPRESA_A3, {}),
  ]);
  assert.equal(concurrentA.row.id, concurrentB.row.id);
  assert.equal([concurrentA.created, concurrentB.created].filter(Boolean).length, 1);

  const page1 = await fetchOk(app, `${base}?limit=1&offset=0&order_by=empresa`, {
    headers: groupHeaders(),
  });
  const page2 = await fetchOk(app, `${base}?limit=1&offset=1&order_by=empresa`, {
    headers: groupHeaders(),
  });
  assert.equal(page1.data.length, 1);
  assert.equal(page1.meta.total, 3);
  assert.equal(page1.meta.hasMore, true);
  assert.equal(page2.data.length, 1);
  assert.equal(page1.data[0].empresa_id, EMPRESA_A);
  assert.equal(page2.data[0].empresa_id, EMPRESA_A2);

  const searched = await fetchOk(
    app,
    `${base}?search=${encodeURIComponent('fora da primeira pagina')}`,
    { headers: groupHeaders() },
  );
  assert.equal(searched.data.length, 1);
  assert.equal(searched.data[0].empresa_id, EMPRESA_A2);

  const updated = await fetchOk(app, `${base}/${EMPRESA_A}`, {
    method: 'PATCH',
    headers: groupHeaders(),
    body: JSON.stringify({ observacao_comercial: 'Atualizado' }),
  });
  assert.equal(updated.data.observacao_comercial, 'Atualizado');

  const blocked = await fetchOk(app, `${base}/${EMPRESA_A}/block`, {
    method: 'POST',
    headers: groupHeaders(),
    body: JSON.stringify({ motivo: 'Bloqueio comercial de teste' }),
  });
  assert.equal(blocked.data.bloqueado, true);
  assert.equal(blocked.data.elegivel_operacao, false);

  const blockedFilter = await fetchOk(app, `${base}?bloqueado=true`, {
    headers: groupHeaders(),
  });
  assert.equal(blockedFilter.data.length, 1);

  const unblocked = await fetchOk(app, `${base}/${EMPRESA_A}/unblock`, {
    method: 'POST',
    headers: groupHeaders(),
  });
  assert.equal(unblocked.data.bloqueado, false);
  assert.equal(unblocked.data.elegivel_operacao, true);

  const inactive = await fetchOk(app, `${base}/${EMPRESA_A}`, {
    method: 'DELETE',
    headers: groupHeaders(),
  });
  assert.equal(inactive.data.ativo, false);
  assert.equal(inactive.data.situacao_comercial, 'INATIVO');

  const getInactive = await fetchStatus(app, `${base}/${EMPRESA_A}`, {
    headers: groupHeaders(),
  });
  assert.equal(getInactive.statusCode, 404);
  const defaultList = await fetchOk(app, base, { headers: groupHeaders() });
  assert.equal(defaultList.data.some((row: { empresa_id: string }) => row.empresa_id === EMPRESA_A), false);
  const inactiveList = await fetchOk(app, `${base}?ativo=false`, {
    headers: groupHeaders(),
  });
  assert.equal(inactiveList.data.length, 1);
  assert.equal(inactiveList.data[0].empresa_id, EMPRESA_A);

  const restored = await fetchOk(app, `${base}/${EMPRESA_A}/restore`, {
    method: 'POST',
    headers: groupHeaders(),
  });
  assert.equal(restored.data.ativo, true);
  assert.equal(restored.data.elegivel_operacao, true);

  // Empresa A enxerga somente A; não acessa A2.
  const companyHeaders = {
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
    'x-actor-id': ACTOR_EMPRESA_A,
  };
  const companyList = await fetchOk(app, base, { headers: companyHeaders });
  assert.equal(companyList.data.length, 1);
  assert.equal(companyList.data[0].empresa_id, EMPRESA_A);
  const privateA2 = await fetchStatus(app, `${base}/${EMPRESA_A2}`, {
    headers: companyHeaders,
  });
  assert.equal(privateA2.statusCode, 403);

  // Actor B autorizado no Grupo B continua sem acesso ao Cliente A.
  const crossTenant = await fetchStatus(app, `${base}/${EMPRESA_B}`, {
    headers: {
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
      'x-actor-id': ACTOR_GROUP_B,
    },
  });
  assert.equal(crossTenant.statusCode, 404);
  const tampered = await fetchStatus(app, base, {
    headers: { 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_GROUP_A },
  });
  assert.equal(tampered.statusCode, 403);

  // IDs/campos protegidos no body são rejeitados por schema strict.
  const massAssignment = await fetchStatus(app, `${base}/${EMPRESA_A}`, {
    method: 'PATCH',
    headers: groupHeaders(),
    body: JSON.stringify({ group_id: GROUP_B, bloqueado: true }),
  });
  assert.equal(massAssignment.statusCode, 400);

  const logs = await auditRepo.listByEntity('ClienteEmpresa', linkedA.data.id);
  assert.deepEqual(
    logs.map((entry) => entry.action),
    ['link', 'update', 'block', 'unblock', 'inactivate', 'restore'],
  );
  assert.equal(JSON.stringify(logs).includes('11222333000181'), false);
  assert.equal((logs.find((entry) => entry.action === 'block')?.beforeData as {
    bloqueado: boolean;
  }).bloqueado, false);
  assert.equal((logs.find((entry) => entry.action === 'block')?.afterData as {
    bloqueado: boolean;
  }).bloqueado, true);

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.ok(['ERP-RUNTIME-05', 'ERP-RUNTIME-06A', 'ERP-RUNTIME-06B'].includes(meta.runtime));
  assert.equal(meta.clienteEmpresa.frontendHttp, false);
  assert.ok(!meta.httpPilotEntities.includes('ClienteEmpresa'));
});

test('RBAC ClienteEmpresa separa visualizar, criar, editar, bloquear e lifecycle', async () => {
  const appConfig = config();
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
      nome: 'RBAC RELACIONAMENTO',
    }),
  });
  const base = `/api/v1/clientes/${cliente.data.id}/empresas`;

  const indirectLink = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: groupHeaders(ACTOR_CLIENT_ONLY),
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: '390.533.447-05',
      nome: 'SEM PERMISSAO DE VINCULO',
      empresa_id: EMPRESA_A,
    }),
  });
  assert.equal(indirectLink.statusCode, 403);

  await fetchOk(app, `${base}/${EMPRESA_A}`, {
    method: 'POST',
    headers: groupHeaders(),
    body: '{}',
  });

  const noView = await fetchStatus(app, base, {
    headers: groupHeaders(ACTOR_CREATE_ONLY),
  });
  assert.equal(noView.statusCode, 403);

  const limited = groupHeaders(ACTOR_VIEW_ONLY);
  assert.equal((await fetchStatus(app, base, { headers: limited })).statusCode, 200);
  assert.equal((await fetchStatus(app, `${base}/${EMPRESA_A2}`, {
    method: 'POST', headers: limited, body: '{}',
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, `${base}/${EMPRESA_A}`, {
    method: 'PATCH', headers: limited, body: JSON.stringify({ observacao_comercial: 'x' }),
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, `${base}/${EMPRESA_A}/block`, {
    method: 'POST', headers: limited, body: JSON.stringify({ motivo: 'Negado' }),
  })).statusCode, 403);
  assert.equal((await fetchStatus(app, `${base}/${EMPRESA_A}`, {
    method: 'DELETE', headers: limited,
  })).statusCode, 403);

  await fetchOk(app, `${base}/${EMPRESA_A}`, {
    method: 'DELETE', headers: groupHeaders(),
  });
  assert.equal((await fetchStatus(app, `${base}/${EMPRESA_A}/restore`, {
    method: 'POST', headers: limited,
  })).statusCode, 403);
});

async function fetchStatus(
  app: ReturnType<typeof createApp>['app'],
  path: string,
  init: RequestInit = {},
) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to bind test server');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    const text = await response.text();
    return {
      statusCode: response.status,
      body: text ? JSON.parse(text) : null,
    };
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
