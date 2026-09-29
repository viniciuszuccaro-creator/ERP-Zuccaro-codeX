import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { mapParcelasSnapshotFromJson } from '../services/comercialCondicaoSnapshot.js';
import { calculateOrcamento, type Orcamento, type OrcamentoListFilters, type OrcamentoRepository, type OrcamentoScope, type OrcamentoWrite } from './orcamentoTypes.js';

type Row = Record<string, unknown>;

const map = (r: Row): Orcamento => ({
  ...(r as any),
  id: String(r.id),
  group_id: String(r.group_id),
  empresa_id: String(r.empresa_id),
  numero: String(r.numero),
  ativo: Boolean(r.ativo),
  subtotal: String(r.subtotal),
  desconto: String(r.desconto),
  total: String(r.total),
  observacoes: r.observacoes == null ? null : String(r.observacoes),
  tabela_preco_id: r.tabela_preco_id == null ? null : String(r.tabela_preco_id),
  tabela_preco_codigo_snapshot: r.tabela_preco_codigo_snapshot == null ? null : String(r.tabela_preco_codigo_snapshot),
  tabela_preco_nome_snapshot: r.tabela_preco_nome_snapshot == null ? null : String(r.tabela_preco_nome_snapshot),
  condicao_pagamento_codigo_snapshot: r.condicao_pagamento_codigo_snapshot == null ? null : String(r.condicao_pagamento_codigo_snapshot),
  condicao_pagamento_nome_snapshot: r.condicao_pagamento_nome_snapshot == null ? null : String(r.condicao_pagamento_nome_snapshot),
  condicao_pagamento_parcelas_snapshot: mapParcelasSnapshotFromJson(r.condicao_pagamento_parcelas_snapshot),
  promocao_aplicada: Boolean(r.promocao_aplicada),
  promocao_bps: r.promocao_bps == null ? null : Number(r.promocao_bps),
  promocao_cupom: r.promocao_cupom == null ? null : String(r.promocao_cupom),
  created_at: new Date(String(r.created_at)).toISOString(),
  updated_at: new Date(String(r.updated_at)).toISOString(),
  itens: (Array.isArray(r.itens) ? r.itens : JSON.parse(String(r.itens ?? '[]'))).map((i: Row) => ({
    ...i,
    id: String(i.id),
    produto_id: String(i.produto_id),
    unidade_id: String(i.unidade_id),
    descricao: String(i.descricao_snapshot ?? i.descricao ?? ''),
    unidade_sigla: String(i.unidade_snapshot ?? i.unidade_sigla ?? ''),
    quantidade: String(i.quantidade),
    preco_unitario: String(i.preco_unitario),
    desconto: String(i.desconto ?? '0'),
    subtotal: String(i.subtotal),
    total: String(i.total),
  })),
});

const SELECT = `SELECT o.*,COALESCE((SELECT json_agg(i ORDER BY i.created_at,i.id) FROM orcamento_itens i WHERE i.orcamento_id=o.id AND i.group_id=o.group_id AND i.empresa_id=o.empresa_id),'[]') itens FROM orcamentos o`;

export class PostgresOrcamentoRepository implements OrcamentoRepository {
  constructor(private readonly db: DbClient) {}
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> { return this.db.withTransaction(fn); }
  private runTransaction<T>(executor: DbQueryExecutor | undefined, fn: (tx: DbQueryExecutor) => Promise<T>): Promise<T> {
    return executor ? fn(executor) : this.db.withTransaction(fn);
  }

  private async items(q: DbQueryExecutor, s: OrcamentoScope, id: string, d: OrcamentoWrite) {
    const t = calculateOrcamento(d.itens);
    for (const i of t.itens) {
      await q.query(
        'INSERT INTO orcamento_itens(group_id,empresa_id,orcamento_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,desconto,subtotal,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [s.groupId, s.empresaId, id, i.produto_id, i.unidade_id, i.descricao, i.unidade_sigla, i.quantidade, i.preco_unitario, i.desconto ?? '0', i.subtotal, i.total],
      );
    }
    return t;
  }

  async get(s: OrcamentoScope, id: string, q: DbQueryExecutor = this.db) {
    const r = await q.query<Row>(`${SELECT} WHERE o.id=$1 AND o.group_id=$2 AND o.empresa_id=$3`, [id, s.groupId, s.empresaId]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }

  async create(s: OrcamentoScope, d: OrcamentoWrite, executor?: DbQueryExecutor) {
    return this.runTransaction(executor, async (q) => {
      await q.query('SELECT pg_advisory_xact_lock(hashtext($1))', [s.empresaId]);
      const n = await q.query<{ n: string }>('SELECT COALESCE(MAX(numero::int),0)+1 n FROM orcamentos WHERE empresa_id=$1', [s.empresaId]);
      const numero = String(n.rows[0]?.n ?? '').padStart(8, '0');
      if (!/^\d{8}$/.test(numero)) throw new Error('ORCAMENTO_NUMERO_RESERVATION_FAILED');
      const t = calculateOrcamento(d.itens);
      const h = await q.query<Row>(
        `INSERT INTO orcamentos(
          group_id,empresa_id,numero,cliente_empresa_id,condicao_pagamento_id,
          condicao_pagamento_codigo_snapshot,condicao_pagamento_nome_snapshot,condicao_pagamento_parcelas_snapshot,
          tabela_preco_id,tabela_preco_codigo_snapshot,tabela_preco_nome_snapshot,
          promocao_aplicada,promocao_bps,promocao_cupom,validade_em,observacoes,subtotal,desconto,total
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [
          s.groupId, s.empresaId, numero, d.cliente_empresa_id, d.condicao_pagamento_id,
          d.condicao_pagamento_codigo_snapshot, d.condicao_pagamento_nome_snapshot,
          JSON.stringify(d.condicao_pagamento_parcelas_snapshot),
          d.tabela_preco_id ?? null, d.tabela_preco_codigo_snapshot ?? null, d.tabela_preco_nome_snapshot ?? null,
          Boolean(d.promocao_aplicada), d.promocao_bps ?? null, d.promocao_cupom ?? null,
          d.validade_em, d.observacoes ?? null, t.subtotal, t.desconto, t.total,
        ],
      );
      await this.items(q, s, String(h.rows[0]?.id), d);
      return (await this.get(s, String(h.rows[0]?.id), q))!;
    });
  }

  async update(s: OrcamentoScope, id: string, d: OrcamentoWrite, executor?: DbQueryExecutor) {
    return this.runTransaction(executor, async (q) => {
      const current = await this.get(s, id, q);
      if (!current || current.status !== 'EM_ABERTO') return null;
      const t = calculateOrcamento(d.itens);
      await q.query(
        `UPDATE orcamentos SET
          cliente_empresa_id=$4,condicao_pagamento_id=$5,
          condicao_pagamento_codigo_snapshot=$6,condicao_pagamento_nome_snapshot=$7,condicao_pagamento_parcelas_snapshot=$8::jsonb,
          tabela_preco_id=$9,tabela_preco_codigo_snapshot=$10,tabela_preco_nome_snapshot=$11,
          promocao_aplicada=$12,promocao_bps=$13,promocao_cupom=$14,
          validade_em=$15,observacoes=$16,subtotal=$17,desconto=$18,total=$19
         WHERE id=$1 AND group_id=$2 AND empresa_id=$3`,
        [
          id, s.groupId, s.empresaId, d.cliente_empresa_id, d.condicao_pagamento_id,
          d.condicao_pagamento_codigo_snapshot, d.condicao_pagamento_nome_snapshot,
          JSON.stringify(d.condicao_pagamento_parcelas_snapshot),
          d.tabela_preco_id ?? null, d.tabela_preco_codigo_snapshot ?? null, d.tabela_preco_nome_snapshot ?? null,
          Boolean(d.promocao_aplicada), d.promocao_bps ?? null, d.promocao_cupom ?? null,
          d.validade_em, d.observacoes ?? null, t.subtotal, t.desconto, t.total,
        ],
      );
      await q.query('DELETE FROM orcamento_itens WHERE orcamento_id=$1 AND group_id=$2 AND empresa_id=$3', [id, s.groupId, s.empresaId]);
      await this.items(q, s, id, d);
      return this.get(s, id, q);
    });
  }

  async list(s: OrcamentoScope, limit = 50, offset = 0, executor?: DbQueryExecutor, filters: OrcamentoListFilters = {}) {
    const q = executor ?? this.db;
    const where = `o.group_id=$1 AND o.empresa_id=$2 AND ($3::text IS NULL OR o.numero ILIKE '%'||$3||'%') AND ($4::text IS NULL OR o.status=$4) AND ($5::uuid IS NULL OR o.cliente_empresa_id=$5) AND ($6::timestamptz IS NULL OR o.validade_em >= $6) AND ($7::timestamptz IS NULL OR o.validade_em <= $7)`;
    const fp = [s.groupId, s.empresaId, filters.search || null, filters.status || null, filters.clienteEmpresaId || null, filters.validadeDe || null, filters.validadeAte || null];
    const p = [...fp, Math.min(200, Math.max(1, Math.trunc(limit))), Math.max(0, Math.trunc(offset))];
    const [c, r] = await Promise.all([
      q.query<{ total: number }>(`SELECT count(*)::int total FROM orcamentos o WHERE ${where}`, fp),
      q.query<Row>(`${SELECT} WHERE ${where} ORDER BY o.numero DESC,o.id DESC LIMIT $8 OFFSET $9`, p),
    ]);
    return { rows: r.rows.map(map), total: Number(c.rows[0]?.total ?? 0) };
  }

  async cancel(s: OrcamentoScope, id: string, executor?: DbQueryExecutor) {
    return this.runTransaction(executor, async (q) => {
      const r = await q.query<Row>("UPDATE orcamentos SET status='CANCELADO',ativo=false WHERE id=$1 AND group_id=$2 AND empresa_id=$3 AND status='EM_ABERTO' RETURNING id", [id, s.groupId, s.empresaId]);
      return r.rows[0] ? this.get(s, String(r.rows[0].id), q) : null;
    });
  }
}
