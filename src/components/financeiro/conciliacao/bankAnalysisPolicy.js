import {z} from 'zod';
import {parseBankStatementPage} from '../../../api/bankStatementContract.js';
import {parseFinancialMovementPage} from '../../../api/financialMovementContract.js';
const response=z.object({suggestions:z.array(z.object({identityHash:z.string().regex(/^[a-f0-9]{64}$/),movementId:z.string().uuid(),
  confidence:z.number().finite().min(0).max(100),reason:z.string().trim().min(1).max(1000)}).strict()).max(50)}).strict();
/** @param {Pick<Parameters<typeof import('./bankReconciliationUiPolicy').buildBankReconciliationCommand>[0], 'scope'|'accountId'|'source'|'movements'>} input */
export function bankAnalysisInput(input){
  const source=parseBankStatementPage(input.source,{batchId:input.source.batchId,limit:input.source.limit,offset:input.source.offset,statementHash:input.source.statementHash});
  const movements=parseFinancialMovementPage(input.movements,{accountId:input.accountId,limit:input.movements.limit,offset:input.movements.offset,unlinkedOnly:false},input.scope);
  const prompt=JSON.stringify({task:'Suggest exact one-to-one pairs only from these pages. No posting, invented IDs, title or payment. Confidence is unverified. Return {suggestions:[{identityHash,movementId,confidence,reason}]}.',
    source:source.data.map(row=>({identityHash:row.identityHash,amountMinor:row.amountMinor,postedRaw:row.postedRaw})),
    movements:movements.data.filter(row=>!row.linked&&row.state==='POSTED').map(row=>({id:row.id,amountMinor:row.amountMinor,occurredAt:row.occurredAt}))});
  if(prompt.length>32000)throw new Error('Pagina excede o limite de analise.');
  return {prompt,source,movements};
}
/** @param {unknown} value @param {ReturnType<typeof bankAnalysisInput>} evidence */
export function parseBankAnalysis(value,evidence){
  const message='Resposta de analise bancaria invalida.';
  let raw=value;
  if(typeof raw==='string'){if(raw.length>100000)throw new Error(message);try{raw=JSON.parse(raw);}catch{throw new Error(message);}}
  const result=response.safeParse(raw);if(!result.success)throw new Error(message);
  const sources=new Set(),movements=new Set();
  for(const proposal of result.data.suggestions){
    const bank=evidence.source.data.find(row=>row.identityHash===proposal.identityHash),movement=evidence.movements.data.find(row=>row.id===proposal.movementId);
    if(!bank||!movement||movement.linked||movement.state!=='POSTED'||movement.amountMinor!==bank.amountMinor
      ||sources.has(proposal.identityHash)||movements.has(proposal.movementId))throw new Error(message);
    sources.add(proposal.identityHash);movements.add(proposal.movementId);
  }
  return result.data.suggestions;
}
