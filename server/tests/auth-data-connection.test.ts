import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient, createRuntimeDbClients, type DbClient } from '../src/db/client.ts';
import { loadConfig, publicConfigView } from '../src/config/env.ts';
import { createApp } from '../src/app.ts';
import { createServer } from 'node:http';

const cfg = (extra:Record<string,string>={}) => loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'synthetic',...extra});
const identity = {database:'synthetic_test',schema:'public',address:'127.0.0.1',port:5432,rolsuper:false,rolbypassrls:false,login_super:false,login_bypass:false};
test('Auth/data configuration is opt-in and never exposes the second URL',()=>{
  assert.equal(cfg().tenantContextEnabled,false);
  assert.throws(()=>cfg({ENABLE_TENANT_CONTEXT:'true'}),/separate Auth/);
  assert.throws(()=>cfg({AUTH_DATABASE_URL:'synthetic',ERP_AUTH_MODE:'dev_headers'}));
  const value=cfg({DATABASE_URL:'postgresql://data.example.test/test',AUTH_DATABASE_URL:'postgresql://auth.example.test/private',ENABLE_TENANT_CONTEXT:'true'});
  assert.equal(value.tenantContextEnabled,true); assert.doesNotMatch(JSON.stringify(publicConfigView(value)),/private|authDatabaseUrl/);
});
test('Runtime keeps one legacy client, rejects unsafe split/different target and closes both',async()=>{
  let calls=0;let ended=0;
  const factory=()=>{calls++; const db=createDbClient(cfg());db.end=async()=>{ended++;};db.query=async()=>({rows:[identity],command:'SELECT',rowCount:1,oid:0,fields:[]}) as any;return db;};
  const single=await createRuntimeDbClients(cfg(),factory); assert.equal(single.db,single.authDb);assert.equal(calls,1);await single.end();assert.equal(ended,1);
  const config=cfg({DATABASE_URL:'synthetic-data',AUTH_DATABASE_URL:'synthetic-auth'});
  for(const change of [{rolsuper:true},{rolbypassrls:true},{login_super:true},{login_bypass:true},{database:'other'},{address:'other'}]){
    let index=0;ended=0;
    await assert.rejects(createRuntimeDbClients(config,()=>{
      const db=factory(); const current=index++===0?{...identity,...change}:identity;
      db.query=async()=>({rows:[current],command:'SELECT',rowCount:1,oid:0,fields:[]}) as any;return db;
    }),/PREFLIGHT_FAILED/);assert.equal(ended,2);
  }
  ended=0; const split=await createRuntimeDbClients(config,factory); assert.notEqual(split.db,split.authDb);await split.end();assert.equal(ended,2);
});
test('HTTP verified profile uses authDb exclusively; data/ready stay on db',async()=>{
  const group='11111111-1111-4111-8111-111111111111';const company='22222222-2222-4222-8222-222222222222';
  const db=createDbClient(cfg());let authCalls=0;let contextCalls=0;let readyCalls=0;
  db.query=async()=>{throw new Error('AUTH_ESCAPED_TO_DATA');};db.checkConnection=async()=>{readyCalls++;return true;};
  db.withTenantContext=(_scope,fn)=>{contextCalls++;return fn();};
  const authDb:Pick<DbClient,'query'>={query:async(sql)=>{authCalls++;assert.match(sql,/profiles/);return {rows:[{id:group}],command:'SELECT',rowCount:1,oid:0,fields:[]} as any;}};
  const {app}=createApp({config:cfg({DATABASE_URL:'synthetic-data'}),db,authDb,useMemory:true,tenantContextEnabled:true,authFetchImpl:async()=>new Response(JSON.stringify({id:group}),{status:200})});
  const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const addr=server.address();assert(addr&&typeof addr!=='string');const base=`http://127.0.0.1:${addr.port}`;
  try{
    const noToken=await fetch(`${base}/api/v1/marcas`,{headers:{'x-group-id':group,'x-empresa-id':company}});assert.equal(noToken.status,401);assert.equal(authCalls,0);assert.equal(contextCalls,0);
    await fetch(`${base}/api/v1/marcas`,{headers:{authorization:'Bearer synthetic.jwt','x-group-id':group,'x-empresa-id':company}});assert.equal(authCalls,1);assert.equal(contextCalls,1);
    const ready=await fetch(`${base}/ready`);assert.equal(ready.status,200);assert.equal(readyCalls,1);assert.equal(authCalls,1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('GET/POST session and company enrichment use only bootstrap connection',async()=>{
  const group='11111111-1111-4111-8111-111111111111';const company='22222222-2222-4222-8222-222222222222';
  const provider=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='POST'
    ?{access_token:'synthetic.jwt',token_type:'bearer',expires_in:3600,user:{id:group,email:'actor@example.test'}}:{id:group,email:'actor@example.test'}));}).listen(0);
  await new Promise<void>(resolve=>provider.once('listening',resolve));const authAddr=provider.address();assert(authAddr&&typeof authAddr!=='string');
  const config=cfg({SUPABASE_URL:`http://127.0.0.1:${authAddr.port}`});
  const db=createDbClient(config);db.query=async()=>{throw new Error('SESSION_ESCAPED_TO_DATA');};let reads=0;
  const authDb:Pick<DbClient,'query'>={query:async(sql)=>{reads++;return {rows:sql.includes('FROM profiles')
    ?[{id:group,group_id:group,empresa_id_raw:null,empresa_id:null,role:'admin',full_name:'Synthetic',group_name:'Synthetic',permissoes:{Comercial:{pedido:['visualizar']}}}]
    :[{id:company,group_id:group,razao_social:'Synthetic',nome_fantasia:'Synthetic',cnpj:null,status:'Ativa'}],rowCount:1,command:'SELECT',oid:0,fields:[]} as any;}};
  const server=createApp({config,db,authDb,useMemory:true}).app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const addr=server.address();assert(addr&&typeof addr!=='string');
  try{
    const base=`http://127.0.0.1:${addr.port}/api/v1/auth/session`;
    const login=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'actor@example.test',password:'synthetic-only-test-password'})});assert.equal(login.status,200);const session=await login.json();assert.equal(session.data.profiles[0].empresas.length,1);
    const restore=await fetch(base,{headers:{authorization:'Bearer synthetic.jwt'}});assert.equal(restore.status,200);assert.equal((await restore.json()).data.profiles[0].empresas[0].id,company);assert.equal(reads,4);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await new Promise<void>(resolve=>provider.close(()=>resolve()));}
});
