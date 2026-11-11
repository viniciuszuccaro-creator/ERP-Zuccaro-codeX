import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {browserFormBoundaryRemainder} from './helpers/browserFormBoundaryRemainder.js';

const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function network(){
  const calls=[],store=new Map([['empresa_atual_id','synthetic-company'],['group_atual_id','synthetic-group'],['contexto_atual','empresa']]);
  const original=async(input,init)=>{calls.push({input,init});return new Response('synthetic',{status:200});};
  const window={fetch:original,location:new URL('https://erp.example.invalid/')};
  const globals={window,localStorage:{getItem:key=>store.get(key)||null},URL,Request,Response,Headers,AbortSignal,console,setTimeout};
  const source=read('src/components/lib/networkGuard.jsx');
  vm.runInNewContext(source,globals);return{window,calls,store,globals,source};
}
test('actual network guard never injects company/group context into an external URL object',async()=>{
  const h=network(),url=new URL('https://outside.example.invalid/path'),init={headers:{'x-synthetic':'retained'}};
  await h.window.fetch(url,init);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].input,url);assert.equal(h.calls[0].init,init);
  assert.equal(new Headers(h.calls[0].init.headers).has('x-company-id'),false);
});
test('actual network guard preserves same-origin Request headers and installs only once',async()=>{
  const h=network(),installed=h.window.fetch;
  vm.runInNewContext(h.source,h.globals);assert.equal(h.window.fetch,installed);
  const request=new Request('https://erp.example.invalid/path',{headers:{'x-synthetic':'retained'}});
  await h.window.fetch(request);
  const headers=new Headers(h.calls[0].init.headers);
  assert.equal(headers.get('x-synthetic'),'retained');assert.equal(headers.get('x-company-id'),'synthetic-company');
});
function params(globals={}){
  const source=read('src/lib/app-params.js').replaceAll('import.meta.env','__env').replace('export const appParams','const appParams')+'\nglobalThis.result=appParams;';
  const context={__env:undefined,...globals};vm.runInNewContext(source,context);return context.result;
}
test('actual app parameters load without window or bundler environment in Node',()=>{
  const value=params();assert.equal(value.appId,undefined);assert.equal(value.fromUrl,undefined);assert.equal(value.token,undefined);
  const configured=params({__env:{VITE_BASE44_APP_ID:'synthetic-app',VITE_BASE44_BACKEND_URL:'https://erp.example.invalid'}});
  assert.equal(configured.appId,'synthetic-app');assert.equal(configured.serverUrl,'https://erp.example.invalid');
});

const hashes=[
  ['src/components/lib/networkGuard.jsx','0790f2db1166d835b4bfed2229cb5d62914eb7fe10a082c6ea771ed0f070d067'],
  ['src/lib/app-params.js','7b58adddf4441d1f2b4a649d81235172e505da9d6d74b64dc732123c77845dc4'],
  ['src/components/common/FormErrorSummary.jsx','2d949354a524d47b6fbb86bb2034982f7b0322587ec6bb30ca4dd7c7fb46e9a7'],
  ['src/components/common/FormWrapper.jsx','537528252cd34f614db656b495d1c0a5609e125d00ca5204651dfc4e29d4914e'],
  ['src/components/compras/CotacaoForm.jsx','d5d9cbc5ea0afb5c81e9486bb8a6b30de4f83a585479506f45d1138b6e161b19'],
  ['src/components/compras/OrdemCompraForm.jsx','2bee39ea21a374649ec6b51493ce053c752cbf56bc6ed733aea98fe21b93a4bd'],
  ['src/components/compras/SolicitacaoCompraForm.jsx','a8c7e30a7d98b6e399d62b568d92578de2f2ea8700c948656c411b7f2f47eac4'],
  ['src/components/sistema/ConfigGlobal.jsx','f475c6b946f9e12028252814461901d9272077248d8ad9faa39189649b6b94f2'],
  ['src/components/lib/WindowManager.jsx','4da37059fb021726aca9fc418f1fe137aa4113e84250e11e7c2eceffb09df381'],
  ['src/lib/AuthContext.jsx','33a39b4e72980a336006d1b9b04c975d84c40f2419f80a88524f096a86906521'],
];
const emit=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
for(const [file,hash]of hashes)test(`${file}: all stage47 executable code retained outside counted boundary edits`,()=>{
  assert.equal(crypto.createHash('sha256').update(emit(browserFormBoundaryRemainder(file,read(file)))).digest('hex'),hash);
});
test('same-origin strings/URLs retain method, body, headers and explicit signal in both company and group views',async()=>{
  for(const input of ['/relative',new URL('https://erp.example.invalid/path')])for(const scope of ['empresa','grupo']){
    const h=network();h.store.set('contexto_atual',scope);
    const abort=new AbortController(),init={method:'POST',body:'synthetic-body',headers:{'x-synthetic':'retained'},signal:abort.signal};
    await h.window.fetch(input,init);const sent=h.calls[0].init,headers=new Headers(sent.headers);
    assert.equal(sent.method,'POST');assert.equal(sent.body,'synthetic-body');assert.equal(sent.signal,abort.signal);
    assert.equal(headers.get('x-synthetic'),'retained');assert.equal(headers.get('x-company-id'),'synthetic-company');
    assert.equal(headers.get('x-scope'),scope);assert.equal(headers.get('x-tenant-id'),scope==='grupo'?'synthetic-group':'synthetic-company');
    assert.equal(headers.get('x-group-id'),scope==='grupo'?'synthetic-group':null);
    assert.equal(new Headers(init.headers).has('x-company-id'),false);
  }
});
test('external string/URL/Request paths remain untouched even in Group scope',async()=>{
  for(const input of ['https://outside.example.invalid/path',new URL('https://outside.example.invalid/path'),new Request('https://outside.example.invalid/path',{headers:{'x-synthetic':'request'}})]){
    const h=network();h.store.set('contexto_atual','grupo');const init={method:'GET',headers:{'x-synthetic':'init'}};
    await h.window.fetch(input,init);assert.equal(h.calls[0].init,init);assert.equal(h.calls[0].input,input);
  }
});
test('explicit Request init headers override Request headers without leaking tenant to another origin',async()=>{
  const h=network(),request=new Request('https://erp.example.invalid/path',{headers:{'x-synthetic':'request'}});
  await h.window.fetch(request,{headers:{'x-synthetic':'init'}});
  assert.equal(new Headers(h.calls[0].init.headers).get('x-synthetic'),'init');
});
test('network guard exits without a browser and fails visibly when its initialization marker cannot be set',()=>{
  vm.runInNewContext(read('src/components/lib/networkGuard.jsx'),{});
  const window={};Object.defineProperty(window,'__networkGuardInitialized',{value:false,writable:false});
  assert.throws(()=>vm.runInNewContext(read('src/components/lib/networkGuard.jsx'),{window}),/initialization blocked/);
});
function browserParams(search,stored={},env={}){
  const writes=[],history=[],store=new Map(Object.entries(stored)),window={location:new URL('https://erp.example.invalid/path'+search+'#synthetic')};
  window.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>{writes.push([key,value]);store.set(key,value);}};
  window.history={replaceState:(_state,_title,url)=>{history.push(url);window.location=new URL(url,window.location.origin);}};
  const result=params({window,document:{title:'Synthetic'},URLSearchParams,__env:env});return{result,writes,history,store,window};
}
test('browser app parameters retain URL/default/storage precedence and remove the synthetic access marker from the URL',()=>{
  const h=browserParams('?app_id=query-app&access_token=synthetic-marker&keep=1',{'base44_app_id':'stored-app'},{VITE_BASE44_APP_ID:'default-app',VITE_BASE44_BACKEND_URL:'https://backend.example.invalid'});
  assert.equal(h.result.appId,'query-app');assert.equal(h.result.serverUrl,'https://backend.example.invalid');
  assert.equal(h.result.token,'synthetic-marker');assert.equal(h.store.get('base44_access_token'),'synthetic-marker');
  assert.equal(h.result.fromUrl.includes('access_token'),false);assert.ok(h.result.fromUrl.includes('keep=1'));
  assert.equal(h.history.length,1);assert.equal(h.window.location.hash,'#synthetic');
  const defaults=browserParams('',{'base44_app_id':'stored-app'},{VITE_BASE44_APP_ID:'default-app'});assert.equal(defaults.result.appId,'default-app');
  const stored=browserParams('',{'base44_app_id':'stored-app'});assert.equal(stored.result.appId,'stored-app');
});
test('unavailable browser storage still fails visibly rather than manufacturing authenticated parameters',()=>{
  const window={};Object.defineProperty(window,'localStorage',{get(){throw new Error('synthetic storage denied');}});
  assert.throws(()=>params({window}),/synthetic storage denied/);
});

function load(file,modules){
  const code=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{assert.ok(name in modules,`Unexpected dependency: ${name}`);return modules[name];},module,module.exports);
  return module.exports;
}
const alertModules={react:React,'@/components/ui/alert':{Alert:({children})=>React.createElement('div',null,children),AlertDescription:({children})=>React.createElement('div',null,children)},'lucide-react':{AlertTriangle:()=>null}};
const summary=()=>load('src/components/common/FormErrorSummary.jsx',alertModules);
test('real error formatter preserves textual messages and legacy empty-string behavior without rendering objects',()=>{
  const {formErrorMessage:format}=summary();
  for(const [input,expected]of [['Synthetic','Synthetic'],['',''],[{message:'Synthetic nested'},'Synthetic nested'],[{message:''},'Campo inválido'],[{message:{}},'Campo inválido'],[{},'Campo inválido'],[null,'Campo inválido'],[undefined,'Campo inválido'],[0,'Campo inválido'],[false,'Campo inválido']])assert.equal(format(input),expected);
});
test('real summary renders invalid nested messages safely and escapes text; empty summaries remain absent',()=>{
  const {default:Summary}=summary();assert.equal(renderToStaticMarkup(React.createElement(Summary,{messages:[]})),'');
  const html=renderToStaticMarkup(React.createElement(Summary,{messages:['<script>synthetic</script>',{message:{synthetic:true}},{message:'Synthetic normal'}]}));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Campo inválido'));assert.ok(html.includes('Synthetic normal'));
});
test('all nine real purchase field render expressions keep errors visible and reject object React children',()=>{
  let total=0;const {formErrorMessage}=summary();
  for(const [name,count]of [['CotacaoForm',2],['OrdemCompraForm',3],['SolicitacaoCompraForm',4]]){
    const file='src/components/compras/'+name+'.jsx',tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),calls=[];
    function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='formErrorMessage')calls.push(node);ts.forEachChild(node,visit);}visit(tree);
    assert.equal(calls.length,count);total+=count;
    for(const call of calls){const field=call.arguments[0].expression.name.text;for(const message of ['Synthetic error',{nested:true},undefined]){
      const rendered=new Function('errors','formErrorMessage',`return ${call.getText(tree)};`)({[field]:{message}},formErrorMessage);
      assert.equal(typeof rendered,'string');assert.equal(rendered,typeof message==='string'?message:'Campo inválido');
    }}
  }
  assert.equal(total,9);
});
function wrapper(){
  const h={states:[],writes:[],captured:null,options:null};
  const methods={handleSubmit:(valid,invalid)=>{h.captured={valid,invalid};return()=>{};}};
  h.module=load('src/components/common/FormWrapper.jsx',{
    react:{...React,useState:initial=>[initial,value=>h.states.push(value)]},
    'react-hook-form':{useForm:options=>{h.options=options;return methods;},FormProvider:({children})=>children},
    '@hookform/resolvers/zod':{zodResolver},'@/lib/utils':{cn:(...values)=>values.join(' ')},
    '@/components/common/FormErrorSummary':summary().default,
    '@/components/lib/useContextoVisual':()=>({carimbarContexto:(data,field)=>({...data,group_id:'synthetic-group',[field]:'synthetic-company'})}),
  });
  h.render=props=>h.module.default({onSubmit:data=>h.writes.push(data),children:null,...props});return h;
}
test('actual wrapper preserves all installed RHF modes and falls back to its existing default for invalid inputs',()=>{
  const h=wrapper(),normalize=h.module.normalizeFormValidationModes;
  const modes=['onBlur','onChange','onSubmit','all','onTouched'],revalidate=['onBlur','onChange','onSubmit'];
  for(const mode of modes)for(const next of revalidate){const result=normalize(mode,next);assert.equal(result.mode,mode);assert.equal(result.reValidateMode,next);h.render({mode,reValidateMode:next});assert.equal(h.options.mode,mode);assert.equal(h.options.reValidateMode,next);}
  for(const bad of [undefined,null,'','invalid',0,false,{},[]])assert.deepEqual(normalize(bad,bad),{mode:'onChange',reValidateMode:'onChange'});
  assert.equal(normalize('onTouched','onTouched').reValidateMode,'onChange');
});
test('actual wrapper retains schema validation before submit, stamping, external data and submit ownership',async()=>{
  const schema=z.object({name:z.string().min(3),group_id:z.literal('synthetic-group'),empresa_id:z.literal('synthetic-company')});
  for(const external of [undefined,{name:'Synthetic external'}]){
    const h=wrapper();h.render({schema,externalData:external});await h.captured.valid({name:'Synthetic internal'});
    assert.equal(h.writes.length,1);assert.equal(h.writes[0].name,external?'Synthetic external':'Synthetic internal');assert.equal(h.writes[0].empresa_id,'synthetic-company');
  }
  const invalid=wrapper();invalid.render({schema});await invalid.captured.valid({name:''});assert.equal(invalid.writes.length,0);assert.ok(invalid.states.at(-1).length);
  const externalInvalid=wrapper();externalInvalid.render({schema,externalData:{name:''}});await externalInvalid.captured.valid({name:'Synthetic valid'});assert.equal(externalInvalid.writes.length,0);
  const raw=wrapper();raw.render({withContext:false});await raw.captured.valid({name:'Synthetic raw',retained:true});assert.deepEqual(raw.writes,[{name:'Synthetic raw',retained:true}]);
  const fail=wrapper();fail.render({onSubmit:async()=>{throw new Error('synthetic submit failure');}});await assert.rejects(()=>fail.captured.valid({name:'Synthetic'}),/synthetic submit failure/);
});
function variable(file,name){
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===name){assert.ok(found===undefined);found=node.initializer;}ts.forEachChild(node,visit);}visit(tree);assert.ok(found);return{tree,node:found};
}
for(const [name,schemaName,valid]of [
  ['CotacaoForm','schema',{descricao:'Synthetic quote',data_criacao:'2026-01-01',data_limite_resposta:'2026-01-02',itens:[{produto_descricao:'Synthetic',quantidade:1,unidade:'UN'}],fornecedores_selecionados:['a','b']}],
  ['OrdemCompraForm','ocSchema',{fornecedor_id:'synthetic',data_solicitacao:'2026-01-01',itens:[{produto_id:'synthetic',descricao:'Synthetic',quantidade_solicitada:1,unidade:'UN',valor_unitario:2,valor_total:2}]}],
  ['SolicitacaoCompraForm','scSchema',{data_solicitacao:'2026-01-01',produto_id:'synthetic',quantidade_solicitada:1,unidade_medida:'UN',justificativa:'Synthetic reason'}],
])test(`${name}: unchanged actual schema still rejects missing fields and supplies textual errors`,()=>{
  const {tree,node}=variable('src/components/compras/'+name+'.jsx',schemaName),schema=new Function('z',`return ${node.getText(tree)};`)(z),{formErrorMessage}=summary();
  assert.equal(schema.safeParse(valid).success,true);const invalid=schema.safeParse({});assert.equal(invalid.success,false);
  for(const issue of invalid.error.issues)assert.equal(formErrorMessage(issue.message),issue.message);
});
test('saving flag initializer remains empty and actual config handler retains context/permission/busy guards and cleanup',async()=>{
  const file='src/components/sistema/ConfigGlobal.jsx',state=variable(file,'[savingField, setSavingField]'),init=state.node.arguments[0];
  assert.ok(ts.isArrowFunction(init));assert.deepEqual(new Function(`return (${init.getText(state.tree)})();`)(),{});
  const command=variable(file,'handleSaveField'),fn=command.node.arguments[0];
  for(const mode of ['success','failure','denied','no-context','busy']){
    let flags=mode==='busy'?{field:true,other:true}:{other:true};const writes=[],events=[];
    const deps={hasValidScope:mode!=='no-context',canEditConfigByPermission:()=>mode!=='denied',hasPermission:()=>false,savingField:flags,setSavingField:update=>{flags=update(flags);},gId:'synthetic-group',eId:'synthetic-company',queryKey:['synthetic'],queryClient:{invalidateQueries:async()=>{}},refetch:async()=>{},toast:{error:value=>events.push(value),success:value=>events.push(value)},base44:{functions:{invoke:async(name,input)=>{writes.push({name,input});if(mode==='failure')throw new Error('synthetic failure');}}}};
    const action=new Function(...Object.keys(deps),`return (${fn.getText(command.tree)});`)(...Object.values(deps));await action('field','Synthetic',{valor:'synthetic'});
    assert.equal(writes.length,['success','failure'].includes(mode)?1:0);assert.equal(flags.other,true);if(mode!=='busy')assert.equal(flags.field,undefined);
    if(writes.length)assert.deepEqual(writes[0].input.scope,{group_id:'synthetic-group',empresa_id:'synthetic-company'});
  }
});
test('explicit undefined React context defaults preserve the former missing-argument runtime defaults',()=>{
  for(const [file,name]of [['src/lib/AuthContext.jsx','AuthContext'],['src/components/lib/WindowManager.jsx','WindowContext']]){
    const {tree,node}=variable(file,name);assert.equal(node.arguments.length,1);assert.equal(node.arguments[0].getText(tree),'undefined');
    const current=new Function('createContext',`return ${node.getText(tree)};`)(React.createContext),prior=Reflect.apply(React.createContext,undefined,[]);
    assert.equal(current._currentValue,prior._currentValue);assert.equal(current._currentValue2,prior._currentValue2);assert.equal(current._currentValue,undefined);
  }
});
test('counted remainder rejects missing/duplicated boundary edits and does not hide other executable changes',()=>{
  const file='src/components/lib/networkGuard.jsx',source=read(file),marker="(input instanceof URL ? input.href : input.url)";
  assert.throws(()=>browserFormBoundaryRemainder(file,source.replace(marker,"''")));
  assert.throws(()=>browserFormBoundaryRemainder(file,source+'\nconst urlStr = typeof input === \'string\' ? input : '+marker+';'));
  const changed=source.replace('const MAX_RETRIES = 3','const MAX_RETRIES = 99');assert.ok(browserFormBoundaryRemainder(file,changed).includes('const MAX_RETRIES = 99'));
});
