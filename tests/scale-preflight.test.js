import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPreparedClientScale } from '../scripts/legado/scale-preflight.mjs';

test('scale assessment is read-only, rolls back and never promotes applicability', async () => {
  const target={database:'hml',schema:'hml',principal:'app',databaseOid:1,schemaOid:2,clusterIdentifier:'3'};
  const plan={manifest:{kind:'canonical_client_import_v1',context:{scopeType:'grupo',empresaId:null,groupId:'group'},target,sourceSystem:'LEGACY'},
    batches:[{items:[{payload:{codigo_legado:'0001',codigo:'0001',documento:'0001'}}]}]};
  const calls=[];let rollback=false;
  const db={withTenantContext:(_ctx,fn)=>fn(),withTransaction:async fn=>{try{return await fn({query:async(sql)=>{
    calls.push(sql);
    if(sql.includes('pg_control_system'))return {rows:[target]};
    if(sql.includes('rolsuper'))return {rows:[{rolsuper:false,rolbypassrls:false}]};
    if(sql.includes('count(*)::int'))return {rows:[{n:0}]};
    return {rows:[]};
  }});}catch(error){rollback=true;throw error;}}};
  const result=await assessPreparedClientScale(db,plan,async(_ctx,action)=>{if(action==='inativar')throw Object.assign(Error('denied'),{statusCode:403});});
  assert.equal(rollback,true);assert.equal(calls[0],'SET TRANSACTION READ ONLY');
  assert.equal(result.applicable,false);assert.equal(result.businessWrites,0);assert.equal(result.permissions.inativar,false);
  assert.ok(calls.every(sql=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|TRUNCATE)\b/i.test(sql)));
  const matching=calls.find(sql=>sql.includes('matches AS'));
  assert.match(matching,/incoming AS MATERIALIZED/);
  assert.equal((matching.match(/regexp_replace/g)||[]).length,1);
  assert.equal((matching.match(/\bUNION\b/g)||[]).length,2);
  await assert.rejects(assessPreparedClientScale(db,{...plan,manifest:{...plan.manifest,target:{...target,database:'wrong'}}},async()=>{}),/LEGACY_PHYSICAL_TARGET_MISMATCH/);
  await assert.rejects(assessPreparedClientScale(db,plan,async()=>{throw Error('QUERY_FAILURE');}),/QUERY_FAILURE/);
  const beforeDenied=calls.length;
  await assert.rejects(assessPreparedClientScale(db,plan,async()=>{throw Object.assign(Error('DENIED'),{statusCode:403});}),/LEGACY_VIEW_PERMISSION_REQUIRED/);
  assert.ok(calls.slice(beforeDenied).every(sql=>!sql.includes('FROM clientes')));
});
