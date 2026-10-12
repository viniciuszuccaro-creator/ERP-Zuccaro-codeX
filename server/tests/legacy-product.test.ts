import test from 'node:test';
import assert from 'node:assert/strict';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
import {ProdutoService} from '../src/services/produtoService.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';
import {createInMemoryProdutoRepo} from '../src/repositories/inMemoryProdutoRepository.ts';
import {InMemoryProdutoRelationGuard} from '../src/db/produtoRelationGuard.ts';
import {PostgresUnidadeRepository} from '../src/repositories/postgresCadastroRepositories.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {PostgresProdutoRelationGuard} from '../src/db/produtoRelationGuard.ts';
import {InMemoryRbacGuard} from '../src/db/rbacGuard.ts';
import {InMemoryTenantGuard} from '../src/db/tenantGuard.ts';
import {TenantCrudService} from '../src/services/tenantCrudService.ts';
import {unidadeCreateSchema,unidadeUpdateSchema} from '../src/repositories/cadastroTypes.ts';
import type {DbClient} from '../src/db/client.ts';
import {consumirLoteStagingLegado,persistirProdutoGrupoLegado,criarSnapshotReconciliacaoLegado,reconciliarPilotoGrupoLegado} from '../../scripts/legado/consumir-lote-staging.mjs';

async function prove(f:any,role:string) {
 try {
  await f.exec(`GRANT SELECT,INSERT,UPDATE ON produtos TO ${role};GRANT SELECT ON unidades_medida TO ${role};GRANT UPDATE(updated_at) ON unidades_medida TO ${role};
    CREATE POLICY legacy_product_fixture ON produtos FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
    CREATE POLICY legacy_unit_fixture ON unidades_medida FOR SELECT TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
    CREATE POLICY legacy_unit_fixture_lock ON unidades_medida FOR UPDATE TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
    CREATE POLICY legacy_product_audit ON audit_logs FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);`);
  const flags=(await f.admin.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
  assert.equal(flags.rolsuper,false);assert.equal(flags.rolbypassrls,false);
  if(f.restrictedLogin){
    const identity=(await f.data.query('SELECT session_user=current_user same_session,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(identity.same_session,true);assert.equal(identity.rolcanlogin,true);
    assert.equal(identity.rolsuper,false);assert.equal(identity.rolbypassrls,false);
  }
  const privileges=(await f.admin.query("SELECT has_table_privilege($1,'unidades_medida','UPDATE') broad, has_column_privilege($1,'unidades_medida','updated_at','UPDATE') lock, has_column_privilege($1,'unidades_medida','nome_completo','UPDATE') content",[role])).rows[0];
  assert.equal(privileges.broad,false);assert.equal(privileges.lock,true);assert.equal(privileges.content,false);
  const guard=new InMemoryRbacGuard(),tenant=new InMemoryTenantGuard();
  const ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-product-pilot'};
  const readOnly='00000000-0000-4000-8000-000000000099',editor='00000000-0000-4000-8000-000000000098';
  guard.link({actorId:ctx.actorId,groupId:ctx.groupId,permissions:{Cadastros:{produto:['visualizar','criar','editar','importar','inativar','restaurar'],unidade_medida:['visualizar']}}});
  for(const actor of [readOnly,editor])guard.link({actorId:actor,groupId:ctx.groupId,permissions:{Cadastros:{produto:actor===editor?['visualizar','editar']:['visualizar'],unidade_medida:['visualizar']}}});
  const run=(fn:any)=>f.data.withTransaction(async(q:any)=>{await q.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id','',true)",[ctx.groupId]);return fn(q);});
  const db:DbClient={pool:null,query:(sql,p)=>run((q:any)=>q.query(sql,p)),withTransaction:run,checkConnection:async()=>true,end:async()=>{}};
  const audit=new PostgresAuditRepository(db),repo=new PostgresProdutoRepository(db,true);
  const service=new ProdutoService(repo,audit,tenant,new PostgresProdutoRelationGuard(db),guard);
  const unidadeService=new TenantCrudService(new PostgresUnidadeRepository(db),audit,tenant,{entityName:'UnidadeMedida',notFoundCode:'UNIDADE_NOT_FOUND',
    createSchema:unidadeCreateSchema,updateSchema:unidadeUpdateSchema,getEmpresaId:r=>r.empresa_id,
    resolveEmpresaIdFromCreate:(d,s)=>d.empresa_id??s.empresaId,resolveEmpresaIdFromUpdate:(d,r)=>d.empresa_id===undefined?r.empresa_id:d.empresa_id});
  const produtoClassUnitMap={'CHAPA|KG':{tipo_item:'Matéria-Prima Produção',unidade_medida_id:I.unidadeA}};
  const source={cod_produto:'00042',descricao:'Synthetic plate',classe:'CHAPA',unidade:'KG',group_id:ctx.groupId};
  const mapped=consumirLoteStagingLegado([source],{entidade:'produto',groupId:ctx.groupId,produtoClassUnitMap,contratoEntrada:{coorte:'synthetic'}}).comprovados[0];
  assert.ok(mapped);const opts={service,unidadeService,rbacGuard:guard,sourceSystem:'synthetic-product',batch:'synthetic',produtoClassUnitMap};
  const review={source_unit_code:'KG',approved_target_unit_id:I.unidadeA,scope_verified:true,semantic_equivalence_verified:true,import_authorized:true};
  const reviewed={...opts,revisoesUnidades:[review]};
  const unitSnapshot=await unidadeService.get(ctx,I.unidadeA);
  const semanticReviewed={...reviewed,snapshotUnidades:{readOnlyTransaction:true,operationalImportAuthorized:false,records:[unitSnapshot]}};
  const snapshot=async()=>({products:(await f.admin.query('SELECT id,codigo,legacy_id FROM produtos ORDER BY id')).rows,
    sequences:(await f.admin.query('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name')).rows,
    audits:(await f.admin.query('SELECT id FROM audit_logs ORDER BY id')).rows});
  const beforeDenied=await snapshot();
  for(const declaration of [{tipo_item:'MATERIA_PRIMA',tipo_produto:'REVENDA',unidade_medida_id:I.unidadeA},
    {tipo_item:'REVENDA',tipo_produto:'MATERIA_PRIMA',unidade_medida_id:I.unidadeA},
    {tipo_item:'MATERIA_PRIMA',tipo_produto:'Unknown',unidade_medida_id:I.unidadeA}]){
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...opts,produtoClassUnitMap:{'CHAPA|KG':declaration}}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
    assert.deepEqual(await snapshot(),beforeDenied);
  }
  const changingMap={'CHAPA|KG':{tipo_item:'MATERIA_PRIMA',tipo_produto:'REVENDA',unidade_medida_id:I.unidadeA}};
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...opts,produtoClassUnitMap:changingMap,unidadeService:{get:async()=>{
    changingMap['CHAPA|KG'].tipo_produto='MATERIA_PRIMA';return unidadeService.get(ctx,I.unidadeA);
  }}}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
  assert.deepEqual(await snapshot(),beforeDenied);
  for(const revisoesUnidades of [[],[review,review],[{...review,scope_verified:false}],
    [{...review,semantic_equivalence_verified:false}],[{...review,import_authorized:'true'}],
    [{...review,approved_target_unit_id:I.unidadeB}]]) {
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...opts,revisoesUnidades}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
    assert.deepEqual(await snapshot(),beforeDenied);
  }
  const lateReview={...review,import_authorized:false};
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...opts,revisoesUnidades:[lateReview],unidadeService:{get:async()=>{
    lateReview.import_authorized=true;return unidadeService.get(ctx,I.unidadeA);
  }}}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
  assert.deepEqual(await snapshot(),beforeDenied);
  const before=structuredClone(mapped);
  for(const [field,value]of [['fator_conversao_para_base',2],['tipo_grandeza','Other'],['unidade_base_conversao','Other'],
    ['empresa_id',null],['sigla','Other'],['nome_completo','Changed'],['usa_em_vendas',false],['permite_conversao',false]] as const){
    if((unitSnapshot as any)[field]===value)continue;
    await f.admin.query(`UPDATE unidades_medida SET ${field}=$1 WHERE id=$2`,[value,I.unidadeA]);
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,semanticReviewed),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
    assert.deepEqual(await snapshot(),beforeDenied);
    await f.admin.query(`UPDATE unidades_medida SET ${field}=$1 WHERE id=$2`,[(unitSnapshot as any)[field],I.unidadeA]);
  }
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...semanticReviewed,service:{
    findByLegacyIdentity:service.findByLegacyIdentity.bind(service),create:async(...args:any[])=>{
      await f.admin.query('UPDATE unidades_medida SET fator_conversao_para_base=2 WHERE id=$1',[I.unidadeA]);
      return (service.create as any)(...args);
    }}}),e=>e.code==='LEGACY_UNIT_SEMANTICS_CHANGED');
  assert.deepEqual(await snapshot(),beforeDenied);
  await f.admin.query('UPDATE unidades_medida SET fator_conversao_para_base=$1 WHERE id=$2',[unitSnapshot.fator_conversao_para_base,I.unidadeA]);
  const allowed=guard.assertAllowed.bind(guard);let createChecks=0;
  guard.assertAllowed=async(...args:any[])=>{
    if(args[3]==='criar' && ++createChecks===2)throw Object.assign(new Error('synthetic late permission revocation'),{code:'PERMISSION_DENIED'});
    return (allowed as any)(...args);
  };
  try{
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,semanticReviewed),e=>e.code==='PERMISSION_DENIED');
    assert.deepEqual(await snapshot(),beforeDenied);assert.equal(createChecks,2);
  }finally{guard.assertAllowed=allowed;}
  const append=audit.append.bind(audit);let lockProved=false;
  if(f.restrictedLogin)audit.append=async(event,executor)=>{
    await assert.rejects(()=>f.admin.withTransaction(async(q:any)=>{
      await q.query("SET LOCAL lock_timeout='100ms'");
      await q.query('UPDATE unidades_medida SET fator_conversao_para_base=2 WHERE id=$1',[I.unidadeA]);
    }), (error:any)=>error.code==='55P03');
    lockProved=true;return append(event,executor);
  };
  const first=await persistirProdutoGrupoLegado(ctx,mapped,semanticReviewed);const id=first.registro.id;
  audit.append=append;if(f.restrictedLogin)assert.equal(lockProved,true);
  assert.equal(first.reutilizado,false);assert.equal(first.registro.empresa_id,null);assert.match(first.registro.codigo!,/^\d+$/);
  assert.equal(first.registro.codigo_legado,'00042');assert.equal(first.registro.unidade_principal,'KG');
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,opts)).registro.id,id);
  const beforeConflictingRetry=await snapshot();
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...opts,produtoClassUnitMap:{'CHAPA|KG':{tipo_item:'MATERIA_PRIMA',tipo_produto:'REVENDA',unidade_medida_id:I.unidadeA}}}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
  assert.deepEqual(await snapshot(),beforeConflictingRetry);
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,{...opts,produtoClassUnitMap:{'CHAPA|KG':{tipo_item:'MATERIA_PRIMA',tipo_produto:'Matéria-Prima Produção',unidade_medida_id:I.unidadeA}}})).registro.id,id);
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,reviewed)).registro.id,id);
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,semanticReviewed)).registro.id,id);
  const beforeSemanticRetry=await snapshot();
  await f.admin.query('UPDATE unidades_medida SET fator_conversao_para_base=2 WHERE id=$1',[I.unidadeA]);
  await assert.rejects(()=>service.findByLegacyIdentity(ctx,opts.sourceSystem,'00042',{expectedUnitSnapshot:unitSnapshot}),e=>e.code==='LEGACY_UNIT_SEMANTICS_CHANGED');
  assert.deepEqual(await snapshot(),beforeSemanticRetry);
  await f.admin.query('UPDATE unidades_medida SET fator_conversao_para_base=$1 WHERE id=$2',[unitSnapshot.fator_conversao_para_base,I.unidadeA]);
  const beforeRevoked=await snapshot();
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,{...reviewed,revisoesUnidades:[{...review,import_authorized:false}]}),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
  assert.deepEqual(await snapshot(),beforeRevoked);
  assert.equal((await service.get(ctx,id)).id,id);
  await assert.rejects(()=>persistirProdutoGrupoLegado({...ctx,actorId:readOnly},mapped,opts),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>persistirProdutoGrupoLegado({...ctx,empresaId:I.empresaA},mapped,opts),/LEGACY_SHARED_PRODUCT_INVALID/);
  for(const variant of [{...mapped,descricao:'Divergent'},{...mapped,tipo_item:'Revenda'},{...mapped,unidade_medida_id:I.unidadeB}]) {
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,variant,opts));
  }
  await service.update(ctx,id,{descricao_comercial:'Preserved details',peso_teorico_kg_m:7.5});
  tenant.link(I.empresaA,ctx.groupId);
  await assert.rejects(()=>service.update(ctx,id,{empresa_id:I.empresaA}),e=>e.code==='LEGACY_GROUP_SCOPE_REQUIRED');
  assert.equal((await service.get(ctx,id)).empresa_id,null);
  assert.equal((await service.get(ctx,id)).codigo,first.registro.codigo);
  await assert.rejects(()=>service.update({...ctx,actorId:editor},id,{ativo:false}),e=>e.code==='PERMISSION_DENIED');
  await service.softDelete(ctx,id);
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,opts),/LEGACY_RECONCILIATION_REQUIRED/);
  await assert.rejects(()=>service.update({...ctx,actorId:editor},id,{ativo:true}),e=>e.code==='PERMISSION_DENIED');
  const wildcard='00000000-0000-4000-8000-000000000097';
  guard.link({actorId:wildcard,groupId:ctx.groupId,permissions:{'*':['editar'],Cadastros:{produto:['restaurar']}}});
  await assert.rejects(()=>service.update({...ctx,actorId:wildcard},id,{ativo:true}),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>service.update(ctx,id,{ativo:true,descricao:'Not a restoration'}),e=>e.code==='PRODUTO_NOT_FOUND');
  const restored=await service.update(ctx,id,{ativo:true});assert.equal(restored.id,id);assert.equal(restored.codigo,first.registro.codigo);
  assert.equal(restored.codigo_legado,'00042');assert.equal(restored.descricao_comercial,'Preserved details');assert.equal(Number(restored.peso_teorico_kg_m),7.5);
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,opts)).registro.id,id);
  const raced=await Promise.all([persistirProdutoGrupoLegado(ctx,{...mapped,codigo_legado:'00043'},opts),persistirProdutoGrupoLegado(ctx,{...mapped,codigo_legado:'00043'},opts)]);
  assert.equal(raced[0].registro.id,raced[1].registro.id);assert.equal(raced.filter(r=>r.reutilizado===false).length,1);
  assert.equal((await f.admin.query('SELECT count(*)::int n FROM produto_empresas WHERE produto_id=$1',[id])).rows[0].n,0);
  const oldUnit=await unidadeService.get(ctx,I.unidadeA);
  await f.admin.query('UPDATE unidades_medida SET ativo=false WHERE id=$1',[I.unidadeA]);
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,{...mapped,codigo_legado:'BAD-UNIT'},opts),/LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED/);
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,{...mapped,codigo_legado:'STALE-UNIT'},{...opts,unidadeService:{get:async()=>oldUnit}}),e=>e.code==='TENANT_FK_MISMATCH');
  await f.admin.query('UPDATE unidades_medida SET ativo=true WHERE id=$1',[I.unidadeA]);
  const seq=(await f.admin.query("SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='Produto'",[ctx.groupId])).rows[0].next_value;
  await f.exec("CREATE FUNCTION legacy_product_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Produto' THEN RAISE EXCEPTION 'synthetic product audit failure';END IF;RETURN NEW;END $$;CREATE TRIGGER legacy_product_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION legacy_product_audit_fail()");
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,{...mapped,codigo_legado:'ROLLBACK'},opts),/synthetic product audit failure/);
  await assert.rejects(()=>service.softDelete(ctx,id),/synthetic product audit failure/);
  assert.equal((await service.get(ctx,id)).ativo,true);
  assert.equal(await service.findByLegacyIdentity(ctx,opts.sourceSystem,'ROLLBACK'),null);
  assert.equal((await f.admin.query("SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='Produto'",[ctx.groupId])).rows[0].next_value,seq);
  await f.exec('DROP TRIGGER legacy_product_audit_fail ON audit_logs');
  await service.softDelete(ctx,id);
  await f.exec('CREATE TRIGGER legacy_product_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION legacy_product_audit_fail()');
  await assert.rejects(()=>service.update(ctx,id,{ativo:true}),/synthetic product audit failure/);
  assert.equal((await service.findByLegacyIdentity(ctx,opts.sourceSystem,'00042'))!.ativo,false);
  await f.exec('DROP TRIGGER legacy_product_audit_fail ON audit_logs');
  await service.update(ctx,id,{ativo:true});
  await service.softDelete(ctx,id);
  const archived=await service.findByLegacyIdentity(ctx,opts.sourceSystem,'00042');assert.equal(archived!.ativo,false);assert.equal(archived!.id,id);
  const baseline=criarSnapshotReconciliacaoLegado('produto',archived);
  const reconOpts={services:{produto:service},rbacGuard:guard};
  assert.equal((await reconciliarPilotoGrupoLegado(ctx,[baseline],reconOpts)).equivalente,true);
  const changed=structuredClone(baseline);changed.registro.tipo_item='Revenda';changed.registro.ativo=true;
  const mismatch=await reconciliarPilotoGrupoLegado(ctx,[changed],reconOpts);
  assert.deepEqual(mismatch.resultados[0].campos,['ativo','tipo_item']);
  assert.equal(JSON.stringify(mismatch).includes(id),false);assert.equal(JSON.stringify(mismatch).includes('00042'),false);
  assert.deepEqual(mapped,before);
  const actions=(await f.admin.query('SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY created_at',[id])).rows.map(r=>r.action);
  assert.deepEqual(actions,['create','update','soft_delete','restore','soft_delete','restore','soft_delete']);
 } finally {await f.close();}
}

test('Legacy Produto persisted pilot: mapping retry edit reopen reversal RBAC and rollback',async()=>prove(await localCrmFixture(),ROLE));

test('Imported Produto stays on the Group while an ordinary master can still receive a company',async()=>{
  const tenant=new InMemoryTenantGuard(),guard=new InMemoryRbacGuard(),rel=new InMemoryProdutoRelationGuard();
  const actor='00000000-0000-4000-8000-000000000096';
  tenant.link(I.empresaA,I.groupA);
  guard.link({actorId:actor,groupId:I.groupA,permissions:{Cadastros:{produto:['visualizar','criar','editar','importar']}}});
  const service=new ProdutoService(createInMemoryProdutoRepo(),{async append(){}},tenant,rel,guard);
  const ctx={groupId:I.groupA,actorId:actor,requestId:'synthetic-product-scope'};
  const imported=await service.create(ctx,{descricao:'Synthetic imported',tipo_item:'Revenda',empresa_id:null,origem:'MIGRACAO',codigo_legado:'SCOPE-1',legacy_id:'SCOPE-1',source_system:'synthetic-product',migration_batch:'synthetic',codigo:'000200'});
  await assert.rejects(()=>service.update(ctx,imported.id,{empresa_id:I.empresaA}),e=>e.code==='LEGACY_GROUP_SCOPE_REQUIRED');
  assert.equal((await service.get(ctx,imported.id)).empresa_id,null);
  assert.equal((await service.get(ctx,imported.id)).codigo,'000200');
  const ordinary=await service.create(ctx,{descricao:'Synthetic ordinary',tipo_item:'Revenda',empresa_id:null});
  assert.equal((await service.update(ctx,ordinary.id,{empresa_id:I.empresaA})).empresa_id,I.empresaA);
});
test('Reviewed unit semantics retain in-memory compatibility and reject stale meaning',async()=>{
 const tenant=new InMemoryTenantGuard(),guard=new InMemoryRbacGuard(),rel=new InMemoryProdutoRelationGuard();
 const ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-semantic-memory'};
 guard.link({actorId:ctx.actorId,groupId:ctx.groupId,permissions:{Cadastros:{produto:['visualizar','criar','importar']}}});
 const unit={id:I.unidadeA,group_id:I.groupA,empresa_id:null,sigla:'KG',nome_completo:'Quilograma',tipo_grandeza:'Massa',unidade_base_conversao:null,fator_conversao_para_base:1,permite_conversao:true,usa_em_estoque:true,usa_em_compras:true,usa_em_vendas:true,ativo:true};
 rel.linkUnidade(unit.id,unit.group_id);rel.linkUnidadeSnapshot(unit);
 const service=new ProdutoService(createInMemoryProdutoRepo(),{async append(){}},tenant,rel,guard);
 const payload={descricao:'Synthetic semantic',tipo_item:'Revenda',empresa_id:null,unidade_medida_id:unit.id};
 const created=await service.create(ctx,payload,{expectedUnitSnapshot:unit});assert.equal(created.unidade_medida_id,unit.id);
 rel.linkUnidadeSnapshot({...unit,fator_conversao_para_base:2});
 await assert.rejects(()=>service.create(ctx,payload,{expectedUnitSnapshot:unit}),e=>e.code==='LEGACY_UNIT_SEMANTICS_CHANGED');
 // Existing callers without a reviewed snapshot retain the original guard contract.
 assert.equal((await service.create(ctx,payload)).unidade_medida_id,unit.id);
});
if(process.env.DATABASE_URL)test('Legacy Produto persisted pilot PostgreSQL real isolated',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});await prove(f,f.role);});
