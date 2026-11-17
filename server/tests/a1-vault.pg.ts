import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {assertCrmIsolatedUrl} from './helpers/crmPostgresFixture.ts';
import {createPoolDbClient} from '../src/db/client.ts';
import {PostgresA1VaultRepository} from '../src/repositories/postgresA1VaultRepository.ts';
import {A1VaultEncryption} from '../src/services/a1VaultEncryption.ts';

test('native PG A1 repository: encrypted persistence, RLS, CAS, rollback and reopen (not PKCS12 acceptance)',async()=>{
 const url=process.env.DATABASE_URL;assertCrmIsolatedUrl(url);
 const suffix=randomUUID().replaceAll('-',''),schema='hmla1_'+suffix,role='a1_'+suffix;
 const admin=new pg.Pool({connectionString:url,max:1});
 const pool=new pg.Pool({connectionString:url,max:4,options:'-c search_path='+schema+',pg_catalog'});
 const db=createPoolDbClient(pool),repo=new PostgresA1VaultRepository();
 const group=randomUUID(),a=randomUUID(),b=randomUUID(),actor=randomUUID();
 const ctx={groupId:group,empresaId:a,actorId:actor,requestId:randomUUID()};
 let created=false,roleCreated=false;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);created=true;
  await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);roleCreated=true;
  await db.query(`CREATE TABLE groups(id uuid PRIMARY KEY);CREATE TABLE empresas(id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),cnpj text,status text);CREATE TABLE profiles(id uuid PRIMARY KEY);`);
  await db.query('INSERT INTO groups VALUES($1)',[group]);await db.query('INSERT INTO profiles VALUES($1)',[actor]);
  for(const id of [a,b])await db.query('INSERT INTO empresas VALUES($1,$2,$3,$4)',[id,group,'11222333000181','Ativa']);
  await db.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role};GRANT SELECT,UPDATE(cnpj) ON empresas TO ${role};`);
  const sql=readFileSync(new URL('../schema-candidates/a1_certificate_vault.sql',import.meta.url),'utf8');
  await db.withTransaction(async q=>{await q.query("SELECT set_config('app.a1_app_role',$1,true)",[role]);await q.query(sql);});
  const run=<T>(scope:typeof ctx,fn:(q:Parameters<Parameters<typeof db.withTransaction>[0]>[0])=>Promise<T>)=>db.withTenantContext(scope,()=>db.withTransaction(async q=>{await q.query(`SET LOCAL ROLE ${role}`);return fn(q);}));
  const encryption=new A1VaultEncryption({active:async()=>({id:'synthetic',bytes:Buffer.alloc(32,7)}),read:async()=>Buffer.alloc(32,7)});
  const id=randomUUID(),operation=randomUUID();
  const envelope=await encryption.seal({groupId:group,empresaId:a,certificateId:id,issuerCnpj:'11222333000181'},Buffer.from('SYNTHETIC NOT PKCS12'),Buffer.from('SYNTHETIC PASSWORD'));
  const data={id,operationId:operation,issuerCnpj:'11222333000181',fingerprint:'a'.repeat(64),validFrom:'2026-01-01T00:00:00.000Z',validTo:'2027-01-01T00:00:00.000Z',trustVersion:'synthetic-not-official',envelope};
  const saved=await run(ctx,async q=>{assert.equal(await repo.prepare(ctx,q),'11222333000181');return repo.insert(ctx,q,data);});
  assert.equal(saved.revision,'1');assert.ok(!JSON.stringify(saved).includes('SYNTHETIC PASSWORD'));
  assert.deepEqual(await run(ctx,q=>repo.active(ctx,q)),saved);
  assert.equal(await run({...ctx,empresaId:b},q=>repo.get({...ctx,empresaId:b},q,id)),null);
  const other={...ctx,groupId:randomUUID()};
  assert.equal(await run(other,q=>repo.get(other,q,id)),null);
  await assert.rejects(run(other,q=>repo.insert(other,q,{...data,id:randomUUID(),operationId:randomUUID()})),{code:'42501'});
  await assert.rejects(run(ctx,q=>repo.insert(ctx,q,{...data,id:randomUUID()})),{code:'23505'});
  await assert.rejects(run(ctx,async q=>{await repo.change(ctx,q,saved,'REVOKED_LOCAL');throw Error('AUDIT_FAILURE');}),/AUDIT_FAILURE/);
  assert.deepEqual(await run(ctx,q=>repo.active(ctx,q)),saved);
  const changed=await run(ctx,q=>repo.change(ctx,q,saved,'REVOKED_LOCAL'));
  assert.equal(changed.revision,'2');assert.equal(changed.state,'REVOKED_LOCAL');
  await assert.rejects(run(ctx,q=>repo.change(ctx,q,saved,'SUPERSEDED')),{code:'A1_REVISION_CONFLICT'});
  assert.deepEqual(await run(ctx,q=>repo.get(ctx,q,id)),changed);
  assert.equal(await run(ctx,q=>repo.active(ctx,q)),null);
  await assert.rejects(run(ctx,q=>q.query('UPDATE a1_certificate_vault SET issuer_cnpj=$1 WHERE id=$2',['00000000000000',id])),{code:'42501'});
 }finally{
  await db.end();
  if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  if(roleCreated)await admin.query(`DROP ROLE ${role}`);
  await admin.end();
 }
});
