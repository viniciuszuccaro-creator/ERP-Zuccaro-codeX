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
    const failing = new CatalogOutbox(f.integrationDb,{ ...f.runtime,auditRepo:{ ...f.runtime.auditRepo,append:async () => { throw new Error('audit failure'); } } });
    await assert.rejects(failing.health(f.ctx,60),/audit failure/);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    await assert.rejects(f.outbox.health(f.ctx,60),(e: any) => e.statusCode===403);
  } finally { await f.close(); }
});

test('failure triage pages metadata only, masks legacy errors and identifies expired leases without mutating queue', async () => {
  const f = await outboxFixture();
  try {
    const ids = await Promise.all(Array.from({length:3},() => f.event()));
    const privateEvent = await f.event({empresa:S.empresaA2});
    const unrelated = await f.event({type:'unrelated.event'});
    const liveLease = await f.event();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',error_message='PRIVATE_CUSTOMER_DATA' WHERE id=$1",[ids[0]]);
    await f.pg.query("UPDATE integration_events SET status='retry',error_message='CATALOG_PROVIDER_UNAVAILABLE',next_attempt_at=now()+interval '1 hour' WHERE id=$1",[ids[1]]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()-interval '1 second' WHERE id=$1",[ids[2]]);
    await f.pg.query("UPDATE integration_events SET status='dead_letter' WHERE id IN ($1,$2)",[privateEvent,unrelated]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()+interval '1 hour' WHERE id=$1",[liveLease]);
    // Keep microsecond precision so a one-row cursor cannot return the same row repeatedly.
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE id=ANY($1::uuid[])",[ids]);
    const before = (await f.pg.query('SELECT id,status,attempts,locked_until FROM integration_events ORDER BY id')).rows;
    const found: string[]=[]; let cursor: {id:string;createdAt:string}|undefined;
    do {
      const page=await f.outbox.failures(f.ctx,1,cursor);
      assert.equal(page.scope,'COMPANY'); assert.equal(page.reprocessApplied,false);
      assert.equal(page.items.length,1); found.push(page.items[0].id);
      assert.ok(!JSON.stringify(page).includes('PRIVATE_CUSTOMER_DATA'));
      assert.ok(!('payload' in page.items[0])); assert.ok(!('key' in page.items[0]));
      cursor=page.nextCursor??undefined;
    } while(cursor);
    assert.deepEqual(found.sort(),[...ids].sort());
    const page=await f.outbox.failures(f.ctx);
    assert.equal(page.items.find((r)=>r.id===ids[0])?.code,'OUTBOX_ERROR_REDACTED');
    assert.equal(page.items.find((r)=>r.id===ids[1])?.code,'CATALOG_PROVIDER_UNAVAILABLE');
    assert.deepEqual((await f.pg.query('SELECT id,status,attempts,locked_until FROM integration_events ORDER BY id')).rows,before);
    assert.ok((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length>=4);
  } finally { await f.close(); }
});

test('failure triage rejects malformed bounds and blocks response on audit failure or read revocation', async () => {
  const f=await outboxFixture();
  try {
    await assert.rejects(f.outbox.failures(f.ctx,101),(e:any)=>e.code==='CATALOG_PAGE_INVALID');
    await assert.rejects(f.outbox.failures(f.ctx,1,{id:'invalid',createdAt:'invalid'}),(e:any)=>e.code==='CATALOG_PAGE_INVALID');
    const failing=new CatalogOutbox(f.integrationDb,{...f.runtime,auditRepo:{...f.runtime.auditRepo,append:async()=>{throw new Error('audit failure');}}});
    await assert.rejects(failing.failures(f.ctx),/audit failure/);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    await assert.rejects(f.outbox.failures(f.ctx),(e:any)=>e.statusCode===403);
  } finally { await f.close(); }
});
