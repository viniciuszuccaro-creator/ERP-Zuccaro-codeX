import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { createDbClient } from './client.js';
import { mapHistoricalPedidoTypes } from './mapHistoricalPedidoTypes.js';

async function digestFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function readPrivatePlan(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error('HISTORICAL_TYPE_PLAN_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--apply' || args[1] !== '--backup'
    || args[3].length !== 64 || !/^[a-f0-9]{64}$/i.test(args[3])) {
    throw new Error('HISTORICAL_TYPE_USAGE');
  }
  const backup = statSync(args[2]);
  if (!backup.isFile() || backup.size < 1024 || (backup.mode & 0o077) !== 0
    || (await digestFile(args[2])).toLowerCase() !== args[3].toLowerCase()) {
    throw new Error('HISTORICAL_TYPE_BACKUP_INVALID');
  }
  const plan = await readPrivatePlan();
  const config = loadConfig({ ...process.env, REQUIRE_DATABASE: 'true' });
  const db = createDbClient(config);
  if (!db.pool) throw new Error('HISTORICAL_TYPE_DATABASE_REQUIRED');
  try {
    const migration = readFileSync(new URL('../../migrations/026_pedidos_tipo_comercial.sql', import.meta.url), 'utf8');
    const result = await mapHistoricalPedidoTypes(db, plan, migration);
    console.log(JSON.stringify({ ...result, backupSha256: args[3].toLowerCase() }));
  } finally {
    await db.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    // Errors are codes only: never print a manifest, row ID, connection string or PostgreSQL detail.
    console.error(error instanceof Error && /^HISTORICAL_TYPE_[A-Z_]+$/.test(error.message)
      ? error.message : 'HISTORICAL_TYPE_APPLY_FAILED');
    process.exitCode = 1;
  });
}
