import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { bankAccountIdentitySchema } from './bankStatementImport.js';

const contextSchema=z.object({groupId:z.string().uuid(),empresaId:z.string().uuid(),
  actorId:z.string().uuid(),requestId:z.string().min(1).max(200)});
const rowSchema=z.object({id:z.string().uuid(),bank_id:z.string(),account_id:z.string(),
  branch_id:z.string().nullable(),currency:z.literal('BRL'),active:z.boolean()});
type AccountRow=z.infer<typeof rowSchema>;
function identity(row:AccountRow) {
  return bankAccountIdentitySchema.parse({bankId:row.bank_id,accountId:row.account_id,
    ...(row.branch_id===null?{}:{branchId:row.branch_id}),currency:row.currency});
}
function conflict():never{throw new AppError(409,'BANK_ACCOUNT_CONFLICT','Bank account identity conflicts');}

/** Missing backend of the existing ContaBancariaEmpresa master; no legacy ID adoption.
 * HTTP authentication is supplied by the canonical producer, never by request-body claims.
 */
export class BankAccountService {
  constructor(private readonly db:DbClient,private readonly rbac:RbacGuard,
    private readonly tenant:TenantGuard,private readonly audit:AuditRepository){}

  private transaction<T>(raw:RequestContext,action:'criar'|'visualizar',fn:(ctx:RequestContext,q:DbQueryExecutor)=>Promise<T>){
    const ctx=Object.freeze({...raw,...contextSchema.parse(raw)});
    return this.db.withTransaction(async q=>{
      const authorize=async()=>{
        await this.rbac.assertAllowed(ctx,'Financeiro','ContaBancariaEmpresa',action,{allowGlobalWildcard:false,executor:q});
        if(action==='visualizar')await this.rbac.assertAllowed(ctx,'Financeiro','ContaBancariaEmpresa','dados-sensiveis.visualizar',
          {allowGlobalWildcard:false,executor:q});
        await this.tenant.assertEmpresaInGroup(ctx.groupId,ctx.empresaId,q);
      };
      await authorize();
      const result=await q.query(`SELECT current_setting('app.group_id',true) AS g,
        current_setting('app.empresa_id',true) AS e,current_setting('row_security') AS r,
        current_setting('transaction_isolation') AS isolation,current_setting('lock_timeout') AS lock_timeout,
        current_setting('statement_timeout') AS statement_timeout,
        (SELECT setting FROM pg_settings WHERE name='lock_timeout') AS lock_ms,
        (SELECT setting FROM pg_settings WHERE name='statement_timeout') AS statement_ms`);
      const session=z.object({g:z.literal(ctx.groupId),e:z.literal(ctx.empresaId),r:z.enum(['on','off']),
        isolation:z.literal('read committed'),lock_timeout:z.string(),statement_timeout:z.string(),
        lock_ms:z.coerce.number().int().min(0).max(2147483647),
        statement_ms:z.coerce.number().int().min(0).max(2147483647)}).safeParse(result.rows[0]);
      if(!session.success)throw new AppError(403,'BANK_ACCOUNT_CONTEXT_REQUIRED','Matching tenant transaction required');
      await q.query("SELECT set_config('row_security','off',true)");
      await q.query("SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
        [`${Math.min(session.data.lock_ms||5000,5000)}ms`,`${Math.min(session.data.statement_ms||10000,10000)}ms`]);
      // Protect company ownership while creating/reading the master; no inferred sharing.
      const company=await q.query("SELECT id FROM empresas WHERE group_id=$1 AND id=$2 AND status='Ativa' FOR SHARE", [ctx.groupId,ctx.empresaId]);
      if(company.rows.length!==1)throw new AppError(409,'TENANT_MISMATCH','Company unavailable');
      const value=await fn(ctx,q);
      await authorize();
      await q.query("SELECT set_config('row_security',$1,true),set_config('lock_timeout',$2,true),set_config('statement_timeout',$3,true)",
        [session.data.r,session.data.lock_timeout,session.data.statement_timeout]);
      return value;
    });
  }

  register(raw:RequestContext,operationId:string,input:unknown){
    const id=z.string().uuid().parse(operationId),account=bankAccountIdentitySchema.parse(input);
    return this.transaction(raw,'criar',async(ctx,q)=>{
      await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([ctx.groupId,ctx.empresaId,id])]);
      const existing=await q.query(`SELECT id,bank_id,account_id,branch_id,currency,active FROM bank_accounts
        WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR UPDATE`,[id,ctx.groupId,ctx.empresaId]);
      let row:AccountRow;
      const replay=existing.rows.length===1;
      if(replay){
        row=rowSchema.parse(existing.rows[0]);
        if(row.id!==id||!row.active||!isDeepStrictEqual(identity(row),account))return conflict();
      }else{
        const inserted=await q.query(`INSERT INTO bank_accounts(id,group_id,empresa_id,bank_id,account_id,branch_id,currency)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING
          RETURNING id,bank_id,account_id,branch_id,currency,active`,
          [id,ctx.groupId,ctx.empresaId,account.bankId,account.accountId,account.branchId??null,account.currency]);
        if(inserted.rows.length!==1)return conflict();
        row=rowSchema.parse(inserted.rows[0]);
        if(row.id!==id||!row.active||!isDeepStrictEqual(identity(row),account))return conflict();
      }
      await this.audit.append({...ctx,entity:'ContaBancariaEmpresa',entityId:id,action:replay?'read':'create',
        beforeData:{exists:replay},afterData:{exists:true,active:true,replay}},q);
      return {id:row.id,active:row.active,replay};
    });
  }

  list(raw:RequestContext,input:{limit:number;offset:number}){
    const page=z.object({limit:z.number().int().min(1).max(200),
      offset:z.number().int().min(0).max(2147483647)}).strict().parse(input);
    return this.transaction(raw,'visualizar',async(ctx,q)=>{
      // Keep count and page consistent under READ COMMITTED, including absent rows.
      await q.query('LOCK TABLE bank_accounts IN SHARE MODE NOWAIT');
      const count=await q.query(`SELECT count(*)::text AS total FROM bank_accounts
        WHERE group_id=$1 AND empresa_id=$2 AND active=true`,[ctx.groupId,ctx.empresaId]);
      const total=z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(count.rows[0]?.total);
      const result=await q.query(`SELECT id,bank_id,account_id,branch_id,currency,active FROM bank_accounts
        WHERE group_id=$1 AND empresa_id=$2 AND active=true ORDER BY id LIMIT $3 OFFSET $4`,
        [ctx.groupId,ctx.empresaId,page.limit,page.offset]);
      const data=result.rows.map(value=>{
        const row=rowSchema.parse(value);
        return {id:row.id,active:row.active,identity:identity(row)};
      });
      await this.audit.append({...ctx,entity:'ContaBancariaEmpresa',entityId:ctx.empresaId,action:'read',
        afterData:{total,returned:data.length,limit:page.limit,offset:page.offset}},q);
      return {total,...page,data};
    });
  }

  get(raw:RequestContext,accountId:string){
    const id=z.string().uuid().parse(accountId);
    return this.transaction(raw,'visualizar',async(ctx,q)=>{
      const found=await q.query(`SELECT id,bank_id,account_id,branch_id,currency,active FROM bank_accounts
        WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR SHARE`,[id,ctx.groupId,ctx.empresaId]);
      if(found.rows.length!==1)throw new AppError(404,'BANK_ACCOUNT_NOT_FOUND','Bank account unavailable');
      const row=rowSchema.parse(found.rows[0]);
      await this.audit.append({...ctx,entity:'ContaBancariaEmpresa',entityId:id,action:'read',
        afterData:{exists:true,active:row.active}},q);
      return {id:row.id,active:row.active,identity:identity(row)};
    });
  }
}
