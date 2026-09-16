import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { createDbClient } from './client.js';

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

export async function migrationStatus(databaseUrl?: string) {
  const config = loadConfig({
    ...process.env,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    REQUIRE_DATABASE: 'true',
  });
  const db = createDbClient(config);
  const files = listMigrationFiles();
  let applied: string[] = [];
  try {
    const result = await db.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
    applied = result.rows.map((r) => r.id);
  } catch {
    applied = [];
  }
  await db.end();
  const appliedSet = new Set(applied);
  return {
    files,
    applied,
    pending: files.filter((f) => !appliedSet.has(f)),
  };
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
