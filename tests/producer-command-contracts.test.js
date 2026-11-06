import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';

const nfe='src/components/compras/ImportacaoNFeRecebimento.jsx';
const whatsapp='src/components/integracoes/ConfigWhatsAppBusiness.jsx';
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,removeComments:true};
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const hash=source=>crypto.createHash('sha256').update(source).digest('hex');
const emit=source=>ts.transpileModule(source,{compilerOptions:options}).outputText;
const annotations=new Map([
 [nfe,['/** @type {File} */ ','/** @type {Awaited<ReturnType<typeof processarXMLMutation.mutateAsync>>} */ ']],
 [whatsapp,['/** @type {typeof configInicial} */ ']],
]);
for(const [file,before,runtime] of [
 [nfe,'49c6ca692fac18c707ec3600e9d1f8a1025bda895a4869e442e5421da161b06c','17de7a3fd143ecbb1f6da45e449d84abdc39287f0b72569b6765b43af34d38cc'],
 [whatsapp,'963e1e8b0222b69cf3222fbe0f4cbd72aa8abb3823d2cb80f70140c815938cad','a5c549bc4101631694410e64dafdffb23b38a45eba7ff31d001fd1211df34606'],
])test(`${file}: whole prior source outside exact producer annotations and emitted JS retained`,()=>{
 const source=read(file);let previous=source;
 for(const annotation of annotations.get(file)){assert.equal(previous.split(annotation).length,2);previous=previous.replace(annotation,'');}
 assert.equal(hash(previous),before);assert.equal(hash(emit(source)),runtime);assert.equal(emit(source),emit(previous));
});

function variable(file,name){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let match;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.ok(match===undefined);match=node;}ts.forEachChild(node,visit);}
 visit(ast);assert.ok(match);return {ast,node:match};
}
function bind(file,name,deps,{mutation=false}={}){
 const {ast,node}=variable(file,name);
 const fn=mutation?node.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)==='mutationFn').initializer:node.initializer;
 const exports={};new Function(...Object.keys(deps),'exports',emit('exports.callback='+fn.getText(ast)))(...Object.values(deps),exports);
 return exports.callback;
}
test('real TypeScript infers consumer commands from the existing producers, rejecting mismatched inputs',()=>{
 const local=variable(nfe,'mockResultado'),initial=variable(whatsapp,'configInicial');
 const processed=variable(nfe,'processarXMLMutation'),confirmed=variable(nfe,'confirmarRecebimentoMutation'),saved=variable(whatsapp,'salvarMutation');
 const parameter=({ast,node})=>node.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)==='mutationFn').initializer.parameters[0].getFullText(ast).trim();
 const fixture=`import {useMutation} from '@tanstack/react-query';
const configInicial=${initial.node.initializer.getText(initial.ast)};
const processarXMLMutation=useMutation({mutationFn:async (${parameter(processed)})=>{
 const mockResultado=${local.node.initializer.getText(local.ast)};return mockResultado;
}});
const accept=async (${parameter(confirmed)})=>dados;
const save=async (${parameter(saved)})=>dados;
async function positive(){const result=await processarXMLMutation.mutateAsync(new File([''],'synthetic.xml'));await accept(result);await save(configInicial);}
// Negative fixtures: no suppression directives.
processarXMLMutation.mutateAsync('not-a-file');
accept({simulacao:true,nfe:{}});
save({...configInicial,ativo:'true'});`;
 const filename=path.resolve('tests/synthetic-producer-command.js');
 const config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?fixture:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));
 assert.equal(errors.length,3);assert.ok(errors.every(error=>error.file&&path.resolve(error.file.fileName)===filename));
 const negative=fixture.split('\n').findIndex(line=>line.startsWith('// Negative'));
 assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),[negative+1,negative+2,negative+3]);
});
function fiscal({context=true,allowed=true,auditFailure=false}={}){
 const audits=[],updates=[],messages=[];
 const deps={contextoValido:context,canProcessarNFe:allowed,
  auditImportacao:async event=>{audits.push(event);if(auditFailure)throw Error('synthetic audit failure');},
  setProcessando:value=>updates.push(['processing',value]),setResultado:value=>updates.push(['result',value]),
  setTimeout:callback=>callback(),toast:value=>messages.push(value),
  createInContext:()=>assert.fail('no fiscal/stock record writes allowed in these fixtures'),
  updateInContext:()=>assert.fail('no product writes allowed in these fixtures'),
  filterInContext:()=>assert.fail('no operational product queries allowed in these fixtures'),
 };
 return {deps,audits,updates,messages,
  process:bind(nfe,'processarXMLMutation',deps,{mutation:true}),confirm:bind(nfe,'confirmarRecebimentoMutation',deps,{mutation:true})};
}
for(const [label,setting,reason] of [['context',{context:false},'contexto_obrigatorio'],['permission',{allowed:false},'permissao_negada']])test(`actual NF-e processing and confirmation retain ${label} block`,async()=>{
 const h=fiscal(setting);
 await assert.rejects(()=>h.process(new File([''],'synthetic.xml')),/grupo e empresa|permissao/);
 await assert.rejects(()=>h.confirm({simulacao:true,nfe:{numero:'synthetic',chave:'synthetic'}}),/grupo e empresa|permissao/);
 assert.deepEqual(h.audits.map(event=>event.motivo),[reason,reason]);assert.deepEqual(h.updates,[]);
});
test('actual local producer is still simulated and cannot be confirmed as a fiscal receipt',async()=>{
 const h=fiscal();const result=await h.process(new File([''],'synthetic.xml'));
 assert.equal(result.simulacao,true);assert.equal(result.sucesso,true);assert.equal(h.updates[0][1],true);assert.equal(h.updates.at(-1)[1],false);
 await assert.rejects(()=>h.confirm(result),/Resultado simulado/);
 assert.equal(h.audits.at(-1).motivo,'resultado_simulado');
});
test('actual UI confirmation also retains its simulation block without opening confirmation or invoking mutation',async()=>{
 const messages=[],audits=[];
 const handler=bind(nfe,'handleConfirmarRecebimento',{
  resultado:{simulacao:true,nfe:{}},contextoValido:true,canProcessarNFe:true,
  toast:message=>messages.push(message),auditImportacao:async event=>audits.push(event),
  window:{confirm:()=>assert.fail('no confirmation for simulated result')},
  confirmarRecebimentoMutation:{mutate:()=>assert.fail('simulated result must not reach write mutation')},
 });
 await handler();assert.equal(messages.length,1);assert.equal(messages[0].title,'Recebimento bloqueado');assert.deepEqual(audits,[]);
});
test('failed audit on blocked fiscal command is not converted into a success',async()=>{
 const h=fiscal({context:false,auditFailure:true});
 await assert.rejects(()=>h.process(new File([''],'synthetic.xml')),/synthetic audit failure/);
 await assert.rejects(()=>h.confirm({simulacao:true,nfe:{}}),/synthetic audit failure/);
 assert.deepEqual(h.updates,[]);
});

function configInitial(){const {ast,node}=variable(whatsapp,'configInicial');return new Function('return ('+node.initializer.getText(ast)+');')();}
function configuration({context=true,allowed=true,existing=false,writeFailure=false}={}){
 const writes=[],audits=[];
 const write=async(entity,...args)=>{writes.push({entity,args});if(writeFailure)throw Error('synthetic persistence failure');return {id:'synthetic-config'};};
 const deps={contextoValido:context,podeSalvar:allowed,operacaoSalvar:existing?'editar':'criar',
  chaveConfig:'synthetic-config-key',configSalva:existing?{id:'synthetic-config'}:null,
  scope:{group_id:'synthetic-group',empresa_id:'synthetic-company'},
  createInContext:write,updateInContext:write,auditarWhatsApp:async(...args)=>audits.push(args)};
 return {writes,audits,run:bind(whatsapp,'salvarMutation',deps,{mutation:true})};
}
for(const [label,setting] of [['context',{context:false}],['permission',{allowed:false}]])test(`actual configuration command retains ${label} block before persistence`,async()=>{
 const h=configuration(setting);await assert.rejects(()=>h.run(configInitial()),/Selecione|perfil/);
 assert.deepEqual(h.writes,[]);assert.equal(h.audits.length,1);
});
test('configuration command keeps invalid phone rejection, normalization and create/update ownership',async()=>{
 const invalid=configuration();await assert.rejects(()=>invalid.run({...configInitial(),numero_whatsapp:'123'}),/Telefone invalido/);assert.deepEqual(invalid.writes,[]);
 for(const existing of [false,true]){
  const h=configuration({existing});await h.run({...configInitial(),numero_whatsapp:'(00) 00000-0000',enviar_cobranca_dias_antes:99});
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].entity,'ConfiguracaoSistema');
  const args=h.writes[0].args;assert.equal(args.length,existing?2:1);if(existing)assert.equal(args[0],'synthetic-config');
  const payload=args.at(-1);assert.equal(payload.group_id,'synthetic-group');assert.equal(payload.empresa_id,'synthetic-company');
  assert.equal(payload.integracao_whatsapp.numero_whatsapp,'00000000000');assert.equal(payload.integracao_whatsapp.enviar_cobranca_dias_antes,30);
  assert.equal(payload.integracao_whatsapp.api_token,'');assert.equal(h.audits.length,1);
  assert.equal(h.audits[0][2].token_configurado,false);assert.equal(Object.hasOwn(h.audits[0][2],'api_token'),false);
 }
});
test('configuration persistence failure propagates without a success audit or fallback write',async()=>{
 const h=configuration({writeFailure:true});await assert.rejects(()=>h.run(configInitial()),/synthetic persistence failure/);
 assert.equal(h.writes.length,1);assert.deepEqual(h.audits,[]);
});
