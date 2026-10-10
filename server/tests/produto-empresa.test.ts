import assert from 'node:assert/strict';
import test from 'node:test';
import {produtoEmpresaFixture} from './helpers/produtoEmpresaFixture.ts';
import {SEED_IDS as ID} from '../scripts/seedDevIds.ts';
import {PostgresProdutoRepository} from '../src/repositories/postgresProdutoRepository.ts';

test('Produto mestre→Empresa: habilitação explícita, replay/CAS/audit rollback/RLS e legado preservado',async()=>{
  const f=await produtoEmpresaFixture();try {
    const ctx={groupId:ID.groupA,empresaId:ID.empresaA,actorId:ID.runtimeActorA,requestId:'produto-empresa-synthetic'};
    await f.admin.query('UPDATE produtos SET empresa_id=NULL WHERE id=$1',[ID.produtoA]);
    const lookup=(scope=ctx)=>f.data.withTransaction(tx=>f.repo.getForOperation(scope,ID.produtoA,tx));
    assert.equal(await lookup(),null);
    const enabled=await f.service.habilitarEmpresa(ctx,ID.produtoA,{ativo:true,habilitado_operacao:true,expected_version:0});
    assert.equal(enabled.version,1);assert.equal((await lookup())?.id,ID.produtoA);
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
    assert.equal((await f.admin.query('SELECT codigo FROM produtos WHERE id=$1',[ID.produtoA])).rows[0].codigo!==null,true);
    // The ordinary master-data get remains company-scoped, even when habilitated.
    assert.equal(await f.repo.getById(ctx,ID.produtoA),null);
    const off=new PostgresProdutoRepository(f.admin);assert.equal(await off.getForOperation(ctx,ID.produtoA),null);
  }finally{await f.close();}
});
