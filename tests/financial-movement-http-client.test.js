import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {z} from 'zod';
import {createHttpApiClient} from '../src/api/httpApiClient.js';
import * as contracts from '../src/api/financialMovementContract.js';

const expected={groupId:'11111111-1111-4111-8111-111111111111',empresaId:'22222222-2222-4222-8222-222222222222',actorId:'33333333-3333-4333-8333-333333333333'};
const accountId='44444444-4444-4444-8444-444444444444',movementId='55555555-5555-4555-8555-555555555555',batchId='66666666-6666-4666-8666-666666666666',linkId='77777777-7777-4777-8777-777777777777',otherId='88888888-8888-4888-8888-888888888888';
const manual={operationId:movementId,accountId,occurredAt:'2026-10-16T10:30:00-03:00',direction:'saida',amountMinor:'9007199254740993',description:'Synthetic manual movement'};
const binding={operationId:linkId,accountId,movementId,movementRevision:'1',batchId,identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
const row={...expected,id:movementId,accountId,currency:'BRL',amountMinor:'-9007199254740993',occurredAt:manual.occurredAt,revision:'1',state:'POSTED',origin:'MANUAL',linked:false};delete row.actorId;
const page={accountId,total:1,offset:0,limit:100,data:[row]};
const response=value=>new Response(JSON.stringify({data:value}),{status:200});
const inputs={postManual:manual,list:{accountId},reconcile:binding,reverseLink:binding};
const receipts={postManual:{id:movementId,revision:'1',state:'POSTED',replay:false},list:page,reconcile:{id:linkId,active:true,replay:false},reverseLink:{id:linkId,active:false,replay:true}};
function fixture(fetchImpl,getScope=()=>({...expected,token:'synthetic-token'})){return createHttpApiClient({baseUrl:'https://synthetic.invalid',getScope,fetchImpl}).financialMovements;}
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
test('shared bank executor and HTTP factory retain complete previous sources outside exact extraction/additions',()=>{
 let bank=read('src/api/bankStatementHttp.js');
 const changes=[['export { failure as bankOperationFailure };\n',''],['export function createBankRequestExecutor({ getScope }) {','export function createBankStatementApi({ getScope, request }) {'],
 ["  return execute;\n}\n\n/** @param {{getScope:()=>BankScope,request:(path:string,options:BankRequestOptions,scope:Readonly<BankScope>)=>Promise<unknown>}} deps */\nexport function createBankStatementApi(deps) {\n  const { request } = deps;\n  const execute = createBankRequestExecutor(deps);\n",'']];
 for(const [after,before] of changes){assert.equal(bank.split(after).length,2);bank=bank.replace(after,before);}
 assert.equal(hash(bank),'145bf54405c26705b0e6f93bd93a391051cba7dbc4c97d13f6de59ba4b0c5131');
 let http=read('src/api/httpApiClient.js');
 for(const addition of ["import { createFinancialMovementApi } from './financialMovementHttp.js';\n",'    financialMovements: createFinancialMovementApi({ getScope, request }),\n',"export const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\n"]){assert.equal(http.split(addition).length,2);http=http.replace(addition,'');}
 assert.equal(hash(http),'6552582391e26c892325ac16955df5d76426e9321565cad61d12361cb9398449');
});
test('four financial methods preserve exact URLs, bodies, primitive scope headers and receipts without retries',async()=>{
 for(const method of Object.keys(inputs)){
  let calls=0;const api=fixture(async(url,init)=>{
   calls++;assert.equal(init.headers.Authorization,'Bearer synthetic-token');assert.equal(init.headers['X-Group-Id'],expected.groupId);assert.equal(init.headers['X-Empresa-Id'],expected.empresaId);assert.ok(!Object.hasOwn(init.headers,'X-Actor-Id'));
   const target=new URL(url);assert.ok(target.pathname.startsWith(`/api/v1/contas-bancarias/${accountId}/`));
   if(method==='list'){assert.equal(init.method,'GET');assert.deepEqual(Object.fromEntries(target.searchParams),{limit:'100',offset:'0',unlinkedOnly:'false'});}
   else{assert.equal(init.method,'POST');const body=JSON.parse(init.body);assert.ok(!Object.hasOwn(body,'accountId'));assert.equal(body.amountMinor,method==='postManual'?manual.amountMinor:undefined);
    if(method==='reverseLink'){assert.equal(target.pathname,`/api/v1/contas-bancarias/${accountId}/vinculos/${linkId}/desfazer`);assert.ok(!Object.hasOwn(body,'operationId'));assert.deepEqual(body,{movementId,movementRevision:'1',batchId,identityHash:binding.identityHash,contentHash:binding.contentHash});}
   }
   return response(receipts[method]);
  });assert.deepEqual(await api[method](expected,inputs[method]),receipts[method]);assert.equal(calls,1);
 }
});
test('invalid identity, permission-independent command schema and primitive token fail before dispatch',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return response({});};
 for(const method of Object.keys(inputs)){
  for(const token of ['',null,{},123])await assert.rejects(fixture(fetchImpl,()=>({...expected,token}))[method](expected,inputs[method]),{code:'BANK_AUTH_REQUIRED'});
  await assert.rejects(fixture(fetchImpl)[method]({...expected,empresaId:otherId},inputs[method]),{code:'BANK_AUTH_REQUIRED'});
  await assert.rejects(fixture(fetchImpl)[method](expected,{...inputs[method],groupId:expected.groupId}),{code:'BANK_INPUT_INVALID'});
 }
 for(const patch of [{accountId:1},{amountMinor:1},{amountMinor:'-1'},{amountMinor:'1.23'},{occurredAt:'2026-02-30T00:00:00Z'},{occurredAt:'2026-10-16T10:00:00+99:99'},{origin:'PAYMENT'}])await assert.rejects(fixture(fetchImpl).postManual(expected,{...manual,...patch}),{code:'BANK_INPUT_INVALID'});
 assert.equal(calls,0);
});
test('success and rejection after actor/company/group/token changes never return stale results or provider details',async()=>{
 for(const method of Object.keys(inputs))for(const field of ['groupId','empresaId','actorId','token'])for(const reject of [false,true]){
  let current={...expected,token:'synthetic-token'},calls=0;
  const api=fixture(async()=>{calls++;current={...current,[field]:field==='token'?'synthetic-new-token':otherId};if(reject)throw new Error('SYNTHETIC_SECRET');return response(receipts[method]);},()=>current);
  await assert.rejects(api[method](expected,inputs[method]),error=>error.code==='BANK_STALE_CONTEXT'&&!error.message.includes('SYNTHETIC_SECRET'));assert.equal(calls,1);
 }
});
test('all methods honor pre-abort and post-dispatch abort, including write receipts',async()=>{
 for(const method of Object.keys(inputs)){
  const early=new AbortController();early.abort();let calls=0;
  await assert.rejects(fixture(async()=>{calls++;return response(receipts[method]);})[method](expected,inputs[method],{signal:early.signal}),{code:'BANK_REQUEST_CANCELLED'});assert.equal(calls,0);
  const late=new AbortController();await assert.rejects(fixture(async(_url,init)=>{assert.equal(init.signal,late.signal);late.abort();return response(receipts[method]);})[method](expected,inputs[method],{signal:late.signal}),{code:'BANK_REQUEST_CANCELLED'});
 }
});
test('list validates frozen expected scope, complete page, unlinked filter and omits any sensitive extras',async()=>{
 const changedExpected={...expected};
 const valid=fixture(async()=>{changedExpected.groupId=otherId;return response(page);});
 assert.deepEqual(await valid.list(changedExpected,{accountId}),page);
 for(const patch of [{accountId:otherId},{limit:20},{total:2},{offset:1},{data:[{...row,groupId:otherId}]},{data:[{...row,empresaId:otherId}]},{data:[{...row,description:'SYNTHETIC_SECRET'}]},{data:[{...row,actorId:expected.actorId}]},{total:2,data:[row,row]}]){
  await assert.rejects(fixture(async()=>response({...page,...patch})).list(expected,{accountId}),{code:'BANK_RESPONSE_INVALID'});
 }
 await assert.rejects(fixture(async()=>response({...page,data:[{...row,linked:true}]})).list(expected,{accountId,unlinkedOnly:true}),{code:'BANK_RESPONSE_INVALID'});
 const empty={accountId,total:0,limit:100,offset:0,data:[]};assert.deepEqual(await fixture(async()=>response(empty)).list(expected,{accountId}),empty);
});
test('wrong command IDs/states/extra fields and upstream errors are sanitized, never retried or treated as success',async()=>{
 for(const method of ['postManual','reconcile','reverseLink'])for(const patch of [{id:otherId},{description:'SYNTHETIC_SECRET'},method==='postManual'?{state:'REVERSED'}:{active:method!=='reconcile'}]){
  let calls=0;await assert.rejects(fixture(async()=>{calls++;return response({...receipts[method],...patch});})[method](expected,inputs[method]),{code:'BANK_RESPONSE_INVALID'});assert.equal(calls,1);
 }
 for(const method of Object.keys(inputs))for(const status of [401,403,409,503]){
  let calls=0;await assert.rejects(fixture(async()=>{calls++;return new Response(JSON.stringify({error:{message:'SYNTHETIC_SECRET',details:{raw:'SYNTHETIC_RAW'}}}),{status});})[method](expected,inputs[method]),error=>error.status===status&&!error.message.includes('SYNTHETIC'));assert.equal(calls,1);
 }
});
test('caller command/expected mutation during dispatch cannot change already captured account, operation or values',async()=>{
 const mutable={...manual};let body;
 const api=fixture(async(_url,init)=>{body=JSON.parse(init.body);mutable.accountId=otherId;mutable.operationId=otherId;mutable.amountMinor='1';return response(receipts.postManual);});
 assert.deepEqual(await api.postManual(expected,mutable),receipts.postManual);assert.equal(body.operationId,movementId);assert.equal(body.amountMinor,manual.amountMinor);
});
test('client command schemas match actual canonical backend acceptance, normalization and validation issues',()=>{
 const file='server/src/services/financialMovementPolicy.ts',exports={};
 const output=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',output)(name=>{if(name==='zod')return {z};if(name==='../api/errors.js')return {AppError:class extends Error{}};assert.fail('Unexpected policy dependency');},exports);
 const outcome=result=>result.success?{success:true,data:result.data}:{success:false,issues:result.error.issues};
 for(const [name,good] of [['manualFinancialMovementSchema',manual],['financialReconciliationCommandSchema',binding],['financialMovementPageInputSchema',{accountId}]]){
  for(const value of [good,{},null,{...good,accountId:1},{...good,groupId:expected.groupId},...name==='manualFinancialMovementSchema'?[{...good,amountMinor:'0'},{...good,description:'  synthetic  '},{...good,occurredAt:'2026-02-30T00:00:00Z'},{...good,occurredAt:'2026-10-16T10:00:00+99:99'}]:[]])assert.deepEqual(outcome(contracts[name].safeParse(value)),outcome(exports[name].safeParse(value)));
 }
});
