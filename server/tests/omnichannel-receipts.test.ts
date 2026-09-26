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
