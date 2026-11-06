import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFechamentoQueryKey,
  isFechamentoScopeCurrent,
  resolveFechamentoKpiState,
  resolveFechamentoDashboardKpiState,
} from '../src/components/comercial/fechamentoCacheScope.js';

test('fechamento queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = {
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
  };
  const k = buildFechamentoQueryKey('pedidos', { ...base, extra: 'fechamento' });
  assert.deepEqual(k, ['pedidos', 'g1', 'e1', 'a1', 's1', 'fechamento']);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos', { ...base, actorId: 'a2', extra: 'fechamento' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos', { ...base, sessionKey: 's2', extra: 'fechamento' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos', { ...base, groupId: 'g2', extra: 'fechamento' }), k);
  assert.notDeepEqual(buildFechamentoQueryKey('pedidos', { ...base, empresaId: 'e2', extra: 'fechamento' }), k);
});

test('queryKey raiz pedidos/movimentacoes permite invalidateQueries legado', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const pedidosKey = buildFechamentoQueryKey('pedidos', { ...base, extra: 'fechamento' });
  assert.equal(pedidosKey[0], 'pedidos');
  assert.equal(buildFechamentoQueryKey('movimentacoes', { ...base, extra: 'fechamento' })[0], 'movimentacoes');
  assert.equal(buildFechamentoQueryKey('contas-receber', { ...base, extra: 'fechamento' })[0], 'contas-receber');
  assert.equal(buildFechamentoQueryKey('entregas', { ...base, extra: 'fechamento' })[0], 'entregas');
  // Prefixo legado invalidateQueries(['pedidos']) casa com key[0]
  assert.ok(pedidosKey[0] === 'pedidos');
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

test('#545: Pedido ready + auxiliar pendente → loading (Itens Baixados ≠ 0)', () => {
  const pedidosReady = {
    pedidosIsLoading: false,
    pedidosIsError: false,
    pedidosIsFetching: false,
    pedidosDataDefined: true,
  };
  assert.equal(resolveFechamentoDashboardKpiState({
    contextoValido: true,
    ...pedidosReady,
    movIsLoading: true,
    movIsError: false,
    movIsFetching: true,
    movDataDefined: false,
    contasIsLoading: false,
    contasIsError: false,
    contasIsFetching: false,
    contasDataDefined: true,
    entregasIsLoading: false,
    entregasIsError: false,
    entregasIsFetching: false,
    entregasDataDefined: true,
  }), 'loading');

  assert.equal(resolveFechamentoDashboardKpiState({
    contextoValido: true,
    ...pedidosReady,
    movIsLoading: false,
    movIsError: false,
    movIsFetching: false,
    movDataDefined: true,
    contasIsLoading: false,
    contasIsError: true,
    contasIsFetching: false,
    contasDataDefined: false,
    entregasIsLoading: false,
    entregasIsError: false,
    entregasIsFetching: false,
    entregasDataDefined: true,
  }), 'error');

  assert.equal(resolveFechamentoDashboardKpiState({
    contextoValido: false,
    ...pedidosReady,
    movIsLoading: false,
    movIsError: false,
    movIsFetching: false,
    movDataDefined: true,
    contasIsLoading: false,
    contasIsError: false,
    contasIsFetching: false,
    contasDataDefined: true,
    entregasIsLoading: false,
    entregasIsError: false,
    entregasIsFetching: false,
    entregasDataDefined: true,
  }), 'unavailable');

  assert.equal(resolveFechamentoDashboardKpiState({
    contextoValido: true,
    ...pedidosReady,
    movIsLoading: false,
    movIsError: false,
    movIsFetching: false,
    movDataDefined: true,
    contasIsLoading: false,
    contasIsError: false,
    contasIsFetching: false,
    contasDataDefined: true,
    entregasIsLoading: false,
    entregasIsError: false,
    entregasIsFetching: false,
    entregasDataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão/grupo/empresa invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1', groupId: 'g1', empresaId: 'e1' };
  assert.equal(isFechamentoScopeCurrent(expected, { ...expected }), true);
  assert.equal(isFechamentoScopeCurrent(expected, { ...expected, actorId: 'a2' }), false);
  assert.equal(isFechamentoScopeCurrent(expected, { ...expected, sessionKey: 's2' }), false);
  assert.equal(isFechamentoScopeCurrent(expected, { ...expected, groupId: 'g2' }), false);
  assert.equal(isFechamentoScopeCurrent(expected, { ...expected, empresaId: 'e2' }), false);
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
