import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { PostgresBankStatementStage, type StageBatch, type StageItem } from '../repositories/postgresBankStatementStage.js';
import { parseBankStatement, reconcileStatementStage, bankStatementAccountHash, bankStatementStageSignature, bankStatementIdentityHash,
  type BankAccountIdentity, type CsvBankMapping, type StatementTransaction } from './bankStatementImport.js';

export interface BankStatementAccountVerifier {
  /** Verify ownership and lock the existing canonical account through q; request fields are not evidence. */
  verify(ctx: RequestContext, account: Readonly<BankAccountIdentity>, q: DbQueryExecutor, expectedId?:string): Promise<BankAccountIdentity>;
}
export interface BankStatementStageUsageGuard {
  /** Prove complete downstream visibility and lock references through q before allowing reversal. */
  assertUnused(ctx: RequestContext, rows: readonly StatementTransaction[], q: DbQueryExecutor): Promise<void>;
}
const context = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid(), requestId: z.string().min(1).max(200) });
function conflict(): never { throw new AppError(409,'BANK_STAGE_CONFLICT','Bank staging evidence changed or conflicts'); }

/** Mandatory trusted account/usage ports have no default and never come from HTTP input.
 * This persists bank-source staging only, never titles, payments, balances or reconciliation links.
 */
export class BankStatementStageService {
  private readonly repo = new PostgresBankStatementStage();
  constructor(private readonly db: DbClient, private readonly rbac: RbacGuard, private readonly tenant: TenantGuard,
    private readonly audit: AuditRepository, private readonly accounts: BankStatementAccountVerifier,
    private readonly usage: BankStatementStageUsageGuard) {
    if(!accounts || typeof accounts.verify!=='function' || !usage || typeof usage.assertUnused!=='function') {
      throw new AppError(503,'BANK_STAGE_ADAPTER_REQUIRED','Trusted bank account and usage adapters required');
    }
  }

  private transaction<T>(raw: RequestContext, action: 'importar' | 'descartar' | 'visualizar', fn: (ctx: RequestContext, q: DbQueryExecutor) => Promise<T>) {
    const ctx = Object.freeze({ ...raw, ...context.parse(raw) });
    return this.db.withTransaction(async q => {
      const authorize = async () => {
        await this.rbac.assertAllowed(ctx,'Financeiro','conciliacao',action,{ allowGlobalWildcard: false, executor: q });
        if(action==='visualizar')await this.rbac.assertAllowed(ctx,'Financeiro','conciliacao','dados-sensiveis.visualizar',
          {allowGlobalWildcard:false,executor:q});
        await this.tenant.assertEmpresaInGroup(ctx.groupId,ctx.empresaId,q);
      };
      await authorize();
      const state = await q.query(`SELECT current_setting('app.group_id',true) AS group_id,
        current_setting('app.empresa_id',true) AS empresa_id,current_setting('row_security') AS row_security,
        current_setting('transaction_isolation') AS isolation,current_setting('lock_timeout') AS lock_timeout,
        current_setting('statement_timeout') AS statement_timeout,
        (SELECT setting FROM pg_settings WHERE name='lock_timeout') AS lock_ms,
        (SELECT setting FROM pg_settings WHERE name='statement_timeout') AS statement_ms`);
      const session = z.object({ group_id: z.literal(ctx.groupId), empresa_id: z.literal(ctx.empresaId),
        isolation: z.literal('read committed'), row_security: z.enum(['on','off']),lock_timeout:z.string(),statement_timeout:z.string(),
        lock_ms:z.coerce.number().int().min(0).max(2147483647),statement_ms:z.coerce.number().int().min(0).max(2147483647) }).safeParse(state.rows[0]);
      if (!session.success) throw new AppError(403,'BANK_STAGE_CONTEXT_REQUIRED','Matching tenant transaction required');
      // Partial RLS must error rather than make a duplicate/reference look absent. No bypass privilege is granted.
      await q.query("SELECT set_config('row_security','off',true)");
      await q.query("SELECT set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
        [`${Math.min(session.data.lock_ms || 5000,5000)}ms`,`${Math.min(session.data.statement_ms || 10000,10000)}ms`]);
      const result = await fn(ctx,q);
      await q.query("SELECT set_config('row_security',$1,true),set_config('lock_timeout',$2,true),set_config('statement_timeout',$3,true)",
        [session.data.row_security,session.data.lock_timeout,session.data.statement_timeout]);
      await authorize();
      return result;
    });
  }
  page(ctx:RequestContext,batchId:string,input:unknown={}){
    z.string().uuid().parse(batchId);
    const options=z.object({limit:z.number().int().min(1).max(200).default(100),
      offset:z.number().int().min(0).max(10000).default(0),accountId:z.string().uuid().optional()}).strict().parse(input);
    return this.transaction(ctx,'visualizar',async(ctx,q)=>{
      const candidate=await this.repo.pageHeader(ctx,batchId,q);
      if(!candidate)throw new AppError(404,'BANK_STAGE_NOT_FOUND','Staging batch not found');
      const account=await this.accounts.verify(ctx,structuredClone(candidate.account),q,options.accountId);
      if(bankStatementAccountHash(account)!==candidate.account_hash)return conflict();
      // Keep the writer's account -> advisory -> batch ordering to avoid lock inversions.
      await this.repo.lock(ctx,batchId,candidate.account_hash,q);
      const header=await this.repo.pageHeader(ctx,batchId,q,true);
      if(!header||header.reversed||!isDeepStrictEqual(header,candidate))return conflict();
      const items=await this.repo.pageItems(ctx,batchId,options.limit,options.offset,q);
      if(items.length!==Math.min(options.limit,Math.max(0,header.total-options.offset)))return conflict();
      const rows=await this.repo.rows(ctx,items.map(item=>item.identityHash),q);
      const byId=new Map(rows.map(row=>[row.identity_hash,row]));
      const owners=await this.repo.originals(ctx,[...new Set(rows.map(row=>row.batch_id))],items.map(item=>item.identityHash),q);
      const originals=new Map(owners.filter(owner=>!owner.reversed).map(owner=>[`${owner.id}:${owner.evidence.identityHash}`,owner.evidence]));
      if(rows.length!==items.length||new Set(items.map(item=>item.identityHash)).size!==items.length)return conflict();
      const data=items.map(item=>{
        const row=byId.get(item.identityHash);
        const original=row&&originals.get(`${row.batch_id}:${row.identity_hash}`);
        if(!row||row.reversed||!original||row.content_hash!==item.contentHash
          ||bankStatementIdentityHash(account,row.payload.sourceId)!==row.identity_hash
          ||!isDeepStrictEqual(row.snapshot,item.snapshot)||!isDeepStrictEqual(row.snapshot,original.snapshot)
          ||(item.disposition==='NEW')!==(row.batch_id===batchId))return conflict();
        const {sourceId,postedRaw,amountRaw,amountMinor,identityHash,contentHash}=row.payload;
        return {sourceId,postedRaw,amountRaw,amountMinor,identityHash,contentHash};
      });
      await this.audit.append({...ctx,entity:'BankStatementStage',entityId:batchId,action:'read',
        afterData:{operation:'page',offset:options.offset,limit:options.limit,total:header.total,returned:data.length}},q);
      return {batchId,sourceSha256:header.source_sha256,statementHash:header.statement_hash,
        total:header.total,offset:options.offset,limit:options.limit,data};
    });
  }
  private async auditar(ctx: RequestContext, batch: StageBatch, operation: string, q: DbQueryExecutor) {
    await this.audit.append({ ...ctx, entity:'BankStatementStage', entityId:batch.id,
      action: operation==='reverse' ? 'inactivate' : operation==='replay' ? 'read' : 'create',
      beforeData:operation==='stage'?{exists:false}:{exists:true,reversed:false},
      afterData:{ exists:true,reversed:operation==='reverse',operation, parserContract:2, sourceSha256:batch.source_sha256,
        created:batch.items.filter(item=>item.disposition==='NEW').length,
        replay:batch.items.filter(item=>item.disposition==='REPLAY').length } },q);
  }
  /** The caller owns and clears raw bytes after success/failure, including non-HTTP callers.
   * Parser strings/objects remain managed by the runtime; this is not a total memory-erasure guarantee.
   */
  stage(ctx: RequestContext, batchId: string, bytes: Buffer, format: 'ofx' | 'csv', mapping?: CsvBankMapping, expectedAccountId?:string) {
    z.string().uuid().parse(batchId);
    const accountId=expectedAccountId===undefined?undefined:z.string().uuid().parse(expectedAccountId);
    if (!Buffer.isBuffer(bytes) || bytes.length===0 || bytes.length>2000000) throw new AppError(422,'BANK_STATEMENT_INVALID','Invalid bank statement or mapping');
    // The synchronous parser only reads bytes; the HTTP owner clears this buffer after success/failure.
    const statement = parseBankStatement(bytes,format,mapping);
    const accountHash = bankStatementAccountHash(statement.account), signature = bankStatementStageSignature(statement);
    return this.transaction(ctx,'importar',async(ctx,q)=>{
      const verified = await this.accounts.verify(ctx,structuredClone(statement.account),q,accountId);
      await this.repo.lock(ctx,batchId,accountHash,q);
      const saved = await this.repo.batch(ctx,batchId,q,true);
      const ids=statement.transactions.map(row=>row.identityHash);
      const identities=await this.repo.identities(ctx,ids,q);
      const plan = reconcileStatementStage(statement,verified,new Map(identities.map(row=>[row.identity_hash,row.content_hash])));
      if (identities.some(row=>row.reversed) || plan.some(item=>item.disposition==='CONFLICT')) return conflict();
      const rows = await this.repo.rows(ctx,ids,q);
      const byIdentity = new Map(rows.map(row=>[row.identity_hash,row]));
      const owners = await this.repo.originals(ctx,[...new Set(rows.map(row=>row.batch_id))],ids,q);
      const originals = new Map(owners.filter(owner=>!owner.reversed).map(row=>[`${row.id}:${row.evidence.identityHash}`,row.evidence]));
      for (const row of rows) {
        const original = originals.get(`${row.batch_id}:${row.identity_hash}`);
        if (row.reversed || !original || !isDeepStrictEqual(original.snapshot,row.snapshot)) return conflict();
      }
      if (saved) {
        if (saved.reversed || saved.account_hash!==accountHash || saved.statement_hash!==signature
          || saved.items.length!==rows.length || saved.items.some(item=>!isDeepStrictEqual(byIdentity.get(item.identityHash)?.snapshot,item.snapshot))) return conflict();
        await this.auditar(ctx,saved,'replay',q);
        return { batchId, disposition:'REPLAY', created:0, replay:rows.length };
      }
      const createdAt = await this.repo.createdAt(q);
      const items: StageItem[] = statement.transactions.map(payload=>{
        const existing = byIdentity.get(payload.identityHash);
        const snapshot = existing?.snapshot ?? { group_id:ctx.groupId,empresa_id:ctx.empresaId,identity_hash:payload.identityHash,
          batch_id:batchId,content_hash:payload.contentHash,payload,created_at:createdAt,reversed:false,
          reversed_at:null,reversed_by:null,reversal_request_id:null };
        return { identityHash:payload.identityHash,contentHash:payload.contentHash,disposition:existing?'REPLAY':'NEW',snapshot };
      });
      const batch: StageBatch = { id:batchId,account_hash:accountHash,account:statement.account,source_sha256:statement.sourceSha256,
        statement_hash:signature,parser_contract:2,items,reversed:false };
      if (!isDeepStrictEqual(JSON.parse(JSON.stringify(items)),items)) return conflict();
      await this.repo.insertBatch(ctx,batch,q);
      await this.repo.insertRows(ctx,batch,statement.transactions.filter(payload=>!byIdentity.has(payload.identityHash)),q);
      const actual = await this.repo.rows(ctx,items.map(item=>item.identityHash),q);
      const actualById = new Map(actual.map(row=>[row.identity_hash,row]));
      if (actual.length!==items.length || items.some(item=>!isDeepStrictEqual(actualById.get(item.identityHash)?.snapshot,item.snapshot))) return conflict();
      await this.auditar(ctx,batch,'stage',q);
      return { batchId,disposition:'STAGED',created:items.filter(item=>item.disposition==='NEW').length,replay:rows.length };
    });
  }
  reverse(ctx: RequestContext, batchId: string) {
    z.string().uuid().parse(batchId);
    return this.transaction(ctx,'descartar',async(ctx,q)=>{
      const candidate = await this.repo.batch(ctx,batchId,q);
      if (!candidate) throw new AppError(404,'BANK_STAGE_NOT_FOUND','Staging batch not found');
      const verified = await this.accounts.verify(ctx,structuredClone(candidate.account),q);
      if (bankStatementAccountHash(verified)!==candidate.account_hash) return conflict();
      await this.repo.lock(ctx,batchId,candidate.account_hash,q);
      const batch = await this.repo.batch(ctx,batchId,q,true);
      if (!batch || batch.reversed) return conflict();
      const own = batch.items.filter(item=>item.disposition==='NEW');
      const rows = await this.repo.rows(ctx,own.map(item=>item.identityHash),q);
      const byIdentity = new Map(rows.map(row=>[row.identity_hash,row]));
      if (rows.length!==own.length || own.some(item=>{
        const row=byIdentity.get(item.identityHash);
        return !row || row.batch_id!==batchId || row.reversed || !isDeepStrictEqual(item.snapshot,row.snapshot);
      })) return conflict();
      await this.usage.assertUnused(ctx,structuredClone(rows.map(row=>row.payload)),q);
      const current = await this.repo.rows(ctx,own.map(item=>item.identityHash),q);
      if (!isDeepStrictEqual(rows,current)) return conflict();
      await this.repo.reverse(ctx,batch,q);
      await this.auditar(ctx,batch,'reverse',q);
      return { batchId,reversed:own.length };
    });
  }
}
