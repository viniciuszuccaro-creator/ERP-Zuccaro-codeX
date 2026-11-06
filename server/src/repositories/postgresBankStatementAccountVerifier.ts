import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import { bankAccountIdentitySchema, type BankAccountIdentity } from '../services/bankStatementImport.js';
import type { BankStatementAccountVerifier } from '../services/bankStatementStage.js';

const scopeSchema = z.object({ groupId:z.string().uuid(),empresaId:z.string().uuid(),actorId:z.string().uuid() });
function unavailable(): never {
  throw new AppError(409,'BANK_ACCOUNT_NOT_VERIFIED','Bank account identity unavailable in this company');
}

/** Internal staging port, not an authorization boundary or an account-creation endpoint.
 * The stage service owns authorization/audit and supplies its active transaction executor.
 */
export class PostgresBankStatementAccountVerifier implements BankStatementAccountVerifier {
  async verify(raw: RequestContext, input: Readonly<BankAccountIdentity>, q: DbQueryExecutor, expectedId?:string): Promise<BankAccountIdentity> {
    const scope=scopeSchema.parse(raw), account=bankAccountIdentitySchema.parse(input);
    const id=expectedId===undefined?null:z.string().uuid().parse(expectedId);
    const state=await q.query(`SELECT current_setting('app.group_id',true) AS group_id,
      current_setting('app.empresa_id',true) AS empresa_id,
      current_setting('transaction_isolation') AS isolation,current_setting('row_security') AS rls`);
    const session=z.object({group_id:z.literal(scope.groupId),empresa_id:z.literal(scope.empresaId),
      isolation:z.literal('read committed'),rls:z.literal('off')}).safeParse(state.rows[0]);
    if(!session.success) throw new AppError(403,'BANK_ACCOUNT_CONTEXT_REQUIRED','Matching staging transaction required');
    const company=await q.query("SELECT id FROM empresas WHERE group_id=$1 AND id=$2 AND status='Ativa' FOR SHARE",
      [scope.groupId,scope.empresaId]);
    if(company.rows.length!==1)return unavailable();
    // row_security=off is set by the stage service: partial RLS errors, never proves absence.
    // FOR UPDATE prevents concurrent inactivation until the staging transaction ends.
    const result=await q.query(`SELECT bank_id,account_id,branch_id,currency FROM bank_accounts
      WHERE group_id=$1 AND empresa_id=$2 AND bank_id=$3 AND account_id=$4
        AND branch_id IS NOT DISTINCT FROM $5::text AND currency=$6 AND active AND ($7::uuid IS NULL OR id=$7)
      FOR UPDATE`,[scope.groupId,scope.empresaId,account.bankId,account.accountId,account.branchId??null,account.currency,id]);
    if(result.rows.length!==1) return unavailable();
    const row=z.object({bank_id:z.string(),account_id:z.string(),branch_id:z.string().nullable(),currency:z.literal('BRL')}).parse(result.rows[0]);
    return bankAccountIdentitySchema.parse({bankId:row.bank_id,accountId:row.account_id,
      ...(row.branch_id===null?{}:{branchId:row.branch_id}),currency:row.currency});
  }
}
