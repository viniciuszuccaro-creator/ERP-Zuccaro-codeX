import assert from 'node:assert/strict';
import test from 'node:test';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { PostgresProdutoRepository } from '../src/repositories/postgresProdutoRepository.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';
import { CatalogOutbox } from '../src/integrations/catalogOutbox.js';
import { CatalogOutboxWorker } from '../src/integrations/catalogOutboxWorker.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;

test('real PostgreSQL interrupted worker retains idempotency, rejects late ACK and recovers with audit gates',{skip:!url},async()=>{
  const f=await outboxFixture(await isolatedPostgres(url!));
  try{
    const ids=[await f.event(),await f.event()];const abort=new AbortController();
    let late:()=>void=()=>{};let sentId='';let sentKey='';
    const worker=new CatalogOutboxWorker(f.outbox,{publish:async(input,signal)=>{
      sentId=input.eventId;sentKey=input.key;abort.abort('PRIVATE_STOP_REASON');assert.equal(signal.aborted,true);
      return new Promise(resolve=>{late=()=>resolve({eventId:input.eventId,key:input.key});});
    }});
    assert.deepEqual(await worker.runOnce(f.ctx,10,abort.signal),{published:0,retry:1,dead_letter:0});
    late();await new Promise(resolve=>setImmediate(resolve));
    const rows=(await f.pg.query('SELECT id,status,attempts,error_message,idempotency_key FROM integration_events ORDER BY id')).rows;
    assert.equal(rows.find(r=>r.id===sentId)?.status,'retry');assert.equal(rows.find(r=>r.id===sentId)?.idempotency_key,sentKey);
    assert.equal(rows.filter(r=>r.status==='pending'&&r.attempts===0).length,1);
    assert.equal((await f.outbox.failures(f.ctx)).items[0].code,'CATALOG_RUN_INTERRUPTED');
    assert.ok(!JSON.stringify((await f.pg.query('SELECT * FROM audit_logs')).rows).includes('PRIVATE_STOP_REASON'));
    await f.pg.query('UPDATE integration_events SET next_attempt_at=clock_timestamp() WHERE id=$1',[sentId]);
    const delivered:string[]=[];
    const resumed=new CatalogOutboxWorker(f.outbox,{publish:async(input)=>{delivered.push(input.eventId);return{eventId:input.eventId,key:input.key};}});
    assert.deepEqual(await resumed.runOnce(f.ctx),{published:2,retry:0,dead_letter:0});
    assert.deepEqual(delivered.sort(),ids.sort());
    assert.equal((await f.pg.query('SELECT attempts FROM integration_events WHERE id=$1',[sentId])).rows[0].attempts,2);
    const next=await f.event();const failing=new AbortController();
    await f.pg.exec(`CREATE FUNCTION reject_stop_retry_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.after_data->>'status'='retry' THEN RAISE EXCEPTION 'SYNTHETIC_STOP_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER stop_retry_audit AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_stop_retry_audit();`);
    const failed=new CatalogOutboxWorker(f.outbox,{publish:async()=>{failing.abort();return new Promise(()=>{});}});
    await assert.rejects(()=>failed.runOnce(f.ctx,1,failing.signal));
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1',[next])).rows[0].status,'processing');
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE entity_id=$1 AND after_data->>'status'='retry'",[next])).rows.length,0);
  }finally{await f.close();}
});

test('real PostgreSQL selection reprocess locks consistently, schedules once and rolls back the final audit',{skip:!url},async()=>{
  const f=await outboxFixture(await isolatedPostgres(url!));
  try{
    const ids=[await f.event(),await f.event()].sort();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',attempts=3 WHERE id=ANY($1::uuid[])",[ids]);
    const selection=ids.map((id,i)=>({id,additionalAttempts:i+1}));
    const race=await Promise.allSettled([f.outbox.reprocess(f.ctx,selection),f.outbox.reprocess(f.ctx,[...selection].reverse())]);
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    const rejected=race.find(r=>r.status==='rejected');assert.ok(rejected&&rejected.status==='rejected');
    assert.equal(rejected.reason.code,'OUTBOX_EVENT_NOT_FOUND');
    const rows=(await f.pg.query('SELECT id,status,attempts,max_attempts FROM integration_events ORDER BY id')).rows;
    assert.deepEqual(rows,ids.map((id,i)=>({id,status:'retry',attempts:3,max_attempts:4+i})));
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='update'")).rows.length,2);
    // A new operator selection is permitted only after both events return to dead letter.
    await f.pg.query("UPDATE integration_events SET status='dead_letter',attempts=5,max_attempts=5 WHERE id=ANY($1::uuid[])",[ids]);
    const before=(await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows;
    const count=(await f.pg.query('SELECT id FROM audit_logs')).rows.length;
    await f.pg.exec(`CREATE FUNCTION reject_final_reprocess_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity_id='${ids[1]}' THEN RAISE EXCEPTION 'SYNTHETIC_FINAL_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER final_reprocess_audit AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_final_reprocess_audit();`);
    await assert.rejects(()=>f.outbox.reprocess(f.ctx,selection));
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows,before);
    assert.equal((await f.pg.query('SELECT id FROM audit_logs')).rows.length,count);
    await f.pg.exec('DROP TRIGGER final_reprocess_audit ON audit_logs');
    await f.outbox.reprocess(f.ctx,selection);
    const leases=await f.outbox.claim(f.ctx,2);assert.equal(leases.length,2);assert.ok(leases.every(l=>l.attempt===6));
    assert.equal(new Set(leases.map(l=>l.id)).size,2);
    await Promise.all(leases.map(l=>f.outbox.finish(f.ctx,l,{status:'published'})));
    assert.deepEqual(await f.outbox.summary(f.ctx),[{status:'published',total:2}]);
  }finally{await f.close();}
});
test('PostgreSQL outbox claims are disjoint under concurrent consumers and preserve original Produto publisher', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    await f.pg.exec('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    const repo = new PostgresProdutoRepository(f.db);
    const product = await repo.getById({ groupId: S.groupA, empresaId: S.empresaA }, S.produtoA);
    assert.ok(product);
    // Actual existing producer, with synthetic approved product signal and its idempotence intact.
    for (let i = 0; i < 8; i++) {
      await repo.appendPublicationEvent({ groupId: S.groupA, empresaId: S.empresaA }, { ...product, workflow_status: 'PUBLICADO' }, `synthetic-${i}`);
    }
    await repo.appendPublicationEvent({ groupId: S.groupA, empresaId: S.empresaA }, { ...product, workflow_status: 'PUBLICADO' }, 'synthetic-0');
    const leases = (await Promise.all(Array.from({ length: 4 }, () => f.outbox.claim(f.ctx, 2)))).flat();
    assert.equal(leases.length, 8); assert.equal(new Set(leases.map((x) => x.id)).size, 8);
    assert.ok(leases.every((x) => x.attempt === 1));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await Promise.all(leases.map((lease) => f.outbox.finish(f.ctx, lease, { status: 'published' })));
    assert.deepEqual(await f.outbox.summary(f.ctx), [{ status: 'published', total: 8 }]);
  } finally { await f.close(); }
});

test('real PostgreSQL failure triage preserves microsecond cursors, metadata privacy, audit atomicity and permission revocation', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    const own = await Promise.all(Array.from({ length: 3 }, () => f.event()));
    const other = await f.event({ empresa: S.empresaA2 });
    const unrelated = await f.event({ type: 'unrelated.event' });
    const live = await f.event();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',error_message='PRIVATE_PROVIDER_VALUE' WHERE id=ANY($1::uuid[])", [[...own,other,unrelated]]);
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE id=ANY($1::uuid[])", [own]);
    await f.pg.query("UPDATE integration_events SET status='retry',error_message='CATALOG_PROVIDER_UNAVAILABLE' WHERE id=$1", [own[1]]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()-interval '1 second',error_message=NULL WHERE id=$1", [own[2]]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()+interval '1 hour' WHERE id=$1", [live]);
    const before = (await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows;
    let cursor: { id: string; createdAt: string } | undefined;
    const found: string[] = [];
    // Bound iteration explicitly: a timestamp precision regression fails instead of hanging CI.
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const page = await f.outbox.failures(f.ctx, 1, cursor);
      assert.equal(page.items.length, 1);
      assert.equal(page.items[0].createdAt, '2026-01-01T00:00:00.123456Z');
      assert.equal(page.reprocessApplied, false);
      assert.ok(!JSON.stringify(page).includes('PRIVATE_PROVIDER_VALUE'));
      assert.ok(!('payload' in page.items[0])); assert.ok(!('key' in page.items[0]));
      found.push(page.items[0].id);
      if (!page.hasMore) break;
      assert.ok(page.nextCursor); cursor = page.nextCursor;
    }
    assert.deepEqual(found.sort(), [...own].sort());
    const full = await f.outbox.failures(f.ctx);
    assert.equal(full.items.find((r) => r.id === own[0])?.code, 'OUTBOX_ERROR_REDACTED');
    assert.equal(full.items.find((r) => r.id === own[1])?.code, 'CATALOG_PROVIDER_UNAVAILABLE');
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows, before);
    const auditCount = async () => (await f.pg.query<{ total: number }>('SELECT count(*)::int total FROM audit_logs')).rows[0].total;
    const count = await auditCount();
    assert.ok(count >= 4);
    // Append the real audit in the same transaction, then simulate its failure; no partial audit may commit.
    const failing = new CatalogOutbox(f.db, { ...f.runtime, auditRepo: { ...f.runtime.auditRepo,
      append: async (...args: Parameters<typeof f.runtime.auditRepo.append>) => {
        await f.runtime.auditRepo.append(...args); throw new Error('synthetic audit failure');
      },
    } });
    await assert.rejects(failing.failures(f.ctx), /synthetic audit failure/);
    assert.equal(await auditCount(), count);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [S.runtimeActorA]);
    await assert.rejects(f.outbox.failures(f.ctx), (e: any) => e.statusCode === 403);
    assert.equal(await auditCount(), count);
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows, before);
  } finally { await f.close(); }
});
