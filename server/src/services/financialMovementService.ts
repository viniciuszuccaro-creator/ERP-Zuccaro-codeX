import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {AppError} from '../api/errors.js';
import type {AuditRepository,RequestContext} from '../audit/types.js';
import type {DbClient,DbQueryExecutor} from '../db/client.js';
import type {RbacGuard} from '../db/rbacGuard.js';
import type {TenantGuard} from '../db/tenantGuard.js';
import {PostgresBankStatementStage} from '../repositories/postgresBankStatementStage.js';
import {PostgresBankStatementAccountVerifier} from '../repositories/postgresBankStatementAccountVerifier.js';
import {assertExactReconciliationPair,financialMovementSnapshotSchema,manualFinancialMovementSchema,manualMovementAmount,
  financialReconciliationCommandSchema as binding,financialMovementPageInputSchema} from './financialMovementPolicy.js';

const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/);
const scope=z.object({groupId:uuid,empresaId:uuid,actorId:uuid,requestId:z.string().min(1).max(200)});
const row=z.object({id:uuid,account_id:uuid,amount_minor:z.string(),occurred_at_raw:z.string(),revision:z.string(),
  group_id:uuid,empresa_id:uuid,actor_id:uuid,request_id:z.string(),description:z.string(),
  state:z.literal('POSTED'),origin:z.literal('MANUAL'),currency:z.literal('BRL'),command_hash:hash});
function conflict():never{throw new AppError(409,'FINANCIAL_RECONCILIATION_CONFLICT','Financial evidence conflicts');}

/** Canonical backend for existing CaixaMovimento consumers; no legacy adoption, title creation or automatic reconciliation. */
export class FinancialMovementService{
  private readonly stages=new PostgresBankStatementStage();
  private readonly accounts=new PostgresBankStatementAccountVerifier();
  constructor(private readonly db:DbClient,private readonly rbac:RbacGuard,private readonly tenant:TenantGuard,private readonly audit:AuditRepository){}

  private transaction<T>(raw:RequestContext,section:'Caixa'|'conciliacao',action:'criar'|'visualizar'|'conciliar'|'estornar',fn:(ctx:RequestContext,q:DbQueryExecutor)=>Promise<T>){
    const ctx=Object.freeze({...raw,...scope.parse(raw)});
    return this.db.withTransaction(async q=>{
      const authorize=async()=>{
        await this.tenant.assertEmpresaInGroup(ctx.groupId,ctx.empresaId,q);
        await this.rbac.assertAllowed(ctx,'Financeiro',section,action,{allowGlobalWildcard:false,executor:q});
        await this.rbac.assertAllowed(ctx,'Financeiro',section,'dados-sensiveis.visualizar',{allowGlobalWildcard:false,executor:q});
      };
      await authorize();
      const result=await q.query(`SELECT current_setting('app.group_id',true) AS g,current_setting('app.empresa_id',true) AS e,
        current_setting('transaction_isolation') AS isolation,current_setting('row_security') AS r,
        current_setting('lock_timeout') AS l,current_setting('statement_timeout') AS s,
        (SELECT setting FROM pg_settings WHERE name='lock_timeout') AS lm,
        (SELECT setting FROM pg_settings WHERE name='statement_timeout') AS sm`);
      const session=z.object({g:z.literal(ctx.groupId),e:z.literal(ctx.empresaId),isolation:z.literal('read committed'),
        r:z.enum(['on','off']),l:z.string(),s:z.string(),lm:z.coerce.number().int().min(0).max(2147483647),sm:z.coerce.number().int().min(0).max(2147483647)}).safeParse(result.rows[0]);
      if(!session.success)throw new AppError(403,'FINANCIAL_CONTEXT_REQUIRED','Matching tenant transaction required');
      await q.query("SELECT set_config('row_security','off',true),set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
        [`${Math.min(session.data.lm||5000,5000)}ms`,`${Math.min(session.data.sm||10000,10000)}ms`]);
      const value=await fn(ctx,q);
      await authorize();
      await q.query("SELECT set_config('row_security',$1,true),set_config('lock_timeout',$2,true),set_config('statement_timeout',$3,true)",[session.data.r,session.data.l,session.data.s]);
      return value;
    });
  }
  private async lockAccount(ctx:RequestContext,id:string,q:DbQueryExecutor){
    const company=await q.query("SELECT id FROM empresas WHERE group_id=$1 AND id=$2 AND status='Ativa' FOR SHARE",[ctx.groupId,ctx.empresaId]);
    if(company.rows.length!==1)return conflict();
    const account=await q.query('SELECT id FROM bank_accounts WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND active FOR UPDATE',[ctx.groupId,ctx.empresaId,id]);
    if(account.rows.length!==1)return conflict();
  }
  private async lockOperation(ctx:RequestContext,kind:'movement'|'link',id:string,q:DbQueryExecutor){
    await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['financial',kind,ctx.groupId,ctx.empresaId,id])]);
  }
  private async movement(ctx:RequestContext,id:string,accountId:string,q:DbQueryExecutor){
    const result=await q.query('SELECT *,revision::text AS revision FROM financial_movements WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND account_id=$4 FOR UPDATE',[ctx.groupId,ctx.empresaId,id,accountId]);
    if(result.rows.length!==1)return conflict();
    return row.parse(result.rows[0]);
  }
  postManual(raw:RequestContext,input:unknown){
    const command=manualFinancialMovementSchema.parse(input),amount=manualMovementAmount(command),
      commandHash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
    return this.transaction(raw,'Caixa','criar',async(ctx,q)=>{
      await this.lockAccount(ctx,command.accountId,q);await this.lockOperation(ctx,'movement',command.operationId,q);
      const result=await q.query(`INSERT INTO financial_movements(group_id,empresa_id,id,account_id,actor_id,request_id,
        origin,currency,amount_minor,occurred_at_raw,description,state,revision,command_hash)
        VALUES($1,$2,$3,$4,$5,$6,'MANUAL','BRL',$7,$8,$9,'POSTED',1,$10) ON CONFLICT DO NOTHING RETURNING id`,
        [ctx.groupId,ctx.empresaId,command.operationId,command.accountId,ctx.actorId,ctx.requestId,amount,command.occurredAt,command.description,commandHash]);
      const saved=await this.movement(ctx,command.operationId,command.accountId,q);
      if(saved.command_hash!==commandHash||saved.account_id!==command.accountId||saved.amount_minor!==amount
        ||saved.id!==command.operationId||saved.group_id!==ctx.groupId||saved.empresa_id!==ctx.empresaId
        ||saved.occurred_at_raw!==command.occurredAt||saved.description!==command.description||saved.revision!=='1'
        ||(result.rows.length!==0&&(saved.actor_id!==ctx.actorId||saved.request_id!==ctx.requestId)))return conflict();
      await this.audit.append({...ctx,entity:'CaixaMovimento',entityId:saved.id,action:result.rows.length?'create':'read',
        afterData:{state:'POSTED',origin:'MANUAL',commandHash,replay:result.rows.length===0}},q);
      return {id:saved.id,revision:saved.revision,state:saved.state,replay:result.rows.length===0};
    });
  }
  list(raw:RequestContext,input:unknown){
    const page=financialMovementPageInputSchema.parse(input);
    return this.transaction(raw,'Caixa','visualizar',async(ctx,q)=>{
      await this.lockAccount(ctx,page.accountId,q);
      // Count and slice use one SQL snapshot; account lock also serializes canonical writers.
      const result=await q.query(`WITH filtered AS MATERIALIZED (
        SELECT m.id,m.account_id,m.amount_minor,m.occurred_at_raw,m.revision::text,m.state,m.origin,m.currency,
          EXISTS(SELECT 1 FROM financial_reconciliation_links l WHERE l.group_id=m.group_id
            AND l.empresa_id=m.empresa_id AND l.account_id=m.account_id AND l.movement_id=m.id AND l.active) AS linked
        FROM financial_movements m WHERE m.group_id=$1 AND m.empresa_id=$2 AND m.account_id=$3
      ), eligible AS MATERIALIZED (SELECT * FROM filtered WHERE NOT $4::boolean OR NOT linked)
      SELECT (SELECT count(*)::text FROM eligible) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM
          (SELECT * FROM eligible ORDER BY id LIMIT $5 OFFSET $6) p),'[]'::jsonb) AS data`,
        [ctx.groupId,ctx.empresaId,page.accountId,page.unlinkedOnly,page.limit,page.offset]);
      const saved=z.object({total:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),data:z.array(z.object({
        id:uuid,account_id:uuid,amount_minor:z.string(),occurred_at_raw:z.string(),revision:z.string(),state:z.string(),
        origin:z.string(),currency:z.string(),linked:z.boolean()}).strict()).max(200)}).parse(result.rows[0]);
      const data=saved.data.map(value=>{
        const checked=financialMovementSnapshotSchema.parse({groupId:ctx.groupId,empresaId:ctx.empresaId,id:value.id,
          accountId:value.account_id,amountMinor:value.amount_minor,occurredAt:value.occurred_at_raw,
          revision:value.revision,state:value.state,origin:value.origin,currency:value.currency});
        if(checked.accountId!==page.accountId)return conflict();
        return {...checked,linked:value.linked};
      });
      if(data.length!==Math.min(page.limit,Math.max(0,saved.total-page.offset)))return conflict();
      await this.audit.append({...ctx,entity:'CaixaMovimento',entityId:page.accountId,action:'read',
        afterData:{total:saved.total,returned:data.length,limit:page.limit,offset:page.offset,unlinkedOnly:page.unlinkedOnly}},q);
      return {accountId:page.accountId,total:saved.total,limit:page.limit,offset:page.offset,data};
    });
  }
  reconcile(raw:RequestContext,input:unknown){
    const command=binding.parse(input);
    return this.transaction(raw,'conciliacao','conciliar',async(ctx,q)=>{
      // Same order as bank staging: company -> account -> bank advisory -> batch -> source -> movement.
      const header=await this.stages.pageHeader(ctx,command.batchId,q);
      if(!header||header.reversed)return conflict();
      await this.accounts.verify(ctx,header.account,q,command.accountId);
      await this.stages.lock(ctx,command.batchId,header.account_hash,q);
      const batch=await this.stages.batch(ctx,command.batchId,q,true);
      if(!batch||batch.reversed||batch.statement_hash!==header.statement_hash)return conflict();
      const evidence=batch.items.find(item=>item.identityHash===command.identityHash);
      const sources=await this.stages.rows(ctx,[command.identityHash],q),source=sources[0];
      if(!source||!evidence||source.content_hash!==command.contentHash||evidence.contentHash!==command.contentHash
        ||source.reversed||!isDeepStrictEqual(source.snapshot,evidence.snapshot))return conflict();
      const owners=await this.stages.originals(ctx,[source.batch_id],[command.identityHash],q);
      if(owners.length!==1||owners[0].reversed||!isDeepStrictEqual(owners[0].evidence.snapshot,source.snapshot))return conflict();
      const saved=await this.movement(ctx,command.movementId,command.accountId,q);
      const movement=financialMovementSnapshotSchema.parse({groupId:ctx.groupId,empresaId:ctx.empresaId,id:saved.id,
        accountId:saved.account_id,currency:saved.currency,amountMinor:saved.amount_minor,occurredAt:saved.occurred_at_raw,
        revision:saved.revision,state:saved.state,origin:saved.origin});
      if(movement.revision!==command.movementRevision)return conflict();
      assertExactReconciliationPair({groupId:ctx.groupId,empresaId:ctx.empresaId},
        {groupId:ctx.groupId,empresaId:ctx.empresaId,accountId:command.accountId,batchId:command.batchId,
          identityHash:source.identity_hash,contentHash:source.content_hash,amountMinor:source.payload.amountMinor,currency:'BRL',reversed:source.reversed},movement);
      await this.lockOperation(ctx,'link',command.operationId,q);
      const inserted=await q.query(`INSERT INTO financial_reconciliation_links(group_id,empresa_id,id,account_id,movement_id,
        movement_revision,batch_id,identity_hash,content_hash,actor_id,request_id) VALUES($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10)
        ON CONFLICT DO NOTHING RETURNING id`,[ctx.groupId,ctx.empresaId,command.operationId,command.accountId,command.movementId,
        command.batchId,command.identityHash,command.contentHash,ctx.actorId,ctx.requestId]);
      const found=await q.query(`SELECT account_id,movement_id,movement_revision::text,batch_id,identity_hash,content_hash,active
        FROM financial_reconciliation_links WHERE group_id=$1 AND empresa_id=$2 AND id=$3 FOR UPDATE`,[ctx.groupId,ctx.empresaId,command.operationId]);
      if(found.rows.length!==1||!isDeepStrictEqual(found.rows[0],{account_id:command.accountId,movement_id:command.movementId,
        movement_revision:command.movementRevision,batch_id:command.batchId,identity_hash:command.identityHash,content_hash:command.contentHash,active:true}))return conflict();
      await this.audit.append({...ctx,entity:'ConciliacaoBancaria',entityId:command.operationId,action:inserted.rows.length?'create':'read',
        afterData:{movementId:command.movementId,batchId:command.batchId,identityHash:command.identityHash,active:true,replay:inserted.rows.length===0}},q);
      return {id:command.operationId,active:true,replay:inserted.rows.length===0};
    });
  }
  reverseLink(raw:RequestContext,input:unknown){
    const command=binding.parse(input);
    return this.transaction(raw,'conciliacao','estornar',async(ctx,q)=>{
      await this.lockAccount(ctx,command.accountId,q);
      const movement=await this.movement(ctx,command.movementId,command.accountId,q);
      if(movement.revision!==command.movementRevision)return conflict();
      await this.lockOperation(ctx,'link',command.operationId,q);
      const result=await q.query(`SELECT to_jsonb(l) AS snapshot FROM financial_reconciliation_links l
        WHERE group_id=$1 AND empresa_id=$2 AND id=$3 FOR UPDATE`,[ctx.groupId,ctx.empresaId,command.operationId]);
      if(result.rows.length!==1)return conflict();
      const before=z.record(z.unknown()).parse(result.rows[0].snapshot);
      const evidence=z.object({account_id:uuid,movement_id:uuid,movement_revision:z.literal(1),batch_id:uuid,
        identity_hash:hash,content_hash:hash,active:z.boolean()}).parse(before);
      if(!isDeepStrictEqual(evidence,{account_id:command.accountId,movement_id:command.movementId,movement_revision:1,
        batch_id:command.batchId,identity_hash:command.identityHash,content_hash:command.contentHash,active:evidence.active}))return conflict();
      if(evidence.active){
        const stamp=await this.stages.createdAt(q);
        const changed=await q.query(`UPDATE financial_reconciliation_links l SET active=false,reversed_at=$5::timestamptz,
          reversed_by=$6,reversal_request_id=$7 WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND active
          AND to_jsonb(l)=$4::jsonb RETURNING to_jsonb(l) AS snapshot`,[ctx.groupId,ctx.empresaId,command.operationId,
          JSON.stringify(before),stamp,ctx.actorId,ctx.requestId]);
        const expected={...before,active:false,reversed_at:stamp,reversed_by:ctx.actorId,reversal_request_id:ctx.requestId};
        if(changed.rows.length!==1||!isDeepStrictEqual(changed.rows[0].snapshot,expected))return conflict();
      }
      await this.audit.append({...ctx,entity:'ConciliacaoBancaria',entityId:command.operationId,action:evidence.active?'update':'read',
        beforeData:{active:evidence.active},afterData:{active:false,movementId:command.movementId,replay:!evidence.active}},q);
      return {id:command.operationId,active:false,replay:!evidence.active};
    });
  }
  links(raw:RequestContext,input:unknown){
    const page=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(20),
      offset:z.number().int().min(0).max(2147483647).default(0)}).strict().parse(input);
    return this.transaction(raw,'conciliacao','visualizar',async(ctx,q)=>{
      await this.lockAccount(ctx,page.accountId,q);
      const result=await q.query(`WITH financial_link_history AS MATERIALIZED (
        SELECT id,account_id,movement_id,movement_revision::text,batch_id,identity_hash,content_hash,active
        FROM financial_reconciliation_links WHERE group_id=$1 AND empresa_id=$2 AND account_id=$3)
        SELECT (SELECT count(*)::text FROM financial_link_history) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM
          (SELECT * FROM financial_link_history ORDER BY id LIMIT $4 OFFSET $5) p),'[]'::jsonb) AS data`,
        [ctx.groupId,ctx.empresaId,page.accountId,page.limit,page.offset]);
      const reply=z.object({total:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),data:z.array(z.unknown()).max(200)}).parse(result.rows[0]);
      const data=reply.data.map(value=>this.linkDto(value,page.accountId));
      if(data.length!==Math.min(page.limit,Math.max(0,reply.total-page.offset))||new Set(data.map(row=>row.operationId)).size!==data.length)return conflict();
      await this.audit.append({...ctx,entity:'ConciliacaoBancaria',entityId:page.accountId,action:'read',afterData:{total:reply.total,returned:data.length,limit:page.limit,offset:page.offset}},q);
      return {...page,total:reply.total,data};
    });
  }
  link(raw:RequestContext,input:unknown){
    const ids=z.object({accountId:uuid,operationId:uuid}).strict().parse(input);
    return this.transaction(raw,'conciliacao','visualizar',async(ctx,q)=>{
      // Same account lock as writers: absence is read only after prior canonical writers finish.
      await this.lockAccount(ctx,ids.accountId,q);
      const result=await q.query(`SELECT id,account_id,movement_id,movement_revision::text,batch_id,identity_hash,content_hash,active
        FROM financial_reconciliation_links WHERE group_id=$1 AND empresa_id=$2 AND account_id=$3 AND id=$4`,
        [ctx.groupId,ctx.empresaId,ids.accountId,ids.operationId]);
      if(result.rows.length>1)return conflict();
      const link=result.rows.length?this.linkDto(result.rows[0],ids.accountId):null;
      if(link&&link.operationId!==ids.operationId)return conflict();
      await this.audit.append({...ctx,entity:'ConciliacaoBancaria',entityId:ids.operationId,action:'read',afterData:{found:!!link}},q);
      return {...ids,link};
    });
  }
  private linkDto(value:unknown,accountId:string){
    const row=z.object({id:uuid,account_id:uuid,movement_id:uuid,movement_revision:z.literal('1'),batch_id:uuid,
      identity_hash:hash,content_hash:hash,active:z.boolean()}).strict().parse(value);
    if(row.account_id!==accountId)return conflict();
    return {...binding.parse({operationId:row.id,accountId:row.account_id,movementId:row.movement_id,
      movementRevision:row.movement_revision,batchId:row.batch_id,identityHash:row.identity_hash,contentHash:row.content_hash}),active:row.active};
  }
}
