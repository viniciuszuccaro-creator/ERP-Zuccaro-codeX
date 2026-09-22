import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for test:postgres');
const suites = [
  ['R08B', 'tests/runtime08-postgres-e2e.test.ts'],
  ['R08C', 'tests/runtime08c-orcamento-postgres-e2e.test.ts'],
  ['R09', 'tests/runtime09-pedido-postgres-e2e.test.ts'],
  ['R10', 'tests/runtime10-produto-pim-postgres-e2e.test.ts'],
];
let allPassed = true;
for (const [label, suite] of suites) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', suite], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  const total = Number(output.match(/tests\s+(\d+)/)?.[1] ?? 0);
  const skipped = Number(output.match(/skipped\s+(\d+)/)?.[1] ?? 0);
  console.log(`POSTGRES_E2E_${label}_TOTAL_TESTS=${total}`);
  if (result.status !== 0 || total < 1 || skipped > 0) allPassed = false;
}
if (!allPassed) process.exit(1);