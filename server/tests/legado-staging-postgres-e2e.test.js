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
        UNIQUE (group_id, empresa_id, entidade, codigo_legado)
      ) ON COMMIT DROP`);
      const item = { entidade: 'pedido', groupId, empresaId, codigoEmpresaLegado: '001',
        codigoLegado: 'PED-SINT-1', assinaturaOrigem: 'b'.repeat(64) };
      const first = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados });
      assert.equal(first.bloqueado, false);
      assert.equal(first.privados.length, 1);
      await client.query(`INSERT INTO legado_staging_sintetico
        (group_id, empresa_id, entidade, codigo_legado, assinatura) VALUES ($1,$2,$3,$4,$5)`,
      [groupId, empresaId, item.entidade, item.codigoLegado, item.assinaturaOrigem]);
      const stored = await client.query('SELECT count(*)::int AS total FROM legado_staging_sintetico WHERE group_id=$1 AND empresa_id=$2', [groupId, empresaId]);
      assert.equal(stored.rows[0].total, 1);
      const retry = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados,
        existentes: [{ ...item }] });
      assert.equal(retry.bloqueado, false);
      assert.equal(retry.relatorio.reusos, 1);
      assert.deepEqual(retry.privados, []);
      const foreign = prepararLoteStagingLegado([{ ...item, empresaId: groupId }],
        { autorizado: true, vinculosVerificados });
      assert.equal(foreign.bloqueado, true);
      assert.deepEqual(foreign.privados, []);
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
