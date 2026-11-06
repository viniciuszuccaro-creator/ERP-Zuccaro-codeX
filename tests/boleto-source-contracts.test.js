import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {boletoSourceFile,boletoSourceHunks,boletoSourceRemainder} from './helpers/boletoSourceRemainder.js';

const source=fs.readFileSync(boletoSourceFile,'utf8').replace(/\r\n/g,'\n');
const previous=boletoSourceRemainder(boletoSourceFile,source);
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,removeComments:true};
function variable(text,name){
 const ast=ts.createSourceFile(boletoSourceFile,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let match;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.ok(match===undefined);match=node;}ts.forEachChild(node,visit);}
 visit(ast);assert.ok(match);return {ast,node:match};
}
function expression(text,name,callback){
 const {ast,node}=variable(text,name);
 const value=callback?node.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)===callback).initializer:node.initializer;
 return {ast,value};
}
function bind(text,name,deps={},callback){
 const {ast,value}=expression(text,name,callback),exports={};
 new Function(...Object.keys(deps),'exports',ts.transpileModule('exports.callback='+value.getText(ast),{compilerOptions:options}).outputText)(...Object.values(deps),exports);
 return exports.callback;
}
test('complete previous source retained outside exactly five bounded hunks, including UI and all other handlers',()=>{
 assert.equal(crypto.createHash('sha256').update(previous).digest('hex'),'6b18921b5a3307e4edeac03e6f563bc84e2451cb909cc02a70d1257e06bf668d');
 for(const [after] of boletoSourceHunks){assert.throws(()=>boletoSourceRemainder(boletoSourceFile,source.replace(after,'')));assert.throws(()=>boletoSourceRemainder(boletoSourceFile,source.replace(after,after+after)));}
});
function harness({before=false,context=true,company='synthetic-company',permission=true,confirmed=true,writeFailure=false,auditFailure=false}={}){
 const text=before?previous:source,writes=[],audits=[],confirmations=[];
 const deps={contextoValido:context,empresaId:company,groupId:'synthetic-group',podeGerarBoleto:permission,
  conversa:{id:'synthetic-conversation',acoes_automaticas_executadas:[]},
  window:{confirm:message=>{confirmations.push(message);return confirmed;}},
  auditBoletoChat:async(...args)=>{audits.push(args);if(auditFailure)throw Error('synthetic audit failure');},
  updateInContext:async(entity,id,data)=>{writes.push({entity,id,data});if(writeFailure)throw Error('synthetic persistence failure');return {id,...data};},
  Math:{random:()=>0.1234567890123456},
  Date:class extends Date{constructor(){super('2099-01-01T00:00:00Z');}},
 };
 deps.sanitizeText=bind(text,'sanitizeText');deps.sanitizeLinhaDigitavel=bind(text,'sanitizeLinhaDigitavel',{sanitizeText:deps.sanitizeText});deps.isSafeUrl=bind(text,'isSafeUrl');
 deps.withContext=bind(text,'withContext',deps);
 return {writes,audits,confirmations,run:bind(text,'enviarBoletoMutation',deps,'mutationFn')};
}
const title=patch=>({id:'synthetic-title',valor:1,linha_digitavel:'123.45',url_boleto_pdf:'https://synthetic.invalid/boleto.pdf',...patch});
test('counterproof: missing bank artifacts previously fabricated values and persisted them; now no business write occurs',async()=>{
 const old=harness({before:true}),current=harness();
 const result=await old.run(title({linha_digitavel:undefined,url_boleto_pdf:undefined}));
 assert.equal(old.writes.length,2);assert.ok(result.linha_digitavel);assert.ok(result.url_boleto_pdf.includes('boleto.exemplo.com'));
 await assert.rejects(()=>current.run(title({linha_digitavel:undefined,url_boleto_pdf:undefined})),/Boleto indisponivel/);
 assert.deepEqual(current.writes,[]);assert.deepEqual(current.audits,[['bloqueado_boleto_indisponivel',false,{titulo_id:'synthetic-title'}]]);
});
test('missing/blank/sanitized-away line or URL cannot reach title/conversation persistence',async()=>{
 for(const patch of [{linha_digitavel:''},{linha_digitavel:'letters-only'},{url_boleto_pdf:''},{linha_digitavel:null,url_boleto_pdf:null}]){
  const h=harness();await assert.rejects(()=>h.run(title(patch)),/Boleto indisponivel/);assert.deepEqual(h.writes,[]);
 }
});
test('command rejects invalid title identities before confirmation, audit or persistence',async()=>{
 for(const value of [null,undefined,[],{},title({id:123}),title({id:''}),title({id:'   '})]){
  const h=harness();await assert.rejects(()=>h.run(value),/Selecione um titulo/);
  assert.deepEqual(h.confirmations,[]);assert.deepEqual(h.writes,[]);assert.deepEqual(h.audits,[]);
 }
});
for(const [label,settings] of [['context',{context:false}],['company',{company:null}],['permission',{permission:false}],['cancel',{confirmed:false}]])test(`actual ${label} block is preserved before writes`,async()=>{
 const h=harness(settings);await assert.rejects(()=>h.run(title()));assert.deepEqual(h.writes,[]);assert.equal(h.audits.length,1);
 if(label!=='cancel')assert.deepEqual(h.confirmations,[]);
});
test('existing artifacts preserve title/conversation payloads, callback result and audit behavior without issuing a bank instrument',async()=>{
 for(const patch of [{},{url_boleto_pdf:undefined,boleto_url:'https://synthetic.invalid/legacy.pdf'}]){
  const old=harness({before:true}),current=harness();const input=title(patch);
  assert.deepEqual(await current.run(input),await old.run(input));
  assert.deepEqual(current.writes,old.writes);assert.deepEqual(current.audits,old.audits);
  assert.deepEqual(current.writes.map(write=>write.entity),['ContaReceber','ConversaOmnicanal']);
  assert.equal(current.writes[0].data.group_id,'synthetic-group');assert.equal(current.writes[0].data.empresa_id,'synthetic-company');
 }
});
test('unsafe existing URL retains rejection before title/conversation writes',async()=>{
 const h=harness();await assert.rejects(()=>h.run(title({url_boleto_pdf:'data:text/plain,synthetic'})),/URL do boleto/);assert.deepEqual(h.writes,[]);
});
test('write failure and unavailable-artifact audit failure do not become successful results',async()=>{
 const write=harness({writeFailure:true});await assert.rejects(()=>write.run(title()),/synthetic persistence failure/);assert.equal(write.writes.length,1);assert.deepEqual(write.audits,[]);
 const audit=harness({auditFailure:true});await assert.rejects(()=>audit.run(title({linha_digitavel:''})),/synthetic audit failure/);assert.deepEqual(audit.writes,[]);
});
test('success copy describes availability, not a bank issuance, while preserving callback and invalidation',()=>{
 const calls=[],payload=title();
 bind(source,'enviarBoletoMutation',{
  toast:{success:message=>calls.push(['message',message])},setTituloSelecionado:value=>calls.push(['selected',value]),
  queryClient:{invalidateQueries:query=>calls.push(['invalidate',query])},onBoletoEnviado:value=>calls.push(['callback',value]),
 },'onSuccess')(payload);
 assert.equal(calls[0][1],'Boleto existente disponibilizado.');assert.equal(calls[1][1],payload);assert.equal(calls.at(-1)[1],payload);
 assert.equal(calls.filter(([kind])=>kind==='invalidate').length,2);
});
test('real TypeScript caller contract remains unknown-valued metadata, rejects non-record command and supports guarded identity',()=>{
 const {ast,value}=expression(source,'enviarBoletoMutation','mutationFn');
 const parameter=value.parameters[0].getFullText(ast);
 const fixture=`const accept=async (${parameter})=>{if(!titulo||typeof titulo.id!=='string')throw Error('invalid');return titulo.id;};`;
 const input=fixture+"\naccept({id:'synthetic',opaque:123});\naccept(123);\n";
 const filename=path.resolve('tests/synthetic-boleto-command.js'),config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?input:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));assert.equal(errors.length,1);assert.equal(errors[0].code,2345);
 assert.equal(errors[0].file.getLineAndCharacterOfPosition(errors[0].start).line,input.trimEnd().split('\n').length-1);
});
