import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelSalesClient, ChannelTransportError } from '../src/integrations/channelSalesClient.js';
import { saleEnvelopeSchema } from '../src/integrations/saleIngressContract.js';
import { boot, identity, now } from './omnichannelFixture.js';

test('server-side channel client creates and queries canonical receipts for all four channels', async () => {
  const f = await boot();
  try {
    for (const channel of ['SITE', 'APP', 'CHATBOT', 'MARKETPLACE']) {
      const client = new ChannelSalesClient({ endpoint: f.endpoint, id: `synthetic-${channel}`, secret: identity.secret,
        allowInsecureLoopback: true }, fetch, () => now);
      const sale = saleEnvelopeSchema.parse({ ...f.envelope, idempotencyKey: channel });
      const created = await client.create(sale); assert.equal(created.replayed, false);
      assert.deepEqual(await client.receipt({ version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: channel }), { data: created.data });
    }
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length, 4);
  } finally { await f.close(); }
});

test('ambiguous committed response retries exact payload with fresh nonce and yields one canonical sale', async () => {
  const f = await boot();
  try {
    const bodies: string[] = []; const nonces: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      bodies.push(String(init!.body)); nonces.push((init!.headers as Record<string, string>)['x-channel-nonce']);
      const response = await fetch(input, init);
      if (bodies.length === 1) { await response.body?.cancel(); throw new Error('Synthetic lost response'); }
      return response;
    };
    const client = new ChannelSalesClient({ endpoint: f.endpoint, id: 'synthetic-SITE', secret: identity.secret,
      allowInsecureLoopback: true }, transport, () => now);
    const result = await client.create(saleEnvelopeSchema.parse(f.envelope));
    assert.equal(result.replayed, true); assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]); assert.notEqual(nonces[0], nonces[1]);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length, 1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length, 1);
  } finally { await f.close(); }
});

test('transport rejects unsafe config and limits retries without exposing provider errors/secrets', async () => {
  const base = { endpoint: 'https://synthetic.invalid/api/v1/integracoes/vendas', id: 'synthetic-SITE', secret: identity.secret };
  for (const endpoint of ['http://remote.invalid/sales', 'https://user:pass@synthetic.invalid/sales', 'https://synthetic.invalid/sales?secret=x']) {
    assert.throws(() => new ChannelSalesClient({ ...base, endpoint }), ChannelTransportError);
  }
  assert.throws(() => new ChannelSalesClient({ ...base, attempts: 4 }), ChannelTransportError);
  let calls = 0;
  const response: typeof fetch = async () => { calls++; return new Response('Synthetic private error', { status: 503 }); };
  const client = new ChannelSalesClient(base, response, () => now);
  const query = { version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: 'synthetic' } as const;
  await assert.rejects(() => client.receipt(query), (e: unknown) => e instanceof ChannelTransportError
    && e.status === 503 && !e.message.includes('Synthetic private error') && !e.message.includes(identity.secret));
  assert.equal(calls, 3);
  for (const status of [401, 403, 404, 409, 422, 429]) {
    calls = 0;
    const rejected = new ChannelSalesClient(base, async () => { calls++; return new Response('private', { status }); });
    await assert.rejects(() => rejected.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.status === status);
    assert.equal(calls, 1);
  }
  const malformed = new ChannelSalesClient(base, async () => new Response(JSON.stringify({ data: { id: 'bad', tipo: 'Pedido' } }), { status: 200 }));
  await assert.rejects(() => malformed.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.code === 'CHANNEL_CLIENT_RESPONSE_INVALID');
  calls = 0;
  const invalidJson = new ChannelSalesClient(base, async () => { calls++; return new Response('Synthetic invalid JSON', { status: 200 }); });
  await assert.rejects(() => invalidJson.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.code === 'CHANNEL_CLIENT_RESPONSE_INVALID');
  assert.equal(calls, 1);
});
