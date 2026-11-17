import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresClienteLocalRepository } from '../src/repositories/postgresClienteLocalRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { ClienteLocalService } from '../src/services/clienteLocalService.ts';

const url = process.env.DATABASE_URL;
test('local batch real PostgreSQL: two connections contend, one CAS wins, audit rolls back',
  { skip: !url }, async () => {
    if (!url) throw new Error('ISOLATED_TEST_URL_REQUIRED');
    const f = await realCrmFixture(url);
    const blocker = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
      const rbac = new InMemoryRbacGuard();
      rbac.link({ actorId: ID.runtimeActorA, groupId: ID.groupA,
        permissions: { Cadastros: { cliente_local: ['visualizar', 'editar'] } } });
      const service = new ClienteLocalService(new PostgresClienteLocalRepository(f.admin),
        new PostgresClienteRepository(f.admin), new PostgresAuditRepository(f.admin),
        new InMemoryTenantGuard(), rbac);
      const ctx = { groupId: ID.groupA, actorId: ID.runtimeActorA, requestId: 'synthetic-local-cas' };
      const initial = await service.snapshot(ctx, ID.clientePjA);
      const id = initial.data[0].id;
      const audits = async () => (await f.admin.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_logs WHERE entity='ClienteLocal'")).rows[0].n;
      const count = await audits();
      await blocker.connect();
      await blocker.query(`SET search_path TO "${f.schema}",pg_catalog`);
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM clientes WHERE group_id=$1 AND id=$2 FOR UPDATE', [ctx.groupId, ID.clientePjA]);
      const attempts = Promise.allSettled(['A', 'B'].map(value => service.sync(ctx, ID.clientePjA, {
        version: initial.version, operations: [{ op: 'update', id, data: { referencia: `Synthetic winner ${value}` } }],
      })));
      let queued = false;
      try {
        for (let i = 0; i < 120; i++) {
          await blocker.query('SELECT pg_stat_clear_snapshot()');
          const waiting = await blocker.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM clientes%'");
          if (waiting.rows[0].n === 2) { queued = true; break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally { await blocker.query('ROLLBACK'); }
      const results = await attempts;
      assert.equal(queued, true, 'both independent connections must wait on the parent lock');
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = results.find(result => result.status === 'rejected');
      assert.equal(rejected?.status === 'rejected' && rejected.reason.code, 'CLIENTE_LOCAIS_VERSION_CONFLICT');
      assert.equal(await audits(), count + 1);
      const beforeFailure = await service.snapshot(ctx, ID.clientePjA);
      const failing = new ClienteLocalService(new PostgresClienteLocalRepository(f.admin),
        new PostgresClienteRepository(f.admin), {
          append: async () => { throw new Error('SYNTHETIC_AUDIT_FAILURE'); }, listByEntity: async () => [],
        }, new InMemoryTenantGuard(), rbac);
      await assert.rejects(failing.sync(ctx, ID.clientePjA, { version: beforeFailure.version, operations: [
        { op: 'update', id, data: { referencia: 'Must roll back' } },
      ] }), /SYNTHETIC_AUDIT_FAILURE/);
      assert.equal((await service.snapshot(ctx, ID.clientePjA)).version, beforeFailure.version);
      assert.equal(await audits(), count + 1);
      rbac.link({ actorId: ID.runtimeActorA, groupId: ID.groupA, permissions: { Cadastros: {
        cliente: ['importar'], cliente_local: ['visualizar', 'criar', 'editar', 'restaurar'],
      } } });
      const pending = await service.createMigrationPending(ctx, ID.clientePjA, {
        nome: '', cep: '01310100', logradouro: 'Rua review PG', numero: '', bairro: 'Bairro', cidade: 'Cidade',
        uf: 'SP', pais: '', origem: 'MIGRACAO', legacy_id: 'synthetic-pg-review', source_system: 'SYNTHETIC',
        migration_batch: 'synthetic-pg-review', imported_at: '2026-11-12T00:00:00Z',
        endereco_incompleto: true, ativo: false, finalidades: [{ finalidade: 'ENTREGA', principal: false }],
      });
      const review = await service.snapshot(ctx, ID.clientePjA, true), reviewAudits = await audits();
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM clientes WHERE group_id=$1 AND id=$2 FOR UPDATE', [ctx.groupId, ID.clientePjA]);
      const reviews = Promise.allSettled(['A', 'B'].map(value => service.sync(ctx, ID.clientePjA, {
        version: review.version, review_version: review.reviewVersion, operations: [{ op: 'review', id: pending.id,
          data: { nome: `Synthetic ${value}`, numero: '42', pais: 'BRASIL' } }],
      })));
      let reviewQueued = false;
      try {
        for (let i = 0; i < 120; i++) {
          await blocker.query('SELECT pg_stat_clear_snapshot()');
          const waiting = await blocker.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM clientes%'");
          if (waiting.rows[0].n === 2) { reviewQueued = true; break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally { await blocker.query('ROLLBACK'); }
      const done = await reviews;
      assert.equal(reviewQueued, true);
      assert.equal(done.filter(x => x.status === 'fulfilled').length, 1);
      const loser = done.find(x => x.status === 'rejected');
      assert.equal(loser?.status === 'rejected' && loser.reason.code, 'CLIENTE_LOCAIS_VERSION_CONFLICT');
      const stable = await service.snapshot(ctx, ID.clientePjA, true);
      await assert.rejects(failing.sync(ctx, ID.clientePjA, { version: stable.version, review_version: stable.reviewVersion,
        operations: [{ op: 'review', id: pending.id, data: { nome: 'Must roll back' }, activate: true }] }), /SYNTHETIC_AUDIT_FAILURE/);
      assert.equal((await service.snapshot(ctx, ID.clientePjA, true)).reviewVersion, stable.reviewVersion);
      assert.equal(await audits(), reviewAudits + 1);
      const saved = (await service.list(ctx, ID.clientePjA, { ativo: false })).data.find(x => x.id === pending.id);
      assert.equal(saved?.endereco_incompleto, false); assert.equal(saved?.ativo, false);
      assert.equal(saved?.legacy_id, pending.legacy_id);
    } finally { await blocker.end(); await f.close(); }
  });
