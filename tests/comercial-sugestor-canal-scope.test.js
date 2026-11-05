import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSugestorCanalQueryKey,
  isSugestorCanalScopeCurrent,
  resolveSugestorCanalKpiState,
} from '../src/components/comercial/sugestorCanalScope.js';

test('SugestorCanalInteligente usa filterInContext e remove initialData/list unscoped', () => {
  const src = readFileSync('src/components/comercial/SugestorCanalInteligente.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /filterInContext\(\s*'Cliente'/);
  assert.match(src, /SUGESTOR_CANAL_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero/);
  assert.match(src, /Analisando canais/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*pedidosCliente\s*=\s*\[\]/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
});

test('queryKey separa cliente, Grupo, Empresa, ator e sessão', () => {
  const base = {
    clienteId: 'c1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildSugestorCanalQueryKey('sugestor-canal-pedidos', base);
  assert.deepEqual(k, ['sugestor-canal-pedidos', 'c1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildSugestorCanalQueryKey('sugestor-canal-pedidos', { ...base, sessionKey: 's2' }), k);
  assert.notDeepEqual(buildSugestorCanalQueryKey('sugestor-canal-pedidos', { ...base, actorId: 'a2' }), k);
});

test('KPI loading/erro nunca é ready (widget não some como zero)', () => {
  assert.equal(resolveSugestorCanalKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveSugestorCanalKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveSugestorCanalKpiState({
    contextoValido: false, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveSugestorCanalKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isSugestorCanalScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isSugestorCanalScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
