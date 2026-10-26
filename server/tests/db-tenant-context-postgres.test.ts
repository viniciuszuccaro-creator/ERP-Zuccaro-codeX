import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { inspectCrmPreflight } from '../src/db/crmPreflight.ts';

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
    // Fixture-only data policy/grants: test real profiles.permissoes without installing DEV policies.
    await admin.query(`GRANT SELECT(id,ativo,group_id,empresa_id,permissoes) ON ${schema}.profiles TO ${dataRole};
      CREATE POLICY fixture_data_profiles ON ${schema}.profiles FOR SELECT TO ${dataRole}
      USING (ativo AND group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
        AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid))`);
    const mounted=createApp({config,db:clients.db,authDb:clients.authDb,useMemory:true,tenantGuard,rbacGuard:new PostgresRbacGuard(clients.db),tenantContextEnabled:true});server=mounted.app.listen(0);await new Promise<void>(resolve=>server!.once('listening',resolve));const s=server.address();assert(s&&typeof s!=='string');const base=`http://127.0.0.1:${s.port}`;
    const login=await fetch(`${base}/api/v1/auth/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password:'synthetic-only-test-password'})});assert.equal(login.status,200);assert.equal((await login.json()).data.profiles[0].empresas.length,2);
    for(const[token,count]of [['owner',2],['branch',1]]as const){const restored=await fetch(`${base}/api/v1/auth/session`,{headers:{authorization:`Bearer ${token}`}});assert.equal(restored.status,200);assert.equal((await restored.json()).data.profiles[0].empresas.length,count);}
    for(const[token,group,company,actor,status]of [
      ['invalid',I.group,I.company,'',401],['branch',I.group,I.second,'',403],['owner',I.group,I.inactive,'',403],['owner',I.other,I.company,'',403],['owner',I.group,I.company,I.foreignProfile,403],
    ]as const){const response=await fetch(`${base}/api/v1/marcas`,{headers:{authorization:`Bearer ${token}`,'x-group-id':group,'x-empresa-id':company,...(actor?{'x-actor-id':actor}:{})}});assert.equal(response.status,status);}
    const headers={authorization:'Bearer owner','x-group-id':I.group,'x-empresa-id':I.company};
    // Marca now enforces granular RBAC after verified Auth; no profile permission means denial.
    const admitted=await fetch(`${base}/api/v1/marcas`,{headers});assert.equal(admitted.status,403);assert.equal((await admitted.json()).error.code,'PERMISSION_DENIED');
    // The canonical Orçamento endpoint enforces RBAC; absence of permissions must deny access.
    const denied=await fetch(`${base}/api/v1/orcamentos`,{headers});assert.equal(denied.status,403);
    assert.equal((await denied.json()).error.code,'PERMISSION_DENIED');
    await admin.query(`UPDATE ${schema}.profiles SET permissoes=$1::jsonb WHERE id=$2`,[JSON.stringify({Cadastros:{marca:['visualizar','criar','editar','inativar']}}),I.ownerProfile]);
    assert.equal((await fetch(`${base}/api/v1/marcas`,{headers})).status,200);
    const created=await fetch(`${base}/api/v1/marcas`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({nome_marca:'Synthetic composed'})});assert.equal(created.status,201);
    const marca=(await created.json()).data;
    await admin.query(`UPDATE ${schema}.profiles SET permissoes=$1::jsonb WHERE id=$2`,[JSON.stringify({Cadastros:{marca:['visualizar']}}),I.branchProfile]);
    const branchHeaders={...headers,authorization:'Bearer branch'};
    assert.equal((await fetch(`${base}/api/v1/marcas`,{headers:branchHeaders})).status,200);
    assert.equal((await fetch(`${base}/api/v1/marcas/${marca.id}`,{method:'PATCH',headers:{...branchHeaders,'Content-Type':'application/json'},body:JSON.stringify({descricao:'Denied'})})).status,403);
    await admin.query(`UPDATE ${schema}.profiles SET permissoes='{}' WHERE id=$1`,[I.ownerProfile]);
    assert.equal((await fetch(`${base}/api/v1/marcas`,{headers})).status,403);
    assert.equal((await clients.db.query("SELECT NULLIF(current_setting('app.group_id',true),'') AS tenant")).rows[0].tenant,null);
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
    const expected={database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema,requireRestrictedLogin:true};
    const realLogin=await inspectCrmPreflight(clients.db,expected);
    assert.equal(realLogin.checks.restrictedRole,true);assert.equal(realLogin.checks.restrictedLogin,true);
    assert.equal(realLogin.ready,false); // This fixture proves LOGIN only, not a complete CRM schema.
    const disguised=await admin.connect();try {
      await disguised.query('BEGIN');await disguised.query(`SET LOCAL ROLE ${role}; SET LOCAL search_path TO ${schema},pg_catalog`);
      const rejected=await inspectCrmPreflight(disguised,expected);
      assert.equal(rejected.checks.restrictedRole,true);assert.equal(rejected.checks.restrictedLogin,false);assert.equal(rejected.ready,false);
      assert.ok(rejected.blocked.includes('restrictedLogin'));
    }finally{await disguised.query('ROLLBACK');disguised.release();}
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

if (process.env.DATABASE_URL) test('044 compensador PostgreSQL: NULL, rollback, dados e unicidade preservados', async () => {
  assertCrmIsolatedUrl(process.env.DATABASE_URL);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const fixture = await pool.connect();
  const exec = async (sql: string) => { await fixture.query(sql); };
  const rows = async (sql: string) => (await fixture.query(sql)).rows;
  try {
    assert.equal((await rows('SELECT current_database() AS name'))[0].name, new URL(process.env.DATABASE_URL!).pathname.slice(1));
    const original = await readFile(new URL('../migrations/044_pedidos_idempotencia_direta.sql', import.meta.url), 'utf8');
    const candidate = await readFile(new URL('../schema-candidates/pedido_idempotency_pair.sql', import.meta.url), 'utf8');
    await exec('CREATE TEMP TABLE pedidos(group_id uuid NOT NULL, empresa_id uuid NOT NULL, marker text NOT NULL)');
    await exec(original);
    const group = '11111111-1111-4111-8111-111111111111';
    const company = '22222222-2222-4222-8222-222222222222';
    const key = '33333333-3333-4333-8333-333333333333';
    await exec(`INSERT INTO pedidos VALUES ('${group}','${company}','incomplete','${key}',NULL)`);
    // Counterproof: original CHECK admits UNKNOWN. Candidate must refuse without repairing data.
    await assert.rejects(exec(candidate), /pedidos_idempotency_pair_complete_check/);
    await exec('ROLLBACK');
    assert.equal((await rows("SELECT marker FROM pedidos WHERE marker='incomplete'")).length, 1);
    assert.equal((await rows("SELECT 1 FROM pg_constraint WHERE conrelid='pedidos'::regclass AND conname='pedidos_idempotency_pair_complete_check'")).length, 0);
    await exec("DELETE FROM pedidos WHERE marker='incomplete'"); // Disposable synthetic row only.
    await exec(`INSERT INTO pedidos VALUES ('${group}','${company}','legacy',NULL,NULL),
      ('${group}','${company}','valid','${key}','${'a'.repeat(64)}')`);
    const before = await rows('SELECT * FROM pedidos ORDER BY marker');
    await exec(candidate);
    assert.deepEqual(await rows('SELECT * FROM pedidos ORDER BY marker'), before);
    for (const [k, fingerprint] of [[`'${key}'`, 'NULL'], ['NULL', `'${'a'.repeat(64)}'`], [`'${key}'`, "'bad'"]]) {
      await assert.rejects(exec(`INSERT INTO pedidos VALUES ('${group}','${company}','invalid',${k},${fingerprint})`), /pedidos_idempotency_pair/);
    }
    await assert.rejects(exec(`INSERT INTO pedidos VALUES ('${group}','${company}','duplicate','${key}','${'a'.repeat(64)}')`), /uq_pedidos_idempotency_scope/);
    await exec(`INSERT INTO pedidos VALUES ('44444444-4444-4444-8444-444444444444','${company}','other-group','${key}','${'a'.repeat(64)}')`);
    assert.equal((await rows('SELECT * FROM pedidos')).length, 3);
    } finally { fixture.release(true); await pool.end(); }
});

if (process.env.DATABASE_URL) test('Entrada PostgreSQL: login Grupo Cliente Orcamento Pedido e Fornecedor canonicos', async () => {
  assertCrmIsolatedUrl(process.env.DATABASE_URL);
  const { setupEntryFixture } = await import('./helpers/crmFixture.ts');
  const { SEED_IDS: ID, SEED_DOCS } = await import('../scripts/seedDevIds.ts');
  const { PostgresFornecedorRepository } = await import('../src/repositories/postgresFornecedorRepository.ts');
  const { FornecedorService, fingerprintFornecedor } = await import('../src/services/fornecedorService.ts');
  const { PostgresAuditRepository } = await import('../src/audit/auditRepository.ts');
  const suffix = randomUUID().replaceAll('-', '');
  const schema = 'entry_' + suffix, authRole = 'entry_auth_' + suffix, dataRole = 'entry_data_' + suffix;
  const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const admin = await adminPool.connect();
  let clients: Awaited<ReturnType<typeof createRuntimeDbClients>> | undefined;
  let api: ReturnType<ReturnType<typeof createApp>['app']['listen']> | undefined;
  let schemaCreated = false, dataCreated = false, authCreated = false, revoked = false;
  const authUser = randomUUID();
  const provider = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (revoked) { res.statusCode = 401; res.end('{}'); return; }
    const user = { id: authUser, email: 'entry.synthetic@example.test' };
    res.end(JSON.stringify(req.method === 'POST'
      ? { access_token: 'synthetic-entry-token', token_type: 'bearer', expires_in: 3600, user } : user));
  }).listen(0);
  await new Promise<void>(resolve => provider.once('listening', resolve));
  try {
    const p = provider.address(); assert(p && typeof p !== 'string');
    const target = (await admin.query<{ database: string }>('SELECT current_database() AS database')).rows[0];
    assert.equal(target.database, new URL(process.env.DATABASE_URL!).pathname.slice(1));
    await admin.query(`CREATE SCHEMA ${schema}; SET search_path=${schema},pg_catalog`); schemaCreated = true;
    await setupEntryFixture(async sql => { await admin.query(sql); if (sql.includes('CREATE ROLE ' + dataRole + ' ')) dataCreated = true; }, dataRole);
    const password = randomUUID(); // Ephemeral isolated fixture only; never logged or persisted.
    await admin.query(`CREATE ROLE ${authRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD '${password}';
      ALTER ROLE ${dataRole} LOGIN PASSWORD '${password}'; GRANT USAGE ON SCHEMA ${schema} TO ${authRole},${dataRole}`);
    authCreated = true;
    for (const table of ['profiles', 'empresas', 'groups']) await admin.query(`ALTER POLICY ${table}_auth_bootstrap_select ON ${table} TO ${authRole}`);
    await admin.query(authColumnGrants(authRole));
    await admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2', [authUser, ID.runtimeActorA]);
    const url = (role: string) => { const u = new URL(process.env.DATABASE_URL!); u.username = role; u.password = password; u.searchParams.set('options', '-c search_path=' + schema + ',pg_catalog'); return u.toString(); };
    const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', ERP_AUTH_MODE: 'supabase_user',
      SUPABASE_URL: 'http://127.0.0.1:' + p.port, SUPABASE_ANON_KEY: 'synthetic',
      DATABASE_URL: url(dataRole), AUTH_DATABASE_URL: url(authRole), ENABLE_TENANT_CONTEXT: 'true', ENABLE_PRODUTO_EMPRESA: 'true' });
    clients = await createRuntimeDbClients(config);
    for (const db of [clients.db, clients.authDb]) {
      const flags = (await db.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean;
        rolcreaterole: boolean; rolreplication: boolean; rolinherit: boolean; rolcanlogin: boolean }>(
        'SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=session_user')).rows[0];
      assert.deepEqual(flags, { rolsuper: false, rolbypassrls: false, rolcreatedb: false,
        rolcreaterole: false, rolreplication: false, rolinherit: false, rolcanlogin: true });
    }
    const capabilities = (await clients.db.query<{ schema_create: boolean; database_create: boolean;
      profile_insert: boolean; codigo_update: boolean; supplier_delete: boolean; company_document_update: boolean }>(`SELECT
      has_schema_privilege(current_user,current_schema(),'CREATE') AS schema_create,
      has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
      has_table_privilege(current_user,'profiles','INSERT') AS profile_insert,
      has_column_privilege(current_user,'clientes','codigo','UPDATE') AS codigo_update,
      has_table_privilege(current_user,'fornecedores','DELETE') AS supplier_delete,
      has_column_privilege(current_user,'empresas','cnpj','UPDATE') AS company_document_update`)).rows[0];
    assert.deepEqual(capabilities, { schema_create: false, database_create: false, profile_insert: false,
      codigo_update: false, supplier_delete: false, company_document_update: false });
    const membership = (await admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_auth_members
      WHERE roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ($1,$2))
         OR member IN (SELECT oid FROM pg_roles WHERE rolname IN ($1,$2))`, [dataRole, authRole])).rows[0];
    assert.equal(membership.n, 0);
    await assert.rejects(clients.db.query('CREATE TABLE entry_forbidden_ddl(id uuid)'), /permission denied/i);
    await assert.rejects(clients.db.query(`SET ROLE ${authRole}`), /permission denied/i);
    const mounted = createApp({ config, db: clients.db, authDb: clients.authDb, tenantContextEnabled: true });
    api = mounted.app.listen(0); await new Promise<void>(resolve => api!.once('listening', resolve));
    const address = api.address(); assert(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    const groupHeaders = { authorization: 'Bearer synthetic-entry-token', 'x-group-id': ID.groupA, 'Content-Type': 'application/json' };
    const companyHeaders = { ...groupHeaders, 'x-empresa-id': ID.empresaA };
    type Row = { id: string; codigo?: string; cliente_id?: string; empresa_id?: string | null; status?: string; orcamento_id?: string; itens?: unknown[] };
    const request = async (method: string, path: string, expected: number, body?: unknown, headers: Record<string, string> = companyHeaders) => {
      const response = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json() as { data: Row; error?: { code?: string }; };
      assert.equal(response.status, expected, method + ' ' + path + ':' + result.error?.code);
      return result.data;
    };
    await request('POST', '/api/v1/auth/session', 200, { email: 'entry.synthetic@example.test', password: 'synthetic-entry-only' }, { 'Content-Type': 'application/json' });
    await request('GET', '/api/v1/auth/session', 200, undefined, { authorization: groupHeaders.authorization });
    const customer = await request('POST', '/api/v1/clientes', 201,
      { tipo: 'Pessoa Jur\u00eddica', cpf_cnpj: SEED_DOCS.clientePjB, razao_social: 'SYNTHETIC ENTRY CUSTOMER', empresa_id: null }, groupHeaders);
    assert.match(customer.codigo!, /^\d+$/); assert.equal(customer.empresa_id, null);
    assert.equal((await request('GET', '/api/v1/clientes/' + customer.id, 200, undefined, groupHeaders)).id, customer.id);
    const editedCustomer = await request('PATCH', '/api/v1/clientes/' + customer.id, 200,
      { razao_social: 'SYNTHETIC ENTRY CUSTOMER EDITED' }, groupHeaders);
    assert.equal(editedCustomer.codigo, customer.codigo);
    assert.equal(editedCustomer.id, customer.id);
    assert.equal((await request('GET', '/api/v1/clientes/' + customer.id, 200, undefined, groupHeaders)).razao_social,
      'SYNTHETIC ENTRY CUSTOMER EDITED');
    const link = await request('POST', '/api/v1/clientes/' + customer.id + '/empresas/' + ID.empresaA, 201, {});
    assert.equal(link.cliente_id, customer.id);
    const unit = (await admin.query<{ sigla: string }>('SELECT sigla FROM unidades_medida WHERE id=$1', [ID.unidadeA])).rows[0];
    assert(unit);
    const price = (await admin.query<{ preco: string }>('SELECT preco FROM tabela_preco_itens WHERE id=$1', [ID.tabelaPrecoItemAKg])).rows[0];
    assert(price);
    const input = { cliente_empresa_id: link.id, condicao_pagamento_id: ID.condicaoPagamentoA,
      tabela_preco_id: ID.tabelaPrecoA, validade_em: '2027-12-01T00:00:00.000Z',
      itens: [{ produto_id: ID.produtoA, unidade_id: ID.unidadeA, descricao: 'SYNTHETIC ENTRY ITEM', unidade_sigla: unit.sigla, quantidade: '2.000000', preco_unitario: price.preco, desconto: '0.000000' }] };
    const quote = await request('POST', '/api/v1/orcamentos', 201, input);
    const editedQuote = await request('PATCH', '/api/v1/orcamentos/' + quote.id, 200,
      { ...input, observacoes: 'SYNTHETIC QUOTE EDIT' });
    assert.equal(editedQuote.observacoes, 'SYNTHETIC QUOTE EDIT');
    assert.equal((await request('GET', '/api/v1/orcamentos/' + quote.id, 200)).itens?.length, 1);
    const order = await request('POST', '/api/v1/orcamentos/' + quote.id + '/converter-pedido', 201,
      { tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-12-01T00:00:00.000Z' });
    assert.equal(order.orcamento_id, quote.id);
    const { validade_em: quoteValidity, ...orderFields } = input;
    void quoteValidity;
    const editOrder = { ...orderFields, orcamento_id: quote.id, tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '2027-12-10T00:00:00.000Z', observacoes: 'SYNTHETIC ORDER EDIT' };
    await request('PATCH', '/api/v1/pedidos/' + order.id, 200, editOrder);
    assert.equal((await request('GET', '/api/v1/pedidos/' + order.id, 200)).observacoes,
      'SYNTHETIC ORDER EDIT');
    // Canonical conversion rejects repetition; the scoped row count below must stay one.
    await request('POST', '/api/v1/orcamentos/' + quote.id + '/converter-pedido', 409,
      { tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-12-10T00:00:00.000Z' });
    await request('POST', '/api/v1/pedidos/' + order.id + '/status', 200,
      { status: 'PRONTO_RETIRADA', motivo: 'SYNTHETIC READY' });
    await request('POST', '/api/v1/pedidos/' + order.id + '/status', 200,
      { status: 'FINALIZADO', motivo: 'SYNTHETIC CLOSE' });
    assert.equal((await request('GET', '/api/v1/pedidos/' + order.id, 200)).status, 'FINALIZADO');
    await request('PATCH', '/api/v1/pedidos/' + order.id, 409, editOrder);
    const cancelledQuote = await request('POST', '/api/v1/orcamentos', 201, input);
    const concurrentQuotes = await Promise.all([
      request('POST', '/api/v1/orcamentos', 201, input),
      request('POST', '/api/v1/orcamentos', 201, input),
    ]);
    assert.notEqual(concurrentQuotes[0].id, concurrentQuotes[1].id);
    const sequentialNumbers = concurrentQuotes.map(row => {
      assert.match(row.numero, /\d+$/);
      return BigInt(row.numero.match(/\d+$/)![0]);
    }).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    assert.equal(sequentialNumbers[1] - sequentialNumbers[0], 1n);
    await request('POST', '/api/v1/orcamentos/' + cancelledQuote.id + '/cancelar', 200, {});
    assert.equal((await request('GET', '/api/v1/orcamentos/' + cancelledQuote.id, 200)).status, 'CANCELADO');
    await request('PATCH', '/api/v1/orcamentos/' + cancelledQuote.id, 409, input);
    assert.equal(Number((await admin.query('SELECT count(*) AS n FROM pedidos WHERE orcamento_id=$1',
      [quote.id])).rows[0].n), 1);
    assert.equal((await request('GET', '/api/v1/pedidos/' + order.id, 200)).id, order.id);
    await request('GET', '/api/v1/pedidos/' + order.id, 404, undefined, { ...companyHeaders, 'x-empresa-id': ID.empresaA2 });
    await request('GET', '/api/v1/pedidos/' + order.id, 403, undefined, { ...companyHeaders, 'x-group-id': ID.groupB });
    const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
    const supplier = new FornecedorService(new PostgresFornecedorRepository(clients.db), new PostgresAuditRepository(clients.db), new PostgresRbacGuard(clients.db));
    const payload = { tipo_pessoa: 'Pessoa Juridica', cpf_cnpj: SEED_DOCS.clientePjA, razao_social: 'SYNTHETIC ENTRY SUPPLIER',
      status: 'Ativo', status_fornecedor: 'Ativo',
      codigo: '000077', codigo_legado: '77', legacy_id: '77', source_system: 'SYNTHETIC', migration_batch: randomUUID() };
    await clients.db.withTenantContext!(ctx, () => assert.rejects(supplier.importar(ctx, payload), { code: 'PERMISSION_DENIED' }));
    assert.equal((await admin.query<{ n: number }>('SELECT count(*)::int AS n FROM fornecedores')).rows[0].n, 0);
    // Explicit synthetic importer authority only; owner wildcard does not grant sensitive import.
    await admin.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Cadastros,fornecedor}',$1::jsonb) WHERE id=$2",
      [JSON.stringify(['visualizar', 'criar', 'importar', 'inativar']), ID.runtimeActorA]);
    const foreignSupplierId = randomUUID();
    await admin.query(`INSERT INTO fornecedores(id,group_id,tipo_pessoa,cpf_cnpj,codigo,razao_social,status,status_fornecedor,
      source_system,codigo_legado,legacy_id,migration_batch,origem,ativo,created_by,updated_by)
      VALUES($1,$2,'Pessoa Juridica',$3,'000078','SYNTHETIC FOREIGN SUPPLIER','Ativo','Ativo',
        'SYNTHETIC','78','78',$4,'MIGRACAO',true,$5,$5)`,
      [foreignSupplierId, ID.groupB, SEED_DOCS.clientePjB, randomUUID(), ID.runtimeActorB]);
    const foreignBefore = (await admin.query<{ row: unknown }>('SELECT to_jsonb(f) AS row FROM fornecedores f WHERE id=$1', [foreignSupplierId])).rows[0].row;
    await clients.db.withTenantContext!(ctx, async () => {
      await assert.rejects(supplier.get(ctx, foreignSupplierId), { code: 'NOT_FOUND' });
      assert.equal((await clients!.db.query('SELECT id FROM fornecedores WHERE group_id=$1', [ID.groupB])).rows.length, 0);
      assert.equal((await clients!.db.query("SELECT current_schema() AS name")).rows[0].name, schema);
      await assert.rejects(clients!.db.query('UPDATE audit_logs SET action=action WHERE false'), /permission denied/i);
      await assert.rejects(clients!.db.query('DELETE FROM audit_logs WHERE false'), /permission denied/i);
      await assert.rejects(clients!.db.query('SELECT auth_user_id FROM profiles'), /permission denied/i);
      await assert.rejects(clients!.db.query('SELECT cnpj FROM empresas'), /permission denied/i);
      const raced = await Promise.all([supplier.importar(ctx, payload), supplier.importar(ctx, payload)]);
      assert.deepEqual(raced.map(result => result.reutilizado).sort(), [false, true]);
      assert.equal(raced[0].registro.id, raced[1].registro.id);
      const result = raced.find(item => !item.reutilizado);
      assert(result);
      assert.equal(result.reutilizado, false);
      assert.equal(result.registro.codigo, '000077');
      assert.equal(result.registro.origem, 'MIGRACAO');
      assert.equal((await supplier.importar(ctx, payload)).registro.id, result.registro.id);
      const row = result.registro;
      await assert.rejects(supplier.softDelete(ctx, row.id, row.revision + 1, row.source_system, row.migration_batch, fingerprintFornecedor(row)), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      await assert.rejects(supplier.softDelete(ctx, row.id, row.revision, row.source_system, row.migration_batch, '0'.repeat(64)), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      await assert.rejects(supplier.softDelete(ctx, row.id, row.revision, row.source_system, randomUUID(), fingerprintFornecedor(row)), { code: 'FORNECEDOR_REVISION_CONFLICT' });
      const reversed = await supplier.softDelete(ctx, row.id, row.revision, row.source_system, row.migration_batch, fingerprintFornecedor(row));
      assert.equal(reversed.ativo, false); assert.equal(reversed.id, row.id); assert.equal(reversed.codigo, row.codigo);
      await assert.rejects(supplier.importar(ctx, payload), { code: 'LEGACY_RECONCILIATION_REQUIRED' });
      assert.equal((await clients!.db.query('SELECT count(*)::int AS n FROM fornecedores')).rows[0].n, 1);
    });
    const before = (await admin.query<{ n: number }>('SELECT count(*)::int AS n FROM orcamentos')).rows[0].n;
    const transactionSnapshot = async () => (await admin.query(`SELECT
      (SELECT count(*)::int FROM orcamento_itens) AS items,
      (SELECT count(*)::int FROM audit_logs) AS audits,
      (SELECT jsonb_agg(to_jsonb(s) ORDER BY to_jsonb(s)::text) FROM entity_code_sequences s) AS sequences`)).rows[0];
    const beforeRollback = await transactionSnapshot();
    assert.deepEqual((await admin.query<{ row: unknown }>('SELECT to_jsonb(f) AS row FROM fornecedores f WHERE id=$1', [foreignSupplierId])).rows[0].row, foreignBefore);
    await admin.query(`CREATE FUNCTION entry_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $entry$
      BEGIN IF NEW.entity='Orcamento' THEN RAISE EXCEPTION 'SYNTHETIC_ENTRY_AUDIT_FAILURE'; END IF; RETURN NEW; END; $entry$;
      CREATE TRIGGER entry_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION entry_audit_failure()`);
    await request('POST', '/api/v1/orcamentos', 500, input);
    assert.equal((await admin.query<{ n: number }>('SELECT count(*)::int AS n FROM orcamentos')).rows[0].n, before);
    await admin.query('DROP TRIGGER entry_audit_failure ON audit_logs; DROP FUNCTION entry_audit_failure()');
    assert.deepEqual(await transactionSnapshot(), beforeRollback);
    await admin.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [ID.runtimeActorA]);
    await request('POST', '/api/v1/orcamentos', 403, input);
    assert.equal((await admin.query<{ n: number }>('SELECT count(*)::int AS n FROM orcamentos')).rows[0].n, before);
    revoked = true; await request('GET', '/api/v1/pedidos/' + order.id, 401);
    assert.equal((await clients.db.query('SELECT id FROM clientes')).rows.length, 0);
    await assert.rejects(clients.authDb.withAuthIdentity!(authUser, q => q.query("UPDATE profiles SET role='admin'")), /read-only|permission denied/i);
    const audits = (await admin.query<{ entity: string; n: number }>('SELECT entity,count(*)::int AS n FROM audit_logs GROUP BY entity')).rows;
    for (const entity of ['Cliente', 'Orcamento', 'Pedido', 'Fornecedor']) assert.ok(audits.some(row => row.entity === entity && row.n > 0), entity);
    assert.equal(audits.find(row => row.entity === 'Fornecedor')?.n, 4); // create + concurrent replay + sequential replay + reversal.
  } finally {
    if (api) await new Promise<void>(resolve => api!.close(() => resolve()));
    await new Promise<void>(resolve => provider.close(() => resolve()));
    await clients?.end();
    if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    if (authCreated) await admin.query(`DROP ROLE ${authRole}`);
    if (dataCreated) await admin.query(`DROP ROLE ${dataRole}`);
    admin.release(true); await adminPool.end();
  }
});
