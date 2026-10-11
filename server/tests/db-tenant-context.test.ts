import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { createPoolDbClient, type DbQueryExecutor } from '../src/db/client.ts';
import { createDbClient } from '../src/db/client.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';

const A = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222' };
const B = { groupId: '33333333-3333-4333-8333-333333333333', empresaId: '44444444-4444-4444-8444-444444444444' };
function fixture(failRollback = false) {
  const events: { id: number; sql: string; params?: unknown[] }[] = [];
  const releases: boolean[] = [];
  let count = 0;
  const pool = {
    query: async (sql: string) => { events.push({ id: 0, sql }); return { rows: [] }; },
    connect: async () => { const id = ++count; return {
      query: async (sql: string, params?: unknown[]) => {
        events.push({ id, sql, params });
        if (sql === 'FAIL' || (failRollback && sql === 'ROLLBACK')) throw new Error(sql);
        return { rows: [{ id, params }] };
      }, release: (discard: boolean) => { releases.push(discard); },
    }; }, end: async () => {},
  } as unknown as Pool;
  return { db: createPoolDbClient(pool), events, releases };
}
test('Tenant context: bootstrap raw, scoped queries isolated and immutable', async () => {
  const { db, events } = fixture();
  await db.query('BOOTSTRAP');
  assert.deepEqual(events, [{ id: 0, sql: 'BOOTSTRAP' }]);
  const input = { ...A };
  await Promise.all([
    db.withTenantContext!(input, async () => { input.groupId = B.groupId; await Promise.resolve(); await db.query('A'); }),
    db.withTenantContext!(B, async () => { await db.query('B'); await db.query('B2'); }),
  ]);
  const configs = events.filter(e => e.sql.includes('set_config'));
  assert.equal(configs.length, 3);
  assert.deepEqual(configs.find(e => events.some(x => x.id === e.id && x.sql === 'A'))?.params, [A.groupId, A.empresaId]);
  assert.equal(new Set(configs.map(e => e.id)).size, 3);
  await db.query('AFTER'); assert.equal(events.at(-1)?.id, 0);
});
test('Tenant context: nested transaction shares executor, caught failure still rolls back', async () => {
  const { db, events, releases } = fixture();
  await assert.rejects(db.withTenantContext!(A, () => db.withTransaction(async outer => {
    await outer.query('WRITE');
    await assert.rejects(db.withTransaction(async inner => { assert.equal(inner, outer); throw new Error('intermediate'); }));
  })), /TRANSACTION_ROLLBACK_REQUIRED/);
  assert.equal(events.filter(e => e.sql === 'BEGIN').length, 1);
  assert.equal(events.filter(e => e.sql === 'COMMIT').length, 0);
  assert.equal(events.filter(e => e.sql === 'ROLLBACK').length, 1);
  assert.deepEqual(releases, [false]);
});
test('Tenant context: mismatch aborts, expired executor and HTTP lifetime cannot issue SQL', async () => {
  const { db, events } = fixture(); let late: DbQueryExecutor;
  await assert.rejects(db.withTenantContext!(A, () => db.withTransaction(async q => {
    assert.throws(() => db.withTenantContext!(B, () => undefined), /TENANT_MISMATCH/);
  })), /ROLLBACK_REQUIRED/);
  await db.withTenantContext!(A, () => db.withTransaction(async q => { late = q; }));
  const before = events.length;
  await assert.rejects(late!.query('LATE'), /EXECUTOR_EXPIRED/);
  let alive = true;
  await db.withTenantContext!(A, async () => { alive = false; await assert.rejects(db.query('LATE_HTTP'), /CONTEXT_EXPIRED/); }, () => alive);
  assert.equal(events.length, before);
});
test('Tenant context: failed rollback discards connection and original failure survives', async () => {
  const { db, releases } = fixture(true);
  await assert.rejects(db.withTenantContext!(A, () => db.withTransaction(q => q.query('FAIL'))), /^Error: FAIL$/);
  assert.deepEqual(releases, [true]);
});
test('Unscoped bootstrap transaction preserves existing savepoint recovery contract', async () => {
  const {db,events}=fixture();
  await db.withTransaction(async q=>{
    await q.query('SAVEPOINT existing');
    await assert.rejects(q.query('FAIL'),/^Error: FAIL$/);
    await q.query('ROLLBACK TO SAVEPOINT existing');
    await q.query('WRITE_AFTER_RECOVERY');
  });
  assert.equal(events.at(-1)?.sql,'COMMIT');
  assert.equal(events.filter(e=>e.sql.includes('set_config')).length,0);
});
test('Tenant HTTP boundary: verified Auth only, bootstrap outside, public paths excluded and lifetime closed', async () => {
  const config = loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'synthetic'});
  const db = createDbClient(config); const installed: unknown[]=[]; let lifetime: (()=>boolean)|undefined; let inside=false;
  db.query = async () => { assert.equal(inside,false,'Auth bootstrap must remain outside tenant'); return {rows:[{id:A.groupId}],rowCount:1,command:'SELECT',oid:0,fields:[]} as any; };
  db.withTenantContext = (scope,fn,alive) => { installed.push(scope); lifetime=alive; inside=true; try{return fn();}finally{inside=false;} };
  const {app} = createApp({config,db,useMemory:true,tenantContextEnabled:true,authFetchImpl:async()=>new Response(JSON.stringify({id:A.groupId}),{status:200})});
  const server=app.listen(0); await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address(); assert(address && typeof address!=='string'); const base=`http://127.0.0.1:${address.port}`;
  try {
    await fetch(`${base}/health`,{headers:{'x-group-id':A.groupId}}); assert.equal(installed.length,0);
    const forged=await fetch(`${base}/api/v1/marcas`,{headers:{'x-group-id':A.groupId,'x-empresa-id':A.empresaId}});
    assert.equal(forged.status,401); assert.equal(installed.length,0);
    await fetch(`${base}/api/v1/marcas`,{headers:{authorization:'Bearer synthetic.jwt','x-group-id':A.groupId,'x-empresa-id':A.empresaId}});
    assert.deepEqual(installed,[A]); assert.equal(lifetime!(),false);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
  const dev=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'});
  const other=createApp({config:dev,db,useMemory:true,tenantContextEnabled:true}).app.listen(0);
  await new Promise<void>(resolve=>other.once('listening',resolve)); const addr=other.address(); assert(addr&&typeof addr!=='string');
  try {await fetch(`http://127.0.0.1:${addr.port}/api/v1/marcas`,{headers:{'x-group-id':A.groupId,'x-empresa-id':A.empresaId,'x-actor-id':A.groupId}});assert.equal(installed.length,1);}
  finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
});
