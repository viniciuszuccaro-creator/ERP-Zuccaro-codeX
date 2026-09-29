import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { prepararLoteStagingLegado } from '../../scripts/legado/staging-scope-gate.mjs';
import { verificarLoteMestresParaStaging, verificarMapeadorParaStaging } from '../../scripts/legado/verificar-mapeador-staging.mjs';

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
  assert.ok(['postgres', 'postgresql'].includes(url.protocol.slice(0, -1)));
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.port, '5432');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(url.pathname.slice(1), DB_NAME);
}

test('staging sintetico recusa URL do banco oficial antes de conectar', () => {
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/postgres', DB_NAME, '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/erp_test', DB_NAME, '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost/' + DB_NAME, '', '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@remote.example:5432/' + DB_NAME, DB_NAME, '1'));
  assert.throws(() => assertIsolatedTarget('postgresql://synthetic@localhost:5432/' + DB_NAME + '?dbname=postgres', DB_NAME, '1'));
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

test('mapper e staging PostgreSQL isolado reconciliam mestres sem entrega parcial', async () => {
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
      const opts = { groupId, grupoComprovado: true };
      const cliente = { cod_cliente: 'CLI-MAP-SINT-1', nome: 'Cliente Sintetico', group_id: groupId };
      const mapped = verificarMapeadorParaStaging([cliente], { ...opts, entidade: 'cliente' });
      assert.equal(mapped.bloqueado, false);
      assert.equal(mapped.privados.length, 1);
      assert.equal(mapped.privados[0].empresa_id, undefined);
      const signature = (row) => createHash('sha256').update(JSON.stringify({
        codigo: row.codigo_legado, nome: row.nome, descricao: row.descricao,
        documento: row.documento,
      })).digest('hex');
      const insert = (row, entidade) => client.query(`INSERT INTO legado_staging_sintetico
        (group_id, empresa_id, entidade, codigo_legado, assinatura) VALUES ($1,$2,$3,$4,$5)`,
      [row.group_id, row.empresa_id ?? null, entidade, row.codigo_legado, signature(row)]);
      await insert(mapped.privados[0], 'cliente');
      const stored = await client.query(`SELECT group_id, empresa_id, entidade, codigo_legado, assinatura
        FROM legado_staging_sintetico WHERE group_id=$1 AND empresa_id IS NULL`, [groupId]);
      assert.equal(stored.rowCount, 1);
      const retry = verificarMapeadorParaStaging([cliente], { ...opts, entidade: 'cliente',
        existentes: stored.rows.map((row) => ({ groupId: row.group_id, empresaId: row.empresa_id,
          entidade: row.entidade, codigoLegado: row.codigo_legado, assinaturaOrigem: row.assinatura })) });
      assert.equal(retry.bloqueado, false);
      assert.equal(retry.relatorio.reusos, 1);
      assert.deepEqual(retry.privados, []);
      const produto = { sku: 'SKU-MAP-SINT-1', descricao: 'Revenda Sintetica',
        tipo_produto: 'revenda', group_id: groupId };
      const revenda = verificarMapeadorParaStaging([produto], { ...opts, entidade: 'produto_revenda' });
      assert.equal(revenda.bloqueado, false);
      await insert(revenda.privados[0], 'produto_revenda');
      const fornecedor = { cod_fornecedor: 'FOR-MAP-SINT-1', nome: 'Fornecedor Sintetico',
        group_id: groupId };
      const lote = { cliente: [cliente], fornecedor: [fornecedor], produto_revenda: [produto] };
      const contagensEsperadas = Object.keys(lote).map((entidade) => ({
        entidade, codigoEmpresaLegado: 'grupo', quantidade: 1,
      }));
      const completo = verificarLoteMestresParaStaging(lote, { ...opts, contagensEsperadas });
      assert.equal(completo.bloqueado, false);
      assert.equal(completo.privados.length, 3);
      const incompleto = verificarLoteMestresParaStaging({ ...lote,
        produto_revenda: [{ ...produto, tipo_produto: 'fabricacao' }],
      }, { ...opts, contagensEsperadas });
      assert.equal(incompleto.bloqueado, true);
      assert.deepEqual(incompleto.privados, []);
      const mappedFornecedor = verificarMapeadorParaStaging([fornecedor], { ...opts,
        entidade: 'fornecedor', contagensEsperadas: [
          { entidade: 'fornecedor', codigoEmpresaLegado: 'grupo', quantidade: 1 },
        ] });
      assert.equal(mappedFornecedor.bloqueado, false);
      assert.equal(mappedFornecedor.privados[0].empresa_id, undefined);
      await insert(mappedFornecedor.privados[0], 'fornecedor');
      const storedFornecedor = await client.query(`SELECT group_id, empresa_id, entidade, codigo_legado, assinatura
        FROM legado_staging_sintetico WHERE group_id=$1 AND entidade='fornecedor'`, [groupId]);
      assert.equal(storedFornecedor.rowCount, 1);
      const retryFornecedor = verificarMapeadorParaStaging([fornecedor], { ...opts, entidade: 'fornecedor',
        existentes: storedFornecedor.rows.map((row) => ({ groupId: row.group_id,
          empresaId: row.empresa_id, entidade: row.entidade, codigoLegado: row.codigo_legado,
          assinaturaOrigem: row.assinatura })) });
      assert.equal(retryFornecedor.bloqueado, false);
      assert.equal(retryFornecedor.relatorio.reusos, 1);
      assert.deepEqual(retryFornecedor.privados, []);
      assert.throws(() => verificarMapeadorParaStaging([
        { ...fornecedor, codigo_empresa: '001' },
      ], { ...opts, entidade: 'fornecedor' }), /vinculo empresarial legado nao comprovado/);
      assert.throws(() => verificarMapeadorParaStaging([{ ...cliente, group_id: empresaId }],
        { ...opts, entidade: 'cliente' }), /Grupo da linha diverge/);
      const mixed = verificarMapeadorParaStaging([produto, {
        sku: 'SKU-MAP-SINT-2', descricao: 'Fabricacao Sintetica',
        tipo_produto: 'fabricacao', group_id: groupId,
      }], { ...opts, entidade: 'produto_revenda' });
      assert.equal(mixed.bloqueado, true);
      assert.equal(mixed.relatorio.excluidos, 1);
      assert.deepEqual(mixed.privados, []);
      const count = await client.query('SELECT count(*)::int AS total FROM legado_staging_sintetico');
      assert.equal(count.rows[0].total, 3);
      await client.query('SAVEPOINT duplicate_mapped_master');
      await assert.rejects(insert(mapped.privados[0], 'cliente'), (error) => error.code === '23505');
      await client.query('ROLLBACK TO SAVEPOINT duplicate_mapped_master');
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
});
