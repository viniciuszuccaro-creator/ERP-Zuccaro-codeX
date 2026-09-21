import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryOrcamentoRepository } from '../src/repositories/inMemoryOrcamentoRepository.js';
import type { OrcamentoCreate, OrcamentoRepository } from '../src/repositories/orcamentoTypes.js';

const scopeA={groupId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',empresaId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const scopeB={groupId:scopeA.groupId,empresaId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
const input:OrcamentoCreate={cliente_empresa_id:'11111111-1111-4111-8111-111111111111',condicao_pagamento_id:'11111111-1111-4111-8111-111111111111',validade_em:'2027-01-01T00:00:00.000Z',itens:[{produto_id:'22222222-2222-4222-8222-222222222222',unidade_id:'33333333-3333-4333-8333-333333333333',descricao:'Produto',unidade_sigla:'UN',quantidade:'2',preco_unitario:'10.5',desconto:'1'}]};
const changed:OrcamentoCreate={...input,itens:[{...input.itens[0],quantidade:'3',preco_unitario:'12',desconto:'2'}]};
function repository():OrcamentoRepository{return new InMemoryOrcamentoRepository();}

test('contrato orcamento create get tenant e clone',async()=>{const repo=repository(),created=await repo.create(scopeA,input);assert.equal(created.numero,'00000001');assert.equal(created.total,'20.000000');assert.equal(await repo.get(scopeB,created.id),null);created.itens[0].descricao='MUTADO';assert.equal((await repo.get(scopeA,created.id))?.itens[0].descricao,'Produto');});

test('contrato orcamento update preserva numero e recalcula itens e totais',async()=>{const repo=repository(),created=await repo.create(scopeA,input),updated=await repo.update(scopeA,created.id,changed);assert.equal(updated?.numero,created.numero);assert.equal(updated?.itens[0].quantidade,'3');assert.equal(updated?.subtotal,'36.000000');assert.equal(updated?.total,'34.000000');assert.equal(await repo.update(scopeB,created.id,changed),null);});

test('contrato orcamento cancel preserva agregado e repeticao retorna null',async()=>{const repo=repository(),created=await repo.create(scopeA,input),cancelled=await repo.cancel(scopeA,created.id);assert.equal(cancelled?.status,'CANCELADO');assert.equal(cancelled?.itens.length,1);assert.equal(await repo.cancel(scopeA,created.id),null);assert.equal(await repo.update(scopeA,created.id,changed),null);});

test('contrato orcamento list normaliza ordenacao limite offset e pagina',async()=>{const repo=repository();for(let i=0;i<205;i+=1)await repo.create(scopeA,input);await repo.create(scopeB,input);const max=await repo.list(scopeA,999,-10);assert.equal(max.total,205);assert.equal(max.rows.length,200);assert.equal(max.rows[0].numero,'00000205');const min=await repo.list(scopeA,0,-2);assert.equal(min.rows.length,1);assert.equal(min.rows[0].numero,'00000205');const page=await repo.list(scopeA,2.9,1.8);assert.deepEqual(page.rows.map(x=>x.numero),['00000204','00000203']);});

test('transacao in-memory rollbacka create e contador e relanca erro',async()=>{const repo=repository();await assert.rejects(repo.withTransaction(async()=>{await repo.create(scopeA,input);throw new Error('ROLLBACK_TEST');}),/ROLLBACK_TEST/);assert.equal((await repo.list(scopeA)).total,0);assert.equal((await repo.create(scopeA,input)).numero,'00000001');});

test('transacao in-memory rollbacka update e cancel e sucesso persiste',async()=>{const repo=repository(),created=await repo.create(scopeA,input);await assert.rejects(repo.withTransaction(async()=>{await repo.update(scopeA,created.id,changed);throw new Error('UPDATE_ROLLBACK');}),/UPDATE_ROLLBACK/);assert.equal((await repo.get(scopeA,created.id))?.total,'20.000000');await assert.rejects(repo.withTransaction(async()=>{await repo.cancel(scopeA,created.id);throw new Error('CANCEL_ROLLBACK');}),/CANCEL_ROLLBACK/);assert.equal((await repo.get(scopeA,created.id))?.status,'EM_ABERTO');await repo.withTransaction(async()=>{await repo.update(scopeA,created.id,changed);});assert.equal((await repo.get(scopeA,created.id))?.total,'34.000000');});