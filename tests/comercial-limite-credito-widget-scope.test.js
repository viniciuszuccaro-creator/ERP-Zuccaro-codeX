import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLimiteCreditoWidgetQueryKey,
  isLimiteCreditoWidgetScopeCurrent,
  resolveLimiteCreditoWidgetKpiState,
  sumContasReceberPendentes,
} from '../src/components/comercial/limiteCreditoWidgetScope.js';

test('LimiteCreditoWidget usa filterInContext e remove ContaReceber.filter unscoped', () => {
  const src = readFileSync('src/components/comercial/LimiteCreditoWidget.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'ContaReceber'/);
  assert.match(src, /LIMITE_CREDITO_WIDGET_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero utilizado/);
  assert.match(src, /Carregando contas a receber/);
  assert.match(src, /enabled: Boolean\(clienteId\) && contextoValido/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.filter\(/);
  assert.doesNotMatch(src, /data:\s*contasReceber\s*=\s*\[\]/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /from ["']@\/api\/base44Client["']/);
});

test('queryKey separa cliente, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildLimiteCreditoWidgetQueryKey(base);
  assert.deepEqual(k, ['contasReceberCliente', 'c1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildLimiteCreditoWidgetQueryKey({ ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildLimiteCreditoWidgetQueryKey({ ...base, actorId: 'a2' }), k);
});

test('KPI loading/erro/unavailable nunca é ready (≠ zero utilizado)', () => {
  assert.equal(resolveLimiteCreditoWidgetKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveLimiteCreditoWidgetKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveLimiteCreditoWidgetKpiState({
    contextoValido: false, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveLimiteCreditoWidgetKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('sumContasReceberPendentes só Pendente/Atrasado', () => {
  assert.equal(sumContasReceberPendentes(null), 0);
  assert.equal(sumContasReceberPendentes([
    { status: 'Pendente', valor: 10 },
    { status: 'Atrasado', valor: 5 },
    { status: 'Pago', valor: 100 },
  ]), 15);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isLimiteCreditoWidgetScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isLimiteCreditoWidgetScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
