import assert from 'node:assert/strict';
import test from 'node:test';
import {produtoEmpresaFixture} from './helpers/produtoEmpresaFixture.ts';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';
import {PostgresOrcamentoRepository} from '../src/repositories/postgresOrcamentoRepository.ts';
import {PostgresPedidoRepository} from '../src/repositories/postgresPedidoRepository.ts';

test('Produto mestre→Empresa: habilitação explícita, replay/CAS/audit rollback/RLS e legado preservado',async()=>{
  const f=await produtoEmpresaFixture();try {
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'produto-empresa-synthetic'};
    await f.admin.query('UPDATE produtos SET empresa_id=NULL WHERE id=$1',[ID.produtoA]);
    const ce=await f.admin.query<{id:string}>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo AND habilitado_operacao AND NOT bloqueado LIMIT 1',[ctx.groupId,ctx.empresaId]);
    const quotes=new PostgresOrcamentoRepository(f.admin),orders=new PostgresPedidoRepository(f.admin);
    const quoteData={cliente_empresa_id:ce.rows[0].id,condicao_pagamento_id:ID.condicaoPagamentoA,validade_em:'2027-01-31T00:00:00.000Z',
      itens:[{produto_id:ID.produtoA,unidade_id:ID.unidadeA,descricao:'Guard sintético',unidade_sigla:'KG',quantidade:'1.000000',preco_unitario:'25.500000',desconto:'0.000000'}]};
    await assert.rejects(quotes.create(ctx,quoteData),/TENANT_FK_MISMATCH/);
    const lookup=(scope=ctx)=>f.data.withTransaction(tx=>f.repo.getForOperation(scope,ID.produtoA,tx));
    assert.equal(await lookup(),null);
    const enabled=await f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:true,expected_version:0});
    assert.equal(enabled.version,1);assert.equal((await lookup())?.id,ID.produtoA);
    const quote=await quotes.create(ctx,quoteData);
    const order=await orders.create(ctx,{...quoteData,orcamento_id:quote.id,tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-01-31T00:00:00.000Z',
      itens:quoteData.itens.map(i=>({...i,requer_producao:false}))},ctx.actorId);
    assert.equal(order.itens[0].produto_id,ID.produtoA);
    await assert.rejects(quotes.create(ctx,{...quoteData,itens:quoteData.itens.map(i=>({...i,unidade_id:ID.unidadeB}))}),/TENANT_FK_MISMATCH/);
    assert.equal((await f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:true,expected_version:0})).id,enabled.id);
    assert.equal(await lookup({...ctx,empresaId:ID.empresaA2}),null);
    assert.equal(await f.data.withTransaction(async tx=>{await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[ID.groupA,ID.empresaA2]);return (await tx.query('SELECT id FROM produto_empresas')).rows.length;}),0);
    await assert.rejects(f.service.habilitarEmpresa(ctx,ID.produtoB,{ativo:true,habilitado_operacao:true,expected_version:0}),{code:'PRODUTO_MESTRE_REQUIRED'});
    await assert.rejects(f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:false,expected_version:0}),{code:'PRODUTO_EMPRESA_VERSION_CONFLICT'});
    await assert.rejects(f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:true,expected_version:1,empresa_id:ID.empresaA2}),{code:'VALIDATION_ERROR'});
    await f.exec(`CREATE FUNCTION produto_empresa_audit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.entity='ProdutoEmpresa' THEN RAISE EXCEPTION 'synthetic link audit failure'; END IF;RETURN NEW;END $$;
      CREATE TRIGGER produto_empresa_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE PROCEDURE produto_empresa_audit_failure();`);
    await assert.rejects(f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:false,habilitado_operacao:false,expected_version:1}),/synthetic link audit failure/);
    assert.equal((await lookup())?.id,ID.produtoA);
    await f.exec('DROP TRIGGER produto_empresa_audit_failure ON audit_logs;DROP FUNCTION produto_empresa_audit_failure();');
    const disabled=await f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:false,habilitado_operacao:false,expected_version:1});
    assert.equal(disabled.id,enabled.id);assert.equal(disabled.version,2);assert.equal(await lookup(),null);
    await assert.rejects(quotes.create(ctx,quoteData),/TENANT_FK_MISMATCH/);
    assert.equal((await quotes.get(ctx,quote.id))!.itens[0].preco_unitario,quote.itens[0].preco_unitario);
    assert.equal((await orders.get(ctx,order.id))!.itens[0].preco_unitario,order.itens[0].preco_unitario);
    assert.equal((await f.admin.query('SELECT codigo FROM produtos WHERE id=$1',[ID.produtoA])).rows[0].codigo!==null,true);
    // The ordinary master-data get remains company-scoped, even when habilitated.
    assert.equal(await f.repo.getById(ctx,ID.produtoA),null);
    const off=new PostgresProdutoRepository(f.admin);assert.equal(await off.getForOperation(ctx,ID.produtoA),null);
  }finally{await f.close();}
});
