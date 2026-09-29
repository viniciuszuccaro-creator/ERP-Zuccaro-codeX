import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';
import { HTTP_PILOT_ENTITIES } from '../src/api/runtimeBackend.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TABELA = '11111111-1111-4111-8111-111111111111';
const ITEM = '33333333-3333-4333-8333-333333333333';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const PRODUTO = '44444444-4444-4444-8444-444444444444';
const UNIDADE = '55555555-5555-4555-8555-555555555555';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-tp' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const method = options.method || 'GET';
    if (String(url).includes('/preco-cliente')) {
      return response({
        data: {
          tabela_preco_id: TABELA,
          tabela_preco_codigo: '000001',
          tabela_preco_nome: 'Padrão',
          origem_resolucao: 'padrao_empresa',
          item_id: ITEM,
          produto_id: PRODUTO,
          unidade_medida_id: UNIDADE,
          preco: '10.000000',
          moeda: 'BRL',
        },
      });
    }
    if (method === 'POST' && /\/tabelas-preco$/.test(String(url).split('?')[0])) {
      return response({ data: { id: TABELA, nome: 'Nova' } }, 201);
    }
    if (String(url).includes('/itens') && method === 'GET') {
      return response({ data: [{ id: ITEM, preco: '10.000000' }], meta: { total: 1, limit: 50, offset: 0 } });
    }
    if (String(url).includes('/tabelas-preco') && method === 'GET' && String(url).includes('?')) {
      return response({ data: [{ id: TABELA, nome: 'Atacado', ativo: true }], meta: { total: 1, limit: 50, offset: 0 } });
    }
    return response({ data: { id: TABELA } });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('piloto HTTP inclui TabelaPreco', () => {
  assert.equal(HTTP_PILOT_ENTITIES.includes('TabelaPreco'), true);
});

test('HTTP list TabelaPreco preserva envelope e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const page = await client.tabelasPreco.list({ limit: 50, offset: 0, ativo: true, search: 'ata' });
  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0].id, TABELA);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/tabelas-preco');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('search'), 'ata');
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
});

test('HTTP TabelaPreco Empresa B isola header sem misturar A', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.tabelasPreco.list({ limit: 10 });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP CRUD TabelaPreco mapeia create/update/delete/restore/padrao/itens', async () => {
  const { client, calls } = setup();
  await client.tabelasPreco.create({ nome: 'Atacado', vigencia_inicio: '2026-01-01' });
  await client.tabelasPreco.update(TABELA, { nome: 'Atacado revisada' });
  await client.tabelasPreco.setPadrao(TABELA, EMPRESA_A);
  await client.tabelasPreco.listItens(TABELA, { limit: 50 });
  await client.tabelasPreco.createItem(TABELA, {
    produto_id: PRODUTO,
    unidade_medida_id: UNIDADE,
    preco: '10.000000',
  });
  await client.tabelasPreco.softDelete(TABELA);
  await client.tabelasPreco.restore(TABELA);
  assert.deepEqual(calls.map((call) => [new URL(call.url).pathname, call.options.method || 'GET']), [
    ['/api/v1/tabelas-preco', 'POST'],
    [`/api/v1/tabelas-preco/${TABELA}`, 'PATCH'],
    [`/api/v1/tabelas-preco/${TABELA}/empresas/${EMPRESA_A}/padrao`, 'POST'],
    [`/api/v1/tabelas-preco/${TABELA}/itens`, 'GET'],
    [`/api/v1/tabelas-preco/${TABELA}/itens`, 'POST'],
    [`/api/v1/tabelas-preco/${TABELA}`, 'DELETE'],
    [`/api/v1/tabelas-preco/${TABELA}/restore`, 'POST'],
  ]);
});

test('HTTP entity piloto TabelaPreco list/create usam mesma base', async () => {
  const { client, calls } = setup();
  assert.ok(client.entities.TabelaPreco);
  await client.entities.TabelaPreco.list(undefined, 25);
  await client.entities.TabelaPreco.create({ nome: 'Varejo', vigencia_inicio: '2026-01-01' });
  assert.match(calls[0].url, /\/api\/v1\/tabelas-preco\?limit=25/);
  assert.equal(calls[1].options.method, 'POST');
});

test('HTTP resolveClientPrice permanece disponível e fail-closed em 403', async () => {
  const { client, calls } = setup();
  const data = await client.tabelasPreco.resolveClientPrice({
    clienteEmpresaId: CLIENTE,
    produtoId: PRODUTO,
    unidadeMedidaId: UNIDADE,
  });
  assert.equal(data.origem_resolucao, 'padrao_empresa');
  assert.equal(new URL(calls[0].url).searchParams.get('clienteEmpresaId'), CLIENTE);
  assert.equal(new URL(calls[0].url).searchParams.has('groupId'), false);

  const denied = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR }),
    fetchImpl: async () => response({ error: { code: 'PERMISSION_DENIED', message: 'negado' } }, 403),
  });
  await assert.rejects(denied.tabelasPreco.list({}), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_DENIED');
    return true;
  });
});
