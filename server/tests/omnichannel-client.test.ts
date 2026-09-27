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

test('receipt decoding bounds actual streamed bytes, accepts bounded fragmented JSON and rejects malformed UTF-8 without retry', async () => {
  const base={ endpoint:'https://synthetic.invalid/sales',id:'synthetic-SITE',secret:identity.secret };
  const query={version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'synthetic'} as const;
  const payload={data:{id:'11111111-1111-4111-8111-111111111111',tipo:'Pedido'}};
  let cancelled=0,calls=0;
  const stream=new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(16*1024+1)); },
    cancel() { cancelled++; },
  });
  const oversized=new ChannelSalesClient(base,async()=>{calls++;return new Response(stream);});
  await assert.rejects(oversized.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_RESPONSE_INVALID');
  assert.equal(calls,1); assert.equal(cancelled,1);
  const declared=new ChannelSalesClient(base,async()=>new Response('{}',{headers:{'content-length':'16385'}}));
  await assert.rejects(declared.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_RESPONSE_INVALID');
  const bytes=Buffer.from(JSON.stringify(payload).padEnd(16*1024,' '));
  const valid=new ChannelSalesClient(base,async()=>new Response(new ReadableStream<Uint8Array>({start(c){
    c.enqueue(bytes.subarray(0,15));c.enqueue(bytes.subarray(15));c.close();
  }})));
  assert.deepEqual(await valid.receipt(query),payload);
  const invalidUtf8=new ChannelSalesClient(base,async()=>new Response(new Uint8Array([0xff,0xfe])));
  await assert.rejects(invalidUtf8.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_RESPONSE_INVALID');
});

test('deadline bounds transports and error cancellation that ignore AbortSignal', {timeout:5000}, async () => {
  const base={endpoint:'https://synthetic.invalid/sales',id:'synthetic-SITE',secret:identity.secret,timeoutMs:100,attempts:2};
  const query={version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'synthetic'} as const;
  let calls=0; const signals:AbortSignal[]=[];
  const ignored=new ChannelSalesClient(base,async(_url,init)=>{
    calls++; signals.push(init!.signal!); return new Promise<Response>(()=>{});
  });
  await assert.rejects(ignored.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_UNAVAILABLE');
  assert.equal(calls,2); assert.ok(signals.every(s=>s.aborted));
  const hangingCancel=new ChannelSalesClient({...base,attempts:1},async()=>new Response(new ReadableStream({
    cancel(){return new Promise<void>(()=>{});},
  }),{status:503}));
  await assert.rejects(hangingCancel.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_UNAVAILABLE');
});

test('timed-out committed response body retries with a fresh signature and one canonical sale', {timeout:10000}, async () => {
  const f=await boot();
  try {
    let calls=0,cancelled=0;const bodies:string[]=[],nonces:string[]=[];
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-SITE',secret:identity.secret,
      allowInsecureLoopback:true,timeoutMs:1000,attempts:2},async(input,init)=>{
      bodies.push(String(init!.body));nonces.push((init!.headers as Record<string,string>)['x-channel-nonce']);
      const response=await fetch(input,init);calls++;
      if(calls===1){await response.body?.cancel();return new Response(new ReadableStream({cancel(){cancelled++;}}));}
      return response;
    },()=>now);
    const result=await client.create(saleEnvelopeSchema.parse(f.envelope));
    assert.equal(result.replayed,true);assert.equal(calls,2);assert.equal(cancelled,1);
    assert.equal(bodies[0],bodies[1]);assert.notEqual(nonces[0],nonces[1]);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,1);
  } finally {await f.close();}
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
