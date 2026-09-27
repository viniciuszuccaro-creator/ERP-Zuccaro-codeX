import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, identity } from './omnichannelFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

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
      for(const result of [await f.send(query,{path:'/recibos'}),await f.send()]){
        assert.equal(result.status,500);assert.equal(result.body.error.code,'CHANNEL_RECEIPT_INVALID');
        assert.equal(result.body.data,undefined);assert.ok(!JSON.stringify(result.body).includes('SYNTHETIC_PRIVATE_DATA'));
      }
      assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length,1);
      assert.equal((await f.pg.query("SELECT id FROM audit_logs WHERE action='read'")).rows.length,0);
    }
    await f.pg.query('UPDATE integration_events SET payload=$2::jsonb,aggregate_type=$3,aggregate_id=$4,status=$5 WHERE id=$1',
      [event.id,JSON.stringify(event.payload),event.aggregate_type,event.aggregate_id,event.status]);
    assert.equal((await f.send()).status,200);
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
      assert.equal((await f.send()).body.error.code,'CHANNEL_RECEIPT_INVALID');
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
