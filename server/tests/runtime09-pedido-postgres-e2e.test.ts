import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);
const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA };
const other = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA2 };

async function cleanup(db: ReturnType<typeof createDbClient>, ids: string[]) {
  if (!ids.length) return;
  await db.withTransaction(async (tx) => {
    await tx.query('DELETE FROM pedido_historico WHERE pedido_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [ids, scope.groupId, scope.empresaId]);
    await tx.query('DELETE FROM pedido_itens WHERE pedido_id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [ids, scope.groupId, scope.empresaId]);
    await tx.query('DELETE FROM pedidos WHERE id = ANY($1::uuid[]) AND group_id=$2 AND empresa_id=$3', [ids, scope.groupId, scope.empresaId]);
  });
}

async function input(db: ReturnType<typeof createDbClient>) {
  const client = await db.query<{ id: string }>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 AND ativo AND habilitado_operacao AND NOT bloqueado LIMIT 1', [scope.groupId, scope.empresaId]);
  assert.ok(client.rows[0]?.id);
  return {
    cliente_empresa_id: client.rows[0].id,
    condicao_pagamento_id: SEED_IDS.condicaoPagamentoA,
    tipo_operacao: 'ENTREGA' as const,
    data_entrega_solicitada: '2027-03-10T00:00:00.000Z',
    observacoes: 'R09 sintetico',
    itens: [{ produto_id: SEED_IDS.produtoA, unidade_id: SEED_IDS.unidadeA, descricao: 'R09 produto sintetico', unidade_sigla: 'UN', quantidade: '2.000000', preco_unitario: '10.000000', desconto: '1.000000', requer_producao: true }],
  };
}

test('R09 PostgreSQL real: migrations 001-017 existem uma vez e Pedido preserva constraints tenant', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresPedidoRepository(db); const ids: string[] = [];
  try {
    const migrations = await db.query<{ id: string; total: number }>('SELECT id,count(*)::int total FROM schema_migrations GROUP BY id ORDER BY id');
    assert.equal(migrations.rows.length, 17); assert.ok(migrations.rows.every((row) => row.total === 1)); assert.equal(migrations.rows.at(-1)?.id, '017_pedidos_comercial_360.sql');
    const data = await input(db); const created = await repo.create(scope, data, SEED_IDS.runtimeActorA); ids.push(created.id);
    assert.match(created.numero, /^\d{8}$/); assert.equal(created.total, '19.000000'); assert.equal(created.itens[0].descricao, 'R09 produto sintetico');
    assert.equal(await repo.get(other, created.id), null);
    const listed = await repo.list(scope, 1, 0, undefined, { search: created.numero, status: 'EM_ABERTO' }); assert.equal(listed.total, 1); assert.equal(listed.rows[0].id, created.id);
    const updated = await repo.update(scope, created.id, { ...data, itens: [{ ...data.itens[0], quantidade: '3.000000' }] }, SEED_IDS.runtimeActorA);
    assert.equal(updated?.numero, created.numero); assert.equal(updated?.total, '29.000000'); assert.equal(updated?.itens.length, 1);
    await repo.changeStatus(scope, created.id, 'EM_PRODUCAO', SEED_IDS.runtimeActorA, 'R09 fluxo sintetico');
    assert.deepEqual((await repo.history(scope, created.id)).map((row) => row.status_novo), ['EM_ABERTO', 'EM_PRODUCAO']);
    const constraints = await db.query<{ name: string }>("SELECT conname name FROM pg_constraint WHERE conrelid='pedidos'::regclass AND contype='u'");
    assert.ok(constraints.rows.some((row) => row.name === 'pedidos_empresa_id_numero_key'));
    assert.ok(constraints.rows.some((row) => row.name === 'pedidos_empresa_id_orcamento_id_key'));
  } finally { let error: unknown; try { await cleanup(db, ids); } catch (cause) { error = cause; } finally { await db.end(); } if (error) throw error; }
});

test('R09 PostgreSQL real: sequencia concorrente na empresa nao colide', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresPedidoRepository(db); const ids: string[] = [];
  try {
    const data = await input(db); const [first, second] = await Promise.all([repo.create(scope, data, SEED_IDS.runtimeActorA), repo.create(scope, data, SEED_IDS.runtimeActorA)]); ids.push(first.id, second.id);
    assert.notEqual(first.numero, second.numero); assert.equal(Math.abs(Number(first.numero) - Number(second.numero)), 1);
    assert.equal((await repo.list(scope, 200, 0)).rows.filter((row) => ids.includes(row.id)).length, 2);
  } finally { let error: unknown; try { await cleanup(db, ids); } catch (cause) { error = cause; } finally { await db.end(); } if (error) throw error; }
});
