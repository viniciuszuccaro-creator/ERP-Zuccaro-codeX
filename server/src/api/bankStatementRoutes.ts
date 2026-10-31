import { raw, type Request, type RequestHandler, type Router } from 'express';
import { z } from 'zod';
import type { RequestContext } from '../audit/types.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { BankStatementStageService } from '../services/bankStatementStage.js';
import { bankHttpBoundary } from './bankHttpBoundary.js';

const path=z.object({accountId:z.string().uuid(),batchId:z.string().uuid()}).strict();
const page=z.object({limit:z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(1).max(200)).optional(),
  offset:z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(0).max(10000)).optional()}).strict();
const permittedErrors=new Map<string,number>([
  ['PERMISSION_DENIED',403],['TENANT_MISMATCH',409],['BANK_ACCOUNT_NOT_VERIFIED',409],
  ['BANK_STAGE_CONTEXT_REQUIRED',403],['BANK_ACCOUNT_CONTEXT_REQUIRED',403],
  ['BANK_STAGE_CONFLICT',409],['BANK_STAGE_EVIDENCE_INVALID',409],['BANK_STAGE_NOT_FOUND',404],
  ['BANK_STATEMENT_INVALID',422],
]);

/** Prepared canonical source import/read only. No matching, financial posting or reversal endpoint. */
export function mountBankStatementRoutes(router:Router,service:Pick<BankStatementStageService,'stage'|'page'>,
  context:(req:Request)=>RequestContext){
  const base='/api/v1/contas-bancarias/:accountId/extratos/:batchId';
  const {verified,run,invalid}=bankHttpBoundary(context,{inputCode:'BANK_STATEMENT_REQUEST_INVALID',
    unavailableCode:'BANK_STATEMENT_UNAVAILABLE',permittedErrors});
  const parse=raw({type:['application/x-ofx','application/ofx'],limit:2000000,inflate:false});
  const receive:RequestHandler=(req,res,next)=>{
    if(!req.is(['application/x-ofx','application/ofx'])){next(invalid());return;}
    parse(req,res,(error?:unknown)=>next(error?invalid():undefined));
  };
  router.post(base,verified,requireTenantScope,receive,run(async(req,ctx)=>{
    try{
      const ids=path.parse(req.params);
      if(Object.keys(req.query).length||!Buffer.isBuffer(req.body)||!req.body.length||req.body.length>2000000)throw invalid();
      return await service.stage(ctx,ids.batchId,req.body,'ofx',undefined,ids.accountId);
    }finally{if(Buffer.isBuffer(req.body))req.body.fill(0);}
  },201));
  router.get(base,verified,requireTenantScope,run((req,ctx)=>{
    const ids=path.parse(req.params),options=page.parse(req.query);
    return service.page(ctx,ids.batchId,{...options,accountId:ids.accountId});
  },200));
}
