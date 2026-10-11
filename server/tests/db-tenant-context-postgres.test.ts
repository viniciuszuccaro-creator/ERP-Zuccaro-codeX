import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createPoolDbClient, createRuntimeDbClients } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { assertCrmIsolatedUrl } from './helpers/crmPostgresFixture.ts';
import { AUTH_IDS as I, authTables, authSeed, authColumnGrants, authPolicy } from './helpers/authBootstrapFixture.ts';
import { createApp } from '../src/app.ts';
import { createServer } from 'node:http';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

test('Tenant runtime PostgreSQL: refuses unvalidated destination', () => {
  assert.throws(() => assertCrmIsolatedUrl(undefined));
});
if(process.env.DATABASE_URL)test('Auth bootstrap PostgreSQL: verified provider, owner/branch RLS, minimal grants, readonly and no residual identity',async()=>{
  assertCrmIsolatedUrl(process.env.DATABASE_URL);const suffix=randomUUID().replaceAll('-','');const schema=`auth_ctx_${suffix}`,authRole=`auth_ctx_${suffix}`,dataRole=`data_ctx_${suffix}`;
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});let clients:Awaited<ReturnType<typeof createRuntimeDbClients>>|undefined;
  let server:ReturnType<ReturnType<typeof createApp>['app']['listen']>|undefined;
  const provider=createServer((req,res)=>{const token=req.headers.authorization;
    res.setHeader('Content-Type','application/json');
    if(token==='Bearer invalid'){res.statusCode=401;res.end('{}');return;}
    const id=token==='Bearer branch'?I.branch:token==='Bearer foreign'?I.foreign:I.owner;
    res.end(JSON.stringify(req.method==='POST'?{access_token:'owner',token_type:'bearer',expires_in:3600,user:{id,email:'synthetic@example.test'}}:{id,email:'synthetic@example.test'}));
  }).listen(0);await new Promise<void>(resolve=>provider.once('listening',resolve));const p=provider.address();assert(p&&typeof p!=='string');
  try{
    const password=randomUUID();await admin.query(`CREATE ROLE ${authRole} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}';CREATE ROLE ${dataRole} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}';CREATE SCHEMA ${schema};GRANT USAGE ON SCHEMA ${schema} TO ${authRole},${dataRole}`);
    const setup=await admin.connect();try{await setup.query(`SET search_path=${schema}`);await setup.query(authTables+authSeed());await setup.query(await authPolicy());await setup.query(await authPolicy());await setup.query(authColumnGrants(authRole));}finally{setup.release(true);}
    const url=(role:string)=>{const u=new URL(process.env.DATABASE_URL!);u.username=role;u.password=password;u.searchParams.set('options',`-c search_path=${schema}`);return u.toString();};
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:`http://127.0.0.1:${p.port}`,SUPABASE_ANON_KEY:'synthetic',DATABASE_URL:url(dataRole),AUTH_DATABASE_URL:url(authRole),ENABLE_TENANT_CONTEXT:'true'});
    clients=await createRuntimeDbClients(config);
    assert.equal((await clients.authDb.query('SELECT id FROM profiles')).rows.length,0);
    for(const [id,count]of [[I.owner,2],[I.branch,1],[I.foreign,0]]as const){await clients.authDb.withAuthIdentity!(id,async q=>{assert.equal((await q.query('SELECT id FROM profiles')).rows.length,1);assert.equal((await q.query('SELECT id FROM empresas')).rows.length,count);});}
    await assert.rejects(clients.authDb.withAuthIdentity!(I.owner,q=>q.query('UPDATE profiles SET role=\'admin\'')),/read-only|permission denied/i);
    assert.equal((await clients.authDb.query("SELECT NULLIF(current_setting('app.auth_user_id',true),'') AS id")).rows[0].id,null);
    const tenantGuard=new InMemoryTenantGuard();tenantGuard.link(I.company,I.group);tenantGuard.link(I.second,I.group);
    const mounted=createApp({config,db:clients.db,authDb:clients.authDb,useMemory:true,tenantGuard,tenantContextEnabled:true});server=mounted.app.listen(0);await new Promise<void>(resolve=>server!.once('listening',resolve));const s=server.address();assert(s&&typeof s!=='string');const base=`http://127.0.0.1:${s.port}`;
    const login=await fetch(`${base}/api/v1/auth/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password:'synthetic-only-test-password'})});assert.equal(login.status,200);assert.equal((await login.json()).data.profiles[0].empresas.length,2);
    for(const[token,count]of [['owner',2],['branch',1]]as const){const restored=await fetch(`${base}/api/v1/auth/session`,{headers:{authorization:`Bearer ${token}`}});assert.equal(restored.status,200);assert.equal((await restored.json()).data.profiles[0].empresas.length,count);}
    for(const[token,group,company,actor,status]of [
      ['invalid',I.group,I.company,'',401],['branch',I.group,I.second,'',403],['owner',I.group,I.inactive,'',403],['owner',I.other,I.company,'',403],['owner',I.group,I.company,I.foreignProfile,403],
    ]as const){const response=await fetch(`${base}/api/v1/marcas`,{headers:{authorization:`Bearer ${token}`,'x-group-id':group,'x-empresa-id':company,...(actor?{'x-actor-id':actor}:{})}});assert.equal(response.status,status);}
    const headers={authorization:'Bearer owner','x-group-id':I.group,'x-empresa-id':I.company};
    // Marca's legacy list validates scope only; this positive control proves Auth admitted the request.
    const admitted=await fetch(`${base}/api/v1/marcas`,{headers});assert.equal(admitted.status,200);
    // The canonical Orçamento endpoint enforces RBAC; absence of permissions must deny access.
    const denied=await fetch(`${base}/api/v1/orcamentos`,{headers});assert.equal(denied.status,403);
    assert.equal((await denied.json()).error.code,'PERMISSION_DENIED');
  }finally{if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));await new Promise<void>(resolve=>provider.close(()=>resolve()));await clients?.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE;DROP ROLE IF EXISTS ${authRole};DROP ROLE IF EXISTS ${dataRole}`);await admin.end();}
});
if (process.env.DATABASE_URL) test('Auth/data PostgreSQL: restricted login startup, matching target and separate connections',async()=>{
  assertCrmIsolatedUrl(process.env.DATABASE_URL);
  const suffix=randomUUID().replaceAll('-','');const role=`data_login_${suffix}`;const authRole=`auth_login_${suffix}`;const schema=`data_login_${suffix}`;
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let clients:Awaited<ReturnType<typeof createRuntimeDbClients>>|undefined;
  try{
    const password=randomUUID(); // Ephemeral synthetic fixture only, never logged or persisted.
    await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'; CREATE ROLE ${authRole} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'; CREATE SCHEMA ${schema}; GRANT USAGE ON SCHEMA ${schema} TO ${role},${authRole}`);
    const dataUrl=new URL(process.env.DATABASE_URL!);dataUrl.username=role;dataUrl.password=password;dataUrl.searchParams.set('options',`-c search_path=${schema}`);
    const authUrl=new URL(process.env.DATABASE_URL!);authUrl.username=authRole;authUrl.password=password;authUrl.searchParams.set('options',`-c search_path=${schema}`);
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'synthetic',DATABASE_URL:dataUrl.toString(),AUTH_DATABASE_URL:authUrl.toString(),ENABLE_TENANT_CONTEXT:'true'});
    clients=await createRuntimeDbClients(config);assert.notEqual(clients.db,clients.authDb);
    const login=await clients.db.query<{name:string}>('SELECT session_user AS name');assert.equal(login.rows[0].name,role);
    const unsafe=new URL(process.env.DATABASE_URL!);unsafe.searchParams.set('options',`-c search_path=${schema}`);
    await assert.rejects(createRuntimeDbClients({...config,databaseUrl:unsafe.toString()}),/PREFLIGHT_FAILED/);
    await assert.rejects(createRuntimeDbClients({...config,authDatabaseUrl:unsafe.toString()}),/PREFLIGHT_FAILED/);
    assert.equal((await clients.db.query('SELECT 1')).rows.length,1);
  }finally{await clients?.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; DROP ROLE IF EXISTS ${role}; DROP ROLE IF EXISTS ${authRole}`);await admin.end();}
});
if (process.env.DATABASE_URL) test('Tenant runtime PostgreSQL: NOBYPASS isolation, concurrency, rollback and recycled connection', async () => {
  assertCrmIsolatedUrl(process.env.DATABASE_URL);
  const suffix = randomUUID().replaceAll('-', '');
  const schema = `tenant_ctx_${suffix}`; const role = `tenant_ctx_role_${suffix}`;
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let data: pg.Pool | undefined;
  const A = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222' };
  const B = { groupId: '33333333-3333-4333-8333-333333333333', empresaId: '44444444-4444-4444-8444-444444444444' };
  try {
    await admin.query(`CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOLOGIN; CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.records (group_id uuid NOT NULL, empresa_id uuid NOT NULL, value integer NOT NULL);
      ALTER TABLE ${schema}.records ENABLE ROW LEVEL SECURITY; ALTER TABLE ${schema}.records FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant ON ${schema}.records USING (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
        WITH CHECK (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);
      GRANT USAGE ON SCHEMA ${schema} TO ${role}; GRANT SELECT,INSERT,UPDATE ON ${schema}.records TO ${role};`);
    await admin.query(`INSERT INTO ${schema}.records VALUES ($1,$2,1),($3,$4,2)`, [A.groupId,A.empresaId,B.groupId,B.empresaId]);
    data = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, options: `-c role=${role} -c search_path=${schema}` });
    const db = createPoolDbClient(data);
    const check = async (scope: typeof A, expected: number) => db.withTenantContext!(scope, () => db.withTransaction(async q => {
      const flags = await q.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.deepEqual(flags.rows[0], { rolsuper: false, rolbypassrls: false });
      await q.query('SELECT pg_sleep(0.01)');
      const rows = await q.query<{value:number}>('SELECT value FROM records'); assert.deepEqual(rows.rows, [{ value: expected }]);
      await db.withTransaction(async nested => { assert.equal(nested,q); assert.equal((await db.query('SELECT value FROM records')).rows.length,1); });
    }));
    await Promise.all(Array.from({length:8}, (_,i) => check(i%2 ? A:B, i%2 ? 1:2)));
    await assert.rejects(db.withTenantContext!(A, () => db.withTransaction(async q => {
      await q.query('UPDATE records SET value=99');
      await assert.rejects(db.withTransaction(async () => { throw new Error('INTERMEDIATE'); }));
    })), /ROLLBACK_REQUIRED/);
    await check(A,1); await check(B,2);
    assert.equal((await db.query('SELECT * FROM records')).rows.length,0);
    const gucs = await db.query<{g:string|null;e:string|null}>("SELECT NULLIF(current_setting('app.group_id',true),'') AS g,NULLIF(current_setting('app.empresa_id',true),'') AS e");
    assert.deepEqual(gucs.rows[0],{g:null,e:null});
    let alive=true;
    await db.withTenantContext!(A, async () => { await Promise.resolve(); alive=false; await assert.rejects(db.query('SELECT * FROM records'),/CONTEXT_EXPIRED/); },()=>alive);
  } finally {
    await data?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});
