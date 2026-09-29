import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPedidoPayload, buildPedidoResumoTexto, calculatePedidoTotals, canUsePedidoAction, isPedidoCancelDisabled, mapPedidoRowToForm, nextPedidoStatus, pedidoDocumentoSnapshotGapHint, resolvePedidoResumoPreviewState } from '../src/components/comercial/pedidoUiPolicy.js';
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

test('resumo texto pedido inclui snapshots e fail-closed quando incompletos', () => {
  const completo = {
    numero: '00000011',
    status: 'EM_ABERTO',
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-04-01T12:00:00.000Z',
    cliente_local_id: 'loc1',
    condicao_pagamento_id: 'cp',
    condicao_pagamento_codigo_snapshot: 'AV',
    condicao_pagamento_nome_snapshot: 'À vista',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
    tabela_preco_id: 'tab',
    tabela_preco_codigo_snapshot: 'VAREJ',
    tabela_preco_nome_snapshot: 'Varejo',
    promocao_aplicada: false,
    subtotal: '20.000000',
    desconto: '1.000000',
    total: '19.000000',
    itens: [{ ...item, total: '19.000000' }],
  };
  const text = buildPedidoResumoTexto(completo, { clienteNome: 'Cliente Ped', statusLabel: 'Em aberto' });
  assert.match(text, /Pedido 00000011/);
  assert.match(text, /AV — À vista/);
  assert.match(text, /VAREJ — Varejo/);
  assert.match(text, /Promoção: não aplicada/);
  assert.match(text, /Local\/Obra referenciados/);
  assert.doesNotMatch(text, /groupId|token/i);
  assert.equal(resolvePedidoResumoPreviewState(completo).mode, 'ready');
  const incompleto = { ...completo, tabela_preco_nome_snapshot: '' };
  assert.match(pedidoDocumentoSnapshotGapHint(incompleto) || '', /tabela de preço incompletos/);
  assert.equal(resolvePedidoResumoPreviewState(incompleto).canPrint, false);
});

test('painel pedido wire resumo texto painel/janela', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /resolvePedidoResumoPreviewState/);
  assert.match(panel, /openComercialResumoTextoWindow/);
  assert.match(panel, /pedido-resumo-texto-dialog/);
  assert.match(panel, /Comercial\.pedido\.resumo-texto/);
  assert.match(panel, /setResumoOpen\(false\)/);
});

test('painel pedido wire gate de itens quantidade/preço fail-closed', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /evaluateItemLinesGate/);
  assert.match(panel, /pedido-item-lines-gate/);
  assert.match(panel, /itemLinesGate\.blockSave/);
  assert.match(panel, /itemLinesGate\.blockSimular/);
  assert.match(panel, /Comercial\.pedido\.item-line-validation/);
});

test('pedido payload bloqueia preço unitário zero', () => {
  assert.throws(
    () => buildPedidoPayload({
      cliente_empresa_id: 'c', condicao_pagamento_id: 'f', tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-01-01', itens: [{ ...item, preco_unitario: '0' }],
    }),
    /preço unitário/i,
  );
});
