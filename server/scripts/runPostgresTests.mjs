import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for test:postgres');
}

const result = spawnSync(process.execPath, [
  '--import', 'tsx', '--test', 'tests/runtime08-postgres-e2e.test.ts',
], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output);

const total = Number(output.match(/tests\s+(\d+)/)?.[1] ?? 0);
if (result.status !== 0 || total < 1) {
  process.exit(result.status || 1);
}
console.log(`POSTGRES_E2E_TOTAL_TESTS=${total}`);
