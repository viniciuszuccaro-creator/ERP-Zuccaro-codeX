import assert from 'node:assert/strict';
import test from 'node:test';
import { boot, identity, now } from './omnichannelFixture.js';
import { loadChannelIdentities } from '../src/integrations/saleIngressHttp.js';
import { saleEnvelopeSchema } from '../src/integrations/saleIngressContract.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

test('signed channels create canonical orders/quotes and return idempotent receipts', async () => {
  const f = await boot();
  try {
    for (const channel of ['SITE', 'APP', 'CHATBOT', 'MARKETPLACE']) {
      const payload = { ...f.envelope, idempotencyKey: channel };
      const created = await f.send(payload, { channel: `synthetic-${channel}` }); assert.equal(created.status, 201);
      const repeated = await f.send(payload, { channel: `synthetic-${channel}`, nonce: 'synthetic-new-nonce-02' });
      assert.equal(repeated.status, 200); assert.equal(repeated.body.data?.id, created.body.data?.id);
      const order = await f.pg.query<{ total: string; group_id: string }>('SELECT total,group_id FROM pedidos WHERE id=$1', [created.body.data!.id]);
      assert.equal(order.rows[0].total, '51.000000'); assert.equal(order.rows[0].group_id, S.groupA);
    }
    const { tipo_operacao: _tipo, data_entrega_solicitada: _data, ...base } = f.envelope.documento;
    const quote = await f.send({ ...f.envelope, tipo: 'Orcamento', idempotencyKey: 'quote', documento: { ...base, validade_em: '2027-01-01T00:00:00.000Z' } }, { nonce: 'synthetic-quote-nonce' });
    assert.equal(quote.status, 201);
    assert.equal((await f.pg.query('SELECT id FROM orcamentos')).rows.length, 1);
    const events = (await f.pg.query<{ payload: unknown }>("SELECT payload FROM integration_events WHERE event_type='venda.recebida'")).rows;
    assert.equal(events.length, 5); assert.ok(!JSON.stringify(events).includes('Item sintético'));
    const audits = (await f.pg.query("SELECT * FROM audit_logs WHERE entity='IntegracaoEvento'")).rows;
    assert.equal(audits.length, 5); assert.ok(!JSON.stringify(audits).includes(identity.secret));
  } finally { await f.close(); }
});

test('signature, expiration, mass assignment, nonce and conflicting retries fail closed', async () => {
  const f = await boot();
  try {
    assert.equal((await f.send(undefined, { signature: '0'.repeat(64) })).status, 401);
    assert.equal((await f.send(undefined, { time: String(now / 1000 - 301) })).status, 401);
    assert.equal((await f.send(undefined, { channel: 'unknown' })).status, 401);
    assert.equal((await f.send({ ...f.envelope, groupId: S.groupB })).status, 422);
    assert.equal((await f.send({ ...f.envelope, documento: { ...f.envelope.documento, observacoes: '<script>bad</script>' } })).status, 422);
    assert.equal((await f.send({ ...f.envelope, documento: { ...f.envelope.documento, itens: [{ ...f.envelope.documento.itens[0], preco_unitario: '0.01' }] } })).status, 422);
    assert.equal((await f.send()).status, 201);
    const conflict = await f.send({ ...f.envelope, documento: { ...f.envelope.documento, observacoes: 'Changed' } });
    assert.equal(conflict.body.error?.code, 'CHANNEL_IDEMPOTENCY_CONFLICT');
    const nonce = await f.send({ ...f.envelope, idempotencyKey: 'different' });
    assert.equal(nonce.body.error?.code, 'CHANNEL_NONCE_REUSED');
    await f.pg.query('UPDATE profiles SET ativo=false WHERE id=$1', [S.runtimeActorA]);
    assert.equal((await f.send()).status, 403); // Authorization checked again on replay.
  } finally { await f.close(); }
});

test('reference isolation and integration-audit failure rollback canonical document and receipt', async () => {
  const f = await boot();
  try {
    const crossed = await f.send({ ...f.envelope, documento: { ...f.envelope.documento, itens: [{ ...f.envelope.documento.itens[0], produto_id: S.produtoB }] } });
    assert.equal(crossed.status, 422);
    await f.pg.exec(`CREATE FUNCTION reject_ingress_audit() RETURNS trigger AS $$ BEGIN
      IF NEW.entity='IntegracaoEvento' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER ingress_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_ingress_audit();`);
    assert.equal((await f.send()).status, 500);
    for (const table of ['pedidos', 'pedido_itens', 'pedido_historico', 'audit_logs']) {
      assert.equal((await f.pg.query(`SELECT id FROM ${table}`)).rows.length, 0);
    }
    assert.equal((await f.pg.query("SELECT id FROM integration_events WHERE event_type='venda.recebida'")).rows.length, 0);
    await f.pg.exec('DROP TRIGGER ingress_audit_fail ON audit_logs');
    assert.equal((await f.send()).status, 201); // Failure does not consume nonce/key.
  } finally { await f.close(); }
});

test('configuration is disabled by default and rejects malformed/duplicate identities without secrets', () => {
  assert.deepEqual(loadChannelIdentities({}), []);
  assert.throws(() => loadChannelIdentities({ ERP_OMNICHANNEL_ENABLED: 'true', ERP_OMNICHANNEL_IDENTITIES: JSON.stringify([identity, identity]) }), /^Error: Invalid omnichannel identity configuration$/);
  assert.equal(saleEnvelopeSchema.safeParse({}).success, false);
});

test('integration_events FORCE RLS denies absent scope, other company and cross-group writes', async () => {
  const f = await boot();
  try {
    assert.equal((await f.send()).status, 201);
    await f.pg.exec('CREATE ROLE channel_reader; GRANT SELECT,INSERT ON integration_events TO channel_reader; SET ROLE channel_reader');
    assert.equal((await f.pg.query('SELECT id FROM integration_events')).rows.length, 0);
    await f.pg.query("SELECT set_config('erp.group_id',$1,false),set_config('erp.empresa_id',$2,false)", [S.groupA, S.empresaA]);
    assert.equal((await f.pg.query('SELECT id FROM integration_events')).rows.length, 1);
    await f.pg.query("SELECT set_config('erp.empresa_id',$1,false)", [S.empresaA2]);
    assert.equal((await f.pg.query('SELECT id FROM integration_events')).rows.length, 0);
    await assert.rejects(() => f.pg.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type) VALUES($1,$2,'SITE','venda.recebida')", [S.groupB, S.empresaB]), (error: unknown) => (error as { code: string }).code === '42501');
    await f.pg.exec('RESET ROLE');
  } finally { await f.close(); }
});
