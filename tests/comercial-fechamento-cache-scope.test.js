import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFechamentoQueryKey,
  isFechamentoScopeCurrent,
  resolveFechamentoKpiState,
} from '../src/components/comercial/fechamentoCacheScope.js';

test('fechamento queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = {
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
  };
  const k = buildFechamentoQueryKey('pedidos-fechamento', base);
  assert.deepEqual(k, ['pedidos-fechamento', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos-fechamento', { ...base, actorId: 'a2' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos-fechamento', { ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos-fechamento', { ...base, groupId: 'g2' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos-fechamento', { ...base, empresaId: 'e2' }), k);
});

test('KPI loading/erro/unavailable nunca é ready (≠ zero)', () => {
  assert.equal(resolveFechamentoKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveFechamentoKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveFechamentoKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveFechamentoKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isFechamentoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isFechamentoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
  assert.equal(isFechamentoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});

test('consumidores #536–#539 usam cache canônico e sem initialData vazio', () => {
  const files = [
    'src/components/producao/BitolasDisponiveis.jsx',
    'src/components/comercial/MonitoramentoCanaisRealtime.jsx',
    'src/components/comercial/DashboardFechamentoPedidos.jsx',
    'src/components/comercial/WidgetFechamentoPedidos.jsx',
  ];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /buildFechamentoQueryKey/, file);
    assert.match(src, /STALE_SCOPE/, file);
    assert.doesNotMatch(src, /initialData:\s*\[\]/, file);
    assert.doesNotMatch(src, /entities\.\w+\.list\(/, file);
  }
});
