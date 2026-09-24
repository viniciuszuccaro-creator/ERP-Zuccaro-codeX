import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => name.toLowerCase() === 'x-request-id' ? 'req-test' : null },
  text: async () => JSON.stringify(body),
});

function setup() {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('?')) return response({ data: [], meta: { total: 0, limit: 25, offset: 0 } });
    return response({ data: { id: 'orc-1' } }, options.method === 'POST' ? 201 : 200);
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: 'group-a', empresaId: 'empresa-a', actorId: 'actor-a' }),
    fetchImpl,
  }).orcamentos;
  return { client, calls };
}

test('cliente HTTP de orcamentos preserva envelope paginado e contexto tenant', async () => {
  const { client, calls } = setup();
  const result = await client.list({ limit: 25, offset: 50 });
  assert.deepEqual(result.meta, { total: 0, limit: 25, offset: 0 });
  assert.match(calls[0].url, /\/api\/v1\/orcamentos\?limit=25&offset=50$/);
  assert.equal(calls[0].options.headers['X-Group-Id'], 'group-a');
  assert.equal(calls[0].options.headers['X-Empresa-Id'], 'empresa-a');
  assert.equal(calls[0].options.headers['X-Actor-Id'], 'actor-a');
});

test('cliente HTTP cobre consulta, criacao, atualizacao e cancelamento oficiais', async () => {
  const { client, calls } = setup();
  await client.get('orc 1');
  await client.create({ itens: [{ produto_id: 'p1' }] });
  await client.update('orc-1', { observacoes: 'ajuste' });
  await client.cancel('orc-1');
  assert.deepEqual(calls.map((call) => [new URL(call.url).pathname, call.options.method]), [
    ['/api/v1/orcamentos/orc%201', 'GET'],
    ['/api/v1/orcamentos', 'POST'],
    ['/api/v1/orcamentos/orc-1', 'PATCH'],
    ['/api/v1/orcamentos/orc-1/cancelar', 'POST'],
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { itens: [{ produto_id: 'p1' }] });
});

test('cliente HTTP propaga erro padronizado sem ocultar status e requestId', async () => {
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: 'g', empresaId: 'e', actorId: 'a' }),
    fetchImpl: async () => response({ error: { code: 'FORBIDDEN', message: 'Acesso negado' } }, 403),
  }).orcamentos;
  await assert.rejects(client.get('orc-1'), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(error.requestId, 'req-test');
    return true;
  });
});

test('cliente HTTP preserva contratos 400 403 404 409 e 422', async () => {
  for (const status of [400, 403, 404, 409, 422]) {
    const client = createHttpApiClient({
      baseUrl: 'https://erp.test',
      getScope: () => ({ groupId: 'g', empresaId: 'e', actorId: 'a' }),
      fetchImpl: async () => response({ error: { code: `HTTP_${status}`, message: `erro ${status}` } }, status),
    }).orcamentos;
    await assert.rejects(client.get('orc-1'), (error) => error.status === status && error.code === `HTTP_${status}`);
  }
});

test('cliente HTTP envia pesquisa e filtros de orcamento sem tenant no query', async () => {
  const { client, calls } = setup();
  await client.list({ limit: 10, offset: 20, search: '00042', status: 'EM_ABERTO', clienteEmpresaId: 'cliente-link', validadeDe: '2027-01-01', validadeAte: '2027-01-31' });
  const url = new URL(calls[0].url);
  assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '10', offset: '20', search: '00042', status: 'EM_ABERTO', clienteEmpresaId: 'cliente-link', validadeDe: '2027-01-01', validadeAte: '2027-01-31' });
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(url.searchParams.has('empresaId'), false);
});