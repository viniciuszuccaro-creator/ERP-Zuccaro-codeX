import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localCrmFixture,ROLE} from './helpers/crmFixture.ts';
import {realCrmFixture} from './helpers/crmPostgresFixture.ts';
import {SEED_IDS as I} from '../scripts/seedDevIds.ts';
import {createInMemoryClienteRepo} from '../src/repositories/inMemoryClienteRepository.ts';
import {createInMemoryProdutoRepo} from '../src/repositories/inMemoryProdutoRepository.ts';
import {ClienteService} from '../src/services/clienteService.ts';
import {ProdutoService} from '../src/services/produtoService.ts';
import {PostgresClienteRepository} from '../src/repositories/postgresClienteRepository.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';
import {PostgresAuditRepository} from '../src/audit/auditRepository.ts';
import {InMemoryRbacGuard} from '../src/db/rbacGuard.ts';
import {InMemoryTenantGuard} from '../src/db/tenantGuard.ts';
import {InMemoryProdutoRelationGuard} from '../src/db/produtoRelationGuard.ts';
import type {DbClient} from '../src/db/client.ts';
import {consumirLoteStagingLegado,persistirClienteGrupoLegado,criarSnapshotReconciliacaoLegado,reconciliarPilotoGrupoLegado} from '../../scripts/legado/consumir-lote-staging.mjs';
import {inspecionarDestinoPilotoLegado} from '../../scripts/legado/consumir-lote-staging.mjs';
import {inspectRestrictedDbIdentity} from '../src/db/crmPreflight.ts';

test('Legacy preflight rejects privileged or SET ROLE sessions before catalog reads',async()=>{
 const f=await localCrmFixture();try {
  const destino=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const options={inspecionarIdentidade:inspectRestrictedDbIdentity};
  assert.equal((await inspecionarDestinoPilotoLegado(f.admin,destino,options)).ready,false);
  const denied=await f.data.withTransaction(tx=>inspecionarDestinoPilotoLegado(tx,destino,options));
  assert.equal(denied.ready,false);assert.deepEqual(denied.bloqueios,['loginRestrito']);
  assert.equal(denied.aprovacao_importacao_operacional,false);
  assert.ok(!JSON.stringify(denied).includes(destino.database));
 }finally{await f.close();}
});

if(process.env.DATABASE_URL)test('Legacy preflight PostgreSQL: shared masters, identity indexes, minimal grants and read-only fail-closed',async()=>{
 const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});try {
  const destino=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const options={inspecionarIdentidade:inspectRestrictedDbIdentity};
  const inspect=()=>f.data.withTransaction(tx=>inspecionarDestinoPilotoLegado({query:async(sql,params)=>{
   assert.match(sql.trim(),/^SELECT\b/i);return tx.query(sql,params);
  }},destino,options));
  await f.exec(`REVOKE ALL ON oportunidades FROM ${f.role}`); // Legacy identity checks do not require CRM DML grants.
  assert.ok((await inspect()).bloqueios.includes('grants'));
  await f.exec(`GRANT SELECT,INSERT,UPDATE ON clientes,produtos TO ${f.role}`);
  assert.equal((await inspect()).ready,true);
  await f.exec('GRANT UPDATE(nome) ON clientes TO PUBLIC');
  assert.ok((await inspect()).bloqueios.includes('publicAcl'));
  await f.exec('REVOKE UPDATE(nome) ON clientes FROM PUBLIC');
  await f.exec('ALTER TABLE produtos NO FORCE ROW LEVEL SECURITY');
  assert.ok((await inspect()).bloqueios.includes('rls'));
  await f.exec('ALTER TABLE produtos FORCE ROW LEVEL SECURITY');
  await f.exec('DROP INDEX produtos_legacy_identity_uidx');
  assert.ok((await inspect()).bloqueios.includes('identidadeUnica'));
  await f.exec('CREATE UNIQUE INDEX produtos_legacy_identity_uidx ON produtos(group_id,source_system,codigo_legado) WHERE source_system IS NOT NULL AND codigo_legado IS NOT NULL');
  assert.equal((await inspect()).ready,true);
  await f.exec('ALTER TABLE produtos RENAME COLUMN migration_batch TO hidden_fixture_batch');
  assert.ok((await inspect()).bloqueios.includes('colunas'));
  const wrong=await f.data.withTransaction(tx=>inspecionarDestinoPilotoLegado(tx,{...destino,database:'wrong'},options));
  assert.deepEqual(wrong.bloqueios,['destino']);assert.equal(wrong.aprovacao_importacao_operacional,false);
 }finally{await f.close();}
});

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
  if(f.restrictedLogin){
    const login=(await f.data.query('SELECT session_user=current_user same_session,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(login.same_session,true);assert.equal(login.rolcanlogin,true);
    assert.equal(login.rolsuper,false);assert.equal(login.rolbypassrls,false);
  }
  const guard=new InMemoryRbacGuard();const tenant=new InMemoryTenantGuard();
  for(const [group,actor] of [[I.groupA,I.runtimeActorA],[I.groupB,I.runtimeActorB]]) guard.link({actorId:actor,groupId:group,
    permissions:{Cadastros:{cliente:['visualizar','criar','editar','excluir','importar','inativar','restaurar'],produto:['visualizar','criar','editar','excluir','importar']}}});
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
  for(const metadata of [{source_system:'',codigo_legado:''},{source_system:'synthetic-contract',codigo_legado:''},
    {source_system:'   ',codigo_legado:'0007'}]) for(const company of [undefined,I.empresaA]) {
    await assert.rejects(()=>s.cliente.create({...ctx,empresaId:company},{tipo:'Pessoa Física',nome:'Synthetic rejected',documento:'11144477735',...metadata}),e=>e.code==='VALIDATION_ERROR');
    await assert.rejects(()=>s.produto.create({...ctx,empresaId:company},{descricao:'Synthetic rejected',tipo_item:'Matéria-Prima Produção',...metadata}),e=>e.code==='VALIDATION_ERROR');
  }
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM clientes WHERE source_system='' OR codigo_legado='' ")).rows[0].n,0);
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM produtos WHERE source_system='' OR codigo_legado='' ")).rows[0].n,0);
  const first=await persistirClienteGrupoLegado(ctx,row,opts);
  tenant.link(I.empresaB,ctx.groupId);
  await assert.rejects(()=>s.cliente.update(ctx,first.registro.id,{empresa_id:I.empresaB}),e=>e.code==='LEGACY_GROUP_SCOPE_REQUIRED');
  assert.equal((await s.cliente.get(ctx,first.registro.id)).empresa_id,null);
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

  await Promise.all([s.cliente.update(ctx,first.registro.id,{telefone:'Preserved synthetic'}),
    s.cliente.update(ctx,first.registro.id,{observacoes:'Preserved note'})]);
  const beforeClient=await s.cliente.get(ctx,first.registro.id);assert.equal(beforeClient.telefone,'Preserved synthetic');assert.equal(beforeClient.observacoes,'Preserved note');
  const beforeAudit=(await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Cliente' AND entity_id=$1",[first.registro.id])).rows[0].n;
  await f.exec("CREATE FUNCTION legacy_client_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='Cliente' THEN RAISE EXCEPTION 'synthetic client lifecycle audit failure';END IF;RETURN NEW;END $$;CREATE TRIGGER legacy_client_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION legacy_client_audit_fail()");
  await assert.rejects(()=>s.cliente.update(ctx,first.registro.id,{telefone:'Must roll back'}),/synthetic client lifecycle audit failure/);
  await assert.rejects(()=>s.cliente.softDelete(ctx,first.registro.id),/synthetic client lifecycle audit failure/);
  assert.deepEqual(await s.cliente.get(ctx,first.registro.id),beforeClient);
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM audit_logs WHERE entity='Cliente' AND entity_id=$1",[first.registro.id])).rows[0].n,beforeAudit);
  await f.exec('DROP TRIGGER legacy_client_audit_fail ON audit_logs');
  await s.cliente.softDelete(ctx,first.registro.id);
  await f.exec('CREATE TRIGGER legacy_client_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION legacy_client_audit_fail()');
  await assert.rejects(()=>s.cliente.restore(ctx,first.registro.id),/synthetic client lifecycle audit failure/);
  assert.equal((await s.cliente.findByLegacyIdentity(ctx,opts.sourceSystem,'0007'))!.ativo,false);
  await f.exec('DROP TRIGGER legacy_client_audit_fail ON audit_logs');
  const reopened=await s.cliente.restore(ctx,first.registro.id);assert.equal(reopened.id,beforeClient.id);assert.equal(reopened.codigo,beforeClient.codigo);assert.equal(reopened.telefone,beforeClient.telefone);assert.equal(reopened.codigo_legado,'0007');

  const reconOptions={services:{cliente:s.cliente},rbacGuard:guard};
  const clientBaseline=criarSnapshotReconciliacaoLegado('cliente',reopened);
  const recon=await reconciliarPilotoGrupoLegado(ctx,[clientBaseline],reconOptions);assert.equal(recon.equivalente,true);
  const altered=structuredClone(clientBaseline);altered.registro.telefone='Different expected content';
  assert.deepEqual((await reconciliarPilotoGrupoLegado(ctx,[altered],reconOptions)).resultados[0].campos,['telefone']);
  await assert.rejects(()=>reconciliarPilotoGrupoLegado({...ctx,actorId:limited},[clientBaseline],reconOptions),e=>e.code==='PERMISSION_DENIED');
  await s.cliente.softDelete(ctx,reopened.id);
  const inactive=await s.cliente.findByLegacyIdentity(ctx,opts.sourceSystem,'0007');
  assert.equal((await reconciliarPilotoGrupoLegado(ctx,[criarSnapshotReconciliacaoLegado('cliente',inactive)],reconOptions)).equivalente,true);
  assert.equal((await reconciliarPilotoGrupoLegado(ctx,[clientBaseline],reconOptions)).equivalente,false);
  await s.cliente.restore(ctx,reopened.id);
  await assert.rejects(()=>s.cliente.softDelete({...ctx,actorId:limited},first.registro.id),e=>e.code==='PERMISSION_DENIED');
  await assert.rejects(()=>services(I.groupB).cliente.update({groupId:I.groupB,actorId:I.runtimeActorB},first.registro.id,{telefone:'Wrong scope'}),e=>e.code==='CLIENTE_NOT_FOUND');
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
  const privateBaseline=[criarSnapshotReconciliacaoLegado('cliente',await s.cliente.get(ctx,first.registro.id)),
    criarSnapshotReconciliacaoLegado('produto',await s.produto.get(ctx,product.id))];
  privateBaseline[0].registro.telefone='Stale private expectation';
  const delayedCtx={...ctx},lookups:any[]=[];
  const privateStorage=async()=>({clients:(await f.admin.query('SELECT * FROM clientes ORDER BY id')).rows,
    products:(await f.admin.query('SELECT * FROM produtos ORDER BY id')).rows,
    sequences:(await f.admin.query('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name')).rows,
    audits:(await f.admin.query('SELECT * FROM audit_logs ORDER BY id')).rows});
  const beforeRead=await privateStorage();
  const readerPorts={cliente:{findByLegacyIdentity:async(...args:any[])=>{
    lookups.push(args[0]);return (s.cliente.findByLegacyIdentity as any)(...args);
  }},produto:s.produto};
  const readReport=await reconciliarPilotoGrupoLegado(delayedCtx,privateBaseline,{services:readerPorts,rbacGuard:{assertAllowed:async(...args:any[])=>{
    await (guard.assertAllowed as any)(...args);
    privateBaseline[0].registro.telefone='Preserved synthetic';privateBaseline.pop();
    delayedCtx.groupId=I.groupB;delayedCtx.actorId=I.runtimeActorB;
    readerPorts.cliente.findByLegacyIdentity=async()=>{throw Error('must not use swapped reader');};
  }}});
  assert.equal(readReport.totais.esperados,2);assert.equal(readReport.equivalente,false);
  assert.deepEqual(readReport.resultados[0].campos,['telefone']);assert.equal(readReport.resultados[1].resultado,'equivalente');
  assert.equal(lookups[0].groupId,ctx.groupId);assert.equal(lookups[0].actorId,ctx.actorId);assert.equal(Object.isFrozen(lookups[0]),true);
  assert.deepEqual(await privateStorage(),beforeRead);
  await assert.rejects(async()=>reconciliarPilotoGrupoLegado({...ctx,actorId:limited},[
    criarSnapshotReconciliacaoLegado('cliente',await s.cliente.get(ctx,first.registro.id)),
    criarSnapshotReconciliacaoLegado('produto',await s.produto.get(ctx,product.id))],{services:s,rbacGuard:guard}),e=>e.code==='PERMISSION_DENIED');
  assert.deepEqual(await privateStorage(),beforeRead);
  for(const secret of [first.registro.id,product.id,opts.sourceSystem,'Stale private expectation'])assert.equal(JSON.stringify(readReport).includes(secret),false);
  const observed=[criarSnapshotReconciliacaoLegado('cliente',await s.cliente.get(ctx,first.registro.id)),
    criarSnapshotReconciliacaoLegado('produto',await s.produto.get(ctx,product.id))];
  const observedReport=await reconciliarPilotoGrupoLegado(ctx,observed,{rbacGuard:guard,services:{cliente:{findByLegacyIdentity:async(...args:any[])=>{
    const result=await (s.cliente.findByLegacyIdentity as any)(...args);
    await s.produto.update(ctx,product.id,{descricao_comercial:'Concurrent synthetic edit'});return result;
  }},produto:s.produto}});
  assert.equal(observedReport.equivalente,false);assert.deepEqual(observedReport.resultados[1].campos,['descricao_comercial']);
  assert.equal(observedReport.consistencia,'observacao_por_registro_sem_snapshot_global');
  await s.produto.update(ctx,product.id,{descricao_comercial:observed[1].registro.descricao_comercial});
  assert.equal((await reconciliarPilotoGrupoLegado(ctx,observed,{rbacGuard:guard,services:s})).equivalente,true);
  await f.exec(migration);
  await f.exec('DROP INDEX clientes_legacy_identity_uidx');
  await f.admin.query("INSERT INTO clientes(group_id,codigo,tipo,nome,source_system,codigo_legado) VALUES($1,'900001','Pessoa Física','Synthetic historical A','historical','DUP'),($1,'900002','Pessoa Física','Synthetic historical B','historical','DUP')",[I.groupA]);
  await assert.rejects(()=>s.cliente.findByLegacyIdentity(ctx,'historical','DUP'),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
  await assert.rejects(()=>f.exec(migration),/LEGACY_CLIENT_IDENTITY_RECONCILIATION_REQUIRED/);
  assert.equal((await f.admin.query("SELECT count(*)::int n FROM clientes WHERE source_system='historical'")).rows[0].n,2);
 } finally {await f.close();}
}
test('Legacy canonical identities, restricted SQL role, concurrency and rollback',async()=>prove(await localCrmFixture(),ROLE));
if(process.env.DATABASE_URL)test('Legacy canonical identities PostgreSQL real isolated',async()=>{const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});await prove(f,f.role);});


test('Legacy identity memory compatibility and blank-key gate before persistence',async()=>{
 const tenant=new InMemoryTenantGuard(),guard=new InMemoryRbacGuard(),entries:any[]=[];
 const audit={append:async(e:any)=>{entries.push(e);}};
 const ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-memory-legacy'};
 guard.link({actorId:ctx.actorId,groupId:ctx.groupId,permissions:{Cadastros:{cliente:['visualizar','criar','editar','importar'],produto:['visualizar','criar','editar','importar']}}});
 const cr=createInMemoryClienteRepo(),pr=createInMemoryProdutoRepo();
 const cs=new ClienteService(cr,audit,tenant,guard),ps=new ProdutoService(pr,audit,tenant,new InMemoryProdutoRelationGuard(),guard);
 for(const blank of ['', '   ']) {
  await assert.rejects(()=>cs.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic',documento:'11144477735',source_system:blank,codigo_legado:'0001'}),e=>e.code==='VALIDATION_ERROR');
  await assert.rejects(()=>ps.create(ctx,{descricao:'Synthetic',tipo_item:'Matéria-Prima Produção',source_system:'synthetic',codigo_legado:blank}),e=>e.code==='VALIDATION_ERROR');
 }
 assert.equal(entries.length,0);assert.equal((await cr.list({groupId:ctx.groupId})).length,0);assert.equal((await pr.list({groupId:ctx.groupId})).length,0);
 const metadata={source_system:'synthetic',codigo_legado:'0001',legacy_id:'0001',origem:'MIGRACAO'};
 const client=await cs.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic',documento:'11144477735',...metadata});
 const product=await ps.create(ctx,{descricao:'Synthetic',tipo_item:'Matéria-Prima Produção',...metadata});
 assert.equal((await cs.findByLegacyIdentity(ctx,'synthetic','0001'))!.id,client.id);
 assert.equal((await ps.findByLegacyIdentity(ctx,'synthetic','0001'))!.id,product.id);
 await assert.rejects(()=>cs.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic second',documento:'39053344705',...metadata}),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
 await assert.rejects(()=>ps.create(ctx,{descricao:'Synthetic second',tipo_item:'Matéria-Prima Produção',...metadata}),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
 const plainC=await cs.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic plain',documento:'12345678909'}),plainP=await ps.create(ctx,{descricao:'Synthetic plain',tipo_item:'Matéria-Prima Produção'});
 await assert.rejects(()=>cs.update(ctx,plainC.id,metadata),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
 await assert.rejects(()=>ps.update(ctx,plainP.id,metadata),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
 assert.equal((await cs.get(ctx,plainC.id)).source_system,null);assert.equal((await ps.get(ctx,plainP.id)).source_system,null);
 for(const [service,id] of [[cs,client.id],[ps,product.id]] as const)await assert.rejects(()=>service.update(ctx,id,{codigo_legado:''}),e=>e.code==='VALIDATION_ERROR');
 cr.seed([{...client,id:'synthetic-ambiguous'}]);pr.seed([{...product,id:'synthetic-ambiguous'}]);
 await assert.rejects(()=>cs.findByLegacyIdentity(ctx,'synthetic','0001'),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
 await assert.rejects(()=>ps.findByLegacyIdentity(ctx,'synthetic','0001'),e=>e.code==='LEGACY_RECONCILIATION_REQUIRED');
});


test('Cliente memory lifecycle rolls back audit failures without erasing a concurrent successful mutation',async()=>{
 const repo=createInMemoryClienteRepo(),tenant=new InMemoryTenantGuard(),guard=new InMemoryRbacGuard();
 const ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-client-atomic'};
 guard.link({actorId:ctx.actorId,groupId:ctx.groupId,permissions:{Cadastros:{cliente:['visualizar','criar','editar','inativar','restaurar']}}});
 let failId='';const entries:any[]=[];const audit={append:async(e:any)=>{if(e.entityId===failId)throw Error('synthetic memory audit failure');entries.push(e);}};
 const s=new ClienteService(repo,audit,tenant,guard);
 const a=await s.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic A',documento:'11144477735'}),b=await s.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic B',documento:'39053344705'});
 await s.update(ctx,a.id,{telefone:'Preserve'});failId=a.id;
 const mutations=await Promise.allSettled([s.update(ctx,a.id,{telefone:'Rollback'}),s.update(ctx,b.id,{telefone:'Successful'})]);
 assert.equal(mutations[0].status,'rejected');assert.equal(mutations[1].status,'fulfilled');
 assert.equal((await s.get(ctx,a.id)).telefone,'Preserve');assert.equal((await s.get(ctx,b.id)).telefone,'Successful');
 await assert.rejects(()=>s.softDelete(ctx,a.id),/synthetic memory audit failure/);assert.equal((await s.get(ctx,a.id)).ativo,true);
 failId='';await s.softDelete(ctx,a.id);failId=a.id;
 await assert.rejects(()=>s.restore(ctx,a.id),/synthetic memory audit failure/);assert.equal((await repo.getById({groupId:ctx.groupId},a.id))!.ativo,false);
 failId='';const restored=await s.restore(ctx,a.id);assert.equal(restored.id,a.id);assert.equal(restored.codigo,a.codigo);assert.equal(restored.telefone,'Preserve');
 // Duplicate rejection remains audited after rollback of the mutation transaction.
 await assert.rejects(()=>s.update(ctx,a.id,{documento:b.documento!}),e=>e.code==='DUPLICATE_DOCUMENT');
 assert.equal((await s.get(ctx,a.id)).documento,a.documento);assert.equal(entries.at(-1).action,'duplicate_block');
});


test('Cliente SQL read lock requires executor and mutation never escapes it',async()=>{
 let escaped=0;const db:any={query:async()=>{escaped++;return {rows:[]};},withTransaction:async(fn:any)=>fn(executor)};
 const row={id:'00000000-0000-4000-8000-000000000099',group_id:I.groupA,empresa_id:null,codigo:'000001',tipo:'Pessoa Física',nome:'Synthetic',ativo:true};
 const seen:string[]=[];const executor:any={query:async(sql:string)=>{seen.push(sql);return {rows:[row]};}};
 const repo=new PostgresClienteRepository(db),scope={groupId:I.groupA};
 await assert.rejects(()=>repo.getById(scope,row.id,undefined,{forUpdate:true}),/CLIENTE_ROW_LOCK_REQUIRES_TRANSACTION/);assert.equal(escaped,0);
 assert.equal(await repo.getById(scope,row.id),null);assert.equal(escaped,1);
 await repo.update(scope,row.id,{telefone:'Synthetic'},executor);assert.equal(escaped,1);assert.match(seen[0],/FOR UPDATE$/);assert.match(seen[1],/UPDATE clientes/);
});


test('Legacy persisted reconciliation checks content and state without leaking private values',async()=>{
 const guard=new InMemoryRbacGuard(),tenant=new InMemoryTenantGuard(),ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-reconciliation'};
 guard.link({actorId:ctx.actorId,groupId:ctx.groupId,permissions:{Cadastros:{cliente:['visualizar','criar','editar','inativar','restaurar','importar'],produto:['visualizar','criar','editar','inativar','restaurar','importar']}}});
 const audit={append:async()=>{}},cr=createInMemoryClienteRepo(),pr=createInMemoryProdutoRepo();
 const cs=new ClienteService(cr,audit,tenant,guard),ps=new ProdutoService(pr,audit,tenant,new InMemoryProdutoRelationGuard(),guard);
 const meta={origem:'MIGRACAO',source_system:'synthetic-private-source',codigo_legado:'PRIVATE-KEY',legacy_id:'PRIVATE-KEY',migration_batch:'synthetic-private-batch'};
 const client=await cs.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic private name',documento:'11144477735',...meta});
 const product=await ps.create(ctx,{descricao:'Synthetic private steel',tipo_item:'Revenda',codigo:'000201',...meta});
 const snapshots=[criarSnapshotReconciliacaoLegado('cliente',client),criarSnapshotReconciliacaoLegado('produto',product)];
 const opts={services:{cliente:cs,produto:ps},rbacGuard:guard},before=structuredClone(snapshots);
 const report=await reconciliarPilotoGrupoLegado(ctx,snapshots,opts);
 assert.equal(report.equivalente,true);assert.equal(report.aprovacao_importacao_operacional,false);
 for(const secret of [client.id,client.nome,client.documento,client.codigo,product.descricao,meta.source_system,meta.codigo_legado,meta.migration_batch])assert.equal(JSON.stringify(report).includes(secret),false);
 await cs.update(ctx,client.id,{telefone:'New synthetic phone'});
 const changed=await reconciliarPilotoGrupoLegado(ctx,snapshots,opts);assert.equal(changed.equivalente,false);assert.deepEqual(changed.resultados[0].campos,['telefone']);
 assert.equal(changed.totais.esperados,changed.totais.equivalentes+changed.totais.divergentes);
 await cs.softDelete(ctx,client.id);const archived=await cs.findByLegacyIdentity(ctx,meta.source_system,meta.codigo_legado);
 assert.equal((await reconciliarPilotoGrupoLegado(ctx,[criarSnapshotReconciliacaoLegado('cliente',archived)],opts)).equivalente,true);
 assert.equal((await reconciliarPilotoGrupoLegado(ctx,[snapshots[0]],opts)).equivalente,false);
 await cs.restore(ctx,client.id);assert.equal((await reconciliarPilotoGrupoLegado(ctx,[criarSnapshotReconciliacaoLegado('cliente',await cs.get(ctx,client.id))],opts)).equivalente,true);
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,[snapshots[0],snapshots[0]],opts),/DUPLICATE_SNAPSHOT/);
 const wrong=structuredClone(snapshots[0]);wrong.registro.group_id=I.groupB;
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,[wrong],opts),/SNAPSHOT_INVALID/);
 const forged=structuredClone(snapshots[0]);forged.registro.unexpected='Secret';
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,[forged],opts),/SNAPSHOT_INVALID/);
 await assert.rejects(()=>reconciliarPilotoGrupoLegado({...ctx,empresaId:I.empresaA},snapshots,opts),/CONTRACT_REQUIRED/);
 const wildcard='synthetic-wildcard';guard.link({actorId:wildcard,groupId:ctx.groupId,permissions:{'*':['visualizar']}});
 await assert.rejects(()=>reconciliarPilotoGrupoLegado({...ctx,actorId:wildcard},snapshots,opts),e=>e.code==='PERMISSION_DENIED');
 const missing={...opts,services:{cliente:{findByLegacyIdentity:async()=>null}}};
 assert.equal((await reconciliarPilotoGrupoLegado(ctx,[snapshots[0]],missing)).totais.ausentes,1);
 const ambiguous={...opts,services:{cliente:{findByLegacyIdentity:async()=>{throw Object.assign(Error('Private identity'),{code:'LEGACY_RECONCILIATION_REQUIRED'});}}}};
 assert.equal((await reconciliarPilotoGrupoLegado(ctx,[snapshots[0]],ambiguous)).totais.ambiguos,1);
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,[snapshots[0]],{...opts,services:{cliente:{findByLegacyIdentity:async()=>{throw Object.assign(Error('Denied'),{code:'PERMISSION_DENIED'});}}}}),e=>e.code==='PERMISSION_DENIED');
 assert.deepEqual(snapshots,before);
 const lateSnapshots=structuredClone(snapshots),lateCtx={...ctx},calls:any[]=[];
 const stableClient=await cs.findByLegacyIdentity(ctx,meta.source_system,meta.codigo_legado);
 const latePorts={cliente:{findByLegacyIdentity:async(...args:any[])=>{
  calls.push({ctx:args[0],source:args[1],code:args[2]});return (cs.findByLegacyIdentity as any)(...args);
 }},produto:ps};
 const delayedGuard={assertAllowed:async(...args:any[])=>{
  const permission=await (guard.assertAllowed as any)(...args);
  lateSnapshots[0].registro=criarSnapshotReconciliacaoLegado('cliente',stableClient).registro;
  lateSnapshots.pop();lateCtx.groupId=I.groupB;lateCtx.actorId=I.runtimeActorB;
  latePorts.cliente.findByLegacyIdentity=async()=>{throw Error('must not use replaced reader');};
  return permission;
 }};
 const stable=await reconciliarPilotoGrupoLegado(lateCtx,lateSnapshots,{services:latePorts,rbacGuard:delayedGuard});
 assert.equal(stable.totais.esperados,2);assert.equal(stable.equivalente,false);
 assert.deepEqual(stable.resultados[0].campos,['telefone']);assert.equal(calls.length,1);
 assert.equal(calls[0].ctx.groupId,ctx.groupId);assert.equal(calls[0].ctx.actorId,ctx.actorId);
 assert.equal(Object.isFrozen(calls[0].ctx),true);assert.equal(calls[0].source,meta.source_system);
 assert.equal(calls[0].code,meta.codigo_legado);
 const unsafe=structuredClone(snapshots[0]);unsafe.registro.nome=()=> 'private function value';
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,[unsafe],opts),/^Error: LEGACY_RECONCILIATION_SNAPSHOT_INVALID$/);
 await assert.rejects(()=>reconciliarPilotoGrupoLegado(ctx,snapshots,{...opts,rbacGuard:{assertAllowed:1}}),/CONTRACT_REQUIRED/);
});
test('Cliente lifecycle revalidates permission after prepare before any mutation',async()=>{
 const repo=createInMemoryClienteRepo(),tenant=new InMemoryTenantGuard(),ctx={groupId:I.groupA,actorId:I.runtimeActorA,requestId:'synthetic-revocation'};
 let revoke=false,calls=0;const audit={append:async()=>{}};
 const guard:any={assertAllowed:async()=>{if(revoke&&++calls===2)throw Object.assign(new Error('Permission revoked'),{code:'PERMISSION_DENIED'});}};
 const s=new ClienteService(repo,audit,tenant,guard),row=await s.create(ctx,{tipo:'Pessoa Física',nome:'Synthetic',documento:'11144477735'});
 revoke=true;await assert.rejects(()=>s.update(ctx,row.id,{telefone:'Must not persist'}),e=>e.code==='PERMISSION_DENIED');assert.equal(calls,2);
 assert.equal((await repo.getById({groupId:ctx.groupId},row.id))!.telefone,null);
 calls=0;await assert.rejects(()=>s.softDelete(ctx,row.id),e=>e.code==='PERMISSION_DENIED');assert.equal((await repo.getById({groupId:ctx.groupId},row.id))!.ativo,true);
 revoke=false;await s.softDelete(ctx,row.id);revoke=true;calls=0;await assert.rejects(()=>s.restore(ctx,row.id),e=>e.code==='PERMISSION_DENIED');assert.equal((await repo.getById({groupId:ctx.groupId},row.id))!.ativo,false);
});
