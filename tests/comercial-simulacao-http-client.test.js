import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpApiClient } from '../src/api/httpApiClient.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '11111111-1111-4111-8111-111111111111';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? 'req-sim' : null) },
  text: async () => JSON.stringify(body),
});

function setup(scopeEmpresa = EMPRESA_A) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes('/simular-venda')) {
      return response({
        data: {
          group_id: GROUP_A,
          empresa_id: scopeEmpresa,
          cliente_empresa_id: CLIENTE,
          total: '100.000000',
          parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000', valor: '100.000000', vencimento: '2026-10-01' }],
        },
      });
    }
    if (String(url).includes('/condicoes-pagamento/resolve')) {
      return response({ data: { fonte: 'empresa_padrao', condicao: { id: '22222222-2222-4222-8222-222222222222' }, snapshot: { parcelas: [] } } });
    }
    return response({ data: {} });
  };
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: scopeEmpresa, actorId: ACTOR }),
    fetchImpl,
  });
  return { client, calls };
}

test('HTTP simular-venda envia body e headers de Empresa A', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const data = await client.comercial.simularVenda({
    cliente_empresa_id: CLIENTE,
    itens: [{ produto_id: '33333333-3333-4333-8333-333333333333', unidade_id: '44444444-4444-4444-8444-444444444444', descricao: 'X', unidade_sigla: 'UN', quantidade: '1.000000' }],
  });
  assert.equal(data.empresa_id, EMPRESA_A);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-Group-Id'], GROUP_A);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
  assert.equal(calls[0].options.headers['X-Actor-Id'], ACTOR);
  assert.match(calls[0].url, /\/api\/v1\/comercial\/simular-venda$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.cliente_empresa_id, CLIENTE);
  assert.equal('groupId' in body, false);
});

test('HTTP simular-venda Empresa B usa header isolado (sem misturar A)', async () => {
  const { client, calls } = setup(EMPRESA_B);
  await client.comercial.simularVenda({
    cliente_empresa_id: CLIENTE,
    itens: [{ produto_id: '33333333-3333-4333-8333-333333333333', unidade_id: '44444444-4444-4444-8444-444444444444', descricao: 'X', unidade_sigla: 'UN', quantidade: '1.000000' }],
  });
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_B);
  assert.notEqual(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP resolve condição preserva clienteEmpresaId na query e tenant nos headers', async () => {
  const { client, calls } = setup(EMPRESA_A);
  const data = await client.condicoesPagamento.resolve(CLIENTE);
  assert.equal(data.fonte, 'empresa_padrao');
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/condicoes-pagamento/resolve');
  assert.equal(url.searchParams.get('clienteEmpresaId'), CLIENTE);
  assert.equal(url.searchParams.has('groupId'), false);
  assert.equal(calls[0].options.headers['X-Empresa-Id'], EMPRESA_A);
});

test('HTTP simular-venda propaga 403 unauthorized sem mascarar', async () => {
  const client = createHttpApiClient({
    baseUrl: 'https://erp.test',
    getScope: () => ({ groupId: GROUP_A, empresaId: EMPRESA_A, actorId: ACTOR }),
    fetchImpl: async () => response({ error: { code: 'PERMISSION_DENIED', message: 'negado' } }, 403),
  });
  await assert.rejects(client.comercial.simularVenda({ cliente_empresa_id: CLIENTE, itens: [] }), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_DENIED');
    return true;
  });
});
