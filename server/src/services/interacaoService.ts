import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { OportunidadeRepository } from '../repositories/oportunidadeTypes.js';
import { PostgresInteracaoRepository } from '../repositories/postgresInteracaoRepository.js';
import { interacaoCreateSchema,interacaoFieldsSchema,interacaoPatchSchema,interacaoVersionSchema,interacaoListSchema,
  publicInteracao,type InteracaoScope,type InteracaoStored } from '../repositories/interacaoTypes.js';

const fields=(row:unknown)=>interacaoFieldsSchema.strip().parse(row);
const auditSnapshot=(row:InteracaoStored)=>({id:row.id,codigo:row.codigo,group_id:row.group_id,empresa_id:row.empresa_id,
  cliente_empresa_id:row.cliente_empresa_id,oportunidade_id:row.oportunidade_id,version:row.version,ativo:row.ativo,tipo:row.tipo});
export class InteracaoService {
  constructor(private readonly repo:PostgresInteracaoRepository,private readonly audit:AuditRepository,
    private readonly tenant:TenantGuard,private readonly rbac:RbacGuard,
    private readonly clientes:Pick<ClienteRepository,'getEmpresaLinkById'>,
    private readonly oportunidades:Pick<OportunidadeRepository,'get'>) {}

  async create(context:RequestContext,payload:unknown) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx),input=this.parse(interacaoCreateSchema,payload);
    const data=fields(input),refs={cliente_empresa_id:input.cliente_empresa_id,oportunidade_id:input.oportunidade_id};
    const hash=createHash('sha256').update(JSON.stringify({fields:data,refs})).digest('hex');
    return this.repo.transaction(scope,async tx=>{
      await this.repo.lockKey(scope,input.idempotency_key,tx);
      await this.allowed(ctx,'criar',tx);
      const prior=await this.repo.byKey(scope,input.idempotency_key,tx);
      if(prior) {
        if(prior.payload_fingerprint!==hash)throw new AppError(409,'INTERACAO_IDEMPOTENCY_CONFLICT','Key belongs to another input');
        await this.allowed(ctx,'visualizar',tx);
        return publicInteracao(prior);
      }
      const canonicalRefs=await this.references(ctx,scope,refs,tx);
      await this.allowed(ctx,'criar',tx);
      const row=await this.repo.create(scope,data,canonicalRefs,input.idempotency_key,hash,ctx.actorId!,tx);
      await this.record(ctx,'create',null,row,tx);
      return publicInteracao(row);
    });
  }
  async get(context:RequestContext,id:string) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx);this.id(id);
    return this.repo.transaction(scope,async tx=>{
      await this.allowed(ctx,'visualizar',tx);
      return publicInteracao(await this.require(scope,id,tx));
    });
  }
  async list(context:RequestContext,options:unknown={}) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx),f=this.parse(interacaoListSchema,options);
    return this.repo.transaction(scope,async tx=>{
      await this.allowed(ctx,'visualizar',tx);
      const page=await this.repo.list(scope,f,tx);
      return {data:page.rows,meta:{total:page.total,limit:f.limit,offset:f.offset,hasMore:f.offset+page.rows.length<page.total}};
    });
  }
  async update(context:RequestContext,id:string,payload:unknown) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx);this.id(id);
    const {expected_version,...requestedPatch}=this.parse(interacaoPatchSchema,payload);
    const patch=Object.fromEntries(Object.entries(requestedPatch).filter(([,value])=>value!==undefined));
    return this.repo.transaction(scope,async tx=>{
      await this.allowed(ctx,'editar',tx);
      const before=await this.require(scope,id,tx,true);
      this.version(before,expected_version);
      if(!before.ativo)throw new AppError(409,'INTERACAO_INACTIVE','Inactive interaction cannot be edited');
      await this.references(ctx,scope,before,tx);
      await this.allowed(ctx,'editar',tx);
      const after=await this.repo.update(scope,id,fields({...fields(before),...patch}),true,ctx.actorId!,tx);
      await this.record(ctx,'update',before,after,tx);
      return publicInteracao(after);
    });
  }
  async setActive(context:RequestContext,id:string,payload:unknown,active:boolean) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx);this.id(id);
    const {expected_version}=this.parse(interacaoVersionSchema,payload),action=active?'restaurar':'inativar';
    return this.repo.transaction(scope,async tx=>{
      await this.allowed(ctx,action,tx);
      const before=await this.require(scope,id,tx,true);this.version(before,expected_version);
      await this.allowed(ctx,action,tx);
      if(before.ativo===active)return publicInteracao(before);
      if(active)await this.references(ctx,scope,before,tx);
      await this.allowed(ctx,action,tx);
      const after=await this.repo.update(scope,id,fields(before),active,ctx.actorId!,tx);
      await this.record(ctx,active?'restore':'inactivate',before,after,tx);
      return publicInteracao(after);
    });
  }
  async history(context:RequestContext,id:string,options:unknown={}) {
    const ctx=Object.freeze({...context}),scope=this.scope(ctx);this.id(id);
    const f=this.parse(interacaoListSchema.pick({limit:true,offset:true}),options);
    return this.repo.transaction(scope,async tx=>{
      await this.allowed(ctx,'visualizar',tx);await this.require(scope,id,tx);
      const page=await this.repo.history(scope,id,f.limit,f.offset,tx);
      return {data:page.rows,meta:{total:page.total,limit:f.limit,offset:f.offset,hasMore:f.offset+page.rows.length<page.total}};
    });
  }
  private async references(ctx:RequestContext,scope:InteracaoScope,refs:{cliente_empresa_id:string|null;oportunidade_id:string|null},tx:DbQueryExecutor) {
    let clientId=refs.cliente_empresa_id;
    if(refs.oportunidade_id) {
      const opportunity=await this.oportunidades.get(scope,refs.oportunidade_id,tx,true);
      await this.rbac.assertAllowed(ctx,'CRM','oportunidades','visualizar',{allowGlobalWildcard:false,executor:tx});
      if(!opportunity || !opportunity.ativo || (refs.cliente_empresa_id && opportunity.cliente_empresa_id!==refs.cliente_empresa_id))
        throw new AppError(422,'INTERACAO_REFERENCE_INVALID','Canonical opportunity unavailable or mismatched');
      clientId=clientId??opportunity.cliente_empresa_id;
    }
    if(clientId) {
      await this.repo.lockCliente(scope,clientId,tx);
      const client=await this.clientes.getEmpresaLinkById(scope,clientId,tx);
      if(!client || !client.ativo || client.bloqueado || !client.habilitado_operacao)
        throw new AppError(422,'INTERACAO_REFERENCE_INVALID','Canonical client unavailable');
    }
    return {cliente_empresa_id:clientId,oportunidade_id:refs.oportunidade_id};
  }
  private async record(ctx:RequestContext,action:AuditAction,before:InteracaoStored|null,after:InteracaoStored,tx:DbQueryExecutor) {
    await this.repo.appendHistory(after,action,ctx.actorId!,tx);
    await this.audit.append({groupId:ctx.groupId,empresaId:ctx.empresaId,actorId:ctx.actorId,requestId:ctx.requestId,
      entity:'Interacao',entityId:after.id,action,beforeData:before?auditSnapshot(before):null,afterData:auditSnapshot(after)},tx);
  }
  private async allowed(ctx:RequestContext,action:RbacAction,tx:DbQueryExecutor) {
    await this.tenant.assertEmpresaInGroup(ctx.groupId,ctx.empresaId,tx);
    await this.rbac.assertAllowed(ctx,'CRM','interacoes',action,{allowGlobalWildcard:false,executor:tx});
  }
  private scope(ctx:RequestContext):InteracaoScope {
    if(!ctx.groupId || !ctx.empresaId)throw new AppError(400,'TENANT_REQUIRED','Group and company required');
    this.id(ctx.groupId);this.id(ctx.empresaId);
    if(!ctx.actorId)throw new AppError(403,'ACTOR_REQUIRED','Actor required');this.id(ctx.actorId);
    return {groupId:ctx.groupId,empresaId:ctx.empresaId};
  }
  private async require(scope:InteracaoScope,id:string,tx:DbQueryExecutor,lock=false) {
    const row=await this.repo.get(scope,id,tx,lock);
    if(!row)throw new AppError(404,'INTERACAO_NOT_FOUND','Interaction unavailable');return row;
  }
  private id(id:string) {if(!z.string().uuid().safeParse(id).success)throw new AppError(422,'VALIDATION_ERROR','Invalid identifier');}
  private version(row:InteracaoStored,expected:number) {if(row.version!==expected)throw new AppError(409,'INTERACAO_VERSION_CONFLICT','Interaction changed; reload before editing');}
  private parse<S extends z.ZodTypeAny>(schema:S,input:unknown):z.output<S> {
    const result=schema.safeParse(input);if(!result.success)throw new AppError(422,'VALIDATION_ERROR','Invalid interaction input');return result.data;
  }
}
