import test from 'node:test';
import assert from 'node:assert/strict';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import type { RequestContext, AuditRepository } from '../src/audit/types.ts';
import { CadastroBulkTransaction, type CadastroBulkAdapter, type CadastroBulkLedger } from '../src/services/cadastroBulkTransaction.ts';
import type { AppliedCadastroBatch, CadastroBulkRow } from '../src/services/cadastroBulkPolicy.ts';

const ctx: RequestContext = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: null,
  actorId: '22222222-2222-4222-8222-222222222222', requestId: 'synthetic' };
const batchId = '33333333-3333-4333-8333-333333333333';
function fixture() {
  let rows: CadastroBulkRow[] = [{ id: 'A', group_id: ctx.groupId, empresa_id: null, ativo: true, nome: 'SYNTHETIC' }];
  let saved: { batch: AppliedCadastroBatch; actorId: string; reversed: boolean } | null = null;
  let auditCount = 0, failAudit = false, deny = false, relationBlocked = false, revokeOnAudit = false, divergentRestore = false, inspectionFailed = false;
  const q: DbQueryExecutor = { query: async () => { throw new Error('Fixture does not implement PostgreSQL'); } };
  const db: DbClient = { query: q.query, pool: null, checkConnection: async () => true, end: async () => {},
    withTenantContext: (_scope, fn) => fn(),
    withTransaction: async fn => {
      const snapshot = structuredClone({ rows, saved, auditCount });
      try { return await fn(q); }
      catch (error) { rows = snapshot.rows; saved = snapshot.saved; auditCount = snapshot.auditCount; throw error; }
    } };
  const ledger: CadastroBulkLedger = {
    lock: async (_ctx, _id, executor) => { assert.equal(executor, q); return saved; },
    insert: async (context, batch, executor) => { assert.equal(executor, q); saved = { batch: structuredClone(batch), actorId: context.actorId ?? '', reversed: false }; },
    markReversed: async (_ctx, _id, executor) => { assert.equal(executor, q); if (!saved) throw new Error('Missing ledger'); saved.reversed = true; },
  };
  const adapter: CadastroBulkAdapter = { entity: 'Cliente', permissionSection: 'cliente',
    inspect: async (_ctx, ids, executor) => { assert.equal(executor, q);
      if (inspectionFailed) throw new Error('SYNTHETIC_COVERAGE_QUERY_FAILED');
      return { rows: structuredClone(rows),
      eligibility: ids.map(id => ({ id, allowed: !relationBlocked, reasons: relationBlocked ? ['ACTIVE_RELATION'] : [] })) }; },
    inactivate: async (_ctx, id, executor) => { assert.equal(executor, q); const row = rows.find(row => row.id === id); if (!row) throw new Error('Missing'); row.ativo = false; return structuredClone(row); },
    restore: async (_ctx, id, executor) => { assert.equal(executor, q); const row = rows.find(row => row.id === id); if (!row) throw new Error('Missing'); row.ativo = true;
      if (divergentRestore) row.nome = 'UNEXPECTED_RESTORE_CHANGE'; return structuredClone(row); },
  };
  const audit: AuditRepository = { listByEntity: async () => [], append: async (entry, executor) => {
    assert.equal(executor, q); assert.equal(JSON.stringify(entry).includes('SYNTHETIC'), false);
    if (failAudit) throw new Error('AUDIT_FAILED'); auditCount++;
    if (revokeOnAudit) deny = true;
  } };
  const service = new CadastroBulkTransaction(db, { assertAllowed: async (_ctx, module, section, _action, options) => {
    assert.equal(module, 'Cadastros'); assert.equal(section, 'cliente'); assert.equal(options?.executor, q);
    assert.equal(options?.allowGlobalWildcard, false); if (deny) throw new Error('DENIED');
  } }, audit, ledger, adapter);
  return { service, db, rows: () => rows, saved: () => saved, audits: () => auditCount,
    failAudit: () => { failAudit = true; }, deny: () => { deny = true; }, block: () => { relationBlocked = true; },
    revokeOnAudit: () => { revokeOnAudit = true; }, divergentRestore: () => { divergentRestore = true; },
    failInspection: () => { inspectionFailed = true; } };
}

test('coordinator uses one executor for mutation, private ledger and sanitized audit; replay does not write', async () => {
  const f = fixture(), preview = await f.service.preview(ctx, ['A']);
  assert.deepEqual(await f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation }), { batchId, affected: 1 });
  assert.equal(f.rows()[0].ativo, false); assert.equal(f.saved()?.batch.items[0].before.ativo, true);
  await assert.rejects(f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation }), /already recorded/);
  assert.equal(f.audits(), 1);
  await f.service.reverse(ctx, batchId); assert.equal(f.rows()[0].ativo, true); assert.equal(f.audits(), 2);
  await assert.rejects(f.service.reverse(ctx, batchId), /already reversed/);
});

test('audit failure rolls back entity and ledger in transactional fixture, not a PostgreSQL proof', async () => {
  const f = fixture(), preview = await f.service.preview(ctx, ['A']); f.failAudit();
  await assert.rejects(f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation }), /AUDIT_FAILED/);
  assert.equal(f.rows()[0].ativo, true); assert.equal(f.saved(), null); assert.equal(f.audits(), 0);
});

test('permission revoked before commit rolls back mutation, batch and audit', async () => {
  const f = fixture(), preview = await f.service.preview(ctx, ['A']); f.revokeOnAudit();
  await assert.rejects(f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation }), /DENIED/);
  assert.equal(f.rows()[0].ativo, true); assert.equal(f.saved(), null); assert.equal(f.audits(), 0);
});

test('divergent restore cannot mark reversal successful and rolls back entity, ledger and audit', async () => {
  const f = fixture(), preview = await f.service.preview(ctx, ['A']);
  await f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation });
  f.divergentRestore();
  await assert.rejects(f.service.reverse(ctx, batchId), /Restored snapshot mismatch/);
  assert.equal(f.rows()[0].ativo, false); assert.equal(f.rows()[0].nome, 'SYNTHETIC');
  assert.equal(f.saved()?.reversed, false); assert.equal(f.audits(), 1);
});

test('changed row, actor, eligibility or tenant invalidates confirmation without writes', async () => {
  for (const change of ['row', 'actor', 'eligibility', 'tenant']) {
    const f = fixture(), preview = await f.service.preview(ctx, ['A']);
    const context = { ...ctx };
    if (change === 'row') f.rows()[0].nome = 'EXTERNAL_EDIT';
    if (change === 'actor') context.actorId = batchId;
    if (change === 'tenant') context.empresaId = batchId;
    if (change === 'eligibility') f.block();
    await assert.rejects(f.service.execute(context, { batchId, ids: ['A'], confirmation: preview.confirmation }), /Preview changed/);
    assert.equal(f.rows()[0].ativo, true); assert.equal(f.saved(), null);
  }
});

test('reversal rejects external changes and denied/missing context never mutates', async () => {
  const f = fixture(), preview = await f.service.preview(ctx, ['A']);
  await f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation });
  f.rows()[0].nome = 'EXTERNAL_EDIT';
  await assert.rejects(f.service.reverse(ctx, batchId), /External changes/);
  assert.equal(f.rows()[0].nome, 'EXTERNAL_EDIT'); assert.equal(f.rows()[0].ativo, false);
  f.deny(); await assert.rejects(f.service.preview(ctx, ['A']), /DENIED/);
  assert.throws(() => f.service.preview({ ...ctx, actorId: null }, ['A']), /Authenticated/);
  f.db.withTenantContext = undefined;
  assert.throws(() => f.service.preview(ctx, ['A']), /Authenticated/);
});

test('reversal retains existing restore semantics for references, but inconclusive coverage rolls back', async () => {
  for (const failure of [false, true]) {
    const f = fixture(), preview = await f.service.preview(ctx, ['A']);
    await f.service.execute(ctx, { batchId, ids: ['A'], confirmation: preview.confirmation });
    // References prevent inactivation, not canonical restoration of an unchanged inactive record.
    f.block();
    if (failure) {
      f.failInspection();
      await assert.rejects(f.service.reverse(ctx, batchId), /SYNTHETIC_COVERAGE_QUERY_FAILED/);
      assert.equal(f.rows()[0].ativo, false); assert.equal(f.saved()?.reversed, false); assert.equal(f.audits(), 1);
    } else {
      await f.service.reverse(ctx, batchId);
      assert.equal(f.rows()[0].ativo, true); assert.equal(f.saved()?.reversed, true); assert.equal(f.audits(), 2);
    }
  }
});
