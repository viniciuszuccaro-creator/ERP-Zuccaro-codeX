import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPedidosRetiradaQueryKey,
  isPedidosRetiradaScopeCurrent,
  resolvePedidosRetiradaKpiState,
} from '../src/components/comercial/pedidosRetiradaScope.js';

test('PedidosRetiradaTab lista e muta via *InContext (sem list/update/create/filter unscoped)', () => {
  const src = readFileSync('src/components/comercial/PedidosRetiradaTab.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /updateInContext\(\s*'Pedido'/);
  assert.match(src, /getInContext\(\s*'Produto'/);
  assert.match(src, /createInContext\(\s*'MovimentacaoEstoque'/);
  assert.match(src, /updateInContext\(\s*'Produto'/);
  assert.match(src, /createInContext\(\s*'Entrega'/);
  assert.match(src, /PEDIDOS_RETIRADA_STALE_SCOPE/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /Carregando pedidos de retirada/);
  assert.doesNotMatch(src, /entities\.Pedido\.list\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.update\(/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /entities\.Produto\.update\(/);
  assert.doesNotMatch(src, /entities\.MovimentacaoEstoque\.create\(/);
  assert.doesNotMatch(src, /entities\.Entrega\.create\(/);
  assert.doesNotMatch(src, /data:\s*pedidos\s*=\s*\[\]/);
  assert.match(src, /enabled: contextoValido/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildPedidosRetiradaQueryKey(base);
  assert.deepEqual(k, ['pedidos-retirada', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildPedidosRetiradaQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('KPI loading/erro nunca é ready (≠ zero pedidos)', () => {
  assert.equal(resolvePedidosRetiradaKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePedidosRetiradaKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolvePedidosRetiradaKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isPedidosRetiradaScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isPedidosRetiradaScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
