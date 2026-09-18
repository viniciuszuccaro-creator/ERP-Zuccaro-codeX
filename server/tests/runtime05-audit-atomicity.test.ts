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
import { createInMemoryClienteRepo } from '../src/repositories/inMemoryClienteRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { ClienteEmpresaOperations } from '../src/services/clienteEmpresaOperations.ts';
import { ClienteService } from '../src/services/clienteService.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMPRESA_A3 = 'c3c3c3c3-cccc-4ccc-8ccc-c3c3c3c3c3c3';

function pgliteClient(db: PGlite): DbClient {
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

function tenantGuard() {
  const guard = new InMemoryTenantGuard();
  guard.link(SEED_IDS.empresaA, SEED_IDS.groupA);
  guard.link(SEED_IDS.empresaA2, SEED_IDS.groupA);
  guard.link(EMPRESA_A3, SEED_IDS.groupA);
  return guard;
}

function rbacGuard() {
  const guard = new InMemoryRbacGuard();
  guard.link({
    actorId: SEED_IDS.runtimeActorA,
    groupId: SEED_IDS.groupA,
    permissions: {
      Cadastros: {
        cliente: ['visualizar', 'criar'],
        cliente_empresa: [
          'visualizar', 'criar', 'editar', 'bloquear', 'inativar', 'restaurar',
        ],
      },
    },
  });
  return guard;
}

const ctx: RequestContext = {
  requestId: 'audit-atomicity',
  groupId: SEED_IDS.groupA,
  actorId: SEED_IDS.runtimeActorA,
  scopeType: 'grupo',
};

test('PostgreSQL rollbacka LINK/UPDATE/BLOCK/UNBLOCK/INACTIVATE/RESTORE se audit falhar', async () => {
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
      INSERT INTO empresas (id, group_id, razao_social)
      VALUES ('${EMPRESA_A3}', '${SEED_IDS.groupA}', 'Empresa A3');

      CREATE OR REPLACE FUNCTION force_cliente_empresa_audit_failure()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.entity = 'ClienteEmpresa' THEN
          RAISE EXCEPTION 'AUDIT_FORCED_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_force_cliente_empresa_audit_failure
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE PROCEDURE force_cliente_empresa_audit_failure();
    `);

    const db = pgliteClient(pg);
    const repo = new PostgresClienteRepository(db);
    const operations = new ClienteEmpresaOperations(
      repo,
      new PostgresAuditRepository(db),
      tenantGuard(),
      rbacGuard(),
    );
    const scope = { groupId: SEED_IDS.groupA };
    const getA = () => repo.getEmpresaLink(scope, SEED_IDS.clientePjA, SEED_IDS.empresaA);

    await assert.rejects(
      () => operations.update(ctx, SEED_IDS.clientePjA, SEED_IDS.empresaA, {
        observacao_comercial: 'DEPOIS',
      }),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal((await getA())?.observacao_comercial, 'Vinculo sintetico liberado Empresa A');

    await assert.rejects(
      () => operations.block(ctx, SEED_IDS.clientePjA, SEED_IDS.empresaA, {
        motivo: 'Bloqueio deve fazer rollback',
      }),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal((await getA())?.bloqueado, false);

    await assert.rejects(
      () => operations.softDelete(ctx, SEED_IDS.clientePjA, SEED_IDS.empresaA),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal((await getA())?.ativo, true);

    await pg.exec(`
      UPDATE cliente_empresas SET
        bloqueado=true,
        motivo_bloqueio='Estado inicial bloqueado',
        bloqueado_em='2026-09-18T00:00:00Z',
        bloqueado_por='${SEED_IDS.runtimeActorA}'
      WHERE cliente_id='${SEED_IDS.clientePjA}' AND empresa_id='${SEED_IDS.empresaA}';
    `);
    await assert.rejects(
      () => operations.unblock(ctx, SEED_IDS.clientePjA, SEED_IDS.empresaA),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal((await getA())?.bloqueado, true);

    await pg.exec(`
      UPDATE cliente_empresas SET
        ativo=false,
        situacao_comercial='INATIVO',
        habilitado_operacao=false,
        bloqueado=false,
        motivo_bloqueio=NULL,
        bloqueado_em=NULL,
        bloqueado_por=NULL
      WHERE cliente_id='${SEED_IDS.clientePjA}' AND empresa_id='${SEED_IDS.empresaA}';
    `);
    await assert.rejects(
      () => operations.restore(ctx, SEED_IDS.clientePjA, SEED_IDS.empresaA),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal((await getA())?.ativo, false);

    await assert.rejects(
      () => operations.create(ctx, SEED_IDS.clientePjA, EMPRESA_A3, {}),
      /AUDIT_FORCED_FAILURE/,
    );
    assert.equal(
      await repo.getEmpresaLink(scope, SEED_IDS.clientePjA, EMPRESA_A3),
      null,
    );

    // Cliente + vínculo indireto + ambas auditorias compartilham a transação.
    const clienteService = new ClienteService(
      repo,
      new PostgresAuditRepository(db),
      tenantGuard(),
      rbacGuard(),
    );
    await assert.rejects(
      () => clienteService.create(ctx, {
        tipo: 'Pessoa Física',
        documento: '390.533.447-05',
        nome: 'Cliente deve fazer rollback',
        empresa_id: EMPRESA_A3,
      }),
      /AUDIT_FORCED_FAILURE/,
    );
    const rolledBackCliente = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total
      FROM clientes WHERE documento_normalizado='39053344705'
    `);
    assert.equal(rolledBackCliente.rows[0].total, 0);

    const audits = await pg.query<{ total: number }>(`
      SELECT count(*)::int AS total FROM audit_logs
      WHERE entity IN ('Cliente', 'ClienteEmpresa')
        AND request_id='audit-atomicity'
    `);
    assert.equal(audits.rows[0].total, 0);
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

test('in-memory preserva rollback equivalente quando auditoria falha', async () => {
  const repo = createInMemoryClienteRepo();
  const guard = tenantGuard();
  const rbac = rbacGuard();
  const normalAudit = new InMemoryAuditRepository();
  const clienteService = new ClienteService(repo, normalAudit, guard, rbac);
  const cliente = await clienteService.create(ctx, {
    tipo: 'Pessoa Física',
    documento: '529.982.247-25',
    nome: 'Cliente Atomicidade',
  });
  const setup = new ClienteEmpresaOperations(repo, normalAudit, guard, rbac);
  await setup.create(ctx, cliente.id, SEED_IDS.empresaA, {
    observacao_comercial: 'ANTES',
  });

  const failing = new ClienteEmpresaOperations(
    repo,
    new FailingAuditRepository(),
    guard,
    rbac,
  );
  await assert.rejects(
    () => failing.update(ctx, cliente.id, SEED_IDS.empresaA, {
      observacao_comercial: 'DEPOIS',
    }),
    /AUDIT_FORCED_FAILURE/,
  );
  const persisted = await repo.getEmpresaLink(
    { groupId: SEED_IDS.groupA },
    cliente.id,
    SEED_IDS.empresaA,
  );
  assert.equal(persisted?.observacao_comercial, 'ANTES');
});
