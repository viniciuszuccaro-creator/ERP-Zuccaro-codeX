import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFormasPagamentoPedidoQueryKey,
  isFormasPagamentoPedidoScopeCurrent,
  resolveFormasPagamentoPedidoKpiState,
  pickFormasPagamentoAtivas,
} from '../src/components/comercial/formasPagamentoPedidoScope.js';

test('FormasPagamentoPedido usa filterInContext e remove mock/list sintético', () => {
  const src = readFileSync('src/components/comercial/FormasPagamentoPedido.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'FormaPagamento'/);
  assert.match(src, /FORMAS_PAGAMENTO_PEDIDO_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero/);
  assert.match(src, /enabled: contextoValido/);
  assert.doesNotMatch(src, /entities\.FormaPagamento\.list\(/);
  assert.doesNotMatch(src, /const base44 = \{/);
  assert.doesNotMatch(src, /const useQuery = \(\{/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*formasPagamento\s*=\s*\[\]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildFormasPagamentoPedidoQueryKey(base);
  assert.deepEqual(k, ['formas-pagamento-pedido', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildFormasPagamentoPedidoQueryKey({ ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildFormasPagamentoPedidoQueryKey({ ...base, actorId: 'a2' }), k);
});

test('KPI loading/erro/unavailable nunca é ready (≠ zero formas)', () => {
  assert.equal(resolveFormasPagamentoPedidoKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveFormasPagamentoPedidoKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveFormasPagamentoPedidoKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveFormasPagamentoPedidoKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('pickFormasPagamentoAtivas preserva ativa !== false', () => {
  assert.deepEqual(
    pickFormasPagamentoAtivas([
      { id: 1, ativa: true },
      { id: 2, ativa: false },
      { id: 3 },
    ]).map((f) => f.id),
    [1, 3],
  );
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isFormasPagamentoPedidoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isFormasPagamentoPedidoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
