import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const count='src/components/cadastros/CountBadgeSimplificado.jsx';
const layout='src/components/layout/ModuleLayout.jsx';
for(const [file,hash] of [[count,'f7561ff0edd370a410f1a567fccedffde95a909ab2f943ce66f6c5b55a143791'],[layout,'0005123730c26391d72f8a52884985ba244ce092f71493c908b8e5be95defbdc']])test(`${file}: full executable runtime unchanged`,()=>{
  const emitted=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
function bind(file,deps){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword));assert.ok(fn);
  const code=ts.transpileModule(fn.getText(ast).replace('export default ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext}}).outputText;
  return new Function('React',...Object.keys(deps),`${code};return ${fn.name.text};`)(React,...Object.values(deps));
}
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
function badge(result={total:0,isLoading:false}){
  const calls=[];const Component=bind(count,{Badge:({children,...props})=>React.createElement('span',props,children),useEntityCounts:entities=>{calls.push(entities);return result;}});
  return {Component,calls};
}

test('parent counts, including an empty object, disable internal entity requests and preserve numeric coercion',()=>{
  const {Component,calls}=badge({total:999,isLoading:false});
  const populated=render(Component,{entities:['Cliente','Produto'],allCounts:{Cliente:'2',Produto:3}});
  assert.match(populated,/>5<\/span>/);assert.deepEqual(calls,[[]]);
  const empty=render(Component,{entities:'Cliente',allCounts:{}});
  assert.match(empty,/>0<\/span>/);assert.deepEqual(calls,[[],[]]);
});

test('precomputed zero retains precedence without changing the existing hook invocation',()=>{
  const {Component,calls}=badge({total:99,isLoading:false});
  assert.match(render(Component,{entities:['Cliente'],precomputedTotal:0,allCounts:{Cliente:15}}),/>0<\/span>/);
  assert.deepEqual(calls,[[]]);
  assert.match(render(Component,{entities:['Cliente'],precomputedTotal:12}),/>12<\/span>/);
  assert.deepEqual(calls,[[],['Cliente']]);
});

test('internal totals and loading indicator use the same inputs and formatting',()=>{
  const ready=badge({total:1234,isLoading:false});
  assert.match(render(ready.Component,{entities:'Cliente'}),new RegExp(`>${(1234).toLocaleString('pt-BR').replace('.','\\.')}<`));
  assert.deepEqual(ready.calls,[['Cliente']]);
  const loading=badge({total:0,isLoading:true});assert.match(render(loading.Component,{entities:['Cliente']}),/animate-pulse/);
  const parent=badge();assert.match(render(parent.Component,{entities:['Cliente'],allCounts:{},isLoading:true}),/animate-pulse/);
});

test('empty entity list remains non-rendering',()=>{
  const {Component,calls}=badge();assert.equal(render(Component,{}),'');assert.deepEqual(calls,[[]]);
});

test('module layout preserves title, optional actions/subtitle, selected-company label and children',()=>{
  const Module=bind(layout,{ModuleHeader:({children})=>React.createElement('header',null,children),useContextoVisual:()=>({empresaAtual:{nome_fantasia:'Synthetic company'}})});
  const without=render(Module,{title:'Synthetic module',children:React.createElement('main',null,'Synthetic body')});
  assert.match(without,/Synthetic module/);assert.match(without,/Synthetic company/);assert.match(without,/<main>Synthetic body<\/main>/);
  assert.ok(!without.includes('<p'));
  const withActions=render(Module,{title:'Synthetic module',subtitle:'Synthetic subtitle',actions:React.createElement('button',null,'Synthetic action'),children:'Synthetic body'});
  assert.match(withActions,/Synthetic subtitle/);assert.match(withActions,/<button>Synthetic action<\/button>/);
});

test('shared component props accept existing omissions and reject wrong count/layout shapes',()=>{
  const filename=path.resolve('tests/synthetic-count-layout.tsx');
  const source=`import Count from '../src/components/cadastros/CountBadgeSimplificado';
import Layout from '../src/components/layout/ModuleLayout';
const good=<><Count entities={['Cliente']} allCounts={{Cliente:'2'}}/><Count entities="Cliente" precomputedTotal={0}/><Layout title="Synthetic">body</Layout></>;
const invalidCount=<Count entities={123}/>;
const invalidTotal=<Count precomputedTotal="2"/>;
const invalidLoading=<Count isLoading="false"/>;
const missingChildren=<Layout title="Synthetic"/>;
const invalidActions=<Layout title="Synthetic" actions={{custom:true}}>body</Layout>;
`;
  const options={allowJs:true,checkJs:false,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,baseUrl:process.cwd(),paths:{'@/*':['./src/*']}};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),[3,4,5,6,7]);
  assert.deepEqual(errors.map(e=>e.code),[2322,2322,2322,2741,2353]);
});
