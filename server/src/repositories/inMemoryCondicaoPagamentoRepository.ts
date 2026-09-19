import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import type { CondicaoPagamento, CondicaoPagamentoCreate, CondicaoPagamentoEmpresa, CondicaoPagamentoParcela, CondicaoPagamentoParcelaInput, CondicaoPagamentoUpdate } from './condicaoPagamentoTypes.js';

export type CondicaoPagamentoScope = { groupId: string; empresaId?: string | null };
export type CondicaoPagamentoListFilter = CondicaoPagamentoScope & { ativo?: boolean; ehPadrao?: boolean; search?: string; limit: number; offset: number };
export interface CondicaoPagamentoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: CondicaoPagamentoListFilter, executor?: DbQueryExecutor): Promise<{ rows: CondicaoPagamento[]; total: number }>;
  get(scope: CondicaoPagamentoScope, id: string, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  create(scope: { groupId: string; empresaId: string }, data: CondicaoPagamentoCreate, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento>;
  update(scope: CondicaoPagamentoScope, id: string, data: CondicaoPagamentoUpdate, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  softDelete(scope: CondicaoPagamentoScope, id: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  restore(scope: CondicaoPagamentoScope, id: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  linkEmpresa(scope: CondicaoPagamentoScope, id: string, empresaId: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  unlinkEmpresa(scope: CondicaoPagamentoScope, id: string, empresaId: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  restoreEmpresa(scope: CondicaoPagamentoScope, id: string, empresaId: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  setPadrao(scope: { groupId: string; empresaId: string }, id: string, actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  replaceParcelas(scope: CondicaoPagamentoScope, id: string, parcelas: CondicaoPagamentoParcelaInput[], actorId: string | null | undefined, executor?: DbQueryExecutor): Promise<CondicaoPagamento | null>;
  hasActivePadrao(groupId: string, id: string, executor?: DbQueryExecutor): Promise<boolean>;
  countActiveClienteEmpresaRefs(groupId: string, id: string, executor?: DbQueryExecutor): Promise<number>;
}
const iso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
export class InMemoryCondicaoPagamentoRepository implements CondicaoPagamentoRepository {
  private readonly rows = new Map<string, CondicaoPagamento>();
  private readonly clienteRefs = new Set<string>();
  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>) { return fn(); }
  private visible(row: CondicaoPagamento, scope: CondicaoPagamentoScope) { return row.group_id === scope.groupId && (!scope.empresaId || row.empresas.some((e) => e.empresa_id === scope.empresaId && e.ativo)); }
  async listPage(filter: CondicaoPagamentoListFilter) { const rows = [...this.rows.values()].filter((r) => this.visible(r, filter) && (filter.ativo === undefined || r.ativo === filter.ativo) && (!filter.ehPadrao || r.empresas.some((e) => e.empresa_id === filter.empresaId && e.ativo && e.eh_padrao)) && (!filter.search || r.nome.toLowerCase().includes(filter.search.toLowerCase()) || r.codigo.includes(filter.search))).sort((a,b) => a.nome.localeCompare(b.nome)); return { rows: rows.slice(filter.offset, filter.offset + filter.limit).map(clone), total: rows.length }; }
  async get(scope: CondicaoPagamentoScope, id: string) { const row = this.rows.get(id); return row && this.visible(row, scope) ? clone(row) : null; }
  async create(scope: { groupId: string; empresaId: string }, data: CondicaoPagamentoCreate, actorId: string | null | undefined) { const now=iso(), id=randomUUID(), codigo=String(this.rows.size+1).padStart(6,'0'); const empresas: CondicaoPagamentoEmpresa[]=[{id:randomUUID(),group_id:scope.groupId,condicao_pagamento_id:id,empresa_id:scope.empresaId,eh_padrao:false,ativo:true,created_by:actorId??null,updated_by:actorId??null,created_at:now,updated_at:now}]; const parcelas=this.makeParcelas(scope.groupId,id,data.parcelas,actorId,now); const row: CondicaoPagamento={id,group_id:scope.groupId,empresa_id:scope.empresaId,codigo,nome:data.nome,descricao:data.descricao??null,ativo:true,codigo_condicao_legado:data.codigo_condicao_legado??null,origem:data.origem??'ERP',legacy_id:data.legacy_id??null,legacy_code:data.legacy_code??null,source_system:data.source_system??null,migration_batch:data.migration_batch??null,imported_at:data.imported_at??null,created_by:actorId??null,updated_by:actorId??null,created_at:now,updated_at:now,empresas,parcelas}; this.rows.set(id,row); return clone(row); }
  async update(scope: CondicaoPagamentoScope,id:string,data:CondicaoPagamentoUpdate,actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||!this.visible(row,scope)) return null; Object.assign(row,{...data,updated_by:actorId??null,updated_at:iso()}); return clone(row); }
  async softDelete(scope:CondicaoPagamentoScope,id:string,actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||!this.visible(row,scope)) return null; row.ativo=false; row.updated_by=actorId??null; row.updated_at=iso(); return clone(row); }
  async restore(scope:CondicaoPagamentoScope,id:string,actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||row.group_id!==scope.groupId) return null; row.ativo=true; row.updated_by=actorId??null; row.updated_at=iso(); return clone(row); }
  async linkEmpresa(scope:CondicaoPagamentoScope,id:string,empresaId:string,actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||!this.visible(row,scope)) return null; const old=row.empresas.find((e)=>e.empresa_id===empresaId); if(old){old.ativo=true;old.updated_by=actorId??null;old.updated_at=iso();} else {const now=iso();row.empresas.push({id:randomUUID(),group_id:scope.groupId,condicao_pagamento_id:id,empresa_id:empresaId,eh_padrao:false,ativo:true,created_by:actorId??null,updated_by:actorId??null,created_at:now,updated_at:now});} return clone(row); }
  async unlinkEmpresa(scope:CondicaoPagamentoScope,id:string,empresaId:string,actorId:string|null|undefined) { const row=this.rows.get(id); const link=row?.empresas.find((e)=>e.empresa_id===empresaId); if(!row||!link||!this.visible(row,scope)||row.empresa_id===empresaId) throw new Error('CONDICAO_PAGAMENTO_OWNER_REQUIRED'); if(link.eh_padrao) throw new Error('CONDICAO_PAGAMENTO_IN_USE'); link.ativo=false;link.updated_by=actorId??null;link.updated_at=iso(); return clone(row); }
  async restoreEmpresa(scope:CondicaoPagamentoScope,id:string,empresaId:string,actorId:string|null|undefined) { return this.linkEmpresa(scope,id,empresaId,actorId); }
  async setPadrao(scope:{groupId:string;empresaId:string},id:string,actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||!this.visible(row,scope)) return null; for(const value of this.rows.values()) for(const link of value.empresas) if(link.empresa_id===scope.empresaId) link.eh_padrao=false; const link=row.empresas.find((e)=>e.empresa_id===scope.empresaId&&e.ativo); if(!link) return null;link.eh_padrao=true;link.updated_by=actorId??null;link.updated_at=iso();return clone(row); }
  async replaceParcelas(scope:CondicaoPagamentoScope,id:string,parcelas:CondicaoPagamentoParcelaInput[],actorId:string|null|undefined) { const row=this.rows.get(id); if(!row||!this.visible(row,scope)) return null; row.parcelas=this.makeParcelas(scope.groupId,id,parcelas,actorId,iso());row.updated_by=actorId??null;row.updated_at=iso();return clone(row); }
  async hasActivePadrao(groupId:string,id:string) { const row=this.rows.get(id); return !!row?.empresas.some((e)=>e.group_id===groupId&&e.ativo&&e.eh_padrao); }
  async countActiveClienteEmpresaRefs(groupId:string,id:string) { return this.clienteRefs.has(`${groupId}:${id}`)?1:0; }
  private makeParcelas(groupId:string,id:string,input:CondicaoPagamentoParcelaInput[],actorId:string|null|undefined,now:string):CondicaoPagamentoParcela[] { return input.map((p)=>({id:randomUUID(),group_id:groupId,condicao_pagamento_id:id,ordem:p.ordem,dias:p.dias,percentual:p.percentual,ativo:true,created_by:actorId??null,updated_by:actorId??null,created_at:now,updated_at:now})); }
}
