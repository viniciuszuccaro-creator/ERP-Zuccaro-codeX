import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  InMemoryAuditRepository,
  PostgresAuditRepository,
} from '../src/audit/auditRepository.ts';
import type { AuditEntry, AuditRepository, RequestContext } from '../src/audit/types.ts';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { PostgresClienteLocalRepository } from '../src/repositories/postgresClienteLocalRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { InMemoryClienteLocalRepository } from '../src/repositories/inMemoryClienteLocalRepository.ts';
import { createInMemoryClienteRepo } from '../src/repositories/inMemoryClienteRepository.ts';
import { ClienteLocalService } from '../src/services/clienteLocalService.ts';
import { ClienteService } from '../src/services/clienteService.ts';
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
        cliente: ['visualizar', 'criar'],
        cliente_local: [
          'visualizar', 'criar', 'editar', 'inativar', 'restaurar', 'principal',
        ],
      },
    },
  });
  return new ClienteLocalService(
    new PostgresClienteLocalRepository(db),
    new PostgresClienteRepository(db),
    new PostgresAuditRepository(db),
    tenant,
    rbac,
  );
}

const ctx: RequestContext = {
  requestId: 'runtime06a-audit-failure',
  groupId: SEED_IDS.groupA,
  actorId: SEED_IDS.runtimeActorA,
  scopeType: 'grupo',
};

test('PostgreSQL rollbacka PATCH e SET_PRIMARY quando auditoria falha', async () => {
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
      CREATE OR REPLACE FUNCTION force_cliente_local_audit_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.entity = 'ClienteLocal' THEN
          RAISE EXCEPTION 'AUDIT_FORCED_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_force_cliente_local_audit_failure
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_cliente_local_audit_failure();
    `);

    const localService = service(dbClient(pg));
    await assert.rejects(
      () => localService.update(
        ctx,
        SEED_IDS.clientePjA,
        SEED_IDS.clienteLocalA,
        { logradouro: 'Rua B' },
      ),
      /AUDIT_FORCED_FAILURE/,
    );
    const unchanged = await pg.query<{ logradouro: string }>(`
      SELECT logradouro FROM cliente_locais WHERE id='${SEED_IDS.clienteLocalA}'
    `);
    assert.equal(unchanged.rows[0].logradouro, 'RUA SINTETICA A');

    await assert.rejects(
      () => localService.setFinalidades(
        ctx,
        SEED_IDS.clientePjA,
        SEED_IDS.clienteLocalC,
        { finalidades: [{ finalidade: 'ENTREGA', principal: true }] },
      ),
      /AUDIT_FORCED_FAILURE/,
    );
    const principals = await pg.query<{ cliente_local_id: string }>(`
      SELECT cliente_local_id FROM cliente_local_finalidades
      WHERE group_id='${SEED_IDS.groupA}'
        AND cliente_id='${SEED_IDS.clientePjA}'
        AND finalidade='ENTREGA'
        AND principal=true
        AND ativo=true
    `);
    assert.deepEqual(principals.rows, [{ cliente_local_id: SEED_IDS.clienteLocalB }]);
  } finally {
    await pg.close();
  }
});

class FailingAuditRepository implements AuditRepository {
  async append(_entry: AuditEntry, _executor?: DbQueryExecutor): Promise<void> {
    throw new Error('AUDIT_FORCED_FAILURE');
  }

  async listByEntity(): Promise<AuditEntry[]> {
    return [];
  }
}

test('in-memory rollbacka ClienteLocal quando auditoria falha', async () => {
  const clienteRepo = createInMemoryClienteRepo();
  const localRepo = new InMemoryClienteLocalRepository();
  const tenant = new InMemoryTenantGuard();
  const rbac = new InMemoryRbacGuard();
  rbac.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: {
      Cadastros: {
        cliente: ['visualizar', 'criar'],
        cliente_local: ['visualizar', 'criar', 'editar', 'principal'],
      },
    },
  });
  const audit = new InMemoryAuditRepository();
  const cliente = await new ClienteService(clienteRepo, audit, tenant, rbac).create(ctx, {
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'Cliente Local Atomicidade',
  });
  const normal = new ClienteLocalService(localRepo, clienteRepo, audit, tenant, rbac);
  const local = await normal.create(ctx, cliente.id, {
    nome: 'Local Antes',
    cep: '00000001',
    logradouro: 'Rua A',
    numero: 'S/N',
    bairro: 'Bairro',
    cidade: 'Cidade',
    uf: 'SP',
    pais: 'BRASIL',
    finalidades: [{ finalidade: 'ENTREGA', principal: false }],
  });
  const failing = new ClienteLocalService(
    localRepo,
    clienteRepo,
    new FailingAuditRepository(),
    tenant,
    rbac,
  );
  await assert.rejects(
    () => failing.update(ctx, cliente.id, local.id, { logradouro: 'Rua B' }),
    /AUDIT_FORCED_FAILURE/,
  );
  assert.equal((await normal.get(ctx, cliente.id, local.id)).logradouro, 'Rua A');
});
