import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {once} from 'node:events';
import express,{type ErrorRequestHandler} from 'express';
import { PGlite } from '@electric-sql/pglite';
import type { QueryResultRow } from 'pg';
import { z } from 'zod';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import type { AuditEntry } from '../src/audit/types.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { FinancialMovementService } from '../src/services/financialMovementService.ts';
import {mountFinancialMovementRoutes} from '../src/api/financialMovementRoutes.ts';
import {AppError} from '../src/api/errors.ts';
import { parseBankStatement, bankStatementAccountHash, bankStatementStageSignature } from '../src/services/bankStatementImport.ts';

const groupId='11111111-1111-4111-8111-111111111111',empresaId='22222222-2222-4222-8222-222222222222',
  actorId='33333333-3333-4333-8333-333333333333',accountId='44444444-4444-4444-8444-444444444444',
  movementId='55555555-5555-4555-8555-555555555555',batchId='66666666-6666-4666-8666-666666666666',
  linkId='77777777-7777-4777-8777-777777777777',otherId='88888888-8888-4888-8888-888888888888';
const ctx={groupId,empresaId,actorId,requestId:'synthetic-financial-consolidation'};
const manual={operationId:movementId,accountId,occurredAt:'2026-10-16T10:30:00-03:00',direction:'entrada',amountMinor:'1234',description:'SYNTHETIC_PRIVATE_DESCRIPTION'};
const bytes=Buffer.from('bank;account;currency;id;day;amount\n001;0007;BRL;SYNTHETIC_FIT;2026-10-16;12,34');
const statement=parseBankStatement(bytes,'csv',{delimiter:';',decimal:',',columns:{bankId:'bank',accountId:'account',currency:'currency',sourceId:'id',posted:'day',amount:'amount'}});
const payload=statement.transactions[0];
const binding={operationId:linkId,accountId,movementId,movementRevision:'1',batchId,identityHash:payload.identityHash,contentHash:payload.contentHash};
const at=(params:unknown[]|undefined,index:number)=>z.string().parse(params?.[index]);

// Stateful command fixture only. No production SQL, locks, constraints, DDL or migrations execute.
async function fixture(){
  const local=new PGlite(),rbac=new InMemoryRbacGuard();
  let movements=new Map<string,Record<string,unknown>>(),links=new Map<string,Record<string,unknown>>(),audits:AuditEntry[]=[];
  let failAudit=false,revoke=false,failQuery=false,tamper=false,corruptOwner=false;
  const grant=(actions=['criar','visualizar','conciliar','estornar','dados-sensiveis.visualizar'])=>rbac.link({actorId,groupId,empresaId,
    permissions:{Financeiro:{Caixa:actions,conciliacao:actions}}});
  grant();
  const sourceSnapshot={group_id:groupId,empresa_id:empresaId,batch_id:batchId,identity_hash:payload.identityHash,
    content_hash:payload.contentHash,payload,reversed:false};
  const evidence={identityHash:payload.identityHash,contentHash:payload.contentHash,disposition:'NEW',snapshot:sourceSnapshot};
  const batch={id:batchId,account_hash:bankStatementAccountHash(statement.account),account:statement.account,source_sha256:statement.sourceSha256,
    statement_hash:bankStatementStageSignature(statement),parser_contract:2,items:[evidence],reversed:false};
  const writes:string[]=[];
  const q:DbQueryExecutor={async query<T extends QueryResultRow = QueryResultRow>(sql:string,params?:unknown[]){
    if(failQuery)throw new Error('SYNTHETIC_QUERY_FAILED');
    let reply:Record<string,unknown>[]=[];
    if(sql.includes('current_setting'))reply=[{g:groupId,e:empresaId,isolation:'read committed',r:'on',l:'0',s:'0',lm:0,sm:0,
      group_id:groupId,empresa_id:empresaId,rls:'off'}];
    else if(sql.includes('set_config')||sql.includes('pg_advisory_xact_lock'))reply=[];
    else if(sql.includes('FROM empresas')){
      assert.deepEqual(params,[groupId,empresaId]);reply=[{id:empresaId}];
    }else if(sql.includes('FROM bank_accounts')){
      assert.equal(params?.[0],groupId);assert.equal(params?.[1],empresaId);
      reply=sql.includes('SELECT bank_id')?[{bank_id:'001',account_id:'0007',branch_id:null,currency:'BRL'}]
        :at(params,2)===accountId?[{id:accountId}]:[];
    }else if(sql.includes('FROM bank_statement_stage_batches')){
      assert.equal(params?.[0],groupId);assert.equal(params?.[1],empresaId);
      if(sql.includes('LATERAL'))reply=[{id:batchId,reversed:false,evidence:corruptOwner?{...evidence,snapshot:{...sourceSnapshot,reversed:true}}:evidence}];
      else if(at(params,2)===batchId)reply=[sql.includes('jsonb_array_length')?{...batch,total:1}:batch];
    }else if(sql.includes('FROM bank_statement_stage_rows')){
      assert.equal(params?.[0],groupId);assert.equal(params?.[1],empresaId);reply=[{snapshot:sourceSnapshot}];
    }else if(sql.startsWith('INSERT INTO financial_movements')){
      writes.push(sql);assert.equal(params?.[0],groupId);assert.equal(params?.[1],empresaId);
      const id=at(params,2);
      if(!movements.has(id)){
        movements.set(id,{group_id:groupId,empresa_id:empresaId,id,account_id:at(params,3),actor_id:at(params,4),request_id:at(params,5),
          amount_minor:at(params,6),occurred_at_raw:at(params,7),description:at(params,8),command_hash:at(params,9),
          state:'POSTED',revision:'1',origin:'MANUAL',currency:'BRL'});reply=[{id}];
      }
    }else if(sql.startsWith('WITH filtered AS MATERIALIZED')){
      assert.deepEqual(params?.slice(0,3),[groupId,empresaId,accountId]);
      const data=[...movements.values()].map(m=>({id:m.id,account_id:m.account_id,amount_minor:m.amount_minor,occurred_at_raw:m.occurred_at_raw,
        revision:m.revision,state:m.state,origin:m.origin,currency:m.currency,
        linked:[...links.values()].some(l=>l.movement_id===m.id&&l.active===true)}))
        .filter(m=>!params?.[3]||!m.linked).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      const limit=z.number().parse(params?.[4]),offset=z.number().parse(params?.[5]);
      reply=[{total:String(data.length),data:data.slice(offset,offset+limit)}];
    }else if(sql.includes('FROM financial_movements')){
      assert.deepEqual(params?.slice(0,2),[groupId,empresaId]);
      const m=movements.get(at(params,2));if(m&&m.account_id===params?.[3])reply=[m];
    }else if(sql.startsWith('INSERT INTO financial_reconciliation_links')){
      writes.push(sql);assert.deepEqual(params?.slice(0,2),[groupId,empresaId]);const id=at(params,2);
      if(!links.has(id)&&![...links.values()].some(l=>l.active===true&&(l.movement_id===params?.[4]||l.identity_hash===params?.[6]))){
        links.set(id,{id,group_id:groupId,empresa_id:empresaId,account_id:at(params,3),movement_id:at(params,4),movement_revision:1,
          batch_id:at(params,5),identity_hash:at(params,6),content_hash:at(params,7),actor_id:at(params,8),request_id:at(params,9),active:true});reply=[{id}];
      }
    }else if(sql.includes('WITH financial_link_history')||sql.includes('account_id=$3 AND id=$4')){
      assert.deepEqual(params?.slice(0,3),[groupId,empresaId,accountId]);
      const rows=[...links.values()].filter(l=>l.account_id===params?.[2]).map(l=>({
        id:l.id,account_id:l.account_id,movement_id:l.movement_id,movement_revision:String(l.movement_revision),
        batch_id:l.batch_id,identity_hash:l.identity_hash,content_hash:l.content_hash,active:l.active
      })).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      reply=sql.includes('WITH financial_link_history')
        ?[{total:String(rows.length),data:rows.slice(z.number().parse(params?.[4]),z.number().parse(params?.[4])+z.number().parse(params?.[3]))}]
        :rows.filter(l=>l.id===params?.[3]);
    }else if(sql.includes('FROM financial_reconciliation_links')){
      assert.deepEqual(params?.slice(0,2),[groupId,empresaId]);const l=links.get(at(params,2));
      if(l)reply=sql.includes('AS snapshot')?[{snapshot:l}]:[{account_id:l.account_id,movement_id:l.movement_id,movement_revision:String(l.movement_revision),
        batch_id:l.batch_id,identity_hash:l.identity_hash,content_hash:l.content_hash,active:l.active}];
    }else if(sql.startsWith('UPDATE financial_reconciliation_links')){
      writes.push(sql);assert.deepEqual(params?.slice(0,2),[groupId,empresaId]);const l=links.get(at(params,2));
      if(l?.active===true&&!tamper){assert.deepEqual(l,JSON.parse(at(params,3)));
        const changed={...l,active:false,reversed_at:at(params,4),reversed_by:at(params,5),reversal_request_id:at(params,6)};
        links.set(at(params,2),changed);reply=[{snapshot:changed}];}
    }else if(sql.includes('AS value'))reply=[{value:'2026-10-17T10:00:00+00:00'}];
    else throw new Error('Unexpected financial SQL contract');
    // PGlite supplies typed result rows through SELECTs over synthetic JSON, not the production statements.
    const keys=[...new Set(reply.flatMap(row=>Object.keys(row)))];
    assert(keys.every(key=>/^[a-z_][a-z_0-9]*$/.test(key)));
    const select=keys.length?`SELECT ${keys.map(key=>`value->'${key}' AS "${key}"`).join(',')} FROM jsonb_array_elements($1::jsonb) AS value`:'SELECT 1 WHERE false';
    const result=await local.query<T>(select,keys.length?[JSON.stringify(reply)]:[]);
    return {rows:result.rows,fields:[],rowCount:result.rows.length,command:'SELECT',oid:0};
  }};
  const db:DbClient={query:q.query,pool:null,checkConnection:async()=>true,end:()=>local.close(),withTransaction:async fn=>{
    const before=structuredClone({movements,links,audits});
    try{return await fn(q);}catch(error){movements=before.movements;links=before.links;audits=before.audits;throw error;}
  }};
  const service=new FinancialMovementService(db,rbac,{assertEmpresaInGroup:async(g,e,executor)=>{
    assert.equal(executor,q);if(g!==groupId||e!==empresaId)throw new Error('SYNTHETIC_SCOPE_DENIED');
  }},{listByEntity:async()=>[],append:async(entry,executor)=>{
    assert.equal(executor,q);assert(!JSON.stringify(entry).includes(manual.description));audits.push(entry);
    if(failAudit)throw new Error('SYNTHETIC_AUDIT_FAILED');if(revoke)grant([]);
  }});
  return {service,close:()=>local.close(),grant,movements:()=>structuredClone(movements),links:()=>structuredClone(links),audits:()=>audits.length,writes,
    failAudit:()=>{failAudit=true;},revoke:()=>{revoke=true;},failQuery:()=>{failQuery=true;},tamper:()=>{tamper=true;},corruptOwner:()=>{corruptOwner=true;}};
}

test('financial history: receipt survives reopening and unlink, with paginated redacted history',async()=>{
  const f=await fixture();try{
    assert.equal((await f.service.link(ctx,{accountId,operationId:linkId})).link,null);
    await f.service.postManual(ctx,manual);await f.service.reconcile(ctx,binding);
    const active=await f.service.link(ctx,{accountId,operationId:linkId});
    assert.deepEqual(active.link,{...binding,active:true});
    const page=await f.service.links(ctx,{accountId,limit:1,offset:0});
    assert.deepEqual(page,{accountId,limit:1,offset:0,total:1,data:[active.link]});
    assert.deepEqual((await f.service.links(ctx,{accountId,limit:1,offset:1})).data,[]);
    assert.equal((await f.service.link(ctx,{accountId,operationId:otherId})).link,null);
    await f.service.reverseLink(ctx,binding);
    assert.equal((await f.service.link(ctx,{accountId,operationId:linkId})).link?.active,false);
    assert.equal((await f.service.links(ctx,{accountId})).total,1);
    assert.equal(f.movements().get(movementId)?.state,'POSTED');
    assert(!JSON.stringify(page).includes(manual.description));
    for(const input of [{accountId,limit:201},{accountId,offset:-1},{accountId,groupId}])
      assert.throws(()=>f.service.links(ctx,input));
    await assert.rejects(f.service.link({...ctx,empresaId:otherId},{accountId,operationId:linkId}));
    await assert.rejects(f.service.link({...ctx,groupId:otherId},{accountId,operationId:linkId}));
    await assert.rejects(f.service.link(ctx,{accountId:otherId,operationId:linkId}));
  }finally{await f.close();}
});
test('financial history: query, audit and late authorization failures never release results',async()=>{
  for(const failure of ['query','audit','revoke','denied']){
    const f=await fixture();try{
      await f.service.postManual(ctx,manual);await f.service.reconcile(ctx,binding);
      if(failure==='query')f.failQuery();
      if(failure==='audit')f.failAudit();
      if(failure==='revoke')f.revoke();
      if(failure==='denied')f.grant([]);
      await assert.rejects(f.service.link(ctx,{accountId,operationId:linkId}));
      await assert.rejects(f.service.links(ctx,{accountId}));
      assert.equal(f.links().get(linkId)?.active,true);
    }finally{await f.close();}
  }
});
test('financial consolidation: manual replay, exact 1:1 link and link reversal preserve POSTED movement and history',async()=>{
  const f=await fixture();try{
    assert.equal((await f.service.postManual(ctx,manual)).replay,false);
    assert.equal((await f.service.postManual(ctx,manual)).replay,true);
    assert.equal((await f.service.reconcile(ctx,binding)).replay,false);
    assert.equal((await f.service.reconcile(ctx,binding)).replay,true);
    await assert.rejects(f.service.reconcile(ctx,{...binding,operationId:otherId}),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
    const before=f.movements();assert.equal((await f.service.list(ctx,{accountId})).data[0].linked,true);
    assert.equal((await f.service.list(ctx,{accountId,unlinkedOnly:true})).total,0);
    assert.equal((await f.service.reverseLink(ctx,binding)).replay,false);
    assert.equal((await f.service.reverseLink(ctx,binding)).replay,true);
    assert.deepEqual(f.movements(),before);assert.equal(f.links().get(linkId)?.active,false);
    await assert.rejects(f.service.reconcile(ctx,binding),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
    assert.equal((await f.service.reconcile(ctx,{...binding,operationId:otherId})).active,true);
    assert.equal(f.links().size,2);assert.equal(f.movements().get(movementId)?.state,'POSTED');
    assert(f.writes.every(sql=>!sql.startsWith('UPDATE financial_movements')));
  }finally{await f.close();}
});

test('financial consolidation: list page/count/unlinked and strict input protect raw precision and omit description',async()=>{
  const f=await fixture();try{
    await f.service.postManual(ctx,manual);
    await f.service.postManual(ctx,{...manual,operationId:otherId,direction:'saida',amountMinor:'9007199254740993'});
    const page=await f.service.list(ctx,{accountId,limit:1,offset:1});assert.equal(page.total,2);assert.equal(page.data.length,1);
    assert.equal(page.data[0].amountMinor,'-9007199254740993');assert.equal(page.data[0].occurredAt,manual.occurredAt);
    assert(!JSON.stringify(page).includes(manual.description));
    for(const input of [{accountId,limit:201},{accountId,offset:-1},{accountId,unlinkedOnly:'true'},{accountId,actorId}])
      assert.throws(()=>f.service.list(ctx,input));
    assert.equal((await f.service.list(ctx,{accountId,offset:5})).data.length,0);
  }finally{await f.close();}
});

test('financial consolidation: changed command, source owner, account, revision and tenant fail closed',async()=>{
  const f=await fixture();try{
    await f.service.postManual(ctx,manual);
    await assert.rejects(f.service.postManual(ctx,{...manual,amountMinor:'1235'}),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
    await assert.rejects(f.service.postManual({...ctx,empresaId:otherId},manual));
    await assert.rejects(f.service.postManual({...ctx,groupId:otherId},manual));
    assert.throws(()=>f.service.reconcile(ctx,{...binding,movementRevision:'2'}));
    await assert.rejects(f.service.postManual(ctx,{...manual,accountId:otherId}),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
    f.corruptOwner();await assert.rejects(f.service.reconcile(ctx,binding),{code:'FINANCIAL_RECONCILIATION_CONFLICT'});
    assert.equal(f.links().size,0);
  }finally{await f.close();}
});

test('financial consolidation: granular permission, late revoke, audit/query failure and reversal CAS never claim success',async()=>{
  for(const mode of ['permission','revoke','audit','query','cas']){
    const f=await fixture();try{
      await f.service.postManual(ctx,manual);await f.service.reconcile(ctx,binding);
      const before=f.links(),auditCount=f.audits();
      if(mode==='permission')f.grant(['editar','cancelar','dados-sensiveis.visualizar']);
      if(mode==='revoke')f.revoke();if(mode==='audit')f.failAudit();if(mode==='query')f.failQuery();if(mode==='cas')f.tamper();
      await assert.rejects(f.service.reverseLink(ctx,binding));
      assert.deepEqual(f.links(),before);assert.equal(f.audits(),auditCount);
      assert.equal(f.movements().get(movementId)?.state,'POSTED');
    }finally{await f.close();}
  }
});

test('financial consolidation: manual and link audit failures roll back fixture state without fabricating success',async()=>{
  for(const operation of ['manual','link']){
    const f=await fixture();try{
      if(operation==='link')await f.service.postManual(ctx,manual);
      const before=f.movements(),auditCount=f.audits();f.failAudit();
      await assert.rejects(operation==='manual'?f.service.postManual(ctx,manual):f.service.reconcile(ctx,binding),/SYNTHETIC_AUDIT_FAILED/);
      assert.deepEqual(f.movements(),before);assert.equal(f.links().size,0);assert.equal(f.audits(),auditCount);
    }finally{await f.close();}
  }
});

test('financial consolidation: PII is a separate permission, not implied by create or view',async()=>{
  const f=await fixture();try{
    f.grant(['criar','visualizar']);
    await assert.rejects(f.service.postManual(ctx,manual),{code:'PERMISSION_DENIED'});
    await assert.rejects(f.service.list(ctx,{accountId}),{code:'PERMISSION_DENIED'});
    assert.equal(f.movements().size,0);assert.equal(f.audits(),0);
  }finally{await f.close();}
});

test('financial consolidation: no mounted route, executable private SQL or new movement-reversal API',()=>{
  assert.equal(execFileSync('git',['diff',"e36231b3a7e546aa9fd2529abb8d5edb61d8189c",'--','server/src/api/router.ts','server/src/app.ts','server/migrations'],{encoding:'utf8'}),'');
  for(const name of ['046_bank_statement_stage.sql','048_bank_accounts.sql','049_financial_movements.sql'])assert(!fs.existsSync('migrations/'+name));
  assert.equal('reverseMovement' in FinancialMovementService.prototype,false);
});

test('financial HTTP with canonical service/RBAC/audit fixture: manual replay, link, unlink and denied rollback',async()=>{
 const f=await fixture(),app=express();
 // Synthetic request context, not an operational identity provider or PostgreSQL proof.
 app.use((req,_res,next)=>{req.authVerified=true;req.groupId=groupId;req.empresaId=empresaId;req.actorId=actorId;next();});
 mountFinancialMovementRoutes(app,f.service,req=>({...ctx,requestId:req.requestId}));
 const errors:ErrorRequestHandler=(error,_req,res,_next)=>{res.status(error instanceof AppError?error.statusCode:500).json({code:error instanceof AppError?error.code:'UNEXPECTED'});};app.use(errors);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 const base=`http://127.0.0.1:${address.port}/api/v1/contas-bancarias/${accountId}`;
 const post=async(path:string,body:unknown)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 try{
  const {accountId:manualAccount,...manualBody}=manual;assert.equal(manualAccount,accountId);
  f.grant(['criar','visualizar']);assert.equal((await post('/movimentos',manualBody)).status,403);assert.equal(f.movements().size,0);
  f.grant();assert.equal((await post('/movimentos',manualBody)).status,201);
  assert.equal((await post('/movimentos',manualBody)).body.data.replay,true);
  const {accountId:linkAccount,...linkBody}=binding;assert.equal(linkAccount,accountId);
  assert.equal((await post('/vinculos',linkBody)).status,201);const before=f.movements();
  const {operationId,...reverseBody}=linkBody;
  f.grant(['editar','cancelar','dados-sensiveis.visualizar']);assert.equal((await post('/vinculos/'+operationId+'/desfazer',reverseBody)).status,403);
  assert.equal(f.links().get(linkId)?.active,true);f.grant();
  const reversed=await post('/vinculos/'+operationId+'/desfazer',reverseBody);assert.equal(reversed.status,200);assert.equal(reversed.body.data.active,false);
  assert.deepEqual(f.movements(),before);assert.equal(f.movements().get(movementId)?.state,'POSTED');
  const listed=await fetch(base+'/movimentos?limit=1&offset=0&unlinkedOnly=true');assert.equal(listed.status,200);assert.equal((await listed.json()).data.total,1);
  const audits=f.audits();f.failAudit();assert.equal((await post('/movimentos',{...manualBody,operationId:otherId})).status,503);
  assert.deepEqual(f.movements(),before);assert.equal(f.audits(),audits);
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await f.close();}
});
