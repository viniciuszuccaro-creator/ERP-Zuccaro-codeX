import { portalReadRemainder } from './helpers/portalReadRemainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {buildSegundaViaPortal,isPortalClienteIdentificado} from '../src/components/lib/portalClientePolicy.js';

const files={config:'src/components/portal/ConfiguracoesPortal.jsx',boletos:'src/components/portal/BoletosList.jsx',docs:'src/components/portal/DocumentosCliente.jsx',upload:'src/components/portal/UploadProjetos.jsx'};
const commands={config:'salvarMutation',boletos:'emitir',docs:'emitirSegundaVia',upload:'uploadProjetoMutation'};
const hashes={config:'c6c4493fb367dc49bee05e207577edfa0fc5cb6e2960e54a4e98d6feea3881c7',boletos:'00942f12723fa2d991137c6d202f0bd4b6685149adbfc14757fe575fc3dde8d4',docs:'bc2c6e3131c880546cc631316fb1964eae462f2b1eb1218b986bd505d1ae4a0b',upload:'5429f000cde5ab35aac87a4205bc03b9992bcb2cc9967f0e8a390995c1bf441f'};
function variable(file,name){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let node;
  function visit(n){if(ts.isVariableDeclaration(n)&&(n.name.getText(ast)===name||(ts.isArrayBindingPattern(n.name)&&n.name.elements[0]?.getText(ast)===name))){assert.equal(node,undefined);node=n;}ts.forEachChild(n,visit);}
  visit(ast);assert.ok(node,name);return {ast,node};
}
function actual(kind,name=commands[kind],callback='mutationFn'){
  const {ast,node}=variable(files[kind],name);
  return {ast,fn:callback?node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)===callback).initializer:node.initializer};
}
function bind(kind,deps,name,callback){const {ast,fn}=actual(kind,name,callback);deps={isPortalClienteIdentificado,...deps};return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initialConfig(){const {ast,node}=variable(files.config,'config');return node.initializer.arguments[0].getText(ast);}
const config=()=>new Function(`return (${initialConfig()});`)();
for(const [kind,file] of Object.entries(files))test(`${file}: full executable runtime unchanged`,()=>{
  const emitted=ts.transpileModule(portalReadRemainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hashes[kind]);
});
test('settings/upload commands retain state/File types; canonical numeric title IDs remain incompatible with string API',()=>{
  let source="import {useMutation} from '@tanstack/react-query';\n";const negative=[];
  for(const kind of ['config','upload']){
    const {ast,fn}=actual(kind);
    // Keep the real relative import in PortalRecord annotations valid in this virtual directory.
    source+=`{\nconst config=${initialConfig()};\nconst c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\n`;
    const good=kind==='config'?JSON.stringify(config()):kind==='upload'?"new File(['synthetic'], 'synthetic.pdf', {type:'application/pdf'})":"{id:'synthetic-title',cliente_id:'synthetic-client',valor:20,status:'Pendente',opaque:{synthetic:true}}";
    source+=`c.mutate(${good});\n`;
    const bad=kind==='config'?JSON.stringify({...config(),email_marketing:'false'}):kind==='upload'?"{name:'synthetic.pdf',size:10}":"{id:true,valor:20}";
    negative.push(source.split('\n').length-1);source+=`c.mutate(${bad});\n}\n`;
  }
  source+=`/** @type {import('../lib/portalClientePolicy').PortalRecord} */ const title={id:123};\n`;
  source+='/** @param {string} id */ function stringApi(id){}\n';
  negative.push(source.split('\n').length-1);source+='stringApi(title.id);\n';
  const filename=path.resolve('src/components/portal/synthetic-command-fixture.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negative,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
});
test('settings deny missing customer and preserve preference/LGPD merge and audit identity',async()=>{
  const calls=[],cliente={id:'synthetic-client',group_id:'synthetic-group',empresa_id:'synthetic-a',lgpd_autorizacoes:{synthetic_preserved:true}};
  const base44={entities:{Cliente:{update:async(...args)=>calls.push(['update',...args])},AuditLog:{create:async row=>calls.push(['audit',row])}}};
  await assert.rejects(bind('config',{cliente:null,base44,user:null})(config()),/Cliente/);assert.deepEqual(calls,[]);
  const input={...config(),email_marketing:true};assert.equal(await bind('config',{cliente,base44,user:{id:'synthetic-user'}})(input),input);
  assert.equal(calls[0][1],cliente.id);assert.equal(calls[0][2].lgpd_autorizacoes.synthetic_preserved,true);assert.equal(calls[0][2].lgpd_autorizacoes.autoriza_email_marketing,true);
  assert.equal(calls[1][1].usuario_id,'synthetic-user');assert.equal(calls[1][1].group_id,'synthetic-group');assert.equal(calls[1][1].empresa_id,'synthetic-a');
});
test('settings propagate write and post-write audit failure without rollback claim',async()=>{
  for(const phase of ['update','audit']){
    const calls=[],fail=async()=>{throw new Error('synthetic failure');};
    const base44={entities:{Cliente:{update:async()=>{calls.push('update');if(phase==='update')await fail();}},AuditLog:{create:async()=>{calls.push('audit');await fail();}}}};
    await assert.rejects(bind('config',{cliente:{id:'synthetic-client'},base44,user:null})(config()),/synthetic failure/);
    assert.deepEqual(calls,phase==='update'?['update']:['update','audit']);
  }
});
const title=()=>({id:'synthetic-title',cliente_id:'synthetic-client',status:'Pendente',valor:20,visivel_no_portal:true,pix_copia_cola:'synthetic-existing-pix',linha_digitavel:'synthetic-existing-line',url_boleto_pdf:'portal://synthetic-existing'});
test('both second-copy consumers use real customer/status guards before writes',async()=>{
  for(const kind of ['boletos','docs'])for(const titulo of [{...title(),cliente_id:'synthetic-other'},{...title(),status:'Recebido'},{...title(),status:'Cancelado'}]){
    const writes=[],base44={entities:{ContaReceber:{update:async(...args)=>writes.push(args)}}};
    await assert.rejects(bind(kind,{base44,buildSegundaViaPortal,cliente:{id:'synthetic-client'}})(titulo));assert.deepEqual(writes,[]);
  }
});
test('both consumers preserve update allowlist/replay reuse and propagate storage errors',async()=>{
  for(const kind of ['boletos','docs']){
    const writes=[],cliente={id:'synthetic-client'},base44={entities:{ContaReceber:{update:async(id,patch)=>{writes.push([id,patch]);return {...title(),...patch};}}}};
    const run=bind(kind,{base44,buildSegundaViaPortal,cliente}),first=await run(title());
    assert.equal(writes.length,1);assert.deepEqual(Object.keys(writes[0][1]).sort(),['visivel_no_portal','url_boleto_pdf','linha_digitavel','pix_copia_cola','portal_segunda_via_em','portal_segunda_via_key','idempotency_key'].sort());
    assert.equal(first.pix_copia_cola,'synthetic-existing-pix');assert.equal(await run(first),first);assert.equal(writes.length,1);
    base44.entities.ContaReceber.update=async()=>{throw new Error('synthetic failure');};await assert.rejects(run(title()),/synthetic failure/);
  }
});
test('project file selector preserves extension/size validation without reading any real file',()=>{
  const selected=[],notices=[],run=bind('upload',{setArquivoSelecionado:file=>selected.push(file),toast:row=>notices.push(row)},'handleFileSelect',null);
  for(const file of [{name:'synthetic.exe',size:1},{name:'synthetic.pdf',size:10*1024*1024+1}])run({target:{files:[file]}});
  assert.deepEqual(selected,[]);assert.equal(notices.length,2);
  for(const extension of ['PDF','dwg','dxf','png','jpg','jpeg']){const file={name:`synthetic.${extension}`,size:10*1024*1024};run({target:{files:[file]}});assert.equal(selected.at(-1),file);}
});
test('project command preserves upload then draft mapping with synthetic dependencies only',async()=>{
  const calls=[],file=new File(['synthetic'], 'synthetic.pdf',{type:'application/pdf'});
  const base44={integrations:{Core:{UploadFile:async input=>{calls.push(['upload',input]);return {file_url:'portal://synthetic-upload'};}}},entities:{Pedido:{create:async row=>{calls.push(['create',row]);return {id:'synthetic-draft'};}}}};
  const result=await bind('upload',{base44,setUploading:value=>calls.push(['busy',value]),clienteId:'synthetic-client',clienteNome:'Synthetic client',descricaoProjeto:'Synthetic description'})(file);
  assert.equal(calls[1][1].file,file);assert.equal(calls[2][1].cliente_id,'synthetic-client');assert.equal(calls[2][1].status,'Rascunho');assert.equal(calls[2][1].projetos_ia[0].tipo_arquivo,'PDF');assert.equal(result.pedido.id,'synthetic-draft');
});
test('project failures keep existing propagation and error callback resets busy state',async()=>{
  for(const phase of ['upload','create']){
    const calls=[],fail=async()=>{throw new Error('synthetic failure');};
    const base44={integrations:{Core:{UploadFile:async()=>{calls.push('upload');if(phase==='upload')await fail();return {file_url:'portal://synthetic'};}}},entities:{Pedido:{create:async()=>{calls.push('create');await fail();}}}};
    const deps={base44,setUploading:()=>{},clienteId:'synthetic-client',clienteNome:'Synthetic',descricaoProjeto:''};
    await assert.rejects(bind('upload',deps)(new File(['synthetic'],'synthetic.pdf')),/synthetic failure/);assert.deepEqual(calls,phase==='upload'?['upload']:['upload','create']);
  }
  const flags=[],notices=[];bind('upload',{setUploading:value=>flags.push(value),toast:row=>notices.push(row)},undefined,'onError')();assert.deepEqual(flags,[false]);assert.equal(notices[0].variant,'destructive');
});
