import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { PostgresProdutoOutboxRepository } from '../src/repositories/postgresProdutoOutboxRepository.ts';
import type { AuditRepository } from '../src/audit/types.ts';
import { SEED_IDS } from '../scripts/seedDevIds.ts';

const enabled = Boolean(process.env.DATABASE_URL);

test('R15 PostgreSQL: claim concorrente, tenant e lease impedem resposta atrasada',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
    const repo = new PostgresProdutoOutboxRepository(db);
    const id = randomUUID();
    const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: randomUUID(), requestId: `r15-${id}` };
    try {
      await db.query(
        `INSERT INTO integration_events (id,group_id,empresa_id,source,event_type,idempotency_key,payload,status,max_attempts)
         VALUES ($1,$2,$3,'ERP','produto.publicado',$4,'{"produtoId":"synthetic"}'::jsonb,'pending',2)`,
        [id, scope.groupId, scope.empresaId, `r15-${id}`],
      );
      const [first, second] = await Promise.all([repo.claim(scope), repo.claim(scope)]);
      assert.equal(first.length + second.length, 1);
      const lease = first[0] ?? second[0];
      assert.equal(lease?.id, id);
      assert.equal(lease?.attempts, 1);
      assert.deepEqual(await repo.claim({ groupId: SEED_IDS.groupB, empresaId: SEED_IDS.empresaB }), []);
      assert.equal(await repo.complete({ groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA2 }, lease), false);
      assert.equal(await repo.complete(scope, { ...lease, attempts: 0 }), false);
      assert.equal(await repo.fail(scope, lease, 1), 'retry');
      assert.equal(await repo.complete(scope, lease), false);
      assert.deepEqual(await repo.claim(scope), []);
      await db.query('UPDATE integration_events SET next_attempt_at=clock_timestamp()-interval \'1 second\' WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      const retried = (await repo.claim(scope))[0];
      assert.equal(retried?.attempts, 2);
      assert.equal(await repo.fail(scope, retried, 1), 'dead_letter');
      assert.deepEqual(await repo.claim(scope), []);
      const state = await db.query<{ status: string; attempts: number; dead_letter_at: Date | null }>(
        'SELECT status,attempts,dead_letter_at FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId],
      );
      assert.equal(state.rows[0]?.status, 'dead_letter');
      assert.equal(state.rows[0]?.attempts, 2);
      assert.ok(state.rows[0]?.dead_letter_at);
    } finally {
      await db.query("DELETE FROM audit_logs WHERE entity='IntegrationEvent' AND entity_id=$1 AND group_id=$2 AND empresa_id=$3", [id, scope.groupId, scope.empresaId]);
      await db.query('DELETE FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await db.end();
    }
  });

test('R15 PostgreSQL: lease expirado pode ser recuperado, publicacao exige token vigente',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
    const repo = new PostgresProdutoOutboxRepository(db);
    const id = randomUUID();
    const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: randomUUID(), requestId: `r15-${id}` };
    try {
      await db.query(
        `INSERT INTO integration_events (id,group_id,empresa_id,source,event_type,idempotency_key,payload,status,max_attempts)
         VALUES ($1,$2,$3,'ERP','produto.publicado',$4,'{}'::jsonb,'pending',3)`,
        [id, scope.groupId, scope.empresaId, `r15-${id}`],
      );
      const oldLease = (await repo.claim(scope))[0];
      assert.equal(oldLease?.id, id);
      await db.query('UPDATE integration_events SET locked_until=clock_timestamp()-interval \'1 second\' WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      assert.equal(await repo.complete(scope, oldLease), false);
      const currentLease = (await repo.claim(scope))[0];
      assert.equal(currentLease?.attempts, 2);
      assert.equal(await repo.complete(scope, oldLease), false);
      assert.equal(await repo.complete(scope, currentLease), true);
      assert.equal(await repo.complete(scope, currentLease), false);
      const state = await db.query<{ status: string; published_at: Date | null }>(
        'SELECT status,published_at FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId],
      );
      assert.equal(state.rows[0]?.status, 'published');
      assert.ok(state.rows[0]?.published_at);
    } finally {
      await db.query("DELETE FROM audit_logs WHERE entity='IntegrationEvent' AND entity_id=$1 AND group_id=$2 AND empresa_id=$3", [id, scope.groupId, scope.empresaId]);
      await db.query('DELETE FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await db.end();
    }
  });

test('R15 PostgreSQL: falha de auditoria rollbacka claim, retry e confirmacao',
  { skip: !enabled && 'DATABASE_URL not available' }, async () => {
    const db = createDbClient(loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'true', DATABASE_URL: process.env.DATABASE_URL }));
    const repo = new PostgresProdutoOutboxRepository(db);
    const failedAudit: AuditRepository = {
      async append() { throw new Error('AUDIT_SYNTHETIC_FAILURE'); },
      async listByEntity() { return []; },
    };
    const failing = new PostgresProdutoOutboxRepository(db, failedAudit);
    const id = randomUUID();
    const scope = { groupId: SEED_IDS.groupA, empresaId: SEED_IDS.empresaA, actorId: randomUUID(), requestId: `r15-${id}` };
    try {
      await db.query(
        `INSERT INTO integration_events (id,group_id,empresa_id,source,event_type,idempotency_key,payload,status)
         VALUES ($1,$2,$3,'ERP','produto.publicado',$4,'{}'::jsonb,'pending')`,
        [id, scope.groupId, scope.empresaId, `r15-${id}`],
      );
      await assert.rejects(failing.claim(scope), /AUDIT_SYNTHETIC_FAILURE/);
      const pending = await db.query<{ status: string; attempts: number }>(
        'SELECT status,attempts FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId],
      );
      assert.deepEqual(pending.rows[0], { status: 'pending', attempts: 0 });
      const lease = (await repo.claim(scope))[0];
      assert.equal(lease?.id, id);
      await assert.rejects(failing.fail(scope, lease, 1), /AUDIT_SYNTHETIC_FAILURE/);
      await assert.rejects(failing.complete(scope, lease), /AUDIT_SYNTHETIC_FAILURE/);
      const processing = await db.query<{ status: string; attempts: number }>(
        'SELECT status,attempts FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId],
      );
      assert.deepEqual(processing.rows[0], { status: 'processing', attempts: 1 });
      assert.equal(await repo.complete(scope, lease), true);
      const logs = await db.query<{ after_data: { status: string }; actor_id: string; request_id: string }>(
        "SELECT after_data,actor_id,request_id FROM audit_logs WHERE entity='IntegrationEvent' AND entity_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY created_at",
        [id, scope.groupId, scope.empresaId],
      );
      assert.deepEqual(logs.rows.map((row) => row.after_data.status), ['processing', 'published']);
      assert.ok(logs.rows.every((row) => row.actor_id === scope.actorId && row.request_id === scope.requestId));
    } finally {
      await db.query("DELETE FROM audit_logs WHERE entity='IntegrationEvent' AND entity_id=$1 AND group_id=$2 AND empresa_id=$3", [id, scope.groupId, scope.empresaId]);
      await db.query('DELETE FROM integration_events WHERE id=$1 AND group_id=$2 AND empresa_id=$3', [id, scope.groupId, scope.empresaId]);
      await db.end();
    }
  });
