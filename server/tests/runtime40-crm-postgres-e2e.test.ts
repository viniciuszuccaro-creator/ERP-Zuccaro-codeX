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
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { assertCrmIsolatedUrl, realCrmFixture } from './helpers/crmPostgresFixture.ts';
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
    const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',DATABASE_URL:process.env.DATABASE_URL}),db:f.admin});
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
  }finally{await f.close();}
});
