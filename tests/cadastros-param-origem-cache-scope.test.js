import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildParametrosOrigemQueryKey,
  buildPedidosUltimosOrigemQueryKey,
  isParametrosOrigemScopeCurrent,
  resolveParametrosOrigemKpiState,
} from '../src/components/cadastros/parametrosOrigemScope.js';

// Helpers puros — sem @/ — para prova de cache/KPI/late fora do React.
// Consumidores reais: ParametrosOrigemPedidoTab + GerenciadorCanaisOrigem.

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

test('resposta tardia: troca de ator/sessão invalida escopo corrente', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }),
    true,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }),
    false,
  );
  assert.equal(
    isParametrosOrigemScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }),
    false,
  );
});

/**
 * Espelha o rótulo KPI do consumidor ParametrosOrigemPedidoTab:
 * loading/erro/unavailable nunca renderizam "0".
 */
function formatParametrosOrigemKpiLabel(kpiState, value) {
  if (kpiState === 'unavailable') return '—';
  if (kpiState === 'error') return 'Erro';
  if (kpiState === 'loading') return '…';
  return String(value);
}

test('consumidor: loading/erro ≠ zero na apresentação de contagens', () => {
  assert.equal(
    formatParametrosOrigemKpiLabel(
      resolveParametrosOrigemKpiState({
        contextoValido: true, podeVer: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
      }),
      0,
    ),
    '…',
  );
  assert.equal(
    formatParametrosOrigemKpiLabel(
      resolveParametrosOrigemKpiState({
        contextoValido: true, podeVer: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
      }),
      0,
    ),
    'Erro',
  );
  assert.equal(
    formatParametrosOrigemKpiLabel(
      resolveParametrosOrigemKpiState({
        contextoValido: false, podeVer: true, isLoading: false, isError: false, isFetching: false, dataDefined: false,
      }),
      12,
    ),
    '—',
  );
  assert.equal(
    formatParametrosOrigemKpiLabel(
      resolveParametrosOrigemKpiState({
        contextoValido: true, podeVer: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
      }),
      0,
    ),
    '0',
  );
});

test('consumidores reais #544: cache, STALE_SCOPE, KPI e sem list/initialData vazio', () => {
  const files = [
    'src/components/cadastros/ParametrosOrigemPedidoTab.jsx',
    'src/components/cadastros/GerenciadorCanaisOrigem.jsx',
  ];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /buildParametrosOrigemQueryKey/, file);
    assert.match(src, /resolveParametrosOrigemKpiState/, file);
    assert.match(src, /PARAM_ORIGEM_STALE_SCOPE/, file);
    assert.match(src, /central360SessionKey/, file);
    assert.match(src, /filterInContext\(/, file);
    assert.match(src, /contagemIndisponivel/, file);
    assert.doesNotMatch(src, /initialData:\s*\[\]/, file);
    assert.doesNotMatch(src, /entities\.\w+\.list\(/, file);
  }

  const tab = readFileSync('src/components/cadastros/ParametrosOrigemPedidoTab.jsx', 'utf8');
  assert.match(tab, /kpiState === 'loading'\) return '…'/);
  assert.match(tab, /kpiState === 'error'\) return 'Erro'/);
  assert.match(tab, /contagemIndisponivel \? null :/);

  const ger = readFileSync('src/components/cadastros/GerenciadorCanaisOrigem.jsx', 'utf8');
  assert.match(ger, /contagemIndisponivel \|\| isErrorPedidos \? '—' :/);
  assert.match(ger, /PARAM_ORIGEM_PEDIDOS_STALE_SCOPE/);
});
