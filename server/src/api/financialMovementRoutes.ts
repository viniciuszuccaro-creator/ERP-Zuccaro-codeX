import {json,type Request,type RequestHandler,type Router} from 'express';
import {z} from 'zod';
import type {RequestContext} from '../audit/types.js';
import type {FinancialMovementService} from '../services/financialMovementService.js';
import {financialMovementPageInputSchema,financialMovementSnapshotSchema,financialReconciliationCommandSchema,
  manualFinancialMovementSchema} from '../services/financialMovementPolicy.js';
import {requireTenantScope} from '../middleware/requestContext.js';
import {bankHttpBoundary} from './bankHttpBoundary.js';
import {AppError} from './errors.js';

const accountPath=z.object({accountId:z.string().uuid()}).strict();
const linkPath=accountPath.extend({operationId:z.string().uuid()});
const integer=z.string().regex(/^(?:0|[1-9]\d{0,9})$/).transform(Number);
const query=z.object({limit:integer.optional(),offset:integer.optional(),
  unlinkedOnly:z.enum(['true','false']).transform(value=>value==='true').optional()}).strict();
const manualBody=manualFinancialMovementSchema.omit({accountId:true});
const linkBody=financialReconciliationCommandSchema.omit({accountId:true});
const reversalBody=linkBody.omit({operationId:true});
const manualReceipt=z.object({id:z.string().uuid(),revision:z.literal('1'),state:z.literal('POSTED'),replay:z.boolean()}).strict();
const linkReceipt=z.object({id:z.string().uuid(),active:z.boolean(),replay:z.boolean()}).strict();
const pageReceipt=z.object({accountId:z.string().uuid(),total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  limit:z.number().int().min(1).max(200),offset:z.number().int().nonnegative().max(2147483647),
  data:z.array(financialMovementSnapshotSchema.extend({linked:z.boolean()})).max(200)}).strict();
const permittedErrors=new Map<string,number>([
  ['PERMISSION_DENIED',403],['TENANT_MISMATCH',409],['FINANCIAL_CONTEXT_REQUIRED',403],
  ['FINANCIAL_RECONCILIATION_CONFLICT',409],['BANK_ACCOUNT_NOT_VERIFIED',409],
  ['BANK_STAGE_CONTEXT_REQUIRED',403],['BANK_STAGE_CONFLICT',409],['BANK_STAGE_EVIDENCE_INVALID',409],
]);

/** Prepared only: no app/router assembly, grants or operational activation.
 * Reversal changes only the explicit link; it is not a movement reversal or a new posting.
 */
export function mountFinancialMovementRoutes(router:Router,
  service:Pick<FinancialMovementService,'postManual'|'list'|'reconcile'|'reverseLink'|'links'|'link'>,
  context:(req:Request)=>RequestContext){
  const base='/api/v1/contas-bancarias/:accountId';
  const {verified,run,invalid}=bankHttpBoundary(context,{inputCode:'FINANCIAL_REQUEST_INVALID',
    unavailableCode:'FINANCIAL_UNAVAILABLE',permittedErrors});
  const unavailable=()=>new AppError(503,'FINANCIAL_UNAVAILABLE','Financial operation unavailable');
  const parse=json({limit:16384,strict:true,inflate:false,type:'application/json'});
  const receive:RequestHandler=(req,res,next)=>{
    if(!req.is('application/json')){next(invalid());return;}
    parse(req,res,(error?:unknown)=>next(error?invalid():undefined));
  };
  const noQuery=(req:Request)=>{if(Object.keys(req.query).length)throw invalid();};
  const savedLink=financialReconciliationCommandSchema.extend({active:z.boolean()});
  router.get(base+'/vinculos',verified,requireTenantScope,run(async(req,ctx)=>{
    const ids=accountPath.parse(req.params),options=z.object({limit:integer.optional(),offset:integer.optional()}).strict().parse(req.query);
    const expected=financialMovementPageInputSchema.omit({unlinkedOnly:true}).parse({...ids,limit:options.limit??20,offset:options.offset??0});
    const result=z.object({accountId:z.string().uuid(),limit:z.number().int().min(1).max(200),offset:z.number().int().nonnegative().max(2147483647),
      total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),data:z.array(savedLink).max(200)}).strict().safeParse(await service.links(ctx,expected));
    if(!result.success)throw unavailable();const page=result.data;
    if(page.accountId!==ids.accountId||page.limit!==expected.limit||page.offset!==expected.offset
      ||page.data.length!==Math.min(page.limit,Math.max(0,page.total-page.offset))
      ||page.data.some(row=>row.accountId!==ids.accountId)||new Set(page.data.map(row=>row.operationId)).size!==page.data.length)throw unavailable();
    return page;
  },200));
  router.get(base+'/vinculos/:operationId',verified,requireTenantScope,run(async(req,ctx)=>{
    noQuery(req);const ids=linkPath.parse(req.params);
    const result=z.object({accountId:z.string().uuid(),operationId:z.string().uuid(),link:savedLink.nullable()}).strict().safeParse(await service.link(ctx,ids));
    if(!result.success||result.data.accountId!==ids.accountId||result.data.operationId!==ids.operationId
      ||(result.data.link&&(result.data.link.accountId!==ids.accountId||result.data.link.operationId!==ids.operationId)))throw unavailable();
    return result.data;
  },200));
  router.post(base+'/movimentos',verified,requireTenantScope,receive,run(async(req,ctx)=>{
    noQuery(req);
    const ids=accountPath.parse(req.params),body=manualBody.parse(req.body);
    const command=manualFinancialMovementSchema.parse({...body,...ids});
    const result=manualReceipt.safeParse(await service.postManual(ctx,command));
    if(!result.success||result.data.id!==command.operationId)throw unavailable();
    return result.data;
  },201));
  router.get(base+'/movimentos',verified,requireTenantScope,run(async(req,ctx)=>{
    const ids=accountPath.parse(req.params),options=financialMovementPageInputSchema.parse({...ids,...query.parse(req.query)});
    const result=pageReceipt.safeParse(await service.list(ctx,options));
    if(!result.success)throw unavailable();
    const page=result.data;
    if(page.accountId!==ids.accountId||page.limit!==options.limit||page.offset!==options.offset
      ||page.data.length!==Math.min(page.limit,Math.max(0,page.total-page.offset))
      ||new Set(page.data.map(row=>row.id)).size!==page.data.length
      ||page.data.some(row=>row.groupId!==ctx.groupId||row.empresaId!==ctx.empresaId||row.accountId!==ids.accountId
        ||(options.unlinkedOnly&&row.linked)))throw unavailable();
    return page;
  },200));
  router.post(base+'/vinculos',verified,requireTenantScope,receive,run(async(req,ctx)=>{
    noQuery(req);
    const command=financialReconciliationCommandSchema.parse({...linkBody.parse(req.body),...accountPath.parse(req.params)});
    const result=linkReceipt.safeParse(await service.reconcile(ctx,command));
    if(!result.success||result.data.id!==command.operationId||!result.data.active)throw unavailable();
    return result.data;
  },201));
  router.post(base+'/vinculos/:operationId/desfazer',verified,requireTenantScope,receive,run(async(req,ctx)=>{
    noQuery(req);
    const command=financialReconciliationCommandSchema.parse({...reversalBody.parse(req.body),...linkPath.parse(req.params)});
    const result=linkReceipt.safeParse(await service.reverseLink(ctx,command));
    if(!result.success||result.data.id!==command.operationId||result.data.active)throw unavailable();
    return result.data;
  },200));
}
