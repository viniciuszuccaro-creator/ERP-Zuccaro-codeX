import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { DbClient, DbQueryExecutor } from '../src/db/client.js';
import { transactionScope } from '../src/integrations/transactionScope.js';
import { SaleIngress } from '../src/integrations/saleIngress.js';
import { loadChannelIdentities, saleIngressHttp } from '../src/integrations/saleIngressHttp.js';
import { saleEnvelopeSchema, signSale, type ChannelIdentity } from '../src/integrations/saleIngressContract.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

const now = 1_790_454_000_000;
const identity: ChannelIdentity = { id: 'synthetic-site', channel: 'SITE', groupId: S.groupA,
  empresaId: S.empresaA, actorId: S.runtimeActorA, secret: 'synthetic-only-secret-never-use-live-123' };

async function boot() {
  const pg = new PGlite();
  for (const file of readdirSync(new URL('../migrations', import.meta.url)).filter((s) => s.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''));
  }
  await pg.exec(readFileSync(new URL('../scripts/seed-dev-synthetic.sql', import.meta.url), 'utf8'));
  const permissions = { Integracoes: { vendas: ['importar'] }, Comercial: { pedido: ['criar'], orcamento: ['criar'] } };
  await pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), S.runtimeActorA]);
  const base: DbClient = { pool: {} as never, query: (sql, params) => pg.query(sql, params as never) as never,
    withTransaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params as never) as never } as DbQueryExecutor)),
    checkConnection: async () => true, end: async () => pg.close() };
  const db = transactionScope(base);
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://synthetic/isolated' });
  const runtime = createApp({ config, db });
  const ingress = new SaleIngress(db, runtime);
  await assert.rejects(() => ingress.assertDatabaseReady(), /RLS gate not satisfied/);
  await pg.exec(readFileSync(new URL('../src/integrations/ingressRls.sql', import.meta.url), 'utf8'));
  await ingress.assertDatabaseReady();
  // Only the price source is synthetic. Document/reference repositories, RBAC and audit use PostgreSQL.
  for (const service of [runtime.orcamentoService, runtime.pedidoService]) {
    (service as unknown as { prices: { resolveSalePrice: () => Promise<{ preco: string }> } }).prices = {
      resolveSalePrice: async () => ({ preco: '25.500000' }),
    };
  }
  const client = await pg.query<{ id: string }>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 LIMIT 1', [S.groupA, S.empresaA]);
  const documento = { cliente_empresa_id: client.rows[0].id, condicao_pagamento_id: S.condicaoPagamentoA,
    tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-01T00:00:00.000Z',
    itens: [{ produto_id: S.produtoA, unidade_id: S.unidadeA, descricao: 'Item sintético', unidade_sigla: 'KG', quantidade: '2' }] };
  const envelope = { version: 1, tipo: 'Pedido', idempotencyKey: 'synthetic-order-1', documento };
  const identities = (['SITE', 'APP', 'CHATBOT', 'MARKETPLACE'] as const).map((channel) => ({ ...identity, id: `synthetic-${channel}`, channel }));
  const app = express();
  app.use('/sales', saleIngressHttp(ingress, identities, config, () => now));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  async function send(payload: unknown = envelope, options: { channel?: string; nonce?: string; time?: string; signature?: string; body?: string } = {}) {
    const clientId = options.channel ?? 'synthetic-SITE';
    const timestamp = options.time ?? String(now / 1000);
    const nonce = options.nonce ?? 'synthetic-nonce-00001';
    const body = Buffer.from(options.body ?? JSON.stringify(payload));
    const response = await fetch(`http://127.0.0.1:${address.port}/sales`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-channel-id': clientId, 'x-channel-timestamp': timestamp,
        'x-channel-nonce': nonce, 'x-channel-signature': options.signature ?? signSale(identity.secret, clientId, timestamp, nonce, body),
        'x-group-id': S.groupB, 'x-empresa-id': S.empresaB, 'x-actor-id': S.runtimeActorB }, body });
    return { status: response.status, body: await response.json() as { data?: { id: string }; replayed?: boolean; error?: { code: string } } };
  }
  return { pg, envelope, send, close: async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await pg.close(); } };
}

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
