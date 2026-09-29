import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPedidoPayload, calculatePedidoTotals, canUsePedidoAction, isPedidoCancelDisabled, mapPedidoRowToForm, nextPedidoStatus } from '../src/components/comercial/pedidoUiPolicy.js';
const item = { produto_id:'p', unidade_id:'u', descricao:'Produto', unidade_sigla:'UN', quantidade:'2', preco_unitario:'10', desconto:'1', requer_producao:true };
test('pedido UI calcula sem float e allowlist remove tenant/totais',()=>{const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item],groupId:'g',empresaId:'e',total:'999'});assert.equal(calculatePedidoTotals([item]).total,'19.000000');assert.equal(payload.total,undefined);assert.equal(payload.groupId,undefined);assert.equal(payload.itens[0].requer_producao,true);});
test('pedido UI inclui promoção confirmada no payload de save',()=>{
  const payload=buildPedidoPayload(
    {cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item]},
    {promocao:{aplicada:true,bps:500,cupom:'CPA10'}},
  );
  assert.deepEqual(payload.promocao,{bps:500,cupom:'CPA10'});
});
test('pedido UI RBAC e fluxo sao fail-closed',()=>{const allow=(_m,_r,a)=>a==='visualizar'||a==='alterar-status';assert.equal(canUsePedidoAction(allow,'visualizar'),true);assert.equal(canUsePedidoAction(allow,'editar'),false);assert.equal(nextPedidoStatus({status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[item]}),'EM_PRODUCAO');assert.equal(nextPedidoStatus({status:'PRONTO_RETIRADA',tipo_operacao:'RETIRADA',itens:[] }),'FINALIZADO');assert.equal(nextPedidoStatus({status:'FINALIZADO',tipo_operacao:'ENTREGA',itens:[]}),null);});
test('pedido UI cancel disable quando sem permissao ou ja cancelado',()=>{
  const allowCancel=(_m,_r,a)=>a==='cancelar'||a==='visualizar';
  const denyCancel=(_m,_r,a)=>a==='visualizar';
  assert.equal(canUsePedidoAction(allowCancel,'cancelar','EM_ABERTO'),true);
  assert.equal(isPedidoCancelDisabled(allowCancel,'EM_ABERTO'),false);
  assert.equal(isPedidoCancelDisabled(allowCancel,'CANCELADO'),true);
  assert.equal(isPedidoCancelDisabled(denyCancel,'EM_ABERTO'),true);
  assert.equal(isPedidoCancelDisabled(null,'EM_ABERTO'),true);
  assert.equal(canUsePedidoAction(allowCancel,'cancelar','FINALIZADO'),false);
});
test('mapPedidoRowToForm recarrega campos canônicos pós-save sem inventar snapshots',()=>{
  const mapped=mapPedidoRowToForm({
    id:'p1',numero:'00000009',cliente_empresa_id:'ce',cliente_local_id:'loc',obra_id:'ob',
    tabela_preco_id:'tab',condicao_pagamento_id:'cp',tipo_operacao:'RETIRADA',
    data_entrega_solicitada:'2027-02-10T12:00:00.000Z',observacoes:'nota',
    tabela_preco_nome_snapshot:'Atacado',promocao_aplicada:true,promocao_bps:100,
    itens:[{...item,quantidade:'3.000000'}],
  });
  assert.equal(mapped.cliente_empresa_id,'ce');
  assert.equal(mapped.cliente_local_id,'loc');
  assert.equal(mapped.obra_id,'ob');
  assert.equal(mapped.tabela_preco_id,'tab');
  assert.equal(mapped.tipo_operacao,'RETIRADA');
  assert.equal(mapped.data_entrega_solicitada,'2027-02-10');
  assert.equal(mapped.itens[0].quantidade,'3.000000');
  assert.equal('tabela_preco_nome_snapshot' in mapped,false);
  assert.equal('promocao_bps' in mapped,false);
  assert.equal('numero' in mapped,false);
});
