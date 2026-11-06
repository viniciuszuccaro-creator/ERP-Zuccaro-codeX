import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { parseBankStatementPage, parseBankStatementResult } from '../src/api/bankStatementContract.js';

const expected = { groupId:'11111111-1111-4111-8111-111111111111',empresaId:'22222222-2222-4222-8222-222222222222',
  actorId:'33333333-3333-4333-8333-333333333333' };
const accountId='44444444-4444-4444-8444-444444444444',batchId='55555555-5555-4555-8555-555555555555';
const result={batchId,disposition:'STAGED',created:1,replay:0};
const row={sourceId:'000FIT',postedRaw:'20261015120000[-3:BRT]',amountRaw:'-12.30',amountMinor:'-1230',
  identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
const page={batchId,sourceSha256:'c'.repeat(64),statementHash:'d'.repeat(64),total:3,offset:0,limit:1,data:[row]};
const input=()=>({accountId,batchId,file:new File(['SYNTHETIC-OFX'], 'synthetic.ofx')});
const response=data=>new Response(JSON.stringify({data}),{status:200});

test('canonical account pages preserve bank identity, totals and scope without legacy ID conversion',async()=>{
  const account={id:accountId,active:true,identity:{bankId:'001',accountId:'000007',branchId:'0001',currency:'BRL'}};
  const value={total:2,limit:1,offset:0,data:[account]};
  const api=createHttpApiClient({baseUrl:'',getScope:()=>({...expected,token:'x'}),fetchImpl:async(url,options)=>{
    assert.equal(url,'/api/v1/contas-bancarias?limit=1&offset=0');
    assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer x');
    return response(value);
  }}).bankStatements;
  assert.deepEqual(await api.accounts(expected,{limit:1,offset:0}),value);
  for(const bad of [{...value,data:[]},{...value,total:0},{...value,raw:'PRIVATE'},
    {...value,data:[{...account,id:1}]},{...value,data:[{...account,active:false}]},
    {...value,data:[{...account,identity:{...account.identity,accountId:7}}]},
    {...value,data:[account,account],limit:2}]){
    const client=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl:async()=>response(bad)}).bankStatements;
    await assert.rejects(client.accounts(expected,{limit:bad.limit,offset:0}),error=>error.code==='BANK_RESPONSE_INVALID');
  }
});

test('account page refuses invalid pagination, stale identities, cancellation and unaudited errors',async()=>{
  let calls=0;
  const api=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl:async()=>{calls++;return response({});}}).bankStatements;
  for(const bad of [{limit:201},{limit:'1'},{offset:-1},{empresaId:accountId}])
    await assert.rejects(api.accounts(expected,bad),error=>error.status===422);
  const controller=new AbortController();controller.abort();
  await assert.rejects(api.accounts(expected,{}, {signal:controller.signal}),error=>error.code==='BANK_REQUEST_CANCELLED');
  assert.equal(calls,0);
  for(const key of ['actorId','empresaId','groupId','token']){
    const scope={...expected,token:'x'};
    const client=createHttpApiClient({getScope:()=>scope,fetchImpl:async()=>{
      scope[key]='changed';return new Response('PRIVATE',{status:503});
    }}).bankStatements;
    await assert.rejects(client.accounts(expected),error=>error.code==='BANK_STALE_CONTEXT'&&!JSON.stringify(error).includes('PRIVATE'));
  }
});

test('bank transport sends original OFX Blob, Bearer and bound company to the canonical source route',async()=>{
  const scope={...expected,token:'SYNTHETIC-TOKEN'},data=input();
  const api=createHttpApiClient({baseUrl:'',getScope:()=>scope,fetchImpl:async(url,options)=>{
    assert.equal(url,`/api/v1/contas-bancarias/${accountId}/extratos/${batchId}`);
    assert.equal(options.method,'POST');assert.equal(options.body,data.file);
    assert.equal(options.headers['Content-Type'],'application/x-ofx');
    assert.equal(options.headers.Authorization,'Bearer SYNTHETIC-TOKEN');
    assert.equal(options.headers['X-Group-Id'],expected.groupId);assert.equal(options.headers['X-Empresa-Id'],expected.empresaId);
    assert.equal(options.headers['X-Actor-Id'],undefined);
    return response(result);
  }}).bankStatements;
  assert.deepEqual(await api.upload(expected,data),result);
});

test('bank source page preserves exact cent strings, raw bank IDs/date and full total rather than page size',async()=>{
  const api=createHttpApiClient({baseUrl:'',getScope:()=>({...expected,token:'x'}),fetchImpl:async(url)=>{
    assert.equal(url,`/api/v1/contas-bancarias/${accountId}/extratos/${batchId}?limit=1&offset=0`);return response(page);
  }}).bankStatements;
  const value=await api.page(expected,{accountId,batchId,limit:1,offset:0,statementHash:page.statementHash});
  assert.equal(value.total,3);assert.equal(value.data.length,1);assert.equal(value.data[0].sourceId,'000FIT');
  assert.equal(value.data[0].amountMinor,'-1230');assert.equal(value.data[0].postedRaw,row.postedRaw);
});

test('bank transport rejects invalid context, UUIDs, files and pagination before fetch',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return response(result);};
  for(const scope of [{},{...expected},{...expected,token:'x',empresaId:accountId}]){
    const api=createHttpApiClient({getScope:()=>scope,fetchImpl}).bankStatements;
    await assert.rejects(api.upload(expected,input()),error=>error.status===401);
  }
  const api=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl}).bankStatements;
  for(const change of [{accountId:'0'},{batchId:1},{file:new File([], 'empty.ofx')},{file:new File(['x'],'x.csv')},
    {file:new File([new Uint8Array(2000001)],'large.ofx')}]){
    await assert.rejects(api.upload(expected,{...input(),...change}),error=>error.status===422);
  }
  for(const change of [{limit:201},{offset:-1},{offset:'1'},{empresaId:accountId}]){
    await assert.rejects(api.page(expected,{accountId,batchId,...change}),error=>error.status===422);
  }
  assert.equal(calls,0);
});

test('bank transport rejects in-place session changes even when the HTTP operation fails',async()=>{
  for(const key of ['token','actorId','groupId','empresaId'])for(const failed of [false,true]){
    const scope={...expected,token:'x'};
    const api=createHttpApiClient({getScope:()=>scope,fetchImpl:async()=>{
      scope[key]='CHANGED';return failed?new Response('RAW-SECRET',{status:503}):response(result);
    }}).bankStatements;
    await assert.rejects(api.upload(expected,input()),error=>error.status===409&&error.code==='BANK_STALE_CONTEXT'&&!('body' in error));
  }
});

test('bank headers use one frozen scope and the validated file, not later mutable selections',async()=>{
  let reads=0;const data=input(),original=data.file;
  const api=createHttpApiClient({baseUrl:'',getScope:()=>{
    reads++;data.file=new File(['other'],'other.ofx');
    return reads===1?{...expected,token:'original'}:{...expected,token:'changed'};
  },fetchImpl:async(_url,options)=>{
    assert.equal(options.body,original);assert.equal(options.headers.Authorization,'Bearer original');return response(result);
  }}).bankStatements;
  await assert.rejects(api.upload(expected,data),error=>error.status===409);assert.equal(reads,2);
});

test('bank transport cancels before/after network and sanitizes all provider/storage errors',async()=>{
  let calls=0;const controller=new AbortController();controller.abort();
  const api=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl:async()=>{calls++;return response(result);}}).bankStatements;
  await assert.rejects(api.upload(expected,input(),{signal:controller.signal}),error=>error.code==='BANK_REQUEST_CANCELLED');
  assert.equal(calls,0);
  for(const status of [401,403,409,422,503]){
    const client=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl:async()=>
      new Response(JSON.stringify({error:{message:'SYNTHETIC-SECRET',details:{raw:'OFX-RAW'}}}),{status})}).bankStatements;
    await assert.rejects(client.upload(expected,input()),error=>error.status===status&&!error.message.includes('SECRET')
      &&!JSON.stringify(error).includes('OFX-RAW')&&!('body' in error));
  }
  const storageFailure=createHttpApiClient({getScope:()=>{throw new Error('SYNTHETIC-STORAGE-SECRET');}}).bankStatements;
  await assert.rejects(storageFailure.upload(expected,input()),error=>!error.message.includes('SECRET'));
  const late=new AbortController();
  const client=createHttpApiClient({getScope:()=>({...expected,token:'x'}),fetchImpl:async(_url,options)=>{
    assert.equal(options.signal,late.signal);late.abort();return response(result);
  }}).bankStatements;
  await assert.rejects(client.upload(expected,input(),{signal:late.signal}),error=>error.code==='BANK_REQUEST_CANCELLED');
});

test('bank response contracts reject other batches, raw payload leakage, impossible counts and partial page masquerading as complete',()=>{
  assert.deepEqual(parseBankStatementResult(result,batchId),result);
  for(const change of [{batchId:accountId},{created:0},{created:10001},{disposition:'REPLAY'}, {raw:'PRIVATE'}])
    assert.throws(()=>parseBankStatementResult({...result,...change},batchId),/invalida/);
  for(const change of [{batchId:accountId},{total:1,limit:2},{data:[]},{raw:'PRIVATE'},
    {data:[{...row,amountMinor:1234}]},{data:[{...row,original:{memo:'PRIVATE'}}]},
    {data:[row,row],limit:2}])
    assert.throws(()=>parseBankStatementPage({...page,...change},{batchId,limit:1,offset:0}),/invalida/);
  assert.throws(()=>parseBankStatementPage(page,{batchId,limit:1,statementHash:'f'.repeat(64)}),/invalida/);
});
