import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';
import type { RequestContext } from '../audit/types.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { OportunidadeService } from '../services/oportunidadeService.js';

const query=z.object({ search:z.string().max(80).optional(),status:z.string().max(60).optional(),
  clienteEmpresaId:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(200).optional(),
  offset:z.coerce.number().int().min(0).max(1000000).optional(),
  ativo:z.enum(['true','false']).transform(v=>v==='true').optional() }).strict();
export function mountOportunidadeRoutes(router:Router,service:OportunidadeService|null|undefined,
  context:(req:Request)=>RequestContext) {
  const run=(fn:(s:OportunidadeService,req:Request,res:Response)=>Promise<void>) =>
    async (req:Request,res:Response,next:NextFunction) => {
      try {
        res.setHeader('Cache-Control','no-store');
        if(!service)throw new AppError(503,'CRM_HTTP_DISABLED','CRM HTTP requires explicit activation');
        await fn(service,req,res);
      }catch(error){next(error);}
    };
  router.get('/api/v1/oportunidades',requireTenantScope,run(async(s,req,res)=>{
    const parsed=query.safeParse(req.query);if(!parsed.success)throw new AppError(422,'VALIDATION_ERROR','Invalid filters');
    res.json(await s.list(context(req),parsed.data));
  }));
  router.get('/api/v1/oportunidades/legado/:legacyId',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.getByLegacy(context(req),req.params.legacyId)});
  }));
  router.get('/api/v1/oportunidades/:id',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.get(context(req),req.params.id)});
  }));
  router.post('/api/v1/oportunidades',requireTenantScope,run(async(s,req,res)=>{
    res.status(201).json({data:await s.create(context(req),req.body)});
  }));
  router.patch('/api/v1/oportunidades/:id',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.update(context(req),req.params.id,req.body)});
  }));
  router.delete('/api/v1/oportunidades/:id',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.setActive(context(req),req.params.id,req.body,false)});
  }));
  router.post('/api/v1/oportunidades/:id/restaurar',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.setActive(context(req),req.params.id,req.body,true)});
  }));
  router.post('/api/v1/oportunidades/:id/vincular-orcamento',requireTenantScope,run(async(s,req,res)=>{
    res.json({data:await s.linkOrcamento(context(req),req.params.id,req.body)});
  }));
}
