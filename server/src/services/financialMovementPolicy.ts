import { z } from 'zod';
import { AppError } from '../api/errors.js';

const uuid=z.string().uuid();
const cents=z.string().regex(/^(?:0|-?[1-9]\d{0,17})$/);
const revision=z.string().regex(/^[1-9]\d{0,17}$/);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const scope=z.object({groupId:uuid,empresaId:uuid}).strict();
export const financialReconciliationCommandSchema=z.object({operationId:uuid,accountId:uuid,movementId:uuid,
  movementRevision:z.literal('1'),batchId:uuid,identityHash:hash,contentHash:hash}).strict();
export const financialMovementPageInputSchema=z.object({accountId:uuid,limit:z.number().int().min(1).max(200).default(100),
  offset:z.number().int().min(0).max(2147483647).default(0),unlinkedOnly:z.boolean().default(false)}).strict();
const occurredAt=z.string().datetime({offset:true}).refine(value=>{
  const day=value.slice(0,10);
  const parsed=new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(Date.parse(value))&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
});

/** Explicit manual entry only. Titles/payments require their own atomic producer, not a claimed source ID. */
export const manualFinancialMovementSchema=z.object({
  operationId:uuid,accountId:uuid,occurredAt,
  direction:z.enum(['entrada','saida']),
  amountMinor:z.string().regex(/^(?:0|[1-9]\d{0,17})$/),
  description:z.string().trim().min(1).max(1000),
}).strict();

/** Preserve decimal precision and zero; never infer an amount or account from a title/bank description. */
export function manualMovementAmount(raw:unknown):string{
  const value=manualFinancialMovementSchema.parse(raw);
  const amount=BigInt(value.amountMinor);
  return (value.direction==='saida'?-amount:amount).toString();
}

export const financialMovementSnapshotSchema=scope.extend({
  id:uuid,accountId:uuid,currency:z.literal('BRL'),amountMinor:cents,occurredAt,
  revision,state:z.enum(['POSTED','REVERSED']),origin:z.literal('MANUAL'),
}).strict();
export const bankReconciliationSourceSchema=scope.extend({
  accountId:uuid,batchId:uuid,identityHash:hash,contentHash:hash,
  amountMinor:cents,currency:z.literal('BRL'),reversed:z.boolean(),
}).strict();
export type FinancialMovementSnapshot=z.infer<typeof financialMovementSnapshotSchema>;
export type BankReconciliationSource=z.infer<typeof bankReconciliationSourceSchema>;

/** Called with locked, server-read evidence only. A suggestion never authorizes this command.
 * First supported binding is exact, one source to one posted movement; partial/many-to-one requires a separate contract.
 */
export function assertExactReconciliationPair(rawScope:unknown,rawSource:unknown,rawMovement:unknown){
  const ctx=scope.parse(rawScope),source=bankReconciliationSourceSchema.parse(rawSource),
    movement=financialMovementSnapshotSchema.parse(rawMovement);
  if(source.groupId!==ctx.groupId||movement.groupId!==ctx.groupId
    ||source.empresaId!==ctx.empresaId||movement.empresaId!==ctx.empresaId
    ||source.accountId!==movement.accountId||source.currency!==movement.currency
    ||source.reversed||movement.state!=='POSTED'||source.amountMinor!==movement.amountMinor){
    throw new AppError(409,'FINANCIAL_RECONCILIATION_CONFLICT','Financial reconciliation evidence conflicts');
  }
  return {source,movement};
}
