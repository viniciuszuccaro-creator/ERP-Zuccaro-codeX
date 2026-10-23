import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { ClienteService } from '../src/services/clienteService.ts';
import { legacyNameFingerprint } from '../src/services/clienteLegacyNameCorrection.ts';

test('inactive imported name correction: synthetic SQL fixture only, no real authorization', async t => {
  const f = await localCrmFixture();
  try {
    await f.exec(`GRANT SELECT,UPDATE ON clientes TO ${ROLE};
      CREATE POLICY name_test_client ON clientes FOR ALL TO ${ROLE}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      CREATE POLICY name_test_audit ON audit_logs FOR ALL TO ${ROLE}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    const batch = randomUUID();
    const seeded = await f.admin.query(`UPDATE clientes SET nome=$1,empresa_id=NULL,ativo=false,status='Inativo',origem='MIGRACAO',
      codigo_legado='SYNTHETIC-LEGACY',source_system='SYNTHETIC',migration_batch=$2 WHERE id=$3 RETURNING id`,
    ['SYNTHETIC OLD LABEL', batch, ID.clientePfA]);
    assert.equal(seeded.rows.length, 1);
    const permissions = { Cadastros: { cliente: ['editar', 'importar', 'visualizar'] } };
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), ID.runtimeActorA]);
    const repo = new PostgresClienteRepository(f.data), audit = new PostgresAuditRepository(f.data), rbac = new PostgresRbacGuard(f.data);
    const service = new ClienteService(repo, audit, new PostgresTenantGuard(f.data), rbac);
    const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
    const snapshot = () => repo.withTransaction(q => {
      assert.ok(q); return repo.getBulkSnapshot(ctx, ID.clientePfA, q);
    });
    const before = await snapshot(); assert.ok(before);
    const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(before),
      sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-LEGACY', batch, correctedName: 'SYNTHETIC CORRECT LABEL',
      sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'csv-rfc4180-doublequote-v1' } };
    await t.test('company, other group, missing proof and lifecycle fields fail closed', async () => {
      await assert.rejects(service.correctInactiveLegacyName({ ...ctx, empresaId: ID.empresaA }, command), { code: 'LEGACY_GROUP_SCOPE_REQUIRED' });
      await assert.rejects(service.correctInactiveLegacyName({ ...ctx, scopeType: 'empresa' }, command), { code: 'LEGACY_GROUP_SCOPE_REQUIRED' });
      await assert.rejects(service.correctInactiveLegacyName({ ...ctx, groupId: ID.groupB }, command), { code: 'PERMISSION_DENIED' });
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...command, sourceProof: undefined }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...command, ativo: true }), { code: 'VALIDATION_ERROR' });
    });
    await t.test('import alone does not authorize correction; stale and wrong source reject', async () => {
      await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',
        [JSON.stringify({ Cadastros: { cliente: ['importar'] } }), ctx.actorId]);
      await assert.rejects(service.correctInactiveLegacyName(ctx, command), { code: 'PERMISSION_DENIED' });
      await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), ctx.actorId]);
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...command, expectedFingerprint: 'c'.repeat(64) }), { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...command, legacyCode: 'OTHER' }), { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
    });
    await t.test('audit failure rolls back the name and all other fields', async () => {
      class FailingAudit extends PostgresAuditRepository { override async append() { throw new Error('SYNTHETIC_AUDIT_FAILURE'); } }
      const failing = new ClienteService(repo, new FailingAudit(f.data), new PostgresTenantGuard(f.data), rbac);
      await assert.rejects(failing.correctInactiveLegacyName(ctx, command), /SYNTHETIC_AUDIT_FAILURE/);
      assert.deepEqual(await snapshot(), before);
    });
    const applied = await service.correctInactiveLegacyName(ctx, command);
    const after = await snapshot(); assert.ok(after);
    await t.test('only name changes; same ID, code, inactive state and provenance; replay is exact', async () => {
      assert.deepEqual(after, { ...before, nome: command.correctedName, updated_at: after.updated_at });
      assert.equal(applied.active, false);
      assert.equal((await service.correctInactiveLegacyName(ctx, command)).reused, true);
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...command, correctedName: 'DIFFERENT' }), { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
    });
    const reverse = { mode: 'reverse', id: command.id, operationId: randomUUID(), originalOperationId: command.operationId,
      expectedFingerprint: applied.fingerprint, sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
    await t.test('reversal uses persisted receipt, remains inactive and is idempotent', async () => {
      const reverted = await service.correctInactiveLegacyName(ctx, reverse);
      const final = await snapshot(); assert.ok(final);
      assert.deepEqual(final, { ...before, updated_at: final.updated_at });
      assert.equal(reverted.active, false);
      assert.equal((await service.correctInactiveLegacyName(ctx, reverse)).reused, true);
      await assert.rejects(service.correctInactiveLegacyName(ctx, command), { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
      const records = (await audit.listByEntity('Cliente', command.id)).filter(e => e.action === 'update');
      assert.equal(records.length, 2);
    });
    await t.test('outside edits prevent reversal instead of overwriting them', async () => {
      const current = await snapshot(); assert.ok(current);
      const next = { ...command, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(current) };
      const appliedAgain = await service.correctInactiveLegacyName(ctx, next);
      await f.admin.query('UPDATE clientes SET observacoes=$1 WHERE id=$2', ['SYNTHETIC OUTSIDE EDIT', command.id]);
      await assert.rejects(service.correctInactiveLegacyName(ctx, { ...reverse, operationId: randomUUID(),
        originalOperationId: next.operationId, expectedFingerprint: appliedAgain.fingerprint }), { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
      const changed = await snapshot(); assert.ok(changed);
      assert.equal(changed.observacoes, 'SYNTHETIC OUTSIDE EDIT'); assert.equal(changed.ativo, false);
    });
  } finally { await f.close(); }
});
