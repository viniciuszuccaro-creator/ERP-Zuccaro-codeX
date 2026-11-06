import {z} from 'zod';

const uuid=z.string().uuid(),digest=z.string().regex(/^[a-f0-9]{64}$/);
const occurredAt=z.string().datetime({offset:true}).refine(value=>{
  const day=value.slice(0,10),parsed=new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(Date.parse(value))&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
});
// Mirrors the canonical prepared backend; compatibility is exercised against its actual schemas.
export const manualFinancialMovementSchema=z.object({operationId:uuid,accountId:uuid,occurredAt,
  direction:z.enum(['entrada','saida']),amountMinor:z.string().regex(/^(?:0|[1-9]\d{0,17})$/),
  description:z.string().trim().min(1).max(1000)}).strict();
export const financialReconciliationCommandSchema=z.object({operationId:uuid,accountId:uuid,movementId:uuid,
  movementRevision:z.literal('1'),batchId:uuid,identityHash:digest,contentHash:digest}).strict();
export const financialMovementPageInputSchema=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(100),
  offset:z.number().int().min(0).max(2147483647).default(0),unlinkedOnly:z.boolean().default(false)}).strict();
const movement=z.object({groupId:uuid,empresaId:uuid,id:uuid,accountId:uuid,currency:z.literal('BRL'),
  amountMinor:z.string().regex(/^(?:0|-?[1-9]\d{0,17})$/),occurredAt,revision:z.string().regex(/^[1-9]\d{0,17}$/),
  state:z.enum(['POSTED','REVERSED']),origin:z.literal('MANUAL'),linked:z.boolean()}).strict();
const pageSchema=z.object({accountId:uuid,total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  limit:z.number().int().min(1).max(200),offset:z.number().int().nonnegative().max(2147483647),data:z.array(movement).max(200)}).strict();
const manualReceipt=z.object({id:uuid,revision:z.literal('1'),state:z.literal('POSTED'),replay:z.boolean()}).strict();
const linkReceipt=z.object({id:uuid,active:z.boolean(),replay:z.boolean()}).strict();
function invalid(){return Object.assign(new Error('Resposta financeira invalida.'),{code:'BANK_RESPONSE_INVALID',status:502});}

/** Wire validation is not proof of financial evidence, authorization or commit.
 * @param {unknown} value @param {{accountId:string,limit:number,offset:number,unlinkedOnly:boolean}} input
 * @param {{groupId:string,empresaId:string}} scope */
export function parseFinancialMovementPage(value,input,scope){
  const checked=pageSchema.safeParse(value);if(!checked.success)throw invalid();
  const page=checked.data;
  if(page.accountId!==input.accountId||page.limit!==input.limit||page.offset!==input.offset
    ||page.data.length!==Math.min(input.limit,Math.max(0,page.total-input.offset))
    ||new Set(page.data.map(row=>row.id)).size!==page.data.length
    ||page.data.some(row=>row.groupId!==scope.groupId||row.empresaId!==scope.empresaId||row.accountId!==input.accountId
      ||(input.unlinkedOnly&&row.linked)))throw invalid();
  return page;
}
/** @param {unknown} value @param {string} operationId */
export function parseManualFinancialReceipt(value,operationId){
  const checked=manualReceipt.safeParse(value);
  if(!checked.success||checked.data.id!==operationId)throw invalid();
  return checked.data;
}
/** @param {unknown} value @param {string} operationId @param {boolean} active */
export function parseFinancialLinkReceipt(value,operationId,active){
  const checked=linkReceipt.safeParse(value);
  if(!checked.success||checked.data.id!==operationId||checked.data.active!==active)throw invalid();
  return {id:checked.data.id,active:checked.data.active,replay:checked.data.replay};
}
const storedLink=financialReconciliationCommandSchema.extend({active:z.boolean()});
export const financialLinkReadSchema=z.object({accountId:uuid,operationId:uuid}).strict();
export const financialLinksPageSchema=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(20),
  offset:z.number().int().nonnegative().max(2147483647).default(0)}).strict();
/** @param {unknown} value @param {{accountId:string,limit:number,offset:number}} expected */
export function parseFinancialLinks(value,expected){
  const checked=z.object({accountId:uuid,limit:z.number().int().min(1).max(200),offset:z.number().int().nonnegative(),
    total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),data:z.array(storedLink).max(200)}).strict().safeParse(value);
  if(!checked.success)throw invalid();const page=checked.data;
  if(page.accountId!==expected.accountId||page.limit!==expected.limit||page.offset!==expected.offset
    ||page.data.length!==Math.min(page.limit,Math.max(0,page.total-page.offset))
    ||page.data.some(row=>row.accountId!==expected.accountId)||new Set(page.data.map(row=>row.operationId)).size!==page.data.length)throw invalid();
  return page;
}
/** @param {unknown} value @param {{accountId:string,operationId:string}} expected */
export function parseFinancialLink(value,expected){
  const checked=z.object({accountId:uuid,operationId:uuid,link:storedLink.nullable()}).strict().safeParse(value);
  if(!checked.success||checked.data.accountId!==expected.accountId||checked.data.operationId!==expected.operationId
    ||(checked.data.link&&(checked.data.link.accountId!==expected.accountId||checked.data.link.operationId!==expected.operationId)))throw invalid();
  return checked.data;
}
