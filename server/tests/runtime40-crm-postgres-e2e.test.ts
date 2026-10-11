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
import { assertCrmIsolatedUrl, realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DbClient } from '../src/db/client.ts';
import type { RequestContext } from '../src/audit/types.ts';
import { createHttpApiClient } from '../../src/api/httpApiClient.js';
import { inspectCrmPreflight } from '../src/db/crmPreflight.ts';

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

async function proveAtomicCrmPedido(f:{admin:DbClient;data:DbClient;exec:(sql:string)=>Promise<unknown>;role?:string;schema?:string}) {
  const role=f.role??ROLE;
  assert.match(role,/^[a-z][a-z0-9_]+$/);
  const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'crm-atomic-synthetic'};
  const groupTables=['empresas','produtos','unidades_medida','tabelas_preco','condicoes_pagamento','condicao_pagamento_parcelas','cliente_locais','cliente_local_finalidades','obras','obra_locais'];
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
    const httpApp=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',ENABLE_CRM_HTTP:'true',ENABLE_PRODUTO_EMPRESA:'true',DATABASE_URL:'postgresql://synthetic@localhost/erp_test'}),
      db:f.data,tenantGuard:new PostgresTenantGuard(f.admin),rbacGuard:new PostgresRbacGuard(f.admin)});
    const server=await new Promise<import('node:http').Server>(resolve=>{const s=httpApp.app.listen(0,'127.0.0.1',()=>resolve(s));});
    try {
      const address=server.address() as import('node:net').AddressInfo;
      const facade=createHttpApiClient({baseUrl:`http://127.0.0.1:${address.port}`,getScope:()=>({groupId:ctx.groupId,empresaId:ctx.empresaId,actorId:ctx.actorId})}).oportunidades;
      const converted=await facade.convertOrcamentoToPedido(httpDraft.bound.id,httpDraft.input);
      assert.equal(converted.pedido.orcamento_id,httpDraft.quote.id);assert.equal(converted.replayed,false);
      assert.equal((await facade.convertOrcamentoToPedido(httpDraft.bound.id,httpDraft.input)).pedido.id,converted.pedido.id);
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
  }finally{f.admin.query=originalAdmin;f.data.withTransaction=originalTransaction;}
}

test('CRM→Pedido: executor compartilhado, rollback, retry, preço snapshot e empresa/RBAC persistidos',async()=>{
  const f=await localCrmFixture();try{await proveAtomicCrmPedido(f);}finally{await f.close();}
});

async function proveCentralCrm(db:DbClient,app:ReturnType<typeof createApp>,ctx:RequestContext,service:OportunidadeService) {
  // Existing canonical repository executes CRM reads with NOSUPERUSER/NOBYPASSRLS
  // fixture role. This proves isolated RLS, not an operational LOGIN/grant.
  const central=new ClienteCentral360Service(app.clienteService,app.orcamentoService,app.pedidoService,
    app.clienteLocalService,app.obraService,app.rbacGuard,service);
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
