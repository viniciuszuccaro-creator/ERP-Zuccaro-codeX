import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCorteDobraBitolasQueryKey,
  isCorteDobraScopeCurrent,
  resolveCorteDobraBitolasKpiState,
} from '../src/components/comercial/corteDobraScope.js';

test('CorteDobraIATab usa filterInContext para bitolas e preserva Upload/IA', () => {
  const src = readFileSync('src/components/comercial/CorteDobraIATab.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Produto'/);
  assert.match(src, /eh_bitola:\s*true/);
  assert.match(src, /CORTE_DOBRA_BITOLAS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero bitolas/);
  assert.match(src, /Carregando bitolas/);
  assert.match(src, /integrations\.Core\.UploadFile/);
  assert.match(src, /integrations\.Core\.InvokeLLM/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /data:\s*bitolas\s*=\s*\[\]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildCorteDobraBitolasQueryKey(base);
  assert.deepEqual(k, ['bitolas-corte-dobra', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildCorteDobraBitolasQueryKey({ ...base, actorId: 'a2' }), k);
});

test('KPI loading/erro nunca é ready (≠ zero bitolas)', () => {
  assert.equal(resolveCorteDobraBitolasKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveCorteDobraBitolasKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveCorteDobraBitolasKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveCorteDobraBitolasKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isCorteDobraScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isCorteDobraScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
