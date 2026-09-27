import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogOutboxWorker } from '../src/integrations/catalogOutboxWorker.js';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

test('catalog stop before a run leaves queue untouched and stop after claim returns the lease without sending',async()=>{
  const f=await outboxFixture();
  try{
    const id=await f.event();await f.event();const stopped=new AbortController();stopped.abort('PRIVATE_SYNTHETIC_REASON');
    const worker=new CatalogOutboxWorker(f.outbox,{publish:async()=>{assert.fail('No provider call after stop');}});
    assert.deepEqual(await worker.runOnce(f.ctx,10,stopped.signal),{published:0,retry:0,dead_letter:0});
    assert.ok((await f.pg.query('SELECT status,attempts FROM integration_events')).rows.every(r=>r.status==='pending'&&r.attempts===0));
    assert.equal((await f.pg.query('SELECT id FROM audit_logs')).rows.length,0);
    const abort=new AbortController();const claim=f.outbox.claim.bind(f.outbox);
    f.outbox.claim=async(...args)=>{const leases=await claim(...args);abort.abort();return leases;};
    assert.deepEqual(await worker.runOnce(f.ctx,10,abort.signal),{published:0,retry:1,dead_letter:0});
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1',[id])).rows[0].status,'retry');
    assert.ok(!JSON.stringify((await f.pg.query('SELECT * FROM audit_logs')).rows).includes('PRIVATE_SYNTHETIC_REASON'));
  }finally{await f.close();}
});

test('catalog in-flight stop bounds an ignoring provider, fences late ACK and preserves subsequent events',async()=>{
  const f=await outboxFixture();
  try{
    const ids=[await f.event(),await f.event()];const abort=new AbortController();let calls=0;
    let complete:()=>void=()=>{};let offeredSignal:AbortSignal|undefined;
    const worker=new CatalogOutboxWorker(f.outbox,{publish:async(input,signal)=>{
      calls++;offeredSignal=signal;abort.abort('PRIVATE_STOP');
      return new Promise(resolve=>{complete=()=>resolve({eventId:input.eventId,key:input.key});});
    }});
    assert.deepEqual(await worker.runOnce(f.ctx,10,abort.signal),{published:0,retry:1,dead_letter:0});
    assert.equal(calls,1);assert.equal(offeredSignal?.aborted,true);
    complete();await new Promise(resolve=>setImmediate(resolve));
    const rows=(await f.pg.query('SELECT status,attempts,error_message FROM integration_events WHERE id=ANY($1::uuid[])',[ids])).rows;
    assert.equal(rows.filter(r=>r.status==='retry'&&r.error_message==='CATALOG_RUN_INTERRUPTED').length,1);
    assert.equal(rows.filter(r=>r.status==='pending'&&r.attempts===0).length,1);
    const triage=await f.outbox.failures(f.ctx);assert.equal(triage.items[0].code,'CATALOG_RUN_INTERRUPTED');
    assert.ok(!JSON.stringify(triage).includes('PRIVATE_STOP'));
  }finally{await f.close();}
});

test('catalog interruption respects retry budget and audit failure propagates with lease retained',async()=>{
  const f=await outboxFixture();
  try{
    await f.event({max:1});const abort=new AbortController();
    const worker=new CatalogOutboxWorker(f.outbox,{publish:async()=>{abort.abort();return new Promise(()=>{});}});
    assert.deepEqual(await worker.runOnce(f.ctx,1,abort.signal),{published:0,retry:0,dead_letter:1});
    const next=await f.event();const later=new AbortController();
    await f.pg.exec(`CREATE FUNCTION reject_interruption_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.after_data->>'status'='retry' THEN RAISE EXCEPTION 'SYNTHETIC_INTERRUPTION_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER interruption_audit_fail AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_interruption_audit();`);
    const failed=new CatalogOutboxWorker(f.outbox,{publish:async()=>{later.abort();return new Promise(()=>{});}});
    await assert.rejects(()=>failed.runOnce(f.ctx,1,later.signal));
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1',[next])).rows[0].status,'processing');
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE after_data->>'status'='retry'")).rows.length,0);
  }finally{await f.close();}
});

test('catalog selection reprocess is bounded, tenant-scoped and preserves explicit per-event budgets',async()=>{
  const f=await outboxFixture();
  try{
    const a=await f.event(),b=await f.event(),foreign=await f.event({empresa:S.empresaA2}),unrelated=await f.event({type:'unrelated.event'}),live=await f.event();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',attempts=3,dead_letter_at=clock_timestamp(),error_message='PRIVATE_SYNTHETIC' WHERE id=ANY($1::uuid[])",[[a,b,foreign,unrelated]]);
    const before=(await f.pg.query('SELECT id,status,attempts,max_attempts FROM integration_events ORDER BY id')).rows;
    for(const selection of [[],[{id:a,additionalAttempts:0}],[{id:a,additionalAttempts:11}],Array(26).fill({id:a,additionalAttempts:1}),
      [{id:a,additionalAttempts:1},{id:a.toUpperCase(),additionalAttempts:2}]]){
      await assert.rejects(()=>f.outbox.reprocess(f.ctx,selection),(e:any)=>e.code==='OUTBOX_REPROCESS_INVALID');
    }
    for(const id of [foreign,unrelated,live,'11111111-1111-4111-8111-111111111111']){
      await assert.rejects(()=>f.outbox.reprocess(f.ctx,[{id:a,additionalAttempts:1},{id,additionalAttempts:1}]),(e:any)=>e.code==='OUTBOX_EVENT_NOT_FOUND');
    }
    assert.deepEqual((await f.pg.query('SELECT id,status,attempts,max_attempts FROM integration_events ORDER BY id')).rows,before);
    assert.deepEqual(await f.outbox.reprocess(f.ctx,[{id:b,additionalAttempts:4},{id:a.toUpperCase(),additionalAttempts:1}]),{scheduled:[b,a]});
    const rows=(await f.pg.query('SELECT id,status,attempts,max_attempts,error_message,locked_until FROM integration_events WHERE id=ANY($1::uuid[]) ORDER BY id',[[a,b]])).rows;
    assert.ok(rows.every(r=>r.status==='retry'&&r.attempts===3&&r.error_message===null&&r.locked_until===null));
    assert.equal(rows.find(r=>r.id===a)?.max_attempts,4);assert.equal(rows.find(r=>r.id===b)?.max_attempts,7);
    const audit=(await f.pg.query("SELECT * FROM audit_logs WHERE entity='IntegracaoEvento' AND action='update'")).rows;
    assert.equal(audit.length,2);assert.ok(!JSON.stringify(audit).includes('PRIVATE_SYNTHETIC'));
    await assert.rejects(()=>f.outbox.reprocess(f.ctx,[{id:a,additionalAttempts:1}]),(e:any)=>e.code==='OUTBOX_EVENT_NOT_FOUND');
    assert.deepEqual(await f.outbox.summary(f.ctx),[{status:'pending',total:1},{status:'retry',total:2}]);
  }finally{await f.close();}
});

test('catalog selection reprocess rolls back every event when the last audit fails and blocks revoked permission',async()=>{
  const f=await outboxFixture();
  try{
    const ids=[await f.event(),await f.event()].sort();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',attempts=2 WHERE id=ANY($1::uuid[])",[ids]);
    const selection=ids.map(id=>({id,additionalAttempts:2}));
    const before=(await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows;
    await f.pg.exec(`CREATE FUNCTION reject_selection_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity_id='${ids[1]}' THEN RAISE EXCEPTION 'SYNTHETIC_BATCH_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER selection_audit_fail AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_selection_audit();`);
    await assert.rejects(()=>f.outbox.reprocess(f.ctx,selection));
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows,before);
    assert.equal((await f.pg.query('SELECT id FROM audit_logs')).rows.length,0);
    await f.pg.exec('DROP TRIGGER selection_audit_fail ON audit_logs');
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    await assert.rejects(()=>f.outbox.reprocess(f.ctx,selection),(e:any)=>e.statusCode===403);
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows,before);
  }finally{await f.close();}
});

test('catalog worker filters existing events, validates signal and receipt and audits outcomes without provider PII', async () => {
  const f = await outboxFixture();
  try {
    const published = await f.event(); const invalid = await f.event({ payload: { secret: 'PRIVATE_SYNTHETIC' } });
    await f.event({ empresa: S.empresaA2 }); await f.event({ type: 'venda.recebida' });
    const inputs: unknown[] = [];
    const worker = new CatalogOutboxWorker(f.outbox, { publish: async (input) => { inputs.push(input); return { eventId: input.eventId, key: input.key }; } });
    assert.deepEqual(await worker.runOnce(f.ctx), { published: 1, retry: 0, dead_letter: 1 });
    assert.equal(inputs.length, 1); assert.ok(!JSON.stringify(inputs).includes('PRIVATE_SYNTHETIC'));
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1', [published])).rows[0].status, 'published');
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1', [invalid])).rows[0].status, 'dead_letter');
    const summary = await f.outbox.summary(f.ctx);
    assert.deepEqual(summary, [{ status: 'dead_letter', total: 1 }, { status: 'published', total: 1 }]);
    assert.ok(!JSON.stringify((await f.pg.query('SELECT * FROM audit_logs')).rows).includes('PRIVATE_SYNTHETIC'));
  } finally { await f.close(); }
});

test('catalog lease fences stale outcomes, expires to retry and preserves generation on explicit reprocess', async () => {
  const f = await outboxFixture();
  try {
    const id = await f.event({ max: 2 });
    const [first] = await f.outbox.claim(f.ctx);
    await assert.rejects(() => f.outbox.finish(f.ctx, { ...first, key: 'wrong-key' }, { status: 'published' }));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await f.pg.query("UPDATE integration_events SET locked_until=clock_timestamp()-interval '1 second' WHERE id=$1", [id]);
    const [second] = await f.outbox.claim(f.ctx);
    assert.equal(second.attempt, 2);
    await assert.rejects(() => f.outbox.finish(f.ctx, first, { status: 'published' }), (e: unknown) => (e as { code: string }).code === 'OUTBOX_LEASE_STALE');
    assert.equal(await f.outbox.finish(f.ctx, second, { status: 'retry', code: 'SYNTHETIC_TRANSIENT' }), 'dead_letter');
    await f.outbox.reprocess(f.ctx, id, 2);
    const [third] = await f.outbox.claim(f.ctx); assert.equal(third.attempt, 3); assert.equal(third.key, first.key);
    await assert.rejects(() => f.outbox.finish(f.ctx, second, { status: 'published' }));
    assert.equal(await f.outbox.finish(f.ctx, third, { status: 'published' }), 'published');
  } finally { await f.close(); }
});

test('catalog permissions and tenant are rechecked for every outcome; audit failure rolls back claim and completion', async () => {
  const f = await outboxFixture();
  try {
    await f.event();
    await assert.rejects(() => f.outbox.claim({ ...f.ctx, empresaId: S.empresaB }));
    await assert.rejects(() => f.outbox.claim({ ...f.ctx, empresaId: null }));
    await f.pg.exec(`CREATE FUNCTION reject_catalog_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' AND NEW.action='update' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER catalog_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit();`);
    await assert.rejects(() => f.outbox.claim(f.ctx));
    assert.equal((await f.pg.query('SELECT attempts FROM integration_events')).rows[0].attempts, 0);
    await f.pg.exec('DROP TRIGGER catalog_fail ON audit_logs');
    const [lease] = await f.outbox.claim(f.ctx);
    await f.pg.query('UPDATE profiles SET ativo=false WHERE id=$1', [S.runtimeActorA]);
    await assert.rejects(() => f.outbox.finish(f.ctx, lease, { status: 'published' }));
    await f.pg.query('UPDATE profiles SET ativo=true WHERE id=$1', [S.runtimeActorA]);
    await f.pg.exec('CREATE TRIGGER catalog_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit()');
    await assert.rejects(() => f.outbox.finish(f.ctx, lease, { status: 'published' }));
    assert.equal((await f.pg.query('SELECT status FROM integration_events')).rows[0].status, 'processing');
  } finally { await f.close(); }
});

test('provider exception retries safely, invalid ACK is dead-letter and no external text is persisted', async () => {
  const f = await outboxFixture();
  try {
    const id = await f.event();
    const failed = new CatalogOutboxWorker(f.outbox, { publish: async () => { throw new Error('PRIVATE_PROVIDER_SYNTHETIC'); } });
    assert.deepEqual(await failed.runOnce(f.ctx), { published: 0, retry: 1, dead_letter: 0 });
    assert.ok(!JSON.stringify((await f.pg.query('SELECT error_message FROM integration_events')).rows).includes('PRIVATE_PROVIDER_SYNTHETIC'));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await f.pg.query('UPDATE integration_events SET next_attempt_at=clock_timestamp() WHERE id=$1', [id]);
    const badAck = new CatalogOutboxWorker(f.outbox, { publish: async () => ({ eventId: 'wrong', key: 'wrong' }) });
    assert.deepEqual(await badAck.runOnce(f.ctx), { published: 0, retry: 0, dead_letter: 1 });
    await f.pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify({ Integracoes: { catalogo: ['publicar'] } }), S.runtimeActorA]);
    await assert.rejects(() => f.outbox.reprocess(f.ctx, id, 1));
  } finally { await f.close(); }
});

test('a product no longer published is not sent by a queued publication signal', async () => {
  const f = await outboxFixture();
  try {
    await f.event();
    await f.pg.query("UPDATE produtos SET workflow_status='INATIVO' WHERE id=$1", [S.produtoA]);
    const worker = new CatalogOutboxWorker(f.outbox, { publish: async () => { assert.fail('Provider must not be called'); } });
    assert.deepEqual(await worker.runOnce(f.ctx), { published: 0, retry: 0, dead_letter: 1 });
    assert.equal((await f.pg.query('SELECT error_message FROM integration_events')).rows[0].error_message, 'CATALOG_SOURCE_CHANGED');
  } finally { await f.close(); }
});
