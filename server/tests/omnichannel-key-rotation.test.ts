import assert from 'node:assert/strict';
import test from 'node:test';
import { signSale, verifySale } from '../src/integrations/saleIngressContract.js';
import { loadChannelIdentities } from '../src/integrations/saleIngressHttp.js';
import { identity, now, boot } from './omnichannelFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

const old = 'synthetic-previous-secret-only-never-use-live-123';
const rotating = { ...identity,previousKey:{ secret:old,validFrom:new Date(now-60000).toISOString(),validUntil:new Date(now+60000).toISOString() } };
const body = Buffer.from('{}'); const nonce = 'synthetic_rotation_nonce'; const timestamp = String(Math.floor(now/1000));
const signed = (secret: string, time=timestamp) => signSale(secret,identity.id,time,nonce,body);

test('rotation accepts current key and bounded previous overlap without weakening timestamp/body/client binding', () => {
  verifySale(rotating,timestamp,nonce,signed(identity.secret),body,now);
  verifySale(rotating,timestamp,nonce,signed(old),body,now);
  assert.throws(() => verifySale(rotating,timestamp,nonce,signed(old),body,now+60000));
  assert.throws(() => verifySale(rotating,timestamp,nonce,signed(old),body,now-60001));
  const before = String(Math.floor((now-61000)/1000));
  assert.throws(() => verifySale(rotating,before,nonce,signed(old,before),body,now));
  assert.throws(() => verifySale(rotating,timestamp,nonce,signed(old),Buffer.from('{"tampered":true}'),now));
  assert.throws(() => verifySale({ ...rotating,id:'other-client' },timestamp,nonce,signed(old),body,now));
  verifySale(rotating,timestamp,nonce,signed(identity.secret),body,now+60000);
});

test('rotation configuration rejects indefinite/reversed overlaps and does not reveal secret in errors', () => {
  for (const until of [now-60000,now-61000,now+86400000]) {
    assert.throws(() => loadChannelIdentities({ ERP_OMNICHANNEL_ENABLED:'true',ERP_OMNICHANNEL_IDENTITIES:JSON.stringify([
      { ...rotating,previousKey:{ ...rotating.previousKey,validUntil:new Date(until).toISOString() } },
    ]) }), (e: unknown) => !String(e).includes(old) && String(e).includes('Invalid omnichannel identity configuration'));
  }
  assert.equal(loadChannelIdentities({ ERP_OMNICHANNEL_ENABLED:'true',ERP_OMNICHANNEL_IDENTITIES:JSON.stringify([rotating]) }).length,1);
});

test('rotation retains idempotency and current permissions through the real HTTP/canonical stack', async () => {
  const f = await boot(undefined,[{ ...rotating,id:'synthetic-rotating' }]);
  try {
    const i = { ...rotating,id:'synthetic-rotating' };
    const bytes = Buffer.from(JSON.stringify(f.envelope));
    assert.equal((await f.send(f.envelope,{ channel:i.id,nonce,signature:signSale(old,i.id,timestamp,nonce,bytes) })).status,201);
    const retryNonce = 'synthetic_rotation_retry';
    assert.equal((await f.send(f.envelope,{ channel:i.id,nonce:retryNonce,signature:signSale(i.secret,i.id,timestamp,retryNonce,bytes) })).status,200);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    assert.equal((await f.send(f.envelope,{ channel:i.id,nonce:retryNonce,signature:signSale(i.secret,i.id,timestamp,retryNonce,bytes) })).status,403);
  } finally { await f.close(); }
});
