import { clienteConferenciaRemainder } from '../../tests/helpers/consolidation81Remainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import type { DbQueryExecutor } from '../src/db/client.ts';
import type { AuditRepository } from '../src/audit/types.ts';
import { InMemoryClienteRepository, type ClienteListFilter } from '../src/repositories/inMemoryClienteRepository.ts';
import { ClienteService } from '../src/services/clienteService.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresClienteBulkEligibility } from '../src/services/clienteBulkEligibility.ts';

const groupId = '11111111-1111-4111-8111-111111111111';
const company = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const ctx = { groupId, empresaId: null, actorId, requestId: 'synthetic-consolidation' };
const q: DbQueryExecutor = { query: async () => { throw new Error('SQL not implemented by this contract fixture'); } };

// Deliberately not a SQL/persistence proof; exercises the actual service and RBAC with synthetic rows.
class ExportFixture extends InMemoryClienteRepository {
  offsets: number[] = [];
  restored = false;
  drift = false;
  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>) { return fn(q); }
  async prepareExport(_scope: unknown, executor: DbQueryExecutor) {
    assert.equal(executor, q);
    return async () => { this.restored = true; };
  }
  async listPage(filter: ClienteListFilter, executor?: DbQueryExecutor,
    options?: { ids?: readonly string[]; exactEmpresa: true }) {
    assert.equal(executor, q); assert.equal(options?.exactEmpresa, true);
    this.offsets.push(filter.offset ?? 0);
    const all = await super.listPage({ ...filter, limit: 200, offset: 0 });
    const page = await super.listPage(filter);
    if (options?.ids) {
      const rows = all.rows.filter(row => options.ids?.includes(row.id));
      return { rows, total: rows.length };
    }
    return this.drift && (filter.offset ?? 0) > 0 ? { ...page, total: page.total + 1 } : page;
  }
}

async function fixture(count = 1) {
  const repo = new ExportFixture(), rbac = new InMemoryRbacGuard();
  const permissions = (actions: string[]) => rbac.link({ actorId, groupId, empresaId: null,
    permissions: { Cadastros: { cliente: actions } } });
  permissions(['visualizar', 'exportar']);
  // Seed repository-only rows without inventing personal documents; not a Cliente create-API test.
  for (let i = 0; i < count; i++) await repo.create(ctx, {
    tipo: 'Pessoa Física', ativo: true, status: 'Ativo', origem: 'ERP',
    nome: `SYNTHETIC_${i}`, observacoes: 'DO_NOT_EXPORT_SYNTHETIC',
  });
  let audits = 0, fail = false, revoke = false;
  const audit: AuditRepository = { listByEntity: async () => [], append: async (entry, executor) => {
    assert.equal(executor, q); assert.equal(repo.restored, true);
    assert(!JSON.stringify(entry).includes('DO_NOT_EXPORT_SYNTHETIC'));
    if (fail) throw new Error('SYNTHETIC_AUDIT_FAILURE');
    audits++; if (revoke) permissions(['visualizar']);
  } };
  const service = new ClienteService(repo, audit, { assertEmpresaInGroup: async (group, empresa, executor) => {
    assert.equal(executor, q); assert.equal(group, groupId);
    if (empresa != null) throw new Error('SYNTHETIC_COMPANY_DENIED');
  } }, rbac);
  return { service, repo, permissions, audits: () => audits,
    fail: () => { fail = true; }, revoke: () => { revoke = true; } };
}

test('bulk consolidation: real export service paginates all 201 rows, allowlists fields and audits before returning bytes', async () => {
  const f = await fixture(201);
  const result = await f.service.export(ctx, { mode: 'filtered', filters: {} });
  assert.equal(result.count, 201); assert.deepEqual(f.repo.offsets, [0, 200]);
  assert.equal(f.audits(), 1);
  assert.equal(result.sha256, createHash('sha256').update(result.bytes).digest('hex'));
  const body: unknown = JSON.parse(result.bytes.toString());
  assert(body && typeof body === 'object' && 'data' in body && Array.isArray(body.data));
  assert.equal(body.data.length, 201);
  assert(!result.bytes.toString().includes('DO_NOT_EXPORT_SYNTHETIC'));
  assert(!result.bytes.toString().includes('group_id'));
});

test('bulk consolidation: export denies missing permission, actor, cross-tenant and cross-company without bytes', async () => {
  const f = await fixture(), input = { mode: 'filtered', filters: {} };
  f.permissions(['visualizar']); await assert.rejects(f.service.export(ctx, input), { code: 'PERMISSION_DENIED' });
  f.permissions(['visualizar', 'exportar']);
  await assert.rejects(f.service.export({ ...ctx, actorId: null }, input));
  await assert.rejects(f.service.export({ ...ctx, groupId: company }, input), { code: 'PERMISSION_DENIED' });
  await assert.rejects(f.service.export({ ...ctx, empresaId: company }, input));
  assert.equal(f.audits(), 0);
});

test('bulk consolidation: export refuses audit failure, late revocation, count drift and incomplete/duplicate selections', async () => {
  for (const mode of ['audit', 'revoke', 'drift', 'missing', 'duplicate']) {
    const f = await fixture(mode === 'drift' ? 201 : 1);
    if (mode === 'audit') f.fail();
    if (mode === 'revoke') f.revoke();
    if (mode === 'drift') f.repo.drift = true;
    const ids = mode === 'duplicate' ? [actorId, actorId] : [actorId];
    await assert.rejects(f.service.export(ctx, mode === 'missing' || mode === 'duplicate'
      ? { mode: 'selected', ids, filters: {} } : { mode: 'filtered', filters: {} }));
  }
});

test('bulk consolidation: selected export preserves exact UUIDs and unavailable repository has no fallback', async () => {
  const f = await fixture(2);
  const page = await InMemoryClienteRepository.prototype.listPage.call(f.repo, { groupId, limit: 2 });
  const id = page.rows[1].id;
  const result = await f.service.export(ctx, { mode: 'selected', ids: [id], filters: {} });
  assert.equal(result.count, 1); assert(result.bytes.toString().includes(id));
  assert(!result.bytes.toString().includes(page.rows[0].id));
  const unavailable = new ClienteService(new InMemoryClienteRepository(), {
    append: async () => { throw new Error('Unexpected audit'); }, listByEntity: async () => [],
  }, { assertEmpresaInGroup: async () => { throw new Error('Unexpected tenant access'); } }, {
    assertAllowed: async () => { throw new Error('Unexpected permission access'); },
  });
  await assert.rejects(unavailable.export(ctx, { mode: 'filtered', filters: {} }), { code: 'CLIENTE_EXPORT_UNAVAILABLE' });
});

test('bulk consolidation: PostgreSQL eligibility rejects foreign/duplicate owners before any SQL', async () => {
  const guard = new PostgresClienteBulkEligibility();
  const row = { id: actorId, group_id: groupId, empresa_id: null, ativo: true };
  for (const rows of [[{ ...row, group_id: company }], [row, row]]) {
    await assert.rejects(guard.inspect(ctx, rows, q), { code: 'CLIENTE_BULK_COVERAGE_UNVERIFIED' });
  }
  await assert.rejects(guard.inspect({ ...ctx, empresaId: company }, [row], q), { code: 'CLIENTE_BULK_COVERAGE_UNVERIFIED' });
  assert.deepEqual(await guard.inspect(ctx, [], q), []);
});

test('bulk consolidation: eligibility SQL contract fails closed on references and unverified coverage without executing locks or migrations', async () => {
  const local = new PGlite();
  const relations = ['cliente_empresas', 'cliente_locais', 'cliente_local_finalidades', 'obras', 'oportunidades', 'entregas'];
  let blocked = false, incomplete = false, extraRemoteRelation = false;
  const locks: string[] = [];
  const executor: DbQueryExecutor = {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) {
      let select: string;
      let values: unknown[] = [];
      if (sql.includes('current_schema()')) {
        select = "SELECT 'synthetic'::text AS schema, 'read committed'::text AS isolation, $1::text AS group_id, NULL::text AS empresa_id, 'on'::text AS row_security";
        values = [groupId];
      } else if (sql.startsWith('LOCK TABLE')) {
        locks.push(sql); select = 'SELECT 1';
      } else if (sql.includes('AS canonical_fk')) {
        select = "SELECT 'synthetic'::text AS schema, name, 'cliente_id'::text AS column, true AS canonical_fk FROM unnest($1::text[]) AS name";
        values = [incomplete ? relations.slice(1) : extraRemoteRelation ? [...relations, 'unknown_delivery'] : relations];
      } else if (sql.includes('FROM pg_class')) {
        select = "SELECT name, 'r'::text AS kind, false AS inherited FROM unnest($1::text[]) AS name";
        values = [['clientes', ...relations]];
      } else if (sql.includes('set_config')) {
        select = 'SELECT 1';
      } else if (sql.includes('FOR UPDATE')) {
        assert.deepEqual(params, [groupId, [actorId], null]);
        select = 'SELECT $1::uuid AS id'; values = [actorId];
      } else if (sql.includes('AS unresolved')) {
        select = 'SELECT false AS unresolved';
      } else if (sql.includes('SELECT DISTINCT')) {
        assert.deepEqual(params, [[actorId]]);
        select = 'SELECT $1::text AS id WHERE $2::boolean'; values = [actorId, blocked];
      } else throw new Error('Unexpected eligibility SQL contract');
      // Only synthetic SELECT expressions execute, never the production statements above.
      const result = await local.query<T>(select, values);
      return { rows: result.rows, fields: [], rowCount: result.rows.length, command: 'SELECT', oid: 0 };
    },
  };
  try {
    const guard = new PostgresClienteBulkEligibility();
    const row = { id: actorId, group_id: groupId, empresa_id: null, ativo: true };
    assert.deepEqual(await guard.inspect(ctx, [row], executor), [{ id: actorId, allowed: true, reasons: [] }]);
    assert.deepEqual(locks.slice(0, 7), ['clientes', ...relations].sort().map(name =>
      `LOCK TABLE "synthetic"."${name}" IN SHARE ROW EXCLUSIVE MODE NOWAIT`));
    blocked = true;
    assert.deepEqual(await guard.inspect(ctx, [row], executor), [{ id: actorId, allowed: false, reasons: ['CLIENTE_HAS_REFERENCES'] }]);
    incomplete = true;
    await assert.rejects(guard.inspect(ctx, [row], executor), { code: 'CLIENTE_BULK_COVERAGE_UNVERIFIED' });
    incomplete = false; extraRemoteRelation = true;
    await assert.rejects(guard.inspect(ctx, [row], executor), { code: 'CLIENTE_BULK_COVERAGE_UNVERIFIED' });
  } finally { await local.close(); }
});

test('bulk consolidation: no automatic bulk/export mount, grants or migration changes', () => {
  const diff = execFileSync('git', ['diff', "e36231b3a7e546aa9fd2529abb8d5edb61d8189c", '--', 'server/migrations', 'server/src/api/router.ts', 'server/src/app.ts'], { encoding: 'utf8' });
  assert.equal(diff, '');
  assert(!fs.existsSync('migrations/045_cadastro_bulk_ledger.sql'));
});

test('bulk consolidation: existing canonical Cliente methods and identity protections are identical except checkout line endings', () => {
  const path = 'src/services/clienteService.ts';
  const original = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:server/${path}`], { encoding: 'utf8' });
  const parse = (source: string) => ts.createSourceFile(path, source.replaceAll('\r\n', '\n'), ts.ScriptTarget.Latest, true);
  const before = parse(original), after = parse(clienteConferenciaRemainder('server/'+path, fs.readFileSync(path, 'utf8')));
  const members = (file: ts.SourceFile) => {
    const declaration = file.statements.find(ts.isClassDeclaration);
    assert(declaration);
    return new Map(declaration.members.map(member => [member.name?.getText(file) ?? 'constructor', member.getText(file)]));
  };
  const oldMembers = members(before), newMembers = members(after);
  for (const [name, text] of oldMembers) assert.equal(newMembers.get(name), text, name);
  assert.deepEqual([...newMembers.keys()].filter(name => !oldMembers.has(name)),
    ['export', 'correctInactiveLegacyName', 'restoreBulkSnapshot']);
  // Keep the old-method invariant; the authorized lifecycle addition must remain a pure delegation.
  const expected = members(parse(`class Expected {
  correctInactiveLegacyName(ctx: RequestContext, input: unknown) {
    return correctInactiveLegacyName({ repo: this.repo, audit: this.audit, rbac: this.rbacGuard }, ctx, input);
  }
}`));
  assert.equal(newMembers.get('correctInactiveLegacyName'), expected.get('correctInactiveLegacyName'));
  assert(after.statements.some(statement => ts.isImportDeclaration(statement)
    && statement.moduleSpecifier.getText(after) === "'./clienteLegacyNameCorrection.js'"));
});
