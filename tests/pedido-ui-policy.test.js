import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildPedidoPayload,
  buildPedidoShareText,
  calculatePedidoTotals,
  canUsePedidoAction,
  createPedidoDetailGate,
  createPedidoMutationGate,
  clearPedidoCreateIntentKey,
  getOrCreatePedidoIntentKey,
  recoverPedidoCreateIntentAfterConflict,
  sharedPedidoMutationGate,
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
  explainPedidoPersistenceError,
} from '../src/components/comercial/pedidoUiPolicy.js';

const item = { produto_id:'p', unidade_id:'u', descricao:'Produto', unidade_sigla:'UN', quantidade:'2', preco_unitario:'10', desconto:'1', requer_producao:true };

test('detalhe/histórico de Pedido ignoram resposta tardia após troca de escopo ou seleção', async()=>{
  const gate=createPedidoDetailGate();
  const scope={groupId:'g',empresaId:'e-a',actorId:'u'};
  let active={...scope,token:'session-a'};
  let resolveFirst;
  const firstResponse=new Promise(resolve=>{resolveFirst=resolve;});
  const first=gate.begin(scope,scope,active);
  assert.ok(first);
  active={...scope,empresaId:'e-b',token:'session-a'};
  resolveFirst({id:'pedido-a'});
  await firstResponse;
  assert.equal(gate.isCurrent(first,scope,active),false);
  assert.equal(gate.begin(scope,scope,active),null);
  active={...scope,token:'session-a'};
  const reopened=gate.begin(scope,scope,active);
  const next=gate.begin(scope,scope,active);
  assert.equal(gate.isCurrent(reopened,scope,active),false);
  assert.equal(gate.isScopeCurrent(reopened,scope,active),true);
  assert.equal(gate.isCurrent(next,scope,active),true);
  active={...scope,token:'session-b'};
  assert.equal(gate.isCurrent(next,scope,active),false);
  assert.equal(gate.isScopeCurrent(next,scope,active),false);
  assert.equal(gate.begin(scope,scope,{...scope}),null);
  gate.invalidate();
  assert.equal(gate.isCurrent(next,scope,active),false);
});

test('painel Pedido aplica gate nas respostas de detalhe e histórico', async()=>{
  const source=await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx',import.meta.url),'utf8');
  assert.match(source,/detailGate\.current\.begin\(renderedScope\.current,renderedScope\.current,activeScope\(\)\)/);
  assert.match(source,/await api\.get\(row\.id\);if\(!detailGate\.current\.isCurrent/);
  assert.match(source,/await api\.history\(pedidoId\);if\(!detailGate\.current\.isCurrent/);
  assert.match(source,/detailGate\.current\.invalidate\(\)/);
  assert.match(source,/const save=async\(\)=>\{[^\n]*const ticket=detailGate\.current\.begin/);
  assert.match(source,/const transition=async\(row,target,motivo\)=>\{[^\n]*const ticket=detailGate\.current\.begin/);
  assert.match(source,/const cancel=async\(row,motivo\)=>\{[^\n]*const ticket=detailGate\.current\.begin/);
  assert.match(source,/await loadHistory\(row\.id,ticket\)/);
  assert.match(source,/setBusy\(mutationGate\.current\.isPending\(\{groupId,empresaId,actorId\}\)\)/);
  assert.match(source,/useRef\(sharedPedidoMutationGate\)/);
  assert.match(source,/mutationGate\.current\.subscribe\(\(\)=>setBusy/);
  assert.match(source,/getOrCreatePedidoIntentKey\(renderedScope\.current,intentStorage\(\)/);
  assert.match(source,/const openCreate=\(\)=>\{if\(mutationGate\.current\.isPending\(renderedScope\.current\)\)/);
  assert.match(source,/onClick=\{openCreate\} disabled=\{!ready\|\|busy\}/);
  assert.match(source,/buildPedidoPayload\(form,editing\?undefined:createKey\)/);
  assert.match(source,/clearPedidoCreateIntentKey\(ticket\.scope,intentStorage\(\),createKey\)/);
  const saveLine=source.split('\n').find(value=>value.includes('const save=async'));
  assert.ok(saveLine.indexOf('const saved=') < saveLine.indexOf('clearPedidoCreateIntentKey(ticket.scope'));
  assert.ok(saveLine.indexOf('clearPedidoCreateIntentKey(ticket.scope') < saveLine.indexOf('if(!detailGate.current.isCurrent(ticket'), 'sucesso tardio deve retirar a chave antes de descartar a resposta da UI');
  assert.match(saveLine,/error\?\.code==='PEDIDO_IDEMPOTENCY_CONFLICT'/);
  assert.match(saveLine,/recoverPedidoCreateIntentAfterConflict\(ticket\.scope,intentStorage\(\),createKey/);
  assert.match(source,/queryKey:\['pedidos-http',groupId,empresaId,actorId,page,pageSize,applied\]/);
  assert.match(source,/const refreshConflictScope=async\(ticket,scope\)=>\{if\(!canView\|\|!detailGate\.current\.isCurrent/);
  assert.match(source,/await api\.list\(\{limit:1,offset:0\}\)/);
  assert.match(source,/invalidateQueries\(\{queryKey:\['pedidos-http',scope\.groupId,scope\.empresaId,scope\.actorId\],refetchType:'all'\},\{throwOnError:true\}\)/);
  assert.equal((source.match(/mutationGate\.current\.begin\(renderedScope\.current\)/g)||[]).length,3);
  assert.equal((source.match(/mutationGate\.current\.end\(mutation\)/g)||[]).length,6);
  for(const action of ['save','transition','cancel']){
    const line=source.split('\n').find(value=>value.includes(`const ${action}=async`));
    assert.ok(line);
    assert.ok(line.indexOf('mutationGate.current.begin') < line.indexOf('detailGate.current.begin'),`${action} deve reservar mutação antes do ticket de leitura`);
  }
});

test('mutação tardia do Pedido A não substitui detalhe/histórico do Pedido B', async()=>{
  const gate=createPedidoDetailGate();
  const scope={groupId:'g',empresaId:'e',actorId:'u',token:'session'};
  let selected='B';
  let history=['B'];
  let finishMutation;
  const mutation=new Promise(resolve=>{finishMutation=resolve;});
  const ticketA=gate.begin(scope,scope,scope);
  const ticketB=gate.begin(scope,scope,scope);
  assert.ok(ticketA && ticketB);
  finishMutation({id:'A'});
  const updated=await mutation;
  if(gate.isCurrent(ticketA,scope,scope))selected=updated.id;
  if(gate.isCurrent(ticketA,scope,scope))history=['A'];
  assert.equal(selected,'B');
  assert.deepEqual(history,['B']);
  assert.equal(gate.isCurrent(ticketB,scope,scope),true);
  assert.equal(gate.isScopeCurrent(ticketA,scope,scope),true);
});

test('mutação pendente preserva bloqueio em A→B→A e libera após rotação de token',()=>{
  const gate=createPedidoMutationGate();
  const a={groupId:'g',empresaId:'a',actorId:'u'};
  const b={...a,empresaId:'b'};
  const first=gate.begin(a);
  assert.ok(first);
  assert.equal(gate.begin(a),null);
  assert.equal(gate.isPending(b),false);
  const second=gate.begin(b);
  assert.ok(second);
  assert.equal(gate.isPending(a),true);
  assert.equal(gate.begin({...a,token:'rotated'}),null);
  gate.end(first);
  assert.equal(gate.isPending(a),false);
  assert.equal(gate.isPending(b),true);
  gate.end(second);
  assert.equal(gate.isPending(b),false);
});

test('gate compartilhado preserva pendência após desmontar e remontar janela',()=>{
  const scope={groupId:'g-remount',empresaId:'e-remount',actorId:'u-remount'};
  const states=[];
  const unsubscribeOld=sharedPedidoMutationGate.subscribe(()=>states.push(`antiga:${sharedPedidoMutationGate.isPending(scope)}`));
  const pending=sharedPedidoMutationGate.begin(scope);
  assert.ok(pending);
  unsubscribeOld();
  assert.equal(sharedPedidoMutationGate.isPending(scope),true);
  assert.equal(sharedPedidoMutationGate.begin(scope),null);
  const unsubscribeNew=sharedPedidoMutationGate.subscribe(()=>states.push(`nova:${sharedPedidoMutationGate.isPending(scope)}`));
  sharedPedidoMutationGate.end(pending);
  unsubscribeNew();
  assert.deepEqual(states,['antiga:true','nova:false']);
});

test('pedido UI calcula sem float e allowlist remove tenant/totais',()=>{
  const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item],groupId:'g',empresaId:'e',total:'999'});
  assert.equal(calculatePedidoTotals([item]).total,'19.000000');
  assert.equal(payload.total,undefined);
  assert.equal(payload.groupId,undefined);
  assert.equal(payload.itens[0].requer_producao,true);
});

test('intenção de criação reutiliza chave após remount/retry e só limpa a própria chave',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const scope={groupId:'g',empresaId:'e',actorId:'u'};
  const first='99999999-9999-4999-8999-999999999999';
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>first),first);
  assert.equal(getOrCreatePedidoIntentKey({...scope,empresaId:'other'},storage,()=>first),first);
  assert.equal(getOrCreatePedidoIntentKey(scope,null,()=>first),null);
  assert.equal(getOrCreatePedidoIntentKey(scope,{getItem:()=>{throw Error('disabled');}},()=>first),null);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>{throw Error('retry must reuse key');}),first);
  const payload=buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item]},first);
  assert.equal(payload.idempotency_key,first);
  assert.equal(buildPedidoPayload({cliente_empresa_id:'c',condicao_pagamento_id:'f',tipo_operacao:'ENTREGA',data_entrega_solicitada:'2027-01-01',itens:[item]}).idempotency_key,undefined);
  assert.equal(clearPedidoCreateIntentKey(scope,storage,'other-key'),false);
  assert.equal(clearPedidoCreateIntentKey(scope,storage,first),true);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>first),first);
});

test('sucesso tardio em A libera próxima intenção em A sem apagar a intenção aberta em B',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const a={groupId:'g',empresaId:'a',actorId:'u'};
  const b={groupId:'g',empresaId:'b',actorId:'u'};
  const keyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const keyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const nextA='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  assert.equal(getOrCreatePedidoIntentKey(a,storage,()=>keyA),keyA);
  assert.equal(getOrCreatePedidoIntentKey(b,storage,()=>keyB),keyB);
  assert.equal(clearPedidoCreateIntentKey(a,storage,keyA),true);
  assert.equal(getOrCreatePedidoIntentKey(b,storage,()=>{throw Error('B deve permanecer');}),keyB);
  assert.equal(getOrCreatePedidoIntentKey(a,storage,()=>nextA),nextA);
});

test('conflito comprovado apos resposta perdida aposenta chave consumida sem retry automatico',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const scope={groupId:'g',empresaId:'e',actorId:'u'};
  const old='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const next='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>old),old);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>{throw Error('reload deve reutilizar');}),old);
  assert.equal(clearPedidoCreateIntentKey(scope,storage,old),true);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>next),next);
  assert.equal(clearPedidoCreateIntentKey(scope,storage,old),false);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>{throw Error('nao sobrescrever nova intencao');}),next);
});

test('conflito reconsulta tenant antes de girar chave e falha fechada se refresh falhar',async()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const scope={groupId:'g',empresaId:'e',actorId:'u'};
  const old='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const next='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  getOrCreatePedidoIntentKey(scope,storage,()=>old);
  await assert.rejects(recoverPedidoCreateIntentAfterConflict(scope,storage,old,()=>next,async()=>{throw Error('offline');}),/offline/);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>{throw Error('chave antiga deve permanecer');}),old);
  const calls=[];
  assert.equal(await recoverPedidoCreateIntentAfterConflict(scope,storage,old,()=>next,async received=>{calls.push(received);assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>next),old);}),next);
  assert.deepEqual(calls,[scope]);
  assert.equal(getOrCreatePedidoIntentKey(scope,storage,()=>{throw Error('chave nova deve permanecer');}),next);
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


test('explainPedidoPersistenceError: coluna idempotency_key ausente → mensagem 044 explícita', () => {
  const msg = explainPedidoPersistenceError({
    message: 'column "idempotency_key" of relation "pedidos" does not exist',
    code: '42703',
  });
  assert.ok(msg);
  assert.match(msg, /044/);
  assert.match(msg, /não foi confirmado como salvo/i);
  assert.equal(explainPedidoPersistenceError({ message: 'timeout de rede' }), null);
  assert.equal(explainPedidoPersistenceError(null), null);
});

test('explainPedidoPersistenceError: body API com payload_fingerprint', () => {
  const msg = explainPedidoPersistenceError({
    status: 500,
    body: { error: { message: 'column payload_fingerprint does not exist' } },
  });
  assert.ok(msg);
  assert.match(msg, /idempotência/i);
});

test('PedidoCanonicoPanel e OrcamentosTab usam explainPedidoPersistenceError (não mascaram 044)', async () => {
  const panel = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(panel, /explainPedidoPersistenceError/);
  assert.match(orc, /explainPedidoPersistenceError/);
});
