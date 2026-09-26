import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogOutboxWorker } from '../src/integrations/catalogOutboxWorker.js';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

test('catalog worker filters existing events, validates signal and receipt and audits outcomes without provider PII', async () => {
  const f = await outboxFixture();
  try {
    const published = await f.event(); const invalid = await f.event({ payload: { secret: 'PRIVATE_SYNTHETIC' } });
    await f.event({ empresa: S.empresaA2 }); await f.event({ type: 'venda.recebida' });
    const inputs: unknown[] = [];
    const worker = new CatalogOutboxWorker(f.outbox, { publish: async (input) => { inputs.push(input); return { eventId: input.eventId, key: input.key }; } });
    assert.deepEqual(await worker.runOnce(f.ctx), { published: 1, retry: 0, dead_letter: 1 });
    assert.equal(inputs.length, 1); assert.ok(!JSON.stringify(inputs).includes('PRIVATE_SYNTHETIC'));
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1', [published])).rows[0].status, 'published');
    assert.equal((await f.pg.query('SELECT status FROM integration_events WHERE id=$1', [invalid])).rows[0].status, 'dead_letter');
    const summary = await f.outbox.summary(f.ctx);
    assert.deepEqual(summary, [{ status: 'dead_letter', total: 1 }, { status: 'published', total: 1 }]);
    assert.ok(!JSON.stringify((await f.pg.query('SELECT * FROM audit_logs')).rows).includes('PRIVATE_SYNTHETIC'));
  } finally { await f.close(); }
});

test('catalog lease fences stale outcomes, expires to retry and preserves generation on explicit reprocess', async () => {
  const f = await outboxFixture();
  try {
    const id = await f.event({ max: 2 });
    const [first] = await f.outbox.claim(f.ctx);
    await assert.rejects(() => f.outbox.finish(f.ctx, { ...first, key: 'wrong-key' }, { status: 'published' }));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await f.pg.query("UPDATE integration_events SET locked_until=clock_timestamp()-interval '1 second' WHERE id=$1", [id]);
    const [second] = await f.outbox.claim(f.ctx);
    assert.equal(second.attempt, 2);
    await assert.rejects(() => f.outbox.finish(f.ctx, first, { status: 'published' }), (e: unknown) => (e as { code: string }).code === 'OUTBOX_LEASE_STALE');
    assert.equal(await f.outbox.finish(f.ctx, second, { status: 'retry', code: 'SYNTHETIC_TRANSIENT' }), 'dead_letter');
    await f.outbox.reprocess(f.ctx, id, 2);
    const [third] = await f.outbox.claim(f.ctx); assert.equal(third.attempt, 3); assert.equal(third.key, first.key);
    await assert.rejects(() => f.outbox.finish(f.ctx, second, { status: 'published' }));
    assert.equal(await f.outbox.finish(f.ctx, third, { status: 'published' }), 'published');
  } finally { await f.close(); }
});

test('catalog permissions and tenant are rechecked for every outcome; audit failure rolls back claim and completion', async () => {
  const f = await outboxFixture();
  try {
    await f.event();
    await assert.rejects(() => f.outbox.claim({ ...f.ctx, empresaId: S.empresaB }));
    await assert.rejects(() => f.outbox.claim({ ...f.ctx, empresaId: null }));
    await f.pg.exec(`CREATE FUNCTION reject_catalog_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' AND NEW.action='update' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER catalog_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit();`);
    await assert.rejects(() => f.outbox.claim(f.ctx));
    assert.equal((await f.pg.query('SELECT attempts FROM integration_events')).rows[0].attempts, 0);
    await f.pg.exec('DROP TRIGGER catalog_fail ON audit_logs');
    const [lease] = await f.outbox.claim(f.ctx);
    await f.pg.query('UPDATE profiles SET ativo=false WHERE id=$1', [S.runtimeActorA]);
    await assert.rejects(() => f.outbox.finish(f.ctx, lease, { status: 'published' }));
    await f.pg.query('UPDATE profiles SET ativo=true WHERE id=$1', [S.runtimeActorA]);
    await f.pg.exec('CREATE TRIGGER catalog_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit()');
    await assert.rejects(() => f.outbox.finish(f.ctx, lease, { status: 'published' }));
    assert.equal((await f.pg.query('SELECT status FROM integration_events')).rows[0].status, 'processing');
  } finally { await f.close(); }
});

test('provider exception retries safely, invalid ACK is dead-letter and no external text is persisted', async () => {
  const f = await outboxFixture();
  try {
    const id = await f.event();
    const failed = new CatalogOutboxWorker(f.outbox, { publish: async () => { throw new Error('PRIVATE_PROVIDER_SYNTHETIC'); } });
    assert.deepEqual(await failed.runOnce(f.ctx), { published: 0, retry: 1, dead_letter: 0 });
    assert.ok(!JSON.stringify((await f.pg.query('SELECT error_message FROM integration_events')).rows).includes('PRIVATE_PROVIDER_SYNTHETIC'));
    assert.deepEqual(await f.outbox.claim(f.ctx), []);
    await f.pg.query('UPDATE integration_events SET next_attempt_at=clock_timestamp() WHERE id=$1', [id]);
    const badAck = new CatalogOutboxWorker(f.outbox, { publish: async () => ({ eventId: 'wrong', key: 'wrong' }) });
    assert.deepEqual(await badAck.runOnce(f.ctx), { published: 0, retry: 0, dead_letter: 1 });
    await f.pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify({ Integracoes: { catalogo: ['publicar'] } }), S.runtimeActorA]);
    await assert.rejects(() => f.outbox.reprocess(f.ctx, id, 1));
  } finally { await f.close(); }
});

test('a product no longer published is not sent by a queued publication signal', async () => {
  const f = await outboxFixture();
  try {
    await f.event();
    await f.pg.query("UPDATE produtos SET workflow_status='INATIVO' WHERE id=$1", [S.produtoA]);
    const worker = new CatalogOutboxWorker(f.outbox, { publish: async () => { assert.fail('Provider must not be called'); } });
    assert.deepEqual(await worker.runOnce(f.ctx), { published: 0, retry: 0, dead_letter: 1 });
    assert.equal((await f.pg.query('SELECT error_message FROM integration_events')).rows[0].error_message, 'CATALOG_SOURCE_CHANGED');
  } finally { await f.close(); }
});
