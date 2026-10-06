/**
 * Composição integrada Expedição(#199) + Comercial(#178): migrations 025–035 + 036
 * sem colisão de numeração. Fonte comercial via git show (não tip-port; não altera branch Codex).
 * Camada: PGlite — ≠ SPA_LOCAL.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
/** Tip Comercial (#178) — SHA pinado pela CI; default local = tip #178. */
const CODEX_REF = process.env.COMERCIAL_MIGRATIONS_REF || '4f8c6593506f681689e021226ab024f57c7aede9';
/** Só o job dedicado (COMERCIAL_COMPOSE_REQUIRE=1) falha fechado; npm test geral faz skip. */
const REQUIRE_REF = process.env.COMERCIAL_COMPOSE_REQUIRE === '1';

function gitShow(ref, rel) {
  const show = spawnSync('git', ['-C', repoRoot, 'show', `${ref}:${rel}`], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (show.status !== 0) throw new Error(show.stderr || `git show failed ${ref}:${rel}`);
  return show.stdout;
}

test('composicao migrations: comercial 025-035 + expedicao 036 sem colisao', async (t) => {
  const probe = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--verify', CODEX_REF], { encoding: 'utf8' });
  if (probe.status !== 0) {
    const detail = (probe.stderr || probe.stdout || '').trim() || 'rev-parse failed';
    if (REQUIRE_REF) {
      assert.fail(
        `COMERCIAL_MIGRATIONS_REF ausente/indisponível (${CODEX_REF}): ${detail}. `
        + 'Job de integração deve fazer fetch explícito da ref Comercial; skip não é aprovação.',
      );
    }
    t.skip(`ref ${CODEX_REF} indisponivel neste clone (local only)`);
    return;
  }

  const localMigs = join(repoRoot, 'server/migrations');
  const localFiles = readdirSync(localMigs).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
  assert.ok(localFiles.includes('036_expedicao_entregas_romaneios.sql'));
  assert.ok(localFiles.includes('037_expedicao_estoque_movimentos.sql'));
  assert.ok(!localFiles.some((f) => /^025_expedicao/.test(f)), '025_expedicao nao deve existir');
  // Gap intencional: não inventar 032; sequência comercial 025–031, 033–035 + Expedição 036–037.
  assert.ok(!localFiles.some((f) => f.startsWith('032_')), 'migration 032 ausente por desenho; nao inventar');
  const commercialAndExpedicao = localFiles.filter((f) => {
    const n = Number(f.slice(0, 3));
    return n >= 25 && n <= 37;
  });
  assert.deepEqual(
    commercialAndExpedicao.map((f) => f.slice(0, 3)),
    ['025', '026', '027', '028', '029', '030', '031', '033', '034', '035', '036', '037'],
    'unico gap permitido entre 025-037 e 032',
  );
  const body037 = readFileSync(join(localMigs, '037_expedicao_estoque_movimentos.sql'), 'utf8');
  assert.match(body037, /expedicao_estoque_saldos/);
  assert.doesNotMatch(body037, /INSERT\s+INTO\s+expedicao_estoque_saldos/i, '037 nao inventa saldo de abertura');

  const list = spawnSync('git', ['-C', repoRoot, 'ls-tree', '-r', '--name-only', CODEX_REF, '--', 'server/migrations'], {
    encoding: 'utf8',
  });
  assert.equal(list.status, 0, list.stderr);
  const comercial = list.stdout.split('\n').filter((rel) => /\/0(2[5-9]|3[0-5])_.*\.sql$/.test(rel));
  assert.ok(comercial.length >= 5, 'esperado bloco comercial 025-035');
  assert.ok(comercial.some((r) => r.includes('025_')), '025 comercial');
  assert.ok(comercial.some((r) => r.includes('026_pedidos_tipo_comercial')), 'trava histórica 026 tip Comercial');
  assert.ok(comercial.some((r) => r.includes('035_')), '035 comercial');
  assert.ok(!comercial.some((r) => r.includes('036_')), '036 nao e comercial');

  // Trava: 026 vem do tip Comercial pinado — hash estável; job não reescreve classificação.
  const locked026Rel = comercial.find((r) => r.includes('026_pedidos_tipo_comercial'));
  assert.ok(locked026Rel, '026_pedidos_tipo_comercial.sql obrigatória no tip Comercial');
  const locked026Body = gitShow(CODEX_REF, locked026Rel);
  assert.match(locked026Body, /tipo_comercial/i);

  const out = mkdtempSync(join(tmpdir(), 'exp-compose-'));
  try {
    for (const file of localFiles.filter((f) => Number(f.slice(0, 3)) <= 24)) {
      writeFileSync(join(out, file), readFileSync(join(localMigs, file), 'utf8'));
    }
    for (const rel of comercial) {
      const base = rel.split('/').pop();
      writeFileSync(join(out, base), gitShow(CODEX_REF, rel));
    }
    writeFileSync(
      join(out, '036_expedicao_entregas_romaneios.sql'),
      readFileSync(join(localMigs, '036_expedicao_entregas_romaneios.sql'), 'utf8'),
    );
    writeFileSync(join(out, '037_expedicao_estoque_movimentos.sql'),
      readFileSync(join(localMigs, '037_expedicao_estoque_movimentos.sql'), 'utf8'));

    const composed = readdirSync(out).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
    const nums = composed.map((f) => f.slice(0, 3));
    assert.equal(new Set(nums).size, nums.length, 'numeracao unica na composicao');
    assert.ok(composed.indexOf('024_produto_canais_rascunho.sql') < composed.findIndex((f) => f.startsWith('025_')));
    assert.ok(composed.findIndex((f) => f.startsWith('035_')) < composed.indexOf('036_expedicao_entregas_romaneios.sql'));
    assert.ok(composed.indexOf('036_expedicao_entregas_romaneios.sql') < composed.indexOf('037_expedicao_estoque_movimentos.sql'));

    const pg = new PGlite();
    try {
      for (const file of composed) {
        await pg.exec(
          readFileSync(join(out, file), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
        );
      }
      const tables = await pg.query<{ relname: string }>(`
        SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('entregas','romaneios','pedidos','orcamentos')
        ORDER BY 1
      `);
      const names = tables.rows.map((r) => r.relname);
      assert.ok(names.includes('entregas'));
      assert.ok(names.includes('romaneios'));
      assert.ok(names.includes('pedidos'));
    } finally {
      await pg.close();
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
