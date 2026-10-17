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

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'agenda-synthetic'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY agenda_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin);
  const service=new OportunidadeService(repo,new PostgresAuditRepository(f.admin),tenant,rbac,
    new PostgresClienteRepository(f.admin),new PostgresOrcamentoRepository(f.admin));
  const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ctx.empresaId])).rows[0].id;
  const row=await service.create(ctx,{titulo:'Retorno canônico',cliente_empresa_id:link,idempotency_key:'agenda-initial-record',
    proxima_acao:'Retornar ao cliente',data_proxima_acao:'2026-10-16',valor_estimado:'123.456789'});
  const noDate=await service.create(ctx,{titulo:'Sem data',cliente_empresa_id:link,idempotency_key:'agenda-missing-date'});
  const insert=async(company=ctx.empresaId,group=ctx.groupId,actor=ctx.actorId,start=500,end=704)=>f.admin.query(`
    INSERT INTO oportunidades(group_id,empresa_id,codigo,codigo_oportunidade,idempotency_key,payload_fingerprint,
      cliente_nome,titulo,etapa,status,valor_estimado,probabilidade,temperatura,origem,data_abertura,created_by,updated_by,
      proxima_acao,data_proxima_acao)
    SELECT $1,$2,lpad(n::text,6,'0'),'OPP-'||n,'agenda-'||n,repeat('a',64),'Synthetic','Agenda '||n,
      'Prospecção','Aberto',12.345678,20,'Morno','CRM','2026-10-17',$3,$3,'Retornar','2026-10-17'::date+(n%3)
    FROM generate_series($4::int,$5::int) n`,[group,company,actor,start,end]);
  await insert();await insert(ID.empresaA2,ID.groupA,ID.runtimeActorA,800,800);
  await insert(ID.empresaB,ID.groupB,ID.runtimeActorB,900,900);
  const first=await service.list(ctx,{agenda:true,limit:200}),last=await service.list(ctx,{agenda:true,limit:200,offset:200});
  assert.equal(first.meta.total,206);assert.equal(first.data.length,200);assert.equal(first.meta.hasMore,true);
  assert.equal(last.data.length,6);assert.equal(last.meta.hasMore,false);
  const all=[...first.data,...last.data];assert.equal(new Set(all.map(r=>r.id)).size,206);
  assert.equal(all[0].id,row.id);assert.equal(all.some(r=>r.id===noDate.id),false);
  const keys=all.map(r=>`${r.data_proxima_acao}|${r.id}`);assert.deepEqual(keys,[...keys].sort());
  assert.equal((await service.list(ctx,{agenda:true,acaoAte:'2026-10-17'})).meta.total,69);
  assert.equal((await service.list(ctx,{agenda:true,acaoDe:'2026-10-17',acaoAte:'2026-10-18'})).meta.total,136);
  assert.equal((await service.list(ctx,{agenda:true,clienteEmpresaId:link})).meta.total,1);
  assert.equal((await service.list(ctx,{agenda:true,ativo:false})).meta.total,0);
  assert.equal((await service.list(ctx,{agenda:true,status:'Ganho'})).meta.total,0);
  assert.equal((await service.list(ctx,{agenda:true,search:'Agenda 50'})).meta.total,10);
  assert.equal((await service.list({...ctx,empresaId:ID.empresaA2},{agenda:true})).meta.total,1);
  for(const input of [{acaoAte:'2026-10-20'},{agenda:false,acaoDe:'2026-10-20'},
    {agenda:true,acaoDe:'2026-02-30'},{agenda:true,acaoAte:'0000-01-01'},
    {agenda:true,acaoDe:'2026-10-20',acaoAte:'2026-10-19'},{agenda:true,group_id:ID.groupB}])
    await assert.rejects(service.list(ctx,input),{statusCode:422});
  const changed=await service.update(ctx,row.id,{expected_version:1,data_proxima_acao:'2026-10-20'});
  assert.equal(changed.codigo,row.codigo);assert.equal(changed.valor_estimado,row.valor_estimado);
  assert.equal(changed.proxima_acao,row.proxima_acao);
  assert.equal((await service.get(ctx,row.id)).data_proxima_acao,'2026-10-20');
  assert.equal((await service.list(ctx,{agenda:true,acaoAte:'2026-10-17'})).meta.total,68);
  const competing=await Promise.allSettled([
    service.update(ctx,row.id,{expected_version:2,data_proxima_acao:'2026-10-21'}),
    service.update(ctx,row.id,{expected_version:2,data_proxima_acao:'2026-10-22'}),
  ]);assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);
  const before=await service.get(ctx,row.id);assert.equal(before.version,3);
  await f.exec(`CREATE FUNCTION agenda_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='update' THEN RAISE EXCEPTION 'synthetic agenda audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER agenda_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE agenda_audit_fail()`);
  await assert.rejects(service.update(ctx,row.id,{expected_version:3,data_proxima_acao:'2026-10-30'}),/synthetic agenda audit failure/);
  await f.exec('DROP TRIGGER agenda_audit_fail ON audit_logs; DROP FUNCTION agenda_audit_fail()');
  assert.equal((await service.get(ctx,row.id)).data_proxima_acao,before.data_proxima_acao);
  await service.setActive(ctx,row.id,{expected_version:3},false);
  assert.equal((await service.list(ctx,{agenda:true,clienteEmpresaId:link})).meta.total,0);
  await service.setActive(ctx,row.id,{expected_version:4},true);
  const closed=await service.update(ctx,row.id,{expected_version:5,status:'Cancelado'});
  assert.equal(closed.status,'Cancelado');assert.equal((await service.list(ctx,{agenda:true,clienteEmpresaId:link})).meta.total,0);
  assert.equal((await service.get(ctx,row.id)).data_proxima_acao,before.data_proxima_acao);
  const history=await new PostgresAuditRepository(f.admin).listByEntity('Oportunidade',row.id);
  assert.ok(history.some(e=>(e.beforeData as any)?.data_proxima_acao==='2026-10-16' && (e.afterData as any)?.data_proxima_acao==='2026-10-20'));
  // Every terminal canonical state is excluded, while unfiltered documents remain readable.
  await f.admin.query(`UPDATE oportunidades SET status=CASE codigo WHEN '000500' THEN 'Ganho' WHEN '000501' THEN 'Perdido' ELSE 'Cancelado' END
    WHERE codigo IN ('000500','000501','000502')`);
  assert.equal((await service.list(ctx,{agenda:true})).meta.total,202);
  assert.equal((await service.list(ctx)).meta.total,207);
  const permissions=(await f.admin.query<{permissoes:unknown}>('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  for(const denied of [{CRM:{oportunidades:{_acoes:['editar']}}},{'*':true}]) {
    await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(denied),ctx.actorId]);
    await assert.rejects(service.list(ctx,{agenda:true}),{statusCode:403});
  }
  await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(permissions),ctx.actorId]);
  await assert.rejects(service.list({...ctx,groupId:ID.groupB,empresaId:ID.empresaB},{agenda:true}),{statusCode:403});
  await assert.rejects(service.list({...ctx,actorId:null},{agenda:true}),{statusCode:403});
  const mutable={...ctx},filters={agenda:true,acaoAte:'2026-10-17'};
  const oldGuard=tenant.assertEmpresaInGroup.bind(tenant);let once=true;
  tenant.assertEmpresaInGroup=async(...args)=>{if(once){once=false;mutable.empresaId=ID.empresaB;filters.acaoAte='2026-12-31';}await oldGuard(...args);};
  const captured=await service.list(mutable,filters);tenant.assertEmpresaInGroup=oldGuard;
  assert.equal(captured.meta.total,67);
  // Synthetic-only grant permits a real SQL revocation inside the read transaction.
  await f.exec(`GRANT UPDATE(permissoes) ON profiles TO ${role};
    CREATE POLICY agenda_profile_update ON profiles FOR UPDATE TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  const oldList=repo.list.bind(repo);
  repo.list=async(...args)=>{const result=await oldList(...args);
    await args[2]!.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify({}),ctx.actorId]);return result;};
  await assert.rejects(service.list(ctx,{agenda:true}),{statusCode:403});repo.list=oldList;
  assert.equal((await service.list(ctx,{agenda:true})).meta.total,202);
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId};
    const r=await fetch(`${base}?agenda=true&acaoAte=2026-10-17&limit=1`,{headers});
    assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    const result=await r.json();assert.equal(result.meta.total,67);assert.equal(result.data.length,1);assert.equal(result.meta.hasMore,true);
    for(const q of ['agenda=1','agenda=true&acaoDe=2026-02-30','acaoAte=2026-10-17','agenda=true&acaoDe=2026-10-20&acaoAte=2026-10-01'])
      assert.equal((await fetch(`${base}?${q}`,{headers})).status,422);
    assert.equal((await fetch(`${base}?agenda=true`,{headers:{...headers,'x-actor-id':ID.runtimeActorB}})).status,403);
    assert.equal((await fetch(`${base}?agenda=true`,{headers:{...headers,'x-empresa-id':ID.empresaA2}})).status,200);
    const off=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'})});
    const disabled=off.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>disabled.once('listening',resolve));
    try {assert.equal((await fetch(`http://127.0.0.1:${(disabled.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades?agenda=true`,{headers})).status,503);}
    finally{await new Promise<void>((resolve,reject)=>disabled.close(e=>e?reject(e):resolve()));}
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  // The in-memory adapter preserves the same canonical agenda semantics.
  const memory=new InMemoryOportunidadeRepository();
  for(const record of all)await memory.create(ctx,{...record},record.idempotency_key,record.payload_fingerprint,ctx.actorId);
  const m=await memory.list(ctx,{agenda:true,acaoAte:'2026-10-17',limit:200,offset:0});
  assert.equal(m.total,69);assert.deepEqual(m.rows.map(r=>r.data_proxima_acao),[...m.rows].sort((a,b)=>a.data_proxima_acao!.localeCompare(b.data_proxima_acao!)).map(r=>r.data_proxima_acao));
}
test('CRM agenda: agendar→consultar→reagendar→encerrar, paginação, RBAC, RLS, audit rollback e HTTP',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('CRM agenda PostgreSQL real LOGIN restrito sem bypass executa percurso completo',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try {
    const r=(await f.data.query<any>('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(r.current_user,f.role);assert.equal(r.session_user,f.role);assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
