// TEST ONLY: registrations extracted from the existing HML harness; no runtime or operational connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadCanonicalRehearsalSources, canonicalTable } from './hmlCanonicalSourceRehearsal.js';

async function installCanonicalCommercialParents(db,sources,schema) {
  assert.match(schema,/^[a-z_]+$/);
  const f=sources['001_foundation.sql'];
  const timestamp=f.match(/CREATE OR REPLACE FUNCTION set_updated_at\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  const tenant=sources['004_tenant_integrity.sql'].match(/CREATE OR REPLACE FUNCTION assert_empresa_belongs_to_group\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  assert.ok(timestamp&&tenant);
    await db.exec(`BEGIN; CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema},pg_catalog;
      ${timestamp}\n${tenant}\n${['groups','empresas','profiles'].map(n=>canonicalTable(f,n)).join('\n')}`);
    for(const name of ['003_marcas_pilot.sql','005_cadastros_simples.sql','006_produtos_base.sql','009_clientes_master_data.sql'])await db.exec(sources[name]);
    // PLpgSQL creation alone did not validate010's column dependencies. Original DDL, no historical UPDATE.
    const commercial=sources['010_cliente_empresas_comercial.sql'],start=commercial.indexOf('ALTER TABLE cliente_empresas');
    const end=commercial.indexOf(';',start)+1,checks=commercial.indexOf('DO $$');
    assert.ok(start>=0&&end>start&&checks>end);
    const commercialDdl=commercial.slice(start,end)+'\n'+commercial.slice(checks);
    assert.doesNotMatch(commercialDdl,/^UPDATE\s/m);await db.exec(commercialDdl);
    for(const name of ['011_cliente_locais.sql','012_obras.sql','013_tabelas_preco.sql','014_condicoes_pagamento.sql','015_condicoes_pagamento_hardening.sql','016_orcamentos_comercial_360.sql','017_pedidos_comercial_360.sql'])await db.exec(sources[name]);
}

async function seedCanonicalCommercialContexts(db,g1,g2,e1,e2) {
    const contexts=[];
    for(const [group,company] of [[g1,e1],[g2,e2]]){
      const profile=(await db.query("INSERT INTO profiles(group_id,empresa_id,email) VALUES($1,$2,$3) RETURNING id",[group,company,`synthetic-${company}@example.invalid`])).rows[0].id;
      const client=(await db.query("INSERT INTO clientes(group_id,codigo,tipo,nome) VALUES($1,'000001','Pessoa Jurídica','SYNTHETIC CLIENT') RETURNING id",[group])).rows[0].id;
      const link=(await db.query('INSERT INTO cliente_empresas(group_id,empresa_id,cliente_id) VALUES($1,$2,$3) RETURNING id',[group,company,client])).rows[0].id;
      const condition=(await db.query("INSERT INTO condicoes_pagamento(group_id,empresa_id,codigo,nome) VALUES($1,$2,'000001','SYNTHETIC TERMS') RETURNING id",[group,company])).rows[0].id;
      await db.query('INSERT INTO condicao_pagamento_empresas(group_id,empresa_id,condicao_pagamento_id) VALUES($1,$2,$3)',[group,company,condition]);
      await db.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,0,100)',[group,condition]);
      const unit=(await db.query("INSERT INTO unidades_medida(group_id,sigla,nome_completo) VALUES($1,'UN','SYNTHETIC UNIT') RETURNING id",[group])).rows[0].id;
      const product=(await db.query("INSERT INTO produtos(group_id,empresa_id,unidade_medida_id,codigo,descricao) VALUES($1,$2,$3,'SOURCE-CODE','SYNTHETIC PRODUCT') RETURNING id",[group,company,unit])).rows[0].id;
      const local=(await db.query("INSERT INTO cliente_locais(group_id,cliente_id,nome,cep,logradouro,numero,bairro,cidade,uf) VALUES($1,$2,'SYNTHETIC LOCAL','00000000','SYNTHETIC STREET','1','SYNTHETIC DISTRICT','SYNTHETIC CITY','SP') RETURNING id",[group,client])).rows[0].id;
      await db.query("INSERT INTO cliente_local_finalidades(group_id,cliente_id,cliente_local_id,finalidade) VALUES($1,$2,$3,'ENTREGA')",[group,client,local]);
      const work=(await db.query("INSERT INTO obras(group_id,cliente_id,codigo,nome) VALUES($1,$2,'000001','SYNTHETIC WORK') RETURNING id",[group,client])).rows[0].id;
      await db.query('INSERT INTO obra_empresas(group_id,empresa_id,obra_id) VALUES($1,$2,$3)',[group,company,work]);
      const price=(await db.query("INSERT INTO tabelas_preco(group_id,empresa_id,codigo,nome,vigencia_inicio) VALUES($1,$2,'000001','SYNTHETIC PRICE','2020-01-01') RETURNING id",[group,company])).rows[0].id;
      await db.query('INSERT INTO tabela_preco_empresas(group_id,empresa_id,tabela_preco_id) VALUES($1,$2,$3)',[group,company,price]);
      contexts.push({group,company,profile,client,link,condition,unit,product,local,work,price});
    }
  return contexts;
}

test('produto_empresas: fonte041 inativa, FKs compostas e policy em memoria com rollback', async t => {
  const { matrix, review, sources } = await loadCanonicalRehearsalSources('produto_empresas');
  assert.equal(matrix.canApply, false); assert.equal(review.restoredHmlAttested, false);
  const require = createRequire(new URL('../../server/package.json', import.meta.url));
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  const foundation = sources['001_foundation.sql'];
  const timestamp = foundation.match(/CREATE OR REPLACE FUNCTION set_updated_at\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  const tenant = sources['004_tenant_integrity.sql'].match(/CREATE OR REPLACE FUNCTION assert_empresa_belongs_to_group\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  const companyKey = sources['040_crm_oportunidades.sql'].match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_id_group_scope ON empresas\(id, group_id\);/)?.[0];
  const ddl = sources['041_produto_empresas_operacao.sql'].split('-- Extend the existing item guards explicitly;')[0];
  assert.ok(timestamp && tenant && companyKey); assert.doesNotMatch(ddl, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|produtos|produto_empresas)\b/i);
  const g1 = '11111111-1111-4111-8111-111111111111', g2 = '22222222-2222-4222-8222-222222222222';
  const e1 = '33333333-3333-4333-8333-333333333333', e2 = '44444444-4444-4444-8444-444444444444';
  const rejected = async (sql, values, code) => {
    await db.exec('SAVEPOINT rejected_link');
    await assert.rejects(db.query(sql, values), error => error.code === code);
    await db.exec('ROLLBACK TO SAVEPOINT rejected_link; RELEASE SAVEPOINT rejected_link');
  };
  try {
    await db.exec("CREATE TABLE public.keep_link_review(id integer PRIMARY KEY,label text); INSERT INTO public.keep_link_review VALUES(1,'SYNTHETIC_KEEP'); CREATE INDEX keep_link_label ON public.keep_link_review(label);");
    const before = (await db.query('SELECT * FROM public.keep_link_review')).rows;
    await db.exec(`BEGIN; CREATE SCHEMA link_review_synthetic; SET LOCAL search_path TO link_review_synthetic,pg_catalog;
      ${timestamp}\n${tenant}\n${['groups','empresas','profiles'].map(name=>canonicalTable(foundation,name)).join('\n')}
      ${sources['003_marcas_pilot.sql']}\n${sources['005_cadastros_simples.sql']}\n${sources['006_produtos_base.sql']}`);
    // Counterproof:001 alone is not a valid compound FK parent. Never fabricate its UNIQUE.
    await db.exec('SAVEPOINT missing_canonical_040');
    await assert.rejects(db.exec(ddl), error => error.code === '42830');
    await db.exec('ROLLBACK TO SAVEPOINT missing_canonical_040; RELEASE SAVEPOINT missing_canonical_040');
    await db.exec(`${companyKey}\n${ddl}`);
    await db.query("INSERT INTO groups(id,nome_do_grupo) VALUES($1,'SYNTHETIC A'),($2,'SYNTHETIC B')", [g1,g2]);
    await db.query("INSERT INTO empresas(id,group_id,razao_social) VALUES($1,$2,'SYNTHETIC A'),($3,$4,'SYNTHETIC B')", [e1,g1,e2,g2]);
    const profile = (await db.query("INSERT INTO profiles(email,group_id,empresa_id) VALUES('synthetic@example.invalid',$1,$2) RETURNING id", [g1,e1])).rows[0].id;
    const products = [];
    for (const group of [g1,g2]) products.push((await db.query("INSERT INTO produtos(group_id,descricao,codigo,ativo) VALUES($1,'SYNTHETIC SHARED','SOURCE-CODE',false) RETURNING *", [group])).rows[0]);
    const originalProducts = (await db.query('SELECT * FROM produtos ORDER BY id')).rows;
    const row = (await db.query('INSERT INTO produto_empresas(group_id,empresa_id,produto_id,created_by,updated_by) VALUES($1,$2,$3,$4,$4) RETURNING *', [g1,e1,products[0].id,profile])).rows[0];
    assert.deepEqual(Object.keys(row), ['id','group_id','empresa_id','produto_id','ativo','habilitado_operacao','version','created_by','updated_by','created_at','updated_at']); assert.equal(row.ativo, false); assert.equal(row.habilitado_operacao, false); assert.equal(row.version, 1);
    await rejected('UPDATE produto_empresas SET empresa_id=$1 WHERE id=$2', [e2,row.id], '23503');
    await rejected('UPDATE produto_empresas SET produto_id=$1 WHERE id=$2', [products[1].id,row.id], '23503');
    await rejected('UPDATE produto_empresas SET group_id=$1 WHERE id=$2', [g2,row.id], '23503');
    await rejected('UPDATE produto_empresas SET version=0 WHERE id=$1', [row.id], '23514');
    await rejected('UPDATE produto_empresas SET habilitado_operacao=true WHERE id=$1', [row.id], '23514');
    await rejected('UPDATE produto_empresas SET created_by=$1 WHERE id=$2', [e1,row.id], '23503');
    await rejected('UPDATE produto_empresas SET updated_by=NULL WHERE id=$1', [row.id], '23502');
    await rejected('INSERT INTO produto_empresas(group_id,empresa_id,produto_id,created_by,updated_by) VALUES($1,$2,$3,$4,$4)', [g1,e1,products[0].id,profile], '23505');
    assert.deepEqual((await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='produto_empresas'::regclass")).rows[0], { relrowsecurity: true, relforcerowsecurity: true });
    assert.equal((await db.query("SELECT count(*)::integer n FROM pg_policies WHERE schemaname='link_review_synthetic' AND tablename='produto_empresas'")).rows[0].n, 1);
    // Synthetic NOLOGIN role tests actual policy evaluation, not owner bypass or real actor/RBAC.
    await db.exec('CREATE ROLE link_review_reader NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA link_review_synthetic TO link_review_reader');
    await db.exec('SAVEPOINT reader_no_grant; SET LOCAL ROLE link_review_reader');
    await assert.rejects(db.query('SELECT id FROM produto_empresas'), error=>error.code==='42501');
    await db.exec('ROLLBACK TO SAVEPOINT reader_no_grant; RELEASE SAVEPOINT reader_no_grant; GRANT SELECT ON produto_empresas TO link_review_reader');
    const visible = async (group, company) => {
      await db.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [group,company]);
      await db.exec('SET LOCAL ROLE link_review_reader');
      const rows = (await db.query('SELECT id FROM produto_empresas')).rows;
      await db.exec('RESET ROLE'); return rows;
    };
    assert.deepEqual(await visible('',''), []); assert.deepEqual(await visible(g2,e2), []);
    assert.deepEqual(await visible(g1,''), []); assert.deepEqual(await visible(g1,e2), []);
    assert.deepEqual(await visible(g1,e1), [{ id: row.id }]);
    await db.exec('SAVEPOINT synthetic_write_check');
    const e3 = (await db.query("INSERT INTO empresas(group_id,razao_social) VALUES($1,'SYNTHETIC SAME GROUP') RETURNING id", [g1])).rows[0].id;
    await db.exec('GRANT UPDATE ON produto_empresas TO link_review_reader; SET LOCAL ROLE link_review_reader');
    assert.equal((await db.query('UPDATE produto_empresas SET version=2 WHERE id=$1 RETURNING version', [row.id])).rows[0].version, 2);
    await rejected('UPDATE produto_empresas SET empresa_id=$1 WHERE id=$2', [e3,row.id], '42501');
    await db.exec('RESET ROLE; ROLLBACK TO SAVEPOINT synthetic_write_check; RELEASE SAVEPOINT synthetic_write_check');
    await db.exec('SAVEPOINT invalid_policy_context');
    await db.query("SELECT set_config('app.group_id','invalid-uuid',true)");
    await db.exec('SET LOCAL ROLE link_review_reader');
    await assert.rejects(db.query('SELECT id FROM produto_empresas'), error=>error.code==='22P02');
    await db.exec('ROLLBACK TO SAVEPOINT invalid_policy_context; RELEASE SAVEPOINT invalid_policy_context');
    await db.exec('SAVEPOINT negative_link_policy; ALTER POLICY produto_empresas_tenant_scope ON produto_empresas USING(true)');
    assert.deepEqual(await visible(g2,e2), [{ id: row.id }]);
    await db.exec('ROLLBACK TO SAVEPOINT negative_link_policy; RELEASE SAVEPOINT negative_link_policy');
    assert.deepEqual(await visible(g2,e2), []);
    await db.exec('SAVEPOINT negative_link_fk');
    const compoundFks = (await db.query("SELECT conname FROM pg_constraint WHERE conrelid='produto_empresas'::regclass AND contype='f' AND array_length(conkey,1)=2")).rows;
    assert.equal(compoundFks.length, 2);
    for (const { conname } of compoundFks) { assert.match(conname, /^[a-z_]+$/); await db.exec(`ALTER TABLE produto_empresas DROP CONSTRAINT ${conname}`); }
    assert.equal((await db.query('UPDATE produto_empresas SET group_id=$1 WHERE id=$2 RETURNING group_id', [g2,row.id])).rows[0].group_id, g2);
    await db.exec('ROLLBACK TO SAVEPOINT negative_link_fk; RELEASE SAVEPOINT negative_link_fk');
    await rejected('UPDATE produto_empresas SET group_id=$1 WHERE id=$2', [g2,row.id], '23503');
    assert.deepEqual((await db.query('SELECT * FROM produto_empresas')).rows, [row]);
    assert.deepEqual((await db.query('SELECT * FROM produtos ORDER BY id')).rows, originalProducts);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT to_regclass('link_review_synthetic.produto_empresas') relation")).rows[0].relation, null);
    assert.deepEqual((await db.query('SELECT * FROM public.keep_link_review')).rows, before);
    assert.equal((await db.query("SELECT count(*)::integer n FROM pg_indexes WHERE schemaname='public' AND indexname='keep_link_label'")).rows[0].n, 1);
    t.diagnostic('041 relation only; canonical001/040 parents, synthetic policy evaluation/2 controls/rollback. No activation, backfill, real principal, target, item callbacks016/017, grants or deployment evidence.');
  } finally { await db.close(); }
});


test('orcamentos016: pais canonicos, linhas, vinculos e checks deferred antes do rollback', async t => {
  const { matrix, review, sources } = await loadCanonicalRehearsalSources('orcamentos');
  assert.equal(matrix.canApply, false); assert.equal(review.restoredHmlAttested, false);
  const { PGlite } = createRequire(new URL('../../server/package.json', import.meta.url))('@electric-sql/pglite');
  const db = new PGlite(), f = sources['001_foundation.sql'];
  const timestamp = f.match(/CREATE OR REPLACE FUNCTION set_updated_at\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  const tenant = sources['004_tenant_integrity.sql'].match(/CREATE OR REPLACE FUNCTION assert_empresa_belongs_to_group\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  assert.ok(timestamp && tenant);
  const g1='11111111-1111-4111-8111-111111111111',g2='22222222-2222-4222-8222-222222222222';
  const e1='33333333-3333-4333-8333-333333333333',e2='44444444-4444-4444-8444-444444444444';
  const rejected = async (sql,values,code) => {
    await db.exec('SAVEPOINT rejected_quote'); await assert.rejects(db.query(sql,values),err=>err.code===code);
    await db.exec('ROLLBACK TO SAVEPOINT rejected_quote; RELEASE SAVEPOINT rejected_quote');
  };
  try {
    await db.exec("CREATE TABLE public.keep_quote_review(id integer PRIMARY KEY,label text); INSERT INTO public.keep_quote_review VALUES(1,'SYNTHETIC_KEEP'); CREATE INDEX keep_quote_label ON public.keep_quote_review(label)");
    const before=(await db.query('SELECT * FROM public.keep_quote_review')).rows;
    await db.exec(`BEGIN; CREATE SCHEMA quote_review_synthetic; SET LOCAL search_path TO quote_review_synthetic,pg_catalog;
      ${timestamp}\n${tenant}\n${['groups','empresas','profiles'].map(n=>canonicalTable(f,n)).join('\n')}`);
    for(const name of ['003_marcas_pilot.sql','005_cadastros_simples.sql','006_produtos_base.sql','009_clientes_master_data.sql','014_condicoes_pagamento.sql','015_condicoes_pagamento_hardening.sql','016_orcamentos_comercial_360.sql']) await db.exec(sources[name]);
    await db.query("INSERT INTO groups(id,nome_do_grupo) VALUES($1,'SYNTHETIC A'),($2,'SYNTHETIC B')",[g1,g2]);
    await db.query("INSERT INTO empresas(id,group_id,razao_social) VALUES($1,$2,'SYNTHETIC A'),($3,$4,'SYNTHETIC B')",[e1,g1,e2,g2]);
    const fixtureRows=[];
    for(const [group,company] of [[g1,e1],[g2,e2]]) {
      const client=(await db.query("INSERT INTO clientes(group_id,codigo,tipo,nome) VALUES($1,'000001','Pessoa Jurídica','SYNTHETIC CLIENT') RETURNING id",[group])).rows[0].id;
      const link=(await db.query('INSERT INTO cliente_empresas(group_id,cliente_id,empresa_id) VALUES($1,$2,$3) RETURNING id',[group,client,company])).rows[0].id;
      const condition=(await db.query("INSERT INTO condicoes_pagamento(group_id,empresa_id,codigo,nome) VALUES($1,$2,'000001','SYNTHETIC TERMS') RETURNING id",[group,company])).rows[0].id;
      await db.query('INSERT INTO condicao_pagamento_empresas(group_id,empresa_id,condicao_pagamento_id) VALUES($1,$2,$3)',[group,company,condition]);
      await db.query('INSERT INTO condicao_pagamento_parcelas(group_id,condicao_pagamento_id,ordem,dias,percentual) VALUES($1,$2,1,0,100)',[group,condition]);
      const unit=(await db.query("INSERT INTO unidades_medida(group_id,sigla,nome_completo) VALUES($1,'UN','SYNTHETIC UNIT') RETURNING id",[group])).rows[0].id;
      const product=(await db.query("INSERT INTO produtos(group_id,empresa_id,unidade_medida_id,codigo,descricao,ativo) VALUES($1,$2,$3,'SOURCE-CODE','SYNTHETIC PRODUCT',false) RETURNING id",[group,company,unit])).rows[0].id;
      fixtureRows.push({link,condition,unit,product});
    }
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE'); // Flush actual015; ROLLBACK alone would never exercise deferred triggers.
    const a=fixtureRows[0],b=fixtureRows[1];
    const quote=(await db.query("INSERT INTO orcamentos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,validade_em,subtotal,total) VALUES($1,$2,'00000001',$3,$4,'2030-01-01',20,20) RETURNING *",[g1,e1,a.link,a.condition])).rows[0];
    const item=(await db.query("INSERT INTO orcamento_itens(group_id,empresa_id,orcamento_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,subtotal,total) VALUES($1,$2,$3,$4,$5,'SYNTHETIC SNAPSHOT','UN',2,10,20,20) RETURNING *",[g1,e1,quote.id,a.product,a.unit])).rows[0];
    assert.equal(Object.keys(quote).length,17); assert.equal(Object.keys(item).length,18); assert.equal(quote.status,'EM_ABERTO');
    await rejected('UPDATE orcamentos SET empresa_id=$1 WHERE id=$2',[e2,quote.id],'P0001');
    await rejected('UPDATE orcamentos SET cliente_empresa_id=$1 WHERE id=$2',[b.link,quote.id],'P0001');
    await rejected('UPDATE orcamentos SET condicao_pagamento_id=$1 WHERE id=$2',[b.condition,quote.id],'P0001');
    for(const [table,field,id] of [['cliente_empresas','cliente_empresa_id',a.link],['condicao_pagamento_empresas','condicao_pagamento_id',a.condition],['condicoes_pagamento','condicao_pagamento_id',a.condition]]) {
      await db.exec('SAVEPOINT inactive_quote_dependency');
      await db.query(`UPDATE ${table} SET ativo=false WHERE ${table==='condicao_pagamento_empresas'?'condicao_pagamento_id':'id'}=$1`,[id]);
      await rejected(`UPDATE orcamentos SET ${field}=$1 WHERE id=$2`,[id,quote.id],'P0001');
      await db.exec('ROLLBACK TO SAVEPOINT inactive_quote_dependency; RELEASE SAVEPOINT inactive_quote_dependency');
    }
    for(const [sql,values] of [["UPDATE orcamentos SET numero='1' WHERE id=$1",[quote.id]],['UPDATE orcamentos SET desconto=21 WHERE id=$1',[quote.id]],["UPDATE orcamentos SET status='CANCELADO' WHERE id=$1",[quote.id]],['UPDATE orcamento_itens SET quantidade=0 WHERE id=$1',[item.id]],["UPDATE orcamento_itens SET descricao_snapshot='' WHERE id=$1",[item.id]],['UPDATE orcamento_itens SET preco_unitario=-1 WHERE id=$1',[item.id]]]) await rejected(sql,values,'23514');
    await rejected('UPDATE orcamento_itens SET produto_id=$1 WHERE id=$2',[b.product,item.id],'P0001');
    await rejected('UPDATE orcamento_itens SET unidade_id=$1 WHERE id=$2',[b.unit,item.id],'P0001');
    await rejected('UPDATE orcamento_itens SET empresa_id=$1 WHERE id=$2',[e2,item.id],'P0001');
    await db.exec('SAVEPOINT invalid_deferred_condition; SET CONSTRAINTS ALL DEFERRED');
    await db.query("INSERT INTO condicoes_pagamento(group_id,empresa_id,codigo,nome) VALUES($1,$2,'000002','SYNTHETIC INVALID WITHOUT PARCELAS')",[g1,e1]);
    await assert.rejects(db.exec('SET CONSTRAINTS ALL IMMEDIATE'),err=>err.code==='P0001'&&err.message.includes('CONDICAO_PAGAMENTO_INVALID_PARCELAS'));
    await db.exec('ROLLBACK TO SAVEPOINT invalid_deferred_condition; RELEASE SAVEPOINT invalid_deferred_condition');
    for(const [table,trigger,sql,values] of [
      ['orcamentos','trg_orcamentos_tenant','UPDATE orcamentos SET condicao_pagamento_id=$1 WHERE id=$2',[b.condition,quote.id]],
      ['orcamento_itens','trg_orcamento_itens_tenant','UPDATE orcamento_itens SET produto_id=$1 WHERE id=$2',[b.product,item.id]],
    ]) {
      await db.exec(`SAVEPOINT negative_quote_control; ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
      assert.equal((await db.query(`${sql} RETURNING id`,values)).rows.length,1);
      await db.exec('ROLLBACK TO SAVEPOINT negative_quote_control; RELEASE SAVEPOINT negative_quote_control');
    }
    await db.exec('SAVEPOINT negative_deferred_control; ALTER TABLE condicoes_pagamento DISABLE TRIGGER trg_condicoes_pagamento_parcelas_validas');
    assert.equal((await db.query("INSERT INTO condicoes_pagamento(group_id,empresa_id,codigo,nome) VALUES($1,$2,'000002','SYNTHETIC INVALID CONTROL') RETURNING id",[g1,e1])).rows.length,1);
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK TO SAVEPOINT negative_deferred_control; RELEASE SAVEPOINT negative_deferred_control');
    await db.query("UPDATE orcamentos SET observacoes='SYNTHETIC NOTE',updated_at='1990-01-01' WHERE id=$1",[quote.id]);
    const kept=(await db.query('SELECT * FROM orcamentos WHERE id=$1',[quote.id])).rows[0];
    for(const key of ['id','numero','cliente_empresa_id','condicao_pagamento_id','status','ativo']) assert.equal(kept[key],quote[key]);
    assert.ok(new Date(kept.updated_at).getUTCFullYear()>2000); assert.deepEqual((await db.query('SELECT * FROM orcamento_itens WHERE id=$1',[item.id])).rows[0],item);
    assert.equal((await db.query('SELECT ativo FROM produtos WHERE id=$1',[a.product])).rows[0].ativo,false); //016 original allows this; eligibility evolution is041, not a new draft rule.
    await db.exec('SAVEPOINT positive_quote_cancel');
    const cancelled=(await db.query("UPDATE orcamentos SET status='CANCELADO',ativo=false WHERE id=$1 RETURNING status,ativo",[quote.id])).rows[0];
    assert.deepEqual(cancelled,{status:'CANCELADO',ativo:false});
    await rejected('INSERT INTO orcamentos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,validade_em,subtotal,total) SELECT group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,validade_em,subtotal,total FROM orcamentos WHERE id=$1',[quote.id],'23505');
    await db.exec('ROLLBACK TO SAVEPOINT positive_quote_cancel; RELEASE SAVEPOINT positive_quote_cancel; SAVEPOINT positive_zero_price');
    assert.equal(Number((await db.query('UPDATE orcamento_itens SET preco_unitario=0,subtotal=0,total=0 WHERE id=$1 RETURNING preco_unitario',[item.id])).rows[0].preco_unitario),0);
    await db.exec('ROLLBACK TO SAVEPOINT positive_zero_price; RELEASE SAVEPOINT positive_zero_price');
    for(const table of ['orcamentos','orcamento_itens']) assert.deepEqual((await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='${table}'::regclass`)).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK');
    assert.equal((await db.query("SELECT to_regclass('quote_review_synthetic.orcamentos') relation")).rows[0].relation,null);
    assert.deepEqual((await db.query('SELECT * FROM public.keep_quote_review')).rows,before);
    assert.equal((await db.query("SELECT count(*)::integer n FROM pg_indexes WHERE schemaname='public' AND indexname='keep_quote_label'")).rows[0].n,1);
    t.diagnostic('Original016 only, true009/014/015 parents/deferred checks/3 controls/rollback; not039/017/041 replacements, application eligibility, real RBAC, restored HML or commercial journey proof.');
  } finally {await db.close();}
});
test('pedidos017 e callbacks041: linhas e pais reais, elegibilidade sintetica revertida', async t => {
  const {matrix,review,sources}=await loadCanonicalRehearsalSources('pedidos');
  assert.equal(matrix.canApply,false);assert.equal(review.restoredHmlAttested,false);
  const {PGlite}=createRequire(new URL('../../server/package.json',import.meta.url))('@electric-sql/pglite');
  const db=new PGlite();
  const g1='11111111-1111-4111-8111-111111111111',g2='22222222-2222-4222-8222-222222222222';
  const e1='33333333-3333-4333-8333-333333333333',e2='44444444-4444-4444-8444-444444444444';
  const rejected=async(sql,values,code)=>{
    await db.exec('SAVEPOINT rejected_order');await assert.rejects(db.query(sql,values),err=>err.code===code);
    await db.exec('ROLLBACK TO SAVEPOINT rejected_order; RELEASE SAVEPOINT rejected_order');
  };
  const scopedChange=async(sql,values,check)=>{
    await db.exec('SAVEPOINT order_dependency_change');await db.query(sql,values);await check();
    await db.exec('ROLLBACK TO SAVEPOINT order_dependency_change; RELEASE SAVEPOINT order_dependency_change');
  };
  try{
    await db.exec("CREATE TABLE public.keep_order_review(id integer PRIMARY KEY,label text); INSERT INTO public.keep_order_review VALUES(1,'SYNTHETIC_KEEP'); CREATE INDEX keep_order_label ON public.keep_order_review(label)");
    const before=(await db.query('SELECT * FROM public.keep_order_review')).rows;
    await installCanonicalCommercialParents(db,sources,'order_review_synthetic');
    await db.query("INSERT INTO groups(id,nome_do_grupo) VALUES($1,'SYNTHETIC A'),($2,'SYNTHETIC B')",[g1,g2]);
    await db.query("INSERT INTO empresas(id,group_id,razao_social) VALUES($1,$2,'SYNTHETIC A'),($3,$4,'SYNTHETIC B')",[e1,g1,e2,g2]);
    const contexts=await seedCanonicalCommercialContexts(db,g1,g2,e1,e2);
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
    const a=contexts[0],b=contexts[1];
    const quote=(await db.query("INSERT INTO orcamentos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,validade_em,subtotal,total) VALUES($1,$2,'00000001',$3,$4,'2030-01-01',20,20) RETURNING id",[g1,e1,a.link,a.condition])).rows[0].id;
    const order=(await db.query("INSERT INTO pedidos(group_id,empresa_id,numero,cliente_empresa_id,cliente_local_id,obra_id,tabela_preco_id,condicao_pagamento_id,orcamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,subtotal,total) VALUES($1,$2,'00000001',$3,$4,$5,$6,$7,$8,$9,'ENTREGA','2030-01-01',20,20) RETURNING *",[g1,e1,a.link,a.local,a.work,a.price,a.condition,quote,a.profile])).rows[0];
    const item=(await db.query("INSERT INTO pedido_itens(group_id,empresa_id,pedido_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,subtotal,total) VALUES($1,$2,$3,$4,$5,'SYNTHETIC SNAPSHOT','UN',2,10,20,20) RETURNING *",[g1,e1,order.id,a.product,a.unit])).rows[0];
    const history=(await db.query("INSERT INTO pedido_historico(group_id,empresa_id,pedido_id,status_novo,actor_id,motivo) VALUES($1,$2,$3,'EM_ABERTO',$4,'SYNTHETIC HISTORY') RETURNING *",[g1,e1,order.id,a.profile])).rows[0];
    assert.equal(Object.keys(order).length,23);assert.equal(Object.keys(item).length,19);assert.equal(Object.keys(history).length,10);assert.ok(BigInt(history.ordem)>0n);
    for(const [field,value] of [['empresa_id',e2],['cliente_empresa_id',b.link],['cliente_local_id',b.local],['obra_id',b.work],['tabela_preco_id',b.price],['condicao_pagamento_id',b.condition]])await rejected(`UPDATE pedidos SET ${field}=$1 WHERE id=$2`,[value,order.id],'P0001');
    await rejected('UPDATE pedidos SET vendedor_id=$1 WHERE id=$2',[e1,order.id],'23503');
    for(const change of ["ativo=false,habilitado_operacao=false,situacao_comercial='INATIVO'",'habilitado_operacao=false',`bloqueado=true,motivo_bloqueio='SYNTHETIC',bloqueado_em=now(),bloqueado_por='${a.profile}'`])await scopedChange(`UPDATE cliente_empresas SET ${change} WHERE id=$1`,[a.link],()=>rejected('UPDATE pedidos SET cliente_empresa_id=$1 WHERE id=$2',[a.link,order.id],'P0001'));
    for(const [table,field,id,key] of [['cliente_locais','cliente_local_id',a.local,'id'],['obra_empresas','obra_id',a.work,'obra_id'],['tabela_preco_empresas','tabela_preco_id',a.price,'tabela_preco_id'],['condicao_pagamento_empresas','condicao_pagamento_id',a.condition,'condicao_pagamento_id']])await scopedChange(`UPDATE ${table} SET ativo=false WHERE ${key}=$1`,[id],()=>rejected(`UPDATE pedidos SET ${field}=$1 WHERE id=$2`,[id,order.id],'P0001'));
    for(const sql of ["UPDATE pedidos SET numero='1' WHERE id=$1","UPDATE pedidos SET tipo_operacao='OUTRO' WHERE id=$1","UPDATE pedidos SET status='CANCELADO' WHERE id=$1",'UPDATE pedidos SET desconto=21 WHERE id=$1','UPDATE pedido_itens SET quantidade=0 WHERE id=$1',"UPDATE pedido_itens SET descricao_snapshot='' WHERE id=$1",'UPDATE pedido_itens SET preco_unitario=-1 WHERE id=$1'])await rejected(sql,[sql.includes('pedido_itens')?item.id:order.id],'23514');
    await rejected('UPDATE pedidos SET data_entrega_solicitada=NULL WHERE id=$1',[order.id],'23502');
    await rejected('UPDATE pedido_historico SET empresa_id=$1 WHERE id=$2',[e2,history.id],'23503');
    await rejected('UPDATE pedido_historico SET actor_id=$1 WHERE id=$2',[e1,history.id],'23503');
    await rejected("UPDATE pedido_historico SET status_novo='INVENTADO' WHERE id=$1",[history.id],'23514');
    for(const [field,value] of [['produto_id',b.product],['unidade_id',b.unit],['empresa_id',e2]])await rejected(`UPDATE pedido_itens SET ${field}=$1 WHERE id=$2`,[value,item.id],'P0001');
    for(const [table,field,id] of [['produtos','produto_id',a.product],['unidades_medida','unidade_id',a.unit]])await scopedChange(`UPDATE ${table} SET ativo=false WHERE id=$1`,[id],()=>rejected(`UPDATE pedido_itens SET ${field}=$1 WHERE id=$2`,[id,item.id],'P0001'));
    await rejected("INSERT INTO pedidos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,orcamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,subtotal,total) VALUES($1,$2,'00000002',$3,$4,$5,$6,'RETIRADA','2030-01-01',0,0)",[g1,e1,a.link,a.condition,quote,a.profile],'23505');
    for(const [table,trigger,sql,values] of [['pedidos','trg_pedidos_tenant','UPDATE pedidos SET condicao_pagamento_id=$1 WHERE id=$2',[b.condition,order.id]],['pedido_itens','trg_pedido_itens_tenant','UPDATE pedido_itens SET produto_id=$1 WHERE id=$2',[b.product,item.id]]]){
      await db.exec(`SAVEPOINT negative_order_control; ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);assert.equal((await db.query(`${sql} RETURNING id`,values)).rows.length,1);await db.exec('ROLLBACK TO SAVEPOINT negative_order_control; RELEASE SAVEPOINT negative_order_control');
    }
    await db.exec('SAVEPOINT negative_history_fk');
    const fk=(await db.query("SELECT conname FROM pg_constraint WHERE conrelid='pedido_historico'::regclass AND contype='f' AND array_length(conkey,1)=3")).rows;
    assert.equal(fk.length,1);assert.match(fk[0].conname,/^[a-z_]+$/);await db.exec(`ALTER TABLE pedido_historico DROP CONSTRAINT ${fk[0].conname}`);
    assert.equal((await db.query('UPDATE pedido_historico SET empresa_id=$1 WHERE id=$2 RETURNING empresa_id',[e2,history.id])).rows[0].empresa_id,e2);
    await db.exec('ROLLBACK TO SAVEPOINT negative_history_fk; RELEASE SAVEPOINT negative_history_fk');
    await db.exec('SAVEPOINT same_group_other_company');
    const e3=(await db.query("INSERT INTO empresas(group_id,razao_social) VALUES($1,'SYNTHETIC SAME GROUP COMPANY') RETURNING id",[g1])).rows[0].id;
    const otherLink=(await db.query('INSERT INTO cliente_empresas(group_id,empresa_id,cliente_id) VALUES($1,$2,$3) RETURNING id',[g1,e3,a.client])).rows[0].id;
    await rejected('UPDATE pedidos SET cliente_empresa_id=$1 WHERE id=$2',[otherLink,order.id],'P0001');
    await rejected('UPDATE pedidos SET empresa_id=$1 WHERE id=$2',[e3,order.id],'P0001');
    await rejected('UPDATE pedido_itens SET empresa_id=$1 WHERE id=$2',[e3,item.id],'P0001');
    await rejected('UPDATE pedido_historico SET empresa_id=$1 WHERE id=$2',[e3,history.id],'23503');
    await db.exec('ROLLBACK TO SAVEPOINT same_group_other_company; RELEASE SAVEPOINT same_group_other_company');
    await db.exec('SAVEPOINT positive_order_states');
    for(const status of ['EM_PRODUCAO','PRONTO_ENTREGA','PRONTO_RETIRADA','FINALIZADO']) assert.equal((await db.query('UPDATE pedidos SET status=$1 WHERE id=$2 RETURNING status',[status,order.id])).rows[0].status,status);
    assert.equal((await db.query("UPDATE pedidos SET status='CANCELADO',ativo=false WHERE id=$1 RETURNING ativo",[order.id])).rows[0].ativo,false);
    await rejected('INSERT INTO pedidos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,subtotal,total) SELECT group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,subtotal,total FROM pedidos WHERE id=$1',[order.id],'23505');
    const pickup=(await db.query("INSERT INTO pedidos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,subtotal,total) VALUES($1,$2,'00000002',$3,$4,$5,'RETIRADA','2030-01-01',0,0) RETURNING cliente_local_id,tipo_operacao",[g1,e1,a.link,a.condition,a.profile])).rows[0];assert.deepEqual(pickup,{cliente_local_id:null,tipo_operacao:'RETIRADA'});
    await db.exec('ROLLBACK TO SAVEPOINT positive_order_states; RELEASE SAVEPOINT positive_order_states');
    const originalRows={order:(await db.query('SELECT * FROM pedidos')).rows,item:(await db.query('SELECT * FROM pedido_itens')).rows,history:(await db.query('SELECT * FROM pedido_historico')).rows,products:(await db.query('SELECT * FROM produtos ORDER BY id')).rows};
    const shared=(await db.query("INSERT INTO produtos(group_id,unidade_medida_id,codigo,descricao) VALUES($1,$2,'SHARED-SOURCE','SYNTHETIC SHARED') RETURNING id",[g1,a.unit])).rows[0].id;
    const insertShared=kind=>db.query(`INSERT INTO ${kind==='quote'?'orcamento_itens':'pedido_itens'}(group_id,empresa_id,${kind==='quote'?'orcamento_id':'pedido_id'},produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,subtotal,total) VALUES($1,$2,$3,$4,$5,'SYNTHETIC SHARED SNAPSHOT','UN',1,0,0,0) RETURNING id`,[g1,e1,kind==='quote'?quote:order.id,shared,a.unit]);
    const refuseShared=async kind=>{
      await db.exec('SAVEPOINT shared_denied');await assert.rejects(insertShared(kind),err=>err.code==='P0001');await db.exec('ROLLBACK TO SAVEPOINT shared_denied; RELEASE SAVEPOINT shared_denied');
    };
    await refuseShared('quote');await refuseShared('order'); // Original016/017 deny NULL-company shared master.
    const companyKey=sources['040_crm_oportunidades.sql'].match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_id_group_scope ON empresas\(id, group_id\);/)?.[0];assert.ok(companyKey);
    await db.exec(`${companyKey}\n${sources['041_produto_empresas_operacao.sql']}`);
    const link=(await db.query('INSERT INTO produto_empresas(group_id,empresa_id,produto_id,created_by,updated_by) VALUES($1,$2,$3,$4,$4) RETURNING *',[g1,e1,shared,a.profile])).rows[0];
    assert.equal(link.ativo,false);assert.equal(link.habilitado_operacao,false);await refuseShared('quote');await refuseShared('order');
    await db.exec('SAVEPOINT synthetic_shared_eligibility');await db.query('UPDATE produto_empresas SET ativo=true,habilitado_operacao=true WHERE id=$1',[link.id]);
    assert.equal((await insertShared('quote')).rows.length,1);assert.equal((await insertShared('order')).rows.length,1);
    for(const kind of ['quote','order']){
      await db.exec('SAVEPOINT negative_041_callback');const oldSource=sources[kind==='quote'?'016_orcamentos_comercial_360.sql':'017_pedidos_comercial_360.sql'];
      const name=kind==='quote'?'orcamento':'pedido';const original=oldSource.match(new RegExp(`CREATE OR REPLACE FUNCTION assert_${name}_item_same_tenant\\(\\)[\\s\\S]*?\\$\\$ LANGUAGE plpgsql;`))?.[0];assert.ok(original);await db.exec(original);await refuseShared(kind);await db.exec('ROLLBACK TO SAVEPOINT negative_041_callback; RELEASE SAVEPOINT negative_041_callback');
    }
    for(const [sql,values] of [['UPDATE produto_empresas SET habilitado_operacao=false WHERE id=$1',[link.id]],['UPDATE produto_empresas SET ativo=false,habilitado_operacao=false WHERE id=$1',[link.id]],['UPDATE produtos SET ativo=false WHERE id=$1',[shared]],["UPDATE empresas SET status='Inativa' WHERE id=$1",[e1]]])await scopedChange(sql,values,async()=>{await refuseShared('quote');await refuseShared('order');});
    await scopedChange('UPDATE unidades_medida SET ativo=false WHERE id=$1',[a.unit],()=>refuseShared('order'));
    await db.exec('SAVEPOINT same_group_shared_link');
    const otherCompany=(await db.query("INSERT INTO empresas(group_id,razao_social) VALUES($1,'SYNTHETIC OTHER LINK') RETURNING id",[g1])).rows[0].id;
    await db.query('UPDATE produto_empresas SET empresa_id=$1 WHERE id=$2',[otherCompany,link.id]);
    await refuseShared('quote');await refuseShared('order');
    await db.exec('ROLLBACK TO SAVEPOINT same_group_shared_link; RELEASE SAVEPOINT same_group_shared_link');
    await db.exec('ROLLBACK TO SAVEPOINT synthetic_shared_eligibility; RELEASE SAVEPOINT synthetic_shared_eligibility');
    assert.deepEqual((await db.query('SELECT * FROM produto_empresas')).rows,[link]);await refuseShared('quote');await refuseShared('order');
    for(const [table,key] of [['pedidos','order'],['pedido_itens','item'],['pedido_historico','history']]){
      assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows,originalRows[key]);assert.deepEqual((await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='${table}'::regclass`)).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    }
    assert.deepEqual((await db.query('SELECT * FROM produtos WHERE id<>$1 ORDER BY id',[shared])).rows,originalRows.products);
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK');assert.equal((await db.query("SELECT to_regclass('order_review_synthetic.pedidos') relation")).rows[0].relation,null);
    assert.deepEqual((await db.query('SELECT * FROM public.keep_order_review')).rows,before);assert.equal((await db.query("SELECT count(*)::integer n FROM pg_indexes WHERE schemaname='public' AND indexname='keep_order_label'")).rows[0].n,1);
    t.diagnostic('017 baseline rows plus actual041 replacements with real source parents;5 controls, eligible shared positives rolled back. Not039/044/full040/043, service address/RBAC/actor/state machine, restored target, import or deployment proof.');
  }finally{await db.close();}
});
test('consultas039040: preco escopado e CRM com policy/sequence originais somente memoria', async t=>{
  const {matrix,review,sources}=await loadCanonicalRehearsalSources('oportunidades');assert.equal(matrix.canApply,false);assert.equal(review.restoredHmlAttested,false);
  const {PGlite}=createRequire(new URL('../../server/package.json',import.meta.url))('@electric-sql/pglite');const db=new PGlite();
  const g1='11111111-1111-4111-8111-111111111111',g2='22222222-2222-4222-8222-222222222222';
  const e1='33333333-3333-4333-8333-333333333333',e2='44444444-4444-4444-8444-444444444444';
  const rejected=async(operation,code)=>{await db.exec('SAVEPOINT crm_rejected');await assert.rejects(operation(),err=>err.code===code);await db.exec('ROLLBACK TO SAVEPOINT crm_rejected; RELEASE SAVEPOINT crm_rejected');};
  const scoped=async(sql,values,check)=>{await db.exec('SAVEPOINT crm_change');await db.query(sql,values);await check();await db.exec('ROLLBACK TO SAVEPOINT crm_change; RELEASE SAVEPOINT crm_change');};
  try{
    await db.exec("CREATE TABLE public.keep_crm_review(id integer PRIMARY KEY,label text); INSERT INTO public.keep_crm_review VALUES(1,'SYNTHETIC_KEEP'); CREATE INDEX keep_crm_label ON public.keep_crm_review(label)");const before=(await db.query('SELECT * FROM public.keep_crm_review')).rows;
    await installCanonicalCommercialParents(db,sources,'crm_review_synthetic');
    await db.query("INSERT INTO groups(id,nome_do_grupo) VALUES($1,'SYNTHETIC A'),($2,'SYNTHETIC B')",[g1,g2]);await db.query("INSERT INTO empresas(id,group_id,razao_social) VALUES($1,$2,'SYNTHETIC A'),($3,$4,'SYNTHETIC B')",[e1,g1,e2,g2]);
    const [a,b]=await seedCanonicalCommercialContexts(db,g1,g2,e1,e2);await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
    const quote=(await db.query("INSERT INTO orcamentos(group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,validade_em,subtotal,total) VALUES($1,$2,'00000001',$3,$4,'2030-01-01',0,0) RETURNING *",[g1,e1,a.link,a.condition])).rows[0];assert.equal(Object.keys(quote).length,17);
    await db.exec(sources['039_orcamentos_tabela_preco.sql']);
    const quoteAfter=(await db.query('SELECT * FROM orcamentos WHERE id=$1',[quote.id])).rows[0];assert.deepEqual(quoteAfter,{...quote,tabela_preco_id:null});assert.equal(Object.keys(quoteAfter).length,18);
    await scoped('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[a.price,quote.id],async()=>assert.equal((await db.query('SELECT tabela_preco_id FROM orcamentos WHERE id=$1',[quote.id])).rows[0].tabela_preco_id,a.price));
    const invalidPrice=()=>rejected(()=>db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[b.price,quote.id]),'P0001');await invalidPrice();
    for(const [table,key] of [['tabelas_preco','id'],['tabela_preco_empresas','tabela_preco_id']])await scoped(`UPDATE ${table} SET ativo=false WHERE ${key}=$1`,[a.price],()=>rejected(()=>db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[a.price,quote.id]),'P0001'));
    await scoped('UPDATE cliente_empresas SET ativo=false,habilitado_operacao=false,situacao_comercial=$1 WHERE id=$2',['INATIVO',a.link],()=>rejected(()=>db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[a.price,quote.id]),'P0001'));
    await scoped('UPDATE condicao_pagamento_empresas SET ativo=false WHERE condicao_pagamento_id=$1',[a.condition],()=>rejected(()=>db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[a.price,quote.id]),'P0001'));
    await db.exec('SAVEPOINT negative039');const old=sources['016_orcamentos_comercial_360.sql'].match(/CREATE OR REPLACE FUNCTION assert_orcamento_same_tenant\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];assert.ok(old);await db.exec(old);assert.equal((await db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2 RETURNING tabela_preco_id',[b.price,quote.id])).rows[0].tabela_preco_id,b.price);await db.exec('ROLLBACK TO SAVEPOINT negative039; RELEASE SAVEPOINT negative039');await invalidPrice();
    await db.exec(sources['040_crm_oportunidades.sql']);
    const e3=(await db.query("INSERT INTO empresas(group_id,razao_social) VALUES($1,'SYNTHETIC SAME GROUP') RETURNING id",[g1])).rows[0].id;const c3=(await db.query('INSERT INTO cliente_empresas(group_id,empresa_id,cliente_id) VALUES($1,$2,$3) RETURNING id',[g1,e3,a.client])).rows[0].id;
    const sameGroupPrice=(await db.query("INSERT INTO tabelas_preco(group_id,empresa_id,codigo,nome,vigencia_inicio) VALUES($1,$2,'000002','SYNTHETIC OTHER PRICE','2020-01-01') RETURNING id",[g1,e3])).rows[0].id;await db.query('INSERT INTO tabela_preco_empresas(group_id,empresa_id,tabela_preco_id) VALUES($1,$2,$3)',[g1,e3,sameGroupPrice]);await rejected(()=>db.query('UPDATE orcamentos SET tabela_preco_id=$1 WHERE id=$2',[sameGroupPrice,quote.id]),'P0001');
    const makeRow=(code,extra={})=>({group_id:g1,empresa_id:e1,codigo:code,codigo_oportunidade:`OP-${code}`,legacy_store_id:`legacy/store/${code}`,idempotency_key:`SYNTHETIC-KEY-${code}`,payload_fingerprint:'a'.repeat(64),cliente_empresa_id:a.link,cliente_id:'legacy/client/ABC',cliente_nome:'SYNTHETIC CONTACT',titulo:'SYNTHETIC TITLE',etapa:'SYNTHETIC STAGE',status:'SYNTHETIC STATUS',valor_estimado:'12.123456',probabilidade:50,temperatura:'SYNTHETIC',origem:'ERP',data_abertura:'2030-01-01',created_by:a.profile,updated_by:a.profile,...extra});
    const insert=async(code,extra={})=>{const row=makeRow(code,extra),keys=Object.keys(row);for(const key of keys)assert.match(key,/^[a-z_]+$/);return db.query(`INSERT INTO oportunidades(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,Object.values(row));};
    const first=(await insert('000001',{convertido_em:'pedido',convertido_em_id:'legacy/order/A',orcamento_id:'legacy/quote/A',legacy_orcamento_id:'ORIGINAL-QUOTE-A',legacy_pedido_id:'ORIGINAL-ORDER-A'})).rows[0];
    assert.equal(Object.keys(first).length,44);assert.equal(first.codigo,'000001');assert.equal(first.legacy_store_id,'legacy/store/000001');assert.equal(first.cliente_id,'legacy/client/ABC');assert.equal(first.convertido_em_id,'legacy/order/A');assert.equal(String(first.valor_estimado),'12.123456');assert.equal(first.version,1);assert.deepEqual(first.produtos_interesse,[]);assert.deepEqual(first.historico_mudancas_etapa,[]);
    const next=async(group=g1)=>String((await db.query("SELECT next_value FROM entity_code_sequences WHERE group_id=$1 AND entity_name='Oportunidade'",[group])).rows[0].next_value);assert.equal(await next(),'2');
    for(const extra of [{codigo_oportunidade:first.codigo_oportunidade},{idempotency_key:first.idempotency_key},{legacy_store_id:first.legacy_store_id},{convertido_em:'pedido',convertido_em_id:first.convertido_em_id}]){await rejected(()=>insert('000002',extra),'23505');assert.equal(await next(),'2');}
    await rejected(()=>insert('000001',{codigo_oportunidade:'OTHER',idempotency_key:'OTHER',legacy_store_id:'OTHER'}),'23505');
    await rejected(()=>insert('000002',{empresa_id:e2}),'23503');await rejected(()=>insert('000002',{cliente_empresa_id:b.link}),'23503');await rejected(()=>insert('000002',{cliente_empresa_id:c3}),'23503');
    for(const extra of [{produtos_interesse:{}},{historico_mudancas_etapa:{}},{valor_estimado:'NaN'},{valor_estimado:-1},{orcamento_cliente:'NaN'},{probabilidade:101},{version:0},{titulo:''},{payload_fingerprint:'not-hash'},{cliente_empresa_id:null,cliente_nome:null,cliente_email:null}])await rejected(()=>insert('000002',extra),'23514');
    for(const code of ['9223372036854775807','9999999999999999999']){await rejected(()=>insert(code),'22003');assert.equal(await next(),'2');}
    await rejected(()=>insert('000001',{empresa_id:e3,cliente_empresa_id:c3,codigo_oportunidade:'OTHER-COMPANY-CODE',idempotency_key:'OTHER-COMPANY-CODE',legacy_store_id:'OTHER-COMPANY-CODE'}),'23505');
    const sameGroup=(await insert('000002',{empresa_id:e3,cliente_empresa_id:c3,codigo_oportunidade:first.codigo_oportunidade,idempotency_key:first.idempotency_key,legacy_store_id:first.legacy_store_id})).rows[0];assert.equal(await next(),'3');
    const otherGroup=(await insert('000001',{group_id:g2,empresa_id:e2,cliente_empresa_id:b.link,created_by:b.profile,updated_by:b.profile})).rows[0];assert.equal(await next(g2),'2');
    await scoped('UPDATE oportunidades SET ativo=false WHERE id=$1',[first.id],async()=>{await rejected(()=>insert('000003',{convertido_em:'pedido',convertido_em_id:first.convertido_em_id}),'23505');await rejected(()=>insert('000001',{codigo_oportunidade:'INACTIVE-OTHER',idempotency_key:'INACTIVE-OTHER',legacy_store_id:'INACTIVE-OTHER'}),'23505');});
    await db.exec('SAVEPOINT greatest_sequence');const high=(await insert('000010')).rows[0];assert.equal(await next(),'11');await db.query("UPDATE oportunidades SET codigo='000004' WHERE id=$1",[high.id]);assert.equal(await next(),'11');await db.exec('ROLLBACK TO SAVEPOINT greatest_sequence; RELEASE SAVEPOINT greatest_sequence');assert.equal(await next(),'3');
    assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE oid='sync_oportunidade_codigo()'::regprocedure")).rows[0].prosecdef,false);
    await db.exec('SAVEPOINT negative_sequence; ALTER TABLE oportunidades DISABLE TRIGGER trg_oportunidades_codigo');await insert('000900');assert.equal(await next(),'3');await db.exec('ROLLBACK TO SAVEPOINT negative_sequence; RELEASE SAVEPOINT negative_sequence');
    await db.exec('SAVEPOINT negative_crm_fk');const fks=(await db.query("SELECT conname FROM pg_constraint WHERE conrelid='oportunidades'::regclass AND contype='f' AND array_length(conkey,1)=3")).rows;assert.equal(fks.length,1);assert.match(fks[0].conname,/^[a-z_]+$/);await db.exec(`ALTER TABLE oportunidades DROP CONSTRAINT ${fks[0].conname}`);assert.equal((await db.query('UPDATE oportunidades SET cliente_empresa_id=$1 WHERE id=$2 RETURNING cliente_empresa_id',[b.link,first.id])).rows[0].cliente_empresa_id,b.link);await db.exec('ROLLBACK TO SAVEPOINT negative_crm_fk; RELEASE SAVEPOINT negative_crm_fk');
    await db.exec('SAVEPOINT negative_crm_owner; DROP INDEX uq_oportunidades_pedido_canonico');assert.equal((await insert('000003',{convertido_em:'pedido',convertido_em_id:first.convertido_em_id})).rows.length,1);await db.exec('ROLLBACK TO SAVEPOINT negative_crm_owner; RELEASE SAVEPOINT negative_crm_owner');
    assert.deepEqual((await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='oportunidades'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true});
    await db.exec('CREATE ROLE crm_review_reader NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA crm_review_synthetic TO crm_review_reader; SAVEPOINT no_crm_select; SET LOCAL ROLE crm_review_reader');await assert.rejects(db.query('SELECT id FROM oportunidades'),err=>err.code==='42501');await db.exec('ROLLBACK TO SAVEPOINT no_crm_select; RELEASE SAVEPOINT no_crm_select; GRANT SELECT ON oportunidades TO crm_review_reader');
    const visible=async(group,company)=>{await db.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[group,company]);await db.exec('SET LOCAL ROLE crm_review_reader');const rows=(await db.query('SELECT id FROM oportunidades ORDER BY id')).rows;await db.exec('RESET ROLE');return rows;};
    assert.deepEqual(await visible('',''),[]);assert.deepEqual(await visible(g1,''),[]);assert.deepEqual(await visible(g1,e2),[]);assert.deepEqual(await visible(g2,e1),[]);assert.deepEqual(await visible(g1,e1),[{id:first.id}]);assert.deepEqual(await visible(g1,e3),[{id:sameGroup.id}]);assert.deepEqual(await visible(g2,e2),[{id:otherGroup.id}]);
    await db.exec('SAVEPOINT negative_crm_policy; ALTER POLICY oportunidades_tenant_scope ON oportunidades USING(true)');assert.equal((await visible(g1,e2)).length,3);await db.exec('ROLLBACK TO SAVEPOINT negative_crm_policy; RELEASE SAVEPOINT negative_crm_policy');assert.deepEqual(await visible(g1,e2),[]);
    await visible(g1,e1);await db.exec('SAVEPOINT crm_with_check; GRANT UPDATE ON oportunidades TO crm_review_reader; SET LOCAL ROLE crm_review_reader');assert.equal((await db.query('UPDATE oportunidades SET version=2 WHERE id=$1 RETURNING version',[first.id])).rows[0].version,2);await rejected(()=>db.query("UPDATE oportunidades SET empresa_id=$1,cliente_empresa_id=NULL,idempotency_key='MOVE-UNIQUE',codigo_oportunidade='MOVE-UNIQUE',legacy_store_id='MOVE-UNIQUE',convertido_em=NULL,convertido_em_id=NULL WHERE id=$2",[e3,first.id]),'42501');await db.exec('RESET ROLE; ROLLBACK TO SAVEPOINT crm_with_check; RELEASE SAVEPOINT crm_with_check');
    await db.exec('SAVEPOINT invalid_crm_context');await db.query("SELECT set_config('app.group_id','invalid-uuid',true)");await db.exec('SET LOCAL ROLE crm_review_reader');await assert.rejects(db.query('SELECT id FROM oportunidades'),err=>err.code==='22P02');await db.exec('ROLLBACK TO SAVEPOINT invalid_crm_context; RELEASE SAVEPOINT invalid_crm_context');
    assert.deepEqual((await db.query('SELECT * FROM oportunidades WHERE id=$1',[first.id])).rows[0],first);assert.deepEqual((await db.query('SELECT * FROM orcamentos WHERE id=$1',[quote.id])).rows[0],quoteAfter);assert.equal(await next(),'3');assert.equal(await next(g2),'2');
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE; ROLLBACK');assert.equal((await db.query("SELECT to_regclass('crm_review_synthetic.oportunidades') relation")).rows[0].relation,null);assert.deepEqual((await db.query('SELECT * FROM public.keep_crm_review')).rows,before);assert.equal((await db.query("SELECT count(*)::integer n FROM pg_indexes WHERE schemaname='public' AND indexname='keep_crm_label'")).rows[0].n,1);
    t.diagnostic('039/040 original rows/policy/sequence,5 controls/rollback in memory; no042/043/real actor/RBAC/restored target/multi-session concurrency/import/deploy claim.');
  }finally{await db.close();}
});
