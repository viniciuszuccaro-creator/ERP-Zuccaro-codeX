import assert from 'node:assert/strict';
import test from 'node:test';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { PostgresProdutoRepository } from '../src/repositories/postgresProdutoRepository.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';
import { CatalogOutbox } from '../src/integrations/catalogOutbox.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;
test('PostgreSQL outbox claims are disjoint under concurrent consumers and preserve original Produto publisher', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    await f.pg.exec('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    const repo = new PostgresProdutoRepository(f.db);
    const product = await repo.getById({ groupId: S.groupA, empresaId: S.empresaA }, S.produtoA);
    assert.ok(product);
    // Actual existing producer, with synthetic approved product signal and its idempotence intact.
    for (let i = 0; i < 8; i++) {
      await repo.appendPublicationEvent({ groupId: S.groupA, empresaId: S.empresaA }, { ...product, workflow_status: 'PUBLICADO' }, `synthetic-${i}`);
    }
    await repo.appendPublicationEvent({ groupId: S.groupA, empresaId: S.empresaA }, { ...product, workflow_status: 'PUBLICADO' }, 'synthetic-0');
    const leases = (await Promise.all(Array.from({ length: 4 }, () => f.outbox.claim(f.ctx, 2)))).flat();
    assert.equal(leases.length, 8); assert.equal(new Set(leases.map((x) => x.id)).size, 8);
    assert.ok(leases.every((x) => x.attempt === 1));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await Promise.all(leases.map((lease) => f.outbox.finish(f.ctx, lease, { status: 'published' })));
    assert.deepEqual(await f.outbox.summary(f.ctx), [{ status: 'published', total: 8 }]);
  } finally { await f.close(); }
});

test('real PostgreSQL failure triage preserves microsecond cursors, metadata privacy, audit atomicity and permission revocation', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    const own = await Promise.all(Array.from({ length: 3 }, () => f.event()));
    const other = await f.event({ empresa: S.empresaA2 });
    const unrelated = await f.event({ type: 'unrelated.event' });
    const live = await f.event();
    await f.pg.query("UPDATE integration_events SET status='dead_letter',error_message='PRIVATE_PROVIDER_VALUE' WHERE id=ANY($1::uuid[])", [[...own,other,unrelated]]);
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE id=ANY($1::uuid[])", [own]);
    await f.pg.query("UPDATE integration_events SET status='retry',error_message='CATALOG_PROVIDER_UNAVAILABLE' WHERE id=$1", [own[1]]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()-interval '1 second',error_message=NULL WHERE id=$1", [own[2]]);
    await f.pg.query("UPDATE integration_events SET status='processing',locked_until=now()+interval '1 hour' WHERE id=$1", [live]);
    const before = (await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows;
    let cursor: { id: string; createdAt: string } | undefined;
    const found: string[] = [];
    // Bound iteration explicitly: a timestamp precision regression fails instead of hanging CI.
    for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
      const page = await f.outbox.failures(f.ctx, 1, cursor);
      assert.equal(page.items.length, 1);
      assert.equal(page.items[0].createdAt, '2026-01-01T00:00:00.123456Z');
      assert.equal(page.reprocessApplied, false);
      assert.ok(!JSON.stringify(page).includes('PRIVATE_PROVIDER_VALUE'));
      assert.ok(!('payload' in page.items[0])); assert.ok(!('key' in page.items[0]));
      found.push(page.items[0].id);
      if (!page.hasMore) break;
      assert.ok(page.nextCursor); cursor = page.nextCursor;
    }
    assert.deepEqual(found.sort(), [...own].sort());
    const full = await f.outbox.failures(f.ctx);
    assert.equal(full.items.find((r) => r.id === own[0])?.code, 'OUTBOX_ERROR_REDACTED');
    assert.equal(full.items.find((r) => r.id === own[1])?.code, 'CATALOG_PROVIDER_UNAVAILABLE');
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows, before);
    const auditCount = async () => (await f.pg.query<{ total: number }>('SELECT count(*)::int total FROM audit_logs')).rows[0].total;
    const count = await auditCount();
    assert.ok(count >= 4);
    // Append the real audit in the same transaction, then simulate its failure; no partial audit may commit.
    const failing = new CatalogOutbox(f.db, { ...f.runtime, auditRepo: { ...f.runtime.auditRepo,
      append: async (...args: Parameters<typeof f.runtime.auditRepo.append>) => {
        await f.runtime.auditRepo.append(...args); throw new Error('synthetic audit failure');
      },
    } });
    await assert.rejects(failing.failures(f.ctx), /synthetic audit failure/);
    assert.equal(await auditCount(), count);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1", [S.runtimeActorA]);
    await assert.rejects(f.outbox.failures(f.ctx), (e: any) => e.statusCode === 403);
    assert.equal(await auditCount(), count);
    assert.deepEqual((await f.pg.query('SELECT * FROM integration_events ORDER BY id')).rows, before);
  } finally { await f.close(); }
});
