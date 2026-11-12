import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApiClient } from '../src/api/httpApiClient.js';

const scope = { token: 'synthetic-only', groupId: 'synthetic-group', empresaId: 'synthetic-company', actorId: 'synthetic-actor' };
const row = { id: 'synthetic-local', cliente_id: 'synthetic-client', group_id: scope.groupId, ativo: false,
  endereco_incompleto: true, finalidades: [{ finalidade: 'FISCAL' }] };
const envelope = () => ({ data: [structuredClone(row)], meta: { limit: 50, offset: 0, total: 1, hasMore: false } });
function client(payload, status = 200, inspect = () => {}) {
  return createHttpApiClient({ baseUrl: 'https://synthetic.invalid', getScope: () => scope,
    fetchImpl: async (url, init) => { inspect(new URL(url), init); return new Response(JSON.stringify(payload), { status }); } });
}
test('revisao usa GET canonico, escopo autenticado e total autoritativo, sem escrita', async () => {
  const input = envelope();
  const page = await client(input, 200, (url, init) => {
    assert.equal(url.pathname, '/api/v1/clientes/synthetic-client/locais');
    assert.equal(url.searchParams.get('ativo'), 'false');
    assert.equal(url.searchParams.get('limit'), '50');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, 'Bearer synthetic-only');
    assert.equal(init.headers['X-Group-Id'], scope.groupId);
    assert.equal(init.headers['X-Empresa-Id'], scope.empresaId);
  }).clientes.listLocaisReviewPage('synthetic-client');
  assert.deepEqual(page, input);
});
test('vazio comprovado difere de erro, parcial, total invalido e registros alheios', async () => {
  assert.deepEqual(await client({ data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } })
    .clientes.listLocaisReviewPage('synthetic-client'), { data: [], meta: { limit: 50, offset: 0, total: 0, hasMore: false } });
  const bad = [null, {}, { data: [] }, { ...envelope(), data: [row, row] }];
  bad.push({ ...envelope(), partial: true }, { ...envelope(), meta: { ...envelope().meta, incomplete: true } });
  for (const total of ['1', -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) bad.push({ ...envelope(), meta: { ...envelope().meta, total } });
  for (const delta of [{ ativo: true }, { cliente_id: 'other-client' }, { group_id: 'other-group' }, { finalidades: null }]) {
    bad.push({ ...envelope(), data: [{ ...row, ...delta }] });
  }
  bad.push({ ...envelope(), meta: { ...envelope().meta, hasMore: true } });
  for (const payload of bad) await assert.rejects(client(payload).clientes.listLocaisReviewPage('synthetic-client'));
  for (const status of [401, 403, 422, 500]) await assert.rejects(client({ error: { code: 'SYNTHETIC' } }, status)
    .clientes.listLocaisReviewPage('synthetic-client'), error => error.status === status);
});
