import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyResolvedPrecoToItem,
  applyResolvedTabelaToForm,
  assertPrecoResolucaoNoContexto,
  canLoadTabelasPrecoHttp,
  normalizeTabelasListPayload,
} from '../src/components/comercial/comercialTabelaPrecoHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TABELA = '11111111-1111-4111-8111-111111111111';

test('canLoadTabelasPrecoHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadTabelasPrecoHttp(undefined), false);
  assert.equal(canLoadTabelasPrecoHttp(() => false), false);
});

test('canLoadTabelasPrecoHttp libera Cadastros ou Comercial visualizar', () => {
  assert.equal(
    canLoadTabelasPrecoHttp((module, section, action) => (
      module === 'Cadastros' && section === 'tabela_preco' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadTabelasPrecoHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
});

test('normalizeTabelasListPayload aceita envelope e array e filtra inativos', () => {
  assert.deepEqual(
    normalizeTabelasListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeTabelasListPayload([{ id: 'c', ativo: true }]).map((row) => row.id),
    ['c'],
  );
  assert.deepEqual(normalizeTabelasListPayload(null), []);
});

test('applyResolvedPrecoToItem grava só preco_unitario e preview em memória', () => {
  const applied = applyResolvedPrecoToItem(
    { produto_id: 'p', quantidade: '2', preco_unitario: '0' },
    {
      tabela_preco_id: TABELA,
      tabela_preco_codigo: '000010',
      tabela_preco_nome: 'Atacado',
      origem_resolucao: 'cliente_empresa',
      preco: '12.500000',
    },
  );
  assert.equal(applied.applied, true);
  assert.equal(applied.item.preco_unitario, '12.500000');
  assert.equal(applied.item.quantidade, '2');
  assert.equal(applied.preview.origem_resolucao, 'cliente_empresa');
});

test('applyResolvedPrecoToItem não aplica sem tabela/preço', () => {
  const applied = applyResolvedPrecoToItem(
    { preco_unitario: 'keep' },
    { tabela_preco_id: TABELA, preco: null },
  );
  assert.equal(applied.applied, false);
  assert.equal(applied.item.preco_unitario, 'keep');
  assert.equal(applied.preview, null);
});

test('applyResolvedTabelaToForm ecoa só tabela_preco_id canônico', () => {
  const applied = applyResolvedTabelaToForm(
    { cliente_empresa_id: 'x', tabela_preco_id: '' },
    { tabela_preco_id: TABELA },
  );
  assert.equal(applied.applied, true);
  assert.equal(applied.form.tabela_preco_id, TABELA);
});

test('assertPrecoResolucaoNoContexto bloqueia cross-group e aceita null', () => {
  assert.equal(assertPrecoResolucaoNoContexto(null, { groupId: GROUP, empresaId: EMPRESA }), null);
  assert.throws(
    () => assertPrecoResolucaoNoContexto(
      { tabela_preco_id: TABELA, group_id: 'other-group', preco: '1' },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /fora do grupo/,
  );
  const ok = assertPrecoResolucaoNoContexto(
    { tabela_preco_id: TABELA, group_id: GROUP, empresa_id: EMPRESA, preco: '1' },
    { groupId: GROUP, empresaId: EMPRESA },
  );
  assert.equal(ok.tabela_preco_id, TABELA);
});
