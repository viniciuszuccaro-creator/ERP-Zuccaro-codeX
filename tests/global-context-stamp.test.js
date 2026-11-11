import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createLocalEntityProxy,observeEntityApiAccess,notifyEntityApiAccess,isHttpEntityApiAccess} from '../src/api/localEntityReadApi.js';
import {createHttpApiClient} from '../src/api/httpApiClient.js';
import {consolidation81Remainder} from './helpers/consolidation81Remainder.js';

const file='src/components/lib/GlobalContextStamp.jsx';
function load(sourceOverride){
 const exports={},effects=[],dependencies={
  react:{default:{useRef:value=>({current:value})},useEffect:effect=>effects.push(effect)},
  '@/api/base44Client':{base44:{entities:{}}},
  '@/api/localEntityReadApi':{observeEntityApiAccess,isHttpEntityApiAccess},
  '@/components/lib/useContextoVisual':{useContextoVisual:()=>context().current}
 };
 const source=ts.transpileModule(sourceOverride??fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 new Function('require','exports',source)(name=>{assert.ok(Object.hasOwn(dependencies,name));return dependencies[name];},exports);
 return {...exports,effects,dependencies};
}
function context(company='synthetic-a',group='synthetic-group'){
 const scope={group_id:group,...company?{empresa_id:company}:{}};
 return {current:{contextoValido:true,getFiltroContexto:(field,includeGroup)=>{assert.equal(field,'empresa_id');assert.equal(includeGroup,true);return {...scope};},carimbarContexto:data=>({...scope,...data})}};
}
function fixture(){const calls=[],api={};for(const name of ['create','bulkCreate','update','filter','list'])api[name]=function(...args){assert.equal(this,api);calls.push({name,args});return Promise.resolve(args[0]);};return {calls,api};}
test('counterproof: legacy marker probe creates a fake entity; installer never probes or writes marker keys',()=>{
 const names=[],root=createLocalEntityProxy(name=>{names.push(name);return fixture().api;});
 assert.ok(root.__patched_multiempresa_v2);assert.deepEqual(names,['__patched_multiempresa_v2']);
 const actualNames=[],actual=createLocalEntityProxy(name=>{actualNames.push(name);return fixture().api;});actual.Cliente;
 const {installContextStamp}=load(),dispose=installContextStamp(actual,context());
 assert.deepEqual(actualNames,['Cliente']);assert.deepEqual(Object.keys(actual),['Cliente']);dispose();
});
test('actual create/update/bulk stamp canonical context and preserve receiver and commands',async()=>{
 const {calls,api}=fixture(),{installContextStamp}=load(),ref=context(),dispose=installContextStamp({Cliente:api},ref);
 await api.create({descricao:'synthetic'});await api.update('synthetic-id',{ativo:false});await api.bulkCreate([{id:'one'},{id:'two'}]);
 assert.equal(calls.length,3);assert.deepEqual(calls[0].args[0],{group_id:'synthetic-group',empresa_id:'synthetic-a',descricao:'synthetic'});
 assert.equal(calls[1].args[0],'synthetic-id');assert.equal(calls[2].args[0].length,2);
 ref.current=context('synthetic-b').current;await api.create({});assert.equal(calls[3].args[0].empresa_id,'synthetic-b');dispose();
});
test('invalid context, forged company/group, failed or empty stamper and invalid batch block every write before dispatch',()=>{
 for(const patch of [{contextoValido:false},{carimbarContexto:undefined},{carimbarContexto:()=>null},{carimbarContexto:()=>{throw new Error('synthetic failure');}},{getFiltroContexto:()=>({})}]){
  const {api,calls}=fixture(),ref=context();Object.assign(ref.current,patch);const dispose=load().installContextStamp({Cliente:api},ref);
  assert.throws(()=>api.create({}));assert.throws(()=>api.update('synthetic',{}));assert.throws(()=>api.bulkCreate([{}]));assert.equal(calls.length,0);dispose();
 }
 const {api,calls}=fixture(),dispose=load().installContextStamp({Cliente:api},context());
 for(const data of [{group_id:'other'},{grupo_id:'other'},{empresa_id:'other'}])assert.throws(()=>api.create(data));
 for(const data of [null,undefined,'synthetic',[],17])assert.throws(()=>api.create(data));
 assert.throws(()=>api.bulkCreate([{id:'valid'},{empresa_id:'other'}]));assert.throws(()=>api.bulkCreate(null));assert.equal(calls.length,0);dispose();
});
test('scoped reads include group and company, preserve offset/fields; bootstrap keeps legacy unscoped reads only',async()=>{
 const {api,calls}=fixture(),ref=context(),dispose=load().installContextStamp({Cliente:api},ref);
 await api.filter({ativo:true,empresa_id:'other'},'-id',20,40,['id']);await api.list('-id',20,40,['id']);
 assert.deepEqual(calls[0],{name:'filter',args:[{ativo:true,empresa_id:'synthetic-a',group_id:'synthetic-group'},'-id',20,40,['id']]});
 assert.deepEqual(calls[1],{name:'filter',args:[{group_id:'synthetic-group',empresa_id:'synthetic-a'},'-id',20,40,['id']]});
 ref.current=context(null).current;await api.list('id',10,20);assert.deepEqual(calls[2].args[0],{group_id:'synthetic-group'});
 ref.current.contextoValido=false;await api.list('id',10,20);assert.deepEqual(calls[3],{name:'list',args:['id',10,20]});assert.throws(()=>api.create({}));dispose();
});
test('duplicate mounting shares wrappers, detects divergent contexts, and last cleanup restores original API',async()=>{
 const {api,calls}=fixture(),original={...api},{installContextStamp}=load(),a=context(),b=context();
 const first=installContextStamp({Cliente:api},a);first();
 const root={Cliente:api},disposeA=installContextStamp(root,a),wrapped=api.create,disposeB=installContextStamp(root,b);
 assert.equal(api.create,wrapped);await api.create({});assert.equal(calls.length,1);
 b.current=context('other').current;assert.throws(()=>api.create({}),/concorrentes/);disposeB();await api.create({});assert.equal(calls.length,2);
 disposeA();assert.deepEqual(api,original);disposeA();
 const disposeC=installContextStamp(root,a);disposeB();assert.notEqual(api.create,original.create);disposeC();assert.deepEqual(api,original);
});
test('cleanup preserves newer wrappers and excluded APIs, and restores late lazy entities',()=>{
 let lateOriginal;
 const client=fixture().api,user=fixture().api,root=createLocalEntityProxy(()=>{const api=fixture().api;lateOriginal=api.create;return api;});root.Cliente=client;root.User=user;
 const originalUser={...user},dispose=load().installContextStamp(root,context());assert.deepEqual(user,originalUser);
 const late=root.Pedido;assert.notEqual(late.create,lateOriginal);
 const newer=()=>Promise.resolve({});client.create=newer;dispose();assert.equal(client.create,newer);assert.equal(late.create,lateOriginal);
});

test('stage80 counterproof: the preserved installer lets a late API dispatch without the stamp',async()=>{
 const f=fixture(),root=createLocalEntityProxy(()=>f.api);
 const before=consolidation81Remainder(file,fs.readFileSync(file,'utf8'));
 const dispose=load(before).installContextStamp(root,context());
 await root.Pedido.create({id:'synthetic'});
 assert.deepEqual(f.calls[0].args,[{id:'synthetic'}]);dispose();
});

test('late local APIs stamp before first dispatch, share identity, and use current scope',async()=>{
 const f=fixture(),names=[],root=createLocalEntityProxy(name=>{names.push(name);return f.api;}),ref=context();
 const dispose=load().installContextStamp(root,ref);
 await root.Pedido.create({id:'synthetic'});
 assert.equal(f.calls[0].args[0].empresa_id,'synthetic-a');
 assert.equal(root.Pedido,root.Pedido);assert.deepEqual(names,['Pedido']);
 ref.current=context('synthetic-b').current;await root.Pedido.filter({},'id',10,30);
 assert.deepEqual(f.calls[1].args,[{group_id:'synthetic-group',empresa_id:'synthetic-b'},'id',10,30]);
 ref.current.contextoValido=false;assert.throws(()=>root.Pedido.create({}));assert.equal(f.calls.length,2);
 dispose();
});

test('late APIs share mount guards, reject divergent scopes and keep cleanup ownership',async()=>{
 const f=fixture(),original={...f.api},root=createLocalEntityProxy(()=>f.api),loaded=load();
 const a=context(),b=context('other'),releaseA=loaded.installContextStamp(root,a),releaseB=loaded.installContextStamp(root,b);
 assert.throws(()=>root.Pedido.create({}),/concorrentes/);assert.equal(f.calls.length,0);
 const wrapped=root.Pedido.create;assert.equal(root.AliasPedido.create,wrapped);
 releaseB();await root.Pedido.create({});assert.equal(f.calls.length,1);assert.equal(f.calls[0].args[0].empresa_id,'synthetic-a');
 releaseA();assert.deepEqual(f.api,original);
 await root.Cliente.create({id:'after-unmount'});assert.deepEqual(f.calls[1].args,[{id:'after-unmount'}]);
});

test('lazy patch failure is fixed and rolls back only that API; later access retries without dispatch',()=>{
 const first=fixture(),late=fixture(),original={...late.api};
 Object.defineProperty(late.api,'filter',{value:late.api.filter,writable:false,configurable:true});
 const root=createLocalEntityProxy(()=>late.api);root.Cliente=first.api;
 const dispose=load().installContextStamp(root,context()),wrapped=first.api.create;
 assert.throws(()=>root.Pedido,{message:'Falha ao instalar carimbo multiempresa.'});
 assert.equal(late.api.create,original.create);assert.equal(late.api.update,original.update);
 assert.equal(first.api.create,wrapped);assert.equal(late.calls.length,0);
 Object.defineProperty(late.api,'filter',{value:original.filter,writable:true,configurable:true});
 assert.equal(root.Pedido,late.api);assert.notEqual(late.api.create,original.create);
 dispose();assert.deepEqual(late.api,original);
});

test('actual HTTP facade reports transport ownership and preserves pilot payloads without local stamping or fallback',async()=>{
 const path='src/api/base44Client.js',source=fs.readFileSync(path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 let declaration;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='entities')declaration=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(declaration);
 let localReads=0;const f=fixture(),http={entities:{Pedido:f.api}},pilotSet=new Set(['Pedido']);
 const root=new Function('localBase44','http','pilotSet','notifyEntityApiAccess','const '+declaration+';return entities;')(
  {entities:new Proxy({},{get:()=>{localReads++;throw new Error('synthetic-local-must-not-run');}})},http,pilotSet,notifyEntityApiAccess);
 const original=f.api.create,dispose=load().installContextStamp(root,context());
 await root.Pedido.create({id:'synthetic'});assert.deepEqual(f.calls[0].args[0],{id:'synthetic'});assert.equal(localReads,0);
 assert.equal(isHttpEntityApiAccess(root,'Pedido'),true);assert.equal(root.Pedido.create,original);
 dispose();assert.equal(root.Pedido,f.api);
});

test('real HTTP entity preserves scoped headers and canonical body on first and already-materialized access',async()=>{
 const path='src/api/base44Client.js',source=fs.readFileSync(path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 let declaration;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='entities')declaration=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);
 for(const preexisting of [false,true]){
  const scope={groupId:'11111111-1111-4111-8111-111111111111',empresaId:'22222222-2222-4222-8222-222222222222',actorId:'33333333-3333-4333-8333-333333333333',token:'synthetic-token'};
  const payload={itens:[{descricao:'synthetic',quantidade:1}],observacoes:'synthetic'},sent=[];
  const http=createHttpApiClient({baseUrl:'https://synthetic.invalid',getScope:()=>scope,fetchImpl:async(url,options)=>{
   assert.match(url,/\/api\/v1\/entregas$/);assert.equal(options.headers['X-Group-Id'],scope.groupId);
   assert.equal(options.headers['X-Empresa-Id'],scope.empresaId);assert.equal(options.headers.Authorization,'Bearer synthetic-token');
   sent.push(JSON.parse(options.body));return new Response(JSON.stringify({data:{id:'synthetic'}}),{status:201});
  }});
  const local=fixture(),target=preexisting?{Entrega:local.api}:{};
  const root=new Function('localBase44','http','pilotSet','notifyEntityApiAccess','const '+declaration+';return entities;')(
   {entities:target},http,new Set(['Entrega']),notifyEntityApiAccess);
  const dispose=load().installContextStamp(root,context());
  await root.Entrega.create(payload);assert.deepEqual(sent,[payload]);assert.equal(local.calls.length,0);
  assert.equal(root.Entrega,http.entities.Entrega);dispose();
 }
});

test('access observers support reentry and independent cleanup; failures never poison later notifications',()=>{
 const root=createLocalEntityProxy(()=>({}));let calls=0;
 const release=observeEntityApiAccess(root,(name,api)=>{calls++;assert.equal(root[name],api);});
 assert.equal(root.Cliente,root.Cliente);assert.equal(calls,2);release();release();root.Cliente;assert.equal(calls,2);
 const failing=observeEntityApiAccess(root,()=>{throw new Error('synthetic');});
 assert.throws(()=>root.Pedido);failing();
 const final=observeEntityApiAccess(root,()=>{calls++;});root.Pedido;assert.equal(calls,3);final();
});
test('installation failure rolls back prior method changes and returns a fixed error without provider details',()=>{
 const {api}=fixture(),original={...api};Object.defineProperty(api,'filter',{value:api.filter,writable:false,configurable:true});
 assert.throws(()=>load().installContextStamp({Cliente:api},context()),{message:'Falha ao instalar carimbo multiempresa.'});
 assert.equal(api.create,original.create);assert.equal(api.bulkCreate,original.bulkCreate);assert.equal(api.update,original.update);
});
test('component installs through its effect and cleanup restores methods without rendering UI',()=>{
 const loaded=load(),{api}=fixture(),original={...api};loaded.dependencies['@/api/base44Client'].base44.entities={Cliente:api};
 assert.equal(loaded.default(),null);assert.equal(loaded.effects.length,1);
 const cleanup=loaded.effects[0]();assert.notEqual(api.create,original.create);assert.equal(typeof cleanup,'function');cleanup();assert.deepEqual(api,original);
});
