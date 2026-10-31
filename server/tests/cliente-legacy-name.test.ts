import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { createPoolDbClient, type DbClient, type DbQueryExecutor } from '../src/db/client.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { ClienteService } from '../src/services/clienteService.ts';
import { buildAssistedReviewRecord, applySyntheticInactiveNameReview } from '../../scripts/legado/pilot-functional-review-record.mjs';
import { legacyNameFingerprint } from '../src/services/clienteLegacyNameCorrection.ts';

const isolatedUrl = process.env.LEGACY_NAME_PG_TEST_URL;
for (const mode of ['pglite', 'postgres'] as const) test(
  'inactive imported name correction [' + mode + ']: synthetic SQL fixture only, no real authorization',
  { skip: mode === 'postgres' && !isolatedUrl }, async t => {
  const f = mode === 'postgres' ? await realCrmFixture(isolatedUrl!, { restrictedLogin: true }) : await localCrmFixture();
  const role = 'role' in f ? f.role : ROLE;
  const rawDb = f.data.pool ? createPoolDbClient(f.data.pool) : f.data;
  const writeTransactions = new Set<string>();
  const writeKinds = new Set<string>();
  const db: DbClient = { ...rawDb, withTransaction: fn => rawDb.withTransaction(q => {
    const watched: DbQueryExecutor = { query: async (sql, values) => {
      const kind = /^\s*(UPDATE clientes|INSERT INTO audit_logs)/i.exec(sql)?.[1];
      if (mode === 'postgres' && kind) {
        writeKinds.add(kind.toUpperCase());
        const stamp = (await q.query<{ pid: number; tx: string }>(
          'SELECT pg_backend_pid() AS pid,txid_current()::text AS tx')).rows[0];
        writeTransactions.add(stamp.pid + ':' + stamp.tx);
      }
      return q.query(sql, values);
    } };
    return fn(watched);
  }) };
  try {
    await f.exec(`GRANT SELECT,UPDATE ON clientes TO "${role}";
      CREATE POLICY name_test_client ON clientes FOR ALL TO "${role}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      CREATE POLICY name_test_audit ON audit_logs FOR ALL TO "${role}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    const batch = randomUUID();
    const seeded = await f.admin.query(`UPDATE clientes SET nome=$1,empresa_id=NULL,ativo=false,status='Inativo',origem='MIGRACAO',
      codigo_legado='SYNTHETIC-LEGACY',source_system='SYNTHETIC',migration_batch=$2 WHERE id=$3 RETURNING id`,
    ['SYNTHETIC OLD LABEL', batch, ID.clientePfA]);
    assert.equal(seeded.rows.length, 1);
    const permissions = { Cadastros: { cliente: ['editar', 'importar', 'visualizar'] } };
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb,empresa_id=NULL WHERE id=$2', [JSON.stringify(permissions), ID.runtimeActorA]);
    if (mode === 'postgres') {
      const identity = (await rawDb.query<{ login: boolean; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>(
        'SELECT current_user=session_user AS login,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname=current_user')).rows[0];
      assert.deepEqual(identity, { login: true, rolsuper: false, rolbypassrls: false, rolcanlogin: true });
      assert.equal((await rawDb.query<{ n: number }>('SELECT count(*)::int AS n FROM clientes')).rows[0].n, 0,
        'The restricted LOGIN must see no customers without transaction tenant context');
    }
    const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
    const exercise = async () => {
      const repo = new PostgresClienteRepository(db), audit = new PostgresAuditRepository(db), rbac = new PostgresRbacGuard(db);
      const service = new ClienteService(repo, audit, new PostgresTenantGuard(db), rbac);
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
        const failing = new ClienteService(repo, new FailingAudit(db), new PostgresTenantGuard(db), rbac);
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
      await t.test('reviewed command is captured before asynchronous permission lookup', async () => {
        const current = await snapshot(); assert.ok(current);
        const reviewed = { ...command, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(current),
          correctedName: 'SYNTHETIC REVIEWED VALUE', sourceProof: { ...command.sourceProof } };
        const approved = structuredClone(reviewed);
        let changed = false;
        class MutatingRbac extends PostgresRbacGuard {
          override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
            await super.assertAllowed(...args);
            if (!changed) {
              changed = true;
              reviewed.correctedName = 'SYNTHETIC UNREVIEWED VALUE';
              reviewed.sourceProof.rowSha256 = 'c'.repeat(64);
            }
          }
        }
        const captured = new ClienteService(repo, audit, new PostgresTenantGuard(db), new MutatingRbac(db));
        const result = await captured.correctInactiveLegacyName(ctx, reviewed);
        const actual = await snapshot(); assert.ok(actual);
        assert.deepEqual(actual, { ...current, nome: approved.correctedName, updated_at: actual.updated_at });
        assert.equal((await service.correctInactiveLegacyName(ctx, approved)).reused, true);
        const records = await audit.listByEntity('Cliente', approved.id);
        const receipt = records.find(e => (e.afterData as { operationId?: string })?.operationId === approved.operationId);
        assert.ok(receipt);
        assert.deepEqual((receipt.afterData as { sourceProof: unknown }).sourceProof, approved.sourceProof);
        await service.correctInactiveLegacyName(ctx, { ...reverse, operationId: randomUUID(),
          originalOperationId: approved.operationId, expectedFingerprint: result.fingerprint });
        const restored = await snapshot(); assert.ok(restored);
        assert.deepEqual(restored, { ...current, updated_at: restored.updated_at });
      });
      await t.test('caller context mutation cannot change tenant or audit actor after authorization', async () => {
        const current = await snapshot(); assert.ok(current);
        const request = { ...ctx };
        const approved = { ...command, operationId: randomUUID(), expectedFingerprint: legacyNameFingerprint(current),
          correctedName: 'SYNTHETIC CONTEXT CAPTURED' };
        let changed = false;
        class ContextMutation extends PostgresRbacGuard {
          override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
            await super.assertAllowed(...args);
            if (!changed) { changed = true; request.groupId = ID.groupB; request.actorId = randomUUID(); }
          }
        }
        const captured = new ClienteService(repo, audit, new PostgresTenantGuard(db), new ContextMutation(db));
        const applied = await captured.correctInactiveLegacyName(request, approved);
        const actual = await snapshot(); assert.ok(actual);
        assert.deepEqual(actual, { ...current, nome: approved.correctedName, updated_at: actual.updated_at });
        const receipt = (await audit.listByEntity('Cliente', approved.id))
          .find(e => (e.afterData as { operationId?: string })?.operationId === approved.operationId);
        assert.ok(receipt); assert.equal(receipt.actorId, ctx.actorId); assert.equal(receipt.groupId, ctx.groupId);
        await service.correctInactiveLegacyName(ctx, { ...reverse, operationId: randomUUID(),
          originalOperationId: approved.operationId, expectedFingerprint: applied.fingerprint });
      });
      await t.test('permission revocation before commit still rolls back captured command', async () => {
        const current = await snapshot(); assert.ok(current);
        let calls = 0;
        class LateDenial extends PostgresRbacGuard {
          override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
            await super.assertAllowed(...args);
            if (++calls === 6) throw new Error('SYNTHETIC_REVOKED_BEFORE_COMMIT');
          }
        }
        const denied = new ClienteService(repo, audit, new PostgresTenantGuard(db), new LateDenial(db));
        const op = randomUUID();
        await assert.rejects(denied.correctInactiveLegacyName(ctx, { ...command, operationId: op,
          expectedFingerprint: legacyNameFingerprint(current), correctedName: 'SYNTHETIC DENIED' }), /REVOKED_BEFORE_COMMIT/);
        assert.deepEqual(await snapshot(), current);
        assert.equal((await audit.listByEntity('Cliente', command.id))
          .some(e => (e.afterData as { operationId?: string })?.operationId === op), false);
      });
      if (mode === 'postgres') await t.test('real SQL privilege revocation and audit trigger failures roll back the customer', async () => {
        const current = await snapshot(); assert.ok(current);
        const attempt = () => service.correctInactiveLegacyName(ctx, { ...command, operationId: randomUUID(),
          expectedFingerprint: legacyNameFingerprint(current), correctedName: 'SYNTHETIC SQL DENIED' });
        for (const [privilege, table] of [['SELECT', 'clientes'], ['UPDATE', 'clientes'], ['INSERT', 'audit_logs']]) {
          await f.exec('REVOKE ' + privilege + ' ON ' + table + ' FROM "' + role + '"');
          try { await assert.rejects(attempt(), { code: '42501' }); }
          finally { await f.exec('GRANT ' + privilege + ' ON ' + table + ' TO "' + role + '"'); }
          assert.deepEqual(await snapshot(), current);
        }
        await f.exec("CREATE FUNCTION name_fixture_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_SQL_AUDIT_FAILURE'; END $$; " +
          'CREATE TRIGGER name_fixture_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION name_fixture_audit_fail()');
        try { await assert.rejects(attempt(), /SYNTHETIC_SQL_AUDIT_FAILURE/); }
        finally { await f.exec('DROP TRIGGER name_fixture_audit_fail ON audit_logs; DROP FUNCTION name_fixture_audit_fail()'); }
        assert.deepEqual(await snapshot(), current);
      });
      await t.test('downloaded synthetic review reaches canonical persistence, audit, replay and reversal', async () => {
        const current = await snapshot(); assert.ok(current);
        const original = { codigo_legado: command.legacyCode, nome: current.nome };
        const record = buildAssistedReviewRecord({ entity: 'cliente', sourceIndex: 0, original, context: ctx, synthetic: true,
          provenance: { sourceSystem: 'SYNTHETIC', file: 'synthetic.csv', fileSha256: command.sourceProof.fileSha256,
            rowSha256: command.sourceProof.rowSha256, batch }, evidence: { historyOnly: true, issues: [] } });
        const draft = { kind: 'UNTRUSTED_REVIEW_DRAFT', synthetic: true, recordKey: record.key, applied: false,
          operationalAuthorized: false, command: { operationId: randomUUID(), expectedSourceFingerprint: record.sourceFingerprint,
            field: 'nome', proposedValue: 'SYNTHETIC REVIEW ACCEPTED', reason: 'Synthetic verified correction',
            evidenceRefs: [{ ref: 'synthetic:source', sha256: command.sourceProof.fileSha256 }] } };
        const binding = { environment: 'ISOLATED_SYNTHETIC', recordKey: record.key, sourceFingerprint: record.sourceFingerprint,
          id: command.id, expectedFingerprint: legacyNameFingerprint(current), sourceSystem: 'SYNTHETIC',
          legacyCode: command.legacyCode, batch, sourceProof: { ...command.sourceProof } };
        const authorizationRef = randomUUID();
        const authorizeReview = async (request: Record<string, unknown>) => ({ ...request, approved: true, authorizationRef });
        const options = { context: ctx, rbacGuard: rbac, clienteService: service, authorizeReview };
        const unchanged = async () => assert.deepEqual(await snapshot(), current);
        for (const changed of [{ ...draft, operationalAuthorized: true }, { ...draft, synthetic: false },
          { ...draft, kind: 'AUTHORIZED' }, { ...draft, targetId: randomUUID() }]) {
          await assert.rejects(applySyntheticInactiveNameReview(record, changed, binding, options)); await unchanged();
        }
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          authorizeReview: async (request: Record<string, unknown>) => ({ ...request, approved: true,
            bindingHash: 'c'.repeat(64), authorizationRef }) }), /EXPLICIT_AUTHORIZATION/);
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, { ...binding, sourceSystem: 'REAL' }, options));
        await assert.rejects(applySyntheticInactiveNameReview(record, { ...draft, command: { ...draft.command,
          expectedSourceFingerprint: 'c'.repeat(64) } }, binding, options), /SOURCE_CHANGED/);
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          context: { ...ctx, groupId: ID.groupB } }));
        class ReviewAuditFailure extends PostgresAuditRepository { override async append() { throw new Error('REVIEW_AUDIT_FAILURE'); } }
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          clienteService: new ClienteService(repo, new ReviewAuditFailure(db), new PostgresTenantGuard(db), rbac) }), /REVIEW_AUDIT_FAILURE/);
        await unchanged();
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          authorizeReview: undefined }), /SYNTHETIC_ACCEPTANCE/);
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, { ...binding,
          sourceProof: { ...binding.sourceProof, rowSha256: 'c'.repeat(64) } }, options), /CANONICAL_BINDING/);
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          authorizeReview: async (request: Record<string, unknown>) => ({ ...request, approved: false, authorizationRef }) }), /EXPLICIT_AUTHORIZATION/);
        await assert.rejects(applySyntheticInactiveNameReview(record, { ...draft, command: { ...draft.command,
          evidenceRefs: [] } }, binding, options), /EVIDENCE_REQUIRED/);
        await assert.rejects(applySyntheticInactiveNameReview(record, { ...draft, command: { ...draft.command,
          proposedValue: 'x'.repeat(181) } }, binding, options), { code: 'VALIDATION_ERROR' });
        await unchanged();
        writeTransactions.clear(); writeKinds.clear();
        const receipt = await applySyntheticInactiveNameReview(record, draft, binding, options);
        if (mode === 'postgres') {
          assert.deepEqual([...writeKinds].sort(), ['INSERT INTO AUDIT_LOGS', 'UPDATE CLIENTES']);
          assert.equal(writeTransactions.size, 1, 'Customer and audit writes must share the real connection and transaction');
        }
        const reopened = await snapshot(); assert.ok(reopened);
        assert.deepEqual(reopened, { ...current, nome: draft.command.proposedValue, updated_at: reopened.updated_at });
        assert.equal(receipt.active, false); assert.equal(receipt.operationalAuthorized, false);
        writeTransactions.clear(); writeKinds.clear();
        assert.equal((await applySyntheticInactiveNameReview(record, draft, binding, options)).reused, true);
        assert.equal(writeTransactions.size, 0, 'Replay must not write');
        const log = (await audit.listByEntity('Cliente', binding.id))
          .find(e => (e.afterData as { operationId?: string })?.operationId === draft.command.operationId);
        assert.ok(log);
        const proof = (log.afterData as { reviewProof: { authorizationRef: string; proposalHash: string; reason: string } }).reviewProof;
        assert.equal(proof.authorizationRef, authorizationRef); assert.equal(proof.proposalHash, receipt.proposalHash);
        assert.equal(proof.reason, draft.command.reason);
        await assert.rejects(applySyntheticInactiveNameReview(record, draft, binding, { ...options,
          authorizeReview: async (request: Record<string, unknown>) => ({ ...request, approved: true, authorizationRef: randomUUID() }) }),
        { code: 'LEGACY_NAME_CORRECTION_CONFLICT' });
        assert.deepEqual(await snapshot(), reopened);
        const reversal = { ...reverse, operationId: randomUUID(), originalOperationId: draft.command.operationId,
          expectedFingerprint: receipt.fingerprint };
        await service.correctInactiveLegacyName(ctx, reversal);
        const restored = await snapshot(); assert.ok(restored);
        assert.deepEqual(restored, { ...current, updated_at: restored.updated_at });
        const reverseLog = (await audit.listByEntity('Cliente', binding.id))
          .find(e => (e.afterData as { operationId?: string })?.operationId === reversal.operationId);
        assert.deepEqual((reverseLog?.afterData as { reviewProof: unknown }).reviewProof, proof);
      });
    };
    if (db.withTenantContext) await db.withTenantContext(ctx, exercise);
    else await exercise();
  } finally { await f.close(); }
});
