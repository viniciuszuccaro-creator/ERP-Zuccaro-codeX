import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCopiarUltimoPedidoQueryKey,
  isCopiarUltimoPedidoScopeCurrent,
  resolveCopiarUltimoPedidoKpiState,
  pickUltimoPedidoNaoCancelado,
} from '../src/components/comercial/copiarUltimoPedidoScope.js';

test('CopiarUltimoPedido usa filterInContext e remove Pedido.filter/$ne unscoped', () => {
  const src = readFileSync('src/components/comercial/CopiarUltimoPedido.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /COPIAR_ULTIMO_PEDIDO_STALE_SCOPE/);
  assert.match(src, /erro ≠ ausência/);
  assert.match(src, /Carregando último pedido/);
  assert.match(src, /enabled: Boolean\(clienteId\) && contextoValido/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /\$ne:\s*'Cancelado'/);
  assert.doesNotMatch(src, /from ["']@\/api\/base44Client["']/);
});

test('queryKey separa cliente, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildCopiarUltimoPedidoQueryKey(base);
  assert.deepEqual(k, ['ultimoPedidoCliente', 'c1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildCopiarUltimoPedidoQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('KPI loading/erro nunca é ready (≠ ausência de último pedido)', () => {
  assert.equal(resolveCopiarUltimoPedidoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveCopiarUltimoPedidoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveCopiarUltimoPedidoKpiState({
    contextoValido: false, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveCopiarUltimoPedidoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('pickUltimoPedidoNaoCancelado exclui Cancelado e ordena por data', () => {
  assert.equal(pickUltimoPedidoNaoCancelado(null), null);
  const picked = pickUltimoPedidoNaoCancelado([
    { id: 'a', status: 'Cancelado', data_pedido: '2026-11-05' },
    { id: 'b', status: 'Fechado', data_pedido: '2026-10-01' },
    { id: 'c', status: 'Aberto', data_pedido: '2026-11-01' },
  ]);
  assert.equal(picked?.id, 'c');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isCopiarUltimoPedidoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isCopiarUltimoPedidoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
