import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProdutoNoContexto,
  buildProdutoDisplayLabel,
  canLoadProdutosHttp,
  normalizeProdutosListPayload,
} from '../src/components/comercial/comercialProdutoHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUTO = '44444444-4444-4444-8444-444444444444';

test('canLoadProdutosHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadProdutosHttp(undefined), false);
  assert.equal(canLoadProdutosHttp(() => false), false);
});

test('canLoadProdutosHttp libera Cadastros.produto ou Comercial visualizar', () => {
  assert.equal(
    canLoadProdutosHttp((module, section, action) => (
      module === 'Cadastros' && section === 'produto' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadProdutosHttp((module, section, action) => (
      module === 'Cadastros' && section === 'Produto' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadProdutosHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadProdutosHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
});

test('normalizeProdutosListPayload aceita envelope e array e filtra inativos', () => {
  assert.deepEqual(
    normalizeProdutosListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeProdutosListPayload([{ id: 'c', ativo: true }]).map((row) => row.id),
    ['c'],
  );
  assert.deepEqual(normalizeProdutosListPayload(null), []);
});

test('buildProdutoDisplayLabel usa codigo+descricao sem inventar', () => {
  assert.equal(buildProdutoDisplayLabel({ codigo: '0001', descricao: 'Chapa' }), '0001 - Chapa');
  assert.equal(buildProdutoDisplayLabel({ nome: 'Só nome' }), 'Só nome');
  assert.equal(buildProdutoDisplayLabel(null, 'fallback'), 'fallback');
});

test('assertProdutoNoContexto bloqueia cross-tenant e aceita null', () => {
  assert.equal(assertProdutoNoContexto(null, { groupId: GROUP, empresaId: EMPRESA }), null);
  assert.throws(
    () => assertProdutoNoContexto(
      { id: PRODUTO, group_id: 'other-group' },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /fora do grupo/,
  );
  assert.throws(
    () => assertProdutoNoContexto(
      { id: PRODUTO, group_id: GROUP, empresa_id: 'other-empresa' },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /fora da empresa/,
  );
  const ok = assertProdutoNoContexto(
    { id: PRODUTO, group_id: GROUP, empresa_id: EMPRESA, descricao: 'OK' },
    { groupId: GROUP, empresaId: EMPRESA },
  );
  assert.equal(ok.id, PRODUTO);
});
