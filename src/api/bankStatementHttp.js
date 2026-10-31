import { z } from 'zod';
import { MAX_BANK_STATEMENT_BYTES, parseBankAccountPage, parseBankStatementPage, parseBankStatementResult } from './bankStatementContract.js';

/** @typedef {{groupId?:string,empresaId?:string,actorId?:string,actorEmail?:string,token?:string}} BankScope */
/** @typedef {{method?:string,body?:unknown,query?:Record<string,unknown>,signal?:AbortSignal,ofx?:boolean}} BankRequestOptions */
const expectedSchema = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid() }).strict();
const idsSchema = z.object({ accountId: z.string().uuid(), batchId: z.string().uuid() }).strict();
const accountPageSchema=z.object({limit:z.number().int().min(1).max(200).default(100),
  offset:z.number().int().min(0).max(2147483647).default(0)}).strict();
const pageSchema = idsSchema.extend({ limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(10000).optional(), statementHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });
const ownCodes = new Set(['BANK_AUTH_REQUIRED', 'BANK_STALE_CONTEXT', 'BANK_REQUEST_CANCELLED', 'BANK_INPUT_INVALID', 'BANK_RESPONSE_INVALID']);
function failure(code = 'BANK_OPERATION_FAILED', status = 503) {
  return Object.assign(new Error('Nao foi possivel concluir a operacao bancaria.'), { code, status });
}
export { failure as bankOperationFailure };
/** @param {unknown} error */
function sanitize(error) {
  const status = error instanceof Error && 'status' in error && typeof error.status === 'number'
    && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 503;
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' && ownCodes.has(error.code)
    ? error.code : 'BANK_OPERATION_FAILED';
  return failure(code, status);
}

/** Reuses the existing HTTP/session transport; never authorizes from browser storage.
 * @param {{getScope:()=>BankScope,request:(path:string,options:BankRequestOptions,scope:Readonly<BankScope>)=>Promise<unknown>}} deps */
export function createBankRequestExecutor({ getScope }) {
  const readScope = () => {
    try { return Object.freeze({ ...(getScope() || {}) }); }
    catch { throw failure('BANK_AUTH_REQUIRED', 401); }
  };
  /** @template T
   * @param {{groupId:string,empresaId:string,actorId:string}} expected
   * @param {(scope:Readonly<BankScope>)=>Promise<unknown>} operation
   * @param {(value:unknown)=>T} parse
   * @param {AbortSignal} [signal]
   * @returns {Promise<T>} */
  async function execute(expected, operation, parse, signal) {
    const checked = expectedSchema.safeParse(expected);
    const before = readScope();
    const token = typeof before.token === 'string' ? before.token.trim() : '';
    /** @param {Readonly<BankScope>} current */
    const matches = current => checked.success && current.groupId === checked.data.groupId
      && current.empresaId === checked.data.empresaId && current.actorId === checked.data.actorId
      && typeof current.token === 'string' && current.token.trim() === token;
    if (!checked.success || !token || !matches(before)) throw failure('BANK_AUTH_REQUIRED', 401);
    if (signal?.aborted) throw failure('BANK_REQUEST_CANCELLED', 409);
    /** @type {unknown} */ let value;
    /** @type {unknown} */ let error;
    let rejected = false;
    try { value = await operation(Object.freeze({ ...before, token })); }
    catch (caught) { rejected = true; error = caught; }
    if (!matches(readScope())) throw failure('BANK_STALE_CONTEXT', 409);
    if (signal?.aborted) throw failure('BANK_REQUEST_CANCELLED', 409);
    if (rejected) throw sanitize(error);
    try { return parse(value); } catch (caught) { throw sanitize(caught); }
  }
  return execute;
}

/** @param {{getScope:()=>BankScope,request:(path:string,options:BankRequestOptions,scope:Readonly<BankScope>)=>Promise<unknown>}} deps */
export function createBankStatementApi(deps) {
  const { request } = deps;
  const execute = createBankRequestExecutor(deps);
  return {
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{limit?:number,offset?:number}} [input]
     * @param {{signal?:AbortSignal}} [options] */
    accounts(expected,input={},options={}){
      const signal=options.signal,parsed=accountPageSchema.safeParse(input);
      if(!parsed.success)return Promise.reject(failure('BANK_INPUT_INVALID',422));
      const {limit,offset}=parsed.data;
      return execute(expected,scope=>request('/api/v1/contas-bancarias',
        {query:{limit,offset},signal},scope),value=>parseBankAccountPage(value,{limit,offset}),signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{accountId:string,batchId:string,file:File}} input
     * @param {{signal?:AbortSignal}} [options] */
    upload(expected, input, options = {}) {
      const file = input.file, signal = options.signal;
      const ids = idsSchema.safeParse({ accountId: input.accountId, batchId: input.batchId });
      if (!ids.success || typeof File === 'undefined' || !(file instanceof File)
        || !/\.ofx$/i.test(file.name) || file.size < 1 || file.size > MAX_BANK_STATEMENT_BYTES)
        return Promise.reject(failure('BANK_INPUT_INVALID', 422));
      const { accountId, batchId } = ids.data;
      return execute(expected, scope => request(`/api/v1/contas-bancarias/${accountId}/extratos/${batchId}`,
        { method: 'POST', body: file, ofx: true, signal }, scope),
      value => parseBankStatementResult(value, batchId), signal);
    },
    /** @param {{groupId:string,empresaId:string,actorId:string}} expected
     * @param {{accountId:string,batchId:string,limit?:number,offset?:number,statementHash?:string}} input
     * @param {{signal?:AbortSignal}} [options] */
    page(expected, input, options = {}) {
      const signal = options.signal;
      const parsed = pageSchema.safeParse(input);
      if (!parsed.success) return Promise.reject(failure('BANK_INPUT_INVALID', 422));
      const { accountId, batchId, limit, offset } = parsed.data;
      return execute(expected, scope => request(`/api/v1/contas-bancarias/${accountId}/extratos/${batchId}`,
        { query: { limit, offset }, signal }, scope),
      value => parseBankStatementPage(value, { batchId, limit, offset, statementHash: parsed.data.statementHash }), signal);
    },
  };
}
