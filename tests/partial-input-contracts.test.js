import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {partialInputHunks,partialInputRemainder} from './helpers/partialInputRemainder.js';

const sheet='src/components/estoque/ImportadorProdutosPlanilha.jsx',clock='src/components/rh/PontoTab.jsx';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
for(const [file,hash] of [[sheet,'a48d3917ab035f0e064064cc01f774a6b31a6d9ce438e72bcdc6d33d06b9bc59'],[clock,'1ae0829a4660085f9d02013c44f5d038072f1bdd957779ee0a5340ab693f2237']])test(`${file}: full prior source retained outside exact partial-input hunks`,()=>{
 const source=read(file);assert.equal(crypto.createHash('sha256').update(partialInputRemainder(file,source)).digest('hex'),hash);
 for(const [after] of partialInputHunks[file]){
  assert.throws(()=>partialInputRemainder(file,source.replace(after,'')));
  assert.throws(()=>partialInputRemainder(file,source.replace(after,after+after)));
 }
});
function variable(file,name,source=read(file)){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let found;
 function visit(node){if(ts.isVariableDeclaration(node)&&(node.name.getText(ast)===name||(ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name))){assert.ok(found===undefined);found=node;}ts.forEachChild(node,visit);}
 visit(ast);assert.ok(found);return {ast,node:found};
}
function bind(file,name,deps={},source=read(file),mutation=false){
 const {ast,node}=variable(file,name,source);
 const fn=mutation?node.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)==='mutationFn').initializer:node.initializer;
 return new Function(...Object.keys(deps),'return ('+fn.getText(ast)+');')(...Object.values(deps));
}
function extraction({before=false,outputs=[],spreadsheetRows=[]}={}){
 const source=before?partialInputRemainder(sheet,read(sheet)):read(sheet),calls=[],reports=[];let index=0;
 const deps={setFileUrl:url=>calls.push(['file-url',url]),reportProductImportFailure:operation=>reports.push(operation),
  base44:{integrations:{Core:{UploadFile:async()=>{calls.push(['upload-synthetic']);return {file_url:'synthetic://file'};},ExtractDataFromUploadedFile:async()=>{calls.push(['extract-synthetic']);return outputs[index++];}}},functions:{invoke:async name=>{calls.push(['invoke-synthetic',name]);return {data:{rows:spreadsheetRows}};}}},
 };
 deps.detectEncoding=bind(sheet,'detectEncoding',deps,source);deps.parseCSVRows=bind(sheet,'parseCSVRows',{},source);
 return {run:bind(sheet,'extrairLinhas',deps,source),calls,reports};
}
test('actual local CSV parser retains headers, extra columns and synthetic values without creating business records',async()=>{
 for(const csv of ['codigo;descricao;unidade\nsynthetic;Synthetic item;UN','sep=;\ncodigo;descricao\nsynthetic;"quoted;value"','codigo,descricao\nsynthetic,"multi\nline"']){
  const old=extraction({before:true}),current=extraction();const file=new File([csv],'synthetic.csv');
  assert.deepEqual(await current.run(file),await old.run(file));assert.deepEqual(current.calls,old.calls);
  assert.deepEqual(current.calls.map(([name])=>name),['upload-synthetic','file-url']);assert.deepEqual(current.reports,[]);
 }
});
test('tabular extraction reads the known output wrapper without changing supported matrix mapping',async()=>{
 const output={output:[['codigo','descricao'],['synthetic','Synthetic item']]};
 const old=extraction({before:true,outputs:[output]}),current=extraction({outputs:[output]});const file=new File([''],'synthetic.csv');
 assert.deepEqual(await current.run(file),await old.run(file));assert.deepEqual(current.calls,old.calls);assert.deepEqual(current.reports,[]);
});
test('generic extraction keeps existing rows/data/property containers without claiming provider authenticity',async()=>{
 for(const wrapper of [{rows:[{codigo:'synthetic'}]},{data:[{codigo:'synthetic'}]},{custom:[{codigo:'synthetic'}]}]){
  const outputs=[{}, {output:wrapper}],old=extraction({before:true,outputs}),current=extraction({outputs});
  const file=new File([''],'synthetic.csv');assert.deepEqual(await current.run(file),await old.run(file));assert.deepEqual(current.reports,[]);
 }
});
test('missing/opaque extractor wrappers yield no rows and no business persistence',async()=>{
 for(const output of [undefined,null,false,1,'opaque',{}]){
  const h=extraction({outputs:[output,output]});assert.deepEqual(await h.run(new File([''],'synthetic.csv')),[]);
  assert.deepEqual(h.calls.map(([name])=>name),['upload-synthetic','file-url','extract-synthetic','extract-synthetic']);
 }
});
test('spreadsheet function result still uses the existing rows contract and is not an import execution',async()=>{
 const rows=[{codigo:'synthetic'}],h=extraction({spreadsheetRows:rows});assert.equal(await h.run(new File(['synthetic'],'synthetic.xlsx')),rows);
 assert.deepEqual(h.calls.map(([name])=>name),['upload-synthetic','file-url','invoke-synthetic']);
});
test('header predicate remains false for every data row; both filter sites preserve all row identities',()=>{
 const old=partialInputRemainder(sheet,read(sheet)),isHeaderRow=bind(sheet,'isHeaderRow');
 const rows=[{descricao:'UN'},{unidade:'KG'},null,0,'synthetic'];
 assert.deepEqual(rows.filter(row=>!isHeaderRow(row)),rows.filter(()=>!isHeaderRow()));
 assert.equal((read(sheet).match(/rows\.filter\(\(\) => !isHeaderRow\(\)\)/g)||[]).length,2);
 assert.equal((old.match(/rows\.filter\(\(r\) => !isHeaderRow\(r\)\)/g)||[]).length,2);
});
test('actual automatic header mapping keeps aliases and positional fallback; annotation does not choose new identities',()=>{
 const current=read(sheet),old=partialInputRemainder(sheet,current),header=variable(sheet,'HEADERS');
 const HEADERS=new Function('return ('+header.node.initializer.getText(header.ast)+');')();
 const deps={HEADERS,norm:bind(sheet,'norm')};
 const map=bind(sheet,'autoMapFromHeaders',deps,current),previous=bind(sheet,'autoMapFromHeaders',deps,old);
 for(const headers of [[],['A','B','C'],['codigo','descricao','unidade'],['Synthetic unmatched','Unidade (Un.)']])assert.deepEqual(map(headers),previous(headers));
 const positional=map(['A','B','C']);assert.equal(positional.codigo,'A');assert.equal(positional.descricao,'B');assert.equal(positional.unidade_medida,'C');
});
test('actual mapping state annotation preserves text headers and rejects non-text mappings in real TypeScript',()=>{
 const {ast,node}=variable(sheet,'columnMap');
 const statement=node.parent.parent.getFullText(ast).trim();
 const auto=variable(sheet,'autoMapFromHeaders'),producer=auto.node.parent.parent.getFullText(auto.ast).trim();
 const source=`import React,{useState} from 'react';\nconst HEADERS={codigo:['A'],descricao:['B'],unidade_medida:['C']};const norm=value=>String(value);\n${producer}\n${statement}\nsetColumnMap(autoMapFromHeaders(['A','B','C']));\nsetColumnMap({descricao:'synthetic-header',unidade_medida:'synthetic-unit'});\nsetColumnMap({descricao:123});\n/** @type {number} */const wrong=columnMap.descricao;`;
 const filename=path.resolve('tests/synthetic-column-map.js'),config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,esModuleInterop:true,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));
 assert.equal(errors.length,2);assert.ok(errors.every(error=>error.code===2322&&error.file&&path.resolve(error.file.fileName)===filename));
 const lines=source.trimEnd().split('\n').length;assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),[lines-2,lines-1]);
});
function attendance(before=false){const writes=[];const source=before?partialInputRemainder(clock,read(clock)):read(clock);
 const run=bind(clock,'createMutation',{base44:{entities:{Ponto:{create:async data=>{writes.push(data);return data;}}}}},source,true);return {run,writes};
}
const point=patch=>({colaborador_id:'synthetic-person',entrada_manha:'08:00',saida_tarde:'17:00',saida_almoco:'12:00',retorno_almoco:'13:00',...patch});
test('missing start/end produces the same undefined hours payload as before, not zero or a payroll rule',async()=>{
 for(const patch of [{entrada_manha:''},{saida_tarde:''},{entrada_manha:'',saida_tarde:''}]){
  const old=attendance(true),current=attendance();const result=await current.run(point(patch));assert.deepEqual(result,await old.run(point(patch)));
  assert.equal(result.horas_trabalhadas,undefined);assert.equal(result.horas_extras,undefined);assert.ok(Object.hasOwn(result,'horas_trabalhadas'));
 }
});
test('complete shifts preserve actual arithmetic including measured zero and existing overtime threshold',async()=>{
 for(const patch of [{},{entrada_manha:'08:00',saida_tarde:'08:00',saida_almoco:'',retorno_almoco:''},{saida_tarde:'19:00'},{saida_almoco:'',retorno_almoco:''}]){
  const old=attendance(true),current=attendance();assert.deepEqual(await current.run(point(patch)),await old.run(point(patch)));
 }
 const zero=await attendance().run(point({entrada_manha:'08:00',saida_tarde:'08:00',saida_almoco:'',retorno_almoco:''}));assert.equal(zero.horas_trabalhadas,0);
});
test('attendance persistence failure still propagates without success or fallback persistence',async()=>{
 let calls=0;const run=bind(clock,'createMutation',{base44:{entities:{Ponto:{create:async()=>{calls++;throw Error('synthetic persistence failure');}}}}},read(clock),true);
 await assert.rejects(()=>run(point({})),/synthetic persistence failure/);assert.equal(calls,1);
});
