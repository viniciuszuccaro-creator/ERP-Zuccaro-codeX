import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { OrganizacionalService } from '../src/services/organizacionalService.ts';

const G = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const U = '44444444-4444-4444-8444-444444444444';

test('organizacional: real persistence, CAS, audit atomicity and tenant/RBAC negatives', async t => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE groups(id uuid PRIMARY KEY,nome_do_grupo text,razao_social_grupo text,cnpj_grupo text,status text,observacoes text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE empresas(id uuid PRIMARY KEY,group_id uuid,razao_social text,nome_fantasia text,cnpj text,status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE audit_logs(group_id uuid,empresa_id uuid,actor_id uuid,actor_email text,entity text,entity_id uuid,action text,before_data jsonb,after_data jsonb,request_id text,ip_address text);
      INSERT INTO groups(id,nome_do_grupo,status) VALUES('${G}','Synthetic Group','Ativo');
      INSERT INTO empresas(id,group_id,razao_social,nome_fantasia,cnpj,status) VALUES('${A}','${G}','Synthetic A','A','11222333000181','Ativa'),('${B}','${G}','Synthetic B','B',NULL,'Ativa');`);
    await pg.exec('ALTER TABLE groups ADD COLUMN codigo text; ALTER TABLE empresas ADD COLUMN codigo text; CREATE UNIQUE INDEX org_group_code ON groups(codigo); CREATE UNIQUE INDEX org_company_code ON empresas(group_id,codigo);');
    const migration = readFileSync(new URL('../migrations/009_clientes_master_data.sql', import.meta.url), 'utf8');
    const sequence = migration.match(/CREATE TABLE IF NOT EXISTS entity_code_sequences[\s\S]*?REVOKE ALL ON FUNCTION reserve_entity_codigo\(UUID, TEXT, INT\) FROM PUBLIC;/)?.[0];
    assert.ok(sequence); await pg.exec(sequence);
    const db: DbClient = { pool: null, query: (s, p) => pg.query(s, p as never) as never,
      withTransaction: f => pg.transaction(q => f({ query: (s, p) => q.query(s, p as never) as never } as DbQueryExecutor)),
      checkConnection: async () => true, end: async () => {} };
    const rbac = new InMemoryRbacGuard(), tenants = new InMemoryTenantGuard();
    tenants.link(A, G); tenants.link(B, G);
    const permissions = { Cadastros: { organizacional: ['visualizar', 'editar'] } };
    rbac.link({ actorId: U, groupId: G, permissions });
    const ctx = { actorId: U, groupId: G, requestId: 'synthetic-organizacional' };
    const audit = new PostgresAuditRepository(db);
    const service = new OrganizacionalService(db, audit, rbac, tenants);
    const audits = async () => (await pg.query('SELECT * FROM audit_logs')).rows;
    await t.test('save/get preserves IDs, omitted fields, audit and explicit null', async () => {
      const before = await service.get(ctx, 'Empresa', A);
      const saved = await service.update(ctx, 'Empresa', A, { expected_version: before.version, nome_fantasia: 'Updated' });
      assert.equal(saved.id, A); assert.equal(saved.group_id, G); assert.equal(saved.razao_social, before.razao_social);
      assert.equal(saved.cnpj, before.cnpj); assert.equal((await audits()).length, 1);
      const reopened = await service.get(ctx, 'Empresa', A); assert.deepEqual(reopened, saved);
      const cleared = await service.update(ctx, 'Empresa', A, { expected_version: reopened.version, nome_fantasia: null });
      assert.equal(cleared.nome_fantasia, null);
      const row = (await audits())[0]; assert.equal(row.empresa_id, A); assert.equal(row.actor_id, U);
      assert.equal((row.after_data as any).nome_fantasia, 'Updated');
    });
    await t.test('group same ID saves and reopens; no-op has no duplicate audit', async () => {
      const before = await service.get(ctx, 'GrupoEmpresarial', G);
      const saved = await service.update(ctx, 'GrupoEmpresarial', G, { expected_version: before.version, observacoes: 'Verified synthetic' });
      assert.equal(saved.id, G); assert.equal(saved.nome_do_grupo, before.nome_do_grupo);
      assert.deepEqual(await service.get(ctx, 'GrupoEmpresarial', G), saved);
      const n = (await audits()).length;
      await service.update(ctx, 'GrupoEmpresarial', G, { expected_version: saved.version, observacoes: 'Verified synthetic' });
      assert.equal((await audits()).length, n);
    });
    await t.test('stale/double save, unsupported data and invalid document rejected', async () => {
      const r = await service.get(ctx, 'Empresa', A);
      await service.update(ctx, 'Empresa', A, { expected_version: r.version, nome_fantasia: 'Once' });
      await assert.rejects(service.update(ctx, 'Empresa', A, { expected_version: r.version, nome_fantasia: 'Twice' }), { code: 'VERSION_CONFLICT' });
      for (const patch of [{ id: B }, { group_id: B }, { status: 'Inativa' }, { certificado_digital: {} }, { cnpj: '11111111111111' }]) {
        await assert.rejects(service.update(ctx, 'Empresa', A, { expected_version: r.version, ...patch }), { code: 'VALIDATION_ERROR' });
      }
    });
    await t.test('company/group/actor and permission negatives', async () => {
      await assert.rejects(service.get({ ...ctx, actorId: B }, 'Empresa', A), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.get({ ...ctx, groupId: B }, 'Empresa', A), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.get({ ...ctx, empresaId: A }, 'Empresa', B), { code: 'COMPANY_SCOPE_DENIED' });
      assert.equal((await service.get({ ...ctx, empresaId: A }, 'Empresa', A)).id, A);
      await assert.rejects(service.update({ ...ctx, empresaId: A }, 'GrupoEmpresarial', G, { expected_version: 'a'.repeat(64) }), { code: 'GROUP_SCOPE_REQUIRED' });
      rbac.link({ actorId: U, groupId: G, permissions: { Cadastros: { organizacional: ['visualizar'] } } });
      await assert.rejects(service.update(ctx, 'Empresa', A, { expected_version: 'a'.repeat(64) }), { code: 'PERMISSION_DENIED' });
      rbac.link({ actorId: U, groupId: G, permissions });
    });
    await t.test('audit failure rolls back business write', async () => {
      const before = await service.get(ctx, 'Empresa', A);
      const fail = new OrganizacionalService(db, { append: async () => { throw new Error('AUDIT_FAILED'); }, listByEntity: async () => [] }, rbac, tenants);
      await assert.rejects(fail.update(ctx, 'Empresa', A, { expected_version: before.version, nome_fantasia: 'Never' }), /AUDIT_FAILED/);
      assert.deepEqual(await service.get(ctx, 'Empresa', A), before);
    });
    await t.test('codes reserve on server, preserve identities and survive save/reopen/replay', async () => {
      const group = await service.get(ctx, 'GrupoEmpresarial', G);
      const coded = await service.assignMissingCodigo(ctx, 'GrupoEmpresarial', G, String(group.version));
      assert.equal(coded.codigo, '001');
      const a = await service.get(ctx, 'Empresa', A), b = await service.get(ctx, 'Empresa', B);
      const fail = new OrganizacionalService(db, { append: async () => { throw new Error('AUDIT_FAILED'); }, listByEntity: async () => [] }, rbac, tenants);
      await assert.rejects(fail.assignMissingCodigo(ctx, 'Empresa', A, String(a.version)), /AUDIT_FAILED/);
      assert.deepEqual(await service.get(ctx, 'Empresa', A), a);
      await assert.rejects(service.assignMissingCodigo(ctx, 'Empresa', A, 'a'.repeat(64)), { code: 'VERSION_CONFLICT' });
      const first = await service.assignMissingCodigo(ctx, 'Empresa', A, String(a.version));
      const second = await service.assignMissingCodigo(ctx, 'Empresa', B, String(b.version));
      assert.equal(first.codigo, '001'); assert.equal(second.codigo, '002');
      const n = (await audits()).length;
      assert.deepEqual(await service.assignMissingCodigo(ctx, 'Empresa', A, String(a.version)), first);
      assert.equal((await audits()).length, n);
      const reopened = await service.get(ctx, 'Empresa', A);
      assert.equal(reopened.codigo, '001'); assert.equal(reopened.id, A);
      const saved = await service.update(ctx, 'Empresa', A, { expected_version: reopened.version, nome_fantasia: 'Code preserved' });
      assert.equal(saved.codigo, '001');
      await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', A, String(first.version), '001', ctx.requestId), { code: 'VERSION_CONFLICT' });
      await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', B, String(second.version), '999', ctx.requestId), { code: 'VERSION_CONFLICT' });
      await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', B, String(second.version), '002', 'wrong-run'), { code: 'ASSIGNMENT_RECEIPT_REQUIRED' });
      const reversed = await service.reverseAssignedCodigo(ctx, 'Empresa', B, String(second.version), '002', ctx.requestId);
      assert.equal(reversed.codigo, null); assert.equal(reversed.id, B); assert.equal(reversed.razao_social, second.razao_social);
      const reassigned = await service.assignMissingCodigo(ctx, 'Empresa', B, String(reversed.version));
      assert.equal(reassigned.codigo, '003');
      await pg.query('UPDATE empresas SET codigo=$1 WHERE id=$2', ['900', B]);
      const external = await service.get(ctx, 'Empresa', B);
      await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', B, String(external.version), '900', ctx.requestId), { code: 'ASSIGNMENT_RECEIPT_REQUIRED' });
      assert.deepEqual(await service.get(ctx, 'Empresa', B), external);
      await assert.rejects(service.update(ctx, 'Empresa', A, { expected_version: saved.version, codigo: '999' }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(service.assignMissingCodigo({ ...ctx, actorId: B }, 'Empresa', A, String(saved.version)), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.assignMissingCodigo({ ...ctx, empresaId: A }, 'Empresa', B, String(second.version)), { code: 'COMPANY_SCOPE_DENIED' });
      assert.deepEqual(coded.empresas_ids, [A, B]);
      const reopen = await service.get(ctx, 'GrupoEmpresarial', G);
      assert.equal(reopen.codigo, '001');
      await pg.exec(`INSERT INTO groups(id,nome_do_grupo,status) VALUES('${B}','Second synthetic group','Ativo')`);
      rbac.link({ actorId: U, groupId: B, permissions });
      const otherCtx = { ...ctx, groupId: B };
      const other = await service.get(otherCtx, 'GrupoEmpresarial', B);
      const otherCoded = await service.assignMissingCodigo(otherCtx, 'GrupoEmpresarial', B, String(other.version));
      assert.equal(otherCoded.codigo, '002');
      rbac.link({ actorId: U, groupId: G, permissions });
    });
    assert.equal((await service.list(ctx, 'Empresa')).length, 2);
    assert.equal((await service.list({ ...ctx, empresaId: A }, 'Empresa')).length, 1);
  } finally { await pg.close(); }
});
