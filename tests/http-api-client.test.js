import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiClient } from '../src/api/httpApiClient.js';
import {
  HTTP_PILOT_ENTITIES,
  resolveErpApiBaseUrl,
  resolveHttpPilotEntities,
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
  assert.equal(HTTP_PILOT_ENTITIES.includes('Cliente'), false);
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteLocal'), false);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Obra'), false);
});
test('Produto HTTP nao troca consumidores legados de fonte mesmo com opt-in do formulario', () => {
  assert.equal(resolveHttpPilotEntities({}).includes('Produto'), false);
  assert.equal(resolveHttpPilotEntities({ VITE_ERP_HTTP_PRODUTO: 'false' }).includes('Produto'), false);
  const enabled = resolveHttpPilotEntities({ VITE_ERP_HTTP_PRODUTO: 'true' });
  assert.equal(enabled.includes('Produto'), false);
  assert.deepEqual(enabled.filter((name) => name === 'Produto'), []);
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

test('Produto preparado lista somente metadados DAM no BFF sem ativar piloto', async () => {
  const calls = [];
  const controller = new AbortController();
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', actorId: 'ator-sintetico' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(JSON.stringify({ data: [{ id: 'midia-sintetica', status: 'QUARENTENA' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(client.entities.Produto, undefined);
  const rows = await client.preparedEntities.Produto.midias.list('produto/1', { limit: 10, offset: 5, signal: controller.signal });
  assert.deepEqual(rows, [{ id: 'midia-sintetica', status: 'QUARENTENA' }]);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/produtos/produto%2F1/midias');
  assert.equal(calls[0].method, 'GET');
  assert.equal(new URL(calls[0].url).searchParams.get('limit'), '10');
  assert.equal(new URL(calls[0].url).searchParams.get('offset'), '5');
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].signal, controller.signal);
  assert.equal(calls[0].headers['X-Group-Id'], 'grupo-sintetico');
  assert.equal(calls[0].headers['X-Empresa-Id'], 'empresa-sintetica');
  assert.equal(calls[0].headers['X-Actor-Id'], 'ator-sintetico');
});

test('Produto HTTP preparado cobre workflow e reserva/confirmacao sem tenant no body', async () => {
  const calls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', actorId: 'ator-sintetico' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
      return new Response(JSON.stringify({ data: { id: 'produto-sintetico', status: 'QUARENTENA', mediaId: 'm', attemptId: 'a' } }), {
        status: init.method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' },
      });
    },
  });
  const produto = client.preparedEntities.Produto;
  await produto.workflow('p', 'EM_REVISAO');
  await produto.midiaReserve('p', { storage_key: 'synthetic' });
  await produto.midiaConfirm('p', 'm', 'a');
  assert.deepEqual(calls.map((call) => call.method), ['PATCH', 'POST', 'POST']);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/v1/produtos/p/workflow', '/api/v1/produtos/p/midias/reservas',
    '/api/v1/produtos/p/midias/m/confirmar',
  ]);
  assert.ok(calls.every((call) => call.headers['X-Group-Id'] === 'grupo-sintetico'
    && call.headers['X-Empresa-Id'] === 'empresa-sintetica'));
  assert.equal(JSON.parse(calls[0].body).status, 'EM_REVISAO');
  assert.deepEqual(JSON.parse(calls[2].body), { attemptId: 'a' });
  assert.ok(calls.every((call) => !String(call.body).includes('groupId')));
});

test('Produto preparado expõe oito chamadas de relações sem ativar cadastro piloto', async () => {
  const calls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', actorId: 'ator-sintetico' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
      return new Response(JSON.stringify({ data: init.method === 'GET' ? [] : { id: 'relacao-sintetica' } }), {
        status: init.method === 'POST' ? 201 : 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(client.entities.Produto, undefined);
  const produto = client.preparedEntities.Produto;
  await produto.variantes.list('produto/1');
  await produto.variantes.create('produto/1', { sku: 'SKU-SINTETICO' });
  await produto.variantes.update('produto/1', 'variante/1', { nome: 'Azul' });
  await produto.variantes.deactivate('produto/1', 'variante/1');
  await produto.equivalentes.list('produto/1');
  await produto.equivalentes.create('produto/1', { produto_equivalente_id: 'produto/2' });
  await produto.equivalentes.update('produto/1', 'equivalente/1', { aprovado: true });
  await produto.equivalentes.deactivate('produto/1', 'equivalente/1');
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST', 'PATCH', 'DELETE', 'GET', 'POST', 'PATCH', 'DELETE']);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/v1/produtos/produto%2F1/variantes',
    '/api/v1/produtos/produto%2F1/variantes',
    '/api/v1/produtos/produto%2F1/variantes/variante%2F1',
    '/api/v1/produtos/produto%2F1/variantes/variante%2F1',
    '/api/v1/produtos/produto%2F1/equivalentes',
    '/api/v1/produtos/produto%2F1/equivalentes',
    '/api/v1/produtos/produto%2F1/equivalentes/equivalente%2F1',
    '/api/v1/produtos/produto%2F1/equivalentes/equivalente%2F1',
  ]);
  assert.ok(calls.every((call) => call.headers['X-Group-Id'] === 'grupo-sintetico'
    && call.headers['X-Empresa-Id'] === 'empresa-sintetica'
    && call.headers['X-Actor-Id'] === 'ator-sintetico'));
  assert.deepEqual(JSON.parse(calls[1].body), { sku: 'SKU-SINTETICO' });
  assert.deepEqual(JSON.parse(calls[5].body), { produto_equivalente_id: 'produto/2' });
  assert.equal(calls[3].body, undefined);
  assert.equal(calls[7].body, undefined);
});

test('Produto HTTP notifica consumidores somente apos mutacao confirmada', async () => {
  let accepted = true;
  const client = createHttpApiClient({ baseUrl: 'https://erp.invalid', fetchImpl: async () => new Response(
    JSON.stringify(accepted ? { data: { id: 'p' } } : { error: { code: 'CONFLICT' } }),
    { status: accepted ? 200 : 409, headers: { 'content-type': 'application/json' } },
  ) });
  const produto = client.preparedEntities.Produto;
  let notifications = 0;
  const unsubscribe = produto.subscribe(() => { notifications += 1; });
  await produto.create({ descricao: 'Sintetico' });
  await produto.update('p', { descricao: 'Atualizado' });
  await produto.delete('p');
  assert.equal(notifications, 3);
  accepted = false;
  await assert.rejects(produto.create({ descricao: 'Falha' }));
  assert.equal(notifications, 3);
  unsubscribe();
  accepted = true;
  await produto.create({ descricao: 'Depois' });
  assert.equal(notifications, 3);
});

test('HTTP Bearer delegates actor identity to backend and keeps requested tenant scope', async () => {
  const calls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({
      groupId: '11111111-1111-4111-8111-111111111111',
      empresaId: '33333333-3333-4333-8333-333333333333',
      actorId: 'supabase-auth-user-not-profile',
      actorEmail: 'stale@example.test',
      token: '  synthetic.jwt.token  ',
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), ...init });
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.entities.Marca.list();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, 'Bearer synthetic.jwt.token');
  assert.equal(calls[0].headers['X-Group-Id'], '11111111-1111-4111-8111-111111111111');
  assert.equal(calls[0].headers['X-Empresa-Id'], '33333333-3333-4333-8333-333333333333');
  assert.equal(calls[0].headers['X-Actor-Id'], undefined);
  assert.equal(calls[0].headers['X-Actor-Email'], undefined);
  assert.equal(calls[0].url.includes('synthetic.jwt.token'), false);
  assert.equal(calls[0].body, undefined);
});

test('HTTP legacy scope still sends actor headers without a Bearer token', async () => {
  let headers;
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: 'grupo-local', actorId: 'ator-local', actorEmail: 'local@example.test', token: '  ' }),
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    },
  });
  await client.entities.Marca.list();
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers['X-Actor-Id'], 'ator-local');
  assert.equal(headers['X-Actor-Email'], 'local@example.test');
});

test('HTTP rejected Bearer never falls back to local data or leaks token in error', async () => {
  let calls = 0;
  const client = createHttpApiClient({
    baseUrl: 'https://erp.invalid',
    getScope: () => ({ groupId: 'grupo-sintetico', actorId: 'ator-local', token: 'synthetic.jwt.token' }),
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 'AUTH_INVALID', message: 'Invalid user token' } }), {
        status: 401, headers: { 'content-type': 'application/json' },
      });
    },
  });
  await assert.rejects(client.entities.Marca.list(), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'AUTH_INVALID');
    assert.equal(String(error).includes('synthetic.jwt.token'), false);
    return true;
  });
  assert.equal(calls, 1);
});
