import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const cot='src/components/compras/CotacoesTab.jsx',sol='src/components/compras/SolicitacoesCompraTab.jsx';
const cases=[[cot,'criarCotacaoMutation'],[cot,'gerarOrdemCompraMutation'],[sol,'createMutation'],[sol,'aprovarMutation'],[sol,'rejeitarMutation'],[sol,'gerarOCMutation']];
const proposal={fornecedor_id:'synthetic-supplier',fornecedor_nome:'Synthetic supplier',valor_total:20,forma_pagamento:'Synthetic terms',prazo_entrega:7,itens:[{produto_descricao:'Synthetic product',quantidade:2,preco_unitario:10,valor_total:20}]};
function variable(file,name){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&(node.name.getText(ast)===name||(ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name))){assert.equal(found,undefined);found=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(found,name);return {ast,node:found};
}
function command(file,name){const {ast,node}=variable(file,name);return {ast,fn:node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer};}
function bind(file,name,deps,mutation=false){const {ast,fn}=mutation?command(file,name):{...variable(file,name),fn:variable(file,name).node.initializer};return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initial(file){const name=file===cot?'formCotacao':'formData',{ast,node}=variable(file,name);return {name,text:node.initializer.arguments[0].getText(ast)};}
function form(file){return new Function(`return (${initial(file).text});`)();}
function payload(file,name){
  if(name==='gerarOrdemCompraMutation')return structuredClone(proposal);
  if(name==='aprovarMutation')return {id:'synthetic-request'};
  if(name==='rejeitarMutation')return {id:'synthetic-request',motivo:'Synthetic reason'};
  if(name==='gerarOCMutation')return {id:'synthetic-request',produto_id:'synthetic-product',produto_descricao:'Synthetic product',quantidade_solicitada:2,unidade_medida:'UN'};
  return form(file);
}
for(const [file,hash] of [[cot,'a47e21080cf561c2a9f9d20038519e90acfdc8cf11d2a4e5be4978f7341b64c9'],[sol,'aebd4dfc9c1fd5aaa78de56cba53cb10510cfe30c21d185e85d2defe25204b1a']])test(`${file}: full executable runtime unchanged`,()=>{
  const emitted=ts.transpileModule(iaResponseValidationRemainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
test('six actual command parameters accept existing payloads and reject invalid types and missing fields',()=>{
  let source="import {useMutation} from '@tanstack/react-query';\n";const negative=[];
  for(const [file,name] of cases){
    const {ast,fn}=command(file,name),state=initial(file);
    source+=`{\nconst ${state.name}=${state.text};\nconst c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\n`;
    source+=`c.mutate(${JSON.stringify(payload(file,name))});\n`;
    const bad=name==='criarCotacaoMutation'?{...payload(file,name),descricao:123}:name==='createMutation'?{...payload(file,name),quantidade_solicitada:'invalid'}:name==='gerarOrdemCompraMutation'?{...proposal,itens:[{...proposal.itens[0],preco_unitario:'invalid'}]}:{...payload(file,name),id:123};
    for(const input of [bad,{}]){negative.push(source.split('\n').length-1);source+=`c.mutate(${JSON.stringify(input)});\n`;}
    source+='}\n';
  }
  const filename=path.resolve('tests/synthetic-purchase-request.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negative,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
});
function environment(override={}){
  const writes=[],audits=[],commands=[],notices=[];
  const deps={contextoValido:true,canCreateCotacao:true,canGerarOC:true,canCreateSolicitacao:true,canApproveSolicitacao:true,canRejectSolicitacao:true,
    groupId:'synthetic-group',empresaId:'synthetic-a',user:{id:'synthetic-user',full_name:'Synthetic user'},comparativoModal:{id:'synthetic-quote'},
    setTimeout:fn=>fn(),window:{confirm:()=>true},confirm:()=>true,prompt:()=> 'Synthetic reason',toast:obj=>notices.push(obj),
    auditCotacao:async obj=>audits.push(obj),auditSolicitacaoCompra:async obj=>audits.push(obj),
    createInContext:async(entity,data)=>{writes.push(['create',entity,data]);return {...data,id:'synthetic-created'};},
    updateInContext:async(entity,id,data)=>{writes.push(['update',entity,id,data]);return {id,...data};},
    aprovarMutation:{mutate:obj=>commands.push(obj)},rejeitarMutation:{mutate:obj=>commands.push(obj)},gerarOCMutation:{mutate:obj=>commands.push(obj)},...override};
  return {writes,audits,commands,notices,deps};
}
test('cotacao create/generate and request create preserve action/context denial before domain writes',async()=>{
  for(const [file,name,permission] of [[cot,'criarCotacaoMutation','canCreateCotacao'],[cot,'gerarOrdemCompraMutation','canGerarOC'],[sol,'createMutation','canCreateSolicitacao']]){
    for(const override of [{contextoValido:false},{[permission]:false}]){
      const env=environment(override);await assert.rejects(bind(file,name,env.deps,true)(payload(file,name)));assert.deepEqual(env.writes,[]);assert.equal(env.audits[0].sucesso,false);
    }
  }
});
test('request UI approval/rejection/order handlers keep granular denial and cancelled confirmation',async()=>{
  for(const [name,permission] of [['handleAprovar','canApproveSolicitacao'],['handleRejeitar','canRejectSolicitacao'],['handleGerarOC','canGerarOC']]){
    for(const override of [{contextoValido:false},{[permission]:false},{confirm:()=>false,prompt:()=>null}]){
      const env=environment(override);bind(sol,name,env.deps)({id:'synthetic-request',produto_descricao:'Synthetic product'});assert.deepEqual(env.commands,[]);assert.deepEqual(env.writes,[]);
    }
    const env=environment();bind(sol,name,env.deps)({id:'synthetic-request',produto_descricao:'Synthetic product'});assert.equal(env.commands.length,1);
  }
});
test('quote creation and order conversion preserve scoped field mapping and cancellation audit',async()=>{
  const env=environment(),input={...form(cot),descricao:'Synthetic quote',fornecedores_selecionados:['synthetic-one','synthetic-two']};
  await bind(cot,'criarCotacaoMutation',env.deps,true)(input);
  const row=env.writes[0][2];assert.equal(row.group_id,'synthetic-group');assert.equal(row.empresa_id,'synthetic-a');assert.equal(row.fornecedores_convidados,2);assert.equal(row.data_limite,input.data_limite_resposta);assert.equal(env.audits[0].acao,'Cotacao.criada');
  const cancelled=environment({window:{confirm:()=>false}});await assert.rejects(bind(cot,'gerarOrdemCompraMutation',cancelled.deps,true)(proposal),/cancelada/);assert.deepEqual(cancelled.writes,[]);assert.equal(cancelled.audits[0].motivo,'confirmacao_cancelada');
  const generated=environment();await bind(cot,'gerarOrdemCompraMutation',generated.deps,true)(proposal);
  const order=generated.writes[0][2];assert.equal(order.cotacao_id,'synthetic-quote');assert.equal(order.valor_total,20);assert.equal(order.itens[0].valor_unitario,10);assert.equal(order.itens[0].quantidade_solicitada,2);assert.equal(order.status,'Aprovada');assert.equal(order.empresa_id,'synthetic-a');
});
test('request create stamps active identity and existing mutations retain status and write ordering',async()=>{
  const env=environment();await bind(sol,'createMutation',env.deps,true)({...form(sol),empresa_id:'synthetic-other',solicitante:'Synthetic caller'});
  assert.equal(env.writes[0][2].empresa_id,'synthetic-a');assert.equal(env.writes[0][2].solicitante,'Synthetic user');assert.equal(env.writes[0][2].solicitante_id,'synthetic-user');
  for(const [name,status] of [['aprovarMutation','Aprovada'],['rejeitarMutation','Rejeitada']]){const e=environment();await bind(sol,name,e.deps,true)(payload(sol,name));assert.equal(e.writes[0][3].status,status);}
  const e=environment();await bind(sol,'gerarOCMutation',e.deps,true)(payload(sol,'gerarOCMutation'));
  assert.equal(e.writes[0][1],'OrdemCompra');assert.equal(e.writes[0][2].group_id,'synthetic-group');assert.equal(e.writes[1][1],'SolicitacaoCompra');assert.equal(e.writes[1][3].ordem_compra_id,'synthetic-created');assert.equal(e.writes[1][3].status,'Compra Gerada');
});
test('write/audit failures propagate where currently enforced without claiming rollback',async()=>{
  const failure=async()=>{throw new Error('synthetic failure');};
  for(const [file,name] of cases){const env=environment({createInContext:failure,updateInContext:failure});await assert.rejects(bind(file,name,env.deps,true)(payload(file,name)),/synthetic failure/);}
  for(const name of ['criarCotacaoMutation','gerarOrdemCompraMutation']){const env=environment({auditCotacao:failure});await assert.rejects(bind(cot,name,env.deps,true)(payload(cot,name)),/synthetic failure/);assert.equal(env.writes.length,1);}
});
