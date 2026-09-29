import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const LOCAL = '33333333-3333-4333-8333-333333333333';
const OBRA = '44444444-4444-4444-8444-444444444444';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-lo' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];
    if (method === 'GET' && /\/locais\/[^/]+$/.test(path)) {
      return response({
        data: {
          id: LOCAL,
          cliente_id: CLIENTE,
          group_id: GROUP_A,
          nome: 'Local Entrega',
          ativo: true,
        },
      });
    }
    if (method === 'GET' && path.includes('/locais')) {
      return response({
        data: [{ id: LOCAL, cliente_id: CLIENTE, group_id: GROUP_A, nome: 'Local Entrega', ativo: true }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    if (method === 'GET' && /\/obras\/[^/]+$/.test(path)) {
      return response({
        data: {
          id: OBRA,
          cliente_id: CLIENTE,
          group_id: GROUP_A,
          nome: 'Obra A',
          codigo: '000001',
          ativo: true,
        },
      });
    }
    if (method === 'GET' && path.includes('/obras')) {
      return response({
        data: [{ id: OBRA, cliente_id: CLIENTE, group_id: GROUP_A, nome: 'Obra A', codigo: '000001', ativo: true }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    return response({ data: { id: LOCAL } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui ClienteLocal e Obra', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteLocal'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Obra'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteEmpresa'), true);
});

test('HTTP list nested ClienteLocal preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.clientes.listLocais(CLIENTE, {
    limit: 50,
    offset: 0,
    ativo: true,
    search: 'entrega',
  });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, LOCAL);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, `/api/v1/clientes/${CLIENTE}/locais`);
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), 'entrega');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(url.searchParams.has('empresaId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP list nested Obra operacional isola Empresa B sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.clientes.listObras(CLIENTE, { operacional: true, limit: 10 });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, `/api/v1/clientes/${CLIENTE}/obras`);
  assert.equal(url.searchParams.get('operacional'), 'true');
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('entity ClienteLocal/Obra exige cliente_id e usa nested paths', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.ClienteLocal);
  assert.ok(client.entities.Obra);
  await assert.rejects(() => client.entities.ClienteLocal.filter({ ativo: true }), /CLIENTE_ID_REQUIRED|cliente_id/);
  await client.entities.ClienteLocal.filter({ cliente_id: CLIENTE, ativo: true }, 'nome', 20);
  await client.entities.ClienteLocal.get(LOCAL, { clienteId: CLIENTE });
  await client.entities.Obra.filter({ cliente_id: CLIENTE, operacional: true }, 'nome', 20);
  await client.entities.Obra.get(OBRA, { clienteId: CLIENTE });
  assert.equal(new URL(calls[0].url).pathname, `/api/v1/clientes/${CLIENTE}/locais`);
  assert.equal(new URL(calls[1].url).pathname, `/api/v1/clientes/${CLIENTE}/locais/${LOCAL}`);
  assert.equal(new URL(calls[2].url).pathname, `/api/v1/clientes/${CLIENTE}/obras`);
  assert.equal(new URL(calls[3].url).pathname, `/api/v1/clientes/${CLIENTE}/obras/${OBRA}`);
});

test('clientes.getLocal/getObra não enviam tenant na query', async () => {
  const { client, calls } = setup();
  await client.clientes.getLocal(CLIENTE, LOCAL);
  await client.clientes.getObra(CLIENTE, OBRA);
  const localUrl = new URL(calls[0].url);
  const obraUrl = new URL(calls[1].url);
  assert.equal(localUrl.pathname, `/api/v1/clientes/${CLIENTE}/locais/${LOCAL}`);
  assert.equal(obraUrl.pathname, `/api/v1/clientes/${CLIENTE}/obras/${OBRA}`);
  assert.equal(localUrl.searchParams.has('groupId'), false);
  assert.equal(obraUrl.searchParams.has('empresaId'), false);
});
