import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import express, { type ErrorRequestHandler } from 'express';
import { once } from 'node:events';
import { createSupabaseAuthMiddleware, requestIdMiddleware, scopeMiddleware } from '../src/middleware/requestContext.ts';
import { mountLegacyClientReviewRead } from '../src/api/legacyClientReviewRoute.ts';
import { AppError } from '../src/api/errors.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { createPoolDbClient } from '../src/db/client.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { sha, syntheticCpf } from './helpers/legadoBatchFixture.ts';
import { archiveAssistedClientReview, reopenAssistedClientReview, runAssistedClientReviewManifest, saveAssistedClientDocumentCorrection, stageAssistedClientReview } from '../../scripts/legado/pilot-functional-review-store.mjs';
import { rowHash } from '../../scripts/legado/pilot-functional-policy.mjs';
import { runPrivateAssistedReviewCommand } from '../../scripts/legado/staging-checkpoint.mjs';

const url = process.env.LEGACY_REVIEW_PG_TEST_URL;
test('new Assisted Review identity survives a new PostgreSQL connection without creating a master', { skip: !url }, async () => {
  const f = await realCrmFixture(url!, { restrictedLogin: true });
  const scope = { groupId: ID.groupA, actorId: ID.runtimeActorA, requestId: 'synthetic-review', scopeType: 'grupo' };
  const row = {
    nativeKey: 'NEW-SYNTH', cpf: '0012', cnpj: '', sourceStatus: 'At',
    reason: 'DOCUMENTO_ESTRUTURAL_PENDENTE', sourceIndex: 0,
    provenance: { sourceSystem: 'SYNTHETIC', file: 'synthetic.csv', fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64) },
  };
  const identity = { sourceSystem: 'SYNTHETIC', nativeKey: row.nativeKey };
  const deps = (pool: pg.Pool) => {
    const db = createPoolDbClient(pool);
    return { db, audit: new PostgresAuditRepository(db), rbac: new PostgresRbacGuard(db) };
  };
  try {
    await f.exec(await readFile(new URL('../schema-candidates/legacy_client_review.sql', import.meta.url), 'utf8'));
    await f.exec(`GRANT SELECT,INSERT ON legacy_client_review TO "${f.role}"`);
    await f.exec(`GRANT UPDATE(correction,archived) ON legacy_client_review TO "${f.role}"`);
    const before = (await f.admin.query('SELECT count(*) n FROM clientes')).rows[0].n;
    const firstConnection = deps(f.data.pool!);
    await assert.rejects(stageAssistedClientReview(row, scope, firstConnection), { code: '42501' });
    assert.equal((await f.admin.query('SELECT count(*) n FROM legacy_client_review')).rows[0].n, '0');
    await f.exec(`CREATE POLICY review_test_audit ON audit_logs FOR INSERT TO "${f.role}"
      WITH CHECK (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)`);
    const saved = await stageAssistedClientReview(row, scope, firstConnection);
    assert.equal(saved.replayed, false);
    const users = { a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' };
    await f.admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2', [users.a, ID.runtimeActorA]);
    await f.admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2', [users.b, ID.runtimeActorB]);
    const http = express();
    http.use(requestIdMiddleware);
    http.use(createSupabaseAuthMiddleware({ supabaseUrl: 'https://synthetic.invalid', anonKey: 'synthetic',
      db: f.admin, fetchImpl: async (_url, options) => {
        const token = new Headers(options?.headers).get('authorization')?.replace(/^Bearer /, '');
        const id = users[token as keyof typeof users];
        return id ? Response.json({ id }) : new Response(null, { status: 401 });
      },
    }));
    http.use(scopeMiddleware);
    mountLegacyClientReviewRead(http, firstConnection.db, firstConnection.rbac);
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      res.status(error instanceof AppError ? error.statusCode : 500).json({ code: error instanceof AppError ? error.code : 'TEST_ERROR' });
    };
    http.use(errors);
    const listener = http.listen(0, '127.0.0.1');
    try {
      await once(listener, 'listening');
      const addr = listener.address();
      assert.ok(addr && typeof addr !== 'string');
      const url = `http://127.0.0.1:${addr.port}/api/v1/clientes/revisao-legado/SYNTHETIC/NEW-SYNTH`;
      const get = (token: string, groupId: string) => fetch(url, {
        headers: { Authorization: 'Bearer ' + token, 'x-group-id': groupId }, signal: AbortSignal.timeout(5000),
      });
      const authorized = await get('a', ID.groupA);
      assert.equal(authorized.status, 200);
      assert.match(authorized.headers.get('cache-control') ?? '', /no-store/);
      const body = await authorized.json();
      assert.equal(body.id, saved.id);
      assert.equal(body.record.fields.find((field: { name: string }) => field.name === 'cpf').original, undefined);
      assert.equal((await get('a', ID.groupB)).status, 403);
      assert.equal((await get('b', ID.groupB)).status, 404);
      const prior = (await f.admin.query('SELECT permissoes FROM profiles WHERE id=$1', [ID.runtimeActorA])).rows[0].permissoes;
      await f.admin.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [ID.runtimeActorA]);
      assert.equal((await get('a', ID.groupA)).status, 403);
      await f.admin.query('UPDATE profiles SET permissoes=$1 WHERE id=$2', [prior, ID.runtimeActorA]);
    } finally { await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve())); }
    const restricted = f.data.pool as pg.Pool & { options: pg.PoolConfig };
    const secondPool = new pg.Pool({ ...restricted.options });
    try {
      const secondConnection = deps(secondPool);
      const opened = await reopenAssistedClientReview(identity, scope, secondConnection);
      assert.equal(opened?.id, saved.id);
      assert.equal(opened?.correctionStatus, null);
      assert.equal(opened?.record.status, 'REVIEW_REQUIRED');
      assert.equal(opened?.record.actions.releaseOperational, false);
      assert.equal(opened?.record.fields.find(field => field.name === 'cpf')?.original, undefined);
      assert.deepEqual(await stageAssistedClientReview(row, scope, secondConnection), { ...saved, replayed: true });
      await assert.rejects(stageAssistedClientReview({ ...row, cpf: '0023' }, scope, secondConnection), /REVIEW_SOURCE_CONFLICT/);
      await assert.rejects(reopenAssistedClientReview(identity, { ...scope, empresaId: ID.empresaA }, secondConnection), /REVIEW_GROUP_SCOPE/);
      assert.equal(await reopenAssistedClientReview(identity, { ...scope, groupId: ID.groupB, actorId: ID.runtimeActorB }, secondConnection), null);
      const command = { operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
        expectedSourceFingerprint: opened!.record.sourceFingerprint, field: 'cpf',
        proposedValue: syntheticCpf(90), reason: 'Verified synthetic source',
        evidenceRefs: [{ ref: 'synthetic-proof', sha256: 'c'.repeat(64) }] };
      await assert.rejects(saveAssistedClientDocumentCorrection(identity, { ...command, proposedValue: '123' }, scope, secondConnection),
        /REVIEW_CANONICAL_DOCUMENT_REQUIRED/);
      await assert.rejects(saveAssistedClientDocumentCorrection(identity, { ...command, evidenceRefs: [] }, scope, secondConnection),
        /REVIEW_MEANING_CHANGE_EVIDENCE_REQUIRED/);
      const correction = await saveAssistedClientDocumentCorrection(identity, command, scope, secondConnection);
      assert.deepEqual(correction, { id: saved.id, replayed: false, status: 'PENDING_CANONICAL_REVALIDATION' });
      assert.deepEqual(await saveAssistedClientDocumentCorrection(identity, command, scope, secondConnection),
        { ...correction, replayed: true });
      await assert.rejects(saveAssistedClientDocumentCorrection(identity, { ...command, proposedValue: syntheticCpf(91) }, scope, secondConnection),
        /REVIEW_CORRECTION_CONFLICT/);
      assert.deepEqual(await reopenAssistedClientReview(identity, scope, secondConnection),
        { ...opened, correctionStatus: 'PENDING_CANONICAL_REVALIDATION' });
      await assert.rejects(archiveAssistedClientReview({ ...identity, ...saved }, scope, secondConnection),
        /REVIEW_ARCHIVE_POSTIMAGE_CHANGED/);
      const otherRow = { ...row, nativeKey: 'NEW-SYNTH-ARCHIVE', sourceIndex: 1 };
      const otherIdentity = { ...identity, nativeKey: otherRow.nativeKey };
      const other = await stageAssistedClientReview(otherRow, scope, secondConnection);
      const receipt = { ...otherIdentity, ...other };
      await assert.rejects(archiveAssistedClientReview({ ...receipt, fingerprint: '0'.repeat(64) }, scope, secondConnection),
        /REVIEW_ARCHIVE_RECEIPT_MISMATCH/);
      assert.deepEqual(await archiveAssistedClientReview(receipt, scope, secondConnection), { id: other.id, replayed: false });
      assert.deepEqual(await archiveAssistedClientReview(receipt, scope, secondConnection), { id: other.id, replayed: true });
      assert.equal(await reopenAssistedClientReview(otherIdentity, scope, secondConnection), null);
      await assert.rejects(stageAssistedClientReview(otherRow, scope, secondConnection), /REVIEW_SOURCE_ARCHIVED/);
      assert.equal((await f.admin.query(`SELECT count(*) n FROM audit_logs
        WHERE entity='LegacyClientReview' AND entity_id=$1 AND action='inactivate'`, [other.id])).rows[0].n, '1');
      assert.equal((await f.admin.query('SELECT archived FROM legacy_client_review WHERE id=$1', [other.id])).rows[0].archived, true);
    } finally {
      await secondPool.end();
    }
    const audit = await f.admin.query(`SELECT action,after_data FROM audit_logs
      WHERE entity='LegacyClientReview' AND entity_id=$1 ORDER BY action`, [saved.id]);
    assert.equal(audit.rowCount, 2);
    assert.deepEqual(Object.keys(audit.rows[0].after_data).sort(), ['fingerprint', 'reason', 'sourceStatus', 'status']);
    assert.deepEqual(Object.keys(audit.rows[1].after_data).sort(), ['commandHash', 'field', 'status']);
    const proof = await f.admin.query(`SELECT record,correction FROM legacy_client_review WHERE id=$1`, [saved.id]);
    assert.equal(proof.rows[0].record.fields.find((field: { name: string }) => field.name === 'cpf').original, row.cpf);
    assert.equal(proof.rows[0].correction.proposedValue, syntheticCpf(90));
    const target = (await firstConnection.db.query(`SELECT current_database() AS database, current_schema() AS schema,
        current_user AS principal,
        (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS "databaseOid",
        (SELECT oid::int FROM pg_namespace WHERE nspname=current_schema()) AS "schemaOid",
        (SELECT system_identifier::text FROM pg_control_system()) AS "clusterIdentifier"`)).rows[0];
    const plan = { target, total: 2, batchSize: 1, expectedState: 'REVIEW_REQUIRED',
      rows: [{ ...row, nativeKey: 'RESUME-1' }, { ...row, nativeKey: 'RESUME-2' }] };
    const pin = (value: typeof plan) => rowHash({ version: 1, groupId: scope.groupId, actorId: scope.actorId,
      target: value.target, expectedState: value.expectedState, batchSize: value.batchSize, total: value.total, rows: value.rows });
    await assert.rejects(runAssistedClientReviewManifest(plan, scope, { ...firstConnection, checkpoint: async () => {} },
      { manifestSha256: '0'.repeat(64) }), /REVIEW_MANIFEST_PIN_MISMATCH/);
    const wrongCount = { ...plan, total: plan.total + 1 };
    await assert.rejects(runAssistedClientReviewManifest(wrongCount, scope, {
      ...firstConnection, checkpoint: async () => { throw new Error('UNEXPECTED_RECEIPT'); },
    }, { manifestSha256: pin(wrongCount) }), /REVIEW_MANIFEST_INVALID/);
    const wrong = { ...plan, target: { ...target, database: 'wrong_database' } };
    await assert.rejects(runAssistedClientReviewManifest(wrong, scope, { ...firstConnection, checkpoint: async () => {} },
      { manifestSha256: pin(wrong) }), /REVIEW_PHYSICAL_TARGET_MISMATCH/);
    await assert.rejects(runAssistedClientReviewManifest(plan, scope, {
      ...firstConnection, checkpoint: async () => { throw new Error('AFTER_COMMIT'); },
    }, { manifestSha256: pin(plan) }), /AFTER_COMMIT/);
    const stagedCount = async () => (await f.admin.query(`SELECT count(*) n FROM legacy_client_review
      WHERE native_key LIKE 'RESUME-%'`)).rows[0].n;
    assert.equal(await stagedCount(), '1');
    const offsets: number[] = [];
    const resumed = await runAssistedClientReviewManifest(plan, scope, {
      ...firstConnection, checkpoint: async (receipt: { offset: number }) => { offsets.push(receipt.offset); },
    }, { manifestSha256: pin(plan) });
    assert.equal(resumed.total, 2);
    assert.deepEqual(offsets, [0, 1]);
    assert.equal(await stagedCount(), '2');
    assert.equal((await f.admin.query(`SELECT count(*) n FROM audit_logs a JOIN legacy_client_review r ON a.entity_id=r.id::text
      WHERE r.native_key LIKE 'RESUME-%' AND a.entity='LegacyClientReview'`)).rows[0].n, '2');
    if (process.platform !== 'win32') {
      const dir = await mkdtemp(join(tmpdir(), 'erp-review-receipts-'));
      try {
        const filePlan = { ...plan, total: 1, rows: [{ ...row, nativeKey: 'FILE-RESUME-1' }] };
        const manifestSha256 = pin(filePlan);
        const bytes = Buffer.from(JSON.stringify({ input: filePlan, context: scope, manifestSha256 }));
        await writeFile(join(dir, 'manifest.private.json'), bytes, { mode: 0o600 });
        await writeFile(join(dir, 'approval.private.json'), JSON.stringify({
          approved: true, artifactSha256: sha(bytes), manifestSha256,
        }), { mode: 0o600 });
        const args = [dir, 'manifest.private.json', 'approval.private.json'];
        await assert.rejects(runPrivateAssistedReviewCommand(args, process.cwd(), {
          ...firstConnection, beforeReceipt: async () => { throw new Error('POST_COMMIT_NO_FILE'); },
        }), /POST_COMMIT_NO_FILE/);
        assert.equal((await readdir(dir)).length, 2);
        const restricted = f.data.pool as pg.Pool & { options: pg.PoolConfig };
        await writeFile(join(dir, 'db.private.json'), JSON.stringify({
          databaseUrl: restricted.options.connectionString, schema: f.schema,
        }), { mode: 0o600 });
        const command = fileURLToPath(new URL('../../scripts/legado/run-assisted-client-review.mjs', import.meta.url));
        for (let attempt = 0; attempt < 2; attempt++) {
          const cli = spawnSync(process.execPath, [command, ...args, 'db.private.json'], { encoding: 'utf8', timeout: 15000 });
          assert.equal(cli.status, 0, cli.stderr);
          assert.deepEqual(JSON.parse(cli.stdout), { status: 'REVIEW_COMPLETE', manifestSha256, total: 1, groups: 1 });
        }
        const receipt = join(dir, `review-${manifestSha256}-0.private.json`);
        assert.equal((await stat(receipt)).mode & 0o777, 0o600);
        const savedReceipt = JSON.parse(await readFile(receipt, 'utf8'));
        assert.equal(savedReceipt.groupId, scope.groupId);
        assert.equal(savedReceipt.total, 1);
        assert.equal((await f.admin.query(`SELECT count(*) n FROM audit_logs a JOIN legacy_client_review r ON a.entity_id=r.id::text
          WHERE r.native_key='FILE-RESUME-1' AND a.entity='LegacyClientReview'`)).rows[0].n, '1');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
    assert.equal((await f.admin.query('SELECT count(*) n FROM clientes')).rows[0].n, before);
  } finally {
    await f.close();
  }
});
