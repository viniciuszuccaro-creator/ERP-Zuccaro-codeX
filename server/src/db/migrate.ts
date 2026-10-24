import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { createDbClient, type DbClient } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort();
}

export async function applyMigrations(databaseUrl?: string) {
  const config = loadConfig({
    ...process.env,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    REQUIRE_DATABASE: 'true',
  });

  const db = createDbClient(config);
  if (!db.pool) {
    throw new Error('DATABASE_URL required to apply migrations');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
    )
  `);

  const applied = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
  const appliedSet = new Set(applied.rows.map((r) => r.id));
  const files = listMigrationFiles();
  const executed: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
    });
    executed.push(file);
  }

  await db.end();
  return { applied: [...appliedSet], executed, pending: files.filter((f) => !appliedSet.has(f) && !executed.includes(f)) };
}

/** Missing, inaccessible or incomplete journals cannot prove an empty database. */
export async function inspectMigrationStatus(db: Pick<DbClient, 'withTransaction'>, files: readonly string[]) {
  const snapshot = [...files];
  try {
    return await db.withTransaction(async q => {
      await q.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await q.query('SET LOCAL row_security = off');
      const result = await q.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
      const applied = result.rows.map(row => row.id);
      if (applied.some(id => typeof id !== 'string' || !/^\d+_.*\.sql$/i.test(id) || !snapshot.includes(id))
        || new Set(applied).size !== applied.length) throw new Error('INVALID_MIGRATION_JOURNAL');
      const appliedSet = new Set(applied);
      return { files: snapshot, applied, pending: snapshot.filter(file => !appliedSet.has(file)) };
    });
  } catch {
    throw new Error('MIGRATION_STATUS_UNAVAILABLE');
  }
}

export async function migrationStatus(databaseUrl?: string) {
  const config = loadConfig({
    ...process.env,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    REQUIRE_DATABASE: 'true',
  });
  const db = createDbClient(config);
  try {
    return await inspectMigrationStatus(db, listMigrationFiles());
  } finally {
    try { await db.end(); }
    catch { throw new Error('MIGRATION_STATUS_CLEANUP_FAILED'); }
  }
}

async function main() {
  const statusOnly = process.argv.includes('--status');
  if (statusOnly) {
    const status = await migrationStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  const result = await applyMigrations();
  console.log(JSON.stringify(result, null, 2));
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
