import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPedidoPayload, calculatePedidoTotals, canUsePedidoAction, nextPedidoStatus, preparePedidoAnexoFile } from '../src/components/comercial/pedidoUiPolicy.js';
const item = { produto_id:'p', unidade_id:'u', descricao:'Produto', unidade_sigla:'UN', quantidade:'2', preco_unitario:'10', desconto:'1', requer_producao:true };
test('pedido UI calcula sem float e allowlist remove tenant/totais',()=>{const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',campanha:'  Promo Sintetica  ',itens:[item],groupId:'g',empresaId:'e',total:'999'});assert.equal(calculatePedidoTotals([item]).total,'19.000000');assert.equal(payload.total,undefined);assert.equal(payload.groupId,undefined);assert.equal(payload.campanha,'Promo Sintetica');assert.equal(payload.itens[0].requer_producao,true);});
test('pedido UI RBAC e fluxo sao fail-closed',()=>{const allow=(_m,_r,a)=>a==='visualizar'||a==='alterar-status';assert.equal(canUsePedidoAction(allow,'visualizar'),true);assert.equal(canUsePedidoAction(allow,'editar'),false);assert.equal(nextPedidoStatus({status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[item]}),'EM_PRODUCAO');assert.equal(nextPedidoStatus({status:'PRONTO_RETIRADA',tipo_operacao:'RETIRADA',itens:[] }),'FINALIZADO');assert.equal(nextPedidoStatus({status:'FINALIZADO',tipo_operacao:'ENTREGA',itens:[]}),null);});
test('preparePedidoAnexoFile exige tenant e path de documentos do pedido',()=>{
  const file={name:'desenho.pdf',type:'application/pdf',size:128};
  const meta=preparePedidoAnexoFile(file,{groupId:'g1',empresaId:'e1',pedidoId:'p1'});
  assert.equal(meta.nome_arquivo,'desenho.pdf');
  assert.equal(meta.mime_type,'application/pdf');
  assert.equal(meta.tamanho_bytes,128);
  assert.match(meta.storage_key,/^groups\/g1\/companies\/e1\/pedidos\/p1\/documents\/.+-desenho\.pdf$/);
  assert.throws(()=>preparePedidoAnexoFile(file,{groupId:'',empresaId:'e1',pedidoId:'p1'}));
  assert.throws(()=>preparePedidoAnexoFile({name:'x.exe',type:'application/pdf',size:10},{groupId:'g1',empresaId:'e1',pedidoId:'p1'}));
});
