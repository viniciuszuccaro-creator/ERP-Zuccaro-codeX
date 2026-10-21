import {createBankRequestExecutor,bankOperationFailure} from './bankStatementHttp.js';
import {manualFinancialMovementSchema,financialReconciliationCommandSchema,financialMovementPageInputSchema,
  parseFinancialMovementPage,parseManualFinancialReceipt,parseFinancialLinkReceipt,financialLinkReadSchema,financialLinksPageSchema,
  parseFinancialLink,parseFinancialLinks} from './financialMovementContract.js';

/** Reuses banking session checks and the existing JSON transport. No automatic retries or ID generation.
 * @param {{getScope:()=>import('./bankStatementHttp').BankScope,
 * request:(path:string,options:import('./bankStatementHttp').BankRequestOptions,scope:Readonly<import('./bankStatementHttp').BankScope>)=>Promise<unknown>}} deps */
export function createFinancialMovementApi(deps){
  const {request}=deps,execute=createBankRequestExecutor(deps);
  return {
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{accountId:string,limit?:number,offset?:number}} input @param {{signal?:AbortSignal}} [options] */
    links(expected,input,options={}){
      const signal=options.signal,checked=financialLinksPageSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,limit,offset}=checked.data;
      return execute(expected,scope=>request(`/api/v1/contas-bancarias/${accountId}/vinculos`,{query:{limit,offset},signal},scope),
        value=>parseFinancialLinks(value,{accountId,limit,offset}),signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{accountId:string,operationId:string}} input @param {{signal?:AbortSignal}} [options] */
    link(expected,input,options={}){
      const signal=options.signal,checked=financialLinkReadSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,operationId}=checked.data;
      return execute(expected,scope=>request(`/api/v1/contas-bancarias/${accountId}/vinculos/${operationId}`,{signal},scope),
        value=>parseFinancialLink(value,{accountId,operationId}),signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{accountId:string,limit?:number,offset?:number,unlinkedOnly?:boolean}} input
     * @param {{signal?:AbortSignal}} [options] */
    list(expected,input,options={}){
      const expectedScope=Object.freeze({...expected});
      const signal=options.signal,checked=financialMovementPageInputSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,limit,offset,unlinkedOnly}=checked.data;
      return execute(expectedScope,scope=>request(`/api/v1/contas-bancarias/${accountId}/movimentos`,
        {query:{limit,offset,unlinkedOnly},signal},scope),
      value=>parseFinancialMovementPage(value,{accountId,limit,offset,unlinkedOnly},expectedScope),signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{operationId:string,accountId:string,occurredAt:string,direction:'entrada'|'saida',amountMinor:string,description:string}} input
     * @param {{signal?:AbortSignal}} [options] */
    postManual(expected,input,options={}){
      const signal=options.signal,checked=manualFinancialMovementSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,...body}=checked.data;
      return execute(expected,scope=>request(`/api/v1/contas-bancarias/${accountId}/movimentos`,
        {method:'POST',body,signal},scope),value=>parseManualFinancialReceipt(value,body.operationId),signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{operationId:string,accountId:string,movementId:string,movementRevision:'1',batchId:string,identityHash:string,contentHash:string}} input
     * @param {{signal?:AbortSignal}} [options] */
    reconcile(expected,input,options={}){
      const signal=options.signal,checked=financialReconciliationCommandSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,...body}=checked.data;
      return execute(expected,scope=>request(`/api/v1/contas-bancarias/${accountId}/vinculos`,
        {method:'POST',body,signal},scope),value=>parseFinancialLinkReceipt(value,body.operationId,true),signal);
    },
    /** Reverses only the named link; the movement is unchanged.
     * @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{operationId:string,accountId:string,movementId:string,movementRevision:'1',batchId:string,identityHash:string,contentHash:string}} input
     * @param {{signal?:AbortSignal}} [options] */
    reverseLink(expected,input,options={}){
      const signal=options.signal,checked=financialReconciliationCommandSchema.safeParse(input);
      if(!checked.success)return Promise.reject(bankOperationFailure('BANK_INPUT_INVALID',422));
      const {accountId,operationId,...body}=checked.data;
      return execute(expected,scope=>request(`/api/v1/contas-bancarias/${accountId}/vinculos/${operationId}/desfazer`,
        {method:'POST',body,signal},scope),value=>parseFinancialLinkReceipt(value,operationId,false),signal);
    },
  };
}
