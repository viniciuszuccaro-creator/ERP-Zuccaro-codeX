import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, identity } from './omnichannelFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';
import { ChannelSalesClient } from '../src/integrations/channelSalesClient.js';
import { now } from './omnichannelFixture.js';
import { saleEnvelopeSchema } from '../src/integrations/saleIngressContract.js';

test('signed channel state follows canonical workflow while ingestion receipts stay unchanged',async()=>{
  const f=await boot();
  try{
    const ctx={groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa' as const,requestId:'synthetic-workflow'};
    await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}', '[\"criar\",\"visualizar\",\"alterar-status\",\"cancelar\"]'::jsonb) WHERE id=$1",[identity.actorId]);
    for(const channel of ['SITE','APP','CHATBOT','MARKETPLACE']){
      const client=new ChannelSalesClient({endpoint:f.endpoint,id:`synthetic-${channel}`,secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
      const created=await client.create(saleEnvelopeSchema.parse({...f.envelope,idempotencyKey:`state-${channel}`}));
      const query={version:1,operation:'receipt-state',tipo:'Pedido',idempotencyKey:`state-${channel}`} as const;
      const open=(await client.receipt(query)).data;
      assert.equal(open.id,created.data.id);assert.equal(open.status,'EM_ABERTO');
      assert.deepEqual(Object.keys(open).sort(),['id','status','tipo','updatedAt']);
      await f.runtime.pedidoService.transition(ctx,created.data.id,'PRONTO_RETIRADA');
      assert.equal((await client.receipt(query)).data.status,'PRONTO_RETIRADA');
      await f.runtime.pedidoService.transition(ctx,created.data.id,'FINALIZADO');
      const final=(await client.receipt(query)).data;assert.equal(final.status,'FINALIZADO');
      assert.equal(final.updatedAt,(await f.runtime.pedidoService.get(ctx,created.data.id)).updated_at);
      assert.deepEqual((await client.receipt({...query,operation:'receipt'})).data,created.data);
    }
    const reads=await f.pg.query("SELECT after_data FROM audit_logs WHERE action='read' AND after_data->>'operation'='receipt-state'");
    assert.equal(reads.rows.length,12);assert.ok(!JSON.stringify(reads.rows).includes('cliente_empresa_id'));
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,4);
  }finally{await f.close();}
});

test('state reads isolate identity, reject tampering and fail closed on revoked permissions, integrity or audit',async()=>{
  const f=await boot(undefined,[{...identity,id:'synthetic-other-client'}]);
  try{
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-SITE',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const created=await client.create(saleEnvelopeSchema.parse(f.envelope));
    const query={version:1,operation:'receipt-state',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey} as const;
    assert.equal((await f.send(query,{path:'/recibos',channel:'synthetic-other-client'})).status,404);
    assert.equal((await f.send(query,{path:'/recibos',channel:'synthetic-APP'})).status,404);
    assert.equal((await f.send({...query,documentoId:created.data.id},{path:'/recibos'})).status,422);
    assert.equal((await f.send(query)).status,422);
    const get=f.runtime.pedidoService.get.bind(f.runtime.pedidoService);
    f.runtime.pedidoService.get=async(ctx,id)=>({...await get(ctx,id),empresa_id:S.empresaB});
    const invalid=await f.send(query,{path:'/recibos'});assert.equal(invalid.status,500);
    assert.equal(invalid.body.error?.code,'CHANNEL_DOCUMENT_STATE_INVALID');assert.equal(invalid.body.data,undefined);
    f.runtime.pedidoService.get=get;
    await f.pg.exec(`CREATE FUNCTION reject_state_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.action='read' THEN RAISE EXCEPTION 'SYNTHETIC_STATE_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER state_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_state_audit();`);
    const failed=await f.send(query,{path:'/recibos'});assert.equal(failed.status,500);assert.equal(failed.body.data,undefined);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,0);
    await f.pg.exec('DROP TRIGGER state_audit_fail ON audit_logs');
    await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,pedido}', '[\"criar\"]'::jsonb) WHERE id=$1",[identity.actorId]);
    assert.equal((await f.send(query,{path:'/recibos'})).status,403);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
    const malformed=new ChannelSalesClient({endpoint:'https://synthetic.invalid',id:'synthetic-SITE',secret:identity.secret},async()=>new Response(JSON.stringify({data:{id:created.data.id,tipo:'Pedido',status:'PAGO',updatedAt:'2026-01-01T00:00:00.000Z'}})));
    await assert.rejects(malformed.receipt(query),(e:any)=>e.code==='CHANNEL_CLIENT_RESPONSE_INVALID');
  }finally{await f.close();}
});

test('cancelled quote state uses canonical service and returns no quote details',async()=>{
  const f=await boot();
  try{
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-CHATBOT',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const {tipo_operacao:_operation,data_entrega_solicitada:_delivery,...quote}=f.envelope.documento;
    const created=await client.create(saleEnvelopeSchema.parse({...f.envelope,tipo:'Orcamento',documento:{...quote,validade_em:'2027-03-01T00:00:00.000Z'}}));
    await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,orcamento}', '[\"criar\",\"visualizar\",\"cancelar\"]'::jsonb) WHERE id=$1",[identity.actorId]);
    await f.runtime.orcamentoService.cancel({groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa',requestId:'synthetic-cancel'},created.data.id);
    const result=(await client.receipt({version:1,operation:'receipt-state',tipo:'Orcamento',idempotencyKey:f.envelope.idempotencyKey})).data;
    assert.equal(result.status,'CANCELADO');assert.equal(result.id,created.data.id);
    assert.deepEqual(Object.keys(result).sort(),['id','status','tipo','updatedAt']);
  }finally{await f.close();}
});

test('superseded channel quote remains readable by its original signed receipt',async()=>{
  const f=await boot();
  try{
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-CHATBOT',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const {tipo_operacao:_operation,data_entrega_solicitada:_delivery,...quote}=f.envelope.documento;
    const payload={...quote,validade_em:'2027-03-01T00:00:00.000Z'};
    const created=await client.create(saleEnvelopeSchema.parse({...f.envelope,tipo:'Orcamento',documento:payload}));
    await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(permissoes,'{Comercial,orcamento}', '[\"criar\",\"visualizar\",\"versionar\"]'::jsonb) WHERE id=$1",[identity.actorId]);
    const ctx={groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa' as const,requestId:'synthetic-version'};
    const source=await f.runtime.orcamentoService.get(ctx,created.data.id);
    await f.runtime.orcamentoService.createVersion(ctx,created.data.id,{
      cliente_empresa_id:source.cliente_empresa_id,condicao_pagamento_id:source.condicao_pagamento_id,
      validade_em:'2027-04-01T00:00:00.000Z',
      itens:source.itens.map(item=>({produto_id:item.produto_id,unidade_id:item.unidade_id,
        descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,
        preco_unitario:item.preco_unitario,desconto:item.desconto})),
    });
    const state=(await client.receipt({version:1,operation:'receipt-state',tipo:'Orcamento',idempotencyKey:f.envelope.idempotencyKey})).data;
    assert.equal(state.status,'SUPERSEDIDO');assert.equal(state.id,created.data.id);
    assert.deepEqual(Object.keys(state).sort(),['id','status','tipo','updatedAt']);
  }finally{await f.close();}
});

test('receipt query returns only ingestion reference for owning identity and audits every successful read', async () => {
  const f = await boot();
  try {
    const created = await f.send(); assert.equal(created.status, 201);
    const query = { version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: f.envelope.idempotencyKey };
    const result = await f.send(query, { path: '/recibos' });
    assert.equal(result.status, 200); assert.deepEqual(result.body, { data: created.body.data });
    assert.equal((await f.send(query, { path: '/recibos', channel: 'synthetic-APP' })).status, 404);
    assert.equal((await f.send({ ...query, tipo: 'Orcamento' }, { path: '/recibos' })).status, 404);
    assert.equal((await f.send({ ...query, idempotencyKey: 'absent' }, { path: '/recibos' })).status, 404);
    assert.equal((await f.send(f.envelope, { path: '/recibos' })).status, 422);
    assert.equal((await f.send(query)).status, 422); // Signed operation cannot become a sale.
    assert.equal((await f.send({ ...query, groupId: S.groupB }, { path: '/recibos' })).status, 422);
    const reads = await f.pg.query("SELECT * FROM audit_logs WHERE entity='IntegracaoEvento' AND action='read'");
    assert.equal(reads.rows.length, 1);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length, 1);
  } finally { await f.close(); }
});

test('signed receipt history pages only owning client references and excludes unverified legacy ownership', async()=>{
  const f=await boot(undefined,[{...identity,id:'synthetic-other-client'}]);
  try{
    const ids:string[]=[];
    for(let i=0;i<3;i++){
      const created=await f.send({...f.envelope,idempotencyKey:`page-${i}`},{nonce:`synthetic-page-nonce-${i}`});
      assert.equal(created.status,201);ids.push(created.body.data!.id);
    }
    assert.equal((await f.send({...f.envelope,idempotencyKey:'other-client'},{channel:'synthetic-other-client'})).status,201);
    assert.equal((await f.send({...f.envelope,idempotencyKey:'other-channel'},{channel:'synthetic-APP'})).status,201);
    await f.pg.query("UPDATE integration_events SET payload=payload-'client_hash' WHERE aggregate_id=$1",[ids[0]]);
    await f.pg.query("UPDATE integration_events SET created_at='2026-01-01T00:00:00.123456Z' WHERE aggregate_id=ANY($1::uuid[])",[ids]);
    const client=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-SITE',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    const query={version:1,operation:'receipt-page',tipo:'Pedido',limit:1} as const;
    const a=(await client.receipt(query)).data;assert.ok(a.nextCursor);assert.equal(a.hasMore,true);
    const b=(await client.receipt({...query,cursor:a.nextCursor})).data;
    assert.equal(b.hasMore,false);assert.equal(b.nextCursor,null);
    const items=[...a.items,...b.items];assert.equal(new Set(items.map(x=>x.eventId)).size,2);
    assert.deepEqual(items.map(x=>x.receipt.id).sort(),ids.slice(1).sort());
    assert.ok(items.every(x=>x.receivedAt==='2026-01-01T00:00:00.123456Z'));
    assert.ok(!JSON.stringify(items).includes('client_hash'));assert.ok(!JSON.stringify(items).includes('nonce_hash'));
    const legacy=await client.receipt({version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:'page-0'});
    assert.equal(legacy.data.id,ids[0]);
    const other=new ChannelSalesClient({endpoint:f.endpoint,id:'synthetic-other-client',secret:identity.secret,allowInsecureLoopback:true},fetch,()=>now);
    assert.equal((await other.receipt({...query,limit:50})).data.items.length,1);
    assert.equal((await client.receipt({...query,tipo:'Orcamento'})).data.items.length,0);
    assert.equal((await f.send(query)).status,422);
    assert.equal((await f.send({...query,groupId:S.groupB},{path:'/recibos'})).status,422);
    assert.equal((await f.send({...query,limit:51},{path:'/recibos'})).status,422);
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,5);
  }finally{await f.close();}
});

test('receipt history blocks malformed references, audit failure and revoked read permission without returning a partial page',async()=>{
  const f=await boot();
  try{
    const created=await f.send();assert.equal(created.status,201);
    const query={version:1,operation:'receipt-page',tipo:'Pedido',limit:50};
    await f.pg.query("UPDATE integration_events SET payload=jsonb_set(payload,'{receipt,private}',to_jsonb('SYNTHETIC_PRIVATE_DATA'::text)) WHERE event_type='venda.recebida'");
    const invalid=await f.send(query,{path:'/recibos'});
    assert.equal(invalid.status,500);assert.equal(invalid.body.error?.code,'CHANNEL_RECEIPT_INVALID');
    assert.equal(invalid.body.data,undefined);assert.ok(!JSON.stringify(invalid).includes('SYNTHETIC_PRIVATE_DATA'));
    await f.pg.query("UPDATE integration_events SET payload=jsonb_set(payload,'{receipt}',(payload->'receipt')-'private') WHERE event_type='venda.recebida'");
    await f.pg.exec(`CREATE FUNCTION reject_page_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.action='read' THEN RAISE EXCEPTION 'SYNTHETIC_PAGE_AUDIT'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER page_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_page_audit();`);
    assert.equal((await f.send(query,{path:'/recibos'})).status,500);
    await f.pg.exec('DROP TRIGGER page_audit_fail ON audit_logs');
    await f.pg.query("UPDATE profiles SET permissoes='{}'::jsonb WHERE id=$1",[S.runtimeActorA]);
    assert.equal((await f.send(query,{path:'/recibos'})).status,403);
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,0);
  }finally{await f.close();}
});

test('stored receipt corruption fails closed on reads and replays without leaking data or recreating documents', async () => {
  const f=await boot();
  try {
    const created=await f.send();assert.equal(created.status,201);
    const event=(await f.pg.query("SELECT * FROM integration_events WHERE event_type='venda.recebida'")).rows[0];
    const query={version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey};
    const cases=[
      {payload:{receipt:{...created.body.data,private:'SYNTHETIC_PRIVATE_DATA'}}},
      {payload:{receipt:{id:'invalid',tipo:'Pedido'}}},
      {payload:{receipt:{...created.body.data,tipo:'Orcamento'}}},
      {payload:null},
      {aggregate_type:'Orcamento'},
      {aggregate_id:S.produtoA},
      {status:'pending'},
    ];
    for(const changed of cases){
      await f.pg.query('UPDATE integration_events SET payload=$2::jsonb,aggregate_type=$3,aggregate_id=$4,status=$5 WHERE id=$1',
        [event.id,JSON.stringify(changed.payload===undefined?event.payload:changed.payload),
          changed.aggregate_type??event.aggregate_type,changed.aggregate_id??event.aggregate_id,changed.status??event.status]);
      for(const result of [await f.send(query,{path:'/recibos'}),await f.send(f.envelope,{nonce:'receipt-corruption-retry'})]){
        assert.equal(result.status,500);assert.equal(result.body.error.code,'CHANNEL_RECEIPT_INVALID');
        assert.equal(result.body.data,undefined);assert.ok(!JSON.stringify(result.body).includes('SYNTHETIC_PRIVATE_DATA'));
      }
      assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
      assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,0);
    }
    await f.pg.query('UPDATE integration_events SET payload=$2::jsonb,aggregate_type=$3,aggregate_id=$4,status=$5 WHERE id=$1',
      [event.id,JSON.stringify(event.payload),event.aggregate_type,event.aggregate_id,event.status]);
    assert.equal((await f.send(f.envelope,{nonce:'receipt-corruption-retry'})).status,200);
    assert.deepEqual((await f.send(query,{path:'/recibos'})).body,{data:created.body.data});
  } finally {await f.close();}
});

test('receipt reference must resolve to a canonical document in the same company while preserving ingestion meaning', async () => {
  const f=await boot(undefined,[{...identity,id:'synthetic-other-group',groupId:S.groupB,empresaId:S.empresaB,actorId:S.runtimeActorB}]);
  try {
    const created=await f.send();assert.equal(created.status,201);
    const query={version:1,operation:'receipt',tipo:'Pedido',idempotencyKey:f.envelope.idempotencyKey};
    await f.pg.query('UPDATE profiles SET permissoes=(SELECT permissoes FROM profiles WHERE id=$1) WHERE id=$2',[S.runtimeActorA,S.runtimeActorB]);
    const clientB=(await f.pg.query('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 LIMIT 1',[S.groupB,S.empresaB])).rows[0].id;
    const foreign=await f.send({...f.envelope,idempotencyKey:'synthetic-foreign',documento:{...f.envelope.documento,
      cliente_empresa_id:clientB,condicao_pagamento_id:S.condicaoPagamentoB,
      itens:[{...f.envelope.documento.itens[0],produto_id:S.produtoB,unidade_id:S.unidadeB}],
    }},{channel:'synthetic-other-group'});
    assert.equal(foreign.status,201);
    // Valid UUID and consistent metadata are insufficient for missing or foreign canonical documents.
    for(const id of [S.produtoA,foreign.body.data!.id]){
      await f.pg.query("UPDATE integration_events SET aggregate_id=$1::uuid,payload=jsonb_set(payload,'{receipt,id}',to_jsonb(($1::uuid)::text)) WHERE event_type='venda.recebida' AND group_id=$2",[id,S.groupA]);
      assert.equal((await f.send(query,{path:'/recibos'})).body.error.code,'CHANNEL_RECEIPT_INVALID');
      assert.equal((await f.send(f.envelope,{nonce:'receipt-reference-retry'})).body.error.code,'CHANNEL_RECEIPT_INVALID');
    }
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,2);
    await f.pg.query("UPDATE integration_events SET aggregate_id=$1::uuid,payload=jsonb_set(payload,'{receipt,id}',to_jsonb(($1::uuid)::text)) WHERE event_type='venda.recebida' AND group_id=$2",[created.body.data!.id,S.groupA]);
    await f.pg.query("UPDATE pedidos SET status='CANCELADO',ativo=false WHERE id=$1",[created.body.data!.id]);
    assert.deepEqual((await f.send(query,{path:'/recibos'})).body,{data:created.body.data});
  } finally {await f.close();}
});

test('receipt read revalidates granular permissions and actor revocation', async () => {
  const f = await boot();
  try {
    await f.send();
    const query = { version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: f.envelope.idempotencyKey };
    for (const permissions of [
      { Integracoes: { vendas: ['importar'] }, Comercial: { pedido: ['criar', 'visualizar'] } },
      { Integracoes: { vendas: ['importar', 'visualizar'] }, Comercial: { pedido: ['criar'] } },
      { '*': ['*'] },
    ]) {
      await f.pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), S.runtimeActorA]);
      assert.equal((await f.send(query, { path: '/recibos' })).status, 403);
    }
    await f.pg.query('UPDATE profiles SET ativo=false WHERE id=$1', [S.runtimeActorA]);
    assert.equal((await f.send(query, { path: '/recibos' })).status, 403);
  } finally { await f.close(); }
});

test('receipt does not leak ingestion reference when read auditing fails', async () => {
  const f = await boot();
  try {
    await f.send();
    await f.pg.exec(`CREATE FUNCTION reject_receipt_read() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' AND NEW.action='read' THEN RAISE EXCEPTION 'SYNTHETIC_READ_FAILURE'; END IF;
      RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER receipt_read_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_receipt_read();`);
    const result = await f.send({ version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: f.envelope.idempotencyKey }, { path: '/recibos' });
    assert.equal(result.status, 500); assert.equal(result.body.data, undefined);
    assert.ok(!JSON.stringify(result.body).includes('SYNTHETIC_READ_FAILURE'));
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length, 1);
  } finally { await f.close(); }
});

test('authorized identities in another company, group or same-channel client cannot enumerate receipts', async () => {
  const f = await boot(undefined, [
    { ...identity, id: 'synthetic-other-client' },
    { ...identity, id: 'synthetic-other-company', empresaId: S.empresaA2 },
    { ...identity, id: 'synthetic-other-group', groupId: S.groupB, empresaId: S.empresaB, actorId: S.runtimeActorB },
  ]);
  try {
    await f.send();
    await f.pg.query('UPDATE profiles SET empresa_id=NULL WHERE id=$1', [S.runtimeActorA]);
    await f.pg.query('UPDATE profiles SET permissoes=(SELECT permissoes FROM profiles WHERE id=$1) WHERE id=$2', [S.runtimeActorA, S.runtimeActorB]);
    for (const channel of ['synthetic-other-client', 'synthetic-other-company', 'synthetic-other-group']) {
      const result = await f.send({ version: 1, operation: 'receipt', tipo: 'Pedido', idempotencyKey: f.envelope.idempotencyKey }, { path: '/recibos', channel });
      assert.equal(result.status, 404); assert.equal(result.body.data, undefined);
    }
    assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length, 0);
  } finally { await f.close(); }
});
