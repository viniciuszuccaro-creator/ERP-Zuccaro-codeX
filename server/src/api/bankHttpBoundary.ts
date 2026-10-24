import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';
import type { RequestContext } from '../audit/types.js';

const scope=z.object({groupId:z.string().uuid(),empresaId:z.string().uuid(),actorId:z.string().uuid(),requestId:z.string().uuid()});

/** Shared extraction of the existing bank-account boundary; authentication still belongs to canonical middleware. */
export function bankHttpBoundary(context:(req:Request)=>RequestContext,options:{
  inputCode:string;unavailableCode:string;permittedErrors:ReadonlyMap<string,number>;
}){
  const contexts=new WeakMap<Request,RequestContext>();
  const invalid=()=>new AppError(422,options.inputCode,'Invalid banking request');
  const unavailable=()=>new AppError(503,options.unavailableCode,'Banking operation unavailable');
  const verified:RequestHandler=(req,res,next)=>{
    res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');
    req.requestId=randomUUID();res.setHeader('X-Request-Id',req.requestId);
    try{
      if(req.authVerified!==true)throw new AppError(401,'AUTH_REQUIRED','Verified user session required');
      const ctx=context(req),parsed=scope.safeParse(ctx);
      if(!parsed.success||ctx.groupId!==req.groupId||ctx.empresaId!==req.empresaId||ctx.actorId!==req.actorId||ctx.requestId!==req.requestId)
        throw new AppError(403,'BANK_ACCOUNT_CONTEXT_REQUIRED','Matching tenant request required');
      contexts.set(req,Object.freeze({...ctx,...parsed.data}));next();
    }catch(error){
      if(error instanceof AppError&&['AUTH_REQUIRED','BANK_ACCOUNT_CONTEXT_REQUIRED'].includes(error.code))
        next(new AppError(error.statusCode,error.code,'Verified banking request required'));
      else next(unavailable());
    }
  };
  const run=(operation:(req:Request,ctx:RequestContext)=>Promise<unknown>,status:number):RequestHandler=>async(req,res,next)=>{
    try{
      const ctx=contexts.get(req);
      if(!ctx)throw new AppError(401,'AUTH_REQUIRED','Verified user session required');
      const result=await operation(req,ctx);
      res.status(status).json({data:result});
    }catch(error){
      if(error instanceof z.ZodError||(error instanceof AppError&&error.code===options.inputCode))next(invalid());
      else if(error instanceof AppError&&options.permittedErrors.get(error.code)===error.statusCode)
        next(new AppError(error.statusCode,error.code,'Banking operation rejected'));
      else next(unavailable());
    }finally{contexts.delete(req);}
  };
  return {verified,run,invalid};
}
