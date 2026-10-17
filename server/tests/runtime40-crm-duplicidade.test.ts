import assert from 'node:assert/strict';
import test from 'node:test';
import type { DbClient } from '../src/db/client.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { PostgresOportunidadeRepository } from '../src/repositories/postgresOportunidadeRepository.ts';
import { InMemoryOportunidadeRepository } from '../src/repositories/inMemoryOportunidadeRepository.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture,ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'duplicate-synthetic'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
const input={titulo:' Viga sintética ',email:' LEAD@EXAMPLE.INVALID '};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY duplicate_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),audit=new PostgresAuditRepository(f.admin),tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin);
  const clientes=new PostgresClienteRepository(f.admin),orcamentos=new PostgresOrcamentoRepository(f.admin);
  const service=new OportunidadeService(repo,audit,tenant,rbac,clientes,orcamentos);
  const payload={titulo:'Viga sintética',cliente_email:'lead@example.invalid',cliente_telefone:'+55 (11) 99999-0000',
    descricao:'private-description',observacoes:'private-notes',idempotency_key:'private-command-key-a'};
  const first=await service.create(ctx,payload),second=await service.create(ctx,{...payload,idempotency_key:'private-command-key-b'});
  // Separate command receipts can represent legitimate negotiations. Suggestions never merge or block them.
  assert.notEqual(first.id,second.id);assert.equal((await service.create(ctx,payload)).id,first.id);
  const a2=await service.create({...ctx,empresaId:ID.empresaA2},{...payload,idempotency_key:'private-other-company'});
  await service.create({...ctx,groupId:ID.groupB,empresaId:ID.empresaB,actorId:ID.runtimeActorB},{...payload,idempotency_key:'private-other-group'});
  const closed=await service.create(ctx,{...payload,titulo:'Fechada',idempotency_key:'private-closed-key'});
  await service.update(ctx,closed.id,{expected_version:1,status:'Cancelado'});
  const inactive=await service.create(ctx,{...payload,titulo:'Inativa',idempotency_key:'private-inactive-key'});
  await service.setActive(ctx,inactive.id,{expected_version:1},false);
  const before=(await f.admin.query('SELECT to_jsonb(o) AS row FROM oportunidades o ORDER BY id')).rows;
  const result=await service.suggestDuplicate(ctx,input);
  assert.equal(result.sugestao,true);assert.equal(result.mescla,'revisao_humana_obrigatoria');
  assert.ok([first.id,second.id].includes(result.data!.id));assert.notEqual(result.data!.id,a2.id);
  assert.deepEqual(Object.keys(result.data!).sort(),['codigo','codigo_oportunidade','etapa','id','status']);
  assert.equal((await service.suggestDuplicate(ctx,{titulo:'VIGA SINTÉTICA',telefone:'+55 (11) 99999-0000'})).sugestao,true);
  assert.equal((await service.suggestDuplicate(ctx,{titulo:'Viga sintética',telefone:'5511999990000'})).sugestao,true);
  assert.equal((await service.suggestDuplicate(ctx,{titulo:'Viga sintética',telefone:'11999990000'})).sugestao,false); // Never infer country code.
  assert.equal((await service.suggestDuplicate(ctx,{...input,email:'different@example.invalid',telefone:'5511999990000'})).sugestao,false); // Existing policy gives email precedence.
  for(const body of [{...input,titulo:'Outra negociação'},{...input,titulo:'Fechada'},{...input,titulo:'Inativa'}])
    assert.equal((await service.suggestDuplicate(ctx,body)).sugestao,false);
  assert.equal((await service.suggestDuplicate({...ctx,empresaId:ID.empresaA2},input)).data!.id,a2.id);
  const again=await Promise.all([service.suggestDuplicate(ctx,input),service.suggestDuplicate(ctx,input)]);
  assert.equal(again[0].data!.id,result.data!.id);assert.equal(again[1].data!.id,result.data!.id);
  assert.deepEqual((await f.admin.query('SELECT to_jsonb(o) AS row FROM oportunidades o ORDER BY id')).rows,before);
  const events=(await f.admin.query<{action:string;after_data:any}>('SELECT action,after_data FROM audit_logs WHERE after_data->>\'operation\'=$1',['suggest_duplicate'])).rows;
  assert.ok(events.some(e=>e.action==='possible_duplicate'&&e.after_data.matched===true));
  assert.ok(events.some(e=>e.action==='read'&&e.after_data.matched===false));
  const privacy=JSON.stringify({events,result});
  for(const secret of ['lead@example.invalid','5511999990000','99999-0000','private-command','private-notes','private-description','payload_fingerprint','Viga sintética'])
    assert.equal(privacy.includes(secret),false);
  for(const body of [{},{titulo:'Viga sintética'},{...input,email:'invalid'},{...input,telefone:'abc'},
    {...input,telefone:'123'},{...input,idempotency_key:'spoofed-key'},{...input,empresa_id:ID.empresaB}])
    await assert.rejects(service.suggestDuplicate(ctx,body),{statusCode:422});
  const saved=(await f.admin.query<{permissoes:unknown}>('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  for(const tree of [{CRM:{oportunidades:{_acoes:['visualizar']}}},{CRM:{oportunidades:{_acoes:['dados-sensiveis.visualizar']}}},{'*':true}]) {
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(tree),ctx.actorId]);
    await assert.rejects(service.suggestDuplicate(ctx,input),{statusCode:403});
  }
  await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(saved),ctx.actorId]);
  await assert.rejects(service.suggestDuplicate({...ctx,actorId:null},input),{statusCode:403});
  await assert.rejects(service.suggestDuplicate({...ctx,groupId:ID.groupB,empresaId:ID.empresaB},input),{statusCode:403});
  const mutable={...ctx},body={...input};let once=true;const oldTenant=tenant.assertEmpresaInGroup.bind(tenant);
  tenant.assertEmpresaInGroup=async(...args)=>{if(once){once=false;mutable.empresaId=ID.empresaB;body.email='different@example.invalid';}await oldTenant(...args);};
  assert.equal((await service.suggestDuplicate(mutable,body)).data!.id,result.data!.id);tenant.assertEmpresaInGroup=oldTenant;
  await f.exec(`GRANT UPDATE(permissoes) ON profiles TO ${role};
    CREATE POLICY duplicate_profile_update ON profiles FOR UPDATE TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  const original=repo.duplicateCandidate.bind(repo);
  repo.duplicateCandidate=async(...args)=>{const row=await original(...args);await args[2]!.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify({}),ctx.actorId]);return row;};
  await assert.rejects(service.suggestDuplicate(ctx,input),{statusCode:403});repo.duplicateCandidate=original;
  await f.exec(`CREATE FUNCTION duplicate_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF (NEW.after_data->>'operation')='suggest_duplicate' THEN RAISE EXCEPTION 'synthetic duplicate audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER duplicate_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE duplicate_audit_fail()`);
  const count=async()=>Number((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM audit_logs WHERE after_data->>\'operation\'=$1',['suggest_duplicate'])).rows[0].n);
  const n=await count();await assert.rejects(service.suggestDuplicate(ctx,input),/synthetic duplicate audit failure/);assert.equal(await count(),n);
  await f.exec('DROP TRIGGER duplicate_audit_fail ON audit_logs; DROP FUNCTION duplicate_audit_fail()');
  assert.equal((await service.suggestDuplicate(ctx,input)).data!.id,result.data!.id);
  await f.exec(`REVOKE SELECT ON oportunidades FROM ${role}`);await assert.rejects(service.suggestDuplicate(ctx,input),{code:'42501'});
  await f.exec(`GRANT SELECT ON oportunidades TO ${role}`);
  const memoryService=new OportunidadeService(new InMemoryOportunidadeRepository(),audit,tenant,rbac,clientes,orcamentos);
  await assert.rejects(memoryService.suggestDuplicate(ctx,input),{code:'CRM_DUPLICATE_LOOKUP_UNAVAILABLE'});
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const url=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades/sugestao-duplicidade`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId,'Content-Type':'application/json'};
    const post=(data:unknown,extraHeaders={})=>fetch(url,{method:'POST',headers:{...headers,...extraHeaders},body:JSON.stringify(data)});
    const r=await post(input);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    assert.deepEqual(await r.json(),result);
    assert.equal((await fetch(url+'?email=synthetic@example.invalid',{method:'POST',headers,body:JSON.stringify(input)})).status,422);
    assert.equal((await post({...input,group_id:ID.groupB})).status,422);
    assert.equal((await post(input,{'x-actor-id':ID.runtimeActorB})).status,403);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  assert.deepEqual((await f.admin.query('SELECT to_jsonb(o) AS row FROM oportunidades o ORDER BY id')).rows,before);
}
test('Sugestão CRM: política existente, permissão sensível, consulta sem mescla, audit rollback e HTTP',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('Sugestão PostgreSQL real LOGIN restrito sem bypass executa percurso completo',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try {
    const r=(await f.data.query<any>('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(r.current_user,f.role);assert.equal(r.session_user,f.role);assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
test('Sugestão CRM OFF por padrão preserva gate existente',async()=>{
  const {app}=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'})});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const r=await fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades/sugestao-duplicidade`,{
      method:'POST',headers:{'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId,'Content-Type':'application/json'},body:JSON.stringify(input)});
    assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CRM_HTTP_DISABLED');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
