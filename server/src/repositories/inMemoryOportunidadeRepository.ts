import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import type { Oportunidade, OportunidadeFields, OportunidadeFilters, OportunidadeRepository, OportunidadeScope } from './oportunidadeTypes.js';

export class InMemoryOportunidadeRepository implements OportunidadeRepository {
  private rows = new Map<string,Oportunidade>();
  private sequence = new Map<string,number>();
  private tail: Promise<unknown> = Promise.resolve();
  async withTransaction<T>(_scope: OportunidadeScope, fn: (tx?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const previous = this.tail; let release!: () => void;
    this.tail = new Promise<void>(done => { release=done; }); await previous;
    const before=structuredClone(this.rows), codes=new Map(this.sequence);
    try { return await fn(); } catch(error) { this.rows=before; this.sequence=codes; throw error; }
    finally { release(); }
  }
  async lockIdempotency() { /* Serialized transaction owns the key until commit/rollback. */ }
  private scoped(scope: OportunidadeScope, row: Oportunidade | undefined) {
    return row?.group_id===scope.groupId && row.empresa_id===scope.empresaId ? row : null;
  }
  async byKey(scope: OportunidadeScope, key: string) {
    return structuredClone([...this.rows.values()].find(r => this.scoped(scope,r) && r.idempotency_key===key) ?? null);
  }
  async get(scope: OportunidadeScope, id: string) { return structuredClone(this.scoped(scope,this.rows.get(id))); }
  async byLegacy(scope:OportunidadeScope,id:string) {
    return structuredClone([...this.rows.values()].find(r=>this.scoped(scope,r)&&r.legacy_store_id===id)??null);
  }
  async list(scope: OportunidadeScope, filters: OportunidadeFilters) {
    const search=filters.search?.toLocaleLowerCase('pt-BR');
    const rows=[...this.rows.values()].filter(r => this.scoped(scope,r)
      && (filters.ativo===undefined || r.ativo===filters.ativo) && (!filters.status || r.status===filters.status)
      && (!filters.clienteEmpresaId || r.cliente_empresa_id===filters.clienteEmpresaId)
      && (!search || [r.titulo,r.codigo_oportunidade].some(s => s.toLocaleLowerCase('pt-BR').includes(search))))
      .sort((a,b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
    return {total:rows.length,rows:structuredClone(rows.slice(filters.offset,filters.offset+filters.limit))};
  }
  async create(scope: OportunidadeScope, fields: OportunidadeFields, key: string, hash: string, actor: string) {
    if (await this.byKey(scope,key)) throw new Error('OPORTUNIDADE_IDEMPOTENCY_CONFLICT');
    const n=this.sequence.get(scope.groupId) ?? 1; this.sequence.set(scope.groupId,n+1);
    const codigo=String(n).padStart(6,'0'), now=new Date().toISOString();
    const row:Oportunidade={...structuredClone(fields),id:randomUUID(),group_id:scope.groupId,empresa_id:scope.empresaId,
      codigo,codigo_oportunidade:`OPP-${codigo}`,legacy_store_id:null,idempotency_key:key,payload_fingerprint:hash,
      ativo:true,version:1,created_by:actor,updated_by:actor,created_at:now,updated_at:now};
    this.rows.set(row.id,row); return structuredClone(row);
  }
  async update(scope: OportunidadeScope, id: string, version: number, fields: OportunidadeFields, actor: string) {
    const row=this.scoped(scope,this.rows.get(id)); if(!row || !row.ativo || row.version!==version)return null;
    const next={...row,...structuredClone(fields),version:row.version+1,updated_by:actor,updated_at:new Date().toISOString()};
    this.rows.set(id,next); return structuredClone(next);
  }
  async setActive(scope: OportunidadeScope, id: string, version: number, active: boolean, actor: string) {
    const row=this.scoped(scope,this.rows.get(id)); if(!row || row.version!==version || row.ativo===active)return null;
    const next={...row,ativo:active,version:row.version+1,updated_by:actor,updated_at:new Date().toISOString()};
    this.rows.set(id,next); return structuredClone(next);
  }
}
