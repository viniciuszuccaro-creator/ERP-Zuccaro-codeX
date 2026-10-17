import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
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
import { OPORTUNIDADE_HISTORY_KEYS } from '../src/repositories/oportunidadeTypes.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture,ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'history-private-request'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY history_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),audit=new PostgresAuditRepository(f.admin);
  const tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin),clientes=new PostgresClienteRepository(f.admin),orcamentos=new PostgresOrcamentoRepository(f.admin);
  const service=new OportunidadeService(repo,audit,tenant,rbac,clientes,orcamentos);
  const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ctx.empresaId])).rows[0].id;
  const row=await service.create(ctx,{titulo:'Histórico canônico',cliente_empresa_id:link,idempotency_key:'history-private-idempotency',
    cliente_email:'private@example.invalid',observacoes:'private-notes',valor_estimado:'1.000001'});
  const created=await service.history(ctx,row.id.toUpperCase());
  assert.equal(created.meta.total,1);assert.equal(created.data[0].action,'create');
  assert.equal(created.data[0].before,null);assert.equal(created.data[0].after?.codigo,row.codigo);
  assert.equal(created.data[0].actor_id,ctx.actorId);assert.ok(created.data[0].created_at);
  await service.update(ctx,row.id,{expected_version:1,valor_estimado:'1.123456',etapa:'Proposta'});
  await service.setActive(ctx,row.id,{expected_version:2},false);
  assert.equal((await service.history(ctx,row.id)).meta.total,3);
  await service.setActive(ctx,row.id,{expected_version:3},true);
  await f.exec(`CREATE FUNCTION history_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='update' THEN RAISE EXCEPTION 'synthetic history audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER history_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE history_audit_fail()`);
  await assert.rejects(service.update(ctx,row.id,{expected_version:4,valor_estimado:'2.123456'}),/synthetic history audit failure/);
  await f.exec('DROP TRIGGER history_audit_fail ON audit_logs; DROP FUNCTION history_audit_fail()');
  assert.equal((await service.history(ctx,row.id)).meta.total,4);assert.equal((await service.get(ctx,row.id)).version,4);
  await service.update(ctx,row.id,{expected_version:4,valor_estimado:'2.123456'});
  const timeline=await service.history(ctx,row.id);
  const edited=timeline.data.find(e=>e.after?.version===2)!;
  assert.equal(edited.before?.valor_estimado,'1.000001');assert.equal(edited.after?.valor_estimado,'1.123456');
  assert.ok(timeline.data.some(e=>e.action==='inactivate'&&e.after?.ativo===false));
  assert.ok(timeline.data.some(e=>e.action==='restore'&&e.after?.ativo===true));
  const insertAudit=async(group=ctx.groupId,company=ctx.empresaId,entity='Oportunidade',id=row.id)=>f.admin.query(`
    INSERT INTO audit_logs(group_id,empresa_id,entity,entity_id,action,after_data) VALUES($1,$2,$3,$4,'update','{"codigo":"cross-scope"}')`,[group,company,entity,id]);
  await insertAudit(ID.groupA,ID.empresaA2);await insertAudit(ID.groupB,ID.empresaB);await insertAudit(ctx.groupId,ctx.empresaId,'Pedido');
  const orphan=randomUUID();await insertAudit(ctx.groupId,ctx.empresaId,'Oportunidade',orphan);
  await assert.rejects(service.history(ctx,orphan),{code:'OPORTUNIDADE_NOT_FOUND'});
  await assert.rejects(service.history({...ctx,empresaId:ID.empresaA2},row.id),{code:'OPORTUNIDADE_NOT_FOUND'});
  await f.admin.query(`INSERT INTO audit_logs(group_id,empresa_id,actor_id,actor_email,entity,entity_id,action,
    before_data,after_data,request_id,ip_address,created_at)
    SELECT $1,$2,$3,'private@example.invalid','Oportunidade',$4,'update','{}'::jsonb,
      '{"codigo":"000001","status":{"api_key":"private-nested-secret"},"observacoes":"private-notes",
        "idempotency_key":"private-replay","historico_mudancas_etapa":[{"request_hash":"private-nested-hash"}]}'::jsonb,
      'private-request','192.0.2.1','2020-01-01'::timestamptz FROM generate_series(1,200)`,[ctx.groupId,ctx.empresaId,ctx.actorId,row.id]);
  const first=await service.history(ctx,row.id,{limit:200}),last=await service.history(ctx,row.id,{limit:200,offset:200});
  assert.equal(first.meta.total,205);assert.equal(first.data.length,200);assert.equal(first.meta.hasMore,true);
  assert.equal(last.data.length,5);assert.equal(last.meta.hasMore,false);
  const all=[...first.data,...last.data];assert.equal(new Set(all.map(e=>e.id)).size,205);
  const order=(await f.admin.query<{id:string}>('SELECT id FROM audit_logs WHERE group_id=$1 AND empresa_id=$2 AND entity=$3 AND entity_id=$4 ORDER BY created_at DESC,id DESC',[ctx.groupId,ctx.empresaId,'Oportunidade',row.id])).rows.map(r=>r.id);
  assert.deepEqual(all.map(e=>e.id),order);
  const serialized=JSON.stringify(all);
  for(const secret of ['private-', 'private@example.invalid','192.0.2.1','payload_fingerprint','cliente_empresa_id','actor_email','cross-scope','request_hash'])
    assert.equal(serialized.includes(secret),false);
  assert.equal('status' in last.data[0].after!,false);
  for(const event of all)for(const snapshot of [event.before,event.after])for(const key of Object.keys(snapshot??{}))
    assert.ok((OPORTUNIDADE_HISTORY_KEYS as readonly string[]).includes(key));
  for(const options of [{limit:201},{offset:-1},{search:'private'},{empresa_id:ID.empresaB}])
    await assert.rejects(service.history(ctx,row.id,options),{statusCode:422});
  await assert.rejects(service.history({...ctx,actorId:null},row.id),{statusCode:403});
  await assert.rejects(service.history({...ctx,groupId:ID.groupB,empresaId:ID.empresaB},row.id),{statusCode:403});
  const permissions=(await f.admin.query<{permissoes:unknown}>('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  for(const tree of [{CRM:{oportunidades:{_acoes:['editar']}}},{'*':true}]) {
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(tree),ctx.actorId]);
    await assert.rejects(service.history(ctx,row.id),{statusCode:403});
  }
  await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(permissions),ctx.actorId]);
  const mutable={...ctx},options={limit:1,offset:0};let once=true;const oldTenant=tenant.assertEmpresaInGroup.bind(tenant);
  tenant.assertEmpresaInGroup=async(...args)=>{if(once){once=false;mutable.empresaId=ID.empresaB;options.offset=200;}await oldTenant(...args);};
  assert.equal((await service.history(mutable,row.id,options)).data[0].id,first.data[0].id);tenant.assertEmpresaInGroup=oldTenant;
  await f.exec(`GRANT UPDATE(permissoes) ON profiles TO ${role};
    CREATE POLICY history_profile_update ON profiles FOR UPDATE TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  const original=repo.history.bind(repo);
  repo.history=async(...args)=>{const result=await original(...args);await args[4]!.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify({}),ctx.actorId]);return result;};
  await assert.rejects(service.history(ctx,row.id),{statusCode:403});repo.history=original;
  await f.exec(`REVOKE SELECT ON audit_logs FROM ${role}`);await assert.rejects(service.history(ctx,row.id),{code:'42501'});
  await f.exec(`GRANT SELECT ON audit_logs TO ${role}`);
  for(const sql of ['UPDATE audit_logs SET action=action WHERE entity_id=$1','DELETE FROM audit_logs WHERE entity_id=$1'])
    await assert.rejects(repo.withTransaction(ctx,tx=>tx!.query(sql,[row.id])),{code:'42501'});
  assert.equal((await service.history(ctx,row.id)).meta.total,205);
  const memoryService=new OportunidadeService(new InMemoryOportunidadeRepository(),audit,tenant,rbac,clientes,orcamentos);
  await assert.rejects(memoryService.history(ctx,row.id),{code:'CRM_HISTORY_UNAVAILABLE'});
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades/${row.id}/historico`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId};
    const r=await fetch(`${base}?limit=1&offset=200`,{headers});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    const result=await r.json();assert.equal(result.meta.total,205);assert.equal(result.data[0].id,last.data[0].id);
    for(const q of ['limit=201','offset=-1','empresa_id='+ID.empresaB,'search=x'])
      assert.equal((await fetch(`${base}?${q}`,{headers})).status,422);
    assert.equal((await fetch(base,{headers:{...headers,'x-empresa-id':ID.empresaA2}})).status,404);
    assert.equal((await fetch(base,{headers:{...headers,'x-actor-id':ID.runtimeActorB}})).status,403);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('Histórico CRM: ciclo canônico, audit rollback, >200 eventos, projeção, RLS/RBAC e HTTP',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('Histórico PostgreSQL real LOGIN restrito sem bypass executa percurso completo',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try {
    const r=(await f.data.query<any>('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(r.current_user,f.role);assert.equal(r.session_user,f.role);assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
test('Histórico CRM OFF por padrão preserva gate existente',async()=>{
  const {app}=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'})});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const r=await fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades/${randomUUID()}/historico`,{
      headers:{'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId}});
    assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CRM_HTTP_DISABLED');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
