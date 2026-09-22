import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createDbClient } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);

test('R10 PostgreSQL real: migration 018 preserva PIM, tenant, DAM, RLS e outbox', { skip: !enabled && 'DATABASE_URL not available' }, async () => {
  const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
  const productId = randomUUID();
  const variantId = randomUUID();
  const equivalentId = randomUUID();
  const mediaId = randomUUID();
  const rollbackId = randomUUID();
  const sha = 'a'.repeat(64);
  const rejectSql = async (sql: string, params: unknown[], pattern: RegExp) => {
    await assert.rejects(db.query(sql, params), pattern);
  };
  try {
    const migration = await db.query<{ total: number }>(
      "SELECT count(*)::int total FROM schema_migrations WHERE id='018_produto_pim_dam_outbox.sql'",
    );
    assert.equal(migration.rows[0]?.total, 1);
    const columns = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='produtos'
       AND column_name=ANY($1::text[])`,
      [['descricao_tecnica','descricao_comercial','titulo_seo','descricao_seo','embalagem_tipo','multiplo_venda','quantidade_minima_venda','permite_fracionamento','workflow_status']],
    );
    assert.equal(columns.rowCount, 9);

    await db.query(
      `INSERT INTO produtos (id,group_id,empresa_id,codigo,descricao,multiplo_venda,quantidade_minima_venda,workflow_status)
       VALUES ($1,$2,$3,$4,'R10 SINTETICO',1,0,'RASCUNHO')`,
      [productId, SEED_IDS.groupA, SEED_IDS.empresaA, `R10-${productId}`],
    );
    await rejectSql('UPDATE produtos SET multiplo_venda=0 WHERE id=$1', [productId], /check constraint/i);
    await rejectSql('UPDATE produtos SET quantidade_minima_venda=-1 WHERE id=$1', [productId], /check constraint/i);
    await rejectSql("UPDATE produtos SET workflow_status='INVALIDO' WHERE id=$1", [productId], /check constraint/i);

    await db.query(
      `INSERT INTO produto_variantes (id,group_id,empresa_id,produto_id,sku)
       VALUES ($1,$2,$3,$4,$5)`,
      [variantId, SEED_IDS.groupA, SEED_IDS.empresaA, productId, `SKU-${productId}`],
    );
    await rejectSql(
      'INSERT INTO produto_variantes (group_id,empresa_id,produto_id,sku) VALUES ($1,$2,$3,$4)',
      [SEED_IDS.groupA, SEED_IDS.empresaA, SEED_IDS.produtoB, `XG-${productId}`],
      /TENANT_FK_MISMATCH/,
    );
    await rejectSql(
      'INSERT INTO produto_variantes (group_id,empresa_id,produto_id,sku) VALUES ($1,$2,$3,$4)',
      [SEED_IDS.groupA, SEED_IDS.empresaB, productId, `XE-${productId}`],
      /empresa|group|TENANT/i,
    );
    await rejectSql(
      'INSERT INTO produto_variantes (group_id,empresa_id,produto_id,sku) VALUES ($1,$2,$3,$4)',
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId, `SKU-${productId}`],
      /unique constraint/i,
    );

    await db.query(
      `INSERT INTO produto_equivalentes (id,group_id,empresa_id,produto_id,produto_equivalente_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [equivalentId, SEED_IDS.groupA, SEED_IDS.empresaA, productId, SEED_IDS.produtoA],
    );
    await rejectSql(
      'INSERT INTO produto_equivalentes (group_id,empresa_id,produto_id,produto_equivalente_id) VALUES ($1,$2,$3,$4)',
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId, SEED_IDS.produtoB],
      /TENANT_FK_MISMATCH/,
    );
    await rejectSql(
      'INSERT INTO produto_equivalentes (group_id,empresa_id,produto_id,produto_equivalente_id) VALUES ($1,$2,$3,$3)',
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId],
      /check constraint/i,
    );

    await db.query(
      `INSERT INTO produto_midias (id,group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,tamanho_bytes,sha256,principal)
       VALUES ($1,$2,$3,$4,$5,'IMAGEM','r10.png','image/png',128,$6,true)`,
      [mediaId, SEED_IDS.groupA, SEED_IDS.empresaA, productId, `r10/${productId}`, sha],
    );
    await rejectSql(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,tamanho_bytes,sha256)
       VALUES ($1,$2,$3,$4,'IMAGEM','x.png','image/png',1,$5)`,
      [SEED_IDS.groupA, SEED_IDS.empresaA, SEED_IDS.produtoB, `xg/${productId}`, sha],
      /TENANT_FK_MISMATCH/,
    );
    await rejectSql(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,tamanho_bytes,sha256)
       VALUES ($1,$2,$3,$4,'IMAGEM','x.png','image/png',1,'invalido')`,
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId, `sha/${productId}`],
      /check constraint/i,
    );
    await rejectSql(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,tamanho_bytes,sha256)
       VALUES ($1,$2,$3,$4,'IMAGEM','x.png','image/png',0,$5)`,
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId, `size/${productId}`, sha],
      /check constraint/i,
    );
    await rejectSql(
      `INSERT INTO produto_midias (group_id,empresa_id,produto_id,storage_key,categoria,nome_arquivo,mime_type,tamanho_bytes,sha256,principal)
       VALUES ($1,$2,$3,$4,'IMAGEM','main.png','image/png',1,$5,true)`,
      [SEED_IDS.groupA, SEED_IDS.empresaA, productId, `main/${productId}`, sha],
      /unique constraint/i,
    );

    const rls = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname=ANY($1::text[])`,
      [['produto_variantes','produto_equivalentes','produto_midias']],
    );
    assert.equal(rls.rowCount, 3);
    assert.ok(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    const privileges = await db.query<{ allowed: boolean }>(
      `SELECT has_table_privilege('public',name,'SELECT,INSERT,UPDATE,DELETE') allowed
       FROM unnest($1::text[]) name`,
      [['produto_variantes','produto_equivalentes','produto_midias']],
    );
    assert.ok(privileges.rows.every((row) => !row.allowed));

    await rejectSql(
      `INSERT INTO integration_events (source,event_type,payload,attempts,max_attempts)
       VALUES ('R10','invalid','{}'::jsonb,2,1)`,
      [],
      /check constraint/i,
    );
    await assert.rejects(
      db.withTransaction(async (tx) => {
        await tx.query(
          'INSERT INTO produto_variantes (id,group_id,empresa_id,produto_id,sku) VALUES ($1,$2,$3,$4,$5)',
          [rollbackId, SEED_IDS.groupA, SEED_IDS.empresaA, productId, `RB-${productId}`],
        );
        throw new Error('R10_ROLLBACK');
      }),
      /R10_ROLLBACK/,
    );
    const rollback = await db.query('SELECT id FROM produto_variantes WHERE id=$1 AND group_id=$2', [rollbackId, SEED_IDS.groupA]);
    assert.equal(rollback.rowCount, 0);
  } finally {
    let cleanupError: unknown;
    try {
      await db.withTransaction(async (tx) => {
        await tx.query('DELETE FROM produto_midias WHERE id=$1 AND group_id=$2', [mediaId, SEED_IDS.groupA]);
        await tx.query('DELETE FROM produto_equivalentes WHERE id=$1 AND group_id=$2', [equivalentId, SEED_IDS.groupA]);
        await tx.query('DELETE FROM produto_variantes WHERE id=$1 AND group_id=$2', [variantId, SEED_IDS.groupA]);
        await tx.query('DELETE FROM produtos WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [productId, SEED_IDS.groupA, SEED_IDS.empresaA]);
      });
    } catch (error) { cleanupError = error; }
    finally { await db.end(); }
    if (cleanupError) throw cleanupError;
  }
});
