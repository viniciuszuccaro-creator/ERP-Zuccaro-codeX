import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {commandAuditHunks,commandAuditRemainder} from './helpers/commandAuditRemainder.js';

const request='src/components/estoque/RequisicoesAlmoxarifadoTab.jsx',xml='src/components/fiscal/ImportarXMLNFe.jsx';
const cnab='src/components/financeiro/GestaoRemessaRetorno.jsx',crm='src/components/crm/OportunidadesLista.jsx';
const delivery='src/components/comercial/PedidosEntregaTab.jsx';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const hashes={
 [request]:'9e8789398e487531a0999ccbb451c70a20b9a35ec3121291e7385a0aa6d17436',
 [xml]:'05bb711a152d1282df6fdcf13ca0b971903680c6edee70a4774b1c501e5f6d96',
 [cnab]:'21dbf581aff477adc3ae9c67d21158a6609ec7e81335ef421545acac14d1b674',
 [crm]:'7411e59147125363149d393df40bb943720f07bc3b90ad022d703313573accbf',
 [delivery]:'0a2b2991456f4fd8cd86d67a6287fa4a6694fcf56aa7e9f9e950e7292a8f8621',
};
for(const file of Object.keys(hashes))test(`${file}: whole stage61 source retained outside exact command/audit hunks`,()=>{
 const source=read(file);assert.equal(crypto.createHash('sha256').update(commandAuditRemainder(file,source)).digest('hex'),hashes[file]);
 for(const [after] of commandAuditHunks[file]){
  assert.throws(()=>commandAuditRemainder(file,source.replace(after,'')));
  assert.throws(()=>commandAuditRemainder(file,source.replace(after,after+after)));
 }
});
function nodes(source,predicate){const root=ts.createSourceFile('actual.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),result=[];
 const visit=node=>{if(predicate(node))result.push(node);ts.forEachChild(node,visit);};visit(root);return result;
}
function variable(file,name,source=read(file)){
 const matches=nodes(source,node=>ts.isVariableDeclaration(node)&&node.name.getText()===name);assert.equal(matches.length,1,name);return matches[0].initializer.getText();
}
const evaluate=(source,deps)=>new Function(...Object.keys(deps),`return (${source});`)(...Object.values(deps));
function command(file,name,deps){const source=variable(file,name),matches=nodes(source,node=>ts.isPropertyAssignment(node)&&node.name.getText()==='mutationFn');assert.equal(matches.length,1);return evaluate(matches[0].initializer.getText(),deps);}
function requestScope(empresaAtual,grupoAtual){const deps={empresaAtual,grupoAtual};const groupId=evaluate(variable(request,'groupId'),deps);return {...deps,groupId,contextoValido:evaluate(variable(request,'contextoValido'),{...deps,groupId})};}
test('request group comes from canonical owners, not the textual context mode',()=>{
 for(const [company,group,expected] of [[{id:'e',group_id:'g'},null,'g'],[{id:'e',grupo_id:'g'},null,'g'],[{id:'e',group_id:'g'},{id:'g'},'g'],[null,{id:'g'},'g']]){
  const scope=requestScope(company,group);assert.equal(scope.groupId,expected);assert.equal(scope.contextoValido,true);
 }
});
test('request missing or contradictory group evidence fails closed',()=>{
 for(const [company,group] of [[null,null],[{id:'e'},null],[{id:'e',group_id:'g'},{id:'other'}],[{id:'e',group_id:'g',grupo_id:'other'},null],[{id:'e',group_id:42},null]])assert.equal(requestScope(company,group).contextoValido,false);
});
test('counterproof: legacy stock request accepted contradictory owner aliases while the new canonical evidence gate rejects them',()=>{
 const empresaAtual={id:'synthetic-e',group_id:'synthetic-g',grupo_id:'synthetic-other'},grupoAtual=null;
 const before=commandAuditRemainder(request,read(request));
 assert.equal(evaluate(variable(request,'contextoValido',before),{empresaAtual,grupoAtual}),true);
 assert.equal(requestScope(empresaAtual,grupoAtual).contextoValido,false);
});
test('counterproof: actual legacy command read group_id from a string; the current movement carries canonical group ownership',async()=>{
 const payload={itens:[{produto_id:'synthetic-product',quantidade:1}],numero_requisicao:'SYNTHETIC'};
 for(const before of [true,false]){
  const rows=[],scope=requestScope({id:'synthetic-e',group_id:'synthetic-g'},null);
  const deps={...scope,contexto:'empresa',canCreateRequisicao:true,produtos:[],createInContext:async(...args)=>rows.push(args),updateInContext:async()=>assert.fail('unexpected update')};
  const source=before?commandAuditRemainder(request,read(request)):read(request);
  const mutation=variable(request,'createMutation',source),fn=nodes(mutation,node=>ts.isPropertyAssignment(node)&&node.name.getText()==='mutationFn')[0].initializer.getText();
  await evaluate(fn,deps)(payload);assert.equal(rows[0][1].group_id,before?undefined:'synthetic-g');
 }
});
test('actual stock command rejects invalid context/permission before any movement and stamps movement/audit with the same group',async()=>{
 for(const denied of ['context','permission',null]){
  const writes=[],scope=requestScope({id:'synthetic-e',group_id:'synthetic-g'},{id:'synthetic-g'});
  const deps={...scope,contextoValido:denied==='context'?false:scope.contextoValido,canCreateRequisicao:denied!=='permission',produtos:[],
   createInContext:async(...args)=>writes.push(args),updateInContext:async()=>assert.fail('no product to update')};
  const run=command(request,'createMutation',deps),payload={numero_requisicao:'SYNTHETIC',itens:[{produto_id:'synthetic-product',quantidade:2}],data_requisicao:'2026-01-01'};
  if(denied){await assert.rejects(run(payload));assert.deepEqual(writes,[]);}else{
   await run(payload);assert.deepEqual(writes.map(row=>row[0]),['MovimentacaoEstoque','AuditLog']);
   assert.equal(writes[0][1].group_id,'synthetic-g');assert.equal(writes[1][1].group_id,'synthetic-g');assert.equal(writes[1][1].grupo_id,'synthetic-g');assert.equal(writes[0][1].empresa_id,'synthetic-e');
  }
 }
});
test('XML audit ownership never falls back to the metadata being logged',async()=>{
 for(const groupId of [null,'synthetic-active-g']){
  const rows=[],run=evaluate(variable(xml,'auditImportacaoXML'),{groupId,empresaSelecionadaId:null,createInContext:async(...args)=>rows.push(args),console:{error:()=>assert.fail('unexpected log')}});
  const dados={group_id:'synthetic-other-g',empresa_id:'synthetic-other-e',arquivo:'synthetic.xml'};
  await run({acao:'Synthetic.audit',dados});const row=rows[0][1];
  assert.equal(row.group_id,groupId);assert.equal(row.grupo_id,groupId);assert.equal(row.empresa_id,null);assert.equal(row.dados_novos,dados);
 }
});
test('XML audit failure preserves rejection identity and logs only a fixed message',async()=>{
 const error=new Error('synthetic sensitive detail'),logs=[];
 const run=evaluate(variable(xml,'auditImportacaoXML'),{groupId:'synthetic-g',empresaSelecionadaId:'synthetic-e',createInContext:async()=>{throw error;},console:{error:(...args)=>logs.push(args)}});
 await assert.rejects(run({acao:'Synthetic.audit'}),actual=>actual===error);
 assert.deepEqual(logs,[['Falha ao auditar importacao XML NF-e.']]);
});
test('CNAB rejection audit accepts absent record/before/after values without creating identifiers or financial writes',async()=>{
 const rows=[],run=evaluate(variable(cnab,'auditarCNAB'),{groupId:'synthetic-g',empresaId:'synthetic-e',user:{id:'synthetic-u'},base44:{entities:{AuditLog:{create:async row=>rows.push(row)}}},console:{warn:()=>assert.fail('unexpected log')}});
 await run({acao:'Synthetic.blocked',descricao:'Synthetic reason',sucesso:false});
 assert.equal(rows[0].registro_id,null);assert.equal(rows[0].dados_anteriores,undefined);assert.equal(rows[0].dados_novos,undefined);assert.equal(rows[0].tipo_auditoria,'seguranca');assert.equal(rows[0].group_id,'synthetic-g');
});
test('CNAB audit keeps its existing informational error policy, with sanitized logging, not a rollback guarantee',async()=>{
 const logs=[],run=evaluate(variable(cnab,'auditarCNAB'),{groupId:'synthetic-g',empresaId:'synthetic-e',user:null,base44:{entities:{AuditLog:{create:async()=>{throw Error('synthetic detail');}}}},console:{warn:(...args)=>logs.push(args)}});
 await run({acao:'Synthetic.audit',descricao:'Synthetic'});assert.deepEqual(logs,[['Falha ao auditar CNAB.']]);
});
test('actual CRM command denies primitives/arrays before create and retains producer fields and computed defaults for objects',async()=>{
 for(const data of [undefined,null,1,'synthetic',[],false]){
  let writes=0;const run=command(crm,'createMutation',{assertWrite:()=>{},createInContext:async()=>{writes++;}});
  await assert.rejects(run(data),/Dados da oportunidade invalidos/);assert.equal(writes,0);
 }
 const rows=[],checks=[],payload={titulo:'Synthetic',cliente_nome:'Synthetic',quantidade_interacoes:99,dias_sem_contato:99,observacoes:'Synthetic note'};
 const run=command(crm,'createMutation',{assertWrite:(...args)=>checks.push(args),createInContext:async(...args)=>{rows.push(args);return {id:'synthetic-created'};}});
 assert.deepEqual(await run(payload),{id:'synthetic-created'});assert.deepEqual(rows,[['Oportunidade',{...payload,quantidade_interacoes:0,dias_sem_contato:0}]]);assert.deepEqual(checks,[['criar'],['criar',true]]);
});
test('actual CRM command still checks authorization before payload and propagates persistence failure',async()=>{
 const error=Error('synthetic denial');let writes=0;
 await assert.rejects(command(crm,'createMutation',{assertWrite:()=>{throw error;},createInContext:async()=>{writes++;}})(null),actual=>actual===error);assert.equal(writes,0);
 await assert.rejects(command(crm,'createMutation',{assertWrite:()=>{},createInContext:async()=>{throw error;}})({titulo:'Synthetic'}),actual=>actual===error);
});
test('actual timeline binding forwards the existing parent gates/audit, and denied timelines expose no map link',async()=>{
 const jsx=nodes(read(delivery),node=>ts.isJsxSelfClosingElement(node)&&node.tagName.getText()==='TimelineEntregaVisual');assert.equal(jsx.length,1);
 const audit=[],env={entregaSelecionada:{pedido:{id:'synthetic-p',numero_pedido:'Synthetic',status:'Aprovado',endereco_entrega_principal:{mapa_url:'https://www.google.com/maps'}},entrega:{id:'synthetic-delivery'}},auditEntrega:async payload=>audit.push(payload)};
 const file='src/components/logistica/TimelineEntregaVisual.jsx';const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 const ui=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:props=>React.createElement('span',null,props.children)}),exports={};
 new Function('require','exports',code)(name=>name==='react'?React:ui,exports);
 const links=tree=>!tree||typeof tree!=='object'?[]:tree.type==='a'?[tree]:[tree.props?.children].flat(Infinity).flatMap(links);
 for(const [contextoValido,canView] of [[false,true],[true,false],[true,true]]){
  const values={...env,contextoValido,canView},props={};
  for(const attr of jsx[0].attributes.properties){assert.ok(ts.isJsxAttribute(attr)&&ts.isJsxExpression(attr.initializer));props[attr.name.getText()]=evaluate(attr.initializer.expression.getText(),values);}
  assert.equal(props.onAudit,env.auditEntrega);const rendered=links(exports.default(props));
  if(!contextoValido||!canView)assert.deepEqual(rendered,[]);else{assert.equal(rendered.length,1);await rendered[0].props.onClick();assert.equal(audit[0].acao,'TimelineEntrega.mapa.abrir');assert.equal(audit[0].detalhes.pedido_id,'synthetic-p');}
 }
});
