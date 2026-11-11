import test from 'node:test';
import {consolidation82Hunks} from './helpers/consolidation82Remainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {isPortalClienteIdentificado,assertPortalOrcamentoIdentificado,calcularChecksumAssinaturaPortal} from '../src/components/lib/portalClientePolicy.js';
import {portalIdentityHunks,portalIdentityRemainder} from './helpers/portalIdentityRemainder.js';

const prefix='src/components/portal/';
function callbacks(file,hook){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),result=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)===hook){const object=n.arguments[0];result.push(Object.fromEntries(object.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(ast),p.initializer.getText(ast)])));}ts.forEachChild(n,visit);}visit(ast);return result;
}
function bind(source,deps){return new Function(...Object.keys(deps),`return (${source});`)(...Object.values(deps));}
const policy={isPortalClienteIdentificado,assertPortalOrcamentoIdentificado,calcularChecksumAssinaturaPortal};
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(300,17)]);
test('identity is an explicit nonempty primitive, never an inferred identifier',()=>{
 for(const value of [undefined,null,'',' ',0,1,false,{},[],{id:'synthetic'}])assert.equal(isPortalClienteIdentificado(value),false);
 assert.equal(isPortalClienteIdentificado('synthetic-client'),true);
});
for(const file of Object.keys(portalIdentityHunks))test(file+': entire previous source preserved outside exact hunks',()=>{
 const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');portalIdentityRemainder(file,source);
 assert.throws(()=>portalIdentityRemainder(file,source+'\n// unrelated change'));
 const [historical]=portalIdentityHunks[file].hunks[0];
 const after=source.includes(historical)?historical:consolidation82Hunks[file].hunks[0][0];
 assert.ok(source.includes(after));assert.throws(()=>portalIdentityRemainder(file,source.replace(after,'')));
 assert.throws(()=>portalIdentityRemainder(file,source+after));
});
for(const name of ['AprovacaoComAssinatura','UploadProjetos','ChatVendedor','AnalyticsPortalCliente','HistoricoComprasCliente']){
 const file=prefix+name+'.jsx';
 test(name+': actual queries fail closed even if enabled is bypassed',async()=>{
  let calls=0;const base44={entities:new Proxy({},{get(){calls++;throw new Error('Unexpected backend access');}})};
  for(const clienteId of [undefined,'',null,17,{}])for(const config of callbacks(file,'useQuery')){
   const deps={...policy,clienteId,base44};
   assert.equal(bind(config.enabled,deps),false);
   const result=await bind(config.queryFn,deps)();assert.ok(result===null||Array.isArray(result)&&result.length===0);
  }
  assert.equal(calls,0);
  assert.match(fs.readFileSync(file,'utf8'),/if \(!isPortalClienteIdentificado\(clienteId\)\)\s*(?:\{|return)/);
  assert.match(fs.readFileSync(file,'utf8'),/role="status"/);
 });
}
for(const name of ['UploadProjetos','ChatVendedor','AprovacaoComAssinatura'])test(name+': actual mutation handlers block absent identity before effects',async()=>{
 let calls=0;const forbidden=()=>{calls++;throw new Error('Unexpected effect');};
 for(const config of callbacks(prefix+name+'.jsx','useMutation')){
  const deps={...policy,clienteId:undefined,base44:new Proxy({},{get:forbidden}),setUploading:forbidden,fetch:forbidden};
  await assert.rejects(bind(config.mutationFn,deps)({orcamento:{id:'quote',cliente_id:'client',status:'Pendente'},assinaturaDataUrl:'data:image/png;base64,AA==',interacaoId:'interaction',resposta:'synthetic',motivo:'synthetic'}));
 }
 assert.equal(calls,0);
});
test('quote commands require literal ownership and pending state before fetch/upload',async()=>{
 const good={id:'synthetic-quote',cliente_id:'synthetic-client',status:'Pendente'};
 assert.doesNotThrow(()=>assertPortalOrcamentoIdentificado(good,'synthetic-client'));
 for(const quote of [{...good,id:1},{...good,id:''},{...good,cliente_id:'other'},{...good,cliente_id:['synthetic-client']},{...good,status:'Convertido'},{}]){
  for(const config of callbacks(prefix+'AprovacaoComAssinatura.jsx','useMutation')){
   let calls=0;const forbidden=()=>{calls++;throw new Error('Unexpected effect');};
   await assert.rejects(bind(config.mutationFn,{...policy,clienteId:'synthetic-client',fetch:forbidden,base44:new Proxy({},{get:forbidden})})({orcamento:quote,assinaturaDataUrl:'data:image/png;base64,AA==',motivo:'synthetic'}));
   assert.equal(calls,0);
  }
 }
});
test('checksum covers complete synthetic PNG bytes, not the first base64 characters',async()=>{
 const other=Buffer.from(png);other[other.length-1]=18;
 assert.equal(png.toString('base64').slice(0,100),other.toString('base64').slice(0,100));
 const digest=await calcularChecksumAssinaturaPortal(new Blob([png],{type:'image/png'}));
 assert.equal(digest,crypto.createHash('sha256').update(png).digest('hex'));
 assert.notEqual(digest,await calcularChecksumAssinaturaPortal(new Blob([other],{type:'image/png'})));
 for(const blob of [new Blob([png]),new Blob(['invalid!'],{type:'image/png'}),new Blob([Buffer.alloc(2*1024*1024+1)],{type:'image/png'})])await assert.rejects(calcularChecksumAssinaturaPortal(blob));
});
test('approval rejects non-data URLs and malformed PNG before upload or writes',async()=>{
 const config=callbacks(prefix+'AprovacaoComAssinatura.jsx','useMutation')[0];
 for(const assinaturaDataUrl of ['https://invalid.local/signature','data:image/jpeg;base64,AA==','data:image/png;base64,AA==']){
  let uploads=0;const command=bind(config.mutationFn,{...policy,clienteId:'synthetic-client',fetch:async url=>{assert.equal(url,'data:image/png;base64,AA==');return {blob:async()=>new Blob(['bad'],{type:'image/png'})};},base44:{integrations:{Core:{UploadFile:async()=>{uploads++;throw new Error('Unexpected upload');}}}}});
  await assert.rejects(command({orcamento:{id:'quote',cliente_id:'synthetic-client',status:'Pendente'},assinaturaDataUrl}));assert.equal(uploads,0);
 }
});
test('actual approval preserves synthetic workflow and records the complete-byte checksum',async()=>{
 const calls=[],quote={id:'synthetic-quote',cliente_id:'synthetic-client',status:'Pendente',numero_orcamento:'SYNTHETIC',valor_total:12,itens:[]};
 const base44={integrations:{Core:{UploadFile:async({file})=>{assert.equal(file.type,'image/png');assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);calls.push(['upload']);return {file_url:'synthetic-upload-reference'};}}},entities:{
  OrcamentoCliente:{update:async(id,data)=>{assert.equal(id,quote.id);calls.push(['quote',data]);}},
  Cliente:{filter:async filter=>{assert.deepEqual(filter,{id:'synthetic-client'});return [{empresa_id:'synthetic-company',group_id:'synthetic-group'}];}},
  Pedido:{create:async data=>{calls.push(['order',data]);return {...data,id:'synthetic-order'};}},
  AuditLog:{create:async data=>{calls.push(['audit',data]);}}
 },functions:{invoke:async(name,data)=>{calls.push(['function',name,data]);}}};
 const dataUrl='data:image/png;base64,'+png.toString('base64');
 const config=callbacks(prefix+'AprovacaoComAssinatura.jsx','useMutation')[0];
 const result=await bind(config.mutationFn,{...policy,base44,clienteId:'synthetic-client',nomeAssinante:'Synthetic signer',File,fetch:async url=>{assert.equal(url,dataUrl);return {blob:async()=>new Blob([png],{type:'image/png'})};},reportApprovalSignatureFailure:()=>assert.fail('Unexpected workflow failure')})({orcamento:quote,assinaturaDataUrl:dataUrl});
 assert.equal(result.pedido.id,'synthetic-order');assert.equal(calls[0][0],'upload');
 assert.equal(calls[1][1].assinatura_hash,crypto.createHash('sha256').update(png).digest('hex'));
 assert.equal(calls[1][1].status,'Aprovado');
 const order=calls.find(c=>c[0]==='order')[1];assert.equal(order.cliente_id,quote.cliente_id);assert.equal(order.empresa_id,'synthetic-company');assert.equal(order.group_id,'synthetic-group');assert.equal(order.status,'Aguardando Aprovação');
 assert.deepEqual(calls.filter(c=>c[0]==='quote').map(c=>c[1].status),['Aprovado','Convertido']);
 assert.ok(calls.some(c=>c[0]==='audit'));assert.ok(calls.some(c=>c[1]==='solicitacoesAprovacao'));
});
test('checksum capability failure is explicit, not a fallback digest',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});await assert.rejects(calcularChecksumAssinaturaPortal(new Blob([png],{type:'image/png'})),/indisponivel/);}
 finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
