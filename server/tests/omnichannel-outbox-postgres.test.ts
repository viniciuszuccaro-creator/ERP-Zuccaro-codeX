import assert from 'node:assert/strict';
import test from 'node:test';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { PostgresProdutoRepository } from '../src/repositories/postgresProdutoRepository.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

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
