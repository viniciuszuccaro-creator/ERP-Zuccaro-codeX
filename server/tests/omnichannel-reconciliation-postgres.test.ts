import assert from 'node:assert/strict';
import test from 'node:test';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;
test('PostgreSQL reconciliation preserves microsecond cursors and converges concurrent scan writes', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  try {
    for (let i=0;i<3;i++) await f.event();
    const leases = await f.outbox.claim(f.ctx);
    for (const lease of leases) await f.outbox.finish(f.ctx, lease, { status: 'published' });
    const ids: string[] = []; let cursor: { id: string; createdAt: string } | undefined;
    do {
      const page = await f.outbox.publishedPage(f.ctx, 1, cursor); assert.equal(page.items.length, 1);
      ids.push(page.items[0].id);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    const source = (await f.outbox.publishedPage(f.ctx, 1)).items[0];
    const results = await Promise.all(Array.from({ length: 8 }, () => f.outbox.recordReconciliation(f.ctx, source, 'synthetic', 'same-scan', 'MISSING', null)));
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='catalogo.reconciliado'")).rows.length, 1);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='create'")).rows.length, 1);
  } finally { await f.close(); }
});
