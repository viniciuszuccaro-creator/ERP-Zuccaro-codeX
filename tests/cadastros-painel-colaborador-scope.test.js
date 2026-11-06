import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelColaboradorKpiState,
  isPainelColaboradorScopeCurrent,
  painelColaboradorKpiLabel,
} from '../src/components/cadastros/painelDinamicoColaboradorScope.js';

test('PainelDinamicoColaborador usa filterInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cadastros/PainelDinamicoColaborador.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Ponto'/);
  assert.match(src, /filterInContext\(\s*'Ferias'/);
  assert.match(src, /filterInContext\(\s*'OrdemProducao'/);
  assert.match(src, /PAINEL_COLABORADOR_PONTO_STALE_SCOPE/);
  assert.match(src, /Erro ≠ lista vazia/);
  assert.doesNotMatch(src, /entities\.Ponto\.filter\(/);
  assert.doesNotMatch(src, /entities\.Ferias\.filter\(/);
  assert.doesNotMatch(src, /entities\.OrdemProducao\.filter\(/);
  assert.doesNotMatch(src, /data:\s*pontos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e labels fail-closed', () => {
  assert.equal(resolvePainelColaboradorKpiState({
    painelAberto: true, contextoValido: true, colaboradorId: 'c1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePainelColaboradorKpiState({
    painelAberto: true, contextoValido: true, colaboradorId: 'c1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(painelColaboradorKpiLabel('error'), 'Erro ≠ lista vazia');
  assert.equal(isPainelColaboradorScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isPainelColaboradorScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});
