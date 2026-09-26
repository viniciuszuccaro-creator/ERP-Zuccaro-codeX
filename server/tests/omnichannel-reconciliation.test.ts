import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogReconciliation } from '../src/integrations/catalogReconciliation.js';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

test('reconciliation is paginated, idempotent, scoped and never mistakes missing/invalid/unavailable ACKs for consistency', async () => {
  const f = await outboxFixture();
  try {
    const ids = await Promise.all(Array.from({ length: 4 }, () => f.event()));
    const leases = await f.outbox.claim(f.ctx);
    for (const lease of leases) await f.outbox.finish(f.ctx, lease, { status: 'published' });
    const reconcile = new CatalogReconciliation(f.outbox, 'synthetic-site', { probe: async (input) => {
      const i = ids.indexOf(input.eventId);
      if (i === 0) return input;
      if (i === 1) return null;
      if (i === 2) return { ...input, secret: 'SYNTHETIC_PRIVATE_VALUE' };
      throw new Error('SYNTHETIC_PRIVATE_ERROR');
    } });
    const first = await reconcile.runPage(f.ctx, 'scan-1', 2);
    assert.equal(first.counts.examined, 2); assert.equal(first.scope, 'PAGE'); assert.equal(first.correctionApplied, false);
    assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
    const second = await reconcile.runPage(f.ctx, 'scan-1', 2, first.nextCursor);
    assert.equal(second.hasMore, false); assert.equal(second.counts.examined, 2);
    for (const state of ['CONSISTENT','MISSING','CONFLICT','UNAVAILABLE'] as const) assert.equal(first.counts[state] + second.counts[state], 1);
    const repeated = await reconcile.runPage(f.ctx, 'scan-1', 2);
    assert.deepEqual(repeated.counts, first.counts);
    const rows = (await f.pg.query("SELECT payload FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows;
    assert.equal(rows.length, 4); assert.ok(!JSON.stringify(rows).includes('SYNTHETIC_PRIVATE'));
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='produto.publicado' AND status='published'")).rows.length, 4);
  } finally { await f.close(); }
});

test('reconciliation refuses changed scan outcomes, cross-company sources and revoked permission without provider-side correction', async () => {
  const f = await outboxFixture();
  try {
    await f.event(); const [lease] = await f.outbox.claim(f.ctx); await f.outbox.finish(f.ctx, lease, { status: 'published' });
    const source = (await f.outbox.publishedPage(f.ctx, 1)).items[0];
    await f.outbox.recordReconciliation(f.ctx, source, 'synthetic', 'same-key', 'MISSING', null);
    await assert.rejects(() => f.outbox.recordReconciliation(f.ctx, source, 'synthetic', 'same-key', 'CONSISTENT', null), (e: unknown) => (e as { code: string }).code === 'CATALOG_SCAN_CONFLICT');
    await f.pg.query('UPDATE profiles SET empresa_id=NULL WHERE id=$1', [S.runtimeActorA]);
    assert.equal((await f.outbox.publishedPage({ ...f.ctx, empresaId: S.empresaA2 }, 10)).items.length, 0);
    await assert.rejects(() => f.outbox.recordReconciliation({ ...f.ctx, empresaId: S.empresaA2 }, source, 'synthetic', 'x', 'MISSING', null));
    await f.pg.query('UPDATE profiles SET ativo=false WHERE id=$1', [S.runtimeActorA]);
    await assert.rejects(() => f.outbox.publishedPage(f.ctx, 10));
  } finally { await f.close(); }
});

test('reconciliation record is atomic with audit and detects source mutation while observer is running', async () => {
  const f = await outboxFixture();
  try {
    await f.event(); const [lease] = await f.outbox.claim(f.ctx); await f.outbox.finish(f.ctx, lease, { status: 'published' });
    const source = (await f.outbox.publishedPage(f.ctx, 1)).items[0];
    await f.pg.exec(`CREATE FUNCTION reject_reconciliation_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' AND NEW.action='create' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER reconciliation_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_reconciliation_audit();`);
    await assert.rejects(() => f.outbox.recordReconciliation(f.ctx, source, 'synthetic', 'audit', 'MISSING', null));
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows.length, 0);
    await f.pg.exec('DROP TRIGGER reconciliation_fail ON audit_logs');
    const reconcile = new CatalogReconciliation(f.outbox, 'synthetic', { probe: async (input) => {
      await f.pg.query("UPDATE integration_events SET status='retry' WHERE id=$1", [input.eventId]); return input;
    } });
    await assert.rejects(() => reconcile.runPage(f.ctx, 'changed'), (e: unknown) => (e as { code: string }).code === 'CATALOG_SOURCE_CHANGED');
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows.length, 0);
  } finally { await f.close(); }
});
