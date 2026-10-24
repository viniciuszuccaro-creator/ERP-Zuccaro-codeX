import { z } from 'zod';

export const MAX_BANK_STATEMENT_BYTES = 2000000;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const row = z.object({
  sourceId: z.string().min(1).max(500), postedRaw: z.string().min(1).max(500),
  amountRaw: z.string().min(1).max(500), amountMinor: z.string().regex(/^(?:0|-?[1-9]\d{0,17})$/),
  identityHash: hash, contentHash: hash,
}).strict();
const result = z.object({ batchId: z.string().uuid(), disposition: z.enum(['STAGED', 'REPLAY']),
  created: z.number().int().min(0).max(10000), replay: z.number().int().min(0).max(10000),
}).strict();
const page = z.object({ batchId: z.string().uuid(), sourceSha256: hash, statementHash: hash,
  total: z.number().int().min(1).max(10000), offset: z.number().int().min(0).max(10000),
  limit: z.number().int().min(1).max(200), data: z.array(row).max(200),
}).strict();
const account = z.object({id:z.string().uuid(),active:z.literal(true),identity:z.object({
  bankId:z.string().min(1).max(500),accountId:z.string().min(1).max(500),
  branchId:z.string().min(1).max(500).optional(),currency:z.literal('BRL'),
}).strict()}).strict();
const accountPage=z.object({total:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  limit:z.number().int().min(1).max(200),offset:z.number().int().min(0).max(2147483647),
  data:z.array(account).max(200)}).strict();
function invalid() {
  return Object.assign(new Error('Resposta bancaria invalida.'), { code: 'BANK_RESPONSE_INVALID', status: 502 });
}

/** @param {unknown} value @param {{limit:number,offset:number}} expected */
export function parseBankAccountPage(value,expected){
  const parsed=accountPage.safeParse(value);
  if(!parsed.success)throw invalid();
  const page=parsed.data;
  if(page.limit!==expected.limit||page.offset!==expected.offset
    ||page.data.length!==Math.min(page.limit,Math.max(0,page.total-page.offset))
    ||new Set(page.data.map(row=>row.id)).size!==page.data.length)throw invalid();
  return page;
}

/** Validate the public wire DTO, not an ERP posting or a reconciliation decision.
 * @param {unknown} value @param {string} batchId */
export function parseBankStatementResult(value, batchId) {
  const parsed = result.safeParse(value);
  if (!parsed.success || parsed.data.batchId !== batchId
    || parsed.data.created + parsed.data.replay < 1 || parsed.data.created + parsed.data.replay > 10000
    || (parsed.data.disposition === 'REPLAY' && parsed.data.created !== 0)) throw invalid();
  return parsed.data;
}

/** @param {unknown} value
 * @param {{batchId:string,limit?:number,offset?:number,statementHash?:string}} expected */
export function parseBankStatementPage(value, expected) {
  const parsed = page.safeParse(value);
  if (!parsed.success) throw invalid();
  const data = parsed.data;
  if (data.batchId !== expected.batchId || data.limit !== (expected.limit ?? 100) || data.offset !== (expected.offset ?? 0)
    || (expected.statementHash !== undefined && data.statementHash !== expected.statementHash)
    || data.data.length !== Math.min(data.limit, Math.max(0, data.total - data.offset))
    || new Set(data.data.map(item => item.identityHash)).size !== data.data.length
    || new Set(data.data.map(item => item.sourceId)).size !== data.data.length) throw invalid();
  return data;
}
