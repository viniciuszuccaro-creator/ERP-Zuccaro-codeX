import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApiClient } from '../src/api/httpApiClient.js';

const clienteId = '11111111-1111-4111-8111-111111111111';
const localId = '22222222-2222-4222-8222-222222222222';
const version = 'a'.repeat(64), reviewVersion = 'b'.repeat(64);
const scope = { groupId: 'synthetic-group', empresaId: undefined, actorId: 'synthetic-actor', token: 'synthetic-token' };
const row = { id: localId, cliente_id: clienteId, group_id: scope.groupId, ativo: true, endereco_incompleto: false };
const response = body => new Response(JSON.stringify(body), { status: 200 });
const payload = { version, review_version: reviewVersion, operations: [{ op: 'review', id: localId, data: {}, activate: false }] };

test('local snapshot and review sync use canonical routes, fixed scope and distinct tokens', async () => {
  const calls = [];
  const api = createHttpApiClient({ baseUrl: 'https://synthetic.invalid', getScope: () => scope,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(options.method === 'POST' ? { version, reviewVersion, batchAtomic: true, data: [row] }
        : { version, reviewVersion, data: [row] });
    } });
  const before = await api.clientes.snapshotLocais(clienteId, { includeReview: true });
  assert.equal(before.reviewVersion, reviewVersion);
  assert.match(calls[0].url, /\/locais\/snapshot\?include_review=true$/);
  const result = await api.clientes.syncLocais(clienteId, payload);
  assert.equal(result.batchAtomic, true);
  assert.match(calls[1].url, /\/locais\/sync$/);
  assert.equal(JSON.parse(calls[1].options.body).operations[0].id, localId);
  assert.equal(calls[1].options.headers['X-Group-Id'], scope.groupId);
});

test('local snapshot/sync reject partial, cross-tenant, skipped and missing review version without fake success', async () => {
  for (const body of [{}, { version, data: [] }, { version, reviewVersion, data: [{ ...row, group_id: 'other' }] },
    { version, reviewVersion, data: [], partial: true }, { version, reviewVersion, data: [row, row] },
    { version, reviewVersion, data: [{ ...row, endereco_incompleto: undefined }] }]) {
    const api = createHttpApiClient({ baseUrl: 'https://synthetic.invalid', getScope: () => scope, fetchImpl: async () => response(body) });
    await assert.rejects(api.clientes.snapshotLocais(clienteId, { includeReview: true }), /SNAPSHOT_INVALID/);
  }
  for (const body of [{ skipped: true }, { version, reviewVersion, batchAtomic: true, data: [] },
    { version, reviewVersion, batchAtomic: true, data: [{ ...row, cliente_id: 'other' }] }]) {
    const api = createHttpApiClient({ baseUrl: 'https://synthetic.invalid', getScope: () => scope, fetchImpl: async () => response(body) });
    await assert.rejects(api.clientes.syncLocais(clienteId, payload), /SYNC_INVALID/);
    await assert.rejects(api.clientes.syncLocais(clienteId, { ...payload, review_version: undefined }), /REVIEW_VERSION_REQUIRED/);
  }
});

test('old local snapshot and save response cannot be accepted after actor/session/group/company changes', async () => {
  for (const method of ['snapshotLocais', 'syncLocais']) for (const key of ['actorId', 'token', 'groupId', 'empresaId']) {
    let current = { ...scope }, reply;
    const api = createHttpApiClient({ baseUrl: 'https://synthetic.invalid', getScope: () => current,
      fetchImpl: () => new Promise(resolve => { reply = resolve; }) });
    const pending = method === 'snapshotLocais' ? api.clientes.snapshotLocais(clienteId) : api.clientes.syncLocais(clienteId, payload);
    current = { ...scope, [key]: 'other' };
    reply(response({ version, reviewVersion, batchAtomic: true, data: [row] }));
    await assert.rejects(pending, { code: 'CONTEXT_CHANGED' });
  }
});
