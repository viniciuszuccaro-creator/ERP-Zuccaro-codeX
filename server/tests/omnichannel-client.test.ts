import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelSalesClient, ChannelTransportError } from '../src/integrations/channelSalesClient.js';
import { saleEnvelopeSchema } from '../src/integrations/saleIngressContract.js';
import { boot, identity, now } from './omnichannelFixture.js';

test('pending channel batches create mixed canonical documents and replay without duplicate sales', async () => {
  const f = await boot();
  try {
    for (const channel of ['SITE', 'APP', 'CHATBOT', 'MARKETPLACE']) {
      const client = new ChannelSalesClient({ endpoint:f.endpoint,id:`synthetic-${channel}`,secret:identity.secret,
        allowInsecureLoopback:true },fetch,()=>now);
      const {tipo_operacao: _operation,data_entrega_solicitada: _delivery,...quote}=f.envelope.documento;
      const batch = { operation:'sale-batch',items:['Pedido','Orcamento'].map(tipo=>saleEnvelopeSchema.parse({
        ...f.envelope,tipo,idempotencyKey:`batch-${channel}-${tipo}`,
        documento:tipo==='Pedido'?f.envelope.documento:{...quote,validade_em:'2027-03-01T00:00:00.000Z'},
      })) } as const;
      const first=await client.create(batch);const replay=await client.create(batch);
      assert.ok(first.items.every(i=>i.state==='CONFIRMED'&&!i.result.replayed));
      assert.ok(replay.items.every(i=>i.state==='CONFIRMED'&&i.result.replayed));
    }
    for(const table of ['pedidos','orcamentos'])assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length,4);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,8);
  } finally { await f.close(); }
});

test('batch validates every input before sending and preserves a snapshot across asynchronous delivery', async () => {
  const f=await boot();
  try {
    let calls=0;
    const transport:typeof fetch=async(input,init)=>{calls++;return fetch(input,init);};
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true},transport,()=>now);
    const one=saleEnvelopeSchema.parse(f.envelope);
    for(const items of [[],Array(26).fill(one),[one,one],[one,{...one,idempotencyKey:'bad',documento:{}}]]) {
      await assert.rejects(client.create({operation:'sale-batch',items} as any),(e:any)=>e.code==='CHANNEL_CLIENT_PAYLOAD_INVALID');
    }
    assert.equal(calls,0);assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,0);
    const large={...one,documento:{...one.documento,itens:Array.from({length:100},()=>({...one.documento.itens[0],descricao:'x'.repeat(240),quantidade:'1'.repeat(200)}))}};
    await assert.rejects(client.create({operation:'sale-batch',items:Array.from({length:25},(_,i)=>({...large,idempotencyKey:`size-${i}`}))}),
      (e:any)=>e.code==='CHANNEL_CLIENT_PAYLOAD_INVALID');
    assert.equal(calls,0);
    const batch={operation:'sale-batch' as const,items:[{...one,idempotencyKey:'snapshot-one'},{...one,idempotencyKey:'snapshot-two'}]};
    const pending=client.create(batch);batch.items[1].idempotencyKey='mutated';
    assert.ok((await pending).items.every(i=>i.state==='CONFIRMED'));
    const receipt=await client.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'snapshot-two'});
    assert.ok(receipt.data.id);
  } finally {await f.close();}
});

test('batch stops at unconfirmed delivery, retains committed sales and resumes with the original keys',async()=>{
  const f=await boot();
  try {
    let calls=0;
    const options={endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:1};
    const batch={operation:'sale-batch' as const,items:[0,1,2].map(i=>saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`pending-${i}`}))};
    const ambiguous=new ChannelSalesClient(options,async(input,init)=>{
      const response=await fetch(input,init);calls++;
      if(calls===2){await response.body?.cancel();throw new Error('Synthetic response loss');}
      return response;
    },()=>now);
    const result=await ambiguous.create(batch);
    assert.deepEqual(result.items.map(i=>i.state),['CONFIRMED','UNCONFIRMED','NOT_SENT']);
    assert.equal(calls,2);assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,2);
    const recovered=new ChannelSalesClient(options,fetch,()=>now);
    const receipt=await recovered.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'pending-1'});
    assert.ok(receipt.data.id);
    const resumed=await recovered.create(batch);
    assert.deepEqual(resumed.items.map(i=>i.state==='CONFIRMED'?i.result.replayed:null),[true,true,false]);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,3);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,3);
  }finally{await f.close();}
});

test('a late RBAC denial after a committed retry remains unconfirmed and stops following sales',async()=>{
  const f=await boot();
  try{
    let calls=0;
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:2},async(input,init)=>{
      calls++;
      if(calls===1){const response=await fetch(input,init);await response.body?.cancel();
        await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[identity.actorId]);
        throw new Error('Synthetic lost response');}
      return fetch(input,init);
    },()=>now);
    const result=await client.create({operation:'sale-batch',items:[0,1].map(i=>saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`late-rbac-${i}`}))});
    assert.deepEqual(result.items,[{index:0,state:'UNCONFIRMED',code:'CHANNEL_CLIENT_REJECTED',status:403},{index:1,state:'NOT_SENT'}]);
    assert.equal(calls,2);assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
  }finally{await f.close();}
});

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

test('channel receipt history rejects invalid bounds and inconsistent page/cursor responses',async()=>{
  const base={endpoint:'https://synthetic.invalid/sales',id:'synthetic-SITE',secret:identity.secret};
  const query={version:1,operation:'receipt-page',tipo:'Pedido',limit:1} as const;
  let calls=0;
  const client=new ChannelSalesClient(base,async()=>{calls++;return new Response(JSON.stringify({data:{
    tipo:'Pedido',items:[],hasMore:true,nextCursor:{id:'11111111-1111-4111-8111-111111111111',createdAt:'2026-01-01T00:00:00.000Z'},
  }}));});
  await assert.rejects(client.receipt({...query,limit:51}),(e:any)=>e.code==='CHANNEL_CLIENT_PAYLOAD_INVALID');
  assert.equal(calls,0);
  await assert.rejects(client.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_RESPONSE_INVALID');assert.equal(calls,1);
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
  for (const endpoint of ['http://remote.invalid/sales', 'https://user:pass@synthetic.invalid/sales', 'https://synthetic.invalid/sales?secret=x',
    'https://synthetic.invalid/sales?', 'https://synthetic.invalid/sales#', 'https://synthetic.invalid/sales?#']) {
    assert.throws(() => new ChannelSalesClient({ ...base, endpoint }), ChannelTransportError);
  }
  assert.throws(() => new ChannelSalesClient({ ...base, attempts: 4 }), ChannelTransportError);
  let calls = 0;
  const response: typeof fetch = async () => { calls++; return new Response('Synthetic private error', { status: 503 }); };
  const client = new ChannelSalesClient(base, response, () => now);
  const query = { version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: 'synthetic' } as const;
  await assert.rejects(() => client.receipt(query), (e: unknown) => e instanceof ChannelTransportError
    && e.code === 'CHANNEL_CLIENT_UNAVAILABLE' && e.status === 503 && !e.message.includes('Synthetic private error') && !e.message.includes(identity.secret));
  assert.equal(calls, 3);
  for (const status of [401, 403, 404, 409, 422, 429]) {
    calls = 0;
    const rejected = new ChannelSalesClient(base, async () => { calls++; return new Response('private', { status }); });
    await assert.rejects(() => rejected.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.code === 'CHANNEL_CLIENT_REJECTED' && e.status === status);
    assert.equal(calls, 1);
  }
  const malformed = new ChannelSalesClient(base, async () => new Response(JSON.stringify({ data: { id: 'bad', tipo: 'Pedido' } }), { status: 200 }));
  await assert.rejects(() => malformed.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.code === 'CHANNEL_CLIENT_RESPONSE_INVALID');
  calls = 0;
  const invalidJson = new ChannelSalesClient(base, async () => { calls++; return new Response('Synthetic invalid JSON', { status: 200 }); });
  await assert.rejects(() => invalidJson.receipt(query), (e: unknown) => e instanceof ChannelTransportError && e.code === 'CHANNEL_CLIENT_RESPONSE_INVALID');
  assert.equal(calls, 1);
});

test('caller stop leaves unsent batch intact and interrupts receipt without transport',async()=>{
 const f=await boot();try{
  const stop=new AbortController();stop.abort('private');let calls=0;
  const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true},async()=>{calls++;throw new Error('unused');},()=>now);
  assert.deepEqual((await client.create({operation:'sale-batch',items:[f.envelope]},stop.signal)).items,[{index:0,state:'NOT_SENT'}]);
  await assert.rejects(client.create({operation:'sale-batch',items:[]} as any,stop.signal),(e:any)=>e.code==='CHANNEL_CLIENT_PAYLOAD_INVALID');
  await assert.rejects(client.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey},stop.signal),(e:any)=>e.code==='CHANNEL_CLIENT_INTERRUPTED');assert.equal(calls,0);
 }finally{await f.close();}
});

test('interrupted committed batch resumes idempotently without accepting late receipt',async()=>{
 const f=await boot();try{
  const stop=new AbortController();let calls=0;let release!:()=>void;
  const late=new Promise<void>(r=>{release=r;});
  const options={endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:3};
  const client=new ChannelSalesClient(options,async(input,init)=>{
   calls++;const response=await fetch(input,init);if(calls===2){stop.abort('private');await late;}return response;
  },()=>now);
  const batch={operation:'sale-batch' as const,items:[0,1,2].map(i=>saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`stop-${i}`}))};
  const result=await client.create(batch,stop.signal);
  assert.deepEqual(result.items.map(i=>i.state),['CONFIRMED','UNCONFIRMED','NOT_SENT']);
  assert.deepEqual(result.items[1],{index:1,state:'UNCONFIRMED',code:'CHANNEL_CLIENT_INTERRUPTED'});
  assert.equal(calls,2);assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,2);
  release();await new Promise(r=>setTimeout(r,10));
  const resumed=await new ChannelSalesClient(options,fetch,()=>now).create(batch);
  assert.deepEqual(resumed.items.map(i=>i.state==='CONFIRMED'?i.result.replayed:null),[true,true,false]);
  assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,3);
 }finally{await f.close();}
});

test('caller stop bounds ignored transport and interrupts retry backoff',async()=>{
 const f=await boot();try{
  for(const ignored of [true,false]){
   const stop=new AbortController();let calls=0;
   const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:3,timeoutMs:30000},async()=>{
    calls++;setTimeout(()=>stop.abort(),10);if(ignored)return new Promise<Response>(()=>{});throw new Error('unavailable');
   },()=>now);
   const start=Date.now();await assert.rejects(client.create(f.envelope,stop.signal),(e:any)=>e.code==='CHANNEL_CLIENT_INTERRUPTED');
   assert.ok(Date.now()-start<1000);assert.equal(calls,1);
  }
 }finally{await f.close();}
});

test('exhausted 5xx after canonical commit stays unconfirmed and recovers with the same sale key',async()=>{
 const f=await boot();try{
  let calls=0;const nonces=new Set<string>();const bodies=new Set<string>();
  const options={endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:2};
  const client=new ChannelSalesClient(options,async(input,init)=>{
   calls++;nonces.add(String((init!.headers as Record<string,string>)['x-channel-nonce']));bodies.add(String(init!.body));
   const response=await fetch(input,init);assert.ok(response.ok);await response.body?.cancel();return new Response('private',{status:503});
  },()=>now);
  const batch={operation:'sale-batch' as const,items:[0,1].map(i=>saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`5xx-${i}`}))};
  assert.deepEqual((await client.create(batch)).items,[{index:0,state:'UNCONFIRMED',code:'CHANNEL_CLIENT_UNAVAILABLE',status:503},{index:1,state:'NOT_SENT'}]);
  assert.equal(calls,2);assert.equal(nonces.size,2);assert.equal(bodies.size,1);
  assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
  const recovery=new ChannelSalesClient(options,fetch,()=>now);
  assert.ok((await recovery.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'5xx-0'})).data.id);
  const resumed=await recovery.create(batch);
  assert.deepEqual(resumed.items.map(i=>i.state==='CONFIRMED'?i.result.replayed:null),[true,false]);
  assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,2);
  // Encoded delimiters are path data, unlike literal query/fragment delimiters.
  let route='';const encoded=new ChannelSalesClient({...options,endpoint:'https://synthetic.invalid/sales%3F%23'},async(input)=>{
   route=String(input);return new Response(JSON.stringify({data:{id:(resumed.items[0] as any).result.data.id,tipo:'Pedido'}}),{headers:{'content-type':'application/json'}});
  });
  await encoded.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'5xx-0'});
  assert.equal(route,'https://synthetic.invalid/sales%3F%23/recibos');
 }finally{await f.close();}
});
