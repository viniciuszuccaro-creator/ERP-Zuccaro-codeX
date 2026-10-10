import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { reserveEntityCodigo } from './reserveEntityCodigo.js';
import { OPORTUNIDADE_FIELDS } from './oportunidadeTypes.js';
import type { Oportunidade, OportunidadeFields, OportunidadeFilters, OportunidadeRepository, OportunidadeScope } from './oportunidadeTypes.js';

const FIELDS = OPORTUNIDADE_FIELDS;
const values = (fields: OportunidadeFields) => FIELDS.map(key => ['historico_mudancas_etapa','produtos_interesse'].includes(key)
  ? JSON.stringify(fields[key]) : fields[key]);
const date = (value: unknown) => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);
function map(raw: Record<string,unknown>): Oportunidade {
  const fields = Object.fromEntries(FIELDS.map(key => [key, raw[key] ?? null]));
  return { ...fields, id: String(raw.id), group_id: String(raw.group_id), empresa_id: String(raw.empresa_id),
    codigo: String(raw.codigo), codigo_oportunidade: String(raw.codigo_oportunidade),
    legacy_store_id: raw.legacy_store_id == null ? null : String(raw.legacy_store_id),
    idempotency_key: String(raw.idempotency_key), payload_fingerprint: String(raw.payload_fingerprint),
    valor_estimado: String(raw.valor_estimado), probabilidade: Number(raw.probabilidade),
    orcamento_cliente:String(raw.orcamento_cliente),
    produtos_interesse:Array.isArray(raw.produtos_interesse)?raw.produtos_interesse:JSON.parse(String(raw.produtos_interesse??'[]')),
    data_previsao:raw.data_previsao==null?null:date(raw.data_previsao),
    data_proxima_acao:raw.data_proxima_acao==null?null:date(raw.data_proxima_acao),
    historico_mudancas_etapa: Array.isArray(raw.historico_mudancas_etapa) ? raw.historico_mudancas_etapa
      : JSON.parse(String(raw.historico_mudancas_etapa ?? '[]')),
    data_abertura: date(raw.data_abertura), data_fechamento: raw.data_fechamento == null ? null : date(raw.data_fechamento),
    ativo: Boolean(raw.ativo), version: Number(raw.version), created_by: String(raw.created_by), updated_by: String(raw.updated_by),
    created_at: new Date(raw.created_at instanceof Date ? raw.created_at.getTime() : String(raw.created_at)).toISOString(),
    updated_at: new Date(raw.updated_at instanceof Date ? raw.updated_at.getTime() : String(raw.updated_at)).toISOString(),
  } as Oportunidade;
}

export class PostgresOportunidadeRepository implements OportunidadeRepository {
  constructor(private readonly db: DbClient) {}
  withTransaction<T>(scope: OportunidadeScope, fn: (tx?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(async tx => {
      await tx.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [scope.groupId,scope.empresaId]);
      return fn(tx);
    });
  }
  private run<T>(scope: OportunidadeScope, tx: DbQueryExecutor | undefined, fn: (q: DbQueryExecutor) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.withTransaction(scope, q => fn(q!));
  }
  async lockIdempotency(scope: OportunidadeScope, key: string, tx?: DbQueryExecutor) {
    if (!tx) throw new Error('OPORTUNIDADE_SHARED_TRANSACTION_REQUIRED');
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([scope.groupId,scope.empresaId,key])]);
  }
  byKey(scope: OportunidadeScope, key: string, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const r = await q.query<Record<string,unknown>>('SELECT * FROM oportunidades WHERE group_id=$1 AND empresa_id=$2 AND idempotency_key=$3', [scope.groupId,scope.empresaId,key]);
      return r.rows[0] ? map(r.rows[0]) : null;
    });
  }
  get(scope: OportunidadeScope, id: string, tx?: DbQueryExecutor, lock = false) {
    return this.run(scope,tx,async q => {
      const r = await q.query<Record<string,unknown>>(`SELECT * FROM oportunidades WHERE group_id=$1 AND empresa_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`, [scope.groupId,scope.empresaId,id]);
      return r.rows[0] ? map(r.rows[0]) : null;
    });
  }
  byLegacy(scope: OportunidadeScope, id: string, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const r=await q.query<Record<string,unknown>>('SELECT * FROM oportunidades WHERE group_id=$1 AND empresa_id=$2 AND legacy_store_id=$3',[scope.groupId,scope.empresaId,id]);
      return r.rows[0]?map(r.rows[0]):null;
    });
  }
  list(scope: OportunidadeScope, filters: OportunidadeFilters, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const r = await q.query<{total:number;rows:Record<string,unknown>[]}>(
        `WITH filtered AS (SELECT * FROM oportunidades WHERE group_id=$1 AND empresa_id=$2
          AND ($3::boolean IS NULL OR ativo=$3) AND ($4::text IS NULL OR status=$4)
          AND ($5::uuid IS NULL OR cliente_empresa_id=$5)
          AND ($6::text IS NULL OR titulo ILIKE '%'||$6||'%' OR codigo_oportunidade ILIKE '%'||$6||'%')),
        page AS (SELECT * FROM filtered ORDER BY updated_at DESC,id DESC LIMIT $7 OFFSET $8)
        SELECT (SELECT count(*)::int FROM filtered) total,
          COALESCE((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('valor_estimado',p.valor_estimado::text,'orcamento_cliente',p.orcamento_cliente::text)
            ORDER BY updated_at DESC,id DESC) FROM page p),'[]'::jsonb) rows`,
        [scope.groupId,scope.empresaId,filters.ativo ?? null,filters.status ?? null,
          filters.clienteEmpresaId ?? null,filters.search ?? null,filters.limit,filters.offset]);
      return { total: Number(r.rows[0]?.total ?? 0), rows: (r.rows[0]?.rows ?? []).map(map) };
    });
  }
  create(scope: OportunidadeScope, fields: OportunidadeFields, key: string, hash: string, actor: string, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const codigo = await reserveEntityCodigo({ db:q,groupId:scope.groupId,entityName:'Oportunidade',table:'oportunidades',width:6 });
      const p = [scope.groupId,scope.empresaId,codigo,`OPP-${codigo}`,key,hash,actor,...values(fields)];
      const r = await q.query<Record<string,unknown>>(`INSERT INTO oportunidades
        (group_id,empresa_id,codigo,codigo_oportunidade,idempotency_key,payload_fingerprint,created_by,updated_by,${FIELDS.join(',')})
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7,${FIELDS.map((_,i) => `$${i+8}`).join(',')}) RETURNING *`,p);
      return map(r.rows[0]);
    });
  }
  byPedido(scope:OportunidadeScope,id:string,tx?:DbQueryExecutor) {
    return this.run(scope,tx,async q=>{
      const r=await q.query<Record<string,unknown>>("SELECT * FROM oportunidades WHERE group_id=$1 AND empresa_id=$2 AND convertido_em='pedido' AND convertido_em_id=$3",[scope.groupId,scope.empresaId,id]);
      return r.rows[0]?map(r.rows[0]):null;
    });
  }
  update(scope: OportunidadeScope, id: string, expectedVersion: number, fields: OportunidadeFields, actor: string, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const r = await q.query<Record<string,unknown>>(`UPDATE oportunidades SET
        ${FIELDS.map((field,i) => `${field}=$${i+6}`).join(',')},version=version+1,updated_by=$5
        WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND version=$4 AND ativo=true RETURNING *`,
        [scope.groupId,scope.empresaId,id,expectedVersion,actor,...values(fields)]);
      return r.rows[0] ? map(r.rows[0]) : null;
    });
  }
  setActive(scope: OportunidadeScope, id: string, expectedVersion: number, active: boolean, actor: string, tx?: DbQueryExecutor) {
    return this.run(scope,tx,async q => {
      const r = await q.query<Record<string,unknown>>(`UPDATE oportunidades SET ativo=$5,version=version+1,updated_by=$6
        WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND version=$4 AND ativo<>$5 RETURNING *`,
        [scope.groupId,scope.empresaId,id,expectedVersion,active,actor]);
      return r.rows[0] ? map(r.rows[0]) : null;
    });
  }
}
