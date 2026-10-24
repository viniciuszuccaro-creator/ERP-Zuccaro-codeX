import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import * as currentPolicy from '../src/components/lib/portalClientePolicy.js';
import {portalBankSourceHunks,portalBankSourceRemainder} from './helpers/portalBankSourceRemainder.js';

const policy='src/components/lib/portalClientePolicy.js',boletos='src/components/portal/BoletosList.jsx',docs='src/components/portal/DocumentosCliente.jsx';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,removeComments:true};
function oldPolicy(){const exports={};new Function('exports',ts.transpileModule(portalBankSourceRemainder(policy,read(policy)),{compilerOptions:options}).outputText)(exports);return exports;}
for(const [file,hash] of [[policy,'17c89a7cf2604211fc76c13e498cc3bf22438bb8a907254ba08cbd801f56309c'],[boletos,'67ce752d7c3e56ba47a46efc24c9a9440ae072f93d3d0d11d5c593950bf38e8c'],[docs,'328d4eb0824008a68ed684f042388f7a8beb45bc543e3f289ec7f6ef5e18e69d']])test(`${file}: complete previous source retained outside exactly counted bank-source hunks`,()=>{
 const source=read(file);assert.equal(crypto.createHash('sha256').update(portalBankSourceRemainder(file,source)).digest('hex'),hash);
 for(const [after] of portalBankSourceHunks[file]){
  assert.throws(()=>portalBankSourceRemainder(file,source.replace(after,'')));
  assert.throws(()=>portalBankSourceRemainder(file,source.replace(after,after+after)));
 }
});
const client={id:'synthetic-client'},title=patch=>({id:'synthetic-title',cliente_id:client.id,status:'Pendente',valor:1,...patch});
test('counterproof: old shared producer fabricates three bank fields; current producer blocks their absence',()=>{
 const old=oldPolicy().buildSegundaViaPortal({titulo:title(),cliente:client});
 assert.ok(old.record.pix_copia_cola);assert.ok(old.record.linha_digitavel);assert.equal(old.record.url_boleto_pdf,'portal://boleto/synthetic-title/2via.pdf');
 assert.throws(()=>currentPolicy.buildSegundaViaPortal({titulo:title(),cliente:client}),/Segunda via indisponivel/);
});
test('shared producer retains all exports but second-copy flow no longer calls legacy synthetic formatters',()=>{
 assert.deepEqual(Object.keys(currentPolicy).sort(),[...Object.keys(oldPolicy()),'isPortalClienteIdentificado','assertPortalOrcamentoIdentificado','calcularChecksumAssinaturaPortal','resolvePortalClienteVinculado'].sort());
 const source=read(policy),ast=ts.createSourceFile(policy,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let fn;
 for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const node of statement.declarationList.declarations)if(node.name.getText(ast)==='buildSegundaViaPortal')fn=node.initializer;
 assert.ok(fn);const calls=[];const visit=node=>{if(ts.isCallExpression(node))calls.push(node.expression.getText(ast));ts.forEachChild(node,visit);};visit(fn);
 assert.ok(!calls.includes('buildPixCopiaColaPortal'));assert.ok(!calls.includes('buildLinhaDigitavelLocal'));
});
test('missing/blank/non-text artifacts are not coerced or manufactured',()=>{
 let coerced=false;const opaque={toString(){coerced=true;throw Error('must not coerce bank artifact');}};
 for(const patch of [{},{pix_copia_cola:' ',linha_digitavel:'\t',url_boleto_pdf:'\n'},{pix_copia_cola:opaque,linha_digitavel:123,url_boleto_pdf:opaque}]){
  assert.throws(()=>currentPolicy.buildSegundaViaPortal({titulo:title(patch),cliente:client}),/Segunda via indisponivel/);
 }
 assert.equal(coerced,false);
});
test('provided artifacts are retained independently; missing companions stay absent, not generated',()=>{
 for(const field of ['pix_copia_cola','linha_digitavel','url_boleto_pdf']){
  const input=title({[field]:' synthetic-existing-artifact '}),first=currentPolicy.buildSegundaViaPortal({titulo:input,cliente:client});
  assert.equal(first.reuse,false);assert.equal(first.record[field],'synthetic-existing-artifact');assert.equal(first.record.visivel_no_portal,true);
  for(const absent of ['pix_copia_cola','linha_digitavel','url_boleto_pdf'].filter(name=>name!==field))assert.equal(first.record[absent],undefined);
  assert.equal(input[field],' synthetic-existing-artifact ');assert.equal(input.portal_segunda_via_key,undefined);
  const retry=currentPolicy.buildSegundaViaPortal({titulo:first.record,cliente:client});assert.equal(retry.reuse,true);assert.equal(retry.record,first.record);
 }
});
test('existing full artifacts preserve key, metadata allowlist, trimming and replay contract',()=>{
 const input=title({pix_copia_cola:'synthetic-pix',linha_digitavel:'synthetic-line',url_boleto_pdf:'https://synthetic.invalid/boleto.pdf'});
 const old=oldPolicy().buildSegundaViaPortal({titulo:input,cliente:client}),now=currentPolicy.buildSegundaViaPortal({titulo:input,cliente:client});
 const withoutTime=record=>{const {portal_segunda_via_em,...rest}=record;assert.ok(portal_segunda_via_em);return rest;};
 assert.deepEqual(withoutTime(now.record),withoutTime(old.record));assert.equal(now.reuse,old.reuse);
});
test('existing ownership and closed-state checks precede any artifact availability decision',()=>{
 for(const patch of [{cliente_id:'synthetic-other'},{status:'Recebido'},{status:'Cancelado'},{status:'Liquidado'}])assert.throws(()=>currentPolicy.buildSegundaViaPortal({titulo:title(patch),cliente:client}),/nao pertence|liquidado ou cancelado/);
});
function command(file,callback='mutationFn',before=false){
 const source=before?portalBankSourceRemainder(file,read(file)):read(file),name=file===boletos?'emitir':'emitirSegundaVia';
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let declaration;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.ok(declaration===undefined);declaration=node;}ts.forEachChild(node,visit);};visit(ast);assert.ok(declaration);
 return {ast,fn:declaration.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)===callback).initializer};
}
function bind(file,deps,callback='mutationFn',before=false){const {ast,fn}=command(file,callback,before);return new Function(...Object.keys(deps),'return ('+fn.getText(ast)+');')(...Object.values(deps));}
function consumer(file,{before=false,fail=false}={}){
 const writes=[];const fn=bind(file,{cliente:client,buildSegundaViaPortal:before?oldPolicy().buildSegundaViaPortal:currentPolicy.buildSegundaViaPortal,
  base44:{entities:{ContaReceber:{update:async(id,patch)=>{writes.push({id,patch});if(fail)throw Error('synthetic storage failure');return {...title(),...patch};}}}}},'mutationFn',before);
 return {fn,writes};
}
for(const file of [boletos,docs]){
 test(`${file}: counterproof blocks formerly fabricated persisted fields`,async()=>{
  const old=consumer(file,{before:true}),now=consumer(file);await old.fn(title());assert.equal(old.writes.length,1);
  await assert.rejects(()=>now.fn(title()),/Segunda via indisponivel/);assert.deepEqual(now.writes,[]);
 });
 test(`${file}: invalid write identity, foreign customer and closed title cannot persist`,async()=>{
  for(const input of [null,title({id:123}),title({id:''}),title({id:' '}),title({cliente_id:'synthetic-other'}),title({status:'Recebido'})]){
   const h=consumer(file);await assert.rejects(()=>h.fn(input));assert.deepEqual(h.writes,[]);
  }
 });
 test(`${file}: partial existing artifact writes only existing allowlist, reuses replay and propagates storage failure`,async()=>{
  const h=consumer(file),first=await h.fn(title({pix_copia_cola:'synthetic-existing-pix'}));
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].id,'synthetic-title');
  assert.deepEqual(Object.keys(h.writes[0].patch).sort(),['visivel_no_portal','url_boleto_pdf','linha_digitavel','pix_copia_cola','portal_segunda_via_em','portal_segunda_via_key','idempotency_key'].sort());
  assert.equal(h.writes[0].patch.linha_digitavel,undefined);assert.equal(h.writes[0].patch.url_boleto_pdf,undefined);
  assert.equal(await h.fn(first),first);assert.equal(h.writes.length,1);
  await assert.rejects(()=>consumer(file,{fail:true}).fn(title({linha_digitavel:'synthetic-existing-line'})),/synthetic storage failure/);
 });
 test(`${file}: success copy no longer claims issuance and preserves cache invalidation`,()=>{
  const messages=[],queries=[];bind(file,{toast:{success:value=>messages.push(value)},qc:{invalidateQueries:value=>queries.push(value)},cliente:client,clienteId:client.id},'onSuccess')();
  assert.deepEqual(messages,['Dados existentes disponibilizados no portal']);assert.equal(queries.length,file===boletos?3:1);
 });
}
test('actual consumer signatures keep canonical PortalRecord metadata unknown; numeric IDs require a runtime write guard',()=>{
 let source="import {useMutation} from '@tanstack/react-query';\n";
 for(const [i,file] of [boletos,docs].entries()){
  const {ast,fn}=command(file);source+=`const f${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{if(typeof titulo?.id!=='string')throw Error('invalid');return titulo.id;}});\nf${i}.mutate({id:'synthetic'});\nf${i}.mutate({id:123});\n`;
 }
 const positiveLines=source.split('\n').length-1;source+="f0.mutate({id:true});\nf1.mutate({id:true});\n";
 const filename=path.resolve('src/components/portal/synthetic-second-copy-contract.js'),config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));assert.equal(errors.length,2);assert.ok(errors.every(error=>error.code===2322&&error.file&&path.resolve(error.file.fileName)===filename));
 assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),[positiveLines,positiveLines+1]);
});
