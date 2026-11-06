import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import type { QueryResultRow } from 'pg';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient, type DbQueryExecutor } from '../src/db/client.ts';
import { inspectMigrationStatus, listMigrationFiles } from '../src/db/migrate.ts';
import { InMemoryRbacGuard, type RbacAction } from '../src/db/rbacGuard.ts';

const GROUP = '11111111-1111-4111-8111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const ctx = { groupId: GROUP, empresaId: COMPANY, actorId: ACTOR, requestId: 'synthetic-infra' };
const actions: RbacAction[] = ['conferir', 'entregar', 'ocorrencia', 'expedir', 'conciliar', 'estornar', 'usar', 'revogar', 'rotacionar'];

test('Infra: granular action union preserves remote actions without granting privileges', async () => {
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ACTOR, groupId: GROUP, empresaId: COMPANY, permissions: { Infra: { isolated: ['editar', 'cancelar'] } } });
  for (const action of actions) await assert.rejects(rbac.assertAllowed(ctx, 'Infra', 'isolated', action), { code: 'PERMISSION_DENIED' });
  for (const granted of actions) {
    rbac.link({ actorId: ACTOR, groupId: GROUP, empresaId: COMPANY, permissions: { Infra: { isolated: [granted] } } });
    for (const action of actions) {
      if (action === granted) await rbac.assertAllowed(ctx, 'Infra', 'isolated', action);
      else await assert.rejects(rbac.assertAllowed(ctx, 'Infra', 'isolated', action), { code: 'PERMISSION_DENIED' });
    }
    await assert.rejects(rbac.assertAllowed({ ...ctx, groupId: COMPANY }, 'Infra', 'isolated', granted), { code: 'PERMISSION_DENIED' });
    await assert.rejects(rbac.assertAllowed({ ...ctx, empresaId: GROUP }, 'Infra', 'isolated', granted), { code: 'PERMISSION_DENIED' });
  }
});

test('Infra: migration catalogue retains the complete remote set without adopting pending packages', () => {
  const files = listMigrationFiles();
  assert.equal(files.length, 33);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(files, [...files].sort());
  assert.deepEqual(files.slice(-9), [
    '036_expedicao_entregas_romaneios.sql', '037_expedicao_estoque_movimentos.sql',
    '038_cadastros_codigo_registro.sql', '039_orcamentos_tabela_preco.sql',
    '040_crm_oportunidades.sql', '041_produto_empresas_operacao.sql',
    '042_auth_bootstrap_select.sql', '043_legado_identidade_compartilhada.sql',
    '044_pedidos_idempotencia_direta.sql',
  ]);
  assert.equal(files.some(file => /^(045|046|047|048|049)_/.test(file)), false);
});

// Only SELECT expressions execute in this in-memory adapter; no migrations or DDL.
test('Infra: readonly journal uses complete filenames and rejects unknown, duplicate or inaccessible evidence', async () => {
  const pg = new PGlite();
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' }));
  const files = ['045_cadastro_bulk_ledger.sql', '045_crm_interacoes.sql'];
  const events: string[] = [];
  let rows: { id: string | null }[] = [];
  let denied = false;
  const q: DbQueryExecutor = {
    query: async <T extends QueryResultRow>(sql: string) => {
      events.push(sql);
      if (sql.startsWith('SET ')) return { rows: [], rowCount: 0, command: 'SET', oid: 0, fields: [] };
      assert.equal(sql, 'SELECT id FROM schema_migrations ORDER BY id');
      if (denied) throw new Error('SYNTHETIC_SOURCE_UNAVAILABLE');
      const result = await pg.query<T>("SELECT value->>'id' AS id FROM jsonb_array_elements($1::jsonb)", [JSON.stringify(rows)]);
      return { rows: result.rows, rowCount: result.rows.length, command: 'SELECT', oid: 0, fields: [] };
    },
  };
  db.withTransaction = async fn => fn(q);
  try {
    rows = [{ id: files[0] }];
    assert.deepEqual(await inspectMigrationStatus(db, files), { files, applied: [files[0]], pending: [files[1]] });
    assert.deepEqual(events.slice(0, 2), ['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY', 'SET LOCAL row_security = off']);
    for (const invalid of [[{ id: files[0] }, { id: files[0] }], [{ id: '050_unknown.sql' }], [{ id: null }], [{ id: 'invalid' }]]) {
      rows = invalid;
      await assert.rejects(inspectMigrationStatus(db, files), { message: 'MIGRATION_STATUS_UNAVAILABLE' });
    }
    denied = true;
    await assert.rejects(inspectMigrationStatus(db, files), { message: 'MIGRATION_STATUS_UNAVAILABLE' });
    assert.equal(events.some(sql => /CREATE|INSERT|UPDATE|DELETE|GRANT|ALTER/.test(sql)), false);
  } finally {
    await pg.close();
    await db.end();
  }
});

test('Infra: package composition keeps existing scripts and both parser families', () => {
  const server = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const root = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(server.scripts['crm:preflight'], 'tsx scripts/crmPreflight.ts');
  assert.equal(server.scripts['test:postgres'], 'node scripts/runPostgresTests.mjs');
  assert.equal(server.dependencies['ofx-js'], '1.1.1');
  assert.equal(server.dependencies['csv-parse'], '7.0.3');
  assert.equal(server.dependencies['@peculiar/asn1-schema'], '2.11.0');
  assert.equal(server.dependencies['@peculiar/asn1-x509'], '2.11.0');
  assert.equal(server.dependencies.asn1js, '3.1.0');
  assert.equal(server.dependencies.busboy, '1.6.0');
  assert.equal(server.devDependencies['@types/busboy'], '1.5.5');
  assert.equal(root.devDependencies['@types/leaflet'], '1.9.22');
});

test('Infra: pinned parser families load without source files or external services', async () => {
  for (const name of ['ofx-js', 'csv-parse', '@peculiar/asn1-schema', '@peculiar/asn1-x509', 'asn1js', 'busboy']) {
    const loaded = await import(name);
    assert.ok(Object.keys(loaded).length > 0);
  }
});

test('Infra: remote SQL files and the migration application function remain identical to the base', () => {
  const filename = 'server/src/db/migrate.ts';
  const before = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${filename}`], { encoding: 'utf8' });
  const after = fs.readFileSync(new URL('../src/db/migrate.ts', import.meta.url), 'utf8');
  const application = (source: string) => {
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'applyMigrations');
    assert.ok(fn);
    return fn.getText(ast).replaceAll('\r\n', '\n');
  };
  assert.equal(application(after), application(before));
  assert.equal(execFileSync('git', ['diff', '--name-only', "e36231b3a7e546aa9fd2529abb8d5edb61d8189c", '--', 'server/migrations'], { encoding: 'utf8' }).trim(), '');
});

test('Infra: lock composition keeps every preexisting resolved package version and integrity', () => {
  for (const filename of ['package-lock.json', 'server/package-lock.json']) {
    const before = JSON.parse(execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${filename}`], { encoding: 'utf8' }));
    const url = filename.startsWith('server/') ? new URL('../package-lock.json', import.meta.url) : new URL('../../package-lock.json', import.meta.url);
    const after = JSON.parse(fs.readFileSync(url, 'utf8'));
    for (const entry of Object.keys(before.packages)) {
      if (entry) assert.deepEqual(after.packages[entry], before.packages[entry], entry);
    }
  }
});
