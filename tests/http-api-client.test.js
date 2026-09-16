import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import {
  HTTP_PILOT_ENTITIES,
  resolveErpApiBaseUrl,
  resolveErpBackendMode,
} from '../src/api/runtimeBackend.js';

test('resolveErpBackendMode defaults to local without remote config', () => {
  assert.equal(resolveErpBackendMode({}), 'local');
  assert.equal(resolveErpBackendMode({ VITE_LOCAL_ONLY: 'true' }), 'local');
  assert.equal(resolveErpBackendMode({ VITE_ERP_BACKEND: 'http' }), 'http');
  assert.equal(resolveErpBackendMode({
    VITE_BASE44_APP_ID: 'x',
    VITE_BASE44_BACKEND_URL: 'https://example.test',
  }), 'remote');
});

test('resolveErpApiBaseUrl supports same-origin mode', () => {
  assert.equal(resolveErpApiBaseUrl({}), 'http://localhost:3080');
  assert.equal(resolveErpApiBaseUrl({ VITE_ERP_API_SAME_ORIGIN: 'true' }), '');
  assert.equal(
    resolveErpApiBaseUrl({ VITE_ERP_API_BASE_URL: 'https://api-erp-dev.cpaferroeaco.com.br/' }),
    'https://api-erp-dev.cpaferroeaco.com.br',
  );
});

test('HttpApiClient supports relative same-origin URLs', async () => {
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createHttpApiClient({
    baseUrl: '',
    fetchImpl,
    getScope: () => ({ groupId: '11111111-1111-4111-8111-111111111111' }),
  });
  await client.entities.Marca.list();
  assert.equal(urls[0].startsWith('/api/v1/marcas'), true);
});

test('HTTP_PILOT_ENTITIES includes RUNTIME-02 cadastros sem Produto', () => {
  assert.deepEqual([...HTTP_PILOT_ENTITIES], [
    'Marca',
    'UnidadeMedida',
    'GrupoProduto',
    'SetorAtividade',
  ]);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Produto'), false);
});

test('HttpApiClient maps Marca CRUD to BFF routes', async () => {
  /** @type {{ method: string, url: string, headers: HeadersInit, body?: string }[]} */
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      method: init.method || 'GET',
      url: String(url),
      headers: init.headers || {},
      body: init.body ? String(init.body) : undefined,
    });
    if (String(url).includes('/api/v1/marcas') && (init.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({
        data: { id: 'm1', nome_marca: 'Teste', group_id: 'g1', ativo: true },
      }), { status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'r1' } });
    }
    return new Response(JSON.stringify({ data: [{ id: 'm1', nome_marca: 'Teste' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    fetchImpl,
    getScope: () => ({ groupId: '11111111-1111-4111-8111-111111111111', actorEmail: 'a@b.c' }),
  });

  const created = await client.entities.Marca.create({ nome_marca: 'Teste' });
  assert.equal(created.nome_marca, 'Teste');
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].url, /\/api\/v1\/marcas$/);
  assert.equal(calls[0].headers['X-Group-Id'], '11111111-1111-4111-8111-111111111111');

  const listed = await client.entities.Marca.list('-created_date', 10);
  assert.equal(listed.length, 1);
});

test('HttpApiClient maps UnidadeMedida/GrupoProduto/SetorAtividade routes', async () => {
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    fetchImpl,
    getScope: () => ({ groupId: '11111111-1111-4111-8111-111111111111' }),
  });

  await client.entities.UnidadeMedida.list();
  await client.entities.GrupoProduto.filter({ nome_grupo: 'Aco' });
  await client.entities.SetorAtividade.get('s1');

  assert.match(urls[0], /\/api\/v1\/unidades-medida/);
  assert.match(urls[1], /\/api\/v1\/grupos-produto/);
  assert.match(urls[1], /search=Aco/);
  assert.match(urls[2], /\/api\/v1\/setores-atividade\/s1/);
});

test('Produto route exists in preparedEntities but not in pilot entities', async () => {
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ data: { id: 'p1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createHttpApiClient({ baseUrl: 'http://localhost:3080', fetchImpl });
  assert.equal(client.entities.Produto, undefined);
  await client.preparedEntities.Produto.get('p1');
  assert.match(urls[0], /\/api\/v1\/produtos\/p1/);
});
