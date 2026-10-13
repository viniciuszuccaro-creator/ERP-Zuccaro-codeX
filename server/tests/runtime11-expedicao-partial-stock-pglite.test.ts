import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { DbQueryExecutor } from '../src/db/client.ts';
import { PostgresExpedicaoEstoquePort, PostgresExpedicaoPedidoPort } from '../src/integrations/expedicaoPersistentPorts.ts';
import { quantityMicros } from '../src/repositories/expedicaoTypes.ts';

test('R11 PGlite: item A debitado, item B falha, transação compensa e retry não duplica efeitos', async () => {
  const pg = new PGlite();
  const scope = { groupId: 'g', empresaId: 'e', actorId: 'u' };
  const pedidoId = 'pedido-1';
  const entregaId = 'entrega-1';
  const romaneioId = 'romaneio-1';
  const stock = new PostgresExpedicaoEstoquePort();
  const pedido = new PostgresExpedicaoPedidoPort();
  const tx = <T>(fn: (executor: DbQueryExecutor) => Promise<T>) => pg.transaction((executor) => fn({
    query: (sql, params) => executor.query(sql, params as never) as never,
  }));
  try {
    await pg.exec(`
      CREATE TABLE pedidos (id text PRIMARY KEY, group_id text, empresa_id text, status text);
      CREATE TABLE entregas (id text PRIMARY KEY, group_id text, empresa_id text, pedido_id text, status text, romaneio_id text);
      CREATE TABLE entrega_itens (id text PRIMARY KEY, entrega_id text, group_id text, empresa_id text,
        produto_id text, quantidade_separada numeric, quantidade_devolvida numeric DEFAULT 0);
      CREATE TABLE expedicao_estoque_saldos (group_id text, empresa_id text, produto_id text,
        quantidade numeric, updated_at timestamptz, PRIMARY KEY(group_id,empresa_id,produto_id));
      CREATE TABLE expedicao_estoque_movimentos (group_id text, empresa_id text, produto_id text,
        entrega_id text, entrega_item_id text, romaneio_id text, tipo text, quantidade numeric, actor_id text);
      CREATE TABLE expedicao_pedido_eventos (id text DEFAULT gen_random_uuid()::text, group_id text,
        empresa_id text, pedido_id text, entrega_id text, romaneio_id text, tipo text, actor_id text,
        UNIQUE(group_id,empresa_id,pedido_id,entrega_id,tipo));
      CREATE TABLE audit_logs (group_id text, empresa_id text, actor_id text, entity text,
        entity_id text, action text, after_data jsonb);
      INSERT INTO pedidos VALUES ('pedido-1','g','e','PRONTO_ENTREGA');
      INSERT INTO entregas VALUES ('entrega-1','g','e','pedido-1','SAIU_ENTREGA','romaneio-1');
      INSERT INTO entrega_itens VALUES ('item-a','entrega-1','g','e','produto-a',1.250000,0),
        ('item-b','entrega-1','g','e','produto-b',0.750000,0);
      INSERT INTO expedicao_estoque_saldos VALUES ('g','e','produto-a',2,null),('g','e','produto-b',0,null);
    `);
    const quantity = async (product: string) => quantityMicros((await pg.query<{ quantidade: string }>(
      'SELECT quantidade::text FROM expedicao_estoque_saldos WHERE group_id=$1 AND empresa_id=$2 AND produto_id=$3',
      ['g', 'e', product])).rows[0].quantidade);
    const count = async (table: string) => Number((await pg.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ${table}`)).rows[0].total);
    const dispatch = () => tx(async (executor) => {
      await pedido.onDespacho({ ...scope, pedidoIds: [pedidoId], romaneioId }, executor);
      return stock.onDespacho({ ...scope, entregaIds: [entregaId] }, executor);
    });
    await assert.rejects(dispatch, (error: unknown) =>
      (error as { code?: string }).code === 'ESTOQUE_BASELINE_OR_SALDO_INSUFICIENTE');
    assert.equal(await quantity('produto-a'), 2_000_000n, 'first item debit must roll back');
    assert.equal(await count('expedicao_estoque_movimentos'), 0);
    assert.equal(await count('expedicao_pedido_eventos'), 0, 'Pedido effect must not outlive failed stock');
    assert.equal(await count('audit_logs'), 0, 'failed attempt must not leave audit side effects');

    await pg.query(`UPDATE expedicao_estoque_saldos SET quantidade=1 WHERE produto_id='produto-b'`);
    assert.equal(await dispatch(), 'applied');
    assert.equal(await quantity('produto-a'), 750_000n);
    assert.equal(await quantity('produto-b'), 250_000n);
    assert.equal(await count('expedicao_estoque_movimentos'), 2);
    assert.equal(await count('expedicao_pedido_eventos'), 1);
    assert.equal(await dispatch(), 'applied');
    assert.equal(await count('expedicao_estoque_movimentos'), 2, 'retry cannot debit twice');

    await pg.query(`UPDATE entregas SET status='CANCELADA' WHERE id=$1`, [entregaId]);
    await tx(async (executor) => {
      await stock.onCancelamento({ ...scope, entregaId }, executor);
      await pedido.onCancelamento({ ...scope, pedidoId, entregaId }, executor);
    });
    assert.equal(await quantity('produto-a'), 2_000_000n);
    assert.equal(await quantity('produto-b'), 1_000_000n);
    assert.equal(await count('expedicao_estoque_movimentos'), 4);
    await tx(async (executor) => {
      await stock.onCancelamento({ ...scope, entregaId }, executor);
      await pedido.onCancelamento({ ...scope, pedidoId, entregaId }, executor);
    });
    assert.equal(await count('expedicao_estoque_movimentos'), 4, 'compensation retry cannot credit twice');
  } finally {
    await pg.close();
  }
});
