import test from 'node:test';
import assert from 'node:assert/strict';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
import {ProdutoService} from '../src/services/produtoService.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';
import {PostgresUnidadeRepository} from '../src/repositories/postgresCadastroRepositories.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {PostgresProdutoRelationGuard} from '../src/db/produtoRelationGuard.ts';
import {InMemoryRbacGuard} from '../src/db/rbacGuard.ts';
import {InMemoryTenantGuard} from '../src/db/tenantGuard.ts';
import {TenantCrudService} from '../src/services/tenantCrudService.ts';
import {unidadeCreateSchema,unidadeUpdateSchema} from '../src/repositories/cadastroTypes.ts';
import type {DbClient} from '../src/db/client.ts';
import {consumirLoteStagingLegado,persistirProdutoGrupoLegado} from '../../scripts/legado/consumir-lote-staging.mjs';

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
  const before=structuredClone(mapped);
  const first=await persistirProdutoGrupoLegado(ctx,mapped,opts);const id=first.registro.id;
  assert.equal(first.reutilizado,false);assert.equal(first.registro.empresa_id,null);assert.match(first.registro.codigo!,/^\d+$/);
  assert.equal(first.registro.codigo_legado,'00042');assert.equal(first.registro.unidade_principal,'KG');
  assert.equal((await persistirProdutoGrupoLegado(ctx,mapped,opts)).registro.id,id);
  assert.equal((await service.get(ctx,id)).id,id);
  await assert.rejects(()=>persistirProdutoGrupoLegado({...ctx,actorId:readOnly},mapped,opts),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>persistirProdutoGrupoLegado({...ctx,empresaId:I.empresaA},mapped,opts),/LEGACY_SHARED_PRODUCT_INVALID/);
  for(const variant of [{...mapped,descricao:'Divergent'},{...mapped,tipo_item:'Revenda'},{...mapped,unidade_medida_id:I.unidadeB}]) {
    await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,variant,opts));
  }
  await service.update(ctx,id,{descricao_comercial:'Preserved details',peso_teorico_kg_m:7.5});
  await assert.rejects(()=>service.update({...ctx,actorId:editor},id,{ativo:false}),e=>e.code==='PERMISSION_DENIED');
  await service.softDelete(ctx,id);
  await assert.rejects(()=>persistirProdutoGrupoLegado(ctx,mapped,opts),/LEGACY_RECONCILIATION_REQUIRED/);
  await assert.rejects(()=>service.update({...ctx,actorId:editor},id,{ativo:true}),e=>e.code==='PERMISSION_DENIED');
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
  assert.deepEqual(mapped,before);
  const actions=(await f.admin.query('SELECT action FROM audit_logs WHERE entity_id=$1 ORDER BY created_at',[id])).rows.map(r=>r.action);
  assert.deepEqual(actions,['create','update','soft_delete','restore','soft_delete','restore','soft_delete']);
 } finally {await f.close();}
}

test('Legacy Produto persisted pilot: mapping retry edit reopen reversal RBAC and rollback',async()=>prove(await localCrmFixture(),ROLE));
if(process.env.DATABASE_URL)test('Legacy Produto persisted pilot PostgreSQL real isolated',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!);await prove(f,f.role);});
