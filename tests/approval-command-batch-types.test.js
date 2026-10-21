import test from 'node:test';
import {commandAuditRemainder} from './helpers/commandAuditRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {isStatusBackupConcluido} from '../src/components/lib/viradaProducaoPolicy.js';
import {primitiveUiBoundaryRemainder} from './helpers/primitiveUiBoundaryRemainder.js';
import {financialUiBoundaryRemainder} from './helpers/financialUiBoundaryRemainder.js';

const entries={
  notification:{file:'NotificationCenter',hash:'e25a1e6742bc84e8b3e9858bfa6b8b0f02dc410af19ef3260e5c9cc8b2bf5a7b',names:['marcarComoLidaMutation','arquivarMutation']},
  backup:{file:'sistema/HistoricoBackups',hash:'38b4d8c241861722efab1b624a4aa03be1b6e27407cb92773755fcecdc11f22a',names:['excluirMutation']},
  crm:{file:'crm/FunilVendasAvancado',hash:'4863f01a512e1fdc4c62b31a94d9914c8af1c7ceb05443c278f48704c7ff0737',names:['updateEtapaMutation','priorizarIAMutation']},
  pdv:{file:'financeiro/CaixaPDVCompleto',hash:'9fe62f62709098a9e800e4aa92f8993b564171eaeb7784ba8e83fcde642bbaee',names:['abrirCaixa','liquidarTitulo'],state:'saldoInicial'},
  retirada:{file:'comercial/PedidosRetiradaTab',hash:'59b05bce4cb0cce1126e0815e6fb91e4bf290dbaa671a62a55ddcbc4c5255cfb',names:['atualizarStatusMutation','confirmarRetiradaMutation']},
  central:{file:'comercial/CentralAprovacoesManager',hash:'3cd1cf8a9292a75d061ebbb000dfb28146fb45f396f397d6d485b7fe65383ee1',names:['aprovarPedidoMutation','negarPedidoMutation']},
  entrega:{file:'comercial/PedidosEntregaTab',hash:'158c6dc5c5eafdb3b6b06500aea3a00c6952049c84a654602264cfdfad5f0dd2',names:['atualizarStatusMutation']},
  compra:{file:'compras/OrdensCompraTab',hash:'4fd71e268eb4ac9a454d986314501dd362d06fcf76aea9e09cc78b753dddd78c',names:['createMutation','updateMutation','aprovarMutation','enviarFornecedorMutation','avaliarFornecedorMutation'],state:'avaliacaoFormData'},
};
function astFor(kind){const file='src/components/'+entries[kind].file+'.jsx';return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);}
function variable(kind,name){const ast=astFor(kind);let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&(name===entries[kind].state?ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name:node.name.getText(ast)===name)){assert.ok(found===undefined,`Duplicate variable: ${name}`);found=node;}ts.forEachChild(node,visit);}visit(ast);assert.ok(found,name);return {ast,node:found};
}
function command(kind,name){const {ast,node}=variable(kind,name);return {ast,fn:node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer};}
function bind(kind,name,deps){const {ast,fn}=command(kind,name);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
const record=()=>({id:'synthetic-record',numero_pedido:'SYNTHETIC',empresa_id:'synthetic-a',group_id:'synthetic-group',historico_status:[],historico:[],status:'Solicitada'});
function payload(kind,name){
  if(kind==='notification'||kind==='backup')return 'synthetic-record';
  if(kind==='crm')return name==='updateEtapaMutation'?{id:'synthetic-record',etapa:'Proposta'}:{cliente_nome:'Synthetic client',valor_estimado:20,etapa_funil:'Proposta',origem:'Synthetic',data_ultimo_contato:'2026-10-20'};
  if(kind==='pdv')return name==='abrirCaixa'?20:{titulo:{id:'synthetic-title',valor:20,cliente:'Synthetic client',fornecedor:'Synthetic supplier'},tipo:'receber',forma:'Synthetic form'};
  if(kind==='retirada')return name==='atualizarStatusMutation'?{pedidoId:'synthetic-record',novoStatus:'Pronto para Retirada'}:{pedido:{...record(),cliente_id:'synthetic-client',cliente_nome:'Synthetic client',itens_revenda:[{produto_id:'synthetic-product',quantidade:2,unidade:'UN'}]}};
  if(kind==='central')return name==='negarPedidoMutation'?{pedidoId:'synthetic-record',comentarios:'Synthetic reason'}:{pedidoId:'synthetic-record',dados:{valorFinal:20,comentarios:'Synthetic comment'},executarFechamento:false};
  if(kind==='entrega')return {pedidoId:'synthetic-record',novoStatus:'Em Rota'};
  if(name==='createMutation')return {numero_oc:'SYNTHETIC',opaque:{synthetic:true}};
  if(name==='updateMutation')return {id:'synthetic-record',data:{observacoes:'Synthetic note'}};
  if(name==='avaliarFornecedorMutation')return {oc:{...record(),fornecedor_id:'synthetic-supplier',fornecedor_nome:'Synthetic supplier'},avaliacao:{nota:5,qualidade:5,prazo:4,preco:3,atendimento:4,comentario:'Synthetic comment'}};
  return {id:'synthetic-record',oc:record()};
}
function invalid(kind,name){const data=payload(kind,name);
  if(kind==='pdv'&&name==='abrirCaixa')return 'invalid';
  if(kind==='notification'||kind==='backup'||kind==='compra'&&name==='createMutation')return 123;
  if(kind==='crm')return name==='updateEtapaMutation'?{...data,id:123}:{...data,valor_estimado:false};
  if(kind==='pdv')return {...data,titulo:{...data.titulo,valor:'invalid'}};
  if(kind==='retirada')return name==='atualizarStatusMutation'?{...data,novoStatus:false}:{...data,pedido:{...data.pedido,id:123}};
  if(kind==='central')return name==='negarPedidoMutation'?{...data,comentarios:123}:{...data,executarFechamento:'false'};
  if(kind==='entrega')return {novoStatus:'Em Rota'};
  if(name==='avaliarFornecedorMutation')return {...data,avaliacao:{...data.avaliacao,qualidade:'invalid'}};
  if(name==='updateMutation')return {...data,id:123};return {...data,oc:{...data.oc,historico:123}};
}
for(const [kind,entry] of Object.entries(entries))test(`${entry.file}: whole executable runtime unchanged`,()=>{
  const file='src/components/'+entry.file+'.jsx';
  const emitted=ts.transpileModule(primitiveUiBoundaryRemainder(file,financialUiBoundaryRemainder(file,commandAuditRemainder(file,fs.readFileSync(file,'utf8')))),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),entry.hash);
});
test('seventeen actual command parameters preserve valid payloads and reject malformed envelopes',()=>{
  let source="import {useMutation} from '@tanstack/react-query';\nimport {useState} from 'react';\n";const negative=[];
  for(const [kind,entry] of Object.entries(entries))for(const name of entry.names){
    const {ast,fn}=command(kind,name);source+='{\n';
    if(kind==='entrega'){const decl=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PedidosEntregaTab');for(const doc of decl.jsDoc||[])source+=doc.getText(ast)+'\n';}
    if(entry.state){const state=variable(kind,entry.state);source+=`const ${state.node.name.getText(state.ast)}=${state.node.initializer.getText(state.ast)};\n`;}
    source+=`const c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nc.mutate(${JSON.stringify(payload(kind,name))});\n`;
    if(kind==='entrega')source+=`c.mutate(${JSON.stringify({pedido:record(),entrega:{id:'synthetic-delivery',opaque:{synthetic:true}},novoStatus:'Em Rota'})});\n`;
    negative.push(source.split('\n').length-1);source+=`c.mutate(${JSON.stringify(invalid(kind,name))});\n}\n`;
  }
  const filename=path.resolve('src/components/compras/synthetic-approval-fixture.js'),options={allowJs:true,checkJs:true,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negative,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));assert.equal(negative.length,17);
});
function environment(override={}){
  const writes=[],audits=[],lookups=[];
  const create=async(entity,data)=>{writes.push(['create',entity,data]);return {id:'synthetic-created',...data};};
  const update=async(entity,id,data)=>{writes.push(['update',entity,id,data]);return {id,...data};};
  const base44={entities:{},integrations:{Core:{InvokeLLM:async()=>{throw new Error('synthetic provider disabled');}}}};
  for(const entity of ['Notificacao','Pedido','MovimentacaoEstoque','Produto','Entrega'])base44.entities[entity]={create:data=>create(entity,data),update:(id,data)=>update(entity,id,data),filter:async query=>{lookups.push([entity,query]);return [{id:'synthetic-product',estoque_atual:10}];}};
  base44.entities.BackupAutomatico={restore:async(id,options)=>{writes.push(['synthetic-restore',id,options]);return {backup:{id},summary:{synthetic:true}};}};
  const deps={base44,createInContext:create,updateInContext:update,filterInContext:async(entity,filter)=>{lookups.push([entity,filter]);return [record()];},
    contextoValido:true,podeEditarAprovacoes:true,canEdit:true,canEntregar:true,canRegisterProof:true,canApproveOC:true,canSendOC:true,canRestaurar:true,canExpirar:true,controlesDesabilitados:false,podeLiquidarTitulosReceber:true,podeLiquidarTitulosPagar:true,
    user:{id:'synthetic-user',full_name:'Synthetic user'},authUser:{id:'synthetic-user',full_name:'Synthetic user'},hasPermission:()=>false,validarLimiteCredito:async()=>({aprovado:true}),
    groupId:'synthetic-group',empresaId:'synthetic-a',empresaContextoId:'synthetic-a',empresaAtual:{id:'synthetic-a'},grupoAtivoId:'synthetic-group',empresaAtivaId:'synthetic-a',effectiveGroupId:'synthetic-group',effectiveEmpresaId:'synthetic-a',
    auditAprovacao:async value=>audits.push(value),auditEntrega:async value=>audits.push(value),auditCaixaAction:async(...args)=>audits.push(args),auditOrdemCompra:async value=>audits.push(value),auditBackup:async value=>audits.push(value),
    pedidos:[record()],entregas:[],fornecedores:[],withContextData:data=>data,window:{confirm:()=>true},
    nomeRecebedor:'Synthetic recipient',docRecebedor:'synthetic-document',observacoes:'Synthetic note',hoje:'2026-10-20',isStatusBackupConcluido,toast:{success:()=>{}},...override};
  return {writes,audits,lookups,deps};
}
test('notification/read/archive and CRM stage forwarding preserve existing exact fields',async()=>{
  for(const [name,field] of [['marcarComoLidaMutation','lida'],['arquivarMutation','arquivada']]){const e=environment();await bind('notification',name,e.deps)('synthetic-record');assert.equal(e.writes[0][1],'Notificacao');assert.equal(e.writes[0][3][field],true);}
  const e=environment();await bind('crm','updateEtapaMutation',e.deps)(payload('crm','updateEtapaMutation'));assert.equal(e.writes[0][3].etapa,'Proposta');assert.equal(e.writes[0][3].etapa_funil,'Proposta');
  await assert.rejects(bind('crm','priorizarIAMutation',e.deps)(payload('crm','priorizarIAMutation')),/synthetic provider disabled/);assert.equal(e.writes.length,1);
});
test('PDV opening/liquidation preserve context/action denial, cancellation and current write order',async()=>{
  const denied=environment({controlesDesabilitados:true});await assert.rejects(bind('pdv','abrirCaixa',denied.deps)(20));assert.deepEqual(denied.writes,[]);
  const opened=environment();await bind('pdv','abrirCaixa',opened.deps)(20);assert.equal(opened.writes[0][2].valor,20);assert.equal(opened.writes[0][2].group_id,'synthetic-group');
  for(const tipo of ['receber','pagar']){
    const name=tipo==='receber'?'podeLiquidarTitulosReceber':'podeLiquidarTitulosPagar';
    for(const override of [{contextoValido:false},{[name]:false},{window:{confirm:()=>false}}]){const e=environment(override);await assert.rejects(bind('pdv','liquidarTitulo',e.deps)({...payload('pdv','liquidarTitulo'),tipo}));assert.deepEqual(e.writes,[]);}
    const e=environment();await bind('pdv','liquidarTitulo',e.deps)({...payload('pdv','liquidarTitulo'),tipo});assert.equal(e.writes[0][1],tipo==='receber'?'ContaReceber':'ContaPagar');assert.equal(e.writes[1][1],'CaixaMovimento');assert.equal(e.writes[1][2].empresa_id,'synthetic-a');
  }
});
test('approval central preserves guards, missing order/credit denial, item split and optional closure result',async()=>{
  for(const name of entries.central.names)for(const override of [{contextoValido:false},{podeEditarAprovacoes:false}]){const e=environment(override);await assert.rejects(bind('central',name,e.deps)(payload('central',name)));assert.deepEqual(e.writes,[]);}
  const missing=environment({filterInContext:async()=>[]});await assert.rejects(bind('central','aprovarPedidoMutation',missing.deps)(payload('central','aprovarPedidoMutation')),/encontrado/);assert.deepEqual(missing.writes,[]);
  const credit=environment({validarLimiteCredito:async()=>({aprovado:false,motivo:'synthetic denied credit'})});await assert.rejects(bind('central','aprovarPedidoMutation',credit.deps)(payload('central','aprovarPedidoMutation')),/synthetic denied credit/);assert.deepEqual(credit.writes,[]);
  const e=environment(),input=payload('central','aprovarPedidoMutation');input.dados.itensAtualizados=[{tipo:'Revenda',synthetic:true}];input.executarFechamento=true;
  const result=await bind('central','aprovarPedidoMutation',e.deps)(input);assert.equal(e.writes[0][3].itens_revenda.length,1);assert.equal(e.writes[0][3].valor_total,20);assert.equal(result.executarFechamento,true);assert.equal(result.pedido.id,'synthetic-record');
  const denied=environment();await bind('central','negarPedidoMutation',denied.deps)(payload('central','negarPedidoMutation'));assert.equal(denied.writes[0][3].status_aprovacao,'negado');assert.equal(denied.audits[0].detalhes.comentarios,'Synthetic reason');
});
test('delivery status retains context/proof/confirmation gates and Entrega then Pedido then audit sequence',async()=>{
  for(const override of [{contextoValido:false},{canEdit:false,canEntregar:false},{window:{confirm:()=>false}}]){const e=environment(override);await assert.rejects(bind('entrega','atualizarStatusMutation',e.deps)(payload('entrega','atualizarStatusMutation')));assert.deepEqual(e.writes,[]);}
  const noProof=environment();await assert.rejects(bind('entrega','atualizarStatusMutation',noProof.deps)({...payload('entrega','atualizarStatusMutation'),novoStatus:'Entregue'}),/comprovante/);assert.deepEqual(noProof.writes,[]);
  const e=environment(),input={pedido:record(),novoStatus:'Entregue',entrega:{id:'synthetic-delivery',comprovante_entrega:{nome_recebedor:'Synthetic recipient'}}};
  await bind('entrega','atualizarStatusMutation',e.deps)(input);assert.deepEqual(e.writes.map(row=>row[1]),['Entrega','Pedido']);assert.equal(e.writes[0][3].group_id,'synthetic-group');assert.equal(e.writes[1][3].empresa_id,'synthetic-a');assert.equal(e.audits.at(-1).acao,'PedidoEntrega.alterar_status');
});
test('pickup preserves product lookup company and movement/product/order/delivery ordering with synthetic stock',async()=>{
  const e=environment();await bind('retirada','confirmarRetiradaMutation',e.deps)(payload('retirada','confirmarRetiradaMutation'));
  assert.equal(e.lookups[0][1].empresa_id,'synthetic-a');assert.deepEqual(e.writes.map(row=>row[1]),['MovimentacaoEstoque','Produto','Pedido','Entrega']);assert.equal(e.writes[1][3].estoque_atual,8);assert.equal(e.writes[3][2].comprovante_entrega.nome_recebedor,'Synthetic recipient');
  const status=environment();await bind('retirada','atualizarStatusMutation',status.deps)(payload('retirada','atualizarStatusMutation'));assert.equal(status.writes[0][3].status,'Pronto para Retirada');
});
test('purchase basic/edit/approve/send/evaluation commands preserve guarded transitions and current fields',async()=>{
  for(const [name,permission] of [['aprovarMutation','canApproveOC'],['enviarFornecedorMutation','canSendOC']]){
    for(const override of [{contextoValido:false},{[permission]:false}]){const e=environment(override);await assert.rejects(bind('compra',name,e.deps)(payload('compra',name)));assert.deepEqual(e.writes,[]);}
    const e=environment();await bind('compra',name,e.deps)(payload('compra',name));assert.equal(e.writes[0][3].historico.length,1);
  }
  for(const name of ['createMutation','updateMutation']){const e=environment();await bind('compra',name,e.deps)(payload('compra',name));assert.equal(e.writes[0][1],'OrdemCompra');}
  const e=environment();await bind('compra','avaliarFornecedorMutation',e.deps)(payload('compra','avaliarFornecedorMutation'));assert.equal(e.writes[0][3].avaliacao_fornecedor.nota,4);
});
test('backup commands exercise only synthetic service stubs, preserve context/permission/status gates and audit',async()=>{
  for(const override of [{contextoValido:false},{canRestaurar:false}]){const e=environment(override);await assert.rejects(bind('backup','restaurarMutation',e.deps)({id:'synthetic-backup',status:'concluido'}));assert.deepEqual(e.writes,[]);}
  const invalidStatus=environment();await assert.rejects(bind('backup','restaurarMutation',invalidStatus.deps)({id:'synthetic-backup',status:'pendente'}));assert.deepEqual(invalidStatus.writes,[]);
  const e=environment();await bind('backup','restaurarMutation',e.deps)({id:'synthetic-backup',status:'concluido'});assert.equal(e.writes[0][0],'synthetic-restore');assert.deepEqual(e.writes[0][2],{group_id:'synthetic-group',empresa_id:'synthetic-a'});assert.equal(e.audits[0].acao,'Backup.restaurar');
  for(const override of [{contextoValido:false},{canExpirar:false}]){const item=environment(override);await assert.rejects(bind('backup','excluirMutation',item.deps)('synthetic-backup'));assert.deepEqual(item.writes,[]);}
  const expire=environment();await bind('backup','excluirMutation',expire.deps)('synthetic-backup');assert.equal(expire.writes[0][3].status,'Expirado');
});
test('command failures propagate and later-write failure does not prove earlier side effects rolled back',async()=>{
  const fail=async()=>{throw new Error('synthetic failure');};
  for(const [kind,entry] of Object.entries(entries))for(const name of entry.names){
    const e=environment({createInContext:fail,updateInContext:fail});for(const entity of Object.values(e.deps.base44.entities)){entity.create=fail;entity.update=fail;}e.deps.base44.integrations.Core.InvokeLLM=fail;
    await assert.rejects(bind(kind,name,e.deps)(payload(kind,name)),/synthetic failure/);
  }
  const e=environment({createInContext:fail});await assert.rejects(bind('pdv','liquidarTitulo',e.deps)(payload('pdv','liquidarTitulo')),/synthetic failure/);assert.equal(e.writes[0][3].status,'Recebido');
});
