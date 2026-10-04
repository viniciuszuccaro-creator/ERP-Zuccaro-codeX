/**
 * Composição Expedição(#199) + Comercial(#178) em PostgreSQL real isolado.
 * Fonte comercial: COMERCIAL_MIGRATIONS_REF (SHA tip #178).
 * Trava histórica: migration 026_pedidos_tipo_comercial.sql do tip Comercial
 * é aplicada como veio do SHA — sem reclassificação/edição neste job.
 *
 * Camada: PostgreSQL isolado ≠ PGlite ≠ SPA_LOCAL.
 * Uso (CI/local): DATABASE_URL=... COMERCIAL_COMPOSE_REQUIRE=1 node --import tsx --test ...
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const CODEX_REF = process.env.COMERCIAL_MIGRATIONS_REF || '4f8c6593506f681689e021226ab024f57c7aede9';
/** Só o job dedicado (COMERCIAL_COMPOSE_REQUIRE=1) falha fechado; npm test geral faz skip. */
const REQUIRE = process.env.COMERCIAL_COMPOSE_REQUIRE === '1';
const DATABASE_URL = process.env.DATABASE_URL || '';
const LOCKED_026 = '026_pedidos_tipo_comercial.sql';

function gitShow(ref: string, rel: string) {
  const show = spawnSync('git', ['-C', repoRoot, 'show', `${ref}:${rel}`], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (show.status !== 0) throw new Error(show.stderr || `git show failed ${ref}:${rel}`);
  return show.stdout;
}

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function adminUrl(databaseUrl: string) {
  const u = new URL(databaseUrl);
  u.pathname = '/postgres';
  return u.toString();
}

test('composicao PostgreSQL isolado: comercial 025-035 + 036 com trava 026', async (t) => {
  if (!DATABASE_URL) {
    if (REQUIRE) assert.fail('DATABASE_URL obrigatório para composição PostgreSQL isolada sob REQUIRE');
    t.skip('DATABASE_URL not available');
    return;
  }

  const probe = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--verify', CODEX_REF], { encoding: 'utf8' });
  if (probe.status !== 0) {
    if (REQUIRE) assert.fail(`COMERCIAL_MIGRATIONS_REF ausente (${CODEX_REF})`);
    t.skip(`ref ${CODEX_REF} indisponivel`);
    return;
  }

  const localMigs = join(repoRoot, 'server/migrations');
  const localFiles = readdirSync(localMigs).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
  assert.ok(localFiles.includes('036_expedicao_entregas_romaneios.sql'));
  assert.ok(localFiles.includes('037_expedicao_estoque_movimentos.sql'));
  assert.ok(!localFiles.some((f) => /^025_expedicao/.test(f)));

  const list = spawnSync('git', ['-C', repoRoot, 'ls-tree', '-r', '--name-only', CODEX_REF, '--', 'server/migrations'], {
    encoding: 'utf8',
  });
  assert.equal(list.status, 0, list.stderr);
  const comercial = list.stdout.split('\n').filter((rel) => /\/0(2[5-9]|3[0-5])_.*\.sql$/.test(rel));
  assert.ok(comercial.some((r) => r.endsWith(LOCKED_026)), `trava histórica exige ${LOCKED_026} no tip Comercial`);
  assert.ok(comercial.some((r) => r.includes('025_')) && comercial.some((r) => r.includes('035_')));

  const locked026Source = gitShow(CODEX_REF, `server/migrations/${LOCKED_026}`);
  const locked026Hash = sha256(locked026Source);
  assert.match(locked026Source, /tipo_comercial|pedidos/i, '026 tip Comercial inalterável neste job');

  const out = mkdtempSync(join(tmpdir(), 'exp-pg-compose-'));
  const dbName = `erp_exp_compose_${Date.now().toString(36)}`;
  const admin = new pg.Client({ connectionString: adminUrl(DATABASE_URL) });
  let client: pg.Client | null = null;
  try {
    for (const file of localFiles.filter((f) => Number(f.slice(0, 3)) <= 24)) {
      writeFileSync(join(out, file), readFileSync(join(localMigs, file), 'utf8'));
    }
    for (const rel of comercial) {
      const base = rel.split('/').pop()!;
      const body = gitShow(CODEX_REF, rel);
      if (base === LOCKED_026) {
        assert.equal(sha256(body), locked026Hash, '026 não pode divergir do SHA Comercial pinado');
      }
      writeFileSync(join(out, base), body);
    }
    writeFileSync(
      join(out, '036_expedicao_entregas_romaneios.sql'),
      readFileSync(join(localMigs, '036_expedicao_entregas_romaneios.sql'), 'utf8'),
    );
    writeFileSync(join(out, '037_expedicao_estoque_movimentos.sql'),
      readFileSync(join(localMigs, '037_expedicao_estoque_movimentos.sql'), 'utf8'));

    const composed = readdirSync(out).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
    assert.equal(new Set(composed.map((f) => f.slice(0, 3))).size, composed.length);
    assert.ok(composed.includes(LOCKED_026));
    assert.ok(composed.includes('036_expedicao_entregas_romaneios.sql'));
    assert.ok(composed.includes('037_expedicao_estoque_movimentos.sql'));

    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const isoUrl = new URL(DATABASE_URL);
    isoUrl.pathname = `/${dbName}`;
    client = new pg.Client({ connectionString: isoUrl.toString() });
    await client.connect();

    for (const file of composed) {
      const sql = readFileSync(join(out, file), 'utf8');
      await client.query(sql);
    }

    // Trava: conteúdo 026 no disco de composição = hash tip
    assert.equal(sha256(readFileSync(join(out, LOCKED_026), 'utf8')), locked026Hash);

    const tables = await client.query<{ relname: string }>(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('entregas','romaneios','pedidos','orcamentos')
      ORDER BY 1
    `);
    const names = tables.rows.map((r) => r.relname);
    assert.ok(names.includes('entregas'));
    assert.ok(names.includes('romaneios'));
    assert.ok(names.includes('pedidos'));

    // Coluna tip 026 presente (sem reclassificar)
    const col = await client.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='pedidos' AND column_name='tipo_comercial'
    `);
    assert.equal(col.rows.length, 1, '026 tip Comercial aplicada (tipo_comercial)');
  } finally {
    if (client) await client.end().catch(() => {});
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    } catch { /* best-effort */ }
    await admin.end().catch(() => {});
    rmSync(out, { recursive: true, force: true });
  }
});
