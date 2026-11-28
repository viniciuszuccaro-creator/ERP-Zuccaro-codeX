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

test('R09 PostgreSQL real: migration de Pedido e posteriores existem uma vez e constraints tenant permanecem', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresPedidoRepository(db); const ids: string[] = [];
  try {
    const migrations = await db.query<{ id: string; total: number }>('SELECT id,count(*)::int total FROM schema_migrations GROUP BY id ORDER BY id');
    assert.ok(migrations.rows.length >= 19);
    assert.ok(migrations.rows.every((row) => row.total === 1));
    const migrationIds = migrations.rows.map((row) => row.id);
    assert.ok(migrationIds.includes('017_pedidos_comercial_360.sql'));
    assert.ok(migrationIds.includes('018_produto_pim_dam_outbox.sql'));
    assert.ok(migrationIds.indexOf('017_pedidos_comercial_360.sql') < migrationIds.indexOf('018_produto_pim_dam_outbox.sql'));
    assert.ok(migrationIds.includes('019_produto_relacoes_tenant.sql'));
    assert.ok(migrationIds.indexOf('018_produto_pim_dam_outbox.sql') < migrationIds.indexOf('019_produto_relacoes_tenant.sql'));
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

test('R09 PostgreSQL real: chave da criação direta serializa retries concorrentes', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresPedidoRepository(db); const ids: string[] = [];
  try {
    const migrations = await db.query<{ id: string }>("SELECT id FROM schema_migrations WHERE id='044_pedidos_idempotencia_direta.sql'");
    assert.equal(migrations.rows.length, 1);
    const data = { ...(await input(db)), idempotency_key: '77777777-7777-4777-8777-777777777777' };
    const fingerprint = 'a'.repeat(64);
    const attempt = () => repo.withTransaction(async (tx) => {
      await tx!.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [scope.groupId, scope.empresaId]);
      await repo.lockIdempotency(scope, data.idempotency_key, tx);
      const prior = await repo.getByIdempotencyKey(scope, data.idempotency_key, tx);
      return prior ? prior.row : repo.create(scope, data, SEED_IDS.runtimeActorA, tx, fingerprint);
    });
    const [first, second] = await Promise.all([attempt(), attempt()]);
    ids.push(first.id);
    assert.equal(first.id, second.id);
    const found = await repo.getByIdempotencyKey(scope, data.idempotency_key);
    assert.equal(found?.fingerprint, fingerprint);
    assert.equal(found?.row.id, first.id);
    assert.equal(Object.hasOwn(found!.row, 'idempotency_key'), false);
    assert.equal(Object.hasOwn(found!.row, 'payload_fingerprint'), false);
    assert.equal(await repo.getByIdempotencyKey(other, data.idempotency_key), null);
    assert.deepEqual((await repo.history(scope, first.id)).map(row => row.status_novo), ['EM_ABERTO']);
  } finally { let error: unknown; try { await cleanup(db, ids); } catch (cause) { error = cause; } finally { await db.end(); } if (error) throw error; }
});

test('R09 PostgreSQL real: resumo exato usa filtro completo acima de 200 em uma unica leitura sem escrita', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const repo = new PostgresPedidoRepository(db);
  const rollback = new Error('ROLLBACK_SYNTHETIC_SUMMARY_FIXTURE');
  const ownIds: string[] = [];
  try {
    const original = await input(db);
    const data = { ...original, itens: [{ ...original.itens[0], quantidade: '1.000000', preco_unitario: '0.000001', desconto: '0.000000' }] };
    await assert.rejects(repo.withTransaction(async tx => {
      assert.ok(tx);
      const created: Array<Awaited<ReturnType<typeof repo.create>>> = [];
      for (let i = 0; i < 204; i++) created.push(await repo.create(scope, data, SEED_IDS.runtimeActorA, tx));
      ownIds.push(...created.map(row => row.id));
      await tx.query('UPDATE pedidos SET created_at=$1 WHERE id=ANY($2::uuid[])', ['2040-01-15T12:00:00.000Z', created.map(row => row.id)]);
      await tx.query('UPDATE pedidos SET created_at=$1 WHERE id=$2', ['2040-01-01T00:00:00.000Z', created[0].id]);
      await repo.changeStatus(scope, created[201].id, 'CANCELADO', SEED_IDS.runtimeActorA, 'Synthetic summary exclusion', tx);
      await tx.query('UPDATE pedidos SET created_at=$1 WHERE id=$2', ['2040-02-01T00:00:00.000Z', created[202].id]);
      await tx.query('UPDATE pedidos SET created_at=$1 WHERE id=$2', ['2039-12-31T23:59:59.999Z', created[203].id]);
      const snapshot = async () => (await tx.query(`SELECT
        (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM pedidos p WHERE p.id=ANY($1::uuid[])) AS orders,
        (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM pedido_itens i WHERE i.pedido_id=ANY($1::uuid[])) AS items,
        (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM pedido_historico h WHERE h.pedido_id=ANY($1::uuid[])) AS history,
        (SELECT count(*) FROM audit_logs WHERE entity='Pedido' AND entity_id::text=ANY($1::text[])) AS audits`, [ownIds])).rows[0];
      const before = await snapshot();
      const filters = { periodoInicio: '2040-01-01T00:00:00.000Z', periodoFim: '2040-02-01T00:00:00.000Z',
        excluirCancelados: true, incluirResumo: true };
      let reads = 0;
      const counter = { query: (async (...args: Parameters<typeof tx.query>) => {
        reads++; return tx.query(...args);
      }) as typeof tx.query };
      const page = await repo.list(scope, 1, 0, counter, filters);
      assert.equal(reads, 1);
      assert.equal(page.rows.length, 1);
      assert.equal(page.total, 201);
      assert.deepEqual(page.resumo, { valor_total: '0.000201', ticket_medio: '0.000001' });
      const beyond = await repo.list(scope, 1, 999, tx, filters);
      assert.equal(beyond.rows.length, 0); assert.equal(beyond.total, 201); assert.deepEqual(beyond.resumo, page.resumo);
      const included = await repo.list(scope, 1, 0, tx, { ...filters, excluirCancelados: false });
      assert.equal(included.total, 202); assert.equal(included.resumo?.valor_total, '0.000202');
      const found = await repo.list(scope, 1, 0, tx, { ...filters, search: created[0].numero });
      assert.equal(found.total, 1); assert.equal(found.rows[0].id, created[0].id);
      const foreign = await repo.list(other, 1, 0, tx, filters);
      assert.equal(foreign.total, 0); assert.deepEqual(foreign.resumo, { valor_total: '0.000000', ticket_medio: '0.000000' });
      assert.deepEqual(await snapshot(), before, 'summary must not write business rows, history or audits');
      console.log('PEDIDO_SUMMARY_COMPLETE_201_EXACT_READONLY_VERIFIED');
      throw rollback;
    }), error => error === rollback);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int n FROM pedidos WHERE id=ANY($1::uuid[])', [ownIds])).rows[0].n, 0);
  } finally { await db.end(); }
});
