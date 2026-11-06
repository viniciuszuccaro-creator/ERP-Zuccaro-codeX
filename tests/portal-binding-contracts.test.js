import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {resolvePortalClienteId,resolvePortalClienteVinculado,assertPortalClienteScope,resolvePortalSessionState,applyPortalReadScope} from '../src/components/lib/portalClientePolicy.js';
import {consolidation82Hunks,consolidation82Remainder} from './helpers/consolidation82Remainder.js';
import {consolidation83Hunks} from './helpers/consolidation83Remainder.js';
import {consolidation84Hunks} from './helpers/consolidation84Remainder.js';
import {applyLocalEntityUpdateTransitions} from '../src/api/localEntityUpdateTransitions.js';

const user={id:'synthetic-user'},client={id:'synthetic-client',portal_usuario_id:user.id};
const files=['src/pages/PortalCliente.jsx','src/components/portal/DashboardCliente.jsx','src/components/portal/DashboardClienteInterativo.jsx','src/components/portal/DocumentosCliente.jsx'];
function queries(file){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),result=[];
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useQuery')result.push(Object.fromEntries(node.arguments[0].properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(ast),p.initializer.getText(ast)])));ts.forEachChild(node,visit);};visit(ast);return result;
}
const bind=(source,deps)=>new Function(...Object.keys(deps),`return (${source});`)(...Object.values(deps));
for(const file of Object.keys(consolidation82Hunks))test(file+': complete prior source outside precisely counted binding hunks',()=>{
 const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');consolidation82Remainder(file,source);
 assert.throws(()=>consolidation82Remainder(file,source+'\n// unrelated'));
 for(const [historical] of consolidation82Hunks[file].hunks){const after=[historical,...(consolidation83Hunks[file]?.hunks||[]).map(h=>h[0]),...(consolidation84Hunks[file]?.hunks||[]).map(h=>h[0])].find(h=>source.includes(h));assert.ok(after);assert.throws(()=>consolidation82Remainder(file,source.replace(after,'')));assert.throws(()=>consolidation82Remainder(file,source+after));}
});
test('unique binding preserves canonical ID; absence remains absence for internal callers',()=>{
 assert.equal(resolvePortalClienteVinculado([client],user),client);
 assert.equal(resolvePortalClienteId([client],user),client.id);
 assert.equal(resolvePortalClienteId([client],{id:'synthetic-employee'}),null);
 assert.equal(resolvePortalClienteId([],{id:user.id}),null);
 assert.equal(resolvePortalClienteId([client],{}),null);
 const numeric={id:23,portal_usuario_id:17};assert.equal(resolvePortalClienteId([numeric],{id:17}),23);
});
test('ambiguous links throw rather than degrading to unrestricted local reads',()=>{
 for(const records of [[client,{...client,id:'synthetic-second'}],[client,client]]){
  assert.throws(()=>resolvePortalClienteId(records,user),/ambiguo/);
  assert.throws(()=>applyPortalReadScope({entityName:'Pedido',records:[],portalClienteId:resolvePortalClienteId(records,user)}),/ambiguo/);
 }
 assert.throws(()=>resolvePortalClienteVinculado(null,user),/invalida/);
 assert.throws(()=>resolvePortalClienteVinculado([{portal_usuario_id:user.id}],user),/Identidade/);
});
test('counterproof: preserved policy selected first duplicate and accepted missing owner',()=>{
 const file='src/components/lib/portalClientePolicy.js',previous=consolidation82Remainder(file,fs.readFileSync(file,'utf8'));
 const exports={};new Function('exports',ts.transpileModule(previous,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(exports);
 assert.equal(exports.resolvePortalClienteId([client,{...client,id:'synthetic-second'}],user),client.id);
 assert.equal(exports.assertPortalClienteScope({user,cliente:{id:client.id}}),true);
 assert.throws(()=>resolvePortalClienteId([client,{...client,id:'synthetic-second'}],user),/ambiguo/);
 assert.throws(()=>assertPortalClienteScope({user,cliente:{id:client.id}}),/nao vinculado/);
});
test('actual local read and financial transition cannot pass ambiguity as absence of scope',()=>{
 const file='src/api/localBase44Client.js',ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let expression;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='applyLocalPortalReadScope')expression=node.initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert.ok(expression);
 let scopeCalls=0,decisionCalls=0;const records=[client,{...client,id:'synthetic-second'}];
 const read=bind(expression,{resolvePortalClienteId,getEntityStore:()=>records,readUser:()=>user,applyPortalReadScope:()=>{scopeCalls++;}});
 assert.throws(()=>read({},'Pedido',[]),/ambiguo/);assert.equal(scopeCalls,0);
 const dependencies={isTituloFinanceiro:()=>true,resolvePortalClienteId,getStore:()=>records,readUser:()=>user,assertTituloOnUpdate:()=>{decisionCalls++;},assertPortalTituloWrite:()=>{decisionCalls++;}};
 assert.throws(()=>applyLocalEntityUpdateTransitions({db:{},entityName:'ContaReceber',id:'synthetic-title',before:{},payload:{},initialRecord:{},dependencies}),/ambiguo/);assert.equal(decisionCalls,0);
});
test('ready state requires proven ownership; administrative preview remains explicit and requires identity',()=>{
 for(const cliente of [{id:client.id},{...client,portal_usuario_id:'other'},{...client,portal_usuario_id:[user.id]}]){
  assert.throws(()=>assertPortalClienteScope({user,cliente}));
  assert.equal(resolvePortalSessionState({user,vinculoCliente:cliente}).state,'sem_permissao');
 }
 assert.equal(resolvePortalSessionState({user,vinculoCliente:client}).state,'pronto');
 assert.equal(resolvePortalSessionState({user:{},vinculoCliente:client,adminMode:true}).state,'sem_permissao');
 const preview={id:'synthetic-preview'};
 assert.equal(resolvePortalClienteVinculado([preview],user,{requestedClienteId:preview.id,adminMode:true}),preview);
 assert.equal(resolvePortalClienteVinculado([preview],user,{requestedClienteId:preview.id}),null);
 assert.throws(()=>resolvePortalClienteVinculado([preview,preview],user,{requestedClienteId:preview.id,adminMode:true}),/ambiguo/);
 assert.equal(resolvePortalSessionState({user,vinculoError:new Error('synthetic-sensitive-detail')}).message.includes('synthetic-sensitive-detail'),false);
});
for(const file of files)test(file+': real binding callback guards auth, rejects ambiguity and preserves unique association',async()=>{
 const query=queries(file)[0],docs=file.endsWith('DocumentosCliente.jsx');let calls=0;
 const deps={user,sessionUser:user,authLoading:false,authError:null,requestedClienteId:null,adminMode:false,resolvePortalClienteVinculado,base44:{auth:{me:async()=>user},entities:{Cliente:{filter:async filter=>{calls++;assert.deepEqual(filter,{portal_usuario_id:user.id});return [client];}}}}};
 assert.equal(bind(query.enabled,deps),true);
 const result=await bind(query.queryFn,deps)();assert.equal(docs?result.cliente:result,client);
 for(const invalid of [{user:null,sessionUser:null},{authLoading:true},{authError:new Error('synthetic')}]){
  const changed={...deps,...invalid};const before=calls;assert.equal(bind(query.enabled,changed),false);await assert.rejects(bind(query.queryFn,changed)());assert.equal(calls,before);
 }
 deps.base44.entities.Cliente.filter=async()=>[client,{...client,id:'synthetic-second'}];await assert.rejects(bind(query.queryFn,deps)(),/ambiguo/);
 deps.base44.entities.Cliente.filter=async()=>{throw new Error('synthetic-query-failure');};await assert.rejects(bind(query.queryFn,deps)(),/synthetic-query-failure/);
 if(!docs&&!file.includes('Interativo')){
  deps.requestedClienteId='synthetic-preview';deps.adminMode=true;deps.base44.entities.Cliente.filter=async filter=>{assert.deepEqual(filter,{id:deps.requestedClienteId});return [{id:deps.requestedClienteId}];};assert.equal((await bind(query.queryFn,deps)()).id,deps.requestedClienteId);
 }
 if(docs){let fetched=false;deps.base44.auth.me=async()=>({id:'synthetic-other-user'});deps.base44.entities.Cliente.filter=async()=>{fetched=true;return[client];};await assert.rejects(bind(query.queryFn,deps)(),/alterada/);assert.equal(fetched,false);}
});
test('document query cache is actor-bound and disabled query callbacks do not read unrestricted data',async()=>{
 const [context,...children]=queries(files[3]);assert.notDeepEqual(bind(context.queryKey,{sessionUser:user}),bind(context.queryKey,{sessionUser:{id:'other'}}));
 for(const query of children){const deps={clienteId:null,sessionUser:user,base44:{entities:new Proxy({},{get(){assert.fail('unrestricted query');}})}};assert.equal(bind(query.enabled,deps),false);assert.deepEqual(await bind(query.queryFn,deps)(),[]);assert.notDeepEqual(bind(query.queryKey,deps),bind(query.queryKey,{...deps,sessionUser:{id:'other'}}));}
});
