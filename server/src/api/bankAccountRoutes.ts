import { json, type Request, type RequestHandler, type Router } from 'express';
import { z } from 'zod';
import type { RequestContext } from '../audit/types.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { BankAccountService } from '../services/bankAccountService.js';
import { bankAccountIdentitySchema } from '../services/bankStatementImport.js';
import { bankHttpBoundary } from './bankHttpBoundary.js';

const registration=z.object({operationId:z.string().uuid(),identity:bankAccountIdentitySchema}).strict();
const permittedErrors=new Map<string,number>([
  ['PERMISSION_DENIED',403],['TENANT_MISMATCH',409],['BANK_ACCOUNT_CONFLICT',409],
  ['BANK_ACCOUNT_NOT_FOUND',404],['BANK_ACCOUNT_CONTEXT_REQUIRED',403],
]);

/** Prepared extraction for the existing canonical router. No self-mount, auth bypass or automatic grants. */
export function mountBankAccountRoutes(router:Router,service:Pick<BankAccountService,'register'|'get'|'list'>,
  context:(req:Request)=>RequestContext){
  const base='/api/v1/contas-bancarias';
  const {verified,run,invalid}=bankHttpBoundary(context,{inputCode:'BANK_ACCOUNT_INPUT_INVALID',
    unavailableCode:'BANK_ACCOUNT_UNAVAILABLE',permittedErrors});
  const parse=json({limit:'4kb',strict:true});
  const body:RequestHandler=(req,res,next)=>{
    if(!req.is('application/json')){next(invalid());return;}
    parse(req,res,(error?:unknown)=>next(error?invalid():undefined));
  };
  router.post(base,verified,requireTenantScope,body,run(async(req,ctx)=>{
    if(Object.keys(req.query).length)throw invalid();
    if(Buffer.byteLength(JSON.stringify(req.body)??'')>4096)throw invalid();
    const input=registration.parse(req.body);
    return service.register(ctx,input.operationId,input.identity);
  },201));
  router.get(base,verified,requireTenantScope,run((req,ctx)=>{
    const query=z.object({limit:z.string().regex(/^[1-9]\d{0,2}$/).optional(),
      offset:z.string().regex(/^(0|[1-9]\d{0,9})$/).optional()}).strict().parse(req.query);
    const page=z.object({limit:z.number().int().min(1).max(200),
      offset:z.number().int().min(0).max(2147483647)}).parse({limit:Number(query.limit??100),offset:Number(query.offset??0)});
    return service.list(ctx,page);
  },200));
  router.get(`${base}/:id`,verified,requireTenantScope,run((req,ctx)=>{
    if(Object.keys(req.query).length)throw invalid();
    return service.get(ctx,z.string().uuid().parse(req.params.id));
  },200));
}
