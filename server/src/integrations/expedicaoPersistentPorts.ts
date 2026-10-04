import { AppError } from '../api/errors.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ExpedicaoEstoquePort, ExpedicaoPedidoSideEffectPort } from '../repositories/expedicaoTypes.js';

type Scope = { groupId: string; empresaId: string; actorId?: string };
type Item = { id: string; produto_id: string | null; quantidade_separada: string; quantidade_devolvida: string };

function requiredExecutor(executor: DbQueryExecutor | undefined, actorId: string | undefined): DbQueryExecutor {
  if (!executor || !actorId) throw new AppError(503, 'EXPEDICAO_TRANSACTION_REQUIRED', 'Shared transaction and actor are required');
  return executor;
}

function micros(value: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new AppError(422, 'ESTOQUE_QTY_INVALID', 'Invalid stock quantity');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

function decimal(value: bigint): string {
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, '0')}`;
}

async function audit(query: DbQueryExecutor, scope: Scope, entity: string, entityId: string,
  action: string, after: Record<string, unknown>) {
  await query.query(
    'INSERT INTO audit_logs(group_id,empresa_id,actor_id,entity,entity_id,action,after_data) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
    [scope.groupId, scope.empresaId, scope.actorId, entity, entityId, action, JSON.stringify(after)],
  );
}

async function linkedPedido(query: DbQueryExecutor, scope: Scope, pedidoId: string) {
  const result = await query.query<{ id: string; status: string }>(
    'SELECT id,status FROM pedidos WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR UPDATE',
    [pedidoId, scope.groupId, scope.empresaId],
  );
  const row = result.rows[0];
  if (!row || !['EM_ABERTO', 'EM_PRODUCAO', 'PRONTO_ENTREGA'].includes(row.status)) {
    throw new AppError(409, 'PEDIDO_EXPEDICAO_STATE_CONFLICT', 'Pedido is not eligible for expedition');
  }
}

async function pedidoEvent(query: DbQueryExecutor, scope: Scope, pedidoId: string, entregaId: string,
  romaneioId: string | null, tipo: 'SEPARACAO' | 'DESPACHO' | 'CANCELAMENTO') {
  await linkedPedido(query, scope, pedidoId);
  const inserted = await query.query<{ id: string }>(
    `INSERT INTO expedicao_pedido_eventos(group_id,empresa_id,pedido_id,entrega_id,romaneio_id,tipo,actor_id)
     VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (group_id,empresa_id,pedido_id,entrega_id,tipo) DO NOTHING RETURNING id`,
    [scope.groupId, scope.empresaId, pedidoId, entregaId, romaneioId, tipo, scope.actorId],
  );
  if (inserted.rows[0]) await audit(query, scope, 'Pedido', pedidoId, 'expedicao_' + tipo.toLowerCase(),
    { entrega_id: entregaId, romaneio_id: romaneioId, tipo });
}

/** Event bridge: no invented Pedido status; all writes share Expedicao's transaction. */
export class PostgresExpedicaoPedidoPort implements ExpedicaoPedidoSideEffectPort {
  async onSeparacaoConcluida(input: Scope & { pedidoId: string | null; entregaId: string }, executor?: DbQueryExecutor) {
    if (!input.pedidoId) return 'reserved' as const;
    const query = requiredExecutor(executor, input.actorId);
    await pedidoEvent(query, input, input.pedidoId, input.entregaId, null, 'SEPARACAO');
    return 'applied' as const;
  }
  async onDespacho(input: Scope & { pedidoIds: string[]; romaneioId: string }, executor?: DbQueryExecutor) {
    if (input.pedidoIds.length === 0) return 'reserved' as const;
    const query = requiredExecutor(executor, input.actorId);
    for (const pedidoId of [...new Set(input.pedidoIds)].sort()) {
      const delivery = await query.query<{ id: string }>(
        'SELECT id FROM entregas WHERE group_id=$1 AND empresa_id=$2 AND pedido_id=$3 AND romaneio_id=$4',
        [input.groupId, input.empresaId, pedidoId, input.romaneioId],
      );
      if (delivery.rows.length !== 1) throw new AppError(409, 'PEDIDO_ENTREGA_LINK_INVALID', 'Pedido/Entrega link is not unique');
      await pedidoEvent(query, input, pedidoId, delivery.rows[0].id, input.romaneioId, 'DESPACHO');
    }
    return 'applied' as const;
  }
  async onCancelamento(input: Scope & { pedidoId: string | null; entregaId: string }, executor?: DbQueryExecutor) {
    if (!input.pedidoId) return 'reserved' as const;
    const query = requiredExecutor(executor, input.actorId);
    await pedidoEvent(query, input, input.pedidoId, input.entregaId, null, 'CANCELAMENTO');
    return 'applied' as const;
  }
}

async function deliveryItems(query: DbQueryExecutor, scope: Scope, entregaId: string) {
  const delivery = await query.query<{ id: string; pedido_id: string | null; status: string; romaneio_id: string | null }>(
    'SELECT id,pedido_id,status,romaneio_id FROM entregas WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR UPDATE',
    [entregaId, scope.groupId, scope.empresaId],
  );
  if (!delivery.rows[0]) throw new AppError(404, 'ENTREGA_NOT_FOUND', 'Entrega not found');
  const items = await query.query<Item>(
    'SELECT id,produto_id,quantidade_separada::text,quantidade_devolvida::text FROM entrega_itens WHERE entrega_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY produto_id,id FOR UPDATE',
    [entregaId, scope.groupId, scope.empresaId],
  );
  return { delivery: delivery.rows[0], items: items.rows };
}

async function movement(query: DbQueryExecutor, scope: Scope, entregaId: string, item: Item,
  kind: 'DESPACHO' | 'DEVOLUCAO' | 'CANCELAMENTO', quantity: string, romaneioId: string | null) {
  if (!item.produto_id || micros(quantity) <= 0n) throw new AppError(422, 'ESTOQUE_ITEM_INVALID', 'Stock movement requires product and positive quantity');
  const prior = await query.query<{ quantidade: string }>(
    'SELECT quantidade::text FROM expedicao_estoque_movimentos WHERE group_id=$1 AND empresa_id=$2 AND entrega_item_id=$3 AND tipo=$4',
    [scope.groupId, scope.empresaId, item.id, kind],
  );
  if (prior.rows[0]) {
    if (micros(prior.rows[0].quantidade) !== micros(quantity))
      throw new AppError(409, 'ESTOQUE_RETRY_CONFLICT', 'Movement replay differs from stored quantity');
    return;
  }
  if (kind !== 'DESPACHO') {
    const outbound = await query.query<{ quantidade: string }>(
      'SELECT quantidade::text FROM expedicao_estoque_movimentos WHERE group_id=$1 AND empresa_id=$2 AND entrega_item_id=$3 AND tipo=$4',
      [scope.groupId, scope.empresaId, item.id, 'DESPACHO'],
    );
    if (!outbound.rows[0] || micros(quantity) > micros(outbound.rows[0].quantidade))
      throw new AppError(409, 'ESTOQUE_COMPENSACAO_INVALIDA', 'Return exceeds dispatched quantity');
  }
  const delta = kind === 'DESPACHO' ? -1 : 1;
  const updated = await query.query<{ quantidade: string }>(
    `UPDATE expedicao_estoque_saldos SET quantidade=quantidade+($4::numeric*$5),updated_at=timezone('utc',now())
     WHERE group_id=$1 AND empresa_id=$2 AND produto_id=$3 AND quantidade+($4::numeric*$5)>=0 RETURNING quantidade::text`,
    [scope.groupId, scope.empresaId, item.produto_id, quantity, delta],
  );
  if (!updated.rows[0]) throw new AppError(409, 'ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE', 'Stock baseline is missing or insufficient');
  await query.query(
    `INSERT INTO expedicao_estoque_movimentos(group_id,empresa_id,produto_id,entrega_id,entrega_item_id,romaneio_id,tipo,quantidade,actor_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [scope.groupId, scope.empresaId, item.produto_id, entregaId, item.id, romaneioId, kind, quantity, scope.actorId],
  );
  await audit(query, scope, 'Estoque', item.produto_id, kind.toLowerCase(),
    { entrega_id: entregaId, entrega_item_id: item.id, quantidade: quantity, tipo: kind });
}

/** Operational ledger is opt-in. Missing reconciled opening balances fail closed. */
export class PostgresExpedicaoEstoquePort implements ExpedicaoEstoquePort {
  async onDespacho(input: Scope & { entregaIds: string[] }, executor?: DbQueryExecutor) {
    if (input.entregaIds.length === 0) return 'reserved' as const;
    const query = requiredExecutor(executor, input.actorId);
    let applied = false;
    for (const entregaId of [...new Set(input.entregaIds)].sort()) {
      const { delivery, items } = await deliveryItems(query, input, entregaId);
      if (!delivery.pedido_id) continue;
      if (delivery.status !== 'SAIU_ENTREGA' || !delivery.romaneio_id || items.length === 0)
        throw new AppError(409, 'ESTOQUE_DESPACHO_STATE_INVALID', 'Delivery is not dispatched');
      for (const item of items) await movement(query, input, entregaId, item, 'DESPACHO', item.quantidade_separada, delivery.romaneio_id);
      applied = true;
    }
    return applied ? 'applied' as const : 'reserved' as const;
  }
  async onDevolucao(input: Scope & { entregaId: string; quantidade: string }, executor?: DbQueryExecutor) {
    const query = requiredExecutor(executor, input.actorId);
    const { delivery, items } = await deliveryItems(query, input, input.entregaId);
    if (!delivery.pedido_id) return 'reserved' as const;
    if (delivery.status !== 'DEVOLVIDA') throw new AppError(409, 'ESTOQUE_DEVOLUCAO_STATE_INVALID', 'Delivery is not returned');
    const returned = items.filter((item) => micros(item.quantidade_devolvida) > 0n);
    if (returned.length === 0 || returned.reduce((sum, item) => sum + micros(item.quantidade_devolvida), 0n) !== micros(input.quantidade))
      throw new AppError(422, 'DEVOLUCAO_ITENS_REQUIRED', 'Return needs exact quantities per item');
    for (const item of returned) await movement(query, input, input.entregaId, item, 'DEVOLUCAO', item.quantidade_devolvida, delivery.romaneio_id);
    return 'applied' as const;
  }
  async onCancelamento(input: Scope & { entregaId: string }, executor?: DbQueryExecutor) {
    const query = requiredExecutor(executor, input.actorId);
    const { delivery, items } = await deliveryItems(query, input, input.entregaId);
    if (!delivery.pedido_id) return 'reserved' as const;
    if (delivery.status !== 'CANCELADA') throw new AppError(409, 'ESTOQUE_CANCEL_STATE_INVALID', 'Delivery is not cancelled');
    for (const item of items) {
      const movements = await query.query<{ tipo: string; quantidade: string }>(
        `SELECT tipo,quantidade::text FROM expedicao_estoque_movimentos
         WHERE group_id=$1 AND empresa_id=$2 AND entrega_item_id=$3 AND tipo IN ('DESPACHO','DEVOLUCAO')`,
        [input.groupId, input.empresaId, item.id],
      );
      const outbound = micros(movements.rows.find((row) => row.tipo === 'DESPACHO')?.quantidade || '0');
      const returned = micros(movements.rows.find((row) => row.tipo === 'DEVOLUCAO')?.quantidade || '0');
      if (returned > outbound) throw new AppError(409, 'ESTOQUE_COMPENSACAO_INVALIDA', 'Return exceeds dispatched quantity');
      if (outbound > returned) await movement(query, input, input.entregaId, item, 'CANCELAMENTO', decimal(outbound - returned), delivery.romaneio_id);
    }
    return 'applied' as const;
  }
}
