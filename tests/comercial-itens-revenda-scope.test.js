import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildItensRevendaProdutosQueryKey,
  isItensRevendaScopeCurrent,
  resolveItensRevendaProdutosKpiState,
  filterProdutosRevendaBusca,
} from '../src/components/comercial/itensRevendaScope.js';

test('ItensRevendaTab usa filterInContext e remove Produto/Pedido.filter unscoped', () => {
  const src = readFileSync('src/components/comercial/ItensRevendaTab.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Produto'/);
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /ITENS_REVENDA_PRODUTOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero produtos/);
  assert.match(src, /Carregando produtos de revenda/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /data:\s*produtos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildItensRevendaProdutosQueryKey(base);
  assert.deepEqual(k, ['produtos-revenda', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildItensRevendaProdutosQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('KPI loading/erro nunca é ready (≠ zero produtos)', () => {
  assert.equal(resolveItensRevendaProdutosKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveItensRevendaProdutosKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveItensRevendaProdutosKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('filterProdutosRevendaBusca preserva contrato descricao/codigo', () => {
  const rows = [
    { codigo: 'A1', descricao: 'Parafuso' },
    { codigo: 'B2', descricao: 'Porca' },
  ];
  assert.equal(filterProdutosRevendaBusca(rows, 'par').length, 1);
  assert.equal(filterProdutosRevendaBusca(rows, 'B2').length, 1);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isItensRevendaScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isItensRevendaScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
