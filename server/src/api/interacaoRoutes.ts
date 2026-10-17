import type {Router,Request,Response,NextFunction} from 'express';
import {z} from 'zod';
import {AppError} from './errors.js';
import {requireTenantScope} from '../middleware/requestContext.js';
import type {RequestContext} from '../audit/types.js';
import type {InteracaoService} from '../services/interacaoService.js';
import {interacaoListSchema} from '../repositories/interacaoTypes.js';

const query=interacaoListSchema.extend({ativo:z.enum(['true','false']).transform(v=>v==='true').optional()});
export function mountInteracaoRoutes(router:Router,service:InteracaoService|null|undefined,context:(req:Request)=>RequestContext) {
  const run=(fn:(s:InteracaoService,req:Request,res:Response)=>Promise<void>)=>
    async(req:Request,res:Response,next:NextFunction)=>{
      try {
        res.setHeader('Cache-Control','no-store');
        if(!service)throw new AppError(503,'CRM_INTERACOES_HTTP_DISABLED','Interactions require explicit activation and persistence');
        await fn(service,req,res);
      }catch(error){next(error);}
    };
  const base='/api/v1/interacoes';
  router.get(base,requireTenantScope,run(async(s,req,res)=>{
    const parsed=query.safeParse(req.query);
    if(!parsed.success)throw new AppError(422,'VALIDATION_ERROR','Invalid interaction filters');
    res.json(await s.list(context(req),parsed.data));
  }));
  router.post(base,requireTenantScope,run(async(s,req,res)=>{res.status(201).json({data:await s.create(context(req),req.body)});}));
  router.get(`${base}/:id`,requireTenantScope,run(async(s,req,res)=>{res.json({data:await s.get(context(req),req.params.id)});}));
  router.patch(`${base}/:id`,requireTenantScope,run(async(s,req,res)=>{res.json({data:await s.update(context(req),req.params.id,req.body)});}));
  router.delete(`${base}/:id`,requireTenantScope,run(async(s,req,res)=>{res.json({data:await s.setActive(context(req),req.params.id,req.body,false)});}));
  router.post(`${base}/:id/restaurar`,requireTenantScope,run(async(s,req,res)=>{res.json({data:await s.setActive(context(req),req.params.id,req.body,true)});}));
  router.get(`${base}/:id/historico`,requireTenantScope,run(async(s,req,res)=>{
    res.json(await s.history(context(req),req.params.id,req.query));
  }));
}
