import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresOrcamentoRepository } from '../src/repositories/postgresOrcamentoRepository.ts';
import { PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.ts';
import { PostgresOportunidadeRepository } from '../src/repositories/postgresOportunidadeRepository.ts';
import { OportunidadeService } from '../src/services/oportunidadeService.ts';
import { ClienteCentral360Service } from '../src/services/clienteCentral360Service.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { assertCrmIsolatedUrl, realCrmFixture,proveCrmFixtureBackup } from './helpers/crmPostgresFixture.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DbClient } from '../src/db/client.ts';
import type { RequestContext } from '../src/audit/types.ts';
import { createHttpApiClient } from '../../src/api/httpApiClient.js';
import { inspectCrmPreflight } from '../src/db/crmPreflight.ts';
import { createPoolDbClient,createRuntimeDbClients } from '../src/db/client.ts';
import { authColumnGrants } from './helpers/authBootstrapFixture.ts';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import pg from 'pg';

test('R40 gate de PostgreSQL isolado rejeita DEV/remoto/ausente antes de conectar',()=>{
  for(const url of [undefined,'postgresql://synthetic@localhost/postgres','postgresql://synthetic@example.invalid/erp_test'])
    assert.throws(()=>assertCrmIsolatedUrl(url),/CRM_ISOLATED_POSTGRES_REQUIRED/);
});

// The real suite is registered whenever the existing mandatory runner provides DATABASE_URL.
// No skip flag is introduced; runPostgresTests rejects missing URL and skipped suites.
if(process.env.DATABASE_URL)test('R40 PostgreSQL real: CRUD/concorrrência/replay/audit rollback/RLS/Cliente→Orçamento→CRM',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!);
  try{
    const preflight=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,{database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema:f.schema}));
    assert.equal(preflight.ready,true);assert.deepEqual(preflight.blocked,[]);
    const inspectSequence=()=>f.data.withTransaction(tx=>inspectCrmPreflight(tx,{database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema:f.schema}));
    await f.exec('ALTER TABLE entity_code_sequences NO FORCE ROW LEVEL SECURITY');
    assert.ok((await inspectSequence()).blocked.includes('sequenceRls'));
    await f.exec('ALTER TABLE entity_code_sequences FORCE ROW LEVEL SECURITY');
    await f.exec('GRANT UPDATE(next_value) ON entity_code_sequences TO PUBLIC');
    assert.ok((await inspectSequence()).blocked.includes('noPublicDml'));
    await f.exec('REVOKE UPDATE(next_value) ON entity_code_sequences FROM PUBLIC');
    assert.equal((await inspectSequence()).ready,true);
    const inspectAcl=()=>f.data.withTransaction(tx=>inspectCrmPreflight(tx,{database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema:f.schema}));
    await f.exec('GRANT SELECT(codigo),UPDATE(status) ON oportunidades TO PUBLIC');
    assert.ok((await inspectAcl()).blocked.includes('noPublicDml'));
    await f.exec('REVOKE SELECT(codigo),UPDATE(status) ON oportunidades FROM PUBLIC');
    const recreatePolicy=(mode:'PERMISSIVE'|'RESTRICTIVE')=>f.exec(`DROP POLICY oportunidades_tenant_scope ON oportunidades;
      CREATE POLICY oportunidades_tenant_scope ON oportunidades AS ${mode} FOR ALL
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
    await recreatePolicy('RESTRICTIVE');assert.ok((await inspectAcl()).blocked.includes('policy'));
    await recreatePolicy('PERMISSIVE');assert.equal((await inspectAcl()).ready,true);
    await f.exec(`DROP TRIGGER trg_oportunidades_codigo ON oportunidades;
      CREATE TRIGGER trg_oportunidades_codigo AFTER UPDATE ON oportunidades
      FOR EACH ROW EXECUTE PROCEDURE sync_oportunidade_codigo();`);
    const wrongEvents=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,{database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema:f.schema}));
    assert.ok(wrongEvents.blocked.includes('codeTrigger'));
    await f.exec(`DROP TRIGGER trg_oportunidades_codigo ON oportunidades;
      CREATE TRIGGER trg_oportunidades_codigo BEFORE INSERT OR UPDATE OF codigo,group_id ON oportunidades
      FOR EACH ROW EXECUTE PROCEDURE sync_oportunidade_codigo();`);
    const premature=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,{database:new URL(process.env.DATABASE_URL!).pathname.slice(1),schema:f.schema,stage:'before_migration'}));
    assert.equal(premature.ready,false);assert.ok(premature.blocked.includes('crmAbsent'));
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'r40-synthetic'};
    const scope={groupId:ctx.groupId,empresaId:ctx.empresaId};
    const audit=new PostgresAuditRepository(f.admin),repo=new PostgresOportunidadeRepository(f.data);
    const service=new OportunidadeService(repo,audit,new PostgresTenantGuard(f.admin),new PostgresRbacGuard(f.admin),
      new PostgresClienteRepository(f.admin),new PostgresOrcamentoRepository(f.admin),new PostgresPedidoRepository(f.admin));
    assert.match((await f.admin.query<{version:string}>('SELECT version()')).rows[0].version,/PostgreSQL/);
    await f.data.withTransaction(async tx=>{
      const roles=await tx.query<{rolsuper:boolean;rolbypassrls:boolean;rolcanlogin:boolean}>('SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname=current_user');
      assert.deepEqual(roles.rows[0],{rolsuper:false,rolbypassrls:false,rolcanlogin:false});
      assert.equal((await tx.query('SELECT id FROM oportunidades')).rows.length,0);
    });
    const ce=await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo AND habilitado_operacao AND NOT bloqueado LIMIT 1',[ctx.groupId,ctx.empresaId]);
    assert.ok(ce.rows[0]?.id);
    const input={titulo:'R40 sintético',cliente_empresa_id:ce.rows[0].id,idempotency_key:'r40-concurrent-create',valor_estimado:'100.123456'};
    const same=await Promise.all(Array.from({length:18},()=>service.create(ctx,input)));
    assert.equal(new Set(same.map(row=>row.id)).size,1);const row=same[0];assert.equal(row.codigo,'000001');
    const separate=await Promise.all(Array.from({length:8},(_,i)=>service.create(ctx,{...input,idempotency_key:`r40-distinct-${i}`})));
    assert.equal(new Set(separate.map(r=>r.codigo)).size,8);
    assert.equal((await service.list(ctx,{limit:2})).meta.total,9);
    const outcomes=await Promise.allSettled([service.update(ctx,row.id,{expected_version:1,etapa:'Proposta'}),service.update(ctx,row.id,{expected_version:1,etapa:'Negociação'})]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    const current=await service.get(ctx,row.id);assert.equal(current.version,2);assert.equal(current.valor_estimado,input.valor_estimado);
    await assert.rejects(service.get({...ctx,empresaId:ID.empresaA2},row.id),{code:'OPORTUNIDADE_NOT_FOUND'});
    await f.data.withTransaction(async tx=>{
      await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[ID.groupA,ID.empresaA2]);
      assert.equal((await tx.query('SELECT id FROM oportunidades')).rows.length,0);
      assert.equal((await tx.query('UPDATE oportunidades SET titulo=$2 WHERE id=$1 RETURNING id',[row.id,'should not change'])).rows.length,0);
    });
    const beforeSeq=await f.admin.query<{next_value:string}>('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[ctx.groupId,'Oportunidade']);
    await f.exec(`CREATE FUNCTION crm_force_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity='Oportunidade' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER crm_force_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_force_audit_failure();`);
    await assert.rejects(service.create(ctx,{...input,idempotency_key:'r40-audit-failure'}),/synthetic audit failure/);
    const afterSeq=await f.admin.query<{next_value:string}>('SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name=$2',[ctx.groupId,'Oportunidade']);
    assert.equal(afterSeq.rows[0].next_value,beforeSeq.rows[0].next_value);
    await assert.rejects(service.update(ctx,row.id,{expected_version:2,titulo:'Nao persistir'}),/synthetic audit failure/);
    assert.equal((await service.get(ctx,row.id)).titulo,current.titulo);
    await f.exec('DROP TRIGGER crm_force_audit ON audit_logs; DROP FUNCTION crm_force_audit_failure();');
    const inactive=await service.setActive(ctx,row.id,{expected_version:2},false);assert.equal(inactive.ativo,false);
    const restored=await service.setActive(ctx,row.id,{expected_version:3},true);assert.equal(restored.ativo,true);
    const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',DATABASE_URL:process.env.DATABASE_URL}),db:f.admin});
    await proveCentralCrm(f.admin,app,ctx,service);
    const customer=await app.clienteService.get(ctx,ID.clientePjA);assert.equal(customer.id,ID.clientePjA);
    const orcamento=await app.orcamentoService.create(ctx,{cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,
      validade_em:'2027-01-31T00:00:00.000Z',itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,descricao:'R40 item sintético',
        unidade_sigla:'KG',quantidade:'2.000000',preco_unitario:'999.000000',desconto:'0.000000'}]});
    assert.notEqual(orcamento.itens[0].preco_unitario,'999.000000');
    await f.admin.query('UPDATE oportunidades SET orcamento_id=$2 WHERE id=$1',[row.id,'orcamento_original_textual']);
    const linked=await service.linkOrcamento(ctx,row.id,{expected_version:4,orcamento_id:orcamento.id});
    assert.equal(linked.status,'Ganho');assert.equal(linked.orcamento_id,orcamento.id);
    assert.equal(linked.legacy_orcamento_id,'orcamento_original_textual');
    const replayLink=await service.linkOrcamento(ctx,row.id,{expected_version:4,orcamento_id:orcamento.id});
    assert.equal(replayLink.legacy_orcamento_id,'orcamento_original_textual');assert.equal(replayLink.version,linked.version);
    assert.equal((await app.orcamentoService.get(ctx,orcamento.id)).id,orcamento.id);
    // Use the existing quotation conversion service, preserving its price snapshots.
    const pedido=await app.pedidoService.convert(ctx,orcamento.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z'});
    assert.equal(pedido.itens[0].preco_unitario,orcamento.itens[0].preco_unitario);
    await f.admin.query('UPDATE oportunidades SET pedido_id=$2 WHERE id=$1',[row.id,'pedido_original_textual']);
    const linkedOrders=await Promise.all(Array.from({length:6},()=>service.linkPedido(ctx,row.id,{expected_version:5,pedido_id:pedido.id})));
    assert.ok(linkedOrders.every(r=>r.version===6 && r.pedido_id===pedido.id && r.legacy_pedido_id==='pedido_original_textual'));
    assert.equal(linkedOrders[0].orcamento_id,orcamento.id);assert.equal(linkedOrders[0].legacy_orcamento_id,'orcamento_original_textual');
    assert.equal((await app.pedidoService.get(ctx,pedido.id)).status,'EM_ABERTO');
    const direct=await app.pedidoService.create(ctx,{cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,
      tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z',itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,
        descricao:'Pedido direto sintético',unidade_sigla:'KG',quantidade:'1.000000',preco_unitario:'999.000000',desconto:'0.000000',requer_producao:false}]});
    const exclusive=await Promise.allSettled([separate[4],separate[5]].map(r=>service.linkPedido(ctx,r.id,{expected_version:1,pedido_id:direct.id})));
    assert.equal(exclusive.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((exclusive.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'OPORTUNIDADE_PEDIDO_ALREADY_LINKED');
    const owner=(exclusive.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
    const loser=owner.id===separate[4].id?separate[5]:separate[4];
    assert.equal((await service.get(ctx,loser.id)).version,1);
    await assert.rejects(f.admin.query("UPDATE oportunidades SET convertido_em='pedido',convertido_em_id=$2 WHERE id=$1",[loser.id,direct.id]),/uq_oportunidades_pedido_canonico/);
    await assert.rejects(service.linkPedido({...ctx,empresaId:ID.empresaA2},row.id,{expected_version:6,pedido_id:pedido.id}),{code:'OPORTUNIDADE_NOT_FOUND'});
    // An uncommitted cancellation must be seen after the locked canonical read.
    const secondDoc=await app.orcamentoService.create(ctx,{cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,
      validade_em:'2027-01-31T00:00:00.000Z',itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,descricao:'R40 concorrente',
        unidade_sigla:'KG',quantidade:'1.000000',preco_unitario:'999.000000',desconto:'0.000000'}]});
    const cancel=await f.admin.pool!.connect();const original=f.data.withTransaction.bind(f.data);
    let seen!:()=>void;const observed=new Promise<void>(resolve=>{seen=resolve;});
    let outcome:Promise<any>|undefined;
    try {
      await cancel.query('BEGIN');await cancel.query(`SET LOCAL search_path TO "${f.schema}",pg_catalog`);
      await cancel.query("UPDATE orcamentos SET status='CANCELADO',ativo=false WHERE id=$1",[secondDoc.id]);
      f.data.withTransaction=fn=>original(tx=>fn({query:async(sql,params)=>{
        if(sql.includes('FROM orcamentos o')&&sql.includes('FOR UPDATE OF o'))seen();return tx.query(sql,params);
      }}));
      outcome=service.linkOrcamento(ctx,separate[1].id,{expected_version:1,orcamento_id:secondDoc.id})
        .then(value=>({ok:true,value}),error=>({ok:false,error}));
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {await Promise.race([observed,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('canonical document lock missing')),5000);})]);}
      finally{if(timer)clearTimeout(timer);}
      await cancel.query('COMMIT');const result=await outcome;
      assert.equal(result.ok,false);assert.equal(result.error.code,'OPORTUNIDADE_DOCUMENT_REFERENCE_INVALID');
      assert.equal((await service.get(ctx,separate[1].id)).version,1);
    }finally{
      await cancel.query('ROLLBACK');cancel.release();f.data.withTransaction=original;
      if(outcome)await outcome;
    }
    // Pedido cancellation competes with CRM linking on the same canonical row.
    const cancelPedido=await f.admin.pool!.connect();
    let pedidoSeen!:()=>void;const pedidoObserved=new Promise<void>(resolve=>{pedidoSeen=resolve;});
    let pedidoOutcome:Promise<any>|undefined;
    try {
      await cancelPedido.query('BEGIN');await cancelPedido.query(`SET LOCAL search_path TO "${f.schema}",pg_catalog`);
      await cancelPedido.query("UPDATE pedidos SET status='CANCELADO',ativo=false WHERE id=$1",[pedido.id]);
      f.data.withTransaction=fn=>original(tx=>fn({query:async(sql,params)=>{
        if(sql.includes('FROM pedidos p')&&sql.includes('FOR UPDATE OF p'))pedidoSeen();return tx.query(sql,params);
      }}));
      pedidoOutcome=service.linkPedido(ctx,separate[2].id,{expected_version:1,pedido_id:pedido.id})
        .then(value=>({ok:true,value}),error=>({ok:false,error}));
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {await Promise.race([pedidoObserved,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('canonical Pedido lock missing')),5000);})]);}
      finally{if(timer)clearTimeout(timer);}
      await cancelPedido.query('COMMIT');const result=await pedidoOutcome;
      assert.equal(result.ok,false);assert.equal(result.error.code,'OPORTUNIDADE_DOCUMENT_REFERENCE_INVALID');
      assert.equal((await service.get(ctx,separate[2].id)).version,1);
    }finally{
      await cancelPedido.query('ROLLBACK');cancelPedido.release();f.data.withTransaction=original;
      if(pedidoOutcome)await pedidoOutcome;
    }
    const legacy=separate[0];await f.admin.query('UPDATE oportunidades SET legacy_store_id=$2,pedido_id=$3 WHERE id=$1',[legacy.id,'oportunidade_store_original','pedido_store_original']);
    const reopened=await service.getByLegacy(ctx,'oportunidade_store_original');assert.equal(reopened.id,legacy.id);assert.equal(reopened.pedido_id,'pedido_store_original');
    assert.equal((await audit.listByEntity('Oportunidade',row.id)).filter(a=>a.action==='create').length,1);
    assert.equal((await audit.listByEntity('Oportunidade',row.id)).filter(a=>a.action==='link').length,2);
    // A code written outside the allocator in A must advance allocation in A2
    // without exposing A's opportunity to the non-bypass role in A2.
    await f.admin.query(`INSERT INTO oportunidades SELECT (jsonb_populate_record(NULL::oportunidades,
      to_jsonb(o)||jsonb_build_object('id',gen_random_uuid(),'codigo','000100','codigo_oportunidade','OPP-000100',
        'idempotency_key','r40-direct-import','legacy_store_id',NULL))).* FROM oportunidades o WHERE id=$1`,[separate[0].id]);
    const cross=await service.create({...ctx,empresaId:ID.empresaA2},{titulo:'Outra empresa',cliente_nome:'Sintético',idempotency_key:'r40-high-water'});
    assert.equal(cross.codigo,'000101');
    await assert.rejects(service.get({...ctx,empresaId:ID.empresaA2},separate[0].id),{code:'OPORTUNIDADE_NOT_FOUND'});
    await proveAtomicCrmPedido(f);
  }finally{await f.close();}
});

if(process.env.DATABASE_URL)test('CRM/Pedido PostgreSQL: real restricted LOGIN executes atomic lifecycle, rollback and retry',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});try {
    const login=(await f.data.query<{same:boolean;super:boolean;bypass:boolean}>(`SELECT session_user=current_user AS same,
      rolsuper AS super,rolbypassrls AS bypass FROM pg_roles WHERE rolname=session_user`)).rows[0];
    assert.deepEqual(login,{same:true,super:false,bypass:false});
    await proveAtomicCrmPedido(f);
  }finally{await f.close();}
});

type CrmAuthHttp={app:ReturnType<typeof createApp>;token:string;verify:(base:string,id:string,input:unknown)=>Promise<void>};

if(process.env.DATABASE_URL)test('CRM/Pedido PostgreSQL: custom backup restores content, IDs, links, permissions and idempotent replay',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});try {
    const proof=await proveAtomicCrmPedido(f);
    await f.admin.query(`UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}','["visualizar","converter-pedido"]'::jsonb) WHERE id=$1`,[proof.ctx.actorId]);
    const highWater=(await f.admin.query<{pedido:number;codigo:number;history:string}>(`SELECT
      (SELECT coalesce(max(numero::int),0) FROM pedidos WHERE empresa_id=$1)::int AS pedido,
      (SELECT coalesce(max(codigo::int),0) FROM oportunidades WHERE group_id=$2)::int AS codigo,
      (SELECT last_value::text FROM pedido_historico_ordem_seq) AS history`,[proof.ctx.empresaId,proof.ctx.groupId])).rows[0];
    await proveCrmFixtureBackup(process.env.DATABASE_URL!,f,async()=>{
      const identity=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
      const gates=await f.data.withTransaction(tx=>inspectCrmPreflight(tx,{...identity,requireRestrictedLogin:true,requirePedidoPersistence:true}));
      assert.equal(gates.ready,true);
      const replay=await proof.service.convertOrcamentoToPedido(proof.ctx,proof.opportunityId,proof.input);
      assert.equal(replay.replayed,true);assert.equal(replay.pedido.id,proof.pedidoId);
    },async()=>{
      const fresh=await proof.prepare();
      assert.equal(Number(fresh.bound.codigo),highWater.codigo+1);
      const counts=()=>f.admin.query(`SELECT (SELECT count(*)::int FROM pedidos) AS orders,
        (SELECT count(*)::int FROM pedido_itens) AS items,(SELECT count(*)::int FROM pedido_historico) AS history,
        (SELECT count(*)::int FROM audit_logs) AS audit`);
      const beforeFailure=(await counts()).rows[0];
      await f.exec(`CREATE FUNCTION crm_restored_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.entity='Pedido' AND NEW.action='create' THEN RAISE EXCEPTION 'synthetic postrestore audit failure'; END IF;
        RETURN NEW; END $$;
        CREATE TRIGGER crm_restored_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_restored_audit_failure();`);
      await assert.rejects(proof.service.convertOrcamentoToPedido(proof.ctx,fresh.bound.id,fresh.input),/synthetic postrestore audit failure/);
      assert.deepEqual((await counts()).rows[0],beforeFailure);
      assert.equal((await proof.service.get(proof.ctx,fresh.bound.id)).version,fresh.bound.version);
      assert.equal((await f.admin.query<{numero:number}>('SELECT coalesce(max(numero::int),0)::int AS numero FROM pedidos WHERE empresa_id=$1',[proof.ctx.empresaId])).rows[0].numero,highWater.pedido);
      await f.exec('DROP TRIGGER crm_restored_audit_failure ON audit_logs; DROP FUNCTION crm_restored_audit_failure();');
      const converted=await Promise.all(Array.from({length:6},()=>proof.service.convertOrcamentoToPedido(proof.ctx,fresh.bound.id,fresh.input)));
      assert.equal(new Set(converted.map(x=>x.pedido.id)).size,1);
      assert.equal(converted.filter(x=>!x.replayed).length,1);
      assert.equal(Number(converted[0].pedido.numero),highWater.pedido+1);
      assert.notEqual(converted[0].pedido.id,proof.pedidoId);
      assert.equal(converted[0].pedido.orcamento_id,fresh.quote.id);
      assert.equal(converted[0].pedido.total,fresh.quote.total);
      const history=(await f.admin.query<{ordem:string}>('SELECT ordem::text FROM pedido_historico WHERE pedido_id=$1',[converted[0].pedido.id])).rows;
      assert.equal(history.length,1);assert.ok(BigInt(history[0].ordem)>BigInt(highWater.history));
      const audit=(await new PostgresAuditRepository(f.admin).listByEntity('Pedido',converted[0].pedido.id)).filter(x=>x.action==='create');
      assert.equal(audit.length,1);
      await assert.rejects(proof.service.get({...proof.ctx,empresaId:ID.empresaA2},fresh.bound.id),{code:'OPORTUNIDADE_NOT_FOUND'});
      assert.equal((await proof.service.get(proof.ctx,proof.opportunityId)).convertido_em_id,proof.pedidoId);
      const restoredQuote=(await proof.prepare()).quote;
      await proveOrcamentoMutationAuthorization(f,proof.app.orcamentoService,proof.app.pedidoService,proof.ctx,restoredQuote);
      await provePedidoMutationAuthorization(f,proof.app.pedidoService,proof.ctx,(await proof.prepare()).quote);
      assert.equal((await proof.service.get(proof.ctx,proof.opportunityId)).convertido_em_id,proof.pedidoId);
    });
  }finally{await f.close();}
});

if(process.env.DATABASE_URL)test('CRM/Pedido PostgreSQL: verified HTTP Auth, separate restricted connections and owner/branch scope',async()=>{
  const f=await realCrmFixture(process.env.DATABASE_URL!,{restrictedLogin:true});
  let auth:Awaited<ReturnType<typeof prepareCrmHttpAuth>>|undefined;
  try{auth=await prepareCrmHttpAuth(f);await proveAtomicCrmPedido({...f,auth:auth.http});}
  finally{try{await auth?.close();}finally{await f.close();}}
});

async function prepareCrmHttpAuth(f:Awaited<ReturnType<typeof realCrmFixture>>) {
  assertCrmIsolatedUrl(process.env.DATABASE_URL);assert(f.data.pool);
  const role=`${f.role}_auth`,owner=randomUUID(),branch=randomUUID(),foreign=randomUUID(),branchProfile=randomUUID();
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let authPool:pg.Pool|undefined,created=false;
  const provider=createServer((req,res)=>{
    const token=req.headers.authorization;
    const id=token==='Bearer synthetic-owner'?owner:token==='Bearer synthetic-branch'?branch:token==='Bearer synthetic-foreign'?foreign:null;
    res.setHeader('Content-Type','application/json');
    if(!id){res.statusCode=401;res.end('{}');return;}
    res.end(JSON.stringify({id,email:'synthetic@example.test'}));
  }).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>provider.once('listening',resolve));
  const close=async()=>{
    await new Promise<void>(resolve=>provider.close(()=>resolve()));
    await authPool?.end();
    try{if(created)await admin.query(`DROP OWNED BY "${role}"; DROP ROLE "${role}"`);}finally{await admin.end();}
  };
  try {
    const password=randomUUID(); // Synthetic, fixture-only; never returned or logged.
    await admin.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);created=true;
    await f.exec(`GRANT USAGE ON SCHEMA "${f.schema}" TO "${role}";${authColumnGrants(role)}`);
    await f.admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2',[owner,ID.runtimeActorA]);
    await f.admin.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2',[foreign,ID.runtimeActorB]);
    await f.admin.query(`INSERT INTO profiles(id,auth_user_id,email,full_name,role,ativo,group_id,empresa_id,permissoes)
      VALUES($1,$2,'synthetic-branch@example.test','Synthetic branch','user',true,$3,$4,$5::jsonb)`,
      [branchProfile,branch,ID.groupA,ID.empresaA,JSON.stringify({CRM:{oportunidades:['visualizar']},Comercial:{pedido:['visualizar']}})]);
    const url=new URL(process.env.DATABASE_URL!);url.username=role;url.password=password;url.searchParams.set('options',`-c search_path=${f.schema},pg_catalog`);
    authPool=new pg.Pool({connectionString:url.toString(),max:2,connectionTimeoutMillis:5000});
    const data=createPoolDbClient(f.data.pool),authDb=createPoolDbClient(authPool);
    const address=provider.address();assert(address&&typeof address!=='string');
    const config=loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',ENABLE_PRODUTO_EMPRESA:'true',
      ERP_AUTH_MODE:'supabase_user',ENABLE_TENANT_CONTEXT:'true',SUPABASE_URL:`http://127.0.0.1:${address.port}`,SUPABASE_ANON_KEY:'synthetic',
      DATABASE_URL:'postgresql://synthetic@localhost/erp_test',AUTH_DATABASE_URL:url.toString()});
    const clients=await createRuntimeDbClients(config,cfg=>({... (cfg.databaseUrl===url.toString()?authDb:data),end:async()=>{}}));
    assert.notEqual(clients.db,clients.authDb);
    assert.equal((await clients.authDb!.query("SELECT has_table_privilege(current_user,'pedidos','INSERT') AS allowed")).rows[0].allowed,false);
    assert.equal((await clients.authDb!.query('SELECT id FROM profiles')).rows.length,0);
    const app=createApp({config,db:clients.db,authDb:clients.authDb,tenantContextEnabled:true});
    const verify=async(base:string,id:string,input:unknown)=>{
      const snapshot=()=>f.admin.query(`SELECT (SELECT count(*)::int FROM pedidos) AS orders,
        (SELECT count(*)::int FROM pedido_itens) AS items,(SELECT count(*)::int FROM pedido_historico) AS history,
        (SELECT version FROM oportunidades WHERE id=$1) AS version`,[id]);
      const before=(await snapshot()).rows[0];
      const actor=(await f.admin.query('SELECT p.created_by FROM pedidos p JOIN oportunidades o ON o.convertido_em_id=p.id::text WHERE o.id=$1',[id])).rows[0];
      assert.equal(actor.created_by,ID.runtimeActorA);assert.notEqual(actor.created_by,owner);
      const headers=(token:string,company:string=ID.empresaA)=>({authorization:`Bearer ${token}`,'x-group-id':ID.groupA,'x-empresa-id':company,'Content-Type':'application/json'});
      const post=(token:string,company=ID.empresaA)=>fetch(`${base}/api/v1/oportunidades/${id}/converter-orcamento-pedido`,{method:'POST',headers:headers(token,company),body:JSON.stringify(input)});
      assert.equal((await post('synthetic-branch')).status,403);
      assert.equal((await post('synthetic-foreign')).status,403);
      assert.equal((await post('invalid')).status,401);
      assert.equal((await fetch(`${base}/api/v1/oportunidades/${id}/converter-orcamento-pedido`,{method:'POST',
        headers:{'x-group-id':ID.groupA,'x-empresa-id':ID.empresaA,'x-actor-id':ID.runtimeActorA,'Content-Type':'application/json'},
        body:JSON.stringify(input)})).status,401);
      assert.equal((await post('synthetic-owner',ID.empresaA2)).status,404);
      assert.equal((await fetch(`${base}/api/v1/oportunidades/${id}`,{headers:headers('synthetic-branch')})).status,200);
      assert.equal((await fetch(`${base}/api/v1/oportunidades/${id}`,{headers:{...headers('synthetic-owner'),'x-actor-id':branchProfile}})).status,403);
      assert.equal((await fetch(`${base}/api/v1/auth/session`,{headers:{authorization:'Bearer synthetic-owner','x-group-id':ID.groupA}})).status,200);
      const branchSession=await fetch(`${base}/api/v1/auth/session`,{headers:{authorization:'Bearer synthetic-branch','x-group-id':ID.groupA}});
      assert.equal(branchSession.status,200); // Bootstrap returns only the user's own authorized profile, not a Group grant.
      const branchProfiles=(await branchSession.json()).data.profiles;
      assert.equal(branchProfiles.length,1);assert.equal(branchProfiles[0].id,branchProfile);
      assert.equal(branchProfiles[0].empresa_id,ID.empresaA);
      assert.deepEqual(branchProfiles[0].empresas.map((company:{id:string})=>company.id),[ID.empresaA]);
      for(const [company,action,allowed] of [[null,'visualizar',false],[ID.empresaA2,'visualizar',false],
        [ID.empresaA,'aprovar',false],[ID.empresaA,'visualizar',true]] as const) {
        const guard={profile_id:branchProfile,group_id:ID.groupA,empresa_id:company,module:'CRM',section:'oportunidades',action};
        const result=await fetch(`${base}/api/v1/auth/session?guard=${encodeURIComponent(JSON.stringify(guard))}`,
          {headers:{authorization:'Bearer synthetic-branch'}});
        assert.equal(result.status,200);assert.equal((await result.json()).data.allowed,allowed);
      }
      assert.equal((await fetch(`${base}/api/v1/oportunidades/${id}/converter-orcamento-pedido`,{method:'POST',
        headers:{authorization:'Bearer synthetic-branch','x-group-id':ID.groupA,'Content-Type':'application/json'},
        body:JSON.stringify(input)})).status,403);
      assert.equal((await post('synthetic-branch',ID.empresaA2)).status,403);
      assert.deepEqual((await snapshot()).rows[0],before);
      assert.equal((await clients.db.query("SELECT NULLIF(current_setting('app.group_id',true),'') AS group_scope")).rows[0].group_scope,null);
      assert.equal((await clients.authDb!.query("SELECT NULLIF(current_setting('app.auth_user_id',true),'') AS auth_scope")).rows[0].auth_scope,null);
    };
    return {http:{app,token:'synthetic-owner',verify},close};
  }catch(error){await close();throw error;}
}

async function proveAtomicCrmPedido(f:{admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string;schema?:string;restrictedLogin?:boolean;auth?:CrmAuthHttp}) {
  const role=f.role??ROLE;
  assert.match(role,/^[a-z][a-z0-9_]+$/);
  const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'crm-atomic-synthetic'};
  const groupTables=['empresas','produtos','unidades_medida','tabelas_preco','tabela_preco_itens','condicoes_pagamento','condicao_pagamento_parcelas','cliente_locais','cliente_local_finalidades','obras','obra_locais'];
  const companyTables=['produto_empresas','tabela_preco_empresas','condicao_pagamento_empresas','pedido_historico','obra_empresas'];
  for(const table of groupTables)await f.exec(`GRANT SELECT ON ${table} TO ${role};
    CREATE POLICY crm_atomic_scope ON ${table} FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
  for(const table of companyTables)await f.exec(`GRANT SELECT ON ${table} TO ${role};
    CREATE POLICY crm_atomic_scope ON ${table} FOR ALL TO ${role}
    USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
    WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)`);
  await f.exec(`GRANT INSERT ON pedidos,pedido_itens,pedido_historico TO ${role};
    GRANT UPDATE(updated_at) ON empresas,produtos,produto_empresas TO ${role};`);
  const identity=(await f.admin.query<{database:string;schema:string}>('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const inspectPersistence=()=>f.data.withTransaction(tx=>inspectCrmPreflight({query:async(sql,params)=>{
    assert.match(sql.trim(),/^SELECT\b/i);return tx.query(sql,params);
  }},{...identity,requirePedidoPersistence:true,requireRestrictedLogin:f.restrictedLogin===true}));
  assert.equal((await inspectPersistence()).ready,true);
  await f.exec(`REVOKE INSERT ON audit_logs FROM ${role}`);
  assert.ok((await inspectPersistence()).blocked.includes('pedidoPersistenceGrants'));
  await f.exec(`GRANT INSERT ON audit_logs TO ${role}`);
  await f.exec('ALTER TABLE pedidos NO FORCE ROW LEVEL SECURITY');
  assert.ok((await inspectPersistence()).blocked.includes('pedidoPersistenceRls'));
  await f.exec('ALTER TABLE pedidos FORCE ROW LEVEL SECURITY');
  await f.exec('GRANT SELECT ON pedido_itens TO PUBLIC');
  assert.ok((await inspectPersistence()).blocked.includes('pedidoPersistenceNoPublicDml'));
  await f.exec('REVOKE SELECT ON pedido_itens FROM PUBLIC');
  assert.equal((await inspectPersistence()).ready,true);
  await f.admin.query('UPDATE produtos SET empresa_id=NULL WHERE id=$1',[ID.produtoA]);
  await f.admin.query(`INSERT INTO produto_empresas(group_id,empresa_id,produto_id,ativo,habilitado_operacao,created_by,updated_by)
    VALUES($1,$2,$3,true,true,$4,$4) ON CONFLICT(group_id,empresa_id,produto_id) DO UPDATE SET ativo=true,habilitado_operacao=true`,[ctx.groupId,ctx.empresaId,ID.produtoA,ctx.actorId]);
  const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',ENABLE_PRODUTO_EMPRESA:'true',DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.admin});
  const service=new OportunidadeService(new PostgresOportunidadeRepository(f.data),new PostgresAuditRepository(f.admin),
    new PostgresTenantGuard(f.admin),new PostgresRbacGuard(f.admin),new PostgresClienteRepository(f.admin),
    new PostgresOrcamentoRepository(f.admin),new PostgresPedidoRepository(f.admin),app.pedidoService);
  const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ID.empresaA])).rows[0].id;
  let n=0;
  const prepare=async()=>{
    const quote=await app.orcamentoService.create(ctx,{cliente_empresa_id:link,condicao_pagamento_id:ID.condicaoPagamentoA,
      validade_em:'2027-01-31T00:00:00.000Z',itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,descricao:'Atomic synthetic',unidade_sigla:'KG',quantidade:'2.000000',preco_unitario:'999.000000',desconto:'0.000000'}]});
    const opportunity=await service.create(ctx,{titulo:'Atomic synthetic',cliente_empresa_id:link,idempotency_key:`atomic-opportunity-${n++}`});
    const bound=await service.linkOrcamento(ctx,opportunity.id,{expected_version:1,orcamento_id:quote.id});
    return {quote,bound,input:{expected_version:bound.version,orcamento_id:quote.id,pedido:{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z'}}};
  };
  const initial=await prepare();
  await proveOrcamentoMutationAuthorization(f,app.orcamentoService,app.pedidoService,ctx,(await prepare()).quote);
  await provePedidoMutationAuthorization(f,app.pedidoService,ctx,(await prepare()).quote);
  await f.admin.query('UPDATE oportunidades SET pedido_id=$2 WHERE id=$1',[initial.bound.id,'synthetic_original_legacy_pedido']);
  const active=new AsyncLocalStorage<boolean>(), originalAdmin=f.admin.query.bind(f.admin), originalTransaction=f.data.withTransaction.bind(f.data);
  let queries=0;
  f.admin.query=((sql,params)=>{if(active.getStore())throw new Error('CRM_ATOMIC_SQL_ESCAPED_EXECUTOR');return originalAdmin(sql,params);}) as DbClient['query'];
  f.data.withTransaction=fn=>originalTransaction(async tx=>{
    const flags=(await tx.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(flags,{rolsuper:false,rolbypassrls:false});
    return active.run(true,()=>fn({query:async(sql,params)=>{queries++;return tx.query(sql,params);}}));
  });
  try{
    const countOrders=async()=>Number((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM pedidos WHERE orcamento_id=$1',[initial.quote.id])).rows[0].n);
    const beforeOrderCount=await countOrders();
    const results=await Promise.all(Array.from({length:6},()=>service.convertOrcamentoToPedido(ctx,initial.bound.id,initial.input)));
    assert.equal(new Set(results.map(result=>result.pedido.id)).size,1);
    assert.equal(results.filter(result=>!result.replayed).length,1);assert.equal(await countOrders(),beforeOrderCount+1);
    assert.equal(results[0].pedido.itens[0].preco_unitario,initial.quote.itens[0].preco_unitario);
    assert.equal(results[0].pedido.orcamento_id,initial.quote.id);assert.equal(results[0].oportunidade.orcamento_id,initial.quote.id);
    assert.equal(results[0].oportunidade.pedido_id,results[0].pedido.id);
    assert.equal(results[0].oportunidade.legacy_pedido_id,'synthetic_original_legacy_pedido');
    assert.equal(results[0].oportunidade.id,initial.bound.id);assert.equal(results[0].oportunidade.codigo,initial.bound.codigo);
    const audit=new PostgresAuditRepository(f.admin);
    assert.equal((await audit.listByEntity('Pedido',results[0].pedido.id)).filter(row=>row.action==='create').length,1);
    assert.equal((await audit.listByEntity('Oportunidade',initial.bound.id)).filter(row=>row.action==='link').length,2);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,initial.bound.id,{...initial.input,pedido:{...initial.input.pedido,observacoes:'divergent'}}),{code:'OPORTUNIDADE_STATE_CONFLICT'});
    await assert.rejects(service.convertOrcamentoToPedido({...ctx,empresaId:ID.empresaA2},initial.bound.id,initial.input),{code:'OPORTUNIDADE_NOT_FOUND'});
    assert.ok(queries>0);
    const rollback=await prepare();
    await assert.rejects(service.convertOrcamentoToPedido(ctx,rollback.bound.id,{...rollback.input,orcamento_id:initial.quote.id}),{code:'OPORTUNIDADE_STATE_CONFLICT'});
    const before=(await f.admin.query<{n:string}>('SELECT coalesce(max(numero::int),0)::text n FROM pedidos WHERE empresa_id=$1',[ctx.empresaId])).rows[0].n;
    const counts=()=>f.admin.query<{items:number;history:number;audit:number}>(`SELECT
      (SELECT count(*)::int FROM pedido_itens) items,(SELECT count(*)::int FROM pedido_historico) history,
      (SELECT count(*)::int FROM audit_logs WHERE entity='Pedido') audit`);
    const beforeCounts=(await counts()).rows[0];
    await f.exec(`CREATE FUNCTION crm_atomic_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity='Oportunidade' AND NEW.action='link' THEN RAISE EXCEPTION 'synthetic atomic audit failure'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER crm_atomic_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_atomic_audit_failure();`);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,rollback.bound.id,rollback.input),/synthetic atomic audit failure/);
    assert.equal((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM pedidos WHERE orcamento_id=$1',[rollback.quote.id])).rows[0].n,0);
    assert.equal((await service.get(ctx,rollback.bound.id)).version,rollback.bound.version);
    assert.equal((await service.get(ctx,rollback.bound.id)).convertido_em,'orcamento');
    assert.equal((await f.admin.query<{n:string}>('SELECT coalesce(max(numero::int),0)::text n FROM pedidos WHERE empresa_id=$1',[ctx.empresaId])).rows[0].n,before);
    assert.deepEqual((await counts()).rows[0],beforeCounts);
    await f.exec('DROP TRIGGER crm_atomic_fail ON audit_logs; DROP FUNCTION crm_atomic_audit_failure();');
    const retried=await service.convertOrcamentoToPedido(ctx,rollback.bound.id,rollback.input);
    assert.equal(Number(retried.pedido.numero),Number(before)+1);
    const uniqueFault=await prepare();
    await f.exec(`CREATE FUNCTION crm_pedido_audit_unique() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity='Pedido' THEN RAISE EXCEPTION 'synthetic audit unique failure' USING ERRCODE='23505',CONSTRAINT='synthetic_audit_unique'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER crm_pedido_unique_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_pedido_audit_unique();`);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,uniqueFault.bound.id,uniqueFault.input),
      (error:any)=>error.code==='23505'&&error.constraint==='synthetic_audit_unique');
    assert.equal((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM pedidos WHERE orcamento_id=$1',[uniqueFault.quote.id])).rows[0].n,0);
    assert.equal((await service.get(ctx,uniqueFault.bound.id)).version,uniqueFault.bound.version);
    await f.exec('DROP TRIGGER crm_pedido_unique_fail ON audit_logs; DROP FUNCTION crm_pedido_audit_unique();');
    const httpDraft=await prepare();
    const httpApp=f.auth?.app??createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',ENABLE_PRODUTO_EMPRESA:'true',DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),
      db:f.data,tenantGuard:new PostgresTenantGuard(f.admin),rbacGuard:new PostgresRbacGuard(f.admin)});
    const server=await new Promise<import('node:http').Server>(resolve=>{const s=httpApp.app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
      const address=server.address() as import('node:net').AddressInfo;
      const base=`http://127.0.0.1:${address.port}`;
      const facade=createHttpApiClient({baseUrl:base,getScope:()=>({groupId:ctx.groupId,empresaId:ctx.empresaId,actorId:ctx.actorId,token:f.auth?.token})}).oportunidades;
      const converted=await facade.convertOrcamentoToPedido(httpDraft.bound.id,httpDraft.input);
      assert.equal(converted.pedido.orcamento_id,httpDraft.quote.id);assert.equal(converted.replayed,false);
      assert.equal((await facade.convertOrcamentoToPedido(httpDraft.bound.id,httpDraft.input)).pedido.id,converted.pedido.id);
      if(f.auth)await f.auth.verify(base,httpDraft.bound.id,httpDraft.input);
      await assert.rejects(facade.convertOrcamentoToPedido(httpDraft.bound.id,{...httpDraft.input,actorId:ID.runtimeActorB}),(error:any)=>error.status===422);
      const delivery=await prepare();
      const deliveryInput={...delivery.input,pedido:{...delivery.input.pedido,tipo_operacao:'ENTREGA',cliente_local_id:ID.clienteLocalA,obra_id:ID.obraA}};
      await assert.rejects(facade.convertOrcamentoToPedido(delivery.bound.id,{...deliveryInput,pedido:{...deliveryInput.pedido,cliente_local_id:ID.clienteLocalB1}}),(error:any)=>error.status===422);
      const delivered=await facade.convertOrcamentoToPedido(delivery.bound.id,deliveryInput);
      assert.equal(delivered.pedido.tipo_operacao,'ENTREGA');assert.equal(delivered.pedido.cliente_local_id,ID.clienteLocalA);assert.equal(delivered.pedido.obra_id,ID.obraA);
    }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
    const inactive=await prepare();
    await f.admin.query("UPDATE orcamentos SET ativo=false,status='CANCELADO' WHERE id=$1",[inactive.quote.id]);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,inactive.bound.id,inactive.input),{code:'ORCAMENTO_STATE_CONFLICT'});
    assert.equal((await service.get(ctx,inactive.bound.id)).version,inactive.bound.version);
    if(f.admin.pool && f.schema){
      const cancelled=await prepare(),client=await f.admin.pool.connect();
      let seen!:()=>void;const blocked=new Promise<void>(resolve=>{seen=resolve;});
      const prior=f.data.withTransaction;
      let outcome:Promise<any>|undefined;
      try{
        await client.query('BEGIN');await client.query(`SET LOCAL search_path TO "${f.schema}",pg_catalog`);
        await client.query("UPDATE orcamentos SET status='CANCELADO',ativo=false WHERE id=$1",[cancelled.quote.id]);
        f.data.withTransaction=fn=>prior(tx=>fn({query:async(sql,params)=>{
          if(sql.includes('FROM orcamentos')&&sql.includes('FOR UPDATE'))seen();return tx!.query(sql,params);
        }}));
        outcome=service.convertOrcamentoToPedido(ctx,cancelled.bound.id,cancelled.input).then(value=>({value}),error=>({error}));
        let timer:ReturnType<typeof setTimeout>|undefined;
        try{await Promise.race([blocked,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('atomic quotation lock missing')),5000);})]);}
        finally{if(timer)clearTimeout(timer);}
        await client.query('COMMIT');assert.equal((await outcome).error.code,'ORCAMENTO_STATE_CONFLICT');
        assert.equal((await service.get(ctx,cancelled.bound.id)).version,cancelled.bound.version);
        assert.equal((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM pedidos WHERE orcamento_id=$1',[cancelled.quote.id])).rows[0].n,0);
      }finally{await client.query('ROLLBACK');client.release();f.data.withTransaction=prior;if(outcome)await outcome;}
    }
    const unavailable=await prepare();
    await f.admin.query('UPDATE produto_empresas SET habilitado_operacao=false WHERE produto_id=$1 AND empresa_id=$2',[ID.produtoA,ctx.empresaId]);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,unavailable.bound.id,unavailable.input),{code:'PEDIDO_PRODUTO_INVALIDO'});
    assert.equal((await f.admin.query<{n:number}>('SELECT count(*)::int n FROM pedidos WHERE orcamento_id=$1',[unavailable.quote.id])).rows[0].n,0);
    await f.admin.query('UPDATE produto_empresas SET habilitado_operacao=true WHERE produto_id=$1 AND empresa_id=$2',[ID.produtoA,ctx.empresaId]);
    await f.admin.query('UPDATE profiles SET empresa_id=$2 WHERE id=$1',[ctx.actorId,ctx.empresaId]);
    await assert.rejects(service.convertOrcamentoToPedido({...ctx,empresaId:ID.empresaA2},initial.bound.id,initial.input),{code:'PERMISSION_DENIED'});
    assert.equal((await service.convertOrcamentoToPedido(ctx,initial.bound.id,initial.input)).replayed,true);
    await f.admin.query('UPDATE profiles SET empresa_id=NULL WHERE id=$1',[ctx.actorId]);
    await f.admin.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}','[\"visualizar\"]'::jsonb) WHERE id=$1",[ctx.actorId]);
    await assert.rejects(service.convertOrcamentoToPedido(ctx,unavailable.bound.id,unavailable.input),{code:'PERMISSION_DENIED'});
    return {ctx,service,app,prepare,opportunityId:initial.bound.id,input:initial.input,pedidoId:results[0].pedido.id};
  }finally{f.admin.query=originalAdmin;f.data.withTransaction=originalTransaction;}
}

test('CRM→Pedido: executor compartilhado, rollback, retry, preço snapshot e empresa/RBAC persistidos',async()=>{
  const f=await localCrmFixture();try{await proveAtomicCrmPedido(f);}finally{await f.close();}
});

async function proveOrcamentoMutationAuthorization(f:any,service:any,pedido:any,ctx:any,quote:any){
  const role=f.role??ROLE;
  await f.exec(`GRANT UPDATE ON pedidos TO ${role};GRANT DELETE ON pedido_itens TO ${role};GRANT INSERT,UPDATE ON orcamentos TO ${role};GRANT INSERT,DELETE ON orcamento_itens TO ${role}`);
  const identity=(await f.admin.query('SELECT current_database() AS database,current_schema() AS schema')).rows[0];
  const preflight=()=>f.data.withTransaction((tx:any)=>inspectCrmPreflight(tx,{...identity,requireOrcamentoPersistence:true,requireRestrictedLogin:f.restrictedLogin===true}));
  assert.equal((await preflight()).ready,true);
  await f.exec(`REVOKE INSERT ON orcamentos FROM ${role}`);assert.ok((await preflight()).blocked.includes('orcamentoPedidoPersistenceGrants'));
  await f.exec(`GRANT INSERT ON orcamentos TO ${role};REVOKE DELETE ON orcamento_itens FROM ${role}`);assert.ok((await preflight()).blocked.includes('orcamentoPedidoPersistenceGrants'));
  await f.exec(`GRANT DELETE ON orcamento_itens TO ${role}`);
  assert.equal((await preflight()).ready,true);
  const adminQuery=f.admin.query.bind(f.admin),inside=new AsyncLocalStorage<boolean>();
  const permissions=(await adminQuery('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  const enable=()=>adminQuery("UPDATE profiles SET permissoes=jsonb_set(jsonb_set(permissoes,'{Comercial,orcamento}',$2::jsonb),'{Comercial,pedido}',$3::jsonb) WHERE id=$1",[ctx.actorId,JSON.stringify(['visualizar','criar','editar','cancelar','aprovar']),JSON.stringify(['visualizar','criar','editar','cancelar','alterar-status','converter-pedido','aprovar'])]);
  const repo=service.repo,original=repo.withTransaction.bind(repo),pedidoRepo=pedido.repo,pedidoTx=pedidoRepo.withTransaction.bind(pedidoRepo);
  const data={cliente_empresa_id:quote.cliente_empresa_id,condicao_pagamento_id:quote.condicao_pagamento_id,validade_em:'2027-01-31T00:00:00.000Z',
    itens:quote.itens.map((item:any)=>({produto_id:item.produto_id,unidade_id:item.unidade_id,descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,preco_unitario:'9999',desconto:'0'}))};
  const state=async()=>({quotes:(await adminQuery('SELECT row_to_json(q)::text value FROM orcamentos q ORDER BY id')).rows,
    items:(await adminQuery('SELECT row_to_json(q)::text value FROM orcamento_itens q ORDER BY id')).rows,
    audit:(await adminQuery('SELECT row_to_json(q)::text value FROM audit_logs q ORDER BY id')).rows,
    seq:(await adminQuery('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name')).rows});
  try{
    await enable();repo.withTransaction=(fn:any)=>f.data.withTransaction(fn);
    const created=await service.create(ctx,data);assert.notEqual(created.itens[0].preco_unitario,'9999.000000');
    for(const action of ['criar','editar','cancelar']){
      await enable();const before=await state();
      repo.withTransaction=async(fn:any)=>{
        await adminQuery("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,orcamento}',$2::jsonb) WHERE id=$1",[ctx.actorId,JSON.stringify(['visualizar'])]);
        return f.data.withTransaction((tx:any)=>inside.run(true,()=>fn(tx)));
      };
      f.admin.query=((sql:any,args:any)=>{if(inside.getStore())throw Error('ORCAMENTO_SQL_ESCAPED_EXECUTOR');return adminQuery(sql,args);});
      await assert.rejects(action==='criar'?service.create(ctx,data):action==='editar'?service.update(ctx,created.id,data):service.cancel(ctx,created.id),{code:'PERMISSION_DENIED'});
      assert.deepEqual(await state(),before);f.admin.query=adminQuery;
    }
    await enable();repo.withTransaction=(fn:any)=>f.data.withTransaction((tx:any)=>inside.run(true,()=>fn(tx)));
    f.admin.query=((sql:any,args:any)=>{if(inside.getStore())throw Error('ORCAMENTO_SQL_ESCAPED_EXECUTOR');return adminQuery(sql,args);});
    await f.exec(`CREATE FUNCTION crm_quote_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity='Orcamento' THEN RAISE EXCEPTION 'synthetic quote audit failure'; END IF;
      RETURN NEW; END $$; CREATE TRIGGER crm_quote_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE crm_quote_audit_failure();`);
    f.admin.query=adminQuery;
    for(const operation of [()=>service.create(ctx,data),()=>service.update(ctx,created.id,data),()=>service.cancel(ctx,created.id)]){
      const before=await state();await assert.rejects(operation(),/synthetic quote audit failure/);assert.deepEqual(await state(),before);
    }
    await f.exec('DROP TRIGGER crm_quote_audit_fail ON audit_logs; DROP FUNCTION crm_quote_audit_failure();');
    f.admin.query=((sql:any,args:any)=>{if(inside.getStore())throw Error('ORCAMENTO_SQL_ESCAPED_EXECUTOR');return adminQuery(sql,args);});
    const edited=await service.update(ctx,created.id,data);assert.equal(edited.numero,created.numero);
    f.admin.query=adminQuery;pedidoRepo.withTransaction=(fn:any)=>f.data.withTransaction(fn);
    const options={tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-02-15T00:00:00.000Z'};
    const order=await pedido.convert(ctx,edited.id,options);assert.equal(order.total,edited.total);assert.equal(order.itens[0].preco_unitario,edited.itens[0].preco_unitario);
    await assert.rejects(pedido.convert(ctx,edited.id,options),{code:'ORCAMENTO_ALREADY_CONVERTED'});
    const orderData={cliente_empresa_id:edited.cliente_empresa_id,condicao_pagamento_id:edited.condicao_pagamento_id,orcamento_id:edited.id,...options,
      itens:edited.itens.map((item:any)=>({produto_id:item.produto_id,unidade_id:item.unidade_id,descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,preco_unitario:item.preco_unitario,desconto:item.desconto,requer_producao:false}))};
    await pedido.update(ctx,order.id,orderData);await pedido.transition(ctx,order.id,'PRONTO_RETIRADA');await assert.rejects(pedido.cancel(ctx,order.id,'Synthetic integrated cancellation'),{code:'PEDIDO_STATE_CONFLICT'});await pedido.transition(ctx,order.id,'FINALIZADO');
    assert.equal((await pedido.get(ctx,order.id)).status,'FINALIZADO');assert.equal((await pedido.history(ctx,order.id)).length,3);
    const cancellation=await service.create(ctx,data);await service.cancel(ctx,cancellation.id);assert.equal((await service.get(ctx,cancellation.id)).status,'CANCELADO');
  }finally{f.admin.query=adminQuery;repo.withTransaction=original;pedidoRepo.withTransaction=pedidoTx;
    await adminQuery('UPDATE profiles SET permissoes=$2::jsonb WHERE id=$1',[ctx.actorId,JSON.stringify(permissions)]);}
}

async function provePedidoMutationAuthorization(f:any,pedido:any,ctx:any,quote:any){
  const role=f.role??ROLE;
  await f.exec(`GRANT UPDATE ON pedidos TO ${role};GRANT DELETE ON pedido_itens TO ${role}`);
  const permissions=(await f.admin.query('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  const enable=()=>f.admin.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}',$2::jsonb) WHERE id=$1",[ctx.actorId,JSON.stringify(['visualizar','criar','editar','cancelar','alterar-status','converter-pedido','aprovar'])]);
  const repo=pedido.repo,original=repo.withTransaction.bind(repo);
  const adminQuery=f.admin.query.bind(f.admin),inside=new AsyncLocalStorage<boolean>();
  const data={cliente_empresa_id:quote.cliente_empresa_id,condicao_pagamento_id:quote.condicao_pagamento_id,
    tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z',itens:quote.itens.map((item:any)=>({produto_id:item.produto_id,unidade_id:item.unidade_id,descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,preco_unitario:item.preco_unitario,desconto:item.desconto,requer_producao:false}))};
  const state=async()=>({orders:(await adminQuery('SELECT row_to_json(p)::text value FROM pedidos p ORDER BY id')).rows,
    items:(await adminQuery('SELECT row_to_json(p)::text value FROM pedido_itens p ORDER BY id')).rows,
    history:(await adminQuery('SELECT row_to_json(p)::text value FROM pedido_historico p ORDER BY id')).rows,
    audit:(await adminQuery('SELECT row_to_json(p)::text value FROM audit_logs p ORDER BY id')).rows,
    sequence:(await adminQuery('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name')).rows});
  try{
    await enable();repo.withTransaction=(fn:any)=>f.data.withTransaction(fn);
    const order=await pedido.convert(ctx,quote.id,{tipo_operacao:data.tipo_operacao,data_entrega_solicitada:data.data_entrega_solicitada});
    const editData={...data,orcamento_id:order.orcamento_id};
    for(const action of ['criar','editar','alterar-status','cancelar','converter-pedido']){
      await enable();const before=await state();
      repo.withTransaction=async(fn:any)=>{
        await adminQuery("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}','[\"visualizar\"]'::jsonb) WHERE id=$1",[ctx.actorId]);
        return f.data.withTransaction((tx:any)=>inside.run(true,()=>fn(tx)));
      };
      f.admin.query=((sql:any,args:any)=>{if(inside.getStore())throw Error('PEDIDO_SQL_ESCAPED_EXECUTOR');return adminQuery(sql,args);});
      const run=()=>action==='criar'?pedido.create(ctx,data):action==='editar'?pedido.update(ctx,order.id,editData):action==='alterar-status'?pedido.transition(ctx,order.id,'PRONTO_RETIRADA'):action==='cancelar'?pedido.cancel(ctx,order.id,'Synthetic revoked'):pedido.convert(ctx,quote.id,{tipo_operacao:data.tipo_operacao,data_entrega_solicitada:data.data_entrega_solicitada});
      await assert.rejects(run,{code:'PERMISSION_DENIED'});assert.deepEqual(await state(),before);
      f.admin.query=adminQuery;
    }
    await enable();repo.withTransaction=(fn:any)=>f.data.withTransaction(fn);
    await pedido.update(ctx,order.id,editData);
    await pedido.transition(ctx,order.id,'PRONTO_RETIRADA');await pedido.transition(ctx,order.id,'FINALIZADO');
    assert.equal((await pedido.get(ctx,order.id)).status,'FINALIZADO');
    const directOrder=await pedido.create(ctx,data);
    const cancelled=await pedido.cancel(ctx,directOrder.id,'Synthetic authorized cancellation');
    assert.equal(cancelled.status,'CANCELADO');assert.equal(cancelled.numero,directOrder.numero);
  }finally{f.admin.query=adminQuery;repo.withTransaction=original;
    await adminQuery('UPDATE profiles SET permissoes=$2::jsonb WHERE id=$1',[ctx.actorId,JSON.stringify(permissions)]);}
}

async function proveCentralCrm(db:DbClient,app:ReturnType<typeof createApp>,ctx:RequestContext,service:OportunidadeService) {
  // Existing canonical repository executes CRM reads with NOSUPERUSER/NOBYPASSRLS
  // fixture role. This proves isolated RLS, not an operational LOGIN/grant.
  const central=new ClienteCentral360Service(app.clienteService,app.orcamentoService,app.pedidoService,
    app.clienteLocalService,app.obraService,app.rbacGuard,service);
  const caller={...ctx},options={crmLimit:2,crmOffset:0},getLink=app.clienteService.getEmpresaLink.bind(app.clienteService);
  app.clienteService.getEmpresaLink=async(...args:any[])=>{
    const row=await(getLink as any)(...args);caller.groupId=ID.groupB;caller.empresaId=ID.empresaB;caller.actorId=ID.runtimeActorB;caller.requestId='changed';options.crmLimit=99;return row;
  };
  try{
    const captured=await central.get(caller,ID.clientePjA,options);
    assert.equal(captured.meta.groupId,ctx.groupId);assert.equal(captured.meta.empresaId,ctx.empresaId);assert.equal(captured.meta.requestId,ctx.requestId);
    assert.equal(captured.blocks.crm.status,'ok');assert.equal(captured.blocks.crm.meta?.limit,2);assert.equal(captured.blocks.crm.data.length,2);
  }finally{app.clienteService.getEmpresaLink=getLink;}
  const page=await central.get(ctx,ID.clientePjA,{crmLimit:2,crmOffset:0});
  assert.equal(page.blocks.crm.status,'ok');assert.equal(page.blocks.crm.meta?.total,9);
  assert.equal(page.blocks.crm.data.length,2);assert.equal(page.blocks.crm.meta?.hasMore,true);
  const secondPage=await central.get(ctx,ID.clientePjA,{crmLimit:2,crmOffset:2});
  assert.notEqual(page.blocks.crm.data[0].id,secondPage.blocks.crm.data[0].id);
  for(const item of page.blocks.crm.data)for(const field of ['cliente_email','cliente_telefone','observacoes','idempotency_key'])
    assert.equal(Object.hasOwn(item,field),false);
  assert.equal((await app.clienteCentral360Service.get(ctx,ID.clientePjA,{crmLimit:1})).blocks.crm.meta?.total,9);
  const permissions=(await db.query<{permissoes:unknown}>('SELECT permissoes FROM profiles WHERE id=$1',[ctx.actorId])).rows[0].permissoes;
  try{
    await db.query("UPDATE profiles SET permissoes=permissoes-'CRM' WHERE id=$1",[ctx.actorId]);
    const denied=await central.get(ctx,ID.clientePjA);
    assert.equal(denied.blocks.crm.status,'forbidden');assert.deepEqual(denied.blocks.crm.data,[]);assert.equal(denied.blocks.crm.meta,null);
  }finally{await db.query('UPDATE profiles SET permissoes=$2::jsonb WHERE id=$1',[ctx.actorId,JSON.stringify(permissions)]);}

}

test('Central CRM composição persistida: paginação, projeção e RBAC com repositório canônico restrito',async()=>{
  const f=await localCrmFixture();
  try {
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'central-crm-synthetic'};
    const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),db:f.admin});
    const service=new OportunidadeService(new PostgresOportunidadeRepository(f.data),new PostgresAuditRepository(f.admin),
      new PostgresTenantGuard(f.admin),new PostgresRbacGuard(f.admin),new PostgresClienteRepository(f.admin),
      new PostgresOrcamentoRepository(f.admin),new PostgresPedidoRepository(f.admin));
    const link=(await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE cliente_id=$1 AND empresa_id=$2',[ID.clientePjA,ID.empresaA])).rows[0].id;
    for(let i=0;i<9;i++)await service.create(ctx,{titulo:`Central ${i}`,cliente_empresa_id:link,idempotency_key:`central-${i}`});
    await proveCentralCrm(f.admin,app,ctx,service);
  }finally{await f.close();}
});
