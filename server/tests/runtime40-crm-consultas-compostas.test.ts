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
import { sumOportunidadeValues } from '../src/repositories/oportunidadeTypes.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'composition-synthetic'};
type Fixture={admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string};
async function journey(f:Fixture) {
  const role=f.role??ROLE;
  await f.exec(`GRANT SELECT ON empresas TO ${role};
    CREATE POLICY composition_empresa ON empresas FOR SELECT TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  const repo=new PostgresOportunidadeRepository(f.data),tenant=new PostgresTenantGuard(f.admin),rbac=new PostgresRbacGuard(f.admin);
  const service=new OportunidadeService(repo,new PostgresAuditRepository(f.admin),tenant,rbac,
    new PostgresClienteRepository(f.admin),new PostgresOrcamentoRepository(f.admin));
  const first=await service.create(ctx,{titulo:'Composta inicial',cliente_nome:'Synthetic',idempotency_key:'composition-first',
    data_proxima_acao:'2026-10-17',proxima_acao:'Retornar',valor_estimado:'0.000001'});
  await f.admin.query(`INSERT INTO oportunidades(group_id,empresa_id,codigo,codigo_oportunidade,idempotency_key,payload_fingerprint,
    cliente_nome,titulo,etapa,status,valor_estimado,probabilidade,temperatura,origem,data_abertura,data_proxima_acao,created_by,updated_by)
    SELECT $1,$2,lpad(n::text,6,'0'),'OPP-'||n,'composition-'||n,repeat('a',64),'Synthetic','Composta '||n,
    'Proposta',CASE WHEN n=705 THEN 'Legado aberto' ELSE 'Aberto' END,999999999999.123456,20,'Morno','CRM',
    '2026-10-17','2026-10-17',$3,$3 FROM generate_series(500,705) n`,[ctx.groupId,ctx.empresaId,ctx.actorId]);
  await service.create({...ctx,empresaId:ID.empresaA2},{titulo:'Composta outra empresa',cliente_nome:'Synthetic',
    idempotency_key:'composition-other',data_proxima_acao:'2026-10-17'});
  const filters={agenda:true,acaoDe:'2026-10-17',acaoAte:'2026-10-17',search:'Composta'};
  const reconcile=async(expected:number)=>{
    const page=await service.list(ctx,{...filters,limit:200}),tail=await service.list(ctx,{...filters,limit:200,offset:200});
    const rows=[...page.data,...tail.data];assert.equal(page.meta.total,expected);assert.equal(rows.length,expected);
    assert.equal(new Set(rows.map(r=>r.id)).size,expected);
    const file=await service.exportCsv(ctx,filters),funnel=await service.funnel(ctx,filters);
    const cells=file.csv.split('\r\n').slice(1,-1).map(line=>line.split(';').map(cell=>cell.slice(1,-1)));
    assert.equal(file.total,expected);assert.equal(cells.length,expected);assert.equal(funnel.meta.total,expected);
    assert.deepEqual(cells.map(c=>c[0]),rows.map(r=>r.id));
    assert.equal(sumOportunidadeValues(cells.map(c=>c[7])),funnel.meta.valor_estimado);
    assert.equal(sumOportunidadeValues(rows.map(r=>r.valor_estimado)),funnel.meta.valor_estimado);
    for(const group of funnel.data){const drill=await service.list(ctx,{...group.drilldown,limit:200});
      const more=await service.list(ctx,{...group.drilldown,limit:200,offset:200});
      assert.equal(drill.meta.total,group.total);assert.equal(sumOportunidadeValues([...drill.data,...more.data].map(r=>r.valor_estimado)),group.valor_estimado);
      assert.equal((await service.exportCsv(ctx,group.drilldown)).total,group.total);}
    return {file,funnel};
  };
  const before=(await f.admin.query('SELECT to_jsonb(o) AS row FROM oportunidades o ORDER BY id')).rows;
  const initial=await reconcile(206);assert.equal(initial.funnel.meta.valor_estimado,'204999999999820.308481');
  assert.deepEqual((await f.admin.query('SELECT to_jsonb(o) AS row FROM oportunidades o ORDER BY id')).rows,before);
  // Historical read labels remain available but never acquire canonical agenda semantics or mutation authority.
  for(const method of ['list','funnel','exportCsv'] as const){
    const r=await service[method](ctx,{status:'Legado aberto'});assert.equal('total' in r?r.total:r.meta.total,1);
    for(const invalid of [{acaoDe:'2026-10-17'},{agenda:true,acaoAte:'2026-02-30'},
      {agenda:true,acaoDe:'2026-10-20',acaoAte:'2026-10-17'},{group_id:ID.groupB}])
      await assert.rejects(service[method](ctx,invalid),{statusCode:422});
    await assert.rejects(service[method]({...ctx,actorId:ID.runtimeActorB},filters),{statusCode:403});
  }
  assert.equal((await service.exportCsv(ctx,{...filters,status:'Legado aberto'})).total,0);
  const moved=await service.update(ctx,first.id,{expected_version:1,data_proxima_acao:'2026-10-18'});
  await reconcile(205);await service.update(ctx,first.id,{expected_version:moved.version,status:'Cancelado'});await reconcile(205);
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',
    DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.data,tenantGuard:tenant,rbacGuard:rbac});
  const server=app.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/v1/oportunidades`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId,'x-actor-id':ctx.actorId};
    for(const suffix of ['','/funil','/exportar.csv']) {
      const r=await fetch(base+suffix+'?agenda=true&acaoDe=2026-10-17&acaoAte=2026-10-17&etapa=Proposta',{headers});
      assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
      if(suffix==='/exportar.csv'){assert.equal(r.headers.get('x-total-count'),'205');assert.equal((await r.text()).split('\r\n').length,207);}
      else assert.equal((await r.json()).meta.total,205);
      assert.equal((await fetch(base+suffix+'?acaoDe=2026-10-17',{headers})).status,422);
    }
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
test('Consultas compostas CRM: agenda/listagem/drilldown/funil/CSV reconciliados além de 200 com decimal exato',async()=>{
  const f=await localCrmFixture();try{await journey(f);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('Consultas compostas PG LOGIN real restrito sem bypass',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});try{
    const r=(await f.data.query<any>('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(r.current_user,f.role);assert.equal(r.session_user,f.role);assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);await journey(f);
  }finally{await f.close();}
});
