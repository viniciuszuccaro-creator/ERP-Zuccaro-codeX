import assert from 'node:assert/strict';
import test from 'node:test';
import {produtoEmpresaFixture} from './helpers/produtoEmpresaFixture.ts';
import {assertCrmIsolatedUrl} from './helpers/crmPostgresFixture.ts';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config/env.ts';

test('R41 ProdutoEmpresa: destino isolado obrigatório antes de conectar',()=>{
  assert.throws(()=>assertCrmIsolatedUrl(undefined));
  assert.throws(()=>assertCrmIsolatedUrl('postgresql://synthetic@example.invalid/erp_test'));
});
if(process.env.DATABASE_URL)test('R41 PostgreSQL real: Produto Grupo→Empresa→Orçamento→Pedido, autorização/concorrência/snapshot/RLS',async()=>{
  const f=await produtoEmpresaFixture(process.env.DATABASE_URL);try {
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'r41-synthetic'};
    await f.admin.query('UPDATE produtos SET empresa_id=NULL WHERE id=$1',[ID.produtoA]);
    const app=createApp({config:loadConfig({NODE_ENV:'test',ERP_ENV:'dev',REQUIRE_DATABASE:'false',DATABASE_URL:process.env.DATABASE_URL,
      ENABLE_PRODUTO_EMPRESA:'true'}),db:f.admin});
    const ce=await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo AND habilitado_operacao AND NOT bloqueado LIMIT 1',[ctx.groupId,ctx.empresaId]);
    const data={cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,validade_em:'2027-01-31T00:00:00.000Z',
      itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,descricao:'Mestre sintético',unidade_sigla:'KG',quantidade:'2.000000',preco_unitario:'999.000000',desconto:'0.000000'}]};
    await assert.rejects(app.orcamentoService.create(ctx,data),{code:'ORCAMENTO_PRODUTO_INVALIDO'});
    const links=await Promise.all(Array.from({length:6},()=>f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:true,expected_version:0})));
    assert.equal(new Set(links.map(r=>r.id)).size,1);assert.ok(links.every(r=>r.version===1));
    const quote=await app.orcamentoService.create(ctx,data);assert.notEqual(quote.itens[0].preco_unitario,'999.000000');
    const order=await app.pedidoService.convert(ctx,quote.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z'});
    assert.equal(order.itens[0].produto_id,ID.produtoA);assert.equal(order.itens[0].preco_unitario,quote.itens[0].preco_unitario);
    const snapshot={price:order.itens[0].preco_unitario,description:order.itens[0].descricao,unit:order.itens[0].unidade_sigla};
    await f.data.withTransaction(async tx=>{
      const role=await tx.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.equal(role.rows[0].rolsuper,false);assert.equal(role.rows[0].rolbypassrls,false);
      assert.equal(await f.repo.getForOperation({...ctx,empresaId:ID.empresaA2},ID.produtoA,tx),null);
      assert.equal((await tx.query('SELECT id FROM produto_empresas')).rows.length,0);
      assert.equal((await tx.query('UPDATE produto_empresas SET habilitado_operacao=false RETURNING id')).rows.length,0);
    });
    // Hold the real sale after reference/price validation, before its INSERT.
    const originalAdmin=f.admin.withTransaction.bind(f.admin),originalData=f.data.withTransaction.bind(f.data);
    let release!:()=>void,seenSale!:()=>void,seenRevocation!:()=>void;
    const held=new Promise<void>(resolve=>{release=resolve;}),saleSeen=new Promise<void>(resolve=>{seenSale=resolve;}),revocationSeen=new Promise<void>(resolve=>{seenRevocation=resolve;});
    const wait=async(p:Promise<void>)=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('R41 shared lock not observed')),5000);})]);}finally{if(timer)clearTimeout(timer);}};
    let sale:Promise<any>|undefined,revoke:Promise<any>|undefined;
    try {
      f.admin.withTransaction=fn=>originalAdmin(tx=>fn({query:async(sql,params)=>{
        if(/INSERT INTO orcamentos\b/.test(sql)){seenSale();await held;}return tx.query(sql,params);
      }}));
      sale=app.orcamentoService.create(ctx,data).then(value=>({ok:true,value}),error=>({ok:false,error}));
      await wait(saleSeen);
      f.data.withTransaction=fn=>originalData(tx=>fn({query:async(sql,params)=>{
        if(sql.includes('FROM produtos')&&sql.includes('FOR UPDATE'))seenRevocation();return tx.query(sql,params);
      }}));
      let completed=false;
      revoke=f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:false,habilitado_operacao:false,expected_version:1})
        .then(value=>{completed=true;return {ok:true,value};},error=>({ok:false,error}));
      await wait(revocationSeen);assert.equal(completed,false);release();
      assert.equal((await sale).ok,true);assert.equal((await revoke).ok,true);
    }finally{release();f.admin.withTransaction=originalAdmin;f.data.withTransaction=originalData;if(sale)await sale;if(revoke)await revoke;}
    await assert.rejects(app.orcamentoService.create(ctx,data),{code:'ORCAMENTO_PRODUTO_INVALIDO'});
    await assert.rejects(app.pedidoService.create(ctx,{cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,
      tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z',itens:data.itens.map(i=>({...i,requer_producao:false}))}),{code:'PEDIDO_PRODUTO_INVALIDO'});
    const unchanged=await app.pedidoService.get(ctx,order.id);
    assert.deepEqual({price:unchanged.itens[0].preco_unitario,description:unchanged.itens[0].descricao,unit:unchanged.itens[0].unidade_sigla},snapshot);
    assert.equal((await app.orcamentoService.get(ctx,quote.id)).itens[0].preco_unitario,quote.itens[0].preco_unitario);
    assert.equal((await f.admin.query('SELECT count(*)::int AS n FROM produto_empresas WHERE group_id=$1',[ctx.groupId])).rows[0].n,1);
  }finally{await f.close();}
});
