import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { DbClient } from '../src/db/client.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { PostgresOportunidadeRepository } from '../src/repositories/postgresOportunidadeRepository.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { oportunidadeCsv,OPORTUNIDADE_CSV_COLUMNS } from '../src/services/oportunidadeCsv.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture,ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'crm-export-synthetic'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
const grants={CRM:{oportunidades:{_acoes:['visualizar','exportar']}}};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY crm_export_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),audit=new PostgresAuditRepository(f.admin);
  const tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin);
  const service=new OportunidadeService(repo,audit,tenant,rbac,new PostgresClienteRepository(f.admin),new PostgresOrcamentoRepository(f.admin));
  const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ID.empresaA])).rows[0].id;
  const first=await service.create(ctx,{titulo:'=HYPERLINK("synthetic")',cliente_empresa_id:link,idempotency_key:'export-first-record',
    valor_estimado:'999999999999.123456',descricao:'private-description',cliente_email:'private@example.invalid',
    observacoes:'private-notes',data_proxima_acao:'2026-10-20'});
  // Synthetic batch > maximum UI page; exact decimal values must not pass through JS Number.
  const insert=async(start:number,end:number,company=ID.empresaA,group=ID.groupA,actor=ID.runtimeActorA)=>{
    await f.admin.query(`INSERT INTO oportunidades(group_id,empresa_id,codigo,codigo_oportunidade,idempotency_key,payload_fingerprint,
      cliente_nome,titulo,etapa,status,valor_estimado,probabilidade,temperatura,origem,data_abertura,created_by,updated_by)
      SELECT $1,$2,lpad(n::text,6,'0'),'OPP-'||lpad(n::text,6,'0'),'export-batch-'||n,repeat('a',64),
      'Synthetic','Export '||n,'Prospecção','Aberto',123.456789,20,'Morno','CRM','2026-10-17',$3,$3
      FROM generate_series($4::int,$5::int) n`,[group,company,actor,start,end]);
  };
  await insert(100,304);await insert(500,500,ID.empresaA2);await insert(900,900,ID.empresaB,ID.groupB,ID.runtimeActorB);
  const setPermissions=async(tree:unknown)=>f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify(tree),ctx.actorId]);
  await setPermissions(grants);
  const file=await service.exportCsv(ctx);
  assert.equal(file.total,206);assert.equal(file.csv.split('\r\n').length,208);
  assert.ok(file.csv.includes('"999999999999.123456"'));assert.ok(file.csv.includes('"123.456789"'));
  assert.ok(file.csv.includes('"\'=HYPERLINK(""synthetic"")"'));
  assert.ok(file.csv.startsWith('\uFEFF"id";"codigo";'));
  for(const secret of ['private-description','private@example.invalid','private-notes','export-first-record','payload_fingerprint','created_by'])
    assert.equal(file.csv.includes(secret),false);
  assert.equal(file.csv.includes('Export 500'),false);assert.equal(file.csv.includes('Export 900'),false);
  const expected=(await service.list(ctx,{limit:200})).data.map(r=>r.id);
  const exported=file.csv.split('\r\n').slice(1,201).map(line=>line.split(';')[0].slice(1,-1));
  assert.deepEqual(exported,expected);
  assert.equal((await service.exportCsv(ctx,{clienteEmpresaId:link})).total,1);
  assert.equal((await service.exportCsv(ctx,{status:'Ganho'})).total,0);
  assert.equal((await service.exportCsv(ctx,{ativo:false})).total,0);
  assert.equal((await service.exportCsv(ctx,{search:'Export 30'})).total,5);
  for(const filters of [{limit:1},{offset:200},{group_id:ID.groupB},{status:'unknown'},{search:'x'.repeat(81)}])
    await assert.rejects(service.exportCsv(ctx,filters),{statusCode:422});
  const entries=(await f.admin.query<{after_data:any}>('SELECT after_data FROM audit_logs WHERE request_id=$1 AND action=$2',[ctx.requestId,'read'])).rows;
  assert.equal(entries.length,5);
  assert.equal(entries[0].after_data.sha256,createHash('sha256').update(file.csv).digest('hex'));
  assert.deepEqual(entries[0].after_data.columns,OPORTUNIDADE_CSV_COLUMNS);
  assert.equal(JSON.stringify(entries).includes('Export 30'),false);
  for(const tree of [{CRM:{oportunidades:{_acoes:['visualizar']}}},{CRM:{oportunidades:{_acoes:['exportar']}}},{'*':true}]) {
    await setPermissions(tree);await assert.rejects(service.exportCsv(ctx),{statusCode:403});
  }
  await setPermissions(grants);
  await assert.rejects(service.exportCsv({...ctx,groupId:ID.groupB,empresaId:ID.empresaB}),{statusCode:403});
  await assert.rejects(service.exportCsv({...ctx,actorId:null}),{statusCode:403});
  // Revoke after the SQL snapshot: final authorization must prevent releasing the CSV.
  const original=repo.list.bind(repo);
  repo.list=async(...args)=>{const page=await original(...args);return {...page,rows:page.rows.slice(1)};};
  await assert.rejects(service.exportCsv(ctx),{code:'OPORTUNIDADE_EXPORT_INCOMPLETE'});repo.list=original;
  repo.list=async(scope,filters,tx)=>{
    const page=await original(scope,filters,tx);
    await tx!.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2',[JSON.stringify({}),ctx.actorId]);
    return page;
  };
  // Profile mutation is test-only and rolls back when the export is rejected.
  await f.exec(`GRANT UPDATE(permissoes) ON profiles TO ${role};
    CREATE POLICY crm_export_profile_update ON profiles FOR UPDATE TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  await assert.rejects(service.exportCsv(ctx),{statusCode:403});repo.list=original;
  assert.equal((await service.exportCsv(ctx,{clienteEmpresaId:link})).total,1);
  // Context and filter capture before await: caller mutations cannot redirect the download.
  const mutable={...ctx},options={clienteEmpresaId:link};
  const oldGuard=tenant.assertEmpresaInGroup.bind(tenant);let once=true;
  tenant.assertEmpresaInGroup=async(...args)=>{if(once){once=false;mutable.empresaId=ID.empresaB;options.clienteEmpresaId=ID.clientePjB;}await oldGuard(...args);};
  assert.equal((await service.exportCsv(mutable,options)).total,1);tenant.assertEmpresaInGroup=oldGuard;
  await f.exec(`CREATE FUNCTION crm_export_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='read' THEN RAISE EXCEPTION 'synthetic export audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER crm_export_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_export_audit_fail()`);
  await assert.rejects(service.exportCsv(ctx),/synthetic export audit failure/);
  await f.exec('DROP TRIGGER crm_export_audit_fail ON audit_logs; DROP FUNCTION crm_export_audit_fail()');
  assert.equal((await service.get(ctx,first.id)).version,1);
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId};
  try {
    const r=await fetch(`${base}/api/v1/oportunidades/exportar.csv`,{headers});
    assert.equal(r.status,200);assert.match(r.headers.get('content-type')!,/^text\/csv; charset=utf-8/i);
    assert.equal(r.headers.get('content-disposition'),'attachment; filename="oportunidades.csv"');
    assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
    assert.equal(r.headers.get('x-total-count'),'206');assert.equal(await r.text(),file.csv.replace(/^\uFEFF/,''));
    for(const q of ['limit=1','offset=200','empresa_id='+ID.empresaB,'ativo=maybe'])
      assert.equal((await fetch(`${base}/api/v1/oportunidades/exportar.csv?${q}`,{headers})).status,422);
    await setPermissions({CRM:{oportunidades:{_acoes:['visualizar']}}});
    const denied=await fetch(`${base}/api/v1/oportunidades/exportar.csv`,{headers});assert.equal(denied.status,403);
    assert.equal((await denied.text()).includes('999999999999'),false);await setPermissions(grants);
    // Fail closed at the full-export cap, never emit a partial 200 download.
    await insert(1000,2794);
    const tooMany=await fetch(`${base}/api/v1/oportunidades/exportar.csv`,{headers});
    assert.equal(tooMany.status,413);assert.equal(tooMany.headers.get('content-disposition'),null);
    assert.equal((await tooMany.json()).error.code,'OPORTUNIDADE_EXPORT_LIMIT');
    assert.equal((await service.exportCsv(ctx,{clienteEmpresaId:link})).total,1);
  } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}

test('CRM exportação completa: SQL/RLS, >200 linhas, filtros, decimal, permissões, audit e HTTP',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('CRM exportação PostgreSQL real: LOGIN restrito, snapshot completo e rollback',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try {
    const who=(await f.data.query<{current_user:string;session_user:string;rolsuper:boolean;rolbypassrls:boolean}>(
      'SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(who.current_user,f.role);assert.equal(who.session_user,f.role);
    assert.equal(who.rolsuper,false);assert.equal(who.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
test('CSV: fórmulas não executáveis, delimitadores/aspas/quebras preservados, nenhuma coluna privada',()=>{
  for(const title of ['=1+1','+cmd','-cmd','@SUM(A1)',' \t=1','\ttext','\ntext']) {
    const csv=oportunidadeCsv([{titulo:title} as any]);assert.ok(csv.includes(`"'${title}"`));
  }
  const csv=oportunidadeCsv([{titulo:'A;"B"\r\nC',id:'synthetic-id'} as any]);
  assert.ok(csv.includes('"A;""B""\r\nC"'));
  assert.equal(OPORTUNIDADE_CSV_COLUMNS.includes('cliente_email' as any),false);
});
test('CRM exportação HTTP permanece desativada pelo gate existente por padrão',async()=>{
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false'})});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const port=(server.address() as import('node:net').AddressInfo).port;
    const r=await fetch(`http://127.0.0.1:${port}/api/v1/oportunidades/exportar.csv`,{
      headers:{'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId}});
    assert.equal(r.status,503);assert.equal((await r.json()).error.code,'CRM_HTTP_DISABLED');
    assert.equal(r.headers.get('content-disposition'),null);assert.equal(r.headers.get('cache-control'),'no-store');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
