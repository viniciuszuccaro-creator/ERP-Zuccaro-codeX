import assert from 'node:assert/strict';

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

export const now = 1_790_454_000_000;
export const identity: ChannelIdentity = { id: 'synthetic-site', channel: 'SITE', groupId: S.groupA,
  empresaId: S.empresaA, actorId: S.runtimeActorA, secret: 'synthetic-only-secret-never-use-live-123' };

export async function boot(pg = new PGlite(), extraIdentities: ChannelIdentity[] = [], rateLimitMax?: number) {
  try {
  for (const file of readdirSync(new URL('../migrations', import.meta.url)).filter((s) => s.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''));
  }
  await pg.exec(readFileSync(new URL('../scripts/seed-dev-synthetic.sql', import.meta.url), 'utf8'));
  const permissions = { Integracoes: { vendas: ['importar', 'visualizar'] }, Comercial: { pedido: ['criar', 'visualizar'], orcamento: ['criar', 'visualizar'] } };
  await pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), S.runtimeActorA]);
  const base: DbClient = { pool: {} as never, query: (sql, params) => pg.query(sql, params as never) as never,
    withTransaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params as never) as never } as DbQueryExecutor)),
    checkConnection: async () => true, end: async () => pg.close() };
  const db = transactionScope(base);
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://synthetic/isolated' });
  if(rateLimitMax !== undefined) config.rateLimitMax=rateLimitMax;
  const runtime = createApp({ config, db });
  const ingress = new SaleIngress(db, runtime);
  // Production migration 033, not a hand-applied policy fixture, is the source of readiness.
  await ingress.assertDatabaseReady();
  // Synthetic data, real canonical price repository and service (no pricing stub).
  await pg.query('UPDATE tabela_preco_itens SET preco=25.500000 WHERE id=$1', [S.tabelaPrecoItemAKg]);
  const client = await pg.query<{ id: string }>('SELECT id FROM cliente_empresas WHERE group_id=$1 AND empresa_id=$2 LIMIT 1', [S.groupA, S.empresaA]);
  const documento = { cliente_empresa_id: client.rows[0].id, condicao_pagamento_id: S.condicaoPagamentoA,
    tipo_operacao: 'RETIRADA', data_entrega_solicitada: '2027-03-01T00:00:00.000Z',
    itens: [{ produto_id: S.produtoA, unidade_id: S.unidadeA, descricao: 'Item sintético', unidade_sigla: 'KG', quantidade: '2' }] };
  const envelope = { version: 1, tipo: 'Pedido', idempotencyKey: 'synthetic-order-1', documento };
  const identities = [...(['SITE', 'APP', 'CHATBOT', 'MARKETPLACE'] as const).map((channel) => ({ ...identity, id: `synthetic-${channel}`, channel })), ...extraIdentities];
  const app = express();
  app.set('trust proxy', runtime.app.get('trust proxy'));
  app.use('/sales', saleIngressHttp(ingress, identities, config, () => now));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  async function send(payload: unknown = envelope, options: { channel?: string; nonce?: string; time?: string; signature?: string; body?: string; path?: string; forwardedFor?: string } = {}) {
    const clientId = options.channel ?? 'synthetic-SITE';
    const timestamp = options.time ?? String(now / 1000);
    const nonce = options.nonce ?? 'synthetic-nonce-00001';
    const body = Buffer.from(options.body ?? JSON.stringify(payload));
    const response = await fetch(`http://127.0.0.1:${address.port}/sales${options.path ?? ''}`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-channel-id': clientId, 'x-channel-timestamp': timestamp,
        'x-channel-nonce': nonce, 'x-channel-signature': options.signature ?? signSale(identity.secret, clientId, timestamp, nonce, body),
        'x-group-id': S.groupB, 'x-empresa-id': S.empresaB, 'x-actor-id': S.runtimeActorB,
        ...(options.forwardedFor?{'x-forwarded-for':options.forwardedFor}:{}) }, body });
    return { status: response.status, body: (response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : {}) as { data?: { id: string }; replayed?: boolean; error?: { code: string } } };
  }
  return { pg, db, runtime, ingress, envelope, send, endpoint: `http://127.0.0.1:${address.port}/sales`,
    close: async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await pg.close(); } };
  } catch (error) { await pg.close(); throw error; }
}

/** Shared assertions exercise the same contracts in PGlite and actual PostgreSQL CI. */
export async function assertCanonicalChannelSales(f: Awaited<ReturnType<typeof boot>>) {
    const { tipo_operacao: _tipo, data_entrega_solicitada: _data, ...base } = f.envelope.documento;
    for (const channel of ['SITE', 'APP', 'CHATBOT', 'MARKETPLACE']) {
      for (const tipo of ['Pedido', 'Orcamento']) {
        const payload = { ...f.envelope, tipo, idempotencyKey: channel+'-'+tipo,
          documento: tipo === 'Pedido' ? f.envelope.documento : { ...base, validade_em: '2027-01-01T00:00:00.000Z' } };
        const options = { channel: 'synthetic-'+channel, nonce: 'synthetic-create-'+tipo };
        const created = await f.send(payload, options); assert.equal(created.status, 201);
        const repeated = await f.send(payload, { ...options, nonce: 'synthetic-retry-'+tipo });
        assert.equal(repeated.status, 200); assert.equal(repeated.body.data?.id, created.body.data?.id);
        const table = tipo === 'Pedido' ? 'pedidos' : 'orcamentos';
        const row = (await f.pg.query<{ total: string; group_id: string; empresa_id: string; origem: string; canal: string; external_id: string; idempotency_key: string }>(
          'SELECT total,group_id,empresa_id,origem,canal,external_id,idempotency_key FROM '+table+' WHERE id=$1', [created.body.data!.id])).rows[0];
        assert.equal(row.total, '51.000000'); assert.equal(row.group_id, S.groupA); assert.equal(row.empresa_id, S.empresaA);
        assert.equal(row.origem, channel); assert.equal(row.canal, channel);
        assert.match(row.external_id, /^omni:v1:[a-f0-9]{64}$/); assert.match(row.idempotency_key, /^sale:v1:[a-f0-9]{64}$/);
      }
    }
    assert.equal((await f.pg.query('SELECT id FROM pedidos')).rows.length, 4);
    assert.equal((await f.pg.query('SELECT id FROM orcamentos')).rows.length, 4);
}
