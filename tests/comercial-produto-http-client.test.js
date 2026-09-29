import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PRODUTO = '44444444-4444-4444-8444-444444444444';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-pr' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];
    if (String(url).includes('/produtos/') && method === 'GET' && !String(url).includes('?')) {
      return response({
        data: {
          id: PRODUTO,
          codigo: '000100',
          descricao: 'Chapa sintética',
          ativo: true,
          group_id: GROUP_A,
          empresa_id: scopeEmpresa,
        },
      });
    }
    if (String(url).includes('/produtos') && method === 'GET') {
      return response({
        data: [{
          id: PRODUTO,
          codigo: '000100',
          descricao: 'Chapa sintética',
          ativo: true,
          group_id: GROUP_A,
          empresa_id: scopeEmpresa,
        }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    return response({ data: { id: PRODUTO } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui Produto', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('Produto'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Cliente'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Obra'), true);
});

test('HTTP list Produto preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.produtos.list({ limit: 50, offset: 0, ativo: true, search: 'chapa' });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, PRODUTO);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/produtos');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), 'chapa');
  assert.equal(url.searchParams.get('ativo'), 'true');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP Produto Empresa B isola header sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.produtos.list({ limit: 10 });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP get Produto mapeia path canônico', async () => {
  const { client, calls } = setup();
  const row = await client.produtos.get(PRODUTO);
  assert.equal(row.id, PRODUTO);
  assert.equal(new URL(calls[0].url).pathname, `/api/v1/produtos/${PRODUTO}`);
});

test('entity Produto piloto usa /api/v1/produtos', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.Produto);
  await client.entities.Produto.filter({ ativo: true, search: 'chapa' }, 'descricao', 20);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/produtos');
  assert.equal(new URL(calls[0].url).searchParams.get('search'), 'chapa');
});

test('HTTP list Produto fail-closed em 403', async () => {
  const denied = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR }),
    fetchImpl: async () => response({ error: { code: 'PERMISSION_DENIED', message: 'negado' } }, 403),
  });
  await assert.rejects(denied.produtos.list({}), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_DENIED');
    return true;
  });
});

test('preparedEntities.Produto permanece para DAM/workflow', async () => {
  const { client, calls } = setup();
  assert.ok(client.preparedEntities.Produto);
  await client.preparedEntities.Produto.workflow(PRODUTO, 'EM_REVISAO');
  assert.equal(new URL(calls[0].url).pathname, `/api/v1/produtos/${PRODUTO}/workflow`);
  assert.equal(calls[0].options.method, 'PATCH');
});
