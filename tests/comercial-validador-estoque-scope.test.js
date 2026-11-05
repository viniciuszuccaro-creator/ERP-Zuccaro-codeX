import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildValidadorEstoqueProdutosQueryKey,
  isValidadorEstoqueScopeCurrent,
  resolveValidadorEstoqueProdutosKpiState,
} from '../src/components/comercial/validadorEstoquePedidoScope.js';

test('ValidadorEstoquePedido usa filterInContext e remove Produto.filter unscoped', () => {
  const src = readFileSync('src/components/comercial/ValidadorEstoquePedido.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Produto'/);
  assert.match(src, /VALIDADOR_ESTOQUE_PRODUTOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero produtos/);
  assert.match(src, /Carregando produtos para validação de estoque/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /data:\s*produtos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.match(src, /fonteLocalAutoritativa/);
});

test('queryKey separa Grupo, Empresa, ator, sessão e fonte', () => {
  const base = {
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
    fonte: 'local',
  };
  const k = buildValidadorEstoqueProdutosQueryKey(base);
  assert.deepEqual(k, ['produtos-estoque-validacao', 'g1', 'e1', 'a1', 's1', 'local']);
  assert.notDeepEqual(
    buildValidadorEstoqueProdutosQueryKey({ ...base, sessionKey: 's2' }),
    k,
  );
  assert.notDeepEqual(
    buildValidadorEstoqueProdutosQueryKey({ ...base, fonte: 'http-advisory' }),
    k,
  );
});

test('KPI loading/erro nunca é ready (≠ zero produtos)', () => {
  assert.equal(resolveValidadorEstoqueProdutosKpiState({
    contextoValido: true,
    fonteLocalAutoritativa: true,
    isLoading: true,
    isError: false,
    isFetching: false,
    dataDefined: false,
  }), 'loading');
  assert.equal(resolveValidadorEstoqueProdutosKpiState({
    contextoValido: true,
    fonteLocalAutoritativa: true,
    isLoading: false,
    isError: true,
    isFetching: false,
    dataDefined: false,
  }), 'error');
  assert.equal(resolveValidadorEstoqueProdutosKpiState({
    contextoValido: true,
    fonteLocalAutoritativa: true,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataDefined: true,
  }), 'ready');
  assert.equal(resolveValidadorEstoqueProdutosKpiState({
    contextoValido: false,
    fonteLocalAutoritativa: true,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataDefined: false,
  }), 'unavailable');
});

test('HTTP advisory: ready sem consulta local (não fabrica saldo)', () => {
  assert.equal(resolveValidadorEstoqueProdutosKpiState({
    contextoValido: true,
    fonteLocalAutoritativa: false,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataDefined: false,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isValidadorEstoqueScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isValidadorEstoqueScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
  assert.equal(isValidadorEstoqueScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
