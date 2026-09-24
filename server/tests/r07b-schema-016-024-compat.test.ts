/**
 * Compatibilidade sintética: schema pós 016–024 (esp. 018 Produto) com
 * operações no estilo da API R07B que permanece na 3080 até Gate F.
 * Não altera VPS/3080. Usa PGlite. Fonte das migrations: checkout local
 * (pós-integração) ou MIGRATIONS_GIT_REF / MIGRATIONS_DIR.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const repoRoot = join(serverRoot, '..');

function resolveMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR && existsSync(process.env.MIGRATIONS_DIR)) {
    return process.env.MIGRATIONS_DIR;
  }
  const local = join(serverRoot, 'migrations');
  if (readdirSync(local).some((n) => n.startsWith('018_'))) return local;

  const ref = process.env.MIGRATIONS_GIT_REF || 'origin/codex/comercial-360';
  const out = mkdtempSync(join(tmpdir(), 'mig-r07b-'));
  const list = spawnSync('git', ['-C', repoRoot, 'ls-tree', '-r', '--name-only', ref, '--', 'server/migrations'], {
    encoding: 'utf8',
  });
  assert.equal(list.status, 0, list.stderr);
  for (const rel of list.stdout.split('\n').filter(Boolean)) {
    const base = rel.split('/').pop();
    if (!base || !/^\d{3}_.*\.sql$/.test(base)) continue;
    const show = spawnSync('git', ['-C', repoRoot, 'show', `${ref}:${rel}`], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(show.status, 0, `${ref}:${rel} ${show.stderr}`);
    writeFileSync(join(out, base), show.stdout);
  }
  return out;
}

function dbClient(db: PGlite): DbClient {
  return {
    pool: {} as never,
    query: (text, params) => db.query(text, params as never) as never,
    withTransaction: (fn) => db.transaction((tx) => fn({
      query: (text, params) => tx.query(text, params as never) as never,
    } as DbQueryExecutor)),
    checkConnection: async () => true,
    end: async () => db.close(),
  };
}

async function applyAllMigrations(pg: PGlite, dir: string) {
  const files = readdirSync(dir).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort();
  assert.ok(files.some((f) => f.startsWith('016_')), '016 required');
  assert.ok(files.some((f) => f.startsWith('018_')), '018 required');
  assert.ok(files.some((f) => f.startsWith('024_')), '024 required');
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
    )
  `);
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, '');
    await pg.exec(sql);
    await pg.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
  }
  return files;
}

function httpGet(app: import('express').Express, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('no port'));
        return;
      }
      fetch(`http://127.0.0.1:${addr.port}${path}`)
        .then(async (res) => {
          const body = await res.json() as Record<string, unknown>;
          server.close(() => resolve({ status: res.status, body }));
        })
        .catch((err) => {
          server.close(() => reject(err));
        });
    });
  });
}

test('R07B health/ready + Produto legado após schema 016–024 (018)', async () => {
  const migDir = resolveMigrationsDir();
  const pg = new PGlite();
  try {
    const files = await applyAllMigrations(pg, migDir);
    assert.ok(files.length >= 24);

    const cols = await pg.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='produtos'
        AND column_name IN ('workflow_status','multiplo_venda','quantidade_minima_venda','permite_fracionamento')
      ORDER BY column_name
    `);
    assert.deepEqual(cols.rows.map((r) => r.column_name), [
      'multiplo_venda',
      'permite_fracionamento',
      'quantidade_minima_venda',
      'workflow_status',
    ]);

    const seedPath = join(serverRoot, 'scripts/seed-dev-synthetic.sql');
    assert.equal(existsSync(seedPath), true);
    await pg.exec(readFileSync(seedPath, 'utf8'));

    const legacySelect = await pg.query<{ id: string; nome: string }>(`
      SELECT id, nome FROM produtos WHERE ativo = true LIMIT 5
    `);
    assert.ok(legacySelect.rows.length >= 1);

    const id = legacySelect.rows[0].id;
    await pg.query(`UPDATE produtos SET nome = nome WHERE id = $1`, [id]);
    const wf = await pg.query<{ workflow_status: string; multiplo_venda: string }>(
      `SELECT workflow_status, multiplo_venda::text AS multiplo_venda FROM produtos WHERE id=$1`,
      [id],
    );
    assert.equal(wf.rows[0]?.workflow_status, 'RASCUNHO');
    assert.ok(Number(wf.rows[0]?.multiplo_venda) > 0);

    for (const table of ['orcamentos', 'pedidos', 'produto_canais']) {
      const t = await pg.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      assert.equal(t.rows[0]?.c, 1, table);
    }

    const db = dbClient(pg);
    const config = loadConfig({
      NODE_ENV: 'test',
      ERP_ENV: 'dev',
      APP_VERSION: 'r07b-compat-synthetic',
      DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic',
    });
    const { app } = createApp({ config, db });

    const health = await httpGet(app, '/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const ready = await httpGet(app, '/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.body.status, 'ready');
    assert.equal(ready.body.database, 'ok');
  } finally {
    await pg.close();
  }
});
