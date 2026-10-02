import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

const GROUP = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '33333333-3333-4333-8333-333333333333';
const ACTOR = '66666666-6666-4666-8666-666666666666';
const ACTOR_DENIED = '88888888-8888-4888-8888-888888888888';

function fixture(extra: string[] = []) {
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false' });
  const tenantGuard = new InMemoryTenantGuard();
  tenantGuard.link(EMPRESA, GROUP);
  const rbacGuard = new InMemoryRbacGuard();
  const allowed = { Cadastros: { produto: ['visualizar', 'criar', 'editar', 'aprovar-conteudo', 'publicar', ...extra] } };
  rbacGuard.link({ actorId: ACTOR, groupId: GROUP, permissions: allowed });
  rbacGuard.link({ actorId: ACTOR_DENIED, groupId: GROUP, permissions: { Cadastros: { produto: ['visualizar', 'criar', 'editar'] } } });
  return createApp({ config, db: createDbClient(config), useMemory: true, tenantGuard, rbacGuard });
}

function headers(actorId = ACTOR) {
  return { 'content-type': 'application/json', 'x-group-id': GROUP, 'x-empresa-id': EMPRESA, 'x-actor-id': actorId };
}

test('HTTP Onda 15: claim/confirm outbox exige publicar e nao entrega canal', async () => {
  const { app } = fixture();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, hdrs = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: hdrs, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const created = await request('/api/v1/produtos', 'POST', { descricao: 'Outbox HTTP' });
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'EM_REVISAO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'APROVADO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'PUBLICADO' })).status, 200);

    const denied = await request('/api/v1/produtos/outbox/claim', 'POST', { limit: 5 }, headers(ACTOR_DENIED));
    assert.equal(denied.status, 403);

    const claimed = await request('/api/v1/produtos/outbox/claim', 'POST', { limit: 5, leaseMs: 30000 });
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.data.length, 1);
    assert.equal(claimed.body.data[0].status, 'processing');
    assert.ok(claimed.body.data[0].leaseToken);
    assert.equal(claimed.body.data[0].produtoId, id);

    const eventId = claimed.body.data[0].id;
    const bad = await request(`/api/v1/produtos/outbox/${eventId}/confirm`, 'POST', { leaseToken: 'x' });
    assert.equal(bad.status, 404);

    const ok = await request(`/api/v1/produtos/outbox/${eventId}/confirm`, 'POST', {
      leaseToken: claimed.body.data[0].leaseToken,
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'published');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('HTTP Onda 15: process batch fake exige publicar e confirma localmente', async () => {
  const { app } = fixture();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, hdrs = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: hdrs, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const created = await request('/api/v1/produtos', 'POST', { descricao: 'Outbox process HTTP' });
    const id = created.body.data.id;
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'EM_REVISAO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'APROVADO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'PUBLICADO' })).status, 200);

    const denied = await request('/api/v1/produtos/outbox/process', 'POST', { limit: 5 }, headers(ACTOR_DENIED));
    assert.equal(denied.status, 403);

    const processed = await request('/api/v1/produtos/outbox/process', 'POST', { limit: 5, leaseMs: 30000 });
    assert.equal(processed.status, 200);
    assert.equal(processed.body.data.claimed, 1);
    assert.equal(processed.body.data.results[0].outcome, 'published');

    const empty = await request('/api/v1/produtos/outbox/process', 'POST', { limit: 5 });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.data.claimed, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('HTTP Onda 15: fail agenda retry com lease token valido', async () => {
  const { app } = fixture();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, hdrs = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: hdrs, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const created = await request('/api/v1/produtos', 'POST', { descricao: 'Outbox fail HTTP' });
    const id = created.body.data.id;
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'EM_REVISAO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'APROVADO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'PUBLICADO' })).status, 200);
    const claimed = await request('/api/v1/produtos/outbox/claim', 'POST', { limit: 1, leaseMs: 30000 });
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.data.length, 1);
    const eventId = claimed.body.data[0].id;
    const failed = await request(`/api/v1/produtos/outbox/${eventId}/fail`, 'POST', {
      leaseToken: claimed.body.data[0].leaseToken,
      errorMessage: 'temporary_http',
    });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data.status, 'retry');
    assert.ok(failed.body.data.nextAttemptAt);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('HTTP Onda 15: reprocess exige Cadastros.produto.reprocessar e rejeita evento inexistente', async () => {
  const missingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const deniedApp = fixture(['reprocessar']); // ACTOR has reprocessar; ACTOR_DENIED does not
  const deniedServer = deniedApp.app.listen(0);
  await new Promise<void>((resolve) => deniedServer.once('listening', resolve));
  const deniedPort = (deniedServer.address() as AddressInfo).port;
  try {
    const denied = await fetch(`http://127.0.0.1:${deniedPort}/api/v1/produtos/outbox/${missingId}/reprocess`, {
      method: 'POST',
      headers: headers(ACTOR_DENIED),
      body: JSON.stringify({ reason: 'nope' }),
    });
    assert.equal(denied.status, 403);

    const onlyPublish = fixture();
    const pubServer = onlyPublish.app.listen(0);
    await new Promise<void>((resolve) => pubServer.once('listening', resolve));
    const pubPort = (pubServer.address() as AddressInfo).port;
    try {
      const pubDenied = await fetch(`http://127.0.0.1:${pubPort}/api/v1/produtos/outbox/${missingId}/reprocess`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ reason: 'only_publicar' }),
      });
      assert.equal(pubDenied.status, 403);
    } finally {
      await new Promise<void>((resolve, reject) => pubServer.close((e) => (e ? reject(e) : resolve())));
    }

    const missing = await fetch(`http://127.0.0.1:${deniedPort}/api/v1/produtos/outbox/${missingId}/reprocess`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reason: 'missing_dead_letter' }),
    });
    assert.equal(missing.status, 404);
    const body = await missing.json();
    assert.equal(body.error.code, 'OUTBOX_EVENT_NOT_FOUND');
  } finally {
    await new Promise<void>((resolve, reject) => deniedServer.close((e) => (e ? reject(e) : resolve())));
  }
});

test('HTTP Onda 15: reprocess dead-letter preserva eventId e volta a pending', async () => {
  const { app, produtoService } = fixture(['reprocessar']);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, hdrs = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: hdrs, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const created = await request('/api/v1/produtos', 'POST', { descricao: 'Outbox reprocess HTTP' });
    const id = created.body.data.id;
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'EM_REVISAO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'APROVADO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'PUBLICADO' })).status, 200);

    const claimed = await request('/api/v1/produtos/outbox/claim', 'POST', { limit: 1, leaseMs: 30000 });
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.data.length, 1);
    const eventId = claimed.body.data[0].id as string;
    const leaseToken = claimed.body.data[0].leaseToken as string;

    // Force dead_letter via service repo contract: fail once after lowering maxAttempts on in-memory store.
    const repo = (produtoService as unknown as { repo: { publicationEvents?: Array<{ id: string; maxAttempts: number }> } }).repo;
    const row = repo.publicationEvents?.find((event) => event.id === eventId);
    assert.ok(row);
    row!.maxAttempts = 1;
    // attempts already incremented by claim; fail now exhausts
    const failed = await request(`/api/v1/produtos/outbox/${eventId}/fail`, 'POST', {
      leaseToken, errorMessage: 'force_dead_letter',
    });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data.status, 'dead_letter');

    const reprocessed = await request(`/api/v1/produtos/outbox/${eventId}/reprocess`, 'POST', {
      reason: 'http_operator_retry',
    });
    assert.equal(reprocessed.status, 200);
    assert.equal(reprocessed.body.data.id, eventId);
    assert.equal(reprocessed.body.data.status, 'pending');
    assert.equal(reprocessed.body.data.attempts, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('HTTP Onda 15: confirm repetido devolve recibo already_published', async () => {
  const { app } = fixture();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const request = async (path: string, method = 'GET', body?: unknown, hdrs = headers()) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: hdrs, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const created = await request('/api/v1/produtos', 'POST', { descricao: 'Confirm idempotente HTTP' });
    const id = created.body.data.id;
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'EM_REVISAO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'APROVADO' })).status, 200);
    assert.equal((await request(`/api/v1/produtos/${id}/workflow`, 'PATCH', { status: 'PUBLICADO' })).status, 200);
    const claimed = await request('/api/v1/produtos/outbox/claim', 'POST', { limit: 1, leaseMs: 30000 });
    const eventId = claimed.body.data[0].id;
    const first = await request(`/api/v1/produtos/outbox/${eventId}/confirm`, 'POST', {
      leaseToken: claimed.body.data[0].leaseToken,
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.receipt, 'confirmed');
    const second = await request(`/api/v1/produtos/outbox/${eventId}/confirm`, 'POST', {
      leaseToken: 'stale-or-any',
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.receipt, 'already_published');
    assert.equal(second.body.data.id, eventId);
    assert.equal(second.body.data.status, 'published');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
