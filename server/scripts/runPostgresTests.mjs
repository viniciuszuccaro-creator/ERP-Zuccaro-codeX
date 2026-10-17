import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for test:postgres');
const suites = [
  ['R40DUPLICATE', 'tests/runtime40-crm-duplicidade.test.ts'],
  ['OWNER_COPY', 'tests/owner-provision-sql.test.ts'],
  ['R01AUTH', 'tests/runtime01.test.ts'],
  ['LEGACY_CLIENT', 'tests/runtime04.test.ts'],
  ['LEGACY_IDENTITY', 'tests/legacy-identity.test.ts'],
  ['LEGACY_PRODUCT', 'tests/legacy-product.test.ts'],
  ['R08B', 'tests/runtime08-postgres-e2e.test.ts'],
  ['R07BPRICE', 'tests/runtime07b-preco-postgres-e2e.test.ts'],
  ['R08C', 'tests/runtime08c-orcamento-postgres-e2e.test.ts'],
  ['R09', 'tests/runtime09-pedido-postgres-e2e.test.ts'],
  ['R10C', 'tests/runtime10-produto-canais-postgres-e2e.test.ts'],
  ['R10', 'tests/runtime10-produto-pim-postgres-e2e.test.ts'],
  ['R40CRM', 'tests/runtime40-crm-postgres-e2e.test.ts'],
  ['R41PROD', 'tests/runtime41-produto-empresa-postgres-e2e.test.ts'],
  ['TENANT_CONTEXT', 'tests/db-tenant-context-postgres.test.ts'],
  ['MARCA_ATOMICITY', 'tests/marca-atomicidade.test.ts'],
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
