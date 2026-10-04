import assert from 'node:assert/strict';
import test from 'node:test';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { CatalogReconciliation } from '../src/integrations/catalogReconciliation.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;

test('real PostgreSQL bounded scan resumes equal-microsecond sources after interrupted observation',{skip:!url},async()=>{
  const f=await outboxFixture(await isolatedPostgres(url!));
  try{
    for(let i=0;i<4;i++)await f.event();
    for(const lease of await f.outbox.claim(f.ctx))await f.outbox.finish(f.ctx,lease,{status:'published'});
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE event_type='produto.publicado'");
    const abort=new AbortController();let calls=0;
    const scan=new CatalogReconciliation(f.outbox,'synthetic-site',{probe:async input=>{calls++;if(calls===2){abort.abort();return new Promise(()=>{});}return input;}});
    const first=await scan.runPage(f.ctx,'pg-resume',2,undefined,{maxPages:3,signal:abort.signal});
    assert.equal(first.counts.examined,1);assert.equal(first.interrupted,true);assert.ok(first.nextCursor);
    assert.equal(first.nextCursor.createdAt,'2026-01-01T00:00:00.123456Z');
    const rest=await scan.runPage(f.ctx,'pg-resume',1,first.nextCursor,{maxPages:3});
    assert.equal(rest.counts.CONSISTENT,3);assert.equal(rest.hasMore,false);
    const rows=(await f.pg.query("SELECT payload FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows;
    assert.equal(rows.length,4);assert.equal(new Set(rows.map(r=>(r.payload as {sourceId:string}).sourceId)).size,4);
    assert.ok(rows.every(r=>(r.payload as {state:string}).state==='CONSISTENT'));
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='produto.publicado' AND status='published'")).rows.length,4);
  }finally{await f.close();}
});
test('PostgreSQL reconciliation preserves microsecond cursors and converges concurrent scan writes', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    for (let i=0;i<3;i++) await f.event();
    const leases = await f.outbox.claim(f.ctx);
    for (const lease of leases) await f.outbox.finish(f.ctx, lease, { status: 'published' });
    const ids: string[] = []; let cursor: { id: string; createdAt: string } | undefined;
    do {
      const page = await f.outbox.publishedPage(f.ctx, 1, cursor); assert.equal(page.items.length, 1);
      ids.push(page.items[0].id);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    const source = (await f.outbox.publishedPage(f.ctx, 1)).items[0];
    const results = await Promise.all(Array.from({ length: 8 }, () => f.outbox.recordReconciliation(f.ctx, source, 'synthetic', 'same-scan', 'MISSING', null)));
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows.length, 1);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='create'")).rows.length, 1);
  } finally { await f.close(); }
});

test('real PostgreSQL divergence triage excludes superseded ACK failures and pages current observers', { skip: !url }, async () => {
  const f=await outboxFixture(await isolatedPostgres(url!));
  try {
    await f.event(); const [lease]=await f.outbox.claim(f.ctx);
    await f.outbox.finish(f.ctx,lease,{status:'published'});
    const source=(await f.outbox.publishedPage(f.ctx,1)).items[0];
    await f.outbox.recordReconciliation(f.ctx,source,'site','old','MISSING',null);
    await f.outbox.recordReconciliation(f.ctx,source,'site','new','CONSISTENT',null);
    await f.outbox.recordReconciliation(f.ctx,source,'marketplace','scan','CONFLICT',null);
    await f.outbox.recordReconciliation(f.ctx,source,'chatbot','scan','UNAVAILABLE',null);
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE event_type='catalogo.reconciliado' AND payload->>'observer' IN ('marketplace','chatbot')");
    const a=await f.outbox.divergences(f.ctx,1); assert.ok(a.nextCursor);
    const b=await f.outbox.divergences(f.ctx,1,a.nextCursor);
    assert.equal(b.hasMore,false); assert.notEqual(a.items[0].id,b.items[0].id);
    assert.deepEqual([...a.items,...b.items].map(r=>r.observer).sort(),['chatbot','marketplace']);
    assert.equal(a.items[0].createdAt,'2026-01-01T00:00:00.123456Z');
    await f.pg.query('UPDATE integration_events SET attempts=2 WHERE id=$1',[source.id]);
    assert.deepEqual((await f.outbox.divergences(f.ctx)).items,[]);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows.length,4);
  } finally { await f.close(); }
});
