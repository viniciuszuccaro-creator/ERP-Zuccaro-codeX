import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { legacyNameFingerprint, enrichLegacyStateRegistration } from '../src/services/clienteLegacyNameCorrection.ts';
import type { RequestContext } from '../src/audit/types.ts';

// Reuses the canonical SQL fixture and lifecycle; no HML credentials or source records.
test('registration enrichment: canonical PGlite transaction, synthetic data only', async t => {
  const f = await localCrmFixture();
  try {
    await f.exec(`GRANT SELECT,UPDATE ON clientes TO "${ROLE}";
      CREATE POLICY registration_client ON clientes FOR ALL TO "${ROLE}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      CREATE POLICY registration_audit ON audit_logs FOR ALL TO "${ROLE}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    const batch = randomUUID();
    await f.admin.query(`UPDATE clientes SET empresa_id=NULL,origem='MIGRACAO',codigo_legado='SYNTHETIC-IE',
      source_system='SYNTHETIC',migration_batch=$1,inscricao_estadual=NULL WHERE id=$2`, [batch, ID.clientePfA]);
    const permissions = { Cadastros: { cliente: ['editar', 'importar', 'visualizar'] } };
    const setPermissions = (p: unknown) => f.admin.query('UPDATE profiles SET permissoes=$1::jsonb,empresa_id=NULL WHERE id=$2',
      [JSON.stringify(p), ID.runtimeActorA]);
    await setPermissions(permissions);
    const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
    const repo = new PostgresClienteRepository(f.data), audit = new PostgresAuditRepository(f.data);
    const rbac = new PostgresRbacGuard(f.data);
    const enrich = (context: RequestContext, input: unknown, guard = rbac, auditRepo = audit) =>
      enrichLegacyStateRegistration({ repo, audit: auditRepo, rbac: guard }, context, input);
    const snapshot = () => repo.withTransaction(q => { assert.ok(q); return repo.getBulkSnapshot(ctx, ID.clientePfA, q); });
    const before = await snapshot(); assert.ok(before);
    const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
      expectedFingerprint: legacyNameFingerprint(before), sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-IE', batch,
      inscricaoEstadual: '001234', sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'csv-rfc4180-doublequote-v1' } };
    await t.test('scope, permissions, stale version, provenance and clearing reject without writes', async () => {
      await assert.rejects(enrich({ ...ctx, empresaId: ID.empresaA }, command), { code: 'LEGACY_GROUP_SCOPE_REQUIRED' });
      await assert.rejects(enrich({ ...ctx, groupId: ID.groupB }, command), { code: 'PERMISSION_DENIED' });
      await setPermissions({ Cadastros: { cliente: ['importar'] } });
      await assert.rejects(enrich(ctx, command), { code: 'PERMISSION_DENIED' });
      await setPermissions(permissions);
      for (const delta of [{ sourceProof: undefined }, { inscricaoEstadual: '' }, { inscricaoEstadual: null }, { ativo: true }]) {
        await assert.rejects(enrich(ctx, { ...command, ...delta }), { code: 'VALIDATION_ERROR' });
      }
      for (const delta of [{ expectedFingerprint: 'c'.repeat(64) }, { legacyCode: 'OTHER' }, { batch: randomUUID() }]) {
        await assert.rejects(enrich(ctx, { ...command, ...delta }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('audit failure rolls back the canonical update', async () => {
      class FailingAudit extends PostgresAuditRepository { override async append() { throw new Error('SYNTHETIC_AUDIT_FAILURE'); } }
      await assert.rejects(enrich(ctx, command, rbac, new FailingAudit(f.data)), /SYNTHETIC_AUDIT_FAILURE/);
      assert.deepEqual(await snapshot(), before);
    });
    const applied = await enrich(ctx, command);
    await t.test('only IE changes, zeros survive and exact replay adds no audit', async () => {
      const after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, inscricao_estadual: '001234', updated_at: after.updated_at });
      assert.equal((await enrich(ctx, command)).reused, true);
      await assert.rejects(enrich(ctx, { ...command, inscricaoEstadual: '999' }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      await assert.rejects(enrich(ctx, { ...command, operationId: randomUUID(),
        expectedFingerprint: applied.fingerprint }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
    });
    const reverse = { mode: 'reverse', id: command.id, operationId: randomUUID(), originalOperationId: command.operationId,
      expectedFingerprint: applied.fingerprint, sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
    await t.test('reversal uses the audited original and replays without duplicate events', async () => {
      await enrich(ctx, reverse);
      const restored = await snapshot(); assert.ok(restored);
      assert.deepEqual(restored, { ...before, updated_at: restored.updated_at });
      assert.equal((await enrich(ctx, reverse)).reused, true);
      assert.equal((await audit.listByEntity('Cliente', command.id)).filter(e => e.action === 'update').length, 2);
      await assert.rejects(enrich(ctx, command), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
    });
    await t.test('intervening edit prevents reversal and preserves external field', async () => {
      const current = await snapshot(); assert.ok(current);
      const next = { ...command, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(current) };
      const result = await enrich(ctx, next);
      await f.admin.query('UPDATE clientes SET observacoes=$1 WHERE id=$2', ['SYNTHETIC OUTSIDE EDIT', command.id]);
      await assert.rejects(enrich(ctx, { ...reverse, operationId: randomUUID(),
        originalOperationId: next.operationId, expectedFingerprint: result.fingerprint }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      assert.equal((await snapshot())?.observacoes, 'SYNTHETIC OUTSIDE EDIT');
    });
    await t.test('inputs and actor are captured before asynchronous authorization', async () => {
      await f.admin.query("UPDATE clientes SET inscricao_estadual=NULL,ativo=false,status='Inativo' WHERE id=$1", [command.id]);
      const current = await snapshot(); assert.ok(current);
      const request = { ...ctx };
      const proposed = { ...command, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(current),
        sourceProof: { ...command.sourceProof } };
      const approved = structuredClone(proposed);
      let mutated = false;
      class MutatingGuard extends PostgresRbacGuard {
        override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
          await super.assertAllowed(...args);
          if (!mutated) {
            mutated = true;
            request.groupId = ID.groupB; request.actorId = randomUUID();
            proposed.inscricaoEstadual = '999'; proposed.sourceProof.rowSha256 = 'd'.repeat(64);
          }
        }
      }
      const result = await enrich(request, proposed, new MutatingGuard(f.data));
      const actual = await snapshot(); assert.ok(actual);
      assert.deepEqual(actual, { ...current, inscricao_estadual: approved.inscricaoEstadual, updated_at: actual.updated_at });
      const receipt = (await audit.listByEntity('Cliente', command.id))
        .find(e => (e.afterData as { operationId?: string })?.operationId === approved.operationId);
      assert.ok(receipt);
      assert.equal(receipt.actorId, ctx.actorId);
      assert.deepEqual((receipt.afterData as { sourceProof: unknown }).sourceProof, approved.sourceProof);
      assert.equal((await enrich(ctx, approved)).reused, true);
      await enrich(ctx, { ...reverse, operationId: randomUUID(),
        originalOperationId: approved.operationId, expectedFingerprint: result.fingerprint });
      const final = await snapshot(); assert.ok(final);
      assert.deepEqual(final, { ...current, updated_at: final.updated_at });
    });
  } finally { await f.close(); }
});
