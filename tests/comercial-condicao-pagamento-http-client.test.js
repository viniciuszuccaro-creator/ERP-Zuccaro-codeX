import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONDICAO = '11111111-1111-4111-8111-111111111111';
const CLIENTE = '22222222-2222-4222-8222-222222222222';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-cp' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    if (String(url).includes('/resolve')) {
      return response({
        data: {
          fonte: 'empresa_padrao',
          condicao: { id: CONDICAO, codigo: '000001', nome: 'À vista', parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }] },
          snapshot: { id: CONDICAO, codigo: '000001', nome: 'À vista', parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }] },
        },
      });
    }
    if (method === 'POST' && /\/condicoes-pagamento$/.test(String(url).split('?')[0])) {
      return response({ data: { id: CONDICAO, nome: 'Nova' } }, 201);
    }
    if (method === 'PUT' && String(url).includes('/parcelas')) {
      return response({ data: { id: CONDICAO, parcelas: [] } });
    }
    if (String(url).includes('/condicoes-pagamento') && method === 'GET' && String(url).includes('?')) {
      return response({ data: [{ id: CONDICAO, nome: 'À vista', ativo: true }], meta: { total: 1, limit: 50, offset: 0 } });
    }
    return response({ data: { id: CONDICAO } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui CondicaoPagamento', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('CondicaoPagamento'), true);
});

test('HTTP list CondicaoPagamento preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.condicoesPagamento.list({ limit: 50, offset: 0, ativo: true, search: 'vista' });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, CONDICAO);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/condicoes-pagamento');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), 'vista');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP CondicaoPagamento Empresa B isola header sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.condicoesPagamento.list({ limit: 10 });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP CRUD CondicaoPagamento mapeia create/update/delete/restore/parcelas/padrao', async () => {
  const { client, calls } = setup();
  await client.condicoesPagamento.create({
    nome: '28/56',
    parcelas: [
      { ordem: 1, dias: 28, percentual: '50.000000' },
      { ordem: 2, dias: 56, percentual: '50.000000' },
    ],
  });
  await client.condicoesPagamento.update(CONDICAO, { nome: '28/56 revisada' });
  await client.condicoesPagamento.replaceParcelas(CONDICAO, [{ ordem: 1, dias: 0, percentual: '100.000000' }]);
  await client.condicoesPagamento.setPadrao(CONDICAO);
  await client.condicoesPagamento.softDelete(CONDICAO);
  await client.condicoesPagamento.restore(CONDICAO);
  assert.deepEqual(calls.map((call) => [new URL(call.url).pathname, call.options.method || 'GET']), [
    ['/api/v1/condicoes-pagamento', 'POST'],
    [`/api/v1/condicoes-pagamento/${CONDICAO}`, 'PATCH'],
    [`/api/v1/condicoes-pagamento/${CONDICAO}/parcelas`, 'PUT'],
    [`/api/v1/condicoes-pagamento/${CONDICAO}/padrao`, 'POST'],
    [`/api/v1/condicoes-pagamento/${CONDICAO}`, 'DELETE'],
    [`/api/v1/condicoes-pagamento/${CONDICAO}/restore`, 'POST'],
  ]);
});

test('HTTP entity piloto CondicaoPagamento list/create usam mesma base', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.CondicaoPagamento);
  await client.entities.CondicaoPagamento.list(undefined, 25);
  await client.entities.CondicaoPagamento.create({
    nome: 'PIX',
    parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
  });
  assert.match(calls[0].url, /\/api\/v1\/condicoes-pagamento\?limit=25/);
  assert.equal(calls[1].options.method, 'POST');
});

test('HTTP resolve condição permanece disponível e fail-closed em 403', async () => {
  const { client, calls } = setup();
  const data = await client.condicoesPagamento.resolve(CLIENTE);
  assert.equal(data.fonte, 'empresa_padrao');
  assert.equal(new URL(calls[0].url).searchParams.get('clienteEmpresaId'), CLIENTE);

  const denied = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR }),
    fetchImpl: async () => response({ error: { code: 'PERMISSION_DENIED', message: 'negado' } }, 403),
  });
  await assert.rejects(denied.condicoesPagamento.list({}), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_DENIED');
    return true;
  });
});
