import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresExpedicaoEstoquePort, PostgresExpedicaoPedidoPort } from '../src/integrations/expedicaoPersistentPorts.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);
const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: SEED_IDS.runtimeActorA };
const stock = new PostgresExpedicaoEstoquePort();
const pedido = new PostgresExpedicaoPedidoPort();

test('R11 PostgreSQL real: despacho concorrente/retry, parcial, devolução, cancelamento e rollback atômico',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({
      NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL,
    }));
    const created: { pedidos: string[]; entregas: string[]; romaneios: string[] } = { pedidos: [], entregas: [], romaneios: [] };
    const product = SEED_IDS.produtoA;
    const qty = async () => {
      const row = await db.query<{ quantidade: string }>(
        'SELECT quantidade::text FROM expedicao_estoque_saldos WHERE group_id=$1 AND empresa_id=$2 AND produto_id=$3',
        [scope.groupId, scope.empresaId, product],
      );
      return Number(row.rows[0]?.quantidade ?? 0);
    };
    const movementCount = async (entregaId: string) => Number((await db.query<{ count: string }>(
      'SELECT count(*)::text FROM expedicao_estoque_movimentos WHERE group_id=$1 AND empresa_id=$2 AND entrega_id=$3',
      [scope.groupId, scope.empresaId, entregaId],
    )).rows[0].count);
    const makeLinked = async (ordinal: number) => {
      const customer = await db.query<{ id: string }>(
        'SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo AND habilitado_operacao AND NOT bloqueado LIMIT 1',
        [scope.groupId, scope.empresaId],
      );
      assert.ok(customer.rows[0]);
      const number = String(70000000 + Math.floor(Math.random() * 999999)).slice(0, 8);
      const order = await db.query<{ id: string }>(
        `INSERT INTO pedidos(group_id,empresa_id,numero,status,cliente_empresa_id,condicao_pagamento_id,vendedor_id,
           tipo_operacao,data_entrega_solicitada,subtotal,desconto,total,tipo_comercial,created_by,updated_by)
         VALUES($1,$2,$3,'PRONTO_ENTREGA',$4,$5,$6,'ENTREGA',now()+interval '1 day',20,0,20,'REVENDA',$6,$6) RETURNING id`,
        [scope.groupId, scope.empresaId, number, customer.rows[0].id, SEED_IDS.condicaoPagamentoA, scope.actorId],
      );
      const pedidoId = order.rows[0].id; created.pedidos.push(pedidoId);
      await db.query(
        `INSERT INTO pedido_itens(group_id,empresa_id,pedido_id,produto_id,unidade_id,descricao_snapshot,unidade_snapshot,
          quantidade,preco_unitario,desconto,subtotal,total,requer_producao,tipo_comercial_snapshot)
         VALUES($1,$2,$3,$4,$5,'Produto sintético','UN',2,10,0,20,20,false,'REVENDA')`,
        [scope.groupId, scope.empresaId, pedidoId, product, SEED_IDS.unidadeA],
      );
      const delivery = await db.query<{ id: string }>(
        `INSERT INTO entregas(group_id,empresa_id,numero,status,pedido_id,quantidade_total,volumes,created_by,updated_by)
         VALUES($1,$2,$3,'SAIU_ENTREGA',$4,2,1,$5,$5) RETURNING id`,
        [scope.groupId, scope.empresaId, String(80000000 + ordinal), pedidoId, scope.actorId],
      );
      const entregaId = delivery.rows[0].id; created.entregas.push(entregaId);
      await db.query(
        `INSERT INTO entrega_itens(group_id,empresa_id,entrega_id,produto_id,descricao_snapshot,unidade_snapshot,
          quantidade_pedida,quantidade_separada,created_by,updated_by)
         VALUES($1,$2,$3,$4,'Produto sintético','UN',2,2,$5,$5)`,
        [scope.groupId, scope.empresaId, entregaId, product, scope.actorId],
      );
      const manifest = await db.query<{ id: string }>(
        `INSERT INTO romaneios(group_id,empresa_id,numero,status,data_romaneio,motorista_nome,veiculo,placa,
           entregas_key,quantidade_entregas,checklist_saida_json,created_by,updated_by)
         VALUES($1,$2,$3,'EM_ROTA',current_date,'Sintético','Veículo','SYN0001',$4,1,'{}'::jsonb,$5,$5) RETURNING id`,
        [scope.groupId, scope.empresaId, String(90000000 + ordinal), entregaId, scope.actorId],
      );
      created.romaneios.push(manifest.rows[0].id);
      await db.query('UPDATE entregas SET romaneio_id=$2 WHERE id=$1', [entregaId, manifest.rows[0].id]);
      return { pedidoId, entregaId, romaneioId: manifest.rows[0].id };
    };

    try {
      const migrations = (await db.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((row) => row.id);
      assert.ok(migrations.includes('037_expedicao_estoque_movimentos.sql'), 'CI must apply 037; no silent skip');
      await db.query(
        `INSERT INTO expedicao_estoque_saldos(group_id,empresa_id,produto_id,quantidade)
         VALUES($1,$2,$3,10) ON CONFLICT (group_id,empresa_id,produto_id) DO UPDATE SET quantidade=10`,
        [scope.groupId, scope.empresaId, product],
      );
      const first = await makeLinked(1);
      const dispatch = () => db.withTransaction(async (tx) => {
        await pedido.onDespacho({ ...scope, pedidoIds: [first.pedidoId], romaneioId: first.romaneioId }, tx);
        return stock.onDespacho({ ...scope, entregaIds: [first.entregaId] }, tx);
      });
      assert.deepEqual(await Promise.all([dispatch(), dispatch()]), ['applied', 'applied']);
      assert.equal(await qty(), 8);
      assert.equal(await movementCount(first.entregaId), 1);
      assert.equal(await dispatch(), 'applied');
      assert.equal(await qty(), 8);

      await db.query(`UPDATE entregas SET status='ENTREGUE_PARCIAL' WHERE id=$1`, [first.entregaId]);
      await db.query(`UPDATE entrega_itens SET quantidade_entregue=1,quantidade_devolvida=1 WHERE entrega_id=$1`, [first.entregaId]);
      await db.query(`UPDATE entregas SET status='DEVOLVIDA' WHERE id=$1`, [first.entregaId]);
      await db.withTransaction((tx) => stock.onDevolucao({ ...scope, entregaId: first.entregaId, quantidade: '1.000000' }, tx));
      assert.equal(await qty(), 9);
      assert.equal(await movementCount(first.entregaId), 2);
      await db.withTransaction((tx) => stock.onDevolucao({ ...scope, entregaId: first.entregaId, quantidade: '1.000000' }, tx));
      assert.equal(await qty(), 9);

      await db.query(`UPDATE entregas SET status='CANCELADA',ativo=false WHERE id=$1`, [first.entregaId]);
      await db.withTransaction((tx) => stock.onCancelamento({ ...scope, entregaId: first.entregaId }, tx));
      assert.equal(await qty(), 10, 'cancellation compensates only the unreturned remainder');
      assert.equal(await movementCount(first.entregaId), 3);
      await db.withTransaction((tx) => stock.onCancelamento({ ...scope, entregaId: first.entregaId }, tx));
      assert.equal(await qty(), 10);

      const second = await makeLinked(2);
      await assert.rejects(() => db.withTransaction(async (tx) => {
        await pedido.onDespacho({ ...scope, pedidoIds: [second.pedidoId], romaneioId: second.romaneioId }, tx);
        await stock.onDespacho({ ...scope, entregaIds: [second.entregaId] }, tx);
        throw new Error('synthetic failure after intermediate movement');
      }), /synthetic failure/);
      assert.equal(await qty(), 10);
      assert.equal(await movementCount(second.entregaId), 0);
      await db.withTransaction(async (tx) => {
        await pedido.onDespacho({ ...scope, pedidoIds: [second.pedidoId], romaneioId: second.romaneioId }, tx);
        await stock.onDespacho({ ...scope, entregaIds: [second.entregaId] }, tx);
      });
      assert.equal(await qty(), 8);
      await db.query(`UPDATE entregas SET status='CANCELADA',ativo=false WHERE id=$1`, [second.entregaId]);
      await db.withTransaction(async (tx) => {
        await stock.onCancelamento({ ...scope, entregaId: second.entregaId }, tx);
        await pedido.onCancelamento({ ...scope, pedidoId: second.pedidoId, entregaId: second.entregaId }, tx);
      });
      assert.equal(await qty(), 10);
      assert.equal(await movementCount(second.entregaId), 2);
      await assert.rejects(() => db.withTransaction((tx) => stock.onDespacho({
        ...scope, empresaId: SEED_IDS.empresaA2, entregaIds: [second.entregaId],
      }, tx)), (error: unknown) => (error as { code?: string }).code === 'ENTREGA_NOT_FOUND');
    } finally {
      await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM audit_logs WHERE group_id=$1 AND empresa_id=$2 AND entity IN ($3,$4) AND entity_id = ANY($5::text[])',
          [scope.groupId, scope.empresaId, 'Pedido', 'Estoque', [...created.pedidos, product]]);
        await tx.query('DELETE FROM expedicao_pedido_eventos WHERE pedido_id = ANY($1::uuid[])', [created.pedidos]);
        await tx.query('DELETE FROM expedicao_estoque_movimentos WHERE entrega_id = ANY($1::uuid[])', [created.entregas]);
        await tx.query('DELETE FROM expedicao_estoque_saldos WHERE group_id=$1 AND empresa_id=$2 AND produto_id=$3',
          [scope.groupId, scope.empresaId, product]);
        await tx.query('DELETE FROM entrega_historico WHERE entrega_id = ANY($1::uuid[])', [created.entregas]);
        await tx.query('DELETE FROM entrega_itens WHERE entrega_id = ANY($1::uuid[])', [created.entregas]);
        await tx.query('DELETE FROM romaneio_entregas WHERE romaneio_id = ANY($1::uuid[])', [created.romaneios]);
        await tx.query('UPDATE entregas SET romaneio_id=NULL WHERE id = ANY($1::uuid[])', [created.entregas]);
        await tx.query('DELETE FROM romaneios WHERE id = ANY($1::uuid[])', [created.romaneios]);
        await tx.query('DELETE FROM entregas WHERE id = ANY($1::uuid[])', [created.entregas]);
        await tx.query('DELETE FROM pedido_itens WHERE pedido_id = ANY($1::uuid[])', [created.pedidos]);
        await tx.query('DELETE FROM pedidos WHERE id = ANY($1::uuid[])', [created.pedidos]);
      });
      await db.end();
    }
  });
