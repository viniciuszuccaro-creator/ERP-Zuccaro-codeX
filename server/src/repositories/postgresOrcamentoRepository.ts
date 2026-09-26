import type { DbClient, DbQueryExecutor } from '../db/client.js';
import {
  calculateOrcamento,
  type Orcamento,
  type OrcamentoCreate,
  type OrcamentoListFilters,
  type OrcamentoOrigem,
  type OrcamentoRepository,
  type OrcamentoScope,
  type OrcamentoStatus,
} from './orcamentoTypes.js';

type Row = Record<string, unknown>;

const map = (row: Row): Orcamento => ({
  id: String(row.id),
  group_id: String(row.group_id),
  empresa_id: String(row.empresa_id),
  numero: String(row.numero),
  versao: Number(row.versao ?? 1),
  orcamento_raiz_id: String(row.orcamento_raiz_id ?? row.id),
  supersedido_por_id: row.supersedido_por_id == null ? null : String(row.supersedido_por_id),
  status: String(row.status) as OrcamentoStatus,
  cliente_empresa_id: String(row.cliente_empresa_id),
  condicao_pagamento_id: String(row.condicao_pagamento_id),
  validade_em: new Date(String(row.validade_em)).toISOString(),
  observacoes: row.observacoes == null ? null : String(row.observacoes),
  origem: String(row.origem ?? 'MANUAL') as OrcamentoOrigem,
  canal: row.canal == null ? null : String(row.canal),
  external_id: row.external_id == null ? null : String(row.external_id),
  idempotency_key: row.idempotency_key == null ? null : String(row.idempotency_key),
  campanha: row.campanha == null ? null : String(row.campanha),
  ativo: Boolean(row.ativo),
  subtotal: String(row.subtotal),
  desconto: String(row.desconto),
  total: String(row.total),
  created_at: new Date(String(row.created_at)).toISOString(),
  updated_at: new Date(String(row.updated_at)).toISOString(),
  itens: (Array.isArray(row.itens) ? row.itens : JSON.parse(String(row.itens ?? '[]'))).map((item: Row) => ({
    produto_id: String(item.produto_id),
    unidade_id: String(item.unidade_id),
    descricao: String(item.descricao_snapshot ?? item.descricao ?? ''),
    unidade_sigla: String(item.unidade_snapshot ?? item.unidade_sigla ?? ''),
    quantidade: String(item.quantidade),
    preco_unitario: String(item.preco_unitario),
    desconto: String(item.desconto ?? '0'),
    subtotal: String(item.subtotal),
    total: String(item.total),
  })),
});

const SELECT = `SELECT o.*,COALESCE((SELECT json_agg(i ORDER BY i.created_at,i.id) FROM orcamento_itens i WHERE i.orcamento_id=o.id AND i.group_id=o.group_id AND i.empresa_id=o.empresa_id),'[]') itens FROM orcamentos o`;

export class PostgresOrcamentoRepository implements OrcamentoRepository {
  constructor(private readonly db: DbClient) {}

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  private runTransaction<T>(executor: DbQueryExecutor | undefined, fn: (tx: DbQueryExecutor) => Promise<T>): Promise<T> {
    return executor ? fn(executor) : this.db.withTransaction(fn);
  }

  private async insertItems(query: DbQueryExecutor, scope: OrcamentoScope, id: string, data: OrcamentoCreate) {
    const totals = calculateOrcamento(data.itens);
    for (const item of totals.itens) {
      await query.query(
        'INSERT INTO orcamento_itens(group_id,empresa_id,orcamento_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,desconto,subtotal,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [scope.groupId, scope.empresaId, id, item.produto_id, item.unidade_id, item.descricao, item.unidade_sigla, item.quantidade, item.preco_unitario, item.desconto ?? '0', item.subtotal, item.total],
      );
    }
    return totals;
  }

  async get(scope: OrcamentoScope, id: string, query: DbQueryExecutor = this.db): Promise<Orcamento | null> {
    const result = await query.query<Row>(`${SELECT} WHERE o.id=$1 AND o.group_id=$2 AND o.empresa_id=$3`, [id, scope.groupId, scope.empresaId]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async getByIdempotencyKey(scope: OrcamentoScope, origem: OrcamentoOrigem, idempotencyKey: string, executor: DbQueryExecutor = this.db): Promise<Orcamento | null> {
    const result = await executor.query<Row>(
      `${SELECT} WHERE o.group_id=$1 AND o.empresa_id=$2 AND o.origem=$3 AND o.idempotency_key=$4`,
      [scope.groupId, scope.empresaId, origem, idempotencyKey],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async getByExternalId(scope: OrcamentoScope, origem: OrcamentoOrigem, externalId: string, executor: DbQueryExecutor = this.db): Promise<Orcamento | null> {
    const result = await executor.query<Row>(
      `${SELECT} WHERE o.group_id=$1 AND o.empresa_id=$2 AND o.origem=$3 AND o.external_id=$4`,
      [scope.groupId, scope.empresaId, origem, externalId],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async create(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor): Promise<Orcamento> {
    return this.runTransaction(executor, async (query) => {
      await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`orcamento:${scope.empresaId}`]);
      const sequence = await query.query<{ n: string }>('SELECT COALESCE(MAX(numero::int),0)+1 n FROM orcamentos WHERE empresa_id=$1', [scope.empresaId]);
      const numero = String(sequence.rows[0]?.n ?? '').padStart(8, '0');
      if (!/^\d{8}$/.test(numero)) throw new Error('ORCAMENTO_NUMERO_RESERVATION_FAILED');
      const totals = calculateOrcamento(data.itens);
      const origem = data.origem ?? 'MANUAL';
      const inserted = await query.query<{ id: string }>(
        `INSERT INTO orcamentos(
          group_id,empresa_id,numero,versao,cliente_empresa_id,condicao_pagamento_id,validade_em,observacoes,
          origem,canal,external_id,idempotency_key,campanha,subtotal,desconto,total
        ) VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          scope.groupId, scope.empresaId, numero, data.cliente_empresa_id, data.condicao_pagamento_id, data.validade_em,
          data.observacoes ?? null, origem, data.canal ?? null, data.external_id ?? null, data.idempotency_key ?? null,
          data.campanha ?? null, totals.subtotal, totals.desconto, totals.total,
        ],
      );
      const id = String(inserted.rows[0]?.id);
      await query.query('UPDATE orcamentos SET orcamento_raiz_id=$1 WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await this.insertItems(query, scope, id, data);
      return (await this.get(scope, id, query))!;
    });
  }

  async update(scope: OrcamentoScope, id: string, data: OrcamentoCreate, executor?: DbQueryExecutor): Promise<Orcamento | null> {
    return this.runTransaction(executor, async (query) => {
      const current = await this.get(scope, id, query);
      if (!current || current.status !== 'EM_ABERTO') return null;
      const totals = calculateOrcamento(data.itens);
      await query.query(
        'UPDATE orcamentos SET cliente_empresa_id=$4,condicao_pagamento_id=$5,validade_em=$6,observacoes=$7,subtotal=$8,desconto=$9,total=$10 WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId, data.cliente_empresa_id, data.condicao_pagamento_id, data.validade_em, data.observacoes ?? null, totals.subtotal, totals.desconto, totals.total],
      );
      await query.query('DELETE FROM orcamento_itens WHERE orcamento_id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await this.insertItems(query, scope, id, data);
      return this.get(scope, id, query);
    });
  }

  async list(scope: OrcamentoScope, limit = 50, offset = 0, executor?: DbQueryExecutor, filters: OrcamentoListFilters = {}) {
    const query = executor ?? this.db;
    const where = `o.group_id=$1 AND o.empresa_id=$2 AND ($3::text IS NULL OR o.numero ILIKE '%'||$3||'%') AND ($4::text IS NULL OR o.status=$4) AND ($5::uuid IS NULL OR o.cliente_empresa_id=$5) AND ($6::timestamptz IS NULL OR o.validade_em >= $6) AND ($7::timestamptz IS NULL OR o.validade_em <= $7) AND ($8::text IS NULL OR o.origem=$8)`;
    const filterParams = [scope.groupId, scope.empresaId, filters.search || null, filters.status || null, filters.clienteEmpresaId || null, filters.validadeDe || null, filters.validadeAte || null, filters.origem || null];
    const params = [...filterParams, Math.min(200, Math.max(1, Math.trunc(limit))), Math.max(0, Math.trunc(offset))];
    const [count, rows] = await Promise.all([
      query.query<{ total: number }>(`SELECT count(*)::int total FROM orcamentos o WHERE ${where}`, filterParams),
      query.query<Row>(`${SELECT} WHERE ${where} ORDER BY o.numero DESC,o.versao DESC,o.id DESC LIMIT $9 OFFSET $10`, params),
    ]);
    return { rows: rows.rows.map(map), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listVersions(scope: OrcamentoScope, raizId: string, executor?: DbQueryExecutor): Promise<Orcamento[]> {
    const query = executor ?? this.db;
    const result = await query.query<Row>(
      `${SELECT} WHERE o.group_id=$1 AND o.empresa_id=$2 AND o.orcamento_raiz_id=$3 ORDER BY o.versao DESC,o.id DESC`,
      [scope.groupId, scope.empresaId, raizId],
    );
    return result.rows.map(map);
  }

  async cancel(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor): Promise<Orcamento | null> {
    return this.runTransaction(executor, async (query) => {
      const result = await query.query<Row>(
        "UPDATE orcamentos SET status='CANCELADO',ativo=false WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND status='EM_ABERTO' RETURNING id",
        [id, scope.groupId, scope.empresaId],
      );
      return result.rows[0] ? this.get(scope, String(result.rows[0].id), query) : null;
    });
  }

  async createVersion(
    scope: OrcamentoScope,
    sourceId: string,
    data: OrcamentoCreate,
    executor?: DbQueryExecutor,
  ): Promise<{ previous: Orcamento; current: Orcamento }> {
    return this.runTransaction(executor, async (query) => {
      await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`orcamento-ver:${scope.empresaId}:${sourceId}`]);
      const source = await this.get(scope, sourceId, query);
      if (!source || source.status !== 'EM_ABERTO') throw new Error('ORCAMENTO_STATE_CONFLICT');
      const totals = calculateOrcamento(data.itens);
      const inserted = await query.query<{ id: string }>(
        `INSERT INTO orcamentos(
          group_id,empresa_id,numero,versao,orcamento_raiz_id,cliente_empresa_id,condicao_pagamento_id,
          validade_em,observacoes,origem,canal,external_id,idempotency_key,campanha,subtotal,desconto,total
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,$13,$14,$15,$16) RETURNING id`,
        [
          scope.groupId, scope.empresaId, source.numero, source.versao + 1, source.orcamento_raiz_id,
          data.cliente_empresa_id, data.condicao_pagamento_id, data.validade_em, data.observacoes ?? null,
          source.origem, source.canal, source.external_id, source.campanha,
          totals.subtotal, totals.desconto, totals.total,
        ],
      );
      const newId = String(inserted.rows[0]?.id);
      await this.insertItems(query, scope, newId, data);
      await query.query(
        "UPDATE orcamentos SET status='SUPERSEDIDO',supersedido_por_id=$4 WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND status='EM_ABERTO'",
        [sourceId, scope.groupId, scope.empresaId, newId],
      );
      const previous = await this.get(scope, sourceId, query);
      const current = await this.get(scope, newId, query);
      if (!previous || !current) throw new Error('ORCAMENTO_VERSION_CREATE_FAILED');
      return { previous, current };
    });
  }
}
