import assert from 'node:assert/strict';
import test from 'node:test';
import { boot } from './omnichannelFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { ChannelSalesClient } from '../src/integrations/channelSalesClient.js';
import { saleEnvelopeSchema } from '../src/integrations/saleIngressContract.js';
import { identity,now } from './omnichannelFixture.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;
test('PostgreSQL multiconnection: one canonical sale under equivalent, conflicting and nonce-concurrent deliveries', { skip: !url }, async () => {
  const f = await boot(await isolatedPostgres(url!));
  try {
    const equivalent = await Promise.all(Array.from({ length: 8 }, (_, i) => f.send(f.envelope, { nonce: `concurrent-equivalent-${i}` })));
    assert.equal(equivalent.filter((r) => r.status === 201).length, 1);
    assert.equal(equivalent.filter((r) => r.status === 200).length, 7);
    assert.equal(new Set(equivalent.map((r) => r.body.data!.id)).size, 1);
    const conflicts = await Promise.all(Array.from({ length: 8 }, (_, i) => f.send({ ...f.envelope, idempotencyKey: 'conflict',
      documento: { ...f.envelope.documento, itens: [{ ...f.envelope.documento.itens[0], quantidade: String(i + 1) }] } }, { nonce: `concurrent-conflicting-${i}` })));
    assert.equal(conflicts.filter((r) => r.status === 201).length, 1);
    assert.equal(conflicts.filter((r) => r.body.error?.code === 'CHANNEL_IDEMPOTENCY_CONFLICT').length, 7);
    const nonces = await Promise.all(Array.from({ length: 8 }, (_, i) => f.send({ ...f.envelope, idempotencyKey: `nonce-${i}` }, { nonce: 'same-concurrent-nonce' })));
    assert.equal(nonces.filter((r) => r.status === 201).length, 1);
    assert.equal(nonces.filter((r) => r.body.error?.code === 'CHANNEL_NONCE_REUSED').length, 7);
    for (const table of ['pedidos', 'pedido_itens', 'pedido_historico']) assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length, 3);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length, 3);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE entity='IntegracaoEvento'")).rows.length, 3);
  } finally { await f.close(); }
});

test('PostgreSQL multiconnection: failed atomic audits leave no documents, receipts or consumed keys', { skip: !url }, async () => {
  const f = await boot(await isolatedPostgres(url!));
  try {
    await f.pg.exec(`CREATE FUNCTION reject_concurrent_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' THEN RAISE EXCEPTION 'SYNTHETIC_ATOMIC_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER concurrent_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_concurrent_audit();`);
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => f.send(f.envelope, { nonce: `concurrent-failed-${i}` })));
    assert.ok(results.every((r) => r.status === 500));
    for (const table of ['pedidos', 'pedido_itens', 'pedido_historico', 'audit_logs']) assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length, 0);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length, 0);
    await f.pg.exec('DROP TRIGGER concurrent_audit_fail ON audit_logs');
    assert.equal((await f.send(f.envelope, { nonce: 'concurrent-failed-0' })).status, 201);
  } finally { await f.close(); }
});

test('real PostgreSQL batch preserves confirmed transactions and rolls back only the failed sale audit',{skip:!url},async()=>{
  const f=await boot(await isolatedPostgres(url!));
  try{
    let calls=0;
    const options={endpoint:f.endpoint,id:'synthetic-APP',secret:identity.secret,allowInsecureLoopback:true,attempts:1};
    const client=new ChannelSalesClient(options,async(input,init)=>{
      const response=await fetch(input,init);calls++;
      if(calls===1)await f.pg.exec(`CREATE FUNCTION reject_batch_audit() RETURNS trigger AS $$ BEGIN
        IF NEW.entity='IntegracaoEvento' THEN RAISE EXCEPTION 'SYNTHETIC_BATCH_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER batch_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_batch_audit();`);
      return response;
    },()=>now);
    const batch={operation:'sale-batch' as const,items:[0,1,2].map(i=>saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`pg-batch-${i}`}))};
    const first=await client.create(batch);
    assert.deepEqual(first.items.map(i=>i.state),['CONFIRMED','UNCONFIRMED','NOT_SENT']);assert.equal(calls,2);
    for(const table of ['pedidos','pedido_itens','pedido_historico'])assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length,1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,1);
    await f.pg.exec('DROP TRIGGER batch_audit_fail ON audit_logs');
    const resumed=await new ChannelSalesClient(options,fetch,()=>now).create(batch);
    assert.deepEqual(resumed.items.map(i=>i.state==='CONFIRMED'?i.result.replayed:null),[true,false,false]);
    for(const table of ['pedidos','pedido_itens','pedido_historico'])assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length,3);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,3);
  }finally{await f.close();}
});

test('isolated PostgreSQL fixture refuses DEV-like URLs before opening a connection', async () => {
  await assert.rejects(() => isolatedPostgres('postgresql://erp_test:test@localhost/erp_dev'), /not isolated/);
  await assert.rejects(() => isolatedPostgres('postgresql://erp_test:test@vps.example/erp_omnichannel_test'), /not isolated/);
});

test('real PostgreSQL channel state reads canonical status and rolls back audit failure without exposing data',{skip:!url},async()=>{
  const f=await boot(await isolatedPostgres(url!));
  try{
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-SITE',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const created=await client.create(saleEnvelopeSchema.parse(f.envelope));
    const query={version:1,operation:'receipt-state',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey} as const;
    assert.equal((await client.receipt(query)).data.status,'EM_ABERTO');
    await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}','[\"criar\",\"visualizar\",\"cancelar\"]'::jsonb) WHERE id=$1",[identity.actorId]);
    await f.runtime.pedidoService.cancel({groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa',requestId:'synthetic-state-cancel'},created.data.id,'Synthetic cancellation');
    assert.equal((await client.receipt(query)).data.status,'CANCELADO');
    const before=(await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length;
    await f.pg.exec(`CREATE FUNCTION reject_pg_state_read() RETURNS trigger AS $$ BEGIN
      IF NEW.action='read' THEN RAISE EXCEPTION 'SYNTHETIC_STATE_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER pg_state_read_fail AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_pg_state_read();`);
    const failures=await Promise.all(Array.from({length:3},()=>f.send(query,{path:'/recibos'})));
    assert.ok(failures.every(r=>r.status===500&&r.body.data===undefined));
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,before);
    assert.deepEqual((await f.pg.query('SELECT status,ativo FROM pedidos')).rows,[{status:'CANCELADO',ativo:false}]);
    await f.pg.exec('DROP TRIGGER pg_state_read_fail ON audit_logs');
    assert.equal((await client.receipt(query)).data.status,'CANCELADO');
    assert.deepEqual((await client.receipt({...query,operation:'receipt'})).data,created.data);
  }finally{await f.close();}
});

test('real PostgreSQL signed receipt history retains equal microsecond rows and tenant/client partition', {skip:!url},async()=>{
  const f=await boot(await isolatedPostgres(url!),[{...identity,id:'synthetic-other-client'}]);
  try{
    const ids:string[]=[];
    for(let i=0;i<3;i++){
      const r=await f.send({...f.envelope,idempotencyKey:`history-${i}`},{nonce:`synthetic-history-nonce-${i}`});
      assert.equal(r.status,201);ids.push(r.body.data!.id);
    }
    assert.equal((await f.send({...f.envelope,idempotencyKey:'foreign-client'},{channel:'synthetic-other-client'})).status,201);
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE aggregate_id=ANY($1::uuid[])",[ids]);
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-SITE',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const found:string[]=[];let cursor:{id:string;createdAt:string}|undefined;
    for(let i=0;i<4;i++){
      const page=(await client.receipt({version:1,operation:'receipt-page',tipo:'Pedido',limit:1,cursor})).data;
      assert.equal(page.items.length,1);found.push(page.items[0].receipt.id);
      if(!page.hasMore)break;assert.ok(page.nextCursor);cursor=page.nextCursor;
    }
    assert.deepEqual(found.sort(),ids.sort());
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,4);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,3);
  }finally{await f.close();}
});

test('real PostgreSQL receipt integrity rejects forged metadata under concurrent replay without recreating a sale', {skip:!url}, async () => {
  const f=await boot(await isolatedPostgres(url!));
  try {
    const created=await f.send();assert.equal(created.status,201);
    await f.pg.query("UPDATE integration_events SET payload=jsonb_set(payload,'{receipt,private}',to_jsonb('SYNTHETIC_PRIVATE_DATA'::text)) WHERE event_type='venda.recebida'");
    const query={version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey};
    const results=await Promise.all([f.send(query,{path:'/recibos'}),...Array.from({length:4},(_,i)=>f.send(f.envelope,{nonce:`integrity-replay-${i}`}))]);
    assert.ok(results.every(r=>r.status===500&&r.body.error?.code==='CHANNEL_RECEIPT_INVALID'&&r.body.data===undefined));
    assert.ok(!JSON.stringify(results).includes('SYNTHETIC_PRIVATE_DATA'));
    for(const table of ['pedidos','pedido_itens','pedido_historico'])assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length,1);
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length,1);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,0);
  } finally {await f.close();}
});
