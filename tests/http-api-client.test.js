import assert from 'node:assert/strict';
import test from 'node:test';

test('HTTP entityGuard usa sessão Bearer canônica e não aceita profile_id fabricado', async () => {
  const client = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ token: 'synthetic-token', actorId: 'server-profile', groupId: 'synthetic-group' }),
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, '/api/v1/auth/session');
      assert.equal(init.headers.Authorization, 'Bearer synthetic-token');
      assert.equal(JSON.parse(parsed.searchParams.get('guard')).profile_id, 'server-profile');
      assert.equal(parsed.search.includes('synthetic-token'), false);
      return new Response(JSON.stringify({ data: { allowed: false } }), { status: 200 });
    },
  });
  assert.deepEqual(await client.entityGuard({ profile_id: 'fabricated', module: 'Comercial', group_id: 'synthetic-group', empresa_id: null, action: 'visualizar' }), { data: { allowed: false } });
  const missing = createHttpApiClient({ getScope: () => ({}), fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(missing.entityGuard(), error => error.status === 401);
});
import { createHttpApiClient } from '../src/api/httpApiClient.js';

test('Pedido facade preserves filters, request methods, payloads and AbortSignal', async () => {
  const calls = [];
  const controller = new AbortController();
  const client = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ token: 'synthetic-token', groupId: 'synthetic-group', empresaId: 'synthetic-company' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(String(url)), init });
      return new Response(JSON.stringify({ data: { id: 'synthetic-id' }, meta: { total: 1 } }), { status: 200 });
    },
  });
  const options = { signal: controller.signal };
  const envelope = await client.pedidos.list({ limit: 7, offset: 2, search: 'synthetic', status: 'Aberto', clienteEmpresaId: 'synthetic-link', tipoOperacao: 'Venda', ...options });
  assert.equal(envelope.meta.total, 1);
  assert.equal(calls[0].url.searchParams.get('clienteEmpresaId'), 'synthetic-link');
  assert.equal(calls[0].url.searchParams.get('tipoOperacao'), 'Venda');
  await client.pedidos.get('synthetic/id', options);
  await client.pedidos.create({ referencia: 'synthetic' }, options);
  await client.pedidos.update('synthetic/id', { observacoes: 'synthetic' }, options);
  await client.pedidos.cancel('synthetic/id', 'synthetic-reason', options);
  await client.pedidos.transition('synthetic/id', 'Aprovado', 'synthetic-reason', options);
  await client.pedidos.history('synthetic/id', options);
  await client.pedidos.convertOrcamento('synthetic/id', { referencia: 'synthetic' }, options);
  assert.deepEqual(calls.map(call => call.init.method), ['GET', 'GET', 'POST', 'PATCH', 'POST', 'POST', 'GET', 'POST']);
  assert.equal(calls[1].url.pathname, '/api/v1/pedidos/synthetic%2Fid');
  assert.deepEqual(JSON.parse(calls[5].init.body), { status: 'Aprovado', motivo: 'synthetic-reason' });
  for (const call of calls) {
    assert.equal(call.init.signal, controller.signal);
    assert.equal(call.init.headers.Authorization, 'Bearer synthetic-token');
  }
  const before = calls.length;
  const absent = await client.clientes.sugestaoVinculo();
  assert.equal(absent.data.motivo, 'documento_ausente');
  assert.equal(calls.length, before);
});

test('CRUD count uses authoritative meta total, preserves filters and leaves list arrays intact', async () => {
  const urls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ groupId: 'synthetic-group', empresaId: 'synthetic-company', token: 'synthetic-token' }),
    fetchImpl: async (url, init) => {
      urls.push(new URL(String(url)));
      assert.equal(init.headers.Authorization, 'Bearer synthetic-token');
      return new Response(JSON.stringify({ data: [{ id: 'synthetic-row' }], meta: { total: 1505 } }), { status: 200 });
    },
  });
  assert.equal(await client.entities.Cliente.count({ search: 'synthetic', ativo: 'Inativo' }), 1505);
  assert.equal(urls[0].searchParams.get('limit'), '1');
  assert.equal(urls[0].searchParams.get('search'), 'synthetic');
  assert.equal(urls[0].searchParams.get('ativo'), 'false');
  assert.deepEqual(await client.entities.Cliente.filter({}, 'codigo', 50), [{ id: 'synthetic-row' }]);
  assert.equal(urls[1].searchParams.get('limit'), '50');
  assert.equal(urls[1].searchParams.get('order_by'), 'codigo');
});

test('CRUD count rejects missing or invalid totals and preserves authorization failure', async () => {
  for (const total of [undefined, null, '5', -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const client = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test', fetchImpl: async () =>
      new Response(JSON.stringify({ data: [], meta: { total } }), { status: 200 }) });
    await assert.rejects(client.entities.Cliente.count(), /HTTP_COUNT_UNAVAILABLE/);
  }
  const denied = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test', fetchImpl: async () =>
    new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 }) });
  await assert.rejects(denied.entities.Cliente.count(), error => error.status === 403);
  const empty = createHttpApiClient({ baseUrl: 'https://erp.synthetic.test', fetchImpl: async () =>
    new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }) });
  assert.equal(await empty.entities.Cliente.count(), 0);
});
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

test('Cliente entra no piloto HTTP somente com flag CLIENTE autorizada', () => {
  assert.equal(resolveHttpPilotEntities({}).includes('Cliente'), false);
  assert.equal(resolveHttpPilotEntities({ VITE_ERP_HTTP_CLIENTE_360: 'false' }).includes('Cliente'), false);
  assert.equal(resolveHttpPilotEntities({ VITE_ERP_HTTP_CLIENTE_360: 'true' }).includes('Cliente'), true);
  assert.equal(resolveHttpPilotEntities({ VITE_ERP_HTTP_CLIENTE: 'true' }).includes('Cliente'), true);
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
  assert.match(calls[1].url, /order_by=created_at/);
  assert.match(calls[1].url, /order_dir=desc/);
});

test('HttpApiClient filter encaminha order_by/order_dir ao BFF', async () => {
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
  await client.entities.Marca.filter({ search: 'x' }, 'codigo', 50);
  assert.match(urls[0], /order_by=codigo/);
  assert.match(urls[0], /order_dir=asc/);
  assert.match(urls[0], /search=x/);
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
  await produto.outboxClaim({ limit: 5, leaseMs: 30_000 });
  await produto.outboxConfirm('e1', 'token');
  await produto.outboxFail('e1', 'token', 'temporary');
  await produto.outboxReprocess('e1', 'manual_reprocess');
  await produto.outboxList({ status: 'dead_letter', produtoId: 'p', limit: 10, offset: 0 });
  await produto.outboxMetrics({ produtoId: 'p' });
  await produto.outboxDiscard('e1', 'manual_discard');
  await produto.outboxProcess({ limit: 3 });
  assert.deepEqual(calls.map((call) => call.method), ['PATCH', 'POST', 'POST', 'POST', 'POST', 'POST', 'POST', 'GET', 'GET', 'POST', 'POST']);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/v1/produtos/p/workflow', '/api/v1/produtos/p/midias/reservas',
    '/api/v1/produtos/p/midias/m/confirmar',
    '/api/v1/produtos/outbox/claim',
    '/api/v1/produtos/outbox/e1/confirm',
    '/api/v1/produtos/outbox/e1/fail',
    '/api/v1/produtos/outbox/e1/reprocess',
    '/api/v1/produtos/outbox',
    '/api/v1/produtos/outbox/metrics',
    '/api/v1/produtos/outbox/e1/discard',
    '/api/v1/produtos/outbox/process',
  ]);
  assert.ok(calls.every((call) => call.headers['X-Group-Id'] === 'grupo-sintetico'
    && call.headers['X-Empresa-Id'] === 'empresa-sintetica'));
  assert.equal(JSON.parse(calls[0].body).status, 'EM_REVISAO');
  assert.deepEqual(JSON.parse(calls[2].body), { attemptId: 'a' });
  assert.deepEqual(JSON.parse(calls[3].body), { limit: 5, leaseMs: 30_000 });
  assert.deepEqual(JSON.parse(calls[4].body), { leaseToken: 'token' });
  assert.deepEqual(JSON.parse(calls[5].body), { leaseToken: 'token', errorMessage: 'temporary' });
  assert.deepEqual(JSON.parse(calls[6].body), { reason: 'manual_reprocess' });
  assert.equal(new URL(calls[7].url).searchParams.get('status'), 'dead_letter');
  assert.equal(new URL(calls[7].url).searchParams.get('produtoId'), 'p');
  assert.equal(new URL(calls[8].url).searchParams.get('produtoId'), 'p');
  assert.deepEqual(JSON.parse(calls[9].body), { reason: 'manual_discard' });
  assert.deepEqual(JSON.parse(calls[10].body), { limit: 3, leaseMs: 60_000 });
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

test('HTTP detalhe canônico de Pedido e Orçamento envia Bearer e tenant sem expor token na URL', async () => {
  const calls = [];
  const client = createHttpApiClient({
    baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ groupId: 'group-synthetic', empresaId: 'empresa-synthetic', actorId: 'actor-synthetic', token: 'synthetic-token' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ data: { id: 'record-synthetic' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.pedidos.get('record-synthetic');
  await client.orcamentos.get('record-synthetic');
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/api/v1/pedidos/record-synthetic', '/api/v1/orcamentos/record-synthetic']);
  for (const { url, init } of calls) {
    assert.equal(init.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(init.headers['X-Group-Id'], 'group-synthetic');
    assert.equal(init.headers['X-Empresa-Id'], 'empresa-synthetic');
    assert.equal(init.headers['X-Actor-Id'], undefined);
    assert.equal(url.includes('synthetic-token'), false);
  }
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

test('Cliente HTTP update strips commercial/extra form fields to master-data allowlist', async () => {
  let body = null;
  const client = createHttpApiClient({
    baseUrl: 'https://erp.synthetic.test',
    getScope: () => ({ groupId: 'grupo-sintetico', empresaId: 'empresa-sintetica', token: 'tok' }),
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        data: { id: 'cli-1', nome_fantasia: body.nome_fantasia, razao_social: body.razao_social },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const updated = await client.entities.Cliente.update('cli-1', {
    id: 'cli-1',
    group_id: 'grupo-sintetico',
    empresa_id: 'empresa-sintetica',
    tipo: 'Pessoa Juridica',
    razao_social: 'CLIENTE DEV SINTETICO PJ A LTDA',
    nome_fantasia: 'MARKER-OK',
    cnpj: '11222333000181',
    vendedor_responsavel: 'X',
    vendedor_responsavel_id: 'y',
    condicao_comercial: { limite_credito: 999 },
    endereco_principal: { cidade: 'SP' },
    contatos: [{ tipo: 'email', valor: 'a@b.c' }],
    status: 'Ativo',
  });
  assert.equal(updated.nome_fantasia, 'MARKER-OK');
  assert.equal(body.nome_fantasia, 'MARKER-OK');
  assert.equal(body.documento, '11222333000181');
  assert.equal(body.tipo, 'Pessoa Jurídica');
  assert.equal(body.vendedor_responsavel, undefined);
  assert.equal(body.condicao_comercial, undefined);
  assert.equal(body.endereco_principal, undefined);
  assert.equal(body.group_id, undefined);
  assert.equal(body.id, undefined);
});

test('Cliente filter: status Ativo não vira ativo=false; retorna sempre array', async () => {
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({
      data: [{ id: 'c1', codigo: '000001', nome: 'A' }],
      meta: { total: 1 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createHttpApiClient({
    baseUrl: 'http://localhost:3080',
    fetchImpl,
    getScope: () => ({ groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', token: 'tok' }),
  });
  // Filtro multiempresa com status textual NÃO deve enviar ativo=Ativo/false
  const rows = await client.entities.Cliente.filter({
    $and: [{ $or: [{ group_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] }],
    status: 'Ativo',
  }, '-updated_date', 20, 0);
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].codigo, '000001');
  assert.equal(urls[0].includes('ativo='), false);
  assert.match(urls[0], /\/api\/v1\/clientes\?/);
});

test('ProdutoEmpresa facade preparada: GET/PUT usam tenant/Bearer/CAS/AbortSignal sem ativar Produto',async()=>{
  const seen=[];const controller=new AbortController();
  const client=createHttpApiClient({baseUrl:'https://erp.synthetic.test',getScope:()=>({groupId:'synthetic-group',empresaId:'synthetic-company',actorId:'synthetic-actor',token:'synthetic-token'}),
    fetchImpl:async(url,init)=>{seen.push({url:String(url),init});return new Response(JSON.stringify({data:{id:'synthetic-link',version:2}}),{status:200});}});
  assert.equal(client.entities.Produto,undefined);
  const api=client.preparedEntities.Produto.empresaOperacao;
  assert.equal((await api.get('synthetic/product',{signal:controller.signal})).version,2);
  const payload={ativo:true,habilitado_operacao:true,expected_version:1};await api.update('synthetic/product',payload,{signal:controller.signal});
  assert.equal(new URL(seen[0].url).pathname,'/api/v1/produtos/synthetic%2Fproduct/empresa-operacao');
  assert.equal(seen[1].init.method,'PUT');assert.deepEqual(JSON.parse(seen[1].init.body),payload);
  for(const call of seen){assert.equal(call.init.headers.Authorization,'Bearer synthetic-token');assert.equal(call.init.headers['X-Empresa-Id'],'synthetic-company');assert.equal(call.init.signal,controller.signal);assert.equal(call.url.includes('synthetic-token'),false);}
});

test('CANAL exact Cliente filters cannot silently broaden and malformed selectors do not fetch',async()=>{
 const calls=[];const client=createHttpApiClient({baseUrl:'https://erp.synthetic.test',fetchImpl:async(url)=>{calls.push(new URL(url));return new Response(JSON.stringify({data:[]}),{status:200});}});
 await client.entities.Cliente.filter({documento:'11.222.333/0001-81',codigo:'001'},undefined,1);
 assert.equal(calls[0].searchParams.get('documento'),'11.222.333/0001-81');assert.equal(calls[0].searchParams.get('codigo'),'001');
 for(const query of [{documento:''},{documento:'garbage'},{documento:[]},{codigo:' '},{codigo:{}}]){const before=calls.length;await assert.rejects(client.entities.Cliente.filter(query));assert.equal(calls.length,before);}
});
test('CANAL captures scope, rejects late/revoked/aborted responses and never falls back',async()=>{
 const input={identidades:[{documento:'11222333000181'}]};
 for(const change of [s=>{s.groupId='other';},s=>{s.token='new';},s=>{s.actorId='other';},s=>{s.empresaId='company';}]){
  let finish;const scope={groupId:'synthetic-group',actorId:'synthetic-profile',token:'synthetic-token'};let calls=0;
  const client=createHttpApiClient({baseUrl:'https://erp.synthetic.test',getScope:()=>scope,fetchImpl:async(url,init)=>{calls++;assert.equal(new URL(url).pathname,'/api/v1/clientes/conferencia-legado');assert.equal(init.method,'POST');assert.equal(init.headers['X-Actor-Id'],undefined);return new Promise(r=>{finish=r;});}});
  const promise=client.clientes.conferirLegado(input);change(scope);finish(new Response(JSON.stringify({data:[{indice:0,documento:null,legado:null}]}),{status:200}));await assert.rejects(promise,e=>e.code==='CONTEXT_CHANGED');assert.equal(calls,1);
 }
 const scope={groupId:'synthetic-group',actorId:'synthetic-profile',token:'synthetic-token'};
 let calls=0;const ok=createHttpApiClient({baseUrl:'https://erp.synthetic.test',getScope:()=>scope,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({data:[{indice:0,documento:null,legado:null}]}),{status:200});}});
 assert.deepEqual(await ok.clientes.conferirLegado(input),[{indice:0,documento:null,legado:null}]);
 for(const body of [{identidades:[]},{identidades:[{}]},{identidades:Array(101).fill({documento:'11222333000181'})}])await assert.rejects(ok.clientes.conferirLegado(body));assert.equal(calls,1);
 const aborted=new AbortController();aborted.abort();await assert.rejects(ok.clientes.conferirLegado(input,{signal:aborted.signal}));assert.equal(calls,1);
 const denied=createHttpApiClient({baseUrl:'https://erp.synthetic.test',getScope:()=>scope,fetchImpl:async()=>new Response(JSON.stringify({error:{code:'PERMISSION_DENIED'}}),{status:403})});await assert.rejects(denied.clientes.conferirLegado(input),e=>e.status===403);
});

test('CANAL actual consumer does not auto-read and clears late results on session change',async()=>{
 const {readFile}=await import('node:fs/promises');const {default:ts}=await import('typescript');const vm=await import('node:vm');
 const source=await readFile(new URL('../src/components/comercial/ClienteConferenciaLegado.jsx',import.meta.url),'utf8');
 const slots=[];let cursor=0,effects=[],listener,finish,calls=0;
 const react={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat()}}),useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>{slots[i]=v;}];},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,n)=>v!==slots[i][n])){slots[i]=deps;effects.push(fn);}}};
 const session={groupId:'synthetic-group',actorId:'synthetic-profile',token:'synthetic-token'};
 const modules={react:{__esModule:true,default:react,...react},'@/api/httpApiClient':{clienteConferenciaApi:{conferirLegado:()=>{calls++;return new Promise(r=>{finish=r;});}}},'@/api/erpHttpSession':{readErpHttpSession:()=>session,HTTP_CONTEXT_CHANGED:'context'},'@/components/lib/usePermissions':{__esModule:true,default:()=>({hasPermission:()=>true,isLoading:false})}};
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:id=>{assert.ok(modules[id],id);return modules[id];},window:{addEventListener:(_name,fn)=>{listener=fn;},removeEventListener:()=>{}},AbortController});
 let tree;const render=()=>{cursor=0;tree=exports.default();effects.splice(0).forEach(fn=>fn());};const walk=node=>!node||typeof node!=='object'?[]:[node,...(node.props?.children||[]).flatMap(walk)];
 render();assert.equal(calls,0);walk(tree).find(n=>n.type==='textarea').props.onChange({target:{value:JSON.stringify({identidades:[{documento:'11222333000181'}]})}});render();const run=walk(tree).find(n=>n.type==='button').props.onClick();assert.equal(calls,1);session.token='new';listener();finish([{indice:0,documento:null,legado:null}]);await run;render();assert.equal(walk(tree).some(n=>n.type==='table'),false);assert.equal(calls,1);
 const tab=await readFile(new URL('../src/components/comercial/ClientesTab.jsx',import.meta.url),'utf8');assert.ok(tab.indexOf('if (conferencia) return')<tab.indexOf('<VisualizadorUniversalEntidadeV24'));assert.match(tab,/conferencia_legado/);const commercial=await readFile(new URL('../src/pages/Comercial.jsx',import.meta.url),'utf8');const ast=ts.createSourceFile('Comercial.jsx',commercial,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);const wrapper=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Comercial');assert.ok(wrapper);const exported={};vm.runInNewContext(ts.transpileModule(wrapper.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports:exported,window:{location:{search:'?conferencia_legado=1'}},URLSearchParams,React:react,Suspense:'Suspense',ClientesTab:'EXACT_ONLY',ComercialContent:'BROAD'});const route=exported.default();assert.equal(route.props.children[0].type,'EXACT_ONLY');assert.equal(route.type,'Suspense');
});

test('CANAL integrity rejects unregistered changes inside and outside approved hunks',async()=>{const {clienteConferenciaRemainder}=await import('./helpers/consolidation81Remainder.js');const {readFile}=await import('node:fs/promises');for(const path of ['server/src/api/router.ts','src/api/httpApiClient.js']){const source=await readFile(path,'utf8');assert.ok(clienteConferenciaRemainder(path,source));assert.throws(()=>clienteConferenciaRemainder(path,source+'\n// unregistered mutation\n'));assert.throws(()=>clienteConferenciaRemainder(path,source.replace('conferencia-legado','unreviewed-endpoint')));}});
