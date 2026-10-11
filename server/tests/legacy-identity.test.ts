import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
import {ClienteService} from '../src/services/clienteService.ts';
import {ProdutoService} from '../src/services/produtoService.ts';
import {PostgresClienteRepository} from '../src/repositories/postgresClienteRepository.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {InMemoryRbacGuard} from '../src/db/rbacGuard.ts';
import {InMemoryTenantGuard} from '../src/db/tenantGuard.ts';
import {InMemoryProdutoRelationGuard} from '../src/db/produtoRelationGuard.ts';
import type {DbClient} from '../src/db/client.ts';
import {consumirLoteStagingLegado,persistirClienteGrupoLegado} from '../../scripts/legado/consumir-lote-staging.mjs';

const migration=await readFile(new URL('../migrations/043_legado_identidade_compartilhada.sql',import.meta.url),'utf8');
async function prove(f:any,role:string) {
 try {
  await f.exec(`GRANT SELECT,INSERT,UPDATE ON clientes,produtos TO ${role};
    CREATE POLICY legacy_fixture_master ON clientes FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
    CREATE POLICY legacy_fixture_master ON produtos FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
    CREATE POLICY legacy_fixture_audit ON audit_logs FOR ALL TO ${role}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);`);
  const flags=(await f.admin.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
  assert.equal(flags.rolsuper,false);assert.equal(flags.rolbypassrls,false);
  const guard=new InMemoryRbacGuard();const tenant=new InMemoryTenantGuard();
  for(const [group,actor] of [[I.groupA,I.runtimeActorA],[I.groupB,I.runtimeActorB]]) guard.link({actorId:actor,groupId:group,
    permissions:{Cadastros:{cliente:['visualizar','criar','editar','excluir','importar'],produto:['visualizar','criar','editar','excluir','importar']}}});
  const limited='00000000-0000-4000-8000-000000000099';guard.link({actorId:limited,groupId:I.groupA,permissions:{Cadastros:{cliente:['visualizar'],produto:['visualizar']}}});
  function services(group:string) {
    const run=(fn:any)=>f.data.withTransaction(async(q:any)=>{
      await q.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id','',true)",[group]);return fn(q);
    });
    const db:DbClient={pool:null,query:(sql,params)=>run((q:any)=>q.query(sql,params)),withTransaction:run,checkConnection:async()=>true,end:async()=>{}};
    const audit=new PostgresAuditRepository(db);
    return {cliente:new ClienteService(new PostgresClienteRepository(db),audit,tenant,guard),
      produto:new ProdutoService(new PostgresProdutoRepository(db,true),audit,tenant,new InMemoryProdutoRelationGuard(),guard)};
  }
  const s=services(I.groupA),ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'legacy-identity-synthetic'};
  const opts={service:s.cliente,rbacGuard:guard,tipo:'Pessoa Física',sourceSystem:'synthetic-contract',batch:'synthetic'};
  const row=consumirLoteStagingLegado([{cod_cliente:'0007',nome:'Synthetic client',documento:'11144477735',group_id:I.groupA}],
    {entidade:'cliente',contratoEntrada:{coorte:'synthetic'}}).comprovados[0];
  const first=await persistirClienteGrupoLegado(ctx,row,opts);
  assert.equal((await persistirClienteGrupoLegado(ctx,row,opts)).registro.id,first.registro.id);
  for(const variant of [{...row,documento:'39053344705'},{...row,codigo_legado:'0008'}]) {
    await assert.rejects(()=>persistirClienteGrupoLegado(ctx,variant,opts),/LEGACY_RECONCILIATION_REQUIRED/);
  }
  await assert.rejects(()=>s.cliente.update(ctx,first.registro.id,{codigo_legado:'different'}),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
  await assert.rejects(()=>s.cliente.findByLegacyIdentity({...ctx,actorId:limited},opts.sourceSystem,'0007'),e=>e.code==='PERMISSION_DENIED');
  const concurrent=await Promise.allSettled([
    persistirClienteGrupoLegado(ctx,{...row,codigo_legado:'0009',documento:'39053344705'},opts),
    persistirClienteGrupoLegado(ctx,{...row,codigo_legado:'0009',documento:'12345678909'},opts),
  ]);
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(concurrent.filter(r=>r.status==='rejected'&&/LEGACY_RECONCILIATION_REQUIRED/.test(r.reason.message)).length,1);
  assert.equal((await f.admin.query('SELECT count(*)::int n FROM clientes WHERE source_system=$1 AND codigo_legado=$2',[opts.sourceSystem,'0009'])).rows[0].n,1);

  const productPayload={descricao:'Synthetic steel',tipo_item:'Matéria-Prima Produção',empresa_id:null,
    origem:'MIGRACAO',codigo_legado:'P-0001',legacy_id:'P-0001',source_system:'synthetic-contract',migration_batch:'synthetic'};
  const product=await s.produto.create(ctx,productPayload);assert.match(product.codigo!,/^\d+$/);
  assert.equal(product.codigo_legado,'P-0001');assert.equal(product.empresa_id,null);
  assert.equal((await s.produto.findByLegacyIdentity(ctx,'synthetic-contract','P-0001'))!.id,product.id);
  await assert.rejects(()=>s.produto.create(ctx,{...productPayload,descricao:'Divergent'}),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
  await s.produto.update(ctx,product.id,{descricao_comercial:'Preserved synthetic'});
  await assert.rejects(()=>s.produto.update(ctx,product.id,{source_system:'changed'}),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
  assert.equal((await s.produto.get(ctx,product.id)).codigo_legado,'P-0001');
  const races=await Promise.allSettled([s.produto.create(ctx,{...productPayload,codigo_legado:'P-RACE',legacy_id:'P-RACE'}),
    s.produto.create(ctx,{...productPayload,codigo_legado:'P-RACE',legacy_id:'P-RACE'})]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(races.filter(r=>r.status==='rejected'&&r.reason.code==='LEGACY_RECONCILIATION_REQUIRED').length,1);
  const groupB=services(I.groupB),ctxB={groupId:I.groupB,actorId:I.runtimeActorB};
  assert.equal(await groupB.produto.findByLegacyIdentity(ctxB,'synthetic-contract','P-0001'),null);
  const other=await groupB.produto.create(ctxB,productPayload);assert.notEqual(other.id,product.id);
  assert.equal((await f.admin.query('SELECT count(*)::int n FROM produto_empresas WHERE produto_id IN ($1,$2)',[product.id,other.id])).rows[0].n,0);
  await assert.rejects(()=>s.produto.findByLegacyIdentity({...ctx,actorId:limited},'synthetic-contract','P-0001'),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>s.produto.findByLegacyIdentity({...ctx,empresaId:I.empresaA},'synthetic-contract','P-0001'),e=>e.code==='LEGACY_GROUP_SCOPE_REQUIRED');
  await assert.rejects(()=>s.produto.empresaOperacao({...ctx,empresaId:I.empresaA},product.id),e=>e.code==='TENANT_MISMATCH'||e.code==='PRODUTO_NOT_FOUND');

  const sequence=(await f.admin.query("SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='Produto'",[I.groupA])).rows[0].next_value;
  await f.exec("CREATE FUNCTION legacy_fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Produto' THEN RAISE EXCEPTION 'synthetic legacy audit failure';END IF;RETURN NEW;END $$;CREATE TRIGGER legacy_fixture_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION legacy_fixture_fail()");
  await assert.rejects(()=>s.produto.create(ctx,{...productPayload,codigo_legado:'P-ROLLBACK',legacy_id:'P-ROLLBACK'}),/synthetic legacy audit failure/);
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM produtos WHERE codigo_legado='P-ROLLBACK'")).rows[0].n,0);
  assert.equal((await f.admin.query("SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='Produto'",[I.groupA])).rows[0].next_value,sequence);
  await f.exec('DROP TRIGGER legacy_fixture_fail ON audit_logs');
  // Additive metadata survives an old-code update that does not mention the new columns.
  await f.admin.query('UPDATE produtos SET descricao=$1 WHERE id=$2',['Old-code compatible edit',product.id]);
  assert.equal((await s.produto.get(ctx,product.id)).legacy_id,'P-0001');
  await f.exec(migration);
  await f.exec('DROP INDEX clientes_legacy_identity_uidx');
  await f.admin.query("INSERT INTO clientes(group_id,codigo,tipo,nome,source_system,codigo_legado) VALUES($1,'900001','Pessoa Física','Synthetic historical A','historical','DUP'),($1,'900002','Pessoa Física','Synthetic historical B','historical','DUP')",[I.groupA]);
  await assert.rejects(()=>s.cliente.findByLegacyIdentity(ctx,'historical','DUP'),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
  await assert.rejects(()=>f.exec(migration),/LEGACY_CLIENT_IDENTITY_RECONCILIATION_REQUIRED/);
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM clientes WHERE source_system='historical'")).rows[0].n,2);
 } finally {await f.close();}
}
test('Legacy canonical identities, restricted SQL role, concurrency and rollback',async()=>prove(await localCrmFixture(),ROLE));
if(process.env.DATABASE_URL)test('Legacy canonical identities PostgreSQL real isolated',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!);await prove(f,f.role);});
