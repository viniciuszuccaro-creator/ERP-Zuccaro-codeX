import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { loadConfig } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createDbClient } from '../src/db/client.ts';
import { isValidCnpj, isValidCpf, maskDocumento, normalizeDocumento } from '../src/db/documentoValidators.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { listMigrationFiles } from '../src/db/migrate.ts';
import { createInMemoryClienteRepo } from '../src/repositories/inMemoryClienteRepository.ts';
import { CLIENTE_FORBIDDEN_FIELDS, CLIENTE_RBAC_KEYS } from '../src/repositories/clienteTypes.ts';
import { ClienteService } from '../src/services/clienteService.ts';

const GROUP_A = '11111111-1111-4111-8111-111111111111';
const GROUP_B = '22222222-2222-4222-8222-222222222222';
const EMPRESA_A = '33333333-3333-4333-8333-333333333333';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const ACTOR_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTOR_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const ACTOR_LIMITED = 'cccccccc-3333-4333-8333-cccccccccccc';
const ACTOR_CREATE_ONLY = 'dddddddd-4444-4444-8444-dddddddddddd';
const ALL_CLIENTE_ACTIONS = [
  'visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'importar', 'exportar',
];
const __dirname = dirname(fileURLToPath(import.meta.url));
const migration009 = readFileSync(
  join(__dirname, '../migrations/009_clientes_master_data.sql'),
  'utf8',
);

/** Documentos sintéticos válidos (nunca reais). */
const CPF_A = '529.982.247-25';
const CPF_A_NORM = '52998224725';
const CPF_B = '390.533.447-05';
const CNPJ_A = '11.222.333/0001-81';
const CNPJ_A_NORM = '11222333000181';
const CNPJ_B = '34.028.316/0001-03';
const CNPJ_C = '00.000.000/0001-91';

function linkedGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(EMPRESA_A, GROUP_A);
  guard.link(EMPRESA_B, GROUP_B);
  return guard;
}

function linkedRbacGuard() {
  const guard = new InMemoryRbacGuard();
  guard.link({
    actorId: ACTOR_A,
    groupId: GROUP_A,
    permissions: {
      Cadastros: { cliente: ALL_CLIENTE_ACTIONS, cliente_empresa: ['criar'] },
    },
  });
  guard.link({
    actorId: ACTOR_B,
    groupId: GROUP_B,
    permissions: {
      Cadastros: { cliente: ALL_CLIENTE_ACTIONS, cliente_empresa: ['criar'] },
    },
  });
  guard.link({
    actorId: ACTOR_LIMITED,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente: ['visualizar'] } },
  });
  guard.link({
    actorId: ACTOR_CREATE_ONLY,
    groupId: GROUP_A,
    permissions: { Cadastros: { cliente: ['criar'] } },
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

function makeService(audit = new InMemoryAuditRepository()) {
  return {
    service: new ClienteService(
      createInMemoryClienteRepo(),
      audit,
      linkedGuard(),
      linkedRbacGuard(),
    ),
    audit,
  };
}

test('runtime-04 migration 009 exists after 001-008', () => {
  const files = listMigrationFiles();
  assert.ok(files.includes('009_clientes_master_data.sql'));
  assert.ok(files.indexOf('009_clientes_master_data.sql') > files.indexOf('008_produtos_fk_tenant.sql'));
  assert.ok(files.includes('001_foundation.sql'));
});

test('migration 009 protege cliente_empresas no banco contra FKs cross-group', () => {
  assert.match(migration009, /CREATE OR REPLACE FUNCTION assert_cliente_empresa_same_tenant/);
  assert.match(
    migration009,
    /FROM clientes c[\s\S]*c\.id = NEW\.cliente_id[\s\S]*c\.group_id = NEW\.group_id/,
  );
  assert.match(
    migration009,
    /FROM empresas e[\s\S]*e\.id = NEW\.empresa_id[\s\S]*e\.group_id = NEW\.group_id/,
  );
  assert.match(
    migration009,
    /BEFORE INSERT OR UPDATE OF group_id, cliente_id, empresa_id ON cliente_empresas/,
  );
  assert.match(migration009, /RAISE EXCEPTION 'TENANT_FK_MISMATCH: cliente_id/);
  assert.match(migration009, /RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa_id/);
});

test('migration 009 mantém RLS fail-closed e sequence sem acesso PUBLIC', () => {
  for (const table of ['clientes', 'cliente_empresas', 'entity_code_sequences']) {
    assert.match(migration009, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration009, new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(migration009, /CREATE\s+POLICY/i);
  assert.match(migration009, /REVOKE ALL ON TABLE entity_code_sequences FROM PUBLIC/);
  assert.match(
    migration009,
    /REVOKE ALL ON FUNCTION reserve_entity_codigo\(UUID, TEXT, INT\) FROM PUBLIC/,
  );
  assert.doesNotMatch(
    migration009.match(/CREATE OR REPLACE FUNCTION reserve_entity_codigo[\s\S]*?\$\$;/)?.[0] ?? '',
    /SECURITY DEFINER/i,
  );
});

test('migration 009 reserva código atomicamente e particiona sequência por grupo', () => {
  assert.match(
    migration009,
    /PRIMARY KEY \(group_id, entity_name\)/,
  );
  assert.match(
    migration009,
    /ON CONFLICT \(group_id, entity_name\) DO UPDATE[\s\S]*next_value = entity_code_sequences\.next_value \+ 1/,
  );
  assert.doesNotMatch(migration009, /count\s*\(\s*\*\s*\)\s*\+\s*1/i);
});

test('PostgreSQL: migration 009 bloqueia cross-group, RLS e sequência cross-tenant', async () => {
  const db = new PGlite();
  try {
    const migrationDir = join(__dirname, '../migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => /^\d{3}_.*\.sql$/.test(file))
      .sort();
    for (const file of files) {
      // PGlite já fornece gen_random_uuid; o pacote não distribui pgcrypto.
      const sql = readFileSync(join(migrationDir, file), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, '');
      await db.exec(sql);
    }

    await db.exec(`
      INSERT INTO groups (id, nome_do_grupo) VALUES
        ('${GROUP_A}', 'Grupo A'),
        ('${GROUP_B}', 'Grupo B');
      INSERT INTO empresas (id, group_id, razao_social) VALUES
        ('${EMPRESA_A}', '${GROUP_A}', 'Empresa A'),
        ('${EMPRESA_B}', '${GROUP_B}', 'Empresa B');
      INSERT INTO clientes (
        id, group_id, empresa_id, codigo, tipo, documento_normalizado, nome
      ) VALUES (
        '99999999-1111-4111-8111-999999999999',
        '${GROUP_A}',
        '${EMPRESA_A}',
        '000001',
        'Pessoa Física',
        '52998224725',
        'Cliente A'
      );
    `);

    // Cliente A + Grupo A + Empresa A: permitido.
    await db.exec(`
      INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id)
      VALUES (
        '${GROUP_A}',
        '99999999-1111-4111-8111-999999999999',
        '${EMPRESA_A}'
      );
    `);

    // Cliente A não pode ser relacionado como se pertencesse ao Grupo B.
    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id)
        VALUES (
          '${GROUP_B}',
          '99999999-1111-4111-8111-999999999999',
          '${EMPRESA_B}'
        );
      `),
      /TENANT_FK_MISMATCH: cliente_id/,
    );

    // Empresa B não pode ser relacionada no Grupo A.
    await assert.rejects(
      () => db.exec(`
        INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id)
        VALUES (
          '${GROUP_A}',
          '99999999-1111-4111-8111-999999999999',
          '${EMPRESA_B}'
        );
      `),
      /TENANT_FK_MISMATCH: empresa_id/,
    );

    // Sequências independentes e chamadas concorrentes sem repetição.
    const [seqA1, seqA2] = await Promise.all([
      db.query<{ codigo: string }>(
        `SELECT reserve_entity_codigo('${GROUP_A}', 'Cliente', 6) AS codigo`,
      ),
      db.query<{ codigo: string }>(
        `SELECT reserve_entity_codigo('${GROUP_A}', 'Cliente', 6) AS codigo`,
      ),
    ]);
    const seqB1 = await db.query<{ codigo: string }>(
      `SELECT reserve_entity_codigo('${GROUP_B}', 'Cliente', 6) AS codigo`,
    );
    assert.deepEqual(
      [seqA1.rows[0].codigo, seqA2.rows[0].codigo].sort(),
      ['000001', '000002'],
    );
    assert.equal(seqB1.rows[0].codigo, '000001');

    // Role comum: sem policies, todas as tabelas ficam fail-closed.
    await db.exec(`
      CREATE ROLE runtime04_probe NOLOGIN;
      GRANT USAGE ON SCHEMA public TO runtime04_probe;
      GRANT SELECT, INSERT, UPDATE ON clientes, cliente_empresas, entity_code_sequences
        TO runtime04_probe;
      SET ROLE runtime04_probe;
    `);
    const hiddenClientes = await db.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM clientes',
    );
    const hiddenLinks = await db.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM cliente_empresas',
    );
    const hiddenSequences = await db.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM entity_code_sequences',
    );
    assert.equal(hiddenClientes.rows[0].total, 0);
    assert.equal(hiddenLinks.rows[0].total, 0);
    assert.equal(hiddenSequences.rows[0].total, 0);
    const blockedUpdate = await db.query(
      `UPDATE clientes SET ativo = false WHERE group_id = '${GROUP_A}'`,
    );
    assert.equal(blockedUpdate.affectedRows, 0);
    await assert.rejects(
      () => db.query(
        `SELECT reserve_entity_codigo('${GROUP_B}', 'Cliente', 6) AS codigo`,
      ),
      /permission denied/i,
    );
    await db.exec('RESET ROLE;');
  } finally {
    await db.close();
  }
});

test('documento validators normalize and validate CPF/CNPJ', () => {
  assert.equal(normalizeDocumento(CNPJ_A), CNPJ_A_NORM);
  assert.equal(normalizeDocumento(CPF_A), CPF_A_NORM);
  assert.equal(isValidCpf(CPF_A), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCnpj(CNPJ_A), true);
  assert.equal(isValidCnpj('11.111.111/1111-11'), false);
  assert.ok(String(maskDocumento(CPF_A)).includes('**'));
  assert.ok(CLIENTE_RBAC_KEYS.includes('cadastros.cliente.visualizar'));
  assert.ok(CLIENTE_FORBIDDEN_FIELDS.includes('limite_credito'));
});

test('AUDIT: Cliente create/update/soft_delete/restore + documento mascarado', async () => {
  const { service, audit } = makeService();
  const ctx = {
    requestId: 'c-audit-1',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorId: ACTOR_A,
    actorEmail: 'cliente@example.com',
  };

  const created = await service.create(ctx, {
    tipo: 'Pessoa Jurídica',
    documento: CNPJ_A,
    razao_social: 'CLIENTE API TESTE LTDA',
    nome_fantasia: 'Cliente API',
  });
  assert.equal(created.documento_normalizado, CNPJ_A_NORM);
  assert.equal(created.codigo, '000001');

  const updated = await service.update(ctx, created.id, {
    razao_social: 'CLIENTE API TESTE ALTERADO LTDA',
  });
  assert.equal(updated.razao_social, 'CLIENTE API TESTE ALTERADO LTDA');

  const deleted = await service.softDelete({ ...ctx, requestId: 'c-audit-soft' }, created.id);
  assert.equal(deleted.ativo, false);

  const restored = await service.restore({ ...ctx, requestId: 'c-audit-restore' }, created.id);
  assert.equal(restored.ativo, true);
  assert.equal(restored.status, 'Ativo');

  const logs = await audit.listByEntity('Cliente', created.id);
  assert.ok(logs.some((l) => l.action === 'create'));
  assert.ok(logs.some((l) => l.action === 'update'));
  assert.ok(logs.some((l) => l.action === 'soft_delete'));
  assert.ok(logs.some((l) => l.action === 'restore'));
  const createLog = logs.find((l) => l.action === 'create');
  const after = createLog?.afterData as { documento?: string; documento_normalizado?: string };
  assert.ok(after.documento?.includes('*'));
  assert.ok(after.documento_normalizado?.includes('*'));
  assert.ok(logs.every((l) => l.actorEmail === 'cliente@example.com'));
});

test('duplicidade CPF/CNPJ formatado diferente → 409 DUPLICATE_DOCUMENT', async () => {
  const { service, audit } = makeService();
  const ctx = {
    requestId: 'dup', groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A,
  };

  await service.create(ctx, {
    tipo: 'Pessoa Jurídica',
    documento: CNPJ_A,
    razao_social: 'Primeiro PJ',
  });
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A_NORM,
      razao_social: 'Segundo PJ',
    }),
    (err: unknown) => ((err as { code?: string }).code === 'DUPLICATE_DOCUMENT'),
  );

  await service.create(ctx, {
    tipo: 'Pessoa Física',
    documento: CPF_A,
    nome: 'Primeiro PF',
  });
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Física',
      documento: CPF_A_NORM,
      nome: 'Segundo PF',
    }),
    (err: unknown) => ((err as { code?: string }).code === 'DUPLICATE_DOCUMENT'),
  );

  const dupLogs = audit.entries.filter((e) => e.action === 'duplicate_block');
  assert.ok(dupLogs.length >= 2);

  // mesmo documento em outro tenant permitido
  const other = await service.create(
    {
      requestId: 'dup-b', groupId: GROUP_B, empresaId: EMPRESA_B, actorId: ACTOR_B,
    },
    { tipo: 'Pessoa Jurídica', documento: CNPJ_A, razao_social: 'PJ Outro Grupo' },
  );
  assert.equal(other.documento_normalizado, CNPJ_A_NORM);
});

test('update revalida CPF/CNPJ e bloqueia duplicidade sem expor documento', async () => {
  const { service, audit } = makeService();
  const ctx = {
    requestId: 'doc-update',
    groupId: GROUP_A,
    empresaId: EMPRESA_A,
    actorId: ACTOR_A,
  };
  const first = await service.create(ctx, {
    tipo: 'Pessoa Física',
    documento: CPF_A,
    nome: 'CPF A',
  });
  const second = await service.create(ctx, {
    tipo: 'Pessoa Física',
    documento: CPF_B,
    nome: 'CPF B',
  });

  await assert.rejects(
    () => service.update(ctx, second.id, { documento: '123.456.789-00' }),
    (err: unknown) => {
      const appError = err as { code?: string; message?: string };
      assert.equal(appError.code, 'VALIDATION_ERROR');
      assert.equal(appError.message?.includes('12345678900'), false);
      return true;
    },
  );
  await assert.rejects(
    () => service.update(ctx, second.id, { documento: CPF_A_NORM }),
    (err: unknown) => ((err as { code?: string }).code === 'DUPLICATE_DOCUMENT'),
  );

  const logs = await audit.listByEntity('Cliente', first.id);
  const duplicate = logs.find((entry) => entry.action === 'duplicate_block');
  assert.ok(duplicate);
  assert.equal(JSON.stringify(duplicate).includes(CPF_A_NORM), false);
});

test('código sequencial concorrente gera códigos distintos', async () => {
  const { service } = makeService();
  const ctx = {
    requestId: 'conc', groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A,
  };
  const [a, b] = await Promise.all([
    service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_B,
      razao_social: 'Conc A',
    }),
    service.create(ctx, {
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_C,
      razao_social: 'Conc B',
    }),
  ]);
  assert.notEqual(a.codigo, b.codigo);
  assert.notEqual(a.id, b.id);
  const codes = [a.codigo, b.codigo].sort();
  assert.deepEqual(codes, ['000001', '000002']);
});

test('sequência é independente por grupo e não reutiliza código inativado', async () => {
  const { service } = makeService();
  const ctxA = {
    requestId: 'seq-a', groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A,
  };
  const ctxB = {
    requestId: 'seq-b', groupId: GROUP_B, empresaId: EMPRESA_B, actorId: ACTOR_B,
  };
  const a1 = await service.create(ctxA, {
    tipo: 'Pessoa Jurídica', documento: CNPJ_A, razao_social: 'SEQ A1',
  });
  const b1 = await service.create(ctxB, {
    tipo: 'Pessoa Jurídica', documento: CNPJ_A, razao_social: 'SEQ B1',
  });
  assert.equal(a1.codigo, '000001');
  assert.equal(b1.codigo, '000001');

  await service.softDelete(ctxA, a1.id);
  const a2 = await service.create(ctxA, {
    tipo: 'Pessoa Física', documento: CPF_A, nome: 'SEQ A2',
  });
  assert.equal(a2.codigo, '000002');
});

test('Cliente rejeita campos operacionais de crédito/preço', async () => {
  const { service } = makeService();
  const ctx = {
    requestId: 'op', groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR_A,
  };
  await assert.rejects(
    () => service.create(ctx, {
      tipo: 'Pessoa Física',
      documento: CPF_B,
      nome: 'X',
      limite_credito: 1000,
    } as never),
    (err: unknown) => ((err as { code?: string }).code === 'OPERATIONAL_FIELD_FORBIDDEN'),
  );
});

test('RBAC backend combina permissão granular com tenant fail-closed', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    rbacGuard: linkedRbacGuard(),
  });
  const adminA = {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
    'x-actor-id': ACTOR_A,
  };

  // Autorizado cria e visualiza.
  const created = await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: adminA,
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A,
      razao_social: 'RBAC CLIENTE A',
    }),
  });
  const viewAllowed = await fetchStatus(app, `/api/v1/clientes/${created.data.id}`, {
    headers: adminA,
  });
  assert.equal(viewAllowed.statusCode, 200);

  // Tenant correto + permissão visualizar ausente.
  const noView = await fetchStatus(app, '/api/v1/clientes', {
    headers: {
      'x-group-id': GROUP_A,
      'x-empresa-id': EMPRESA_A,
      'x-actor-id': ACTOR_CREATE_ONLY,
    },
  });
  assert.equal(noView.statusCode, 403);
  assert.equal(noView.body.error.code, 'PERMISSION_DENIED');

  // Visualizar não concede criar/editar/inativar/restaurar.
  const limitedHeaders = {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
    'x-actor-id': ACTOR_LIMITED,
  };
  const listAllowed = await fetchStatus(app, '/api/v1/clientes', { headers: limitedHeaders });
  assert.equal(listAllowed.statusCode, 200);

  const noCreate = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: limitedHeaders,
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: CPF_A,
      nome: 'SEM CRIAR',
    }),
  });
  assert.equal(noCreate.statusCode, 403);

  const noEdit = await fetchStatus(app, `/api/v1/clientes/${created.data.id}`, {
    method: 'PATCH',
    headers: limitedHeaders,
    body: JSON.stringify({ nome_fantasia: 'SEM EDITAR' }),
  });
  assert.equal(noEdit.statusCode, 403);

  const noInactivate = await fetchStatus(app, `/api/v1/clientes/${created.data.id}`, {
    method: 'DELETE',
    headers: limitedHeaders,
  });
  assert.equal(noInactivate.statusCode, 403);

  await fetchOk(app, `/api/v1/clientes/${created.data.id}`, {
    method: 'DELETE',
    headers: adminA,
  });
  const noRestore = await fetchStatus(app, `/api/v1/clientes/${created.data.id}/restore`, {
    method: 'POST',
    headers: limitedHeaders,
  });
  assert.equal(noRestore.statusCode, 403);

  // Permissão correta + tenant errado: actor B não obtém Cliente A.
  const wrongTenant = await fetchStatus(app, `/api/v1/clientes/${created.data.id}`, {
    headers: {
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
      'x-actor-id': ACTOR_B,
    },
  });
  assert.equal(wrongTenant.statusCode, 404);

  // Actor A não pode adulterar o groupId para Grupo B, mesmo com ações completas.
  const tamperedTenant = await fetchStatus(app, '/api/v1/clientes', {
    headers: {
      'x-group-id': GROUP_B,
      'x-empresa-id': EMPRESA_B,
      'x-actor-id': ACTOR_A,
    },
  });
  assert.equal(tamperedTenant.statusCode, 403);
});

test('API Cliente isolation + pagination + search + soft delete + restore', async () => {
  const config = testConfig();
  const db = createDbClient(config);
  const { app } = createApp({
    config,
    db,
    useMemory: true,
    tenantGuard: linkedGuard(),
    rbacGuard: linkedRbacGuard(),
  });

  const headersA = {
    'content-type': 'application/json',
    'x-group-id': GROUP_A,
    'x-empresa-id': EMPRESA_A,
    'x-actor-id': ACTOR_A,
  };
  const headersB = {
    'content-type': 'application/json',
    'x-group-id': GROUP_B,
    'x-empresa-id': EMPRESA_B,
    'x-actor-id': ACTOR_B,
  };

  // Paginação: 3 no A + 1 no B
  const docsA = [
    { tipo: 'Pessoa Jurídica', documento: '11.222.333/0001-81', razao_social: 'CLIENTE PAG A0' },
    { tipo: 'Pessoa Física', documento: '529.982.247-25', nome: 'CLIENTE PAG A1' },
    { tipo: 'Pessoa Física', documento: '390.533.447-05', nome: 'CLIENTE PAG A2 UNIQUE' },
  ];
  const createdA = [];
  for (const body of docsA) {
    createdA.push(await fetchOk(app, '/api/v1/clientes', {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(body),
    }));
  }
  await fetchOk(app, '/api/v1/clientes', {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_B,
      razao_social: 'CLIENTE PAG B0',
    }),
  });

  const page1 = await fetchOk(app, '/api/v1/clientes?limit=2&offset=0&order_by=codigo', {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(page1.data.length, 2);
  assert.equal(page1.meta.total, 3);
  assert.equal(page1.meta.hasMore, true);
  assert.equal(page1.data[0].codigo, '000001');
  assert.equal(page1.data[1].codigo, '000002');

  const page2 = await fetchOk(app, '/api/v1/clientes?limit=2&offset=2&order_by=codigo', {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(page2.data.length, 1);
  assert.equal(page2.data[0].codigo, '000003');

  // busca fora da página 1
  const search = await fetchOk(app, '/api/v1/clientes?search=UNIQUE', {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(search.data.length, 1);
  assert.equal(search.meta.total, 1);

  // busca por documento formatado
  const searchDoc = await fetchOk(app, `/api/v1/clientes?search=${encodeURIComponent(CNPJ_A)}`, {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(searchDoc.data.length, 1);

  // Tenant B não vê A
  const listB = await fetchOk(app, '/api/v1/clientes', {
    headers: { 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_B },
  });
  assert.equal(listB.data.length, 1);
  assert.equal(listB.data.every((c: { group_id: string }) => c.group_id === GROUP_B), true);

  const idA = createdA[0].data.id;
  const getCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    headers: { 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_B },
  });
  assert.equal(getCross.statusCode, 404);

  const patchCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    method: 'PATCH',
    headers: headersB,
    body: JSON.stringify({ nome_fantasia: 'hack' }),
  });
  assert.equal(patchCross.statusCode, 404);

  const delCross = await fetchStatus(app, `/api/v1/clientes/${idA}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_B, 'x-actor-id': ACTOR_B },
  });
  assert.equal(delCross.statusCode, 404);

  // empresa cruzada no create
  const crossEmpresa = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A,
    },
    body: JSON.stringify({
      tipo: 'Pessoa Física',
      documento: '111.444.777-35',
      nome: 'Cross',
      empresa_id: EMPRESA_B,
    }),
  });
  assert.equal(crossEmpresa.statusCode, 409);
  assert.equal(crossEmpresa.body.error.code, 'TENANT_MISMATCH');

  // Soft delete + restore
  const doomed = createdA[2].data;
  await fetchOk(app, `/api/v1/clientes/${doomed.id}`, {
    method: 'DELETE',
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  const afterList = await fetchOk(app, '/api/v1/clientes?limit=50', {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(afterList.data.some((c: { id: string }) => c.id === doomed.id), false);
  assert.equal(afterList.meta.total, 2);

  const getGone = await fetchStatus(app, `/api/v1/clientes/${doomed.id}`, {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(getGone.statusCode, 404);

  const restored = await fetchOk(app, `/api/v1/clientes/${doomed.id}/restore`, {
    method: 'POST',
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(restored.data.ativo, true);

  const afterRestore = await fetchOk(app, '/api/v1/clientes?search=UNIQUE', {
    headers: { 'x-group-id': GROUP_A, 'x-actor-id': ACTOR_A },
  });
  assert.equal(afterRestore.data.length, 1);

  // duplicidade HTTP
  const dupHttp = await fetchStatus(app, '/api/v1/clientes', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      tipo: 'Pessoa Jurídica',
      documento: CNPJ_A_NORM,
      razao_social: 'Dup HTTP',
    }),
  });
  assert.equal(dupHttp.statusCode, 409);
  assert.equal(dupHttp.body.error.code, 'DUPLICATE_DOCUMENT');

  const meta = await fetchOk(app, '/api/v1/meta');
  assert.ok(['ERP-RUNTIME-04', 'ERP-RUNTIME-05', 'ERP-RUNTIME-06A'].includes(meta.runtime));
  assert.equal(meta.cliente.frontendHttp, false);
  assert.ok(meta.preparedEntities.includes('Cliente'));
  assert.ok(!meta.httpPilotEntities.includes('Cliente'));
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
