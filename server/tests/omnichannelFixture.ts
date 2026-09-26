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

export async function boot(pg = new PGlite(), extraIdentities: ChannelIdentity[] = []) {
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
  const identities = [...(['SITE', 'APP', 'CHATBOT', 'MARKETPLACE'] as const).map((channel) => ({ ...identity, id: `synthetic-${channel}`, channel })), ...extraIdentities];
  const app = express();
  app.use('/sales', saleIngressHttp(ingress, identities, config, () => now));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  async function send(payload: unknown = envelope, options: { channel?: string; nonce?: string; time?: string; signature?: string; body?: string; path?: string } = {}) {
    const clientId = options.channel ?? 'synthetic-SITE';
    const timestamp = options.time ?? String(now / 1000);
    const nonce = options.nonce ?? 'synthetic-nonce-00001';
    const body = Buffer.from(options.body ?? JSON.stringify(payload));
    const response = await fetch(`http://127.0.0.1:${address.port}/sales${options.path ?? ''}`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-channel-id': clientId, 'x-channel-timestamp': timestamp,
        'x-channel-nonce': nonce, 'x-channel-signature': options.signature ?? signSale(identity.secret, clientId, timestamp, nonce, body),
        'x-group-id': S.groupB, 'x-empresa-id': S.empresaB, 'x-actor-id': S.runtimeActorB }, body });
    return { status: response.status, body: await response.json() as { data?: { id: string }; replayed?: boolean; error?: { code: string } } };
  }
  return { pg, envelope, send, close: async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await pg.close(); } };
  } catch (error) { await pg.close(); throw error; }
}
