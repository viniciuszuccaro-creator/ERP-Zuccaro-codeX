import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { PostgresProdutoRepository } from '../src/repositories/postgresProdutoRepository.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);

test('R10 PostgreSQL real: rascunho por canal respeita tenant, SKU, RLS e rollback',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
    const first = randomUUID();
    const second = randomUUID();
    const channelId = randomUUID();
    const sku = `SKU-${randomUUID()}`;
    try {
      const migration = await db.query<{ total: number }>(
        "SELECT count(*)::int AS total FROM schema_migrations WHERE id='024_produto_canais_rascunho.sql'",
      );
      assert.equal(migration.rows[0]?.total, 1);
      const rls = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='produto_canais'::regclass",
      );
      assert.deepEqual(rls.rows[0], { relrowsecurity: true, relforcerowsecurity: true });
      await assert.rejects(db.withTransaction(async (tx) => {
        const product = (id: string) => tx.query(
          "INSERT INTO produtos (id,group_id,empresa_id,codigo,descricao) VALUES ($1,$2,$3,$4,'R10 CANAL SINTETICO')",
          [id, SEED_IDS.groupA, SEED_IDS.empresaA, `R10-${id}`],
        );
        await product(first);
        await product(second);
        const insert = (id: string, groupId: string, empresaId: string, produtoId: string, code: string, status = 'RASCUNHO') =>
          tx.query('INSERT INTO produto_canais (id,group_id,empresa_id,produto_id,canal,sku,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [id, groupId, empresaId, produtoId, 'site_cpa', code, status]);
        await insert(channelId, SEED_IDS.groupA, SEED_IDS.empresaA, first, sku);
        const row = await tx.query<{ status: string; sku: string }>(
          'SELECT status,sku FROM produto_canais WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
          [channelId, SEED_IDS.groupA, SEED_IDS.empresaA],
        );
        assert.equal(row.rows[0]?.status, 'RASCUNHO');
        assert.equal(row.rows[0]?.sku, sku);
        const rejected = async (run: () => Promise<unknown>, pattern: RegExp) => {
          await tx.query('SAVEPOINT rejected_channel');
          await assert.rejects(run(), pattern);
          await tx.query('ROLLBACK TO SAVEPOINT rejected_channel');
          await tx.query('RELEASE SAVEPOINT rejected_channel');
        };
        await rejected(() => insert(randomUUID(), SEED_IDS.groupA, SEED_IDS.empresaA, first, sku), /unique constraint/i);
        await rejected(() => insert(randomUUID(), SEED_IDS.groupA, SEED_IDS.empresaA, second, sku.toLowerCase()), /unique constraint/i);
        await rejected(() => insert(randomUUID(), SEED_IDS.groupA, SEED_IDS.empresaA2, first, 'OTHER'), /TENANT_FK_MISMATCH/);
        await rejected(() => insert(randomUUID(), SEED_IDS.groupB, SEED_IDS.empresaB, first, 'OTHER'), /TENANT_FK_MISMATCH/);
        await rejected(() => insert(randomUUID(), SEED_IDS.groupB, SEED_IDS.empresaA, first, 'OTHER'), /TENANT_MISMATCH/);
        await rejected(() => insert(randomUUID(), SEED_IDS.groupA, SEED_IDS.empresaA, second, 'OTHER', 'PUBLICADO'), /check constraint/i);
        throw new Error('ROLLBACK_CHANNEL_SYNTHETIC');
      }), /ROLLBACK_CHANNEL_SYNTHETIC/);
      const remaining = await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM produto_canais WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [channelId, SEED_IDS.groupA, SEED_IDS.empresaA],
      );
      assert.equal(remaining.rows[0]?.total, 0);
    } finally {
      await db.end();
    }
  });

test('R10 PostgreSQL real: repository CRUD de canal usa tenant e mesma transacao',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
    const repo = new PostgresProdutoRepository(db);
    const produtoId = randomUUID();
    const actorId = randomUUID();
    const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA };
    const sku = `R10-${randomUUID()}`;
    try {
      await assert.rejects(db.withTransaction(async (tx) => {
        await tx.query(
          "INSERT INTO produtos (id,group_id,empresa_id,codigo,descricao) VALUES ($1,$2,$3,$4,'R10 CANAL REPO SINTETICO')",
          [produtoId, scope.groupId, scope.empresaId, sku],
        );
        const created = await repo.createCanal(scope, produtoId, { canal: 'site_cpa', sku, nome: 'Teste' }, actorId, tx);
        assert.equal(created.status, 'RASCUNHO');
        assert.equal(created.empresa_id, scope.empresaId);
        assert.equal((await repo.listCanais(scope, produtoId, tx))[0]?.id, created.id);
        assert.deepEqual(await repo.listCanais({ groupId: scope.groupId, empresaId: SEED_IDS.empresaA2 }, produtoId, tx), []);
        const updated = await repo.updateCanal(scope, produtoId, created.id, { nome: 'Revisado' }, actorId, tx);
        assert.equal(updated?.nome, 'Revisado');
        assert.equal(updated?.sku, sku);
        const deactivated = await repo.deactivateCanal(scope, produtoId, created.id, actorId, tx);
        assert.equal(deactivated?.ativo, false);
        assert.deepEqual(await repo.listCanais(scope, produtoId, tx), []);
        throw new Error('ROLLBACK_CANAL_REPO_SYNTHETIC');
      }), /ROLLBACK_CANAL_REPO_SYNTHETIC/);
      const remaining = await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM produto_canais WHERE produto_id=$1 AND group_id=$2 AND empresa_id=$3',
        [produtoId, scope.groupId, scope.empresaId],
      );
      assert.equal(remaining.rows[0]?.total, 0);
    } finally {
      await db.end();
    }
  });
