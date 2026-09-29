import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LINK = '11111111-1111-4111-8111-111111111111';
const CLIENTE = '22222222-2222-4222-8222-222222222222';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-ce' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    const path = String(url).split('?')[0];
    if (method === 'GET' && /\/cliente-empresas\/[^/]+$/.test(path)) {
      return response({
        data: {
          id: LINK,
          cliente_id: CLIENTE,
          empresa_id: scopeEmpresa,
          group_id: GROUP_A,
          ativo: true,
          habilitado_operacao: true,
          bloqueado: false,
        },
      });
    }
    if (String(url).includes('/cliente-empresas') && method === 'GET') {
      return response({
        data: [{
          id: LINK,
          cliente_id: CLIENTE,
          empresa_id: scopeEmpresa,
          group_id: GROUP_A,
          ativo: true,
          habilitado_operacao: true,
          bloqueado: false,
        }],
        meta: { total: 1, limit: 50, offset: 0 },
      });
    }
    return response({ data: { id: LINK } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui ClienteEmpresa', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteEmpresa'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('Cliente'), true);
  assert.equal(HTTP_PILOT_ENTITIES.includes('ClienteLocal'), false);
});

test('HTTP list-for-scope ClienteEmpresa preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.clienteEmpresas.list({
    limit: 50,
    offset: 0,
    ativo: true,
    habilitadoOperacao: true,
    search: 'cpa',
  });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, LINK);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/cliente-empresas');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('habilitado_operacao'), 'true');
  assert.equal(url.searchParams.get('search'), 'cpa');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(url.searchParams.has('empresaId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP ClienteEmpresa Empresa B isola header sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.clienteEmpresas.list({ limit: 10 });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('entity ClienteEmpresa piloto usa /api/v1/cliente-empresas e get', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.ClienteEmpresa);
  await client.entities.ClienteEmpresa.filter({ ativo: true, habilitado_operacao: true }, 'codigo', 20);
  await client.entities.ClienteEmpresa.get(LINK);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/cliente-empresas');
  assert.equal(new URL(calls[1].url).pathname, `/api/v1/cliente-empresas/${LINK}`);
});

test('clienteEmpresas.get não envia tenant na query', async () => {
  const { client, calls } = setup();
  await client.clienteEmpresas.get(LINK);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, `/api/v1/cliente-empresas/${LINK}`);
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(url.searchParams.has('empresaId'), false);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});
