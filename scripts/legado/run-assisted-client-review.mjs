import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runPrivateAssistedReviewCommand } from './staging-checkpoint.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const [directory, manifest, approval, configName] = process.argv.slice(2);
let pool;
try {
  if (process.platform === 'win32' || process.argv.length !== 6
      || !/^[a-z0-9_-]+\.private\.json$/.test(configName)
      || configName === manifest || configName === approval) throw new Error('REVIEW_COMMAND_ARGUMENTS');
  const root = fs.realpathSync(directory);
  const relative = path.relative(fs.realpathSync(repo), root);
  const dir = fs.lstatSync(directory);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
      || !dir.isDirectory() || dir.isSymbolicLink() || dir.uid !== process.getuid() || (dir.mode & 0o077))
    throw new Error('REVIEW_CONFIG_DIRECTORY');
  const file = path.join(root, configName);
  const mode = fs.lstatSync(file);
  if (!mode.isFile() || mode.isSymbolicLink() || mode.uid !== process.getuid() || (mode.mode & 0o077))
    throw new Error('REVIEW_CONFIG_PRIVATE_FILE');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Object.keys(config).sort().join(',') !== 'databaseUrl,schema'
      || typeof config.databaseUrl !== 'string' || !/^postgres(?:ql)?:\/\//.test(config.databaseUrl)
      || typeof config.schema !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(config.schema))
    throw new Error('REVIEW_CONFIG_INVALID');
  const require = createRequire(new URL('../../server/package.json', import.meta.url));
  const { Pool } = require('pg');
  const { createPoolDbClient } = await import('../../server/dist/db/client.js');
  const { PostgresAuditRepository } = await import('../../server/dist/audit/auditRepository.js');
  const { PostgresRbacGuard } = await import('../../server/dist/db/rbacGuard.js');
  pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 5000,
    options: `-c search_path=${config.schema},pg_catalog -c statement_timeout=20000 -c lock_timeout=3000` });
  const db = createPoolDbClient(pool);
  const result = await runPrivateAssistedReviewCommand([directory, manifest, approval], repo, {
    db, rbac: new PostgresRbacGuard(db), audit: new PostgresAuditRepository(db),
  });
  console.log(JSON.stringify({ status: 'REVIEW_COMPLETE', manifestSha256: result.manifestSha256,
    total: result.total, groups: result.receipts.length }));
} catch (error) {
  const reason = [error?.message, error?.code].find(value => typeof value === 'string'
    && /^(?:REVIEW_[A-Z_]+|STAGING_[A-Z_]+|[A-Z0-9]{5})$/.test(value));
  console.error(reason ?? 'REVIEW_COMMAND_FAILED');
  process.exitCode = 1;
} finally {
  await pool?.end();
}
