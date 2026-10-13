import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient, type DbQueryExecutor } from '../src/db/client.ts';
import { PostgresTabelaPrecoRepository } from '../src/repositories/postgresTabelaPrecoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

test('R07B preço PostgreSQL: Produto fica estável até concluir a mutação de item', {
  skip: !process.env.DATABASE_URL && 'DATABASE_URL not available in this environment',
}, async () => {
  const config = loadConfig({
    NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL,
  });
  const db = createDbClient(config);
  const reader = await db.pool!.connect();
  const writer = await db.pool!.connect();
  try {
    await reader.query('BEGIN');
    await writer.query('BEGIN');
    await reader.query("SELECT set_config('app.group_id',$1,true), set_config('app.empresa_id',$2,true)", [SEED_IDS.groupA, SEED_IDS.empresaA]);
    await writer.query("SELECT set_config('app.group_id',$1,true), set_config('app.empresa_id',$2,true)", [SEED_IDS.groupA, SEED_IDS.empresaA]);
    const executor: DbQueryExecutor = { query: (sql, params) => reader.query(sql, params as never) as never };
    const repo = new PostgresTabelaPrecoRepository(db);
    const selected = await repo.getProdutoUnidadeContext(
      SEED_IDS.groupA, SEED_IDS.empresaA, SEED_IDS.produtoA, SEED_IDS.unidadeA, executor,
    );
    assert.ok(selected?.produtoAtivo && selected.unidadeAtivo);

    // ProdutoService.update usa FOR UPDATE; nao pode reatribuir a linha enquanto
    // a transacao de preco ainda valida e persiste o item.
    await writer.query("SET LOCAL lock_timeout = '250ms'");
    await assert.rejects(
      () => writer.query('SELECT id FROM produtos WHERE group_id=$1 AND id=$2 FOR UPDATE', [SEED_IDS.groupA, SEED_IDS.produtoA]),
      { code: '55P03' },
    );
    await writer.query('ROLLBACK');
    await reader.query('COMMIT');
    await writer.query('BEGIN');
    const unlocked = await writer.query<{ id: string }>(
      'SELECT id FROM produtos WHERE group_id=$1 AND id=$2 FOR UPDATE', [SEED_IDS.groupA, SEED_IDS.produtoA],
    );
    assert.equal(unlocked.rows[0]?.id, SEED_IDS.produtoA);
  } finally {
    await reader.query('ROLLBACK');
    await writer.query('ROLLBACK');
    reader.release();
    writer.release();
    await db.end();
  }
});
