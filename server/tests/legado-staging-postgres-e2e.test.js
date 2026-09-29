import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { prepararLoteStagingLegado } from '../../scripts/legado/staging-scope-gate.mjs';

const DB_NAME = 'erp_restore_isolated_legado_ci';
const groupId = '11111111-1111-4111-8111-111111111111';
const empresaId = '22222222-2222-4222-8222-222222222222';
const evidencia = { tipo: 'documento_fiscal', sha256: 'a'.repeat(64),
  aprovadoPor: '33333333-3333-4333-8333-333333333333', aprovadoEm: '2026-09-29T12:00:00Z' };
const vinculosVerificados = { '001': { groupId, empresaId, comprovado: true, evidencia } };

function assertIsolatedTarget(connectionString, isolatedName, enabled) {
  assert.equal(isolatedName, DB_NAME);
  assert.equal(enabled, '1');
  const url = new URL(connectionString ?? 'postgresql://invalid/');
  assert.equal(url.pathname.slice(1), DB_NAME);
}

test('staging sintetico recusa URL do banco oficial antes de conectar', () => {
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/postgres', DB_NAME, '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/erp_test', DB_NAME, '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/' + DB_NAME, '', '1'));
});

test('staging PostgreSQL sintetico usa apenas banco isolado, transacao e retry', async () => {
  assertIsolatedTarget(process.env.DATABASE_URL, process.env.ISOLATED_DATABASE_NAME,
    process.env.LEGACY_STAGING_SYNTHETIC);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const actual = await client.query('SELECT current_database() AS name');
    assert.equal(actual.rows[0].name, DB_NAME);
    await client.query('BEGIN');
    try {
      await client.query(`CREATE TEMP TABLE legado_staging_sintetico (
        group_id uuid NOT NULL, empresa_id uuid, entidade text NOT NULL,
        codigo_legado text NOT NULL, assinatura text NOT NULL,
        UNIQUE NULLS NOT DISTINCT (group_id, empresa_id, entidade, codigo_legado)
      ) ON COMMIT DROP`);
      const item = { entidade: 'pedido', groupId, empresaId, codigoEmpresaLegado: '001',
        codigoLegado: 'PED-SINT-1', assinaturaOrigem: 'b'.repeat(64) };
      const first = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados });
      assert.equal(first.bloqueado, false);
      assert.equal(first.privados.length, 1);
      const staged = first.privados[0];
      await client.query(`INSERT INTO legado_staging_sintetico
        (group_id, empresa_id, entidade, codigo_legado, assinatura) VALUES ($1,$2,$3,$4,$5)`,
      [staged.groupId, staged.empresaId, staged.entidade, staged.codigoLegado, staged.assinaturaOrigem]);
      const stored = await client.query(`SELECT group_id, empresa_id, entidade, codigo_legado, assinatura
        FROM legado_staging_sintetico WHERE group_id=$1 AND empresa_id=$2`, [groupId, empresaId]);
      assert.equal(stored.rowCount, 1);
      const retry = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados,
        existentes: stored.rows.map((row) => ({ groupId: row.group_id, empresaId: row.empresa_id,
          entidade: row.entidade, codigoLegado: row.codigo_legado, assinaturaOrigem: row.assinatura })) });
      assert.equal(retry.bloqueado, false);
      assert.equal(retry.relatorio.reusos, 1);
      assert.deepEqual(retry.privados, []);
      const foreign = prepararLoteStagingLegado([{ ...item, empresaId: groupId }],
        { autorizado: true, vinculosVerificados });
      assert.equal(foreign.bloqueado, true);
      assert.deepEqual(foreign.privados, []);
      const unchanged = await client.query('SELECT count(*)::int AS total FROM legado_staging_sintetico');
      assert.equal(unchanged.rows[0].total, 1);
      await assert.rejects(client.query(`INSERT INTO legado_staging_sintetico
        (group_id, empresa_id, entidade, codigo_legado, assinatura) VALUES ($1,$2,$3,$4,$5)`,
      [groupId, empresaId, item.entidade, item.codigoLegado, item.assinaturaOrigem]),
      (error) => error.code === '23505');
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
});

test('staging sintetico protege codigo mestre no Grupo e isola codigos das Empresas', async () => {
  assertIsolatedTarget(process.env.DATABASE_URL, process.env.ISOLATED_DATABASE_NAME,
    process.env.LEGACY_STAGING_SYNTHETIC);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, DB_NAME);
    await client.query('BEGIN');
    try {
      await client.query(`CREATE TEMP TABLE legado_staging_sintetico (
        group_id uuid NOT NULL, empresa_id uuid, entidade text NOT NULL,
        codigo_legado text NOT NULL, assinatura text NOT NULL,
        UNIQUE NULLS NOT DISTINCT (group_id, empresa_id, entidade, codigo_legado)
      ) ON COMMIT DROP`);
      const insert = (group, empresa, entidade, codigo, assinatura) => client.query(
        `INSERT INTO legado_staging_sintetico
          (group_id, empresa_id, entidade, codigo_legado, assinatura)
          VALUES ($1,$2,$3,$4,$5)`, [group, empresa, entidade, codigo, assinatura]);
      const master = { entidade: 'cliente', groupId, codigoLegado: 'CLI-SINT-1',
        assinaturaOrigem: 'c'.repeat(64) };
      const first = prepararLoteStagingLegado([master], { autorizado: true });
      assert.equal(first.bloqueado, false);
      assert.equal(first.privados.length, 1);
      await insert(groupId, null, master.entidade, master.codigoLegado, master.assinaturaOrigem);
      const stored = await client.query(`SELECT group_id, empresa_id, entidade, codigo_legado, assinatura
        FROM legado_staging_sintetico WHERE group_id=$1 AND empresa_id IS NULL`, [groupId]);
      assert.equal(stored.rowCount, 1);
      const retry = prepararLoteStagingLegado([master], { autorizado: true,
        existentes: stored.rows.map((row) => ({ groupId: row.group_id, empresaId: row.empresa_id,
          entidade: row.entidade, codigoLegado: row.codigo_legado, assinaturaOrigem: row.assinatura })) });
      assert.equal(retry.bloqueado, false);
      assert.equal(retry.relatorio.reusos, 1);
      assert.deepEqual(retry.privados, []);
      await client.query('SAVEPOINT duplicate_master');
      await assert.rejects(insert(groupId, null, master.entidade, master.codigoLegado,
        master.assinaturaOrigem), (error) => error.code === '23505');
      await client.query('ROLLBACK TO SAVEPOINT duplicate_master');
      await insert(groupId, empresaId, 'pedido', 'PED-SINT-SHARED', 'd'.repeat(64));
      await insert(groupId, '44444444-4444-4444-8444-444444444444', 'pedido',
        'PED-SINT-SHARED', 'e'.repeat(64));
      const count = await client.query('SELECT count(*)::int AS total FROM legado_staging_sintetico');
      assert.equal(count.rows[0].total, 3);
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
});
