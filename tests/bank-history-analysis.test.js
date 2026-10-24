import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHttpApiClient} from '../src/api/httpApiClient.js';
import {bankAnalysisInput,parseBankAnalysis} from '../src/components/financeiro/conciliacao/bankAnalysisPolicy.js';
import {consolidation80Hunks,consolidation80Remainder} from './helpers/consolidation80Remainder.js';

const scope={groupId:'11111111-1111-4111-8111-111111111111',empresaId:'22222222-2222-4222-8222-222222222222',actorId:'33333333-3333-4333-8333-333333333333'};
const accountId='44444444-4444-4444-8444-444444444444',movementId='55555555-5555-4555-8555-555555555555',batchId='66666666-6666-4666-8666-666666666666',operationId='77777777-7777-4777-8777-777777777777';
const bank={sourceId:'SYNTHETIC_PRIVATE_FIT',postedRaw:'20261016103000[-3:BRT]',amountRaw:'-12.34',amountMinor:'-1234',identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
const source={batchId,sourceSha256:'c'.repeat(64),statementHash:'d'.repeat(64),total:1,limit:50,offset:0,data:[bank]};
const movement={groupId:scope.groupId,empresaId:scope.empresaId,id:movementId,accountId,currency:'BRL',amountMinor:'-1234',occurredAt:'2026-10-16T10:30:00-03:00',revision:'1',state:'POSTED',origin:'MANUAL',linked:false};
const movements={accountId,total:1,limit:20,offset:0,data:[movement]};
const binding={accountId,operationId,movementId,movementRevision:'1',batchId,identityHash:bank.identityHash,contentHash:bank.contentHash};
const proposal={identityHash:bank.identityHash,movementId,confidence:80,reason:'SYNTHETIC REVIEW REQUIRED'};
const file='src/components/financeiro/ExtratoBancarioImportDialog.jsx',text=fs.readFileSync(file,'utf8');
const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
function handler(name){let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found);return found;}
function fixture(){
 const state={error:'',receipt:null,proposals:[],writes:0,reads:[]};
 const env={scope,accountId,batchId,page:source,movementOffset:0,pinned:false,linkReceipt:null,
  busy:{current:false},alive:{current:true},controller:{current:new AbortController()},command:{current:null},uncertain:{current:false},
  permissions:{current:{canReadMovements:true,canAnalyze:true}},bankAnalysisInput,parseBankAnalysis,
  setPending:()=>{},setError:v=>{state.error=v;},setLinkReceipt:v=>{state.receipt=v;},setRecoveryId:()=>{},
  setBatchId:()=>{},setMovementId:()=>{},setSourceIdentityHash:()=>{},setProposals:v=>{state.proposals=v;},
  financialMovementApi:{link:async()=>{state.reads.push('receipt');return {...binding,link:{...binding,active:true}};},list:async()=>{state.reads.push('movements');return movements;}},
  bankStatementApi:{page:async()=>{state.reads.push('source');return source;}},
  invokeErpIa:async(purpose,input)=>{assert.equal(purpose,'financeiro_conciliacao');assert.equal(input.group_id,scope.groupId);assert.equal(input.empresa_id,scope.empresaId);assert(input.signal);state.reads.push('IA');return {suggestions:[proposal]};}};
 return {env,state,run:(name,...args)=>new Function(...Object.keys(env),handler(name)+';return '+name+';')(...Object.values(env))(...args)};
}

for(const path of Object.keys(consolidation80Hunks))test(path+': entire stage79 source retained outside exact stage80 hunks',()=>{
 const current=fs.readFileSync(path,'utf8');consolidation80Remainder(path,current);
 assert.throws(()=>consolidation80Remainder(path,current+'\n// unrelated'));
 const [after]=consolidation80Hunks[path].hunks[0];assert.throws(()=>consolidation80Remainder(path,current.replace(/\r\n/g,'\n').replace(after,'')));
});
test('IA input contains actual bounded evidence only; output cannot invent identities, signs or automatic writes',()=>{
 const evidence=bankAnalysisInput({scope,accountId,source,movements});
 assert(!evidence.prompt.includes(bank.sourceId));assert(evidence.prompt.includes('-1234'));
 assert.deepEqual(parseBankAnalysis(JSON.stringify({suggestions:[proposal]}),evidence),[proposal]);
 for(const value of [{suggestions:[{...proposal,movementId:operationId}]},{suggestions:[{...proposal,identityHash:'e'.repeat(64)}]},
  {suggestions:[proposal,proposal]},{suggestions:[{...proposal,confidence:101}]},{suggestions:[proposal],execute:true},'invalid'])
  assert.throws(()=>parseBankAnalysis(value,evidence));
 for(const patch of [{amountMinor:'1234'},{linked:true}])
  assert.throws(()=>parseBankAnalysis({suggestions:[proposal]},bankAnalysisInput({scope,accountId,source,movements:{...movements,data:[{...movement,...patch}]}})));
});
test('actual analysis handler rereads canonical pages, calls own IA purpose and returns suggestions without writes',async()=>{
 const f=fixture();await f.run('analyzeSource');assert.deepEqual(f.state.reads,['source','movements','IA']);assert.deepEqual(f.state.proposals,[proposal]);
 for(const mode of ['denied','revoked','provider','abort']){
  const g=fixture();if(mode==='denied')g.env.permissions.current.canAnalyze=false;
  if(mode==='revoked')g.env.bankStatementApi.page=async()=>{g.env.permissions.current.canAnalyze=false;return source;};
  if(mode==='provider')g.env.invokeErpIa=async()=>{throw new Error('SYNTHETIC_SECRET');};
  if(mode==='abort')g.env.invokeErpIa=async()=>{g.env.controller.current.abort();return {suggestions:[proposal]};};
  await g.run('analyzeSource');assert.deepEqual(g.state.proposals,[]);assert(!g.state.error.includes('SYNTHETIC_SECRET'));
 }
});
test('actual recovery is read-only after reopening, retains full identity, distinguishes inactive and unknown, and fails closed',async()=>{
 const f=fixture();await f.run('recoverLink',operationId);assert.deepEqual(f.env.command.current,binding);assert.equal(f.state.receipt.active,true);
 const inactive=fixture();inactive.env.financialMovementApi.link=async()=>({link:{...binding,active:false}});
 await inactive.run('recoverLink',operationId);assert.equal(inactive.env.command.current,null);assert.equal(inactive.state.receipt.active,false);
 const absent=fixture();absent.env.uncertain.current=true;absent.env.command.current=binding;absent.env.financialMovementApi.link=async()=>({link:null});
 await absent.run('recoverLink',operationId);assert.equal(absent.env.uncertain.current,false);assert.deepEqual(absent.env.command.current,binding);
 const denied=fixture();denied.env.uncertain.current=true;denied.env.command.current=binding;
 await denied.run('recoverLink',movementId);assert.deepEqual(denied.state.reads,[]);assert.equal(denied.env.uncertain.current,true);
 const late=fixture();late.env.financialMovementApi.link=async()=>{late.env.permissions.current.canReadMovements=false;return {link:{...binding,active:true}};};
 await late.run('recoverLink',operationId);assert.equal(late.state.receipt,null);
});
test('history transport uses exact GET scope and rejects sensitive fields and stale context without retry',async()=>{
 let calls=0,current={...scope,token:'synthetic-token'};
 const make=fetchImpl=>createHttpApiClient({baseUrl:'https://synthetic.invalid',getScope:()=>current,fetchImpl}).financialMovements;
 const response=data=>new Response(JSON.stringify({data}),{status:200});
 const api=make(async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.headers['X-Empresa-Id'],scope.empresaId);
  const target=new URL(url);return target.pathname.endsWith(operationId)?response({accountId,operationId,link:{...binding,active:true}})
   :response({accountId,total:1,limit:20,offset:0,data:[{...binding,active:true}]});});
 assert.equal((await api.links(scope,{accountId})).total,1);assert.equal((await api.link(scope,{accountId,operationId})).link.active,true);assert.equal(calls,2);
 await assert.rejects(make(async()=>response({accountId,operationId,link:{...binding,active:true,password:'SYNTHETIC_SECRET'}})).link(scope,{accountId,operationId}));
 await assert.rejects(make(async()=>{current={...current,actorId:operationId};return response({accountId,operationId,link:null});}).link(scope,{accountId,operationId}),{code:'BANK_STALE_CONTEXT'});
});
