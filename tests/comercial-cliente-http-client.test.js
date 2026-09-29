import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '11111111-1111-4111-8111-111111111111';
const UNIDADE = '55555555-5555-4555-8555-555555555555';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-cl' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];
    if (String(url).includes('/central-360')) {
      return response({
        data: {
          identity: { id: CLIENTE, codigo: '000001', razao_social: 'CPA' },
          blocks: { crm: { status: 'skipped', code: 'CRM_CANONICAL_HTTP_PENDING', data: [], meta: null } },
        },
      });
    }
    if (String(url).includes('/empresas') && method === 'GET') {
      return response({
        data: [{ id: 'link-1', cliente_id: CLIENTE, empresa_id: EMPRESA_A, ativo: true }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    if (String(url).includes('/unidades-medida') && method === 'GET') {
      return response({
        data: [{ id: UNIDADE, sigla: 'UN', ativo: true }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    if (method === 'POST' && /\/clientes$/.test(path)) {
      return response({ data: { id: CLIENTE, razao_social: 'Novo' } }, 201);
    }
    if (String(url).includes('/clientes') && method === 'GET' && String(url).includes('?')) {
      return response({
        data: [{ id: CLIENTE, razao_social: 'CPA Ferro', ativo: true }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    return response({ data: { id: CLIENTE } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui Cliente', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('Cliente'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteEmpresa'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Produto'), false);
});

test('HTTP list Cliente preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.clientes.list({ limit: 50, offset: 0, ativo: true, search: 'cpa' });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, CLIENTE);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/clientes');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), 'cpa');
  assert.equal(url.searchParams.get('order_by'), 'nome');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP Cliente Empresa B isola header sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.clientes.list({ limit: 10 });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP CRUD Cliente mapeia create/update/delete/restore/empresas/central360', async () => {
  const { client, calls } = setup();
  await client.clientes.create({ tipo: 'PJ', documento: '11222333000181', razao_social: 'CPA' });
  await client.clientes.update(CLIENTE, { nome_fantasia: 'CPA Ferro' });
  await client.clientes.listEmpresaLinks(CLIENTE, { limit: 50, empresaId: EMPRESA_A });
  await client.clientes.getEmpresaLink(CLIENTE, EMPRESA_A);
  await client.clientes.central360(CLIENTE, { empresasLimit: 5 });
  await client.clientes.softDelete(CLIENTE);
  await client.clientes.restore(CLIENTE);
  const paths = calls.map((c) => new URL(c.url).pathname);
  assert.ok(paths.includes('/api/v1/clientes'));
  assert.ok(paths.some((p) => p.endsWith(`/clientes/${CLIENTE}`)));
  assert.ok(paths.some((p) => p.includes(`/clientes/${CLIENTE}/empresas`)));
  assert.ok(paths.some((p) => p.endsWith(`/clientes/${CLIENTE}/central-360`)));
  assert.ok(paths.some((p) => p.endsWith(`/clientes/${CLIENTE}/restore`)));
});

test('entity Cliente piloto usa /api/v1/clientes e restore', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.Cliente);
  await client.entities.Cliente.filter({ ativo: true, search: 'ferro' }, 'nome', 20);
  await client.entities.Cliente.restore(CLIENTE);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/clientes');
  assert.equal(new URL(calls[1].url).pathname, `/api/v1/clientes/${CLIENTE}/restore`);
  assert.equal(calls[1].options.method, 'POST');
});

test('HTTP unidadesMedida lista com envelope para mestres Comercial', async () => {
  const { client, calls } = setup();
  const page = await client.unidadesMedida.list({ limit: 100, ativo: true });
  assert.equal(page.data[0].id, UNIDADE);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/unidades-medida');
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
});

test('central360 envia limites de paginação sem groupId na query', async () => {
  const { client, calls } = setup();
  await client.clientes.central360(CLIENTE, {
    orcamentosLimit: 7,
    pedidosLimit: 8,
    locaisLimit: 3,
    obrasLimit: 4,
    empresasLimit: 2,
  });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, `/api/v1/clientes/${CLIENTE}/central-360`);
  assert.equal(url.searchParams.get('orcamentos_limit'), '7');
  assert.equal(url.searchParams.get('pedidos_limit'), '8');
  assert.equal(url.searchParams.get('locais_limit'), '3');
  assert.equal(url.searchParams.get('obras_limit'), '4');
  assert.equal(url.searchParams.get('empresas_limit'), '2');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(url.searchParams.has('empresaId'), false);
});
