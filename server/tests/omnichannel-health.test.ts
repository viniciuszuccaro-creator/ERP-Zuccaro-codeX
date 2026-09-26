import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogOutbox } from '../src/integrations/catalogOutbox.js';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

test('health isolates company and retains divergence across observers without exposing payloads', async () => {
  const f = await outboxFixture();
  try {
    const pending = await f.event(), processing = await f.event(), dead = await f.event();
    const published = await f.event(), unreconciled = await f.event();
    await f.event({ empresa: S.empresaA2 }); await f.event({ type: 'another.event' });
    await f.pg.query("UPDATE integration_events SET created_at=now()-interval '2 hours' WHERE id=$1", [pending]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()-interval '1 second' WHERE id=$1", [processing]);
    await f.pg.query("UPDATE integration_events SET status='dead_letter',error_message='SYNTHETIC_PRIVATE_ERROR' WHERE id=$1", [dead]);
    await f.pg.query("UPDATE integration_events SET status='published',attempts=1 WHERE id IN ($1,$2)", [published,unreconciled]);
    const source = (await f.outbox.publishedPage(f.ctx,100)).items.find((p) => p.id===published)!;
    await f.outbox.recordReconciliation(f.ctx,source,'site','old','MISSING',null);
    await f.pg.query("UPDATE integration_events SET created_at=now()-interval '1 minute' WHERE event_type='catalogo.reconciliado'");
    await f.outbox.recordReconciliation(f.ctx,source,'site','new','CONSISTENT',null);
    await f.outbox.recordReconciliation(f.ctx,source,'marketplace','new','CONFLICT',null);
    const health = await f.outbox.health(f.ctx,60);
    assert.equal(health.backlog,2); assert.equal(health.overdue,1); assert.equal(health.expiredLeases,1);
    assert.equal(health.deadLetter,1); assert.equal(health.consistent,1); assert.equal(health.divergent,1);
    assert.equal(health.unreconciled,1); assert.ok(health.oldestBacklogSeconds! >= 7200);
    assert.equal(health.scope,'COMPANY'); assert.equal(health.correctiveActionApplied,false);
    assert.ok(!JSON.stringify(health).includes('SYNTHETIC_PRIVATE_ERROR'));
    await f.pg.query('UPDATE integration_events SET attempts=2 WHERE id=$1',[published]);
    const next = await f.outbox.health(f.ctx,60);
    assert.equal(next.consistent,0); assert.equal(next.divergent,0); assert.equal(next.unreconciled,2);
  } finally { await f.close(); }
});

test('health is fail-closed for RBAC, threshold and audit failures', async () => {
  const f = await outboxFixture();
  try {
    await assert.rejects(f.outbox.health(f.ctx,0),(e: any) => e.code==='CATALOG_HEALTH_INVALID');
    await assert.rejects(f.outbox.health(f.ctx,604801),(e: any) => e.code==='CATALOG_HEALTH_INVALID');
    assert.equal((await f.outbox.health(f.ctx,60)).oldestBacklogSeconds,null);
    const failing = new CatalogOutbox(f.db,{ ...f.runtime,auditRepo:{ ...f.runtime.auditRepo,append:async () => { throw new Error('audit failure'); } } });
    await assert.rejects(failing.health(f.ctx,60),/audit failure/);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    await assert.rejects(f.outbox.health(f.ctx,60),(e: any) => e.statusCode===403);
  } finally { await f.close(); }
});
