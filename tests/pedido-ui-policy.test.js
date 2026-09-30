import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPedidoPayload, buildPedidoResumoTexto, calculatePedidoTotals, canUsePedidoAction, clampPedidoCancelMotivo, evaluatePedidoCancelMotivoUiGate, evaluatePedidoDataEntregaUiGate, evaluatePedidoStatusMotivoUiGate, evaluatePedidoStatusTransitionUiGate, isPedidoCancelDisabled, isPedidoDataEntregaPassada, mapPedidoRowToForm, nextPedidoStatus, PEDIDO_CANCEL_MOTIVO_MAX, PEDIDO_CANCEL_MOTIVO_MIN, pedidoDocumentoSnapshotGapHint, resolvePedidoHistoryUiState, resolvePedidoResumoPreviewState, evaluatePedidoPrintPdfUiGate, evaluatePedidoShareUiGate, buildPedidoShareText, resolvePedidoDetailSummaryUiState, resolvePedidoPrintPermission, resolvePedidoSharePermission } from '../src/components/comercial/pedidoUiPolicy.js';
const item = { produto_id:'p', unidade_id:'u', descricao:'Produto', unidade_sigla:'UN', quantidade:'2', preco_unitario:'10', desconto:'1', requer_producao:true };
const nowFixed = new Date('2026-09-29T15:00:00.000Z');
test('pedido UI calcula sem float e allowlist remove tenant/totais',()=>{const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item],groupId:'g',empresaId:'e',total:'999'},{now:nowFixed});assert.equal(calculatePedidoTotals([item]).total,'19.000000');assert.equal(payload.total,undefined);assert.equal(payload.groupId,undefined);assert.equal(payload.itens[0].requer_producao,true);});
test('pedido UI inclui promoção confirmada no payload de save',()=>{
  const payload=buildPedidoPayload(
    {cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item]},
    {promocao:{aplicada:true,bps:500,cupom:'CPA10'},now:nowFixed},
  );
  assert.deepEqual(payload.promocao,{bps:500,cupom:'CPA10'});
});
test('pedido UI RBAC e fluxo sao fail-closed',()=>{const allow=(_m,_r,a)=>a==='visualizar'||a==='alterar-status';assert.equal(canUsePedidoAction(allow,'visualizar'),true);assert.equal(canUsePedidoAction(allow,'editar'),false);assert.equal(nextPedidoStatus({status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[item]}),'EM_PRODUCAO');assert.equal(nextPedidoStatus({status:'PRONTO_RETIRADA',tipo_operacao:'RETIRADA',itens:[] }),'FINALIZADO');assert.equal(nextPedidoStatus({status:'FINALIZADO',tipo_operacao:'ENTREGA',itens:[]}),null);});

test('pedido print/share RBAC sem fallback visualizar', () => {
  const onlyView = (_m, _r, a) => a === 'visualizar';
  assert.equal(resolvePedidoPrintPermission(onlyView), false);
  assert.equal(resolvePedidoSharePermission(onlyView), false);
  const printer = (_m, _r, a) => a === 'imprimir' || a === 'exportar';
  assert.equal(resolvePedidoPrintPermission(printer), true);
  assert.equal(resolvePedidoSharePermission(printer), false);
  const sharer = (_m, _r, a) => a === 'compartilhar' || a === 'notificar';
  assert.equal(resolvePedidoPrintPermission(sharer), false);
  assert.equal(resolvePedidoSharePermission(sharer), true);
});
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
test('pedido cancel motivo UI fail-closed (3–500)',()=>{
  assert.equal(PEDIDO_CANCEL_MOTIVO_MIN,3);
  assert.equal(PEDIDO_CANCEL_MOTIVO_MAX,500);
  assert.equal(evaluatePedidoCancelMotivoUiGate('').blockConfirm,true);
  assert.equal(evaluatePedidoCancelMotivoUiGate('  ab  ').blockConfirm,true);
  assert.equal(evaluatePedidoCancelMotivoUiGate('ok!').blockConfirm,false);
  assert.equal(evaluatePedidoCancelMotivoUiGate('ok!').motivo,'ok!');
  assert.equal(evaluatePedidoCancelMotivoUiGate('x'.repeat(501)).blockConfirm,true);
  assert.equal(clampPedidoCancelMotivo('x'.repeat(600)).length,500);
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
  assert.doesNotMatch(source,/history\.map\(event/);
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

test('painel pedido wire crédito UI fail-closed (ValidacaoCredito + gate Salvar)', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const creditoUi = await readFile(new URL('../src/components/financeiro/ValidacaoCredito.jsx', import.meta.url), 'utf8');
  assert.match(panel, /ValidacaoCredito/);
  assert.match(panel, /evaluatePedidoCreditoUiGate/);
  assert.match(panel, /creditoGate\.blockSave/);
  assert.match(panel, /pedido-credito-alcada-alert/);
  assert.match(panel, /canAprovarCreditoPedido/);
  assert.match(panel, /Comercial\.pedido\.credito/);
  assert.match(creditoUi, /evaluatePedidoCreditoUiGate/);
  assert.match(creditoUi, /pedido-credito-validacao/);
  assert.match(creditoUi, /pedido-credito-bloqueio/);
});

test('pedido payload bloqueia preço unitário zero', () => {
  assert.throws(
    () => buildPedidoPayload({
      cliente_empresa_id: 'c', condicao_pagamento_id: 'f', tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2027-01-01', itens: [{ ...item, preco_unitario: '0' }],
    }, { now: nowFixed }),
    /preço unitário/i,
  );
});

test('pedido data entrega UI gate: ENTREGA exige hoje+ e bloqueia passado/ausente', () => {
  assert.equal(isPedidoDataEntregaPassada('2026-09-28', nowFixed), true);
  assert.equal(isPedidoDataEntregaPassada('2026-09-29', nowFixed), false);
  const retiradaEmpty = evaluatePedidoDataEntregaUiGate({ tipoOperacao: 'RETIRADA', dataEntregaSolicitada: '', now: nowFixed });
  assert.equal(retiradaEmpty.blockSave, true);
  assert.equal(retiradaEmpty.mode, 'missing');
  assert.match(retiradaEmpty.minDay, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(evaluatePedidoDataEntregaUiGate({ tipoOperacao: 'RETIRADA', dataEntregaSolicitada: '2020-01-01', now: nowFixed }).blockSave, false);
  assert.equal(evaluatePedidoDataEntregaUiGate({ tipoOperacao: 'ENTREGA', dataEntregaSolicitada: '', now: nowFixed }).mode, 'missing');
  assert.equal(evaluatePedidoDataEntregaUiGate({ tipoOperacao: 'ENTREGA', dataEntregaSolicitada: '2026-09-28', now: nowFixed }).mode, 'past');
  assert.equal(evaluatePedidoDataEntregaUiGate({ tipoOperacao: 'ENTREGA', dataEntregaSolicitada: '2026-09-29', now: nowFixed }).mode, 'ready');
  assert.throws(
    () => buildPedidoPayload({
      cliente_empresa_id: 'c', condicao_pagamento_id: 'f', tipo_operacao: 'ENTREGA',
      data_entrega_solicitada: '2020-01-01', itens: [item],
    }, { now: nowFixed }),
    /passado/i,
  );
  assert.throws(
    () => buildPedidoPayload({
      cliente_empresa_id: 'c', condicao_pagamento_id: 'f', tipo_operacao: 'RETIRADA',
      data_entrega_solicitada: '', itens: [item],
    }, { now: nowFixed }),
    /schema|data solicitada/i,
  );
  assert.doesNotThrow(() => buildPedidoPayload({
    cliente_empresa_id: 'c', condicao_pagamento_id: 'f', tipo_operacao: 'RETIRADA',
    data_entrega_solicitada: '2020-01-01', itens: [item],
  }, { now: nowFixed }));
});

test('painel pedido wire data entrega fail-closed', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /evaluatePedidoDataEntregaUiGate/);
  assert.match(panel, /pedido-data-entrega-gate/);
  assert.match(panel, /dataEntregaUi\.blockSave/);
  assert.match(panel, /Comercial\.pedido\.data-entrega/);
  assert.match(panel, /pedido-data-entrega/);
  assert.match(panel, /min=\{form\.tipo_operacao==='ENTREGA'\?dataEntregaUi\.minDay:undefined\}/);
});

test('pedido print PDF gate fail-closed sem contexto/permissão/itens', () => {
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: '', empresaId: 'e', canPrint: true }).mode, 'context');
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: 'g', empresaId: 'e', canPrint: false }).mode, 'permission');
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: null, groupId: 'g', empresaId: 'e', canPrint: true }).mode, 'missing');
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canPrint: true }).mode, 'invalid');
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: 'g', empresaId: 'e', canPrint: true }).mode, 'ready');
  assert.equal(evaluatePedidoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: 'g', empresaId: 'e', canPrint: true }).blockPrint, false);
  const gapRow = {
    numero: '1',
    itens: [],
    condicao_pagamento_codigo_snapshot: '01',
    condicao_pagamento_nome_snapshot: '',
    condicao_pagamento_parcelas_snapshot: [],
  };
  const gapPrint = evaluatePedidoPrintPdfUiGate({ row: gapRow, groupId: 'g', empresaId: 'e', canPrint: true });
  assert.equal(gapPrint.mode, 'snapshot_gap');
  assert.equal(gapPrint.blockPrint, true);
  assert.match(gapPrint.hint, /imprimir ou compartilhar/i);
  const gapShare = evaluatePedidoShareUiGate({ row: { ...gapRow, numero: '1' }, groupId: 'g', empresaId: 'e', canShare: true });
  assert.equal(gapShare.mode, 'snapshot_gap');
  assert.equal(gapShare.blockShare, true);
});

test('painel pedido wire Imprimir/PDF canônico fail-closed', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/components/lib/exportacaoPDF.jsx', import.meta.url), 'utf8');
  assert.match(panel, /resolvePedidoPrintPermission/);
  assert.match(panel, /resolvePedidoSharePermission/);
  assert.match(panel, /canPrint=resolvePedidoPrintPermission\(hasPermission\)/);
  assert.match(panel, /canShare=resolvePedidoSharePermission\(hasPermission\)/);
  assert.doesNotMatch(panel, /canPrint=.*\|\|canView/);
  assert.doesNotMatch(panel, /canShare=.*\|\|canPrint/);
  assert.match(panel, /evaluatePedidoPrintPdfUiGate/);
  assert.match(panel, /gerarPDFPedido/);
  assert.match(panel, /pedido-print-pdf/);
  assert.match(panel, /Comercial\.pedido\.imprimir-pdf/);
  assert.match(panel, /printPdfGate\.blockPrint/);
  assert.match(panel, /Imprimir\/PDF/);
  assert.doesNotMatch(panel, /jspdf|pdfkit|html2pdf/i);
  assert.match(source, /export function gerarPDFPedido/);
  assert.match(source, /escapeDocumentText\(item\.descricao\)/);
  assert.match(source, /escapeDocumentText\(pedido\.observacoes/);
  assert.match(source, /printWindow\.opener = null/);
  assert.match(source, /pedido\.numero \|\| pedido\.numero_pedido/);
});

test('pedido share texto revisável e gate fail-closed', () => {
  const text = buildPedidoShareText(
    { numero: '00000042', status: 'EM_ABERTO', tipo_operacao: 'ENTREGA', data_entrega_solicitada: '2027-04-01T12:00:00.000Z', total: '19.000000' },
    { empresaNome: 'CPA', clienteNome: 'Cliente X', statusLabel: 'Em aberto' },
  );
  assert.match(text, /Pedido 00000042/);
  assert.match(text, /Cliente: Cliente X/);
  assert.match(text, /conferido no ERP/);
  assert.doesNotMatch(text, /groupId|token|api[_-]?key/i);
  assert.throws(() => buildPedidoShareText({}), /inválido/i);
  assert.equal(evaluatePedidoShareUiGate({ row: { numero: '1' }, groupId: '', empresaId: 'e', canShare: true }).mode, 'context');
  assert.equal(evaluatePedidoShareUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canShare: false }).mode, 'permission');
  assert.equal(evaluatePedidoShareUiGate({ row: null, groupId: 'g', empresaId: 'e', canShare: true }).mode, 'missing');
  assert.equal(evaluatePedidoShareUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canShare: true }).blockShare, false);
});

test('painel pedido wire WhatsApp/e-mail share fail-closed', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /resolvePedidoSharePermission/);
  assert.match(panel, /canShare=resolvePedidoSharePermission\(hasPermission\)/);
  assert.doesNotMatch(panel, /canShare=.*\|\|canPrint/);
  assert.match(panel, /evaluatePedidoShareUiGate/);
  assert.match(panel, /buildPedidoShareText/);
  assert.match(panel, /pedido-share-whatsapp/);
  assert.match(panel, /pedido-share-email/);
  assert.match(panel, /Comercial\.pedido\.compartilhar-whatsapp/);
  assert.match(panel, /shareGate\.blockShare/);
  assert.doesNotMatch(panel, /api\.whatsapp|twilio|wavoip/i);
});

test('pedido detail summary UI fail-closed e campos canônicos', () => {
  const completo = {
    numero: '00000055', status: 'EM_ABERTO', tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-04-01T12:00:00.000Z',
    condicao_pagamento_id: 'cp', condicao_pagamento_codigo_snapshot: 'AV', condicao_pagamento_nome_snapshot: 'À vista',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
    tabela_preco_id: 'tab', tabela_preco_codigo_snapshot: 'VAREJ', tabela_preco_nome_snapshot: 'Varejo',
    promocao_aplicada: false, subtotal: '20.000000', desconto: '1.000000', total: '19.000000',
    observacoes: 'Obs', itens: [{ id: 'i1', descricao: 'X', unidade_sigla: 'UN', quantidade: '1', preco_unitario: '20', desconto: '1', total: '19' }],
    created_at: '2026-09-01T12:00:00.000Z', updated_at: '2026-09-02T12:00:00.000Z',
  };
  const ready = resolvePedidoDetailSummaryUiState(completo, { clienteNome: 'Cliente Y' });
  assert.equal(ready.mode, 'ready');
  assert.equal(ready.fields.clienteNome, 'Cliente Y');
  assert.match(ready.fields.condicao, /AV/);
  assert.match(ready.fields.tabela, /Varejo/);
  assert.equal(resolvePedidoDetailSummaryUiState(null).mode, 'missing');
  assert.equal(resolvePedidoDetailSummaryUiState({ numero: '1' }).mode, 'invalid');
  const gap = resolvePedidoDetailSummaryUiState({ ...completo, tabela_preco_nome_snapshot: '' });
  assert.equal(gap.mode, 'snapshot_gap');
  assert.match(gap.hint || '', /tabela/i);
});

test('painel pedido wire detalhe summary fail-closed', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /resolvePedidoDetailSummaryUiState/);
  assert.match(panel, /pedido-detail-summary/);
  assert.match(panel, /pedido-detail-fields/);
  assert.match(panel, /Comercial\.pedido\.detail-summary/);
  assert.match(panel, /pedidoDetailSummary\.mode/);
});
