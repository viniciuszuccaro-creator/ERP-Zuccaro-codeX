import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditAction, AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeAuditSnapshot } from '../audit/sanitizeAuditSnapshot.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { assertOportunidadeOnCreate, assertOportunidadeOnUpdate, CRM_ETAPAS,
  normalizeEtapaCrm, oportunidadeAberta, stampOportunidadeConvertida } from '../domain/crmOportunidadePolicy.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { OrcamentoRepository } from '../repositories/orcamentoTypes.js';
import type { PedidoRepository } from '../repositories/pedidoTypes.js';
import { oportunidadeCreateSchema, oportunidadeUpdateSchema, oportunidadeLinkSchema,
  OPORTUNIDADE_FIELDS, oportunidadePedidoLinkSchema,
  type Oportunidade, type OportunidadeFields, type OportunidadeFilters,
  type OportunidadeRepository, type OportunidadeScope } from '../repositories/oportunidadeTypes.js';

const VERSION = z.object({ expected_version:z.number().int().positive() }).strict();
const LIST = z.object({ limit:z.number().int().min(1).max(200).default(50), offset:z.number().int().min(0).max(1000000).default(0),
  search:z.string().trim().max(80).optional(), ativo:z.boolean().optional(),
  status:z.enum(['Aberto','Em Andamento','Nova','Ganho','Perdido','Cancelado']).optional(),
  clienteEmpresaId:z.string().uuid().optional() }).strict();
const FIELDS = OPORTUNIDADE_FIELDS;
const snapshot = (row: Oportunidade) => sanitizeAuditSnapshot(row);

export class OportunidadeService {
  constructor(private readonly repo:OportunidadeRepository, private readonly audit:AuditRepository,
    private readonly tenant:TenantGuard, private readonly rbac:RbacGuard,
    private readonly clientes:Pick<ClienteRepository,'getEmpresaLinkById'>,
    private readonly orcamentos:Pick<OrcamentoRepository,'get'>,
    private readonly pedidos?:Pick<PedidoRepository,'get'>) {}

  async create(ctx:RequestContext, payload:unknown) {
    const scope=await this.prepare(ctx,'criar'), input=this.parse(oportunidadeCreateSchema,payload);
    const stage=normalizeEtapaCrm(input.etapa); this.assertStage(stage);
    const normalized={...input,etapa:stage};
    const hash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    return this.repo.withTransaction(scope,async tx => {
      await this.repo.lockIdempotency(scope,input.idempotency_key,tx);
      await this.allowed(ctx,'criar',tx);
      const prior=await this.repo.byKey(scope,input.idempotency_key,tx);
      if(prior) {
        if(prior.payload_fingerprint!==hash)throw new AppError(409,'OPORTUNIDADE_IDEMPOTENCY_CONFLICT','Key already used with different input');
        await this.rbac.assertAllowed(ctx,'CRM','oportunidades','visualizar',{allowGlobalWildcard:false,executor:tx});
        return prior;
      }
      const clienteId=await this.clientReference(scope,input.cliente_empresa_id,tx);
      const record=this.policy(() => assertOportunidadeOnCreate({ record:{...normalized,
        group_id:scope.groupId,empresa_id:scope.empresaId,cliente_id:clienteId ?? undefined} }).record);
      const fields=this.fields({ ...record,cliente_empresa_id:input.cliente_empresa_id ?? null,cliente_id:clienteId,
        origem:input.origem ?? 'CRM',data_fechamento:null,historico_mudancas_etapa:[],
        orcamento_cliente:input.orcamento_cliente??'0.000000',produtos_interesse:input.produtos_interesse??[],
        orcamento_id:null,pedido_id:null,convertido_em:null,convertido_em_id:null },input.valor_estimado ?? '0.000000');
      const created=await this.repo.create(scope,fields,input.idempotency_key,hash,ctx.actorId!,tx);
      await this.auditRow(ctx,'create',null,created,tx); return created;
    });
  }
  async get(ctx:RequestContext,id:string) {
    const scope=await this.prepare(ctx,'visualizar'); this.id(id);
    return this.repo.withTransaction(scope,tx=>this.require(scope,id,tx));
  }
  async list(ctx:RequestContext,options:unknown={}) {
    const scope=await this.prepare(ctx,'visualizar'), filters=this.parse(LIST,options) as OportunidadeFilters;
    const page=await this.repo.withTransaction(scope,tx=>this.repo.list(scope,filters,tx));
    return {data:page.rows,meta:{limit:filters.limit,offset:filters.offset,total:page.total,
      hasMore:filters.offset+page.rows.length<page.total}};
  }
  async getByLegacy(ctx:RequestContext,id:string) {
    const scope=await this.prepare(ctx,'visualizar');
    if(!z.string().trim().min(1).max(180).safeParse(id).success)throw new AppError(422,'VALIDATION_ERROR','Invalid legacy identifier');
    const row=await this.repo.withTransaction(scope,tx=>this.repo.byLegacy(scope,id,tx));
    if(!row)throw new AppError(404,'OPORTUNIDADE_NOT_FOUND','Oportunidade unavailable');return row;
  }
  async update(ctx:RequestContext,id:string,payload:unknown) {
    const scope=await this.prepare(ctx,'editar'); this.id(id); const input=this.parse(oportunidadeUpdateSchema,payload);
    return this.repo.withTransaction(scope,async tx => {
      const before=await this.require(scope,id,tx,true); this.version(before,input.expected_version);
      await this.allowed(ctx,'editar',tx);
      if(!before.ativo) this.conflict();
      const {expected_version,...rawPatch}=input;
      const patch=Object.fromEntries(Object.entries(rawPatch).filter(([,value])=>value!==undefined));
      if(input.etapa!==undefined)this.assertStage(normalizeEtapaCrm(input.etapa));
      // Preserve a closed document; the legacy policy never authorizes API field spoofing.
      if(!oportunidadeAberta({status:before.status})) {
        if(Object.keys(patch).length===1 && patch.status===before.status)return before;
        this.conflict();
      }
      if(patch.status==='Cancelado' || patch.status==='Perdido')await this.rbac.assertAllowed(ctx,'CRM','oportunidades','cancelar',{allowGlobalWildcard:false,executor:tx});
      if(patch.status==='Ganho')await this.rbac.assertAllowed(ctx,'CRM','oportunidades','aprovar',{allowGlobalWildcard:false,executor:tx});
      const clienteId=Object.hasOwn(patch,'cliente_empresa_id')
        ? await this.clientReference(scope,input.cliente_empresa_id,tx) : before.cliente_id;
      const decision=this.policy(()=>assertOportunidadeOnUpdate({ before:{...before,historico_mudancas_etapa:before.historico_mudancas_etapa as any[]},
        patch:{...patch,cliente_id:clienteId} }));
      const after=await this.repo.update(scope,id,expected_version,this.fields(decision.record,
        input.valor_estimado ?? before.valor_estimado),ctx.actorId!,tx);
      if(!after)this.conflict(); await this.auditRow(ctx,'update',before,after,tx); return after;
    });
  }
  async setActive(ctx:RequestContext,id:string,payload:unknown,active:boolean) {
    const scope=await this.prepare(ctx,active?'restaurar':'inativar'); this.id(id); const input=this.parse(VERSION,payload);
    return this.repo.withTransaction(scope,async tx => {
      const before=await this.require(scope,id,tx,true); this.version(before,input.expected_version);
      await this.allowed(ctx,active?'restaurar':'inativar',tx);
      if(before.ativo===active)return before;
      const after=await this.repo.setActive(scope,id,input.expected_version,active,ctx.actorId!,tx);
      if(!after)this.conflict(); await this.auditRow(ctx,active?'restore':'inactivate',before,after,tx); return after;
    });
  }
  async linkOrcamento(ctx:RequestContext,id:string,payload:unknown) {
    const scope=await this.prepare(ctx,'aprovar'); this.id(id); const input=this.parse(oportunidadeLinkSchema,payload);
    await this.rbac.assertAllowed(ctx,'Comercial','orcamento','visualizar',{allowGlobalWildcard:false});
    return this.repo.withTransaction(scope,async tx => {
      const before=await this.require(scope,id,tx,true);
      await this.allowed(ctx,'aprovar',tx);
      await this.rbac.assertAllowed(ctx,'Comercial','orcamento','visualizar',{allowGlobalWildcard:false,executor:tx});
      if(before.orcamento_id===input.orcamento_id && before.convertido_em==='orcamento')return before;
      this.version(before,input.expected_version);
      if(!before.ativo || !oportunidadeAberta({status:before.status}))this.conflict();
      const doc=await this.orcamentos.get(scope,input.orcamento_id,tx,true);
      if(!doc)throw new AppError(404,'ORCAMENTO_NOT_FOUND','Orcamento unavailable');
      if(doc.status!=='EM_ABERTO' || !before.cliente_empresa_id || before.cliente_empresa_id!==doc.cliente_empresa_id)
        throw new AppError(422,'OPORTUNIDADE_DOCUMENT_REFERENCE_INVALID','Orcamento must belong to the same customer and scope');
      await this.clientReference(scope,before.cliente_empresa_id,tx);
      const converted=stampOportunidadeConvertida({...before,historico_mudancas_etapa:before.historico_mudancas_etapa as any[]},doc,'orcamento');
      // Preserve the original textual document reference before canonical linking.
      const preserved={...converted,legacy_orcamento_id:before.legacy_orcamento_id ?? before.orcamento_id};
      const after=await this.repo.update(scope,id,before.version,this.fields(preserved,before.valor_estimado),ctx.actorId!,tx);
      if(!after)this.conflict(); await this.auditRow(ctx,'link',before,after,tx); return after;
    });
  }
  async linkPedido(ctx:RequestContext,id:string,payload:unknown) {
    const scope=await this.prepare(ctx,'aprovar');this.id(id);
    const input=this.parse(oportunidadePedidoLinkSchema,payload);
    if(!this.pedidos)throw new AppError(503,'CRM_PEDIDO_PORT_UNAVAILABLE','Canonical Pedido port unavailable');
    await this.rbac.assertAllowed(ctx,'Comercial','pedido','visualizar',{allowGlobalWildcard:false});
    return this.repo.withTransaction(scope,async tx=>{
      const before=await this.require(scope,id,tx,true);
      await this.allowed(ctx,'aprovar',tx);
      await this.rbac.assertAllowed(ctx,'Comercial','pedido','visualizar',{allowGlobalWildcard:false,executor:tx});
      if(before.pedido_id===input.pedido_id && before.convertido_em==='pedido')return before;
      this.version(before,input.expected_version);
      if(!before.ativo)this.conflict();
      const fromQuote=before.convertido_em==='orcamento' && before.status==='Ganho';
      if(!fromQuote && !oportunidadeAberta({status:before.status}))this.conflict();
      const doc=await this.pedidos!.get(scope,input.pedido_id,tx,true);
      if(!doc)throw new AppError(404,'PEDIDO_NOT_FOUND','Pedido unavailable');
      if(!doc.ativo || doc.status!=='EM_ABERTO' || !before.cliente_empresa_id || before.cliente_empresa_id!==doc.cliente_empresa_id
        || (fromQuote && doc.orcamento_id!==before.orcamento_id))
        throw new AppError(422,'OPORTUNIDADE_DOCUMENT_REFERENCE_INVALID','Pedido must belong to the same customer, scope and quotation');
      await this.clientReference(scope,before.cliente_empresa_id,tx);
      const converted=stampOportunidadeConvertida({...before,historico_mudancas_etapa:before.historico_mudancas_etapa as any[]},doc,'pedido');
      const preserved={...converted,legacy_pedido_id:before.legacy_pedido_id??before.pedido_id};
      const after=await this.repo.update(scope,id,before.version,this.fields(preserved,before.valor_estimado),ctx.actorId!,tx);
      if(!after)this.conflict();await this.auditRow(ctx,'link',before,after,tx);return after;
    });
  }
  private fields(record:Record<string,unknown>, money:string):OportunidadeFields {
    const fields=Object.fromEntries(FIELDS.map(key=>[key,record[key]??null]));
    const stage=normalizeEtapaCrm(record.etapa); this.assertStage(stage);
    if(!record.cliente_empresa_id && !String(record.cliente_nome ?? '').trim() && !String(record.cliente_email ?? '').trim())
      throw new AppError(422,'OPORTUNIDADE_CLIENTE_REQUIRED','Customer required');
    return {...fields,etapa:stage,valor_estimado:money,probabilidade:Number(record.probabilidade),
      historico_mudancas_etapa:record.historico_mudancas_etapa??[]} as OportunidadeFields;
  }
  private async clientReference(scope:OportunidadeScope,id:string|null|undefined,tx?:DbQueryExecutor) {
    if(!id)return null;
    const link=await this.clientes.getEmpresaLinkById(scope,id,tx);
    if(!link || !link.ativo || link.bloqueado || !link.habilitado_operacao)
      throw new AppError(422,'OPORTUNIDADE_CLIENTE_INVALID','ClienteEmpresa unavailable');
    return link.cliente_id;
  }
  private async require(scope:OportunidadeScope,id:string,tx?:DbQueryExecutor,lock=false) {
    const row=await this.repo.get(scope,id,tx,lock);
    if(!row)throw new AppError(404,'OPORTUNIDADE_NOT_FOUND','Oportunidade unavailable'); return row;
  }
  private async prepare(ctx:RequestContext,action:RbacAction):Promise<OportunidadeScope> {
    if(!ctx.groupId || !ctx.empresaId)throw new AppError(400,'TENANT_REQUIRED','Group and company required');
    this.id(ctx.groupId); this.id(ctx.empresaId);
    if(!ctx.actorId)throw new AppError(403,'ACTOR_REQUIRED','Actor required'); this.id(ctx.actorId);
    await this.tenant.assertEmpresaInGroup(ctx.groupId,ctx.empresaId);
    await this.rbac.assertAllowed(ctx,'CRM','oportunidades',action,{allowGlobalWildcard:false});
    return {groupId:ctx.groupId,empresaId:ctx.empresaId};
  }
  private async auditRow(ctx:RequestContext,action:AuditAction,before:Oportunidade|null,after:Oportunidade,tx?:DbQueryExecutor) {
    await this.audit.append({groupId:ctx.groupId,empresaId:ctx.empresaId,actorId:ctx.actorId,actorEmail:ctx.actorEmail,
      entity:'Oportunidade',entityId:after.id,action,beforeData:before?snapshot(before):undefined,
      afterData:snapshot(after),requestId:ctx.requestId,ipAddress:ctx.ipAddress},tx);
  }
  private allowed(ctx:RequestContext,action:RbacAction,executor?:DbQueryExecutor) {
    return this.rbac.assertAllowed(ctx,'CRM','oportunidades',action,{allowGlobalWildcard:false,executor});
  }
  private parse<T>(schema:z.ZodType<T>,input:unknown):T {
    const result=schema.safeParse(input); if(!result.success)throw new AppError(422,'VALIDATION_ERROR','Invalid Oportunidade input'); return result.data;
  }
  private policy<T>(fn:()=>T):T {
    try{return fn();}catch{throw new AppError(422,'OPORTUNIDADE_RULE_ERROR','Invalid Oportunidade state or input');}
  }
  private assertStage(value:string) { if(!CRM_ETAPAS.includes(value))throw new AppError(422,'OPORTUNIDADE_STAGE_INVALID','Unknown stage'); }
  private id(value:string) { if(!z.string().uuid().safeParse(value).success)throw new AppError(400,'VALIDATION_ERROR','Invalid identifier'); }
  private version(row:Oportunidade,expected:number) { if(row.version!==expected)this.conflict(); }
  private conflict():never { throw new AppError(409,'OPORTUNIDADE_STATE_CONFLICT','Oportunidade changed or closed'); }
}
