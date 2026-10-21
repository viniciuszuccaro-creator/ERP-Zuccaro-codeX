import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express,{type ErrorRequestHandler} from 'express';
import {z} from 'zod';
import {mountFinancialMovementRoutes} from '../src/api/financialMovementRoutes.ts';
import {AppError} from '../src/api/errors.ts';
import type {FinancialMovementService} from '../src/services/financialMovementService.ts';
import type {RequestContext} from '../src/audit/types.ts';
import {createHttpApiClient} from '../../src/api/httpApiClient.js';

const groupId='11111111-1111-4111-8111-111111111111',empresaId='22222222-2222-4222-8222-222222222222',
 actorId='33333333-3333-4333-8333-333333333333',accountId='44444444-4444-4444-8444-444444444444',
 movementId='55555555-5555-4555-8555-555555555555',batchId='66666666-6666-4666-8666-666666666666',
 linkId='77777777-7777-4777-8777-777777777777',otherId='88888888-8888-4888-8888-888888888888';
const manual={operationId:movementId,occurredAt:'2026-10-16T10:30:00-03:00',direction:'entrada',amountMinor:'9007199254740993',description:'SYNTHETIC_DESCRIPTION'};
const binding={operationId:linkId,movementId,movementRevision:'1',batchId,identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
const manualPath=`/api/v1/contas-bancarias/${accountId}/movimentos`,linkPath=`/api/v1/contas-bancarias/${accountId}/vinculos`;
const command=z.object({operationId:z.string(),accountId:z.string()});

// Loopback transport with synthetic verified-context flags only. Not real login or DB authorization.
async function fixture(){
 const calls:Array<{name:string,ctx:RequestContext,input:unknown}>=[];
 let fail:unknown,reply:unknown,replaceReply=false;
 function record(name:string,ctx:RequestContext,input:unknown){calls.push({name,ctx,input});if(fail)throw fail;}
 const service:Pick<FinancialMovementService,'postManual'|'list'|'reconcile'|'reverseLink'|'links'|'link'>={
  links:async(ctx,input)=>{record('links',ctx,input);const page=z.object({accountId:z.string(),limit:z.number(),offset:z.number()}).parse(input);return {...page,total:0,data:[]};},
  link:async(ctx,input)=>{record('receipt',ctx,input);const ids=command.parse(input);return {...ids,link:null};},
  postManual:async(ctx,input)=>{record('manual',ctx,input);return {id:command.parse(input).operationId,revision:'1',state:'POSTED',replay:false};},
  list:async(ctx,input)=>{record('list',ctx,input);const page=z.object({accountId:z.string(),limit:z.number(),offset:z.number()}).parse(input);return {...page,total:0,data:[]};},
  reconcile:async(ctx,input)=>{record('link',ctx,input);return {id:command.parse(input).operationId,active:true,replay:false};},
  reverseLink:async(ctx,input)=>{record('reverseLink',ctx,input);return {id:command.parse(input).operationId,active:false,replay:false};}
 };
 for(const name of ['postManual','list','reconcile','reverseLink','links','link']){
  const descriptor=Object.getOwnPropertyDescriptor(service,name);assert.ok(descriptor);
  Object.defineProperty(service,name,{...descriptor,value:async(...args:unknown[])=>{
   const result=await Reflect.apply(descriptor.value,service,args);return replaceReply?reply:result;
  }});
 }
 const app=express();app.disable('x-powered-by');
 app.use((req,_res,next)=>{req.requestId='incoming-untrusted';req.authVerified=req.header('x-synthetic-verified')==='true';
  req.groupId=groupId;req.empresaId=empresaId;req.actorId=actorId;next();});
 mountFinancialMovementRoutes(app,service,req=>({groupId:req.header('x-synthetic-mismatch')?otherId:groupId,
  empresaId,actorId,requestId:req.requestId}));
 const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof AppError)res.status(error.statusCode).json({code:error.code,message:error.message});
  else res.status(500).json({code:'UNEXPECTED'});
 };app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 const base=`http://127.0.0.1:${address.port}`;
 return {baseUrl:base,calls,fail:(value:unknown)=>{fail=value;},reply:(value:unknown)=>{reply=value;replaceReply=true;},
  request:async(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST')=>{
   const result=await fetch(base+path,{method,headers:{'x-synthetic-verified':'true',...body===undefined?{}:{'content-type':'application/json'},...headers},
    ...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
   return {status:result.status,headers:result.headers,text:await result.text()};
  },close:async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
test('financial HTTP: history and recovery are read-only, scoped, no-store and strict',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request(linkPath+'?limit=20&offset=0')).status,200);
  const receipt=await f.request(linkPath+'/'+linkId);
  assert.equal(receipt.status,200);assert.deepEqual(JSON.parse(receipt.text).data,{accountId,operationId:linkId,link:null});
  assert.equal(receipt.headers.get('cache-control'),'no-store, private');
  assert.deepEqual(f.calls.map(c=>c.name),['links','receipt']);
  for(const path of [linkPath+'?limit=201',linkPath+'?active=true',linkPath+'/'+linkId+'?extra=1',linkPath+'/legacy-id'])
   assert.equal((await f.request(path)).status,422);
  assert.equal((await f.request(linkPath,undefined,{'x-synthetic-verified':'false'})).status,401);
  f.reply({accountId,operationId:linkId,link:{...binding,accountId,active:true,description:'SYNTHETIC_SECRET'}});
  const bad=await f.request(linkPath+'/'+linkId);assert.equal(bad.status,503);assert(!bad.text.includes('SYNTHETIC_SECRET'));
 }finally{await f.close();}
});
test('financial HTTP: manual/list/link/unlink route to existing commands with exact identities, precision and fresh context',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request(manualPath,manual)).status,201);
  assert.equal((await f.request(manualPath+'?limit=20&offset=40&unlinkedOnly=true')).status,200);
  assert.equal((await f.request(linkPath,binding)).status,201);
  const {operationId,...body}=binding;assert.equal((await f.request(linkPath+'/'+operationId+'/desfazer',body)).status,200);
  assert.deepEqual(f.calls.map(c=>c.name),['manual','list','link','reverseLink']);
  assert.deepEqual(f.calls[0].input,{...manual,accountId});assert.deepEqual(f.calls[1].input,{accountId,limit:20,offset:40,unlinkedOnly:true});
  assert.deepEqual(f.calls[2].input,{...binding,accountId});assert.deepEqual(f.calls[3].input,{...binding,accountId});
  for(const call of f.calls){assert.equal(call.ctx.groupId,groupId);assert.equal(call.ctx.empresaId,empresaId);assert.equal(call.ctx.actorId,actorId);assert.ok(z.string().uuid().safeParse(call.ctx.requestId).success);}
  assert.equal(new Set(f.calls.map(c=>c.ctx.requestId)).size,4);
 }finally{await f.close();}
});
test('financial HTTP: unverified or mismatched context is denied before malformed JSON parsing and service calls',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request(manualPath,'{',{'x-synthetic-verified':'false'})).status,401);
  assert.equal((await f.request(manualPath,'{',{'x-synthetic-mismatch':'true'})).status,403);
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
test('financial HTTP: reject forged path/body tenant fields, numeric cents, legacy source claims and malformed page options',async()=>{
 const f=await fixture();try{
  for(const patch of [{accountId},{groupId},{empresaId},{actorId},{origin:'PAYMENT'},{amountMinor:123},{amountMinor:'1.23'},{sourceId:batchId}])assert.equal((await f.request(manualPath,{...manual,...patch})).status,422);
  for(const suffix of ['?limit=0','?limit=201','?offset=-1','?offset=2147483648','?unlinkedOnly=1','?limit=1&limit=2','?group_id='+groupId])assert.equal((await f.request(manualPath+suffix)).status,422);
  assert.equal((await f.request(manualPath.replace(accountId,'legacy-id'))).status,422);
  assert.equal((await f.request(linkPath,{...binding,movementRevision:'2'})).status,422);
  assert.equal((await f.request(linkPath,{...binding,accountId})).status,422);
  assert.equal((await f.request(linkPath+'/'+linkId+'/desfazer',binding)).status,422);
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
test('financial HTTP: bounded strict JSON rejects wrong MIME, compression, malformed input and oversized bodies',async()=>{
 const f=await fixture();try{
  for(const [body,headers] of [
   ['{',{}],['[]',{}],[JSON.stringify(manual),{'content-type':'text/plain'}],
   [JSON.stringify(manual),{'content-encoding':'gzip'}],[JSON.stringify({...manual,description:'x'.repeat(17000)}),{}]
  ] satisfies Array<[string,Record<string,string>]>){assert.equal((await f.request(manualPath,body,headers)).status,422);}
  assert.equal((await f.request(manualPath+'?extra=true',manual)).status,422);assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
test('financial HTTP: allowlisted denials keep status, all errors are sanitized and responses are no-store',async()=>{
 const f=await fixture();try{
  for(const [error,status] of [[new AppError(403,'PERMISSION_DENIED','SYNTHETIC_SECRET'),403],
   [new AppError(409,'FINANCIAL_RECONCILIATION_CONFLICT','SYNTHETIC_SECRET'),409],
   [new AppError(500,'PERMISSION_DENIED','SYNTHETIC_SECRET'),503],[new Error('SYNTHETIC_SECRET'),503]] satisfies Array<[Error,number]>){
   f.fail(error);const result=await f.request(manualPath,manual);assert.equal(result.status,status);assert.ok(!result.text.includes('SYNTHETIC_SECRET'));
   assert.equal(result.headers.get('cache-control'),'no-store, private');assert.equal(result.headers.get('x-content-type-options'),'nosniff');
  }
 }finally{await f.close();}
});
test('financial HTTP: wrong operation receipts and extra sensitive fields never escape the boundary',async()=>{
 const f=await fixture();try{
  for(const reply of [{id:otherId,revision:'1',state:'POSTED',replay:false},{id:movementId,revision:'1',state:'POSTED',replay:false,description:'SYNTHETIC_SECRET'}]){
   f.reply(reply);const result=await f.request(manualPath,manual);assert.equal(result.status,503);assert.ok(!result.text.includes('SYNTHETIC_SECRET'));
  }
  f.reply({id:linkId,active:false,replay:false});assert.equal((await f.request(linkPath,binding)).status,503);
  f.reply({id:linkId,active:true,replay:false});const {operationId,...body}=binding;assert.equal((await f.request(linkPath+'/'+operationId+'/desfazer',body)).status,503);
 }finally{await f.close();}
});
test('financial HTTP: list rejects incomplete pages, forged scope, duplicate rows and sensitive extras',async()=>{
 const f=await fixture();try{
  const row={groupId,empresaId,id:movementId,accountId,currency:'BRL',amountMinor:'-9007199254740993',occurredAt:manual.occurredAt,revision:'1',state:'POSTED',origin:'MANUAL',linked:false};
  const page={accountId,total:1,limit:100,offset:0,data:[row]};f.reply(page);assert.equal((await f.request(manualPath)).status,200);
  for(const invalid of [{...page,total:2},{...page,accountId:otherId},{...page,limit:20},{...page,data:[{...row,groupId:otherId}]},
   {...page,data:[{...row,empresaId:otherId}]},{...page,total:2,data:[row,row]},
   {...page,data:[{...row,description:'SYNTHETIC_SECRET'}]},{...page,total:0,data:[row]}]){
   f.reply(invalid);const result=await f.request(manualPath);assert.equal(result.status,503);assert.ok(!result.text.includes('SYNTHETIC_SECRET'));
  }
  f.reply({...page,data:[{...row,linked:true}]});assert.equal((await f.request(manualPath+'?unlinkedOnly=true')).status,503);
 }finally{await f.close();}
});

test('actual session-bound financial client interoperates with prepared routes for all four commands',async()=>{
 const f=await fixture();try{
  const expected={groupId,empresaId,actorId};
  const api=createHttpApiClient({baseUrl:f.baseUrl,getScope:()=>({...expected,token:'synthetic-token'}),
   fetchImpl:(url,options)=>fetch(url,{...options,headers:{...Object.fromEntries(new Headers(options?.headers).entries()),'x-synthetic-verified':'true'}})}).financialMovements;
  const created=await api.postManual(expected,{...manual,accountId,direction:'entrada'});assert.equal(created.id,movementId);
  const page=await api.list(expected,{accountId,limit:20,offset:0});assert.equal(page.total,0);
  const link=await api.reconcile(expected,{...binding,accountId,movementRevision:'1'});assert.equal(link.active,true);
  const reversed=await api.reverseLink(expected,{...binding,accountId,movementRevision:'1'});assert.equal(reversed.active,false);
  assert.deepEqual(f.calls.map(c=>c.name),['manual','list','link','reverseLink']);
 }finally{await f.close();}
});
