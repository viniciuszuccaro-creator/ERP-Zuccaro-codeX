import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildArmadoPadraoBitolasQueryKey,
  isArmadoPadraoScopeCurrent,
  resolveArmadoPadraoBitolasKpiState,
} from '../src/components/comercial/armadoPadraoScope.js';

test('ArmadoPadraoTab usa filterInContext e remove Produto.filter unscoped', () => {
  const src = readFileSync('src/components/comercial/ArmadoPadraoTab.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Produto'/);
  assert.match(src, /eh_bitola:\s*true/);
  assert.match(src, /ARMADO_PADRAO_BITOLAS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero bitolas/);
  assert.match(src, /Carregando bitolas/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /data:\s*bitolas\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator e sessão', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1' };
  const k = buildArmadoPadraoBitolasQueryKey(base);
  assert.deepEqual(k, ['bitolas', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildArmadoPadraoBitolasQueryKey({ ...base, sessionKey: 's2' }), k);
});

test('KPI loading/erro/unavailable nunca é ready (≠ zero bitolas)', () => {
  assert.equal(resolveArmadoPadraoBitolasKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveArmadoPadraoBitolasKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveArmadoPadraoBitolasKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveArmadoPadraoBitolasKpiState({
    contextoValido: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isArmadoPadraoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isArmadoPadraoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
