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
import { sumOportunidadeValues } from '../src/repositories/oportunidadeTypes.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture,ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'funnel-synthetic'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY funnel_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin);
  const audit=new PostgresAuditRepository(f.admin),clientes=new PostgresClienteRepository(f.admin),orcamentos=new PostgresOrcamentoRepository(f.admin);
  const service=new OportunidadeService(repo,audit,tenant,rbac,clientes,orcamentos);
  const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ctx.empresaId])).rows[0].id;
  const row=await service.create(ctx,{titulo:'Funil principal',cliente_empresa_id:link,idempotency_key:'funnel-initial-record',
    valor_estimado:'0.000001',cliente_email:'private@example.invalid',observacoes:'private-notes'});
  const insert=async(company=ctx.empresaId,group=ctx.groupId,actor=ctx.actorId,start=500,end=704)=>f.admin.query(`
    INSERT INTO oportunidades(group_id,empresa_id,codigo,codigo_oportunidade,idempotency_key,payload_fingerprint,
      cliente_nome,titulo,etapa,status,valor_estimado,probabilidade,temperatura,origem,data_abertura,created_by,updated_by)
    SELECT $1,$2,lpad(n::text,6,'0'),'OPP-'||n,'funnel-'||n,repeat('a',64),'Synthetic','Funil '||n,
      'Proposta','Aberto',999999999999.123456,20,'Morno','CRM','2026-10-17',$3,$3
    FROM generate_series($4::int,$5::int) n`,[group,company,actor,start,end]);
  await insert();await insert(ID.empresaA2,ID.groupA,ID.runtimeActorA,800,800);
  await insert(ID.empresaB,ID.groupB,ID.runtimeActorB,900,900);
  const first=await service.funnel(ctx);
  assert.equal(first.meta.total,206);assert.equal(first.meta.valor_estimado,'204999999999820.308481');
  assert.equal(first.data.length,2);assert.equal(first.data.find(r=>r.etapa==='Proposta')!.total,205);
  const serialized=JSON.stringify(first);
  for(const secret of [row.id,link,'private@example.invalid','private-notes','funnel-initial-record','cliente_email','payload_fingerprint'])
    assert.equal(serialized.includes(secret),false);
  // A grouped indicator and its drill-down must select exactly the same full collection.
  const reconcile=async(filters:Record<string,unknown>={})=>{
    const report=await service.funnel(ctx,filters);let count=0;const totals:string[]=[];
    for(const group of report.data) {
      const p=await service.list(ctx,{...group.drilldown,limit:200});
      const next=await service.list(ctx,{...group.drilldown,limit:200,offset:200});
      const rows=[...p.data,...next.data];assert.equal(p.meta.total,group.total);assert.equal(rows.length,group.total);
      assert.equal(sumOportunidadeValues(rows.map(r=>r.valor_estimado)),group.valor_estimado);
      count+=rows.length;totals.push(group.valor_estimado);
    }
    assert.equal(count,report.meta.total);assert.equal(sumOportunidadeValues(totals),report.meta.valor_estimado);
  };
  await reconcile();await reconcile({search:'Funil 50'});await reconcile({clienteEmpresaId:link});
  assert.equal((await service.funnel(ctx,{etapa:'Proposta'})).meta.total,205);
  assert.deepEqual((await service.funnel(ctx,{status:'Perdido'})).meta,{total:0,valor_estimado:'0.000000'});
  assert.equal((await service.funnel({...ctx,empresaId:ID.empresaA2})).meta.total,1);
  for(const filters of [{limit:1},{offset:200},{group_id:ID.groupB},{etapa:'x'.repeat(61)},{status:'x'.repeat(61)},{search:'x'.repeat(81)}])
    await assert.rejects(service.funnel(ctx,filters),{statusCode:422});
  assert.equal((await service.funnel(ctx,{search:"' OR 1=1 --"})).meta.total,0);
  await service.setActive(ctx,row.id,{expected_version:1},false);
  assert.equal((await service.funnel(ctx,{ativo:true})).meta.total,205);
  assert.equal((await service.funnel(ctx,{ativo:false})).meta.valor_estimado,'0.000001');
  await service.setActive(ctx,row.id,{expected_version:2},true);
  await service.update(ctx,row.id,{expected_version:3,valor_estimado:'10.000001',etapa:'Proposta'});
  assert.equal((await service.funnel(ctx)).meta.valor_estimado,'204999999999830.308481');
  await f.exec(`CREATE FUNCTION funnel_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='update' THEN RAISE EXCEPTION 'synthetic funnel audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER funnel_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE funnel_audit_fail()`);
  await assert.rejects(service.update(ctx,row.id,{expected_version:4,valor_estimado:'1'}),/synthetic funnel audit failure/);
  await f.exec('DROP TRIGGER funnel_audit_fail ON audit_logs; DROP FUNCTION funnel_audit_fail()');
  assert.equal((await service.get(ctx,row.id)).codigo,row.codigo);
  assert.equal((await service.funnel(ctx)).meta.valor_estimado,'204999999999830.308481');
  // Historical labels remain explicit, without inventing state transitions or dropping them.
  await f.admin.query("UPDATE oportunidades SET status=' Histórico ',etapa=' Revisão legado ' WHERE codigo='000500'");
  await reconcile();assert.equal((await service.funnel(ctx,{status:' Histórico '})).meta.total,1);
  const saved=(await f.admin.query<{permissoes:unknown}>('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  for(const tree of [{CRM:{oportunidades:{_acoes:['editar']}}},{'*':true}]) {
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(tree),ctx.actorId]);
    await assert.rejects(service.funnel(ctx),{statusCode:403});
  }
  await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(saved),ctx.actorId]);
  await assert.rejects(service.funnel({...ctx,actorId:null}),{statusCode:403});
  await assert.rejects(service.funnel({...ctx,groupId:ID.groupB,empresaId:ID.empresaB}),{statusCode:403});
  const mutable={...ctx},options={etapa:'Proposta'};let once=true;
  const oldTenant=tenant.assertEmpresaInGroup.bind(tenant);
  tenant.assertEmpresaInGroup=async(...args)=>{if(once){once=false;mutable.empresaId=ID.empresaB;options.etapa='Prospecção';}await oldTenant(...args);};
  assert.equal((await service.funnel(mutable,options)).meta.total,205);tenant.assertEmpresaInGroup=oldTenant;
  await f.exec(`GRANT UPDATE(permissoes) ON profiles TO ${role};
    CREATE POLICY funnel_profile_update ON profiles FOR UPDATE TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  const oldFunnel=repo.funnel.bind(repo);
  repo.funnel=async(...args)=>{const result=await oldFunnel(...args);
    await args[2]!.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify({}),ctx.actorId]);return result;};
  await assert.rejects(service.funnel(ctx),{statusCode:403});repo.funnel=oldFunnel;
  assert.equal((await service.funnel(ctx)).meta.total,206);
  await f.exec(`REVOKE SELECT ON oportunidades FROM ${role}`);
  await assert.rejects(service.funnel(ctx),{code:'42501'});
  await f.exec(`GRANT SELECT ON oportunidades TO ${role}`);
  const memory=new InMemoryOportunidadeRepository();
  const a=await service.list(ctx,{limit:200}),b=await service.list(ctx,{limit:200,offset:200});
  for(const record of [...a.data,...b.data])await memory.create(ctx,{...record},record.idempotency_key,record.payload_fingerprint,ctx.actorId);
  const memoryService=new OportunidadeService(memory,audit,tenant,rbac,clientes,orcamentos);
  assert.deepEqual(await memoryService.funnel(ctx),await service.funnel(ctx));
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId};
    const r=await fetch(`${base}/funil?etapa=Proposta`,{headers});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    const report=await r.json();assert.equal(report.meta.total,205);
    const drill=await fetch(`${base}?${new URLSearchParams(report.data[0].drilldown)}`,{headers});
    assert.equal((await drill.json()).meta.total,report.data[0].total);
    for(const q of ['limit=1','offset=200','empresa_id='+ID.empresaB,'ativo=maybe'])
      assert.equal((await fetch(`${base}/funil?${q}`,{headers})).status,422);
    assert.equal((await fetch(`${base}/funil`,{headers:{...headers,'x-actor-id':ID.runtimeActorB}})).status,403);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('Funil canônico: >200 registros, soma decimal, drilldown completo, filtros, RLS/RBAC, rollback e HTTP',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('Funil PostgreSQL real: LOGIN restrito, agregação e drilldown do mesmo conjunto',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try {
    const who=(await f.data.query<any>('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(who.current_user,f.role);assert.equal(who.session_user,f.role);assert.equal(who.rolsuper,false);assert.equal(who.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
test('Funil OFF por padrão preserva o gate CRM existente',async()=>{
  const {app}=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'})});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const r=await fetch(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades/funil`,{
      headers:{'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId}});
    assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CRM_HTTP_DISABLED');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
