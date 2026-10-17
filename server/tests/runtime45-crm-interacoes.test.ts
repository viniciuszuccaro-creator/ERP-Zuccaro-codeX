import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config/env.ts';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
import {PostgresInteracaoRepository} from '../src/repositories/postgresInteracaoRepository.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {PostgresTenantGuard} from '../src/db/tenantGuard.ts';
import {PostgresRbacGuard} from '../src/db/rbacGuard.ts';
import {PostgresClienteRepository} from '../src/repositories/postgresClienteRepository.ts';
import {PostgresOportunidadeRepository} from '../src/repositories/postgresOportunidadeRepository.ts';
import {InteracaoService} from '../src/services/interacaoService.ts';
import type {DbClient} from '../src/db/client.ts';

const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'synthetic-interaction'};
const config=(enabled=true)=>loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',
  DATABASE_URL:'postgresql://synthetic@localhost/erp_test',ENABLE_CRM_HTTP:'true',ENABLE_CRM_INTERACOES_HTTP:String(enabled)});
const fixtureService=(f:{admin:DbClient;data:DbClient},data=f.data)=>new InteracaoService(new PostgresInteracaoRepository(data),
  new PostgresAuditRepository(f.admin),new PostgresTenantGuard(f.admin),new PostgresRbacGuard(f.admin),
  new PostgresClienteRepository(f.admin),new PostgresOportunidadeRepository(f.admin));

async function journey(f:Awaited<ReturnType<typeof localCrmFixture>>,role:string) {
  assert.match(role,/^[a-z][a-z0-9_]+$/);
  await f.exec(`GRANT SELECT,INSERT ON interacoes TO ${role};
    GRANT UPDATE(payload,ativo,updated_by,version,updated_at) ON interacoes TO ${role};
    GRANT SELECT,INSERT ON interacao_historico TO ${role};
    GRANT UPDATE(updated_at) ON cliente_empresas TO ${role};
    GRANT SELECT ON empresas TO ${role};
    CREATE POLICY interacao_fixture_empresa ON empresas FOR SELECT TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);`);
  const service=fixtureService(f);
  const link=String((await f.admin.query('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ID.empresaA])).rows[0].id);
  const payload={tipo:'Ligação',titulo:'Retorno sintético comercial',descricao:'Nota sintética privada preservada',
    cliente_empresa_id:link,data_interacao:'2026-10-17',duracao:12.25,resultado:'Positivo',responsavel:'Equipe sintética',
    proxima_acao:'Reunião sintética',data_proxima_acao:'2026-10-20',idempotency_key:'interacao-synthetic-intent'};
  const same=await Promise.all(Array.from({length:3},()=>service.create(ctx,payload)));
  assert.equal(new Set(same.map(r=>r.id)).size,1);const row=same[0];
  assert.match(row.codigo,/^\d{6,}$/);assert.notEqual(row.codigo,row.id);
  assert.equal('idempotency_key' in row,false);assert.equal('payload_fingerprint' in row,false);
  assert.equal((await service.history(ctx,row.id)).meta.total,1);
  assert.equal((await service.get(ctx,row.id)).descricao,payload.descricao);
  await assert.rejects(service.create(ctx,{...payload,titulo:'Outro conteúdo'}),{code:'INTERACAO_IDEMPOTENCY_CONFLICT'});
  const updates=await Promise.allSettled([
    service.update(ctx,row.id,{expected_version:1,titulo:'Revisão A'}),
    service.update(ctx,row.id,{expected_version:1,titulo:'Revisão B'}),
  ]);
  assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);
  const current=await service.get(ctx,row.id);assert.equal(current.version,2);
  assert.equal(current.descricao,payload.descricao);assert.equal(current.proxima_acao,payload.proxima_acao);
  const cleared=await service.update(ctx,row.id,{expected_version:2,descricao:undefined,observacoes:null,proxima_acao:null});
  assert.equal(cleared.proxima_acao,null);assert.equal(cleared.descricao,payload.descricao);
  const timeline=await service.history(ctx,row.id,{limit:1,offset:2});
  assert.equal(timeline.meta.total,3);assert.equal(timeline.data[0].snapshot.descricao,payload.descricao);
  assert.equal(timeline.data[0].snapshot.titulo,payload.titulo);
  assert.equal('idempotency_key' in timeline.data[0].snapshot,false);
  const inactive=await service.setActive(ctx,row.id,{expected_version:3},false);assert.equal(inactive.version,4);
  await assert.rejects(service.update(ctx,row.id,{expected_version:4,titulo:'Bloqueado'}),{code:'INTERACAO_INACTIVE'});
  assert.equal((await service.setActive(ctx,row.id,{expected_version:4},true)).version,5);
  await assert.rejects(service.get({...ctx,empresaId:ID.empresaA2},row.id),{code:'INTERACAO_NOT_FOUND'});
  await assert.rejects(service.history({...ctx,empresaId:ID.empresaA2},row.id),{code:'INTERACAO_NOT_FOUND'});
  await assert.rejects(service.get({...ctx,actorId:randomUUID()},row.id),{statusCode:403});
  await assert.rejects(service.get({...ctx,groupId:ID.groupB,empresaId:ID.empresaB},row.id),{statusCode:403});
  await assert.rejects(service.create(ctx,{...payload,cliente_empresa_id:randomUUID(),idempotency_key:'invalid-client-link'}),{code:'INTERACAO_REFERENCE_INVALID'});
  await assert.rejects(service.create(ctx,{...payload,idempotency_key:'forged-tenant',group_id:ID.groupB}),{statusCode:422});
  await assert.rejects(service.create(ctx,{...payload,idempotency_key:'invalid-date',data_interacao:'2026-02-30'}),{statusCode:422});
  await assert.rejects(service.update(ctx,row.id,{expected_version:5,cliente_empresa_id:randomUUID()}),{statusCode:422});
  const repo=new PostgresInteracaoRepository(f.data);
  await repo.transaction({...ctx,empresaId:ID.empresaA2},async tx=>{
    assert.equal((await tx.query('SELECT id FROM interacoes')).rows.length,0);
    assert.equal((await tx.query('UPDATE interacoes SET ativo=false WHERE id=$1 RETURNING id',[row.id])).rows.length,0);
    assert.equal((await tx.query('SELECT id FROM interacao_historico')).rows.length,0);
  });
  await assert.rejects(repo.transaction(ctx,tx=>tx.query("UPDATE interacoes SET codigo='999999' WHERE id=$1",[row.id])),{code:'42501'});
  await assert.rejects(f.admin.query('UPDATE interacao_historico SET version=99 WHERE interacao_id=$1',[row.id]),/INTERACAO_HISTORY_APPEND_ONLY/);
  const count=async()=>Number((await f.admin.query('SELECT count(*)::int total FROM interacoes')).rows[0].total);
  const before=await count();
  await f.exec("CREATE FUNCTION fail_interacao_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Interacao' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_interacao_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE fail_interacao_audit();");
  await assert.rejects(service.create(ctx,{...payload,idempotency_key:'rollback-intent'}));
  assert.equal(await count(),before);
  assert.equal((await service.get(ctx,row.id)).version,5);
  await f.exec('DROP TRIGGER fail_interacao_audit ON audit_logs; DROP FUNCTION fail_interacao_audit();');
  const retried=await service.create(ctx,{...payload,idempotency_key:'rollback-intent'});
  assert.equal(Number(retried.codigo),Number(row.codigo)+1,'sequence rolls back with failed audit');
  assert.equal((await service.list(ctx,{limit:1})).meta.total,2);
  assert.equal((await service.list(ctx,{search:retried.codigo})).data[0].id,retried.id);
  const audit=await new PostgresAuditRepository(f.admin).listByEntity('Interacao',row.id);
  assert.equal(audit.length,5);assert.equal(JSON.stringify(audit).includes(payload.descricao),false);
  const runtime=createApp({config:config(),db:f.admin});
  const opportunity=await runtime.oportunidadeService!.create(ctx,{titulo:'Proposta sintética',cliente_empresa_id:link,idempotency_key:'synthetic-opportunity-45'});
  const associated=await service.create(ctx,{...payload,oportunidade_id:opportunity.id,idempotency_key:'associated-interaction'});
  assert.equal(associated.oportunidade_id,opportunity.id);
  const derived=await service.create(ctx,{...payload,cliente_empresa_id:undefined,oportunidade_id:opportunity.id,idempotency_key:'opportunity-client-derived'});
  assert.equal(derived.cliente_empresa_id,link,'timeline reference derives from the canonical opportunity');
  await assert.rejects(service.create(ctx,{...payload,oportunidade_id:randomUUID(),idempotency_key:'bad-opportunity'}),{code:'INTERACAO_REFERENCE_INVALID'});
  // Revocation after the row lock must be observed before any update/history/audit.
  const revoked:DbClient={...f.data,withTransaction:fn=>f.data.withTransaction(tx=>fn({query:async(sql,params)=>{
    const result=await tx.query(sql,params);
    if(sql.includes('FROM interacoes') && sql.includes('FOR UPDATE')) {
      // Administrative fixture executor cannot run concurrently with the local engine transaction.
      await tx.query("SELECT set_config('test.interacao_revoke','true',true)");
    }
    return result;
  }}))};
  const denialGuard={assertAllowed:async(c:any,m:string,s:string,a:any,o:any)=>{
    const result=await o.executor.query("SELECT current_setting('test.interacao_revoke',true) AS value");
    if(result.rows[0]?.value==='true')throw Object.assign(new Error('revoked'),{statusCode:403});
    return new PostgresRbacGuard(f.admin).assertAllowed(c,m,s,a,o);
  }};
  const revokedService=new InteracaoService(new PostgresInteracaoRepository(revoked),new PostgresAuditRepository(f.admin),
    new PostgresTenantGuard(f.admin),denialGuard,new PostgresClienteRepository(f.admin),new PostgresOportunidadeRepository(f.admin));
  await assert.rejects(revokedService.update(ctx,row.id,{expected_version:5,titulo:'Must rollback'}),{statusCode:403});
  assert.equal((await service.get(ctx,row.id)).version,5);
  await f.admin.query("UPDATE interacoes SET codigo='900000' WHERE id=$1",[associated.id]);
  const distinct=await Promise.all(Array.from({length:4},(_,i)=>service.create(ctx,{...payload,idempotency_key:`distinct-interaction-${i}`})));
  assert.equal(new Set(distinct.map(r=>r.codigo)).size,4);
  assert.deepEqual(distinct.map(r=>Number(r.codigo)).sort(),[900001,900002,900003,900004]);
  const protection=await f.admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('interacoes'::regclass,'interacao_historico'::regclass)");
  assert.equal(protection.rows.length,2);assert.ok(protection.rows.every(r=>r.relrowsecurity && r.relforcerowsecurity));
  const acl=await f.admin.query("SELECT a.privilege_type FROM pg_class c,LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid IN ('interacoes'::regclass,'interacao_historico'::regclass) AND a.grantee=0");
  assert.equal(acl.rows.length,0,'no implicit PUBLIC grants');
}

test('R45 Interacao persistida: registrar→reabrir→editar→histórico/lifecycle, retry, CAS, RLS e rollback',async()=>{
  const f=await localCrmFixture();try{await journey(f,ROLE);}finally{await f.close();}
});
if(process.env.DATABASE_URL)test('R45 PostgreSQL real com LOGIN restrito executa o mesmo fluxo sem bypass',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  try{
    assert.equal(f.restrictedLogin,true);
    const identity=(await f.data.query('SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(identity.current_user,identity.session_user);assert.equal(identity.current_user,f.role);
    assert.equal(identity.rolsuper,false);assert.equal(identity.rolbypassrls,false);
    await journey(f,f.role);
  }finally{await f.close();}
});

test('R45 HTTP: flag própria desativada por padrão; CRUD existente não é redirecionado',async()=>{
  assert.equal(loadConfig({NODE_ENV:'test',ERP_ENV:'dev',ENABLE_CRM_HTTP:'true'}).crmInteracoesHttpEnabled,false);
  const f=await localCrmFixture();const runtime=createApp({config:config(false),db:f.admin});
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try{
    const port=(server.address() as import('node:net').AddressInfo).port;
    const response=await fetch(`http://127.0.0.1:${port}/api/v1/interacoes`,{headers:{'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId!,'x-actor-id':ctx.actorId!}});
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).error.code,'CRM_INTERACOES_HTTP_DISABLED');
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await f.close();}
});

test('R45 HTTP persistido DEV: registrar/retry→GET→PATCH→histórico→inativar/restaurar, URL/ator/filtros negados',async()=>{
  const f=await localCrmFixture(),runtime=createApp({config:config(),db:f.admin});
  const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const port=(server.address() as import('node:net').AddressInfo).port,base=`http://127.0.0.1:${port}/api/v1/interacoes`;
    const headers={'x-group-id':ctx.groupId,'x-empresa-id':ctx.empresaId!,'x-actor-id':ctx.actorId!,'Content-Type':'application/json'};
    const call=(path='',method='GET',body?:unknown,extra:Record<string,string>={})=>fetch(base+path,{method,headers:{...headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});
    const link=String((await f.admin.query('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ID.empresaA])).rows[0].id);
    const payload={cliente_empresa_id:link,tipo:'Reunião',titulo:'HTTP sintético',data_interacao:'2026-10-17',idempotency_key:'http-synthetic-intent'};
    const created=await call('','POST',payload);assert.equal(created.status,201);const row=(await created.json()).data;
    const replay=await call('','POST',payload);assert.equal((await replay.json()).data.id,row.id);
    const detail=await call('/'+row.id);assert.equal(detail.status,200);assert.equal((await detail.json()).data.codigo,row.codigo);
    const patch=await call('/'+row.id,'PATCH',{expected_version:1,descricao:'Persistência sintética HTTP'});
    assert.equal(patch.status,200);assert.equal((await patch.json()).data.version,2);
    assert.equal((await call('/'+row.id,'PATCH',{expected_version:1,titulo:'Stale'})).status,409);
    const history=await call('/'+row.id+'/historico?limit=1&offset=1');assert.equal(history.status,200);
    const page=await history.json();assert.equal(page.meta.total,2);assert.equal(page.data[0].snapshot.titulo,payload.titulo);
    assert.equal((await call('/'+row.id,'DELETE',{expected_version:2})).status,200);
    assert.equal((await call('/'+row.id+'/restaurar','POST',{expected_version:3})).status,200);
    assert.equal((await call('?ativo=true&limit=1')).status,200);
    assert.equal((await call('?limit=0')).status,422);assert.equal((await call('?unexpected=true')).status,422);
    assert.equal((await call('/not-a-uuid')).status,422);
    assert.equal((await call('/'+row.id,'GET',undefined,{'x-empresa-id':ID.empresaA2})).status,404);
    assert.equal((await call('/'+row.id,'GET',undefined,{'x-actor-id':randomUUID()})).status,403);
    assert.equal((await call('/'+row.id,'PATCH',{expected_version:4,created_by:randomUUID()})).status,422);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await f.close();}
});
