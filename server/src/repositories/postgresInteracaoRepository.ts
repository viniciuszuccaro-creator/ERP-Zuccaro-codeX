import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { reserveEntityCodigo } from './reserveEntityCodigo.js';
import { publicInteracao, type InteracaoStored, type InteracaoFields, type InteracaoFilters, type InteracaoScope } from './interacaoTypes.js';

const iso=(v:unknown)=>new Date(v instanceof Date?v.getTime():String(v)).toISOString();
function map(row:Record<string,unknown>):InteracaoStored {
  const {payload,...meta}=row;
  return {...(payload as InteracaoFields),...meta, version:Number(meta.version),
    created_at:iso(meta.created_at),updated_at:iso(meta.updated_at)} as InteracaoStored;
}
export class PostgresInteracaoRepository {
  constructor(private readonly db:DbClient) {}
  transaction<T>(scope:InteracaoScope,fn:(tx:DbQueryExecutor)=>Promise<T>) {
    return this.db.withTransaction(async tx=>{
      await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)",[scope.groupId,scope.empresaId]);
      return fn(tx);
    });
  }
  async lockKey(scope:InteracaoScope,key:string,tx:DbQueryExecutor) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['Interacao',scope.groupId,scope.empresaId,key])]);
  }
  async lockCliente(scope:InteracaoScope,id:string,tx:DbQueryExecutor) {
    await tx.query('SELECT id FROM cliente_empresas WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR SHARE',[id,scope.groupId,scope.empresaId]);
  }
  async get(scope:InteracaoScope,id:string,tx:DbQueryExecutor,lock=false) {
    const r=await tx.query<Record<string,unknown>>(`SELECT * FROM interacoes WHERE id=$1 AND group_id=$2 AND empresa_id=$3${lock?' FOR UPDATE':''}`,[id,scope.groupId,scope.empresaId]);
    return r.rows[0]?map(r.rows[0]):null;
  }
  async byKey(scope:InteracaoScope,key:string,tx:DbQueryExecutor) {
    const r=await tx.query<Record<string,unknown>>('SELECT * FROM interacoes WHERE group_id=$1 AND empresa_id=$2 AND idempotency_key=$3',[scope.groupId,scope.empresaId,key]);
    return r.rows[0]?map(r.rows[0]):null;
  }
  async create(scope:InteracaoScope,fields:InteracaoFields,refs:{cliente_empresa_id:string|null;oportunidade_id:string|null},key:string,hash:string,actor:string,tx:DbQueryExecutor) {
    const codigo=await reserveEntityCodigo({db:tx,groupId:scope.groupId,entityName:'Interacao',table:'interacoes'});
    const r=await tx.query<Record<string,unknown>>(`INSERT INTO interacoes(group_id,empresa_id,codigo,cliente_empresa_id,oportunidade_id,idempotency_key,payload_fingerprint,payload,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9) RETURNING *`,
    [scope.groupId,scope.empresaId,codigo,refs.cliente_empresa_id,refs.oportunidade_id,key,hash,JSON.stringify(fields),actor]);
    return map(r.rows[0]);
  }
  async update(scope:InteracaoScope,id:string,fields:InteracaoFields,active:boolean,actor:string,tx:DbQueryExecutor) {
    const r=await tx.query<Record<string,unknown>>(`UPDATE interacoes SET payload=$4::jsonb,ativo=$5,updated_by=$6,version=version+1
      WHERE id=$1 AND group_id=$2 AND empresa_id=$3 RETURNING *`,[id,scope.groupId,scope.empresaId,JSON.stringify(fields),active,actor]);
    return map(r.rows[0]);
  }
  async appendHistory(row:InteracaoStored,action:string,actor:string,tx:DbQueryExecutor) {
    await tx.query(`INSERT INTO interacao_historico(group_id,empresa_id,interacao_id,version,action,snapshot,actor_id)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,[row.group_id,row.empresa_id,row.id,row.version,action,JSON.stringify(publicInteracao(row)),actor]);
  }
  async list(scope:InteracaoScope,f:InteracaoFilters,tx:DbQueryExecutor) {
    const where=`group_id=$1 AND empresa_id=$2 AND ($3::uuid IS NULL OR cliente_empresa_id=$3)
      AND ($4::uuid IS NULL OR oportunidade_id=$4) AND ($5::boolean IS NULL OR ativo=$5)
      AND ($6::text IS NULL OR strpos(lower(payload->>'titulo'),lower($6))>0 OR strpos(codigo,$6)>0)`;
    const values=[scope.groupId,scope.empresaId,f.clienteEmpresaId??null,f.oportunidadeId??null,f.ativo??null,f.search??null];
    const count=await tx.query<{total:number}>(`SELECT count(*)::int total FROM interacoes WHERE ${where}`,values);
    const rows=await tx.query<Record<string,unknown>>(`SELECT * FROM interacoes WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $7 OFFSET $8`,[...values,f.limit,f.offset]);
    return {rows:rows.rows.map(map).map(publicInteracao),total:Number(count.rows[0].total)};
  }
  async history(scope:InteracaoScope,id:string,limit:number,offset:number,tx:DbQueryExecutor) {
    const args=[id,scope.groupId,scope.empresaId];
    const count=await tx.query<{total:number}>('SELECT count(*)::int total FROM interacao_historico WHERE interacao_id=$1 AND group_id=$2 AND empresa_id=$3',args);
    const rows=await tx.query('SELECT id,version,action,snapshot,actor_id,created_at FROM interacao_historico WHERE interacao_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY version DESC LIMIT $4 OFFSET $5',[...args,limit,offset]);
    return {rows:rows.rows,total:Number(count.rows[0].total)};
  }
}
