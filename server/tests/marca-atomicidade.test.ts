import {createServer} from 'node:http';
import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config/env.ts';
import {authColumnGrants} from './helpers/authBootstrapFixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {MarcaService} from '../src/services/marcaService.ts';
import {PostgresMarcaRepository} from '../src/repositories/postgresMarcaRepository.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {PostgresTenantGuard} from '../src/db/tenantGuard.ts';
import {PostgresRbacGuard} from '../src/db/rbacGuard.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
async function prove(f:any,role:string){try{
 await f.exec(`GRANT SELECT,INSERT,UPDATE ON marcas TO ${role};GRANT SELECT ON empresas TO ${role};CREATE POLICY fixture_marca ON marcas FOR ALL TO ${role} USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid) WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);CREATE POLICY fixture_empresa_marca ON empresas FOR SELECT TO ${role} USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);`);
 const s=new MarcaService(new PostgresMarcaRepository(f.data),new PostgresAuditRepository(f.data),new PostgresTenantGuard(f.data),new PostgresRbacGuard(f.data),f.data);
 const ctx={groupId:I.groupA,empresaId:I.empresaA,actorId:I.runtimeActorA,requestId:'synthetic-atomic'};
 const row=await s.create(ctx,{nome_marca:'Atomic',pais_origem:'Brasil'});
 const before=(await f.admin.query('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[I.groupA,'Marca'])).rows[0].next_value;
 await f.exec(`CREATE FUNCTION fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Marca' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER fixture_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fixture_fail_audit();`);
 await assert.rejects(()=>s.create(ctx,{nome_marca:'Must rollback'}),/synthetic audit failure/);
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM marcas WHERE nome_marca='Must rollback'")).rows[0].n,0);
 assert.equal((await f.admin.query('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[I.groupA,'Marca'])).rows[0].next_value,before);
 const auditBefore=(await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Marca'" )).rows[0].n;
 await assert.rejects(()=>s.softDelete(ctx,row.id),/synthetic audit failure/);
 assert.equal((await f.admin.query('SELECT ativo FROM marcas WHERE id=$1',[row.id])).rows[0].ativo,true);
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Marca'")).rows[0].n,auditBefore);
 await assert.rejects(()=>s.update(ctx,row.id,{descricao:'Must rollback'}),/synthetic audit failure/);
 assert.equal((await f.admin.query('SELECT descricao FROM marcas WHERE id=$1',[row.id])).rows[0].descricao,null);
 await f.exec('DROP TRIGGER fixture_fail ON audit_logs');await s.update(ctx,row.id,{descricao:'Preserved'});await s.softDelete(ctx,row.id);
 const persisted=(await f.admin.query('SELECT * FROM marcas WHERE id=$1',[row.id])).rows[0];assert.equal(persisted.ativo,false);assert.equal(persisted.pais_origem,'Brasil');assert.equal(persisted.descricao,'Preserved');
 await s.update(ctx,row.id,{ativo:true});
 const reopened=(await f.admin.query('SELECT * FROM marcas WHERE id=$1',[row.id])).rows[0];
 assert.equal(reopened.ativo,true);assert.equal(reopened.codigo,row.codigo);assert.equal(reopened.pais_origem,'Brasil');assert.equal(reopened.descricao,'Preserved');
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Marca' AND entity_id=$1",[row.id])).rows[0].n,4);
 await Promise.all([s.update(ctx,row.id,{descricao:'Concurrent description'}),s.update(ctx,row.id,{pais_origem:'Concurrent country'})]);
 const edited=(await f.admin.query('SELECT descricao,pais_origem FROM marcas WHERE id=$1',[row.id])).rows[0];
 assert.equal(edited.descricao,'Concurrent description');assert.equal(edited.pais_origem,'Concurrent country');
 const concurrent=await Promise.all([s.create(ctx,{nome_marca:'Concurrent A'}),s.create(ctx,{nome_marca:'Concurrent B'})]);
 assert.notEqual(concurrent[0].codigo,concurrent[1].codigo);assert.notEqual(concurrent[0].id,concurrent[1].id);
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM marcas WHERE nome_marca LIKE 'Concurrent %'")).rows[0].n,2);
 await assert.rejects(()=>s.create({...ctx,groupId:I.groupB},{nome_marca:'Cross tenant'}),e=>e.code==='TENANT_MISMATCH'||e.code==='PERMISSION_DENIED');
 assert.equal((await f.admin.query("SELECT count(*)::int n FROM marcas WHERE nome_marca='Cross tenant'")).rows[0].n,0);
 await proveHttp(f,role);
 }finally{await f.close();}
}
test('Marca persistent rollback restores record and code sequence',async()=>prove(await localCrmFixture(),ROLE));
if(process.env.DATABASE_URL)test('Marca PostgreSQL real isolated persistence audit rollback and sequence',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!);await prove(f,f.role);});

/** Uses the real persistent app and verified provider with a separate SELECT-only fixture role.
 * SET LOCAL ROLE proves SQL/RLS authorization; actual LOGIN startup is covered in TENANT_CONTEXT.
 */
async function proveHttp(f:any,role:string) {
 const authRole=role+'_auth';
 const owner='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 const branch='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
 const provider=createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.headers.authorization==='Bearer invalid'){res.statusCode=401;res.end('{}');return;}
  res.end(JSON.stringify({id:req.headers.authorization==='Bearer restricted'?branch:owner,email:'synthetic@example.test'}));
 }).listen(0);
 await new Promise<void>(resolve=>provider.once('listening',resolve));
 let server:any;
 try {
  await f.exec(`CREATE ROLE ${authRole} NOSUPERUSER NOBYPASSRLS NOLOGIN;GRANT USAGE ON SCHEMA ${f.schema ?? 'public'} TO ${authRole};${authColumnGrants(authRole)}`);
  const flags=(await f.admin.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[authRole])).rows[0];
  assert.equal(flags.rolsuper,false);assert.equal(flags.rolbypassrls,false);
  await f.admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2',[owner,I.runtimeActorA]);
  await f.admin.query(`INSERT INTO profiles(id,auth_user_id,group_id,empresa_id,role,ativo,permissoes,email,full_name) VALUES($1,$2,$3,$4,'user',true,$5::jsonb,'restricted@example.test','Synthetic restricted')`,[branch,branch,I.groupA,I.empresaA,JSON.stringify({Cadastros:{marca:['visualizar']}})]);
  const authDb={query:f.data.query,withAuthIdentity:(id:string,fn:any)=>f.admin.withTransaction(async(q:any)=>{
   await q.query(`SET LOCAL ROLE ${authRole}`);
   await q.query("SELECT set_config('app.auth_user_id',$1,true)",[id]);return fn(q);
  })};
  const address=provider.address();assert(address&&typeof address!=='string');
  const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',ERP_AUTH_MODE:'supabase_user',SUPABASE_URL:`http://127.0.0.1:${address.port}`,SUPABASE_ANON_KEY:'synthetic',DATABASE_URL:'postgres://synthetic/fixture',AUTH_DATABASE_URL:'postgres://synthetic/fixture-auth'});
  const app=createApp({config,db:f.data,authDb,useMemory:false});
  server=app.app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));
  const endpoint=server.address();const base=`http://127.0.0.1:${endpoint.port}/api/v1/marcas`;
  const headers={authorization:'Bearer owner','x-group-id':I.groupA,'x-empresa-id':I.empresaA,'Content-Type':'application/json'};
  const created=await fetch(base,{method:'POST',headers,body:JSON.stringify({nome_marca:'HTTP persistent',pais_origem:'Brasil'})});
  assert.equal(created.status,201,JSON.stringify(await created.clone().json()));const row=(await created.json()).data;
  assert.equal((await fetch(`${base}/${row.id}`,{headers})).status,200);
  assert.equal((await fetch(base,{headers})).status,200);
  const restricted={...headers,authorization:'Bearer restricted'};
  assert.equal((await fetch(`${base}/${row.id}`,{headers:restricted})).status,200);
  assert.equal((await fetch(`${base}/${row.id}`,{method:'PATCH',headers:restricted,body:JSON.stringify({descricao:'Denied'})})).status,403);
  assert.equal((await fetch(base,{headers:{...headers,authorization:'Bearer invalid'}})).status,401);
  assert.equal((await fetch(base,{headers:{...restricted,'x-empresa-id':I.empresaA2}})).status,403);
  assert.equal((await fetch(`${base}/${row.id}`,{method:'PATCH',headers,body:JSON.stringify({descricao:'Edited'})})).status,200);
  assert.equal((await fetch(`${base}/${row.id}`,{method:'DELETE',headers})).status,200);
  assert.equal((await fetch(`${base}/${row.id}`,{method:'PATCH',headers,body:JSON.stringify({ativo:true})})).status,200);
  const reopened=await fetch(`${base}/${row.id}`,{headers});const saved=(await reopened.json()).data;
  assert.equal(saved.ativo,true);assert.equal(saved.codigo,row.codigo);assert.equal(saved.descricao,'Edited');assert.equal(saved.pais_origem,'Brasil');
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Marca' AND entity_id=$1",[row.id])).rows[0].n,4);
 } finally {
  if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
  await new Promise<void>(resolve=>provider.close(()=>resolve()));
  await f.exec(`DROP OWNED BY ${authRole};DROP ROLE ${authRole}`);
 }
}