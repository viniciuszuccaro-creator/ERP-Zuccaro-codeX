import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../src/api/httpApiClient.js';

test('Fornecedor sends only authenticated reads and discards results after a scope change', async () => {
  let scope = { token: 'synthetic-token', groupId: 'group-a', empresaId: 'company-a', actorId: 'actor-a' };
  const requests = [];
  let release;
  const client = createHttpApiClient({
    baseUrl: 'https://erp.synthetic.test',
    getScope: () => scope,
    fetchImpl: async (url, init) => {
      requests.push({ url: new URL(url), init });
      if (requests.length === 2) await new Promise(resolve => { release = resolve; });
      return Response.json({ data: { items: [], hasMore: false } });
    },
  }).fornecedores;
  assert.deepEqual(Object.keys(client).sort(), ['get', 'list']);
  assert.deepEqual(await client.list({ search: '002', limit: 20, offset: 40 }), { items: [], hasMore: false });
  assert.equal(requests[0].url.pathname, '/api/v1/fornecedores');
  assert.equal(requests[0].url.searchParams.get('search'), '002');
  assert.equal(requests[0].url.searchParams.get('offset'), '40');
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(new Headers(requests[0].init.headers).get('x-empresa-id'), 'company-a');
  const pending = client.get('supplier-id');
  scope = { ...scope, empresaId: 'company-b' };
  release();
  await assert.rejects(pending, error => error.status === 409 && error.code === 'CONTEXT_CHANGED');
  scope = { ...scope, token: '' };
  await assert.rejects(client.list(), error => error.status === 401);
  assert.equal(requests.length, 2);
});
