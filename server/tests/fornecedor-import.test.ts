import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID, SEED_DOCS } from '../scripts/seedDevIds.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresFornecedorRepository } from '../src/repositories/postgresFornecedorRepository.ts';
import { FornecedorService, fingerprintFornecedor } from '../src/services/fornecedorService.ts';
import { fornecedorImportSchema } from '../src/repositories/fornecedorTypes.ts';

test('Fornecedor master: PostgreSQL engine synthetic fixture, not operational proof', async t => {
  const f = await localCrmFixture();
  try {
    await f.exec(await readFile(new URL('../schema-candidates/fornecedor_master.sql', import.meta.url), 'utf8'));
    await f.exec(`GRANT SELECT,INSERT,UPDATE ON fornecedores TO ${ROLE};
      CREATE POLICY supplier_fixture ON fornecedores FOR ALL TO ${ROLE}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
      CREATE POLICY supplier_fixture_audit ON audit_logs FOR INSERT TO ${ROLE}
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',
      [JSON.stringify({ Cadastros: { fornecedor: ['visualizar', 'criar', 'importar', 'inativar'] } }), ID.runtimeActorA]);
    const repo = new PostgresFornecedorRepository(f.data), rbac = new PostgresRbacGuard(f.data);
    const audit = new PostgresAuditRepository(f.data), service = new FornecedorService(repo, audit, rbac);
    const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
    const payload = { tipo_pessoa: 'Pessoa Juridica', cpf_cnpj: SEED_DOCS.clientePjA,
      razao_social: 'SYNTHETIC SUPPLIER', codigo: '000077', status: 'Ativo', status_fornecedor: 'Ativo',
      endereco: 'SYNTHETIC STREET', bairro: 'SYNTHETIC', cidade: 'SYNTHETIC', estado: 'SP', cep: '00000000',
      codigo_legado: '77', legacy_id: '77', source_system: 'SYNTHETIC', migration_batch: randomUUID() };
    await t.test('strict document, company and bank fields fail closed', () => {
      assert.equal(fornecedorImportSchema.safeParse({ ...payload, cpf_cnpj: '123' }).success, false);
      assert.equal(fornecedorImportSchema.safeParse({ ...payload, empresa_id: ID.empresaA }).success, false);
      assert.equal(fornecedorImportSchema.safeParse({ ...payload, dados_bancarios: {} }).success, false);
    });
    await t.test('permission, group and company scope are enforced', async () => {
      await assert.rejects(service.importar({ ...ctx, actorId: ID.runtimeActorB }, payload), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.importar({ ...ctx, groupId: ID.groupB }, payload), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.importar({ ...ctx, empresaId: ID.empresaA }, payload), { code: 'FORNECEDOR_GROUP_SCOPE_REQUIRED' });
    });
    const created = await service.importar(ctx, payload);
    await t.test('literal codes, provenance, address, replay and conflict', async () => {
      assert.equal(created.reutilizado, false); assert.equal(created.registro.codigo, '000077');
      assert.equal(created.registro.endereco, payload.endereco);
      assert.equal(created.registro.empresa_dona_id, null);
      const replay = await service.importar(ctx, payload);
      assert.equal(replay.reutilizado, true); assert.deepEqual(replay.registro, created.registro);
      await assert.rejects(service.importar(ctx, { ...payload, endereco: 'CHANGED' }), { code: 'LEGACY_RECONCILIATION_REQUIRED' });
      await assert.rejects(service.importar(ctx, { ...payload, codigo_legado: 'OTHER' }), { code: 'DUPLICATE_DOCUMENT_OR_CODE' });
    });
    await t.test('audit failure rolls back supplier and code sequence', async () => {
      class FailingAudit extends PostgresAuditRepository { override async append() { throw new Error('SYNTHETIC_AUDIT_FAILURE'); } }
      const failing = new FornecedorService(repo, new FailingAudit(f.data), rbac);
      await assert.rejects(failing.importar(ctx, payload), /SYNTHETIC_AUDIT_FAILURE/);
      const before = await f.admin.query('SELECT * FROM entity_code_sequences WHERE entity_name=$1', ['fornecedor']);
      await assert.rejects(failing.importar(ctx, { ...payload, cpf_cnpj: SEED_DOCS.clientePjB, codigo: '999999', codigo_legado: '88' }), /SYNTHETIC_AUDIT_FAILURE/);
      assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM fornecedores')).rows[0].n, 1);
      assert.deepEqual((await f.admin.query('SELECT * FROM entity_code_sequences WHERE entity_name=$1', ['fornecedor'])).rows, before.rows);
    });
    await t.test('reversal rejects wrong batch, revision and outside edit', async () => {
      const r = created.registro, fp = fingerprintFornecedor(r);
      await assert.rejects(service.softDelete(ctx, r.id, r.revision, r.source_system, randomUUID(), fp), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      await assert.rejects(service.softDelete(ctx, r.id, 99, r.source_system, r.migration_batch, fp), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      await f.admin.query('UPDATE fornecedores SET endereco=$1 WHERE id=$2', ['EXTERNAL SYNTHETIC EDIT', r.id]);
      await assert.rejects(service.softDelete(ctx, r.id, r.revision, r.source_system, r.migration_batch, fp), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      await f.admin.query('UPDATE fornecedores SET endereco=$1 WHERE id=$2', [payload.endereco, r.id]);
    });
    await t.test('reversal preserves identity/history; replay cannot reactivate', async () => {
      const r = created.registro;
      const after = await service.softDelete(ctx, r.id, r.revision, r.source_system, r.migration_batch, fingerprintFornecedor(r));
      assert.equal(after.ativo, false); assert.equal(after.status, 'Inativo');
      for (const k of ['id', 'codigo', 'codigo_legado', 'legacy_id', 'source_system', 'migration_batch', 'endereco']) {
        assert.deepEqual(Reflect.get(after, k), Reflect.get(r, k));
      }
      await assert.rejects(service.importar(ctx, payload), { code: 'LEGACY_RECONCILIATION_REQUIRED' });
      assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM fornecedores')).rows[0].n, 1);
      assert.equal((await f.admin.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity='Fornecedor'")).rows[0].n, 3);
    });
  } finally { await f.close(); }
});
