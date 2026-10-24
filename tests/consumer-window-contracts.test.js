import test from 'node:test';
import {assertPortalTituloDoCliente} from '../src/components/lib/portalClientePolicy.js';
import {consolidation84Hunks} from './helpers/consolidation84Remainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {openCadastroEntityWindow} from '../src/components/cadastros/openCadastroWindow.js';
import {consumerWindowHunks,consumerWindowRemainder} from './helpers/consumerWindowRemainder.js';

const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const hashes={
 'src/components/sistema/ConfigCenter.jsx':'3ddfab5dc8b0e278750073b99196d82b9b824664294503fa9b29a224b4f8f17f',
 'src/components/administracao-sistema/configuracoes-gerais/IAPanel.jsx':'6fbf7e601792a4200599b7a87cc2f456a7abc49cc085ac9586c275f162358e57',
 'src/components/governanca/PainelGovernanca.jsx':'441e26b4be0430503b0021f4805be396028ec5ae3e409c8ff43a8efbbda678b0',
 'src/components/integracoes/TesteGoogleMaps.jsx':'f1724c7be971b0051efdf10330c155a827c28a4fd7eb3fb5afebecd1e3ceb0d6',
 'src/components/financeiro/contas-receber/TabelaReceber.jsx':'08ed6638cff8e41c858ffea4dec28ede0c4d6e0dbbb40a42252636556afee4a3',
 'src/components/cadastros/openCadastroWindow.js':'453624c5a33c0e3d0e8017a854cd41ddd6ae0a792d18928b98b9b4698c6ee5db',
 'src/components/lib/exportacaoPDF.jsx':'b1e40e79cb6481e9de877b08092575013fc5e61993f2edb0c01c191117b361e9',
 'src/components/portal/DocumentosCliente.jsx':'0e4848aa60436a8ecca32feaa1d5758214261e57bca597915e7c80ba6aeae95c',
};
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true};
function load(file,dependencies={},globals={},source=read(file)){
 const exports={};const code=ts.transpileModule(source,{compilerOptions:options}).outputText;
 new Function('require','exports',...Object.keys(globals),code)(name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];},exports,...Object.values(globals));
 return exports;
}
for(const file of Object.keys(hashes))test(`${file}: complete stage60 source preserved outside counted consumer hunks`,()=>{
 const source=read(file),before=consumerWindowRemainder(file,source);
 assert.equal(crypto.createHash('sha256').update(before).digest('hex'),hashes[file]);
 for(const [historical] of consumerWindowHunks[file]){
  const after=[historical,...(consolidation84Hunks[file]?.hunks||[]).map(h=>h[0])].find(h=>source.includes(h));assert.ok(after);
  assert.throws(()=>consumerWindowRemainder(file,source.replace(after,'')));
  assert.throws(()=>consumerWindowRemainder(file,source.replace(after,after+after)));
 }
});
const pdf='src/components/lib/exportacaoPDF.jsx';
const pedido={numero_pedido:'SYNTHETIC',cliente_nome:'Synthetic',data_pedido:'2026-01-01',status:'Rascunho',valor_total:1};
function printer(before=false,blocked=false){
 const calls=[],timers=[],popup={opener:{synthetic:true},document:{write:html=>calls.push(['write',html]),close:()=>calls.push(['close'])},print:()=>calls.push(['print'])};
 const window={open:(...args)=>{calls.push(['open',...args]);return blocked?null:popup;}};
 const source=before?consumerWindowRemainder(pdf,read(pdf)):read(pdf);
 const module=load(pdf,{}, {window,setTimeout:(fn,delay)=>timers.push({fn,delay})},source);
 return {run:module.gerarPDFPedido,popup,calls,timers};
}
test('Pedido print blocked-popup counterproof: no null dereference and false result',()=>{
 const old=printer(true,true);assert.throws(()=>old.run(pedido),TypeError);
 const current=printer(false,true);assert.equal(current.run(pedido),false);
 assert.deepEqual(current.calls,[['open','', '_blank']]);assert.equal(current.timers.length,0);
});
test('Pedido print absent record does not open a window',()=>{
 const current=printer();assert.equal(current.run(null),false);assert.equal(current.run(undefined),false);assert.deepEqual(current.calls,[]);
});
test('Pedido print success returns true, severs opener and retains full original HTML and timer',()=>{
 const current=printer(),old=printer(true);assert.equal(current.run(pedido,{nome_fantasia:'Synthetic'}),true);
 assert.equal(old.run(pedido,{nome_fantasia:'Synthetic'}),undefined);
 assert.deepEqual(current.calls,old.calls);assert.equal(current.popup.opener,null);
 current.popup.onload();old.popup.onload();assert.equal(current.timers[0].delay,250);
 assert.equal(current.calls.filter(c=>c[0]==='print').length,0);
 current.timers[0].fn();old.timers[0].fn();assert.deepEqual(current.calls,old.calls);
});
test('Pedido print write failure propagates instead of returning a success receipt',()=>{
 const current=printer();current.popup.document.write=()=>{throw Error('synthetic failure');};
 assert.throws(()=>current.run(pedido),/synthetic failure/);
});
test('Cadastro missing arguments/component never calls window manager',()=>{
 let calls=0;const open=()=>{calls++;return 'synthetic-window';};
 for(const args of [undefined,null,{}, {component:null,entityName:'Synthetic',title:'Synthetic'}])assert.throws(()=>openCadastroEntityWindow(open,args),TypeError);
 assert.equal(calls,0);
});
test('Cadastro valid open preserves unique key, dimensions, return ID and microtask release after failure',async()=>{
 const args={component:'Synthetic',entityName:'Synthetic',title:'Synthetic',props:{id:'synthetic'},width:700,height:500};
 const calls=[];const open=(...values)=>{calls.push(values);return 'synthetic-id';};
 assert.equal(openCadastroEntityWindow(open,args),'synthetic-id');assert.equal(openCadastroEntityWindow(open,args),'synthetic-id');
 assert.deepEqual(calls[0],['Synthetic',{id:'synthetic'},{title:'Synthetic',width:700,height:500,uniqueKey:'Cadastros.Synthetic.visualizador'}]);
 assert.deepEqual(calls[0],calls[1]);await Promise.resolve();
 assert.throws(()=>openCadastroEntityWindow(()=>{throw Error('synthetic');},args),/synthetic/);await Promise.resolve();
 assert.equal(openCadastroEntityWindow(open,args),'synthetic-id');
});
function find(source,predicate){
 const root=ts.createSourceFile('synthetic.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),result=[];
 const visit=node=>{if(predicate(node))result.push(node.getText(root));ts.forEachChild(node,visit);};visit(root);return result;
}
test('actual portal link handler validates captured URL again on click without coercion or stale outer guard',()=>{
 const source=read('src/components/portal/DocumentosCliente.jsx');
 const handlers=find(source,node=>ts.isJsxAttribute(node)&&node.name.getText()==='onClick'&&node.getText().includes('const url = conta.url_fatura;'));
 assert.equal(handlers.length,1);const text=handlers[0].slice('onClick={'.length,-1);
 const utils=read('src/lib/utils.js');const guards=find(utils,node=>ts.isFunctionDeclaration(node)&&node.name?.getText()==='isSafeHttpUrl');assert.equal(guards.length,1);
 const guardSource=ts.transpileModule(guards[0].replace('export ',''),{compilerOptions:options}).outputText;
 const safe=new Function(guardSource+';return isSafeHttpUrl;')();
 let coerced=false;const opaque={toString(){coerced=true;throw Error('unexpected coercion');}};
 for(const url of [undefined,null,42,opaque,'javascript:alert(1)','data:text/plain,synthetic','https://u:p@example.invalid/a','/relative','https://example.invalid/a','http://example.invalid/a']){
  const calls=[],conta={id:'synthetic-title',cliente_id:'synthetic-client',url_fatura:'https://example.invalid/initial'};
  const onClick=new Function('conta','window','isSafeHttpUrl','assertPortalTituloDoCliente','clienteId','toast',`return (${text});`)(conta,{open:(...args)=>calls.push(args)},safe,assertPortalTituloDoCliente,'synthetic-client',{error:()=>{}});
  conta.url_fatura=url;onClick();
  assert.deepEqual(calls,safe(url)?[[url,'_blank','noopener,noreferrer']]:[]);
 }
 assert.equal(coerced,false);
});
const noop=()=>assert.fail('Unexpected side effect');
const stubModule=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:(props)=>React.createElement('synthetic-'+String(name).toLowerCase(),null,props?.children)});
function componentHarness(file,context={},before=false){
 const queries=[],hooks={...React,useState:value=>[value,noop],useMemo:fn=>fn(),useEffect:noop};
 const dependencies={react:hooks,'@tanstack/react-query':{useQuery:options=>{queries.push(options);return {data:[],refetch:noop,isFetching:false};},useQueryClient:()=>({invalidateQueries:noop})},
  '@/api/base44Client':{base44:{}},'@/components/lib/useContextoVisual':{useContextoVisual:()=>context},
  '@/components/lib/usePermissions':()=>({hasPermission:()=>false,isAdmin:()=>false}),
  '@/components/lib/UserContext':{useUser:()=>({user:null})},'@/components/ui/use-toast':{useToast:()=>({toast:noop})},
  '@/components/lib/useToggleConfig':{loadScopedConfiguracaoSistema:noop,useToggleConfig:()=>({saving:false,handleToggle:noop,getToggleValue:()=>false})},
  'lucide-react':stubModule,'@/components/sistema/ToggleRow':'SyntheticToggle','@/components/ProtectedAction':stubModule,
  '../EstagiosRecebimentoWidget':'SyntheticEstagios','@/components/ui/erp/DataTable':'SyntheticTable'};
 for(const module of ['card','badge','tabs','table','button','input','label','alert','checkbox'])dependencies['@/components/ui/'+module]=stubModule;
 const source=before?consumerWindowRemainder(file,read(file)):read(file);
 return {component:load(file,dependencies,{localStorage:{getItem:()=>null}},source).default,queries};
}
const normalized=tree=>JSON.parse(JSON.stringify(tree,(_,value)=>typeof value==='function'?'[function]':typeof value==='symbol'?String(value):value));
for(const file of ['src/components/sistema/ConfigCenter.jsx','src/components/governanca/PainelGovernanca.jsx','src/components/integracoes/TesteGoogleMaps.jsx'])test(`${file}: optional metadata keeps actual render and query scope identical`,()=>{
 for(const context of [{},{grupoAtual:{id:'synthetic-g'}},{grupoAtual:{id:'synthetic-g'},empresaAtual:{id:'synthetic-e',group_id:'synthetic-g'}}]){
  const current=componentHarness(file,context),old=componentHarness(file,context,true);
  assert.deepEqual(normalized(current.component({})),normalized(old.component({})));
  assert.deepEqual(current.queries.map(q=>({key:q.queryKey,enabled:q.enabled})),old.queries.map(q=>({key:q.queryKey,enabled:q.enabled})));
 }
});
test('TabelaReceber omitted sort props retain existing no-op guard; explicit sort callback receives the original arguments',()=>{
 const file='src/components/financeiro/contas-receber/TabelaReceber.jsx';
 const props={contas:[],empresas:[],statusColors:{},contasSelecionadas:[],configsCobranca:[],toggleSelecao:noop};
 function tables(tree){if(!tree||typeof tree!=='object')return [];if(tree.type==='SyntheticTable')return [tree];return [tree.props?.children].flat(Infinity).flatMap(tables);}
 for(const overrides of [{},{sortField:'valor',sortDirection:'desc'}]){
  const current=componentHarness(file),old=componentHarness(file,{},true);
  const tree=current.component({...props,...overrides});assert.deepEqual(normalized(tree),normalized(old.component({...props,...overrides})));
  const [table]=tables(tree);assert.ok(table);assert.equal(table.props.onSortChange('valor','asc'),undefined);
 }
 const calls=[],current=componentHarness(file);
 const [table]=tables(current.component({...props,onSortChange:(...args)=>calls.push(args)}));table.props.onSortChange('valor','desc');
 assert.deepEqual(calls,[['valor','desc']]);
});
