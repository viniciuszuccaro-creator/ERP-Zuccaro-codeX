import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import type { RequestContext } from '../src/audit/types.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresClienteLocalRepository } from '../src/repositories/postgresClienteLocalRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresObraRepository } from '../src/repositories/postgresObraRepository.ts';
import { ObraService } from '../src/services/obraService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function dbClient(db: PGlite): DbClient {
  return {
    pool: null,
    query: (text, params) => db.query(text, params as never) as never,
    withTransaction: (fn) => db.transaction((tx) => fn({
      query: (text, params) => tx.query(text, params as never) as never,
    } as DbQueryExecutor)),
    checkConnection: async () => true,
    end: async () => db.close(),
  };
}

function service(db: DbClient) {
  const tenant = new InMemoryTenantGuard();
  tenant.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: {
      Cadastros: {
        cliente: ['visualizar'],
        obra: [
          'visualizar', 'criar', 'editar', 'inativar', 'restaurar',
          'vincular-empresa', 'vincular-local', 'principal',
        ],
      },
    },
  });
  return new ObraService(
    new PostgresObraRepository(db),
    new PostgresClienteRepository(db),
    new PostgresClienteLocalRepository(db),
    new PostgresAuditRepository(db),
    tenant,
    rbac,
  );
}

const ctx: RequestContext = {
  requestId: 'runtime06b-audit-failure',
  groupId: SEED_IDS.groupA,
  empresaId: SEED_IDS.empresaA,
  actorId: SEED_IDS.runtimeActorA,
  scopeType: 'empresa',
};

test('PostgreSQL rollbacka CREATE de Obra quando auditoria falha', async () => {
  const pg = new PGlite();
  try {
    const migrations = join(__dirname, '../migrations');
    for (const file of readdirSync(migrations).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      await pg.exec(
        readFileSync(join(migrations, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
    await pg.exec(`
      CREATE OR REPLACE FUNCTION force_obra_audit_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_force_obra_audit_failure
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_obra_audit_failure();
    `);
    const db = dbClient(pg);
    const before = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM obras');
    await assert.rejects(
      () => service(db).create(ctx, SEED_IDS.clientePjA, {
        nome: 'Obra Audit Fail',
        locais: [{
          cliente_local_id: SEED_IDS.clienteLocalC,
          uso_na_obra: 'FISICO',
          principal: true,
        }],
      }),
      /forced audit failure/,
    );
    const after = await pg.query<{ total: number }>('SELECT count(*)::int AS total FROM obras');
    assert.equal(after.rows[0].total, before.rows[0].total);
    const sequence = await pg.query<{ next_value: number }>(`
      SELECT next_value FROM entity_code_sequences
      WHERE group_id='${SEED_IDS.groupA}' AND entity_name='Obra'
    `);
    assert.equal(sequence.rows[0].next_value, 2);
  } finally {
    await pg.close();
  }
});

test('PostgreSQL rollbacka linkLocal quando auditoria falha', async () => {
  const pg = new PGlite();
  try {
    const migrations = join(__dirname, '../migrations');
    for (const file of readdirSync(migrations).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      await pg.exec(
        readFileSync(join(migrations, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
    await pg.exec(`
      CREATE OR REPLACE FUNCTION force_obra_audit_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_force_obra_audit_failure
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_obra_audit_failure();
    `);
    const db = dbClient(pg);
    const before = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM obra_locais
      WHERE obra_id='${SEED_IDS.obraA}' AND cliente_local_id='${SEED_IDS.clienteLocalC}'
    `);
    await assert.rejects(
      () => service(db).linkLocal(ctx, SEED_IDS.clientePjA, SEED_IDS.obraA, {
        cliente_local_id: SEED_IDS.clienteLocalC,
        uso_na_obra: 'ENTREGA',
        principal: false,
      }),
      /forced audit failure/,
    );
    const after = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM obra_locais
      WHERE obra_id='${SEED_IDS.obraA}' AND cliente_local_id='${SEED_IDS.clienteLocalC}'
    `);
    assert.equal(after.rows[0].total, before.rows[0].total);
  } finally {
    await pg.close();
  }
});

test('PostgreSQL rollbacka troca de principal quando promoção falha', async () => {
  const pg = new PGlite();
  try {
    const migrations = join(__dirname, '../migrations');
    for (const file of readdirSync(migrations).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      await pg.exec(
        readFileSync(join(migrations, file), 'utf8')
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''),
      );
    }
    await pg.exec(readFileSync(join(__dirname, '../scripts/seed-dev-synthetic.sql'), 'utf8'));
    await pg.exec(`
      CREATE OR REPLACE FUNCTION force_principal_promote_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.principal = true AND NEW.cliente_local_id = '${SEED_IDS.clienteLocalB}' THEN
          RAISE EXCEPTION 'forced principal promote failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_force_principal_promote_failure
      BEFORE UPDATE ON obra_locais
      FOR EACH ROW EXECUTE PROCEDURE force_principal_promote_failure();
    `);
    const db = dbClient(pg);
    await assert.rejects(
      () => service(db).setPrincipal(ctx, SEED_IDS.clientePjA, SEED_IDS.obraA, SEED_IDS.clienteLocalB),
      /forced principal promote failure/,
    );
    const principals = await pg.query<{ cliente_local_id: string; principal: boolean; ativo: boolean }>(`
      SELECT cliente_local_id, principal, ativo FROM obra_locais
      WHERE obra_id='${SEED_IDS.obraA}'
      ORDER BY principal DESC, cliente_local_id
    `);
    const primary = principals.rows.filter((row) => row.principal && row.ativo);
    assert.equal(primary.length, 1);
    assert.equal(primary[0].cliente_local_id, SEED_IDS.clienteLocalA);
    const secondary = principals.rows.find((row) => row.cliente_local_id === SEED_IDS.clienteLocalB);
    assert.equal(secondary?.principal, false);
  } finally {
    await pg.close();
  }
});
