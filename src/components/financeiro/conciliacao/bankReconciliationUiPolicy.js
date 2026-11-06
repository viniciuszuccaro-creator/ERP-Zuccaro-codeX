import {parseBankStatementPage} from '../../../api/bankStatementContract.js';
import {financialReconciliationCommandSchema,parseFinancialMovementPage} from '../../../api/financialMovementContract.js';

/** Builds only a proposed link from reread pages, not a posting or an authorization.
 * @param {{scope:{groupId:string,empresaId:string,actorId:string},accountId:string,
 * source:Awaited<ReturnType<typeof import('../../../api/httpApiClient').bankStatementApi.page>>,
 * movements:Awaited<ReturnType<typeof import('../../../api/httpApiClient').financialMovementApi.list>>,
 * sourceIdentityHash:string,movementId:string,operationId:string}} input */
export function buildBankReconciliationCommand(input){
  const source=parseBankStatementPage(input.source,{batchId:input.source.batchId,limit:input.source.limit,
    offset:input.source.offset,statementHash:input.source.statementHash});
  const movements=parseFinancialMovementPage(input.movements,{accountId:input.accountId,limit:input.movements.limit,
    offset:input.movements.offset,unlinkedOnly:false},input.scope);
  const bank=source.data.find(row=>row.identityHash===input.sourceIdentityHash);
  const movement=movements.data.find(row=>row.id===input.movementId);
  if(!bank||!movement||movement.linked||movement.state!=='POSTED'||movement.amountMinor!==bank.amountMinor){
    throw new Error('Par bancario e financeiro indisponivel ou divergente.');
  }
  const command=financialReconciliationCommandSchema.parse({accountId:input.accountId,operationId:input.operationId,
    movementId:movement.id,movementRevision:movement.revision,batchId:source.batchId,
    identityHash:bank.identityHash,contentHash:bank.contentHash});
  return {accountId:command.accountId,operationId:command.operationId,movementId:command.movementId,
    movementRevision:command.movementRevision,batchId:command.batchId,identityHash:command.identityHash,contentHash:command.contentHash};
}
