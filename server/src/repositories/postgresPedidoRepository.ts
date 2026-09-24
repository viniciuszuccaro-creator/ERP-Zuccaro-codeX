import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { calculatePedido, type Pedido, type PedidoCreate, type PedidoHistorico, type PedidoListFilters, type PedidoRepository, type PedidoScope, type PedidoStatus } from './pedidoTypes.js';

type Row = Record<string, unknown>;
const SELECT = `SELECT p.*,COALESCE((SELECT json_agg(i ORDER BY i.created_at,i.id) FROM pedido_itens i WHERE i.pedido_id=p.id AND i.group_id=p.group_id AND i.empresa_id=p.empresa_id),'[]') itens FROM pedidos p`;
const map = (row: Row): Pedido => ({
  ...(row as unknown as Pedido), id: String(row.id), group_id: String(row.group_id), empresa_id: String(row.empresa_id),
  numero: String(row.numero), cliente_empresa_id: String(row.cliente_empresa_id),
  cliente_local_id: row.cliente_local_id == null ? null : String(row.cliente_local_id),
  obra_id: row.obra_id == null ? null : String(row.obra_id), tabela_preco_id: row.tabela_preco_id == null ? null : String(row.tabela_preco_id),
  condicao_pagamento_id: String(row.condicao_pagamento_id), orcamento_id: row.orcamento_id == null ? null : String(row.orcamento_id),
  vendedor_id: String(row.vendedor_id), ativo: Boolean(row.ativo), subtotal: String(row.subtotal), desconto: String(row.desconto), total: String(row.total),
  created_at: new Date(String(row.created_at)).toISOString(), updated_at: new Date(String(row.updated_at)).toISOString(),
  itens: (Array.isArray(row.itens) ? row.itens : JSON.parse(String(row.itens ?? '[]'))).map((item: Row) => ({
    ...item, id: String(item.id), produto_id: String(item.produto_id), unidade_id: String(item.unidade_id),
    descricao: String(item.descricao_snapshot), unidade_sigla: String(item.unidade_snapshot),
    quantidade: String(item.quantidade), preco_unitario: String(item.preco_unitario), desconto: String(item.desconto),
    subtotal: String(item.subtotal), total: String(item.total), requer_producao: Boolean(item.requer_producao),
  })),
});

export class PostgresPedidoRepository implements PedidoRepository {
  constructor(private readonly db: DbClient) {}
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> { return this.db.withTransaction(fn); }
  private run<T>(executor: DbQueryExecutor | undefined, fn: (query: DbQueryExecutor) => Promise<T>): Promise<T> { return executor ? fn(executor) : this.db.withTransaction(fn); }

  private async insertItems(query: DbQueryExecutor, scope: PedidoScope, pedidoId: string, data: PedidoCreate, actorId: string) {
    const totals = calculatePedido(data.itens);
    for (const item of totals.itens) await query.query(
      'INSERT INTO pedido_itens(group_id,empresa_id,pedido_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,quantidade,preco_unitario,desconto,subtotal,total,requer_producao,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)',
      [scope.groupId, scope.empresaId, pedidoId, item.produto_id, item.unidade_id, item.descricao, item.unidade_sigla, item.quantidade, item.preco_unitario, item.desconto ?? '0', item.subtotal, item.total, item.requer_producao, actorId],
    );
    return totals;
  }

  async get(scope: PedidoScope, id: string, executor: DbQueryExecutor = this.db): Promise<Pedido | null> {
    const result = await executor.query<Row>(`${SELECT} WHERE p.id=$1 AND p.group_id=$2 AND p.empresa_id=$3`, [id, scope.groupId, scope.empresaId]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async getByOrcamento(scope: PedidoScope, orcamentoId: string, executor: DbQueryExecutor = this.db): Promise<Pedido | null> {
    const result = await executor.query<Row>(`${SELECT} WHERE p.orcamento_id=$1 AND p.group_id=$2 AND p.empresa_id=$3`, [orcamentoId, scope.groupId, scope.empresaId]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }

  async create(scope: PedidoScope, data: PedidoCreate, actorId: string, executor?: DbQueryExecutor): Promise<Pedido> {
    return this.run(executor, async (query) => {
      await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pedido:${scope.empresaId}`]);
      const sequence = await query.query<{ next: string }>('SELECT COALESCE(MAX(numero::int),0)+1 next FROM pedidos WHERE empresa_id=$1', [scope.empresaId]);
      const numero = String(sequence.rows[0]?.next ?? '').padStart(8, '0');
      if (!/^\d{8}$/.test(numero)) throw new Error('PEDIDO_NUMERO_RESERVATION_FAILED');
      const totals = calculatePedido(data.itens);
      const inserted = await query.query<{ id: string }>(
        'INSERT INTO pedidos(group_id,empresa_id,numero,cliente_empresa_id,cliente_local_id,obra_id,tabela_preco_id,condicao_pagamento_id,orcamento_id,vendedor_id,tipo_operacao,data_entrega_solicitada,observacoes,subtotal,desconto,total,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$10,$10) RETURNING id',
        [scope.groupId, scope.empresaId, numero, data.cliente_empresa_id, data.cliente_local_id ?? null, data.obra_id ?? null, data.tabela_preco_id ?? null, data.condicao_pagamento_id, data.orcamento_id ?? null, actorId, data.tipo_operacao, data.data_entrega_solicitada, data.observacoes ?? null, totals.subtotal, totals.desconto, totals.total],
      );
      const id = String(inserted.rows[0]?.id);
      await this.insertItems(query, scope, id, data, actorId);
      await query.query('INSERT INTO pedido_historico(group_id,empresa_id,pedido_id,status_anterior,status_novo,actor_id) VALUES($1,$2,$3,NULL,$4,$5)', [scope.groupId, scope.empresaId, id, 'EM_ABERTO', actorId]);
      return (await this.get(scope, id, query))!;
    });
  }

  async list(scope: PedidoScope, limit = 50, offset = 0, executor?: DbQueryExecutor, filters: PedidoListFilters = {}) {
    const query = executor ?? this.db;
    const where = `p.group_id=$1 AND p.empresa_id=$2 AND ($3::text IS NULL OR p.numero ILIKE '%'||$3||'%') AND ($4::text IS NULL OR p.status=$4) AND ($5::uuid IS NULL OR p.cliente_empresa_id=$5) AND ($6::text IS NULL OR p.tipo_operacao=$6)`;
    const filterParams = [scope.groupId, scope.empresaId, filters.search || null, filters.status || null, filters.clienteEmpresaId || null, filters.tipoOperacao || null];
    const params = [...filterParams, Math.min(200, Math.max(1, Math.trunc(limit))), Math.max(0, Math.trunc(offset))];
    const [count, rows] = await Promise.all([
      query.query<{ total: number }>(`SELECT count(*)::int total FROM pedidos p WHERE ${where}`, filterParams),
      query.query<Row>(`${SELECT} WHERE ${where} ORDER BY p.numero DESC,p.id DESC LIMIT $7 OFFSET $8`, params),
    ]);
    return { rows: rows.rows.map(map), total: Number(count.rows[0]?.total ?? 0) };
  }

  async update(scope: PedidoScope, id: string, data: PedidoCreate, actorId: string, executor?: DbQueryExecutor): Promise<Pedido | null> {
    return this.run(executor, async (query) => {
      const current = await this.get(scope, id, query);
      if (!current || current.status !== 'EM_ABERTO') return null;
      const totals = calculatePedido(data.itens);
      await query.query('UPDATE pedidos SET cliente_empresa_id=$4,cliente_local_id=$5,obra_id=$6,tabela_preco_id=$7,condicao_pagamento_id=$8,tipo_operacao=$9,data_entrega_solicitada=$10,observacoes=$11,subtotal=$12,desconto=$13,total=$14,updated_by=$15 WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId, data.cliente_empresa_id, data.cliente_local_id ?? null, data.obra_id ?? null, data.tabela_preco_id ?? null, data.condicao_pagamento_id, data.tipo_operacao, data.data_entrega_solicitada, data.observacoes ?? null, totals.subtotal, totals.desconto, totals.total, actorId]);
      await query.query('DELETE FROM pedido_itens WHERE pedido_id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await this.insertItems(query, scope, id, data, actorId);
      return this.get(scope, id, query);
    });
  }

  async changeStatus(scope: PedidoScope, id: string, status: PedidoStatus, actorId: string, motivo?: string, executor?: DbQueryExecutor): Promise<Pedido | null> {
    return this.run(executor, async (query) => {
      const current = await this.get(scope, id, query);
      if (!current) return null;
      await query.query('UPDATE pedidos SET status=$4,ativo=$5,updated_by=$6 WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId, status, status !== 'CANCELADO', actorId]);
      await query.query('INSERT INTO pedido_historico(group_id,empresa_id,pedido_id,status_anterior,status_novo,actor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7)', [scope.groupId, scope.empresaId, id, current.status, status, actorId, motivo ?? null]);
      return this.get(scope, id, query);
    });
  }

  async history(scope: PedidoScope, id: string, executor?: DbQueryExecutor): Promise<PedidoHistorico[]> {
    const result = await (executor ?? this.db).query<Row>('SELECT * FROM pedido_historico WHERE pedido_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY ordem', [id, scope.groupId, scope.empresaId]);
    return result.rows.map((row) => ({ id: String(row.id), group_id: String(row.group_id), empresa_id: String(row.empresa_id), pedido_id: String(row.pedido_id), status_anterior: row.status_anterior == null ? null : row.status_anterior as PedidoStatus, status_novo: row.status_novo as PedidoStatus, actor_id: String(row.actor_id), motivo: row.motivo == null ? null : String(row.motivo), created_at: new Date(String(row.created_at)).toISOString() }));
  }
}
