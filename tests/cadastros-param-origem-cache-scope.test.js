import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParametrosOrigemQueryKey,
  buildPedidosUltimosOrigemQueryKey,
  isParametrosOrigemScopeCurrent,
  resolveParametrosOrigemKpiState,
  resolveParametrosOrigemMetricasKpiState,
  canExportParametrosOrigemMetricas,
} from '../src/components/cadastros/parametrosOrigemScope.js';
import { readFileSync } from 'node:fs';

// Helpers puros — sem @/ — para prova de cache/KPI/late fora do React.

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = {
    groupId: 'g1',
    empresaId: 'e1',
    actorId: 'a1',
    sessionKey: 's1',
  };
  const k = buildParametrosOrigemQueryKey(base);
  assert.deepEqual(k, ['parametros-origem-pedido', 'g1', 'e1', 'a1', 's1']);

  assert.notDeepEqual(
    buildParametrosOrigemQueryKey({ ...base, groupId: 'g2' }),
    k,
  );
  assert.notDeepEqual(
    buildParametrosOrigemQueryKey({ ...base, empresaId: 'e2' }),
    k,
  );
  assert.notDeepEqual(
    buildParametrosOrigemQueryKey({ ...base, actorId: 'a2' }),
    k,
  );
  assert.notDeepEqual(
    buildParametrosOrigemQueryKey({ ...base, sessionKey: 's2' }),
    k,
  );

  const pedidos = buildPedidosUltimosOrigemQueryKey(base);
  assert.deepEqual(pedidos, ['pedidos-ultimos', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(
    buildPedidosUltimosOrigemQueryKey({ ...base, sessionKey: 's2' }),
    pedidos,
  );
});

test('KPI: carregando ou erro nunca vira zero (estado ≠ ready)', () => {
  assert.equal(
    resolveParametrosOrigemKpiState({
      contextoValido: true,
      podeVer: true,
      isLoading: true,
      isError: false,
      isFetching: false,
      dataDefined: false,
    }),
    'loading',
  );
  assert.equal(
    resolveParametrosOrigemKpiState({
      contextoValido: true,
      podeVer: true,
      isLoading: false,
      isError: true,
      isFetching: false,
      dataDefined: false,
    }),
    'error',
  );
  assert.equal(
    resolveParametrosOrigemKpiState({
      contextoValido: false,
      podeVer: true,
      isLoading: false,
      isError: false,
      isFetching: false,
      dataDefined: false,
    }),
    'unavailable',
  );
  assert.equal(
    resolveParametrosOrigemKpiState({
      contextoValido: true,
      podeVer: true,
      isLoading: false,
      isError: false,
      isFetching: false,
      dataDefined: true,
    }),
    'ready',
  );
});

test('resposta tardia: troca de ator/sessão/grupo/empresa invalida escopo corrente', () => {
  const expected = { actorId: 'a1', sessionKey: 's1', groupId: 'g1', empresaId: 'e1' };
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { ...expected }),
    true,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { ...expected, actorId: 'a2' }),
    false,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { ...expected, sessionKey: 's2' }),
    false,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { ...expected, groupId: 'g2' }),
    false,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { ...expected, empresaId: 'e2' }),
    false,
  );
});

test('#544 KPI agregado: Pedido pendente/erro ≠ zero; export só ready; vazio comprovado = ready', () => {
  const base = {
    contextoValido: true,
    podeVer: true,
    isLoading: false,
    isError: false,
    isFetching: false,
    dataDefined: true,
  };
  // Parâmetros ready + Pedido loading → metricas loading (não zero)
  assert.equal(resolveParametrosOrigemMetricasKpiState({
    ...base,
    pedidosIsLoading: true,
    pedidosIsError: false,
    pedidosIsFetching: true,
    pedidosDataDefined: false,
  }), 'loading');
  assert.equal(canExportParametrosOrigemMetricas('loading'), false);

  // Pedido erro → metricas error (export bloqueado; ≠ zero)
  assert.equal(resolveParametrosOrigemMetricasKpiState({
    ...base,
    pedidosIsLoading: false,
    pedidosIsError: true,
    pedidosIsFetching: false,
    pedidosDataDefined: false,
  }), 'error');
  assert.equal(canExportParametrosOrigemMetricas('error'), false);

  // Ambos ready (lista vazia comprovada continua ready → zero legítimo)
  assert.equal(resolveParametrosOrigemMetricasKpiState({
    ...base,
    pedidosIsLoading: false,
    pedidosIsError: false,
    pedidosIsFetching: false,
    pedidosDataDefined: true,
  }), 'ready');
  assert.equal(canExportParametrosOrigemMetricas('ready'), true);

  // Parâmetros ainda loading → agregada loading mesmo com pedidos ready
  assert.equal(resolveParametrosOrigemMetricasKpiState({
    ...base,
    isLoading: true,
    dataDefined: false,
    pedidosIsLoading: false,
    pedidosIsError: false,
    pedidosIsFetching: false,
    pedidosDataDefined: true,
  }), 'loading');
});

test('#544 GerenciadorCanaisOrigem: isHttpBackendMode + metricas KPI + export disabled', () => {
  const src = readFileSync('src/components/cadastros/GerenciadorCanaisOrigem.jsx', 'utf8');
  assert.match(src, /isHttpBackendMode/);
  assert.match(src, /resolveParametrosOrigemMetricasKpiState/);
  assert.match(src, /canExportParametrosOrigemMetricas/);
  assert.match(src, /disabled=\{!podeExportarMetricas\}/);
  assert.match(src, /kpiPedidosLabel/);
  assert.match(src, /scopeExpected = \{ actorId, sessionKey, groupId, empresaId \}/);
  assert.match(src, /PARAM_ORIGEM_PEDIDOS_STALE_SCOPE/);
  assert.doesNotMatch(src, /function readOrigemActorAndSession\(\)\s*\{\s*const session = readErpHttpSession\(\)/);
});
