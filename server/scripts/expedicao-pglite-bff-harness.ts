/**
 * BFF isolado Expedição sobre PGlite para prova Playwright (API+PG).
 * Imprime EXPEDICAO_PGLITE_BFF_PORT=<n> e permanece em foreground.
 *
 * Uso: cd server && npx tsx scripts/expedicao-pglite-bff-harness.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { SEED_IDS } from './seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function dbClient(db: PGlite): DbClient {
  return {
    pool: null as never,
    query: (text, params) => db.query(text, params as never) as never,
    withTransaction: (fn) => db.transaction((tx) => fn({
      query: (text, params) => tx.query(text, params as never) as never,
    } as DbQueryExecutor)),
    checkConnection: async () => true,
    end: async () => db.close(),
  };
}

async function main() {
  const pg = new PGlite();
  const migrations = join(__dirname, '../migrations');
  for (const file of readdirSync(migrations).filter((n) => /^\d{3}_.*\.sql$/.test(n)).sort()) {
    await pg.exec(
      readFileSync(join(migrations, file), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
    );
  }
  await pg.exec(readFileSync(join(__dirname, 'seed-dev-synthetic.sql'), 'utf8'));

  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  tenant.link(SEED_IDS.empresaA2, SEED_IDS.groupA);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: {
      Expedicao: {
        entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar'],
        romaneio: ['visualizar', 'criar', 'editar'],
        separacao: ['visualizar', 'criar', 'editar', 'conferir'],
      },
    },
  });

  const config = loadConfig({
    NODE_ENV: 'test',
    ERP_ENV: 'dev',
    REQUIRE_DATABASE: 'false',
    DATABASE_URL: 'postgres://synthetic@localhost:5432/erp_expedicao_pglite_bff',
    CORS_ORIGINS: '*',
  });

  const { app } = createApp({
    config,
    db: dbClient(pg),
    useMemory: false,
    tenantGuard: tenant,
    rbacGuard: rbac,
  });

  const server = app.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    process.stdout.write(`EXPEDICAO_PGLITE_BFF_PORT=${port}\n`);
  });

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pg.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
