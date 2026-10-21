import test from 'node:test';
import {runtimeProofSource} from './helpers/runtimeProofSource.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {QueryClient} from '@tanstack/react-query';
import {queryKeyMigrationCalls,queryKeyMigrationRemainder} from './helpers/queryKeyMigrationRemainder.js';
import {consumerWindowRemainder} from './helpers/consumerWindowRemainder.js';

const read=file=>runtimeProofSource(file);
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true};
const hash=source=>crypto.createHash('sha256').update(ts.transpileModule(source,{compilerOptions:options}).outputText).digest('hex');
function load(file,dependencies={},globals={}){
  const output=ts.transpileModule(read(file),{compilerOptions:{...options,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
  const require=name=>{assert.ok(Object.hasOwn(dependencies,name),`Unexpected dependency: ${name}`);return dependencies[name];};
  new Function('require','exports',...Object.keys(globals),output)(require,exports,...Object.values(globals));return exports;
}
const hook='src/components/lib/usePersistedSort.jsx',sorted='src/components/lib/useEntityListSorted.jsx',pdf='src/components/lib/exportacaoPDF.jsx',zindex='src/components/lib/ZIndexFix.jsx';
for(const [file,expected] of [[hook,'8cdee81ea900723e78241d1725120518b6d6a59adeee82ae1d5f3c9029359377'],[sorted,'48fbbcf1c06a1508b0e141bc39fb601b08d63ef34cf429cc12085b5dbc9523c3'],[pdf,'eca2d8924425b9cd50f162c2205d56e6bdae1849a076c4181f2faf9ad5a04a61']])test(`${file}: full executable runtime unchanged outside counted window fixes`,()=>assert.equal(hash(consumerWindowRemainder(file,read(file))),expected));
for(const [file,expected] of [['src/components/compras/OrdensCompraTab.jsx','e647200f64d6e115f479bbed8740244962417e1301f88f7798537975e2904ed3'],['src/components/NotificationCenter.jsx','f0a23db24bb902d98734b707e5c2e7b0116d5c99cace77c2ed63758adf5b8773'],['src/components/portal/AprovacaoComAssinatura.jsx','08aa1572312cd2600e8340e6b5e83f9dacc51981d3e7475ebcad44f50967da0c'],['src/components/portal/SolicitarOrcamento.jsx','eec59444919fdb494bd777efc6d59c1e2ae95729c6e5c555db8e1b16bddce2d1'],['src/components/rh/PontoEletronicoBiometrico.jsx','b5971442075bd17af52ae391afd92f9be1a10ac00713e036cf28a04c08a19c65']])test(`${file}: only exact key/count v5 filter migration changes runtime`,()=>assert.equal(hash(queryKeyMigrationRemainder(file,read(file))),expected));
test('migration remainder refuses unknown keys, added filter properties and missing calls',()=>{
  const file='src/components/portal/SolicitarOrcamento.jsx',source=read(file);
  assert.throws(()=>queryKeyMigrationRemainder(file,source.replace("['minhas-oportunidades']","['synthetic-other']")),/prefix/);
  assert.throws(()=>queryKeyMigrationRemainder(file,source.replace("{ queryKey: ['minhas-oportunidades'] }","{ queryKey: ['minhas-oportunidades'], exact: true }")),/property/);
  assert.throws(()=>queryKeyMigrationRemainder(file,source.replace("queryClient.invalidateQueries({ queryKey: ['minhas-oportunidades'] });",'')),/migration/);
});
test('installed QueryClient counterproof: legacy array filter invalidates an unrelated entity',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});
  try{client.setQueryData(['synthetic-target'],1);client.setQueryData(['synthetic-other'],2);await client.invalidateQueries(['synthetic-target']);assert.equal(client.getQueryState(['synthetic-other']).isInvalidated,true);}finally{client.clear();}
});
test('all twenty actual v5 filters invalidate matching prefixes/tenant variants, not unrelated entities',async()=>{
  let count=0;
  for(const file of Object.keys(queryKeyMigrationCalls)){
    queryKeyMigrationRemainder(file,read(file));
    const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),filters=[];
    function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='queryClient.invalidateQueries')filters.push(new Function(`return (${node.arguments[0].getText(ast)});`)());ts.forEachChild(node,visit);}
    visit(ast);
    for(const filter of filters.filter(filter=>Object.hasOwn(queryKeyMigrationCalls[file],filter.queryKey[0]))){
      const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}}),prefix=filter.queryKey[0];count++;
      const keys=[[prefix,'synthetic-group','synthetic-a'],[prefix,'synthetic-group','synthetic-b'],['synthetic-unrelated','synthetic-group','synthetic-a']];
      try{for(const key of keys)client.setQueryData(key,{synthetic:true});await client.invalidateQueries(filter);assert.equal(client.getQueryState(keys[0]).isInvalidated,true);assert.equal(client.getQueryState(keys[1]).isInvalidated,true);assert.equal(client.getQueryState(keys[2]).isInvalidated,false);}finally{client.clear();}
    }
  }
  assert.equal(count,20);
});
test('tuple return preserves field/setter positions and actual React updater types at compile time',()=>{
  const filename=path.resolve('tests/synthetic-sort-tuple.js'),source=`import useSort from '../src/components/lib/usePersistedSort';
const [field,setField,direction,setDirection]=useSort('Synthetic','name','asc');
/** @type {string} */ const f=field;
/** @type {string} */ const d=direction;
setField('updated_date');setDirection(prev=>prev==='asc'?'desc':'asc');
setField(123);
setDirection(prev=>123);
field('invalid');
`;
  const opts={allowJs:true,checkJs:true,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(opts),original=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:original(file);
  const errors=ts.createProgram([filename],opts,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),[5,6,7],JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
});
test('sort hook retains defaults, old/new storage aliases, functional setters and handled storage failures',()=>{
  for(const stored of [{field:'synthetic-old',direction:'asc'},{sortField:'synthetic-new',sortDirection:'desc'}]){
    const values=[],effects=[],writes=[];let cursor=0;
    const React={useState:initial=>{const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];},useEffect:fn=>effects.push(fn)};
    const mod=load(hook,{react:React},{localStorage:{getItem:()=>JSON.stringify(stored),setItem:(...args)=>writes.push(args)},console:{warn:()=>{}}});
    const render=()=>{cursor=0;effects.length=0;return mod.default('Synthetic','updated_date','desc');};
    let tuple=render();assert.equal(tuple[0],'updated_date');assert.equal(tuple[2],'desc');effects[0]();tuple=render();assert.equal(tuple[0],stored.field||stored.sortField);assert.equal(tuple[2],stored.direction||stored.sortDirection);
    tuple[1]('synthetic-next');tuple[3](previous=>previous==='asc'?'desc':'asc');tuple=render();effects[1]();assert.equal(JSON.parse(writes.at(-1)[1]).sortField,'synthetic-next');
  }
  const effects=[],warnings=[],mod=load(hook,{react:{useState:value=>[value,()=>{}],useEffect:fn=>effects.push(fn)}},{localStorage:{getItem:()=>{throw new Error('synthetic read failure');},setItem:()=>{throw new Error('synthetic write failure');}},console:{warn:message=>warnings.push(message)}});
  mod.default('Synthetic');for(const fn of effects)fn();assert.equal(warnings.length,2);
});
test('list criteria annotation preserves context merging, explicit OR and disabled missing scope',()=>{
  for(const [criteria,scope,expectedEnabled] of [[{}, {empresa_id:'synthetic-a'},true],[{$or:[{empresa_id:'synthetic-a'},{group_id:'synthetic-group'}]},{empresa_id:'synthetic-other'},true],[{}, {},false]]){
    let captured,invocations=0;
    const mod=load(sorted,{'@tanstack/react-query':{useQuery:options=>{captured=options;return options;}},react:{useEffect:()=>{},useRef:value=>({current:value})},'@/api/base44Client':{base44:{functions:{invoke:()=>{invocations++;}}}},'@/components/lib/useContextoVisual':{useContextoVisual:()=>({getFiltroContexto:()=>scope,grupoAtual:{id:'synthetic-group'},empresaAtual:{id:'synthetic-a'}})},'@/components/lib/useIndexedDBCache':{idbGet:async()=>undefined,idbSet:async()=>{}}},{window:undefined,localStorage:{getItem:()=>null}});
    mod.default('SyntheticEntity',criteria);assert.equal(captured.enabled,expectedEnabled);assert.equal(invocations,0);
    const filter=JSON.parse(captured.queryKey[2]);if(criteria.$or)assert.deepEqual(filter,criteria);else assert.deepEqual(filter,scope);
  }
});
test('PDF option contract keeps escaping and blocked-popup behavior without printing or real documents',()=>{
  let html='',popup=null;
  const mod=load(pdf,{}, {window:{open:()=>popup}});
  const record={numero:'SYNTHETIC',status:'EM_ABERTO',validade_em:'2026-10-20',itens:[],total:20};
  assert.equal(mod.gerarPDFOrcamento(null),false);assert.equal(mod.gerarPDFOrcamento(record),false);
  popup={document:{write:value=>{html=value;},close:()=>{}},print:()=>{throw new Error('Printing forbidden in test');}};
  assert.equal(mod.gerarPDFOrcamento(record,{empresa:{razao_social:'<script>synthetic</script>',cnpj:123},clienteNome:'<synthetic>',condicaoPagamento:'Synthetic'}),true);
  assert.ok(html.includes('&lt;script&gt;synthetic&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.equal(popup.opener,null);assert.equal(typeof popup.onload,'function');
});
function zindexRemainder(source){
  const outer='if (node instanceof HTMLElement || node instanceof SVGElement) {',inner="if (el instanceof HTMLElement || el instanceof SVGElement) el.style.zIndex = '999999';",lists='[...Array.from(selects), ...Array.from(dropdowns), ...Array.from(popovers)]';
  assert.equal(source.split(outer).length,2);assert.equal(source.split(inner).length,3);assert.equal(source.split(lists).length,3);
  return source.replace(outer,'if (node.nodeType === 1) {').replaceAll(inner,"el.style.zIndex = '999999';").replaceAll(lists,'[...selects, ...dropdowns, ...popovers]');
}
test('z-index entire runtime differs only by explicit HTML/SVG guards and array-like conversion',()=>assert.equal(hash(zindexRemainder(read(zindex))),'0f3c8e6ee7fbadd54aef064f9139c502dfc44a3f74faf6208219d052af6aea6c'));
test('DOM guard supports HTML/SVG and noniterable lists, ignores text/unsupported nodes, cleans up observer/timer',()=>{
  class Element{constructor(attributes=[],children=[]){this.attributes=new Set(attributes);this.children=children;this.style={zIndex:''};}hasAttribute(name){return this.attributes.has(name);}closest(){return null;}querySelectorAll(selector){const name=selector.slice(1,-1),items=this.children.filter(c=>c.attributes?.has(name));return Object.assign({length:items.length},items);}}
  class Html extends Element{}class Svg extends Element{}
  const initial=new Svg(['data-radix-select-content']),descendant=new Html(['data-radix-popover-content']),root=new Html(['data-radix-dropdown-menu-content'],[descendant]),calls=[];let observer,interval,cleanup;
  const doc=new Element([], [initial]);doc.body={synthetic:true};
  const mod=load(zindex,{react:{useEffect:fn=>{cleanup=fn();}}},{HTMLElement:Html,SVGElement:Svg,MutationObserver:class{constructor(fn){this.fn=fn;observer=this;}observe(...args){calls.push(['observe',...args]);}disconnect(){calls.push(['disconnect']);}},document:doc,setInterval:fn=>{interval=fn;return 7;},clearInterval:id=>calls.push(['clear',id])});
  mod.useZIndexGuard();assert.equal(initial.style.zIndex,'999999');observer.fn([{type:'childList',addedNodes:[{nodeType:3},{nodeType:1},root]}]);assert.equal(root.style.zIndex,'999999');assert.equal(descendant.style.zIndex,'999999');interval();cleanup();assert.ok(calls.some(row=>row[0]==='disconnect'));assert.ok(calls.some(row=>row[0]==='clear'&&row[1]===7));
});
