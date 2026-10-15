import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPedidoPayload,
  buildPedidoShareText,
  calculatePedidoTotals,
  canUsePedidoAction,
  clampPedidoCancelMotivo,
  evaluatePedidoCancelMotivoUiGate,
  evaluatePedidoPrintPdfUiGate,
  evaluatePedidoShareUiGate,
  evaluatePedidoStatusMotivoUiGate,
  evaluatePedidoStatusTransitionUiGate,
  isPedidoCancelDisabled,
  mapPedidoRowToForm,
  nextPedidoStatus,
  PEDIDO_CANCEL_MOTIVO_MAX,
  PEDIDO_CANCEL_MOTIVO_MIN,
  resolvePedidoHistoryUiState,
} from '../src/components/comercial/pedidoUiPolicy.js';

const item = { produto_id:'p', unidade_id:'u', descricao:'Produto', unidade_sigla:'UN', quantidade:'2', preco_unitario:'10', desconto:'1', requer_producao:true };

test('pedido UI calcula sem float e allowlist remove tenant/totais',()=>{
  const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item],groupId:'g',empresaId:'e',total:'999'});
  assert.equal(calculatePedidoTotals([item]).total,'19.000000');
  assert.equal(payload.total,undefined);
  assert.equal(payload.groupId,undefined);
  assert.equal(payload.itens[0].requer_producao,true);
});

test('pedido UI RBAC e fluxo sao fail-closed',()=>{
  const allow=(_m,_r,a)=>a==='visualizar'||a==='alterar-status';
  assert.equal(canUsePedidoAction(allow,'visualizar'),true);
  assert.equal(canUsePedidoAction(allow,'editar'),false);
  assert.equal(nextPedidoStatus({status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[item]}),'EM_PRODUCAO');
  assert.equal(nextPedidoStatus({status:'PRONTO_RETIRADA',tipo_operacao:'RETIRADA',itens:[] }),'FINALIZADO');
  assert.equal(nextPedidoStatus({status:'FINALIZADO',tipo_operacao:'ENTREGA',itens:[]}),null);
});

test('pedido cancel motivo UI fail-closed (3–500)',()=>{
  assert.equal(PEDIDO_CANCEL_MOTIVO_MIN,3);
  assert.equal(PEDIDO_CANCEL_MOTIVO_MAX,500);
  assert.equal(evaluatePedidoCancelMotivoUiGate('').blockConfirm,true);
  assert.equal(evaluatePedidoCancelMotivoUiGate('  ab  ').blockConfirm,true);
  assert.equal(evaluatePedidoCancelMotivoUiGate('ok!').blockConfirm,false);
  assert.equal(evaluatePedidoCancelMotivoUiGate('ok!').motivo,'ok!');
  assert.equal(evaluatePedidoCancelMotivoUiGate('x'.repeat(501)).blockConfirm,true);
  assert.equal(clampPedidoCancelMotivo('x'.repeat(600)).length,500);
  assert.equal(isPedidoCancelDisabled((_m,_r,a)=>a==='cancelar','FINALIZADO'),true);
});

test('painel Pedido: dialog cancel com motivo obrigatório', async ()=>{
  const source=await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url),'utf8');
  assert.match(source,/evaluatePedidoCancelMotivoUiGate/);
  assert.match(source,/clampPedidoCancelMotivo/);
  assert.match(source,/pedido-cancel-motivo/);
  assert.match(source,/cancelMotivoUi\.blockConfirm/);
  assert.match(source,/api\.cancel\(row\.id,\s*gate\.motivo\)/);
  assert.doesNotMatch(source,/Cancelamento confirmado pelo usuário/);
  assert.doesNotMatch(source,/ConfirmDialog/);
});

test('pedido status motivo opcional fail-closed (max 500)',()=>{
  assert.equal(evaluatePedidoStatusMotivoUiGate('').blockConfirm,false);
  assert.equal(evaluatePedidoStatusMotivoUiGate('').motivo,'');
  assert.equal(evaluatePedidoStatusMotivoUiGate('ok').blockConfirm,false);
  assert.equal(evaluatePedidoStatusMotivoUiGate('x'.repeat(501)).blockConfirm,true);
});

test('pedido status transition gate fail-closed',()=>{
  const row={status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[item]};
  assert.equal(evaluatePedidoStatusTransitionUiGate({row,groupId:'g',empresaId:'e',canTransition:true}).target,'EM_PRODUCAO');
  assert.equal(evaluatePedidoStatusTransitionUiGate({row,groupId:'g',empresaId:'e',canTransition:false}).blockTransition,true);
  assert.equal(evaluatePedidoStatusTransitionUiGate({row,groupId:'',empresaId:'e',canTransition:true}).mode,'context');
  assert.equal(evaluatePedidoStatusTransitionUiGate({row:{status:'FINALIZADO',tipo_operacao:'ENTREGA',itens:[]},groupId:'g',empresaId:'e',canTransition:true}).mode,'unavailable');
});

test('painel Pedido: dialog avanço status com confirmação e motivo opcional', async ()=>{
  const source=await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url),'utf8');
  assert.match(source,/evaluatePedidoStatusTransitionUiGate/);
  assert.match(source,/evaluatePedidoStatusMotivoUiGate/);
  assert.match(source,/pedido-status-dialog/);
  assert.match(source,/pedido-status-motivo/);
  assert.match(source,/requestTransition/);
  assert.match(source,/api\.transition\(row\.id,target,motivoGate\.motivo/);
  assert.doesNotMatch(source,/onClick=\{\(\)=>transition\(selected\)\}/);
});

test('pedido history UI fail-closed empty≠erro',()=>{
  assert.equal(resolvePedidoHistoryUiState({isLoading:true}).mode,'loading');
  assert.equal(resolvePedidoHistoryUiState({isError:true,errorMessage:'boom'}).mode,'error');
  assert.equal(resolvePedidoHistoryUiState({isError:true}).canRetry,true);
  assert.equal(resolvePedidoHistoryUiState({events:[]}).mode,'empty');
  assert.equal(resolvePedidoHistoryUiState({events:null}).mode,'invalid');
  assert.equal(resolvePedidoHistoryUiState({events:[{id:'1'}]}).mode,'ready');
});

test('painel Pedido: histórico loading/empty/error fail-closed', async ()=>{
  const source=await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url),'utf8');
  assert.match(source,/resolvePedidoHistoryUiState/);
  assert.match(source,/pedido-history-error/);
  assert.match(source,/pedido-history-empty/);
  assert.match(source,/pedido-history-retry/);
  assert.match(source,/loadHistory/);
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

test('pedido print/share gates fail-closed',()=>{
  const row={numero:'1',itens:[]};
  assert.equal(evaluatePedidoPrintPdfUiGate({row,groupId:'g',empresaId:'e',canPrint:true}).blockPrint,false);
  assert.equal(evaluatePedidoPrintPdfUiGate({row,groupId:'',empresaId:'e',canPrint:true}).mode,'context');
  assert.equal(evaluatePedidoShareUiGate({row,groupId:'g',empresaId:'e',canShare:false}).mode,'permission');
  const text=buildPedidoShareText({numero:'9',status:'EM_ABERTO',tipo_operacao:'ENTREGA',total:10,data_entrega_solicitada:'2027-01-01'});
  assert.match(text,/Pedido 9/);
});

test('painel Pedido: imprimir e compartilhar no detalhe', async ()=>{
  const source=await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url),'utf8');
  assert.match(source,/evaluatePedidoPrintPdfUiGate/);
  assert.match(source,/evaluatePedidoShareUiGate/);
  assert.match(source,/pedido-print-pdf/);
  assert.match(source,/pedido-share-whatsapp/);
  assert.match(source,/gerarPDFPedido/);
});
