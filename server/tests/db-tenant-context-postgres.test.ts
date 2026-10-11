import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createPoolDbClient, createRuntimeDbClients } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { assertCrmIsolatedUrl } from './helpers/crmPostgresFixture.ts';

test('Tenant runtime PostgreSQL: refuses unvalidated destination', () => {
  assert.throws(() => assertCrmIsolatedUrl(undefined));
});
if (process.env.DATABASE_URL) test('Auth/data PostgreSQL: restricted login startup, matching target and separate connections',async()=>{
  assertCrmIsolatedUrl(process.env.DATABASE_URL);
  const suffix=randomUUID().replaceAll('-','');const role=`data_login_${suffix}`;const schema=`data_login_${suffix}`;
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let clients:Awaited<ReturnType<typeof createRuntimeDbClients>>|undefined;
  try{
    const password=randomUUID(); // Ephemeral synthetic fixture only, never logged or persisted.
    await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'; CREATE SCHEMA ${schema}; GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    const dataUrl=new URL(process.env.DATABASE_URL!);dataUrl.username=role;dataUrl.password=password;dataUrl.searchParams.set('options',`-c search_path=${schema}`);
    const authUrl=new URL(process.env.DATABASE_URL!);authUrl.searchParams.set('options',`-c search_path=${schema}`);
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'synthetic',DATABASE_URL:dataUrl.toString(),AUTH_DATABASE_URL:authUrl.toString(),ENABLE_TENANT_CONTEXT:'true'});
    clients=await createRuntimeDbClients(config);assert.notEqual(clients.db,clients.authDb);
    const login=await clients.db.query<{name:string}>('SELECT session_user AS name');assert.equal(login.rows[0].name,role);
    await assert.rejects(createRuntimeDbClients({...config,databaseUrl:authUrl.toString()}),/PREFLIGHT_FAILED/);
    assert.equal((await clients.db.query('SELECT 1')).rows.length,1);
  }finally{await clients?.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; DROP ROLE IF EXISTS ${role}`);await admin.end();}
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
