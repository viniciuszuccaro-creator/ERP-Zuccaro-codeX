import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDetalhesColaboradorQueryKey,
  isDetalhesColaboradorScopeCurrent,
  resolveDetalhesColaboradorKpiState,
  filterPontosDoMes,
  sumHorasTrabalhadas,
  sumHorasExtras,
  filterFeriasAtivas,
} from '../src/components/cadastros/detalhesColaboradorScope.js';

test('DetalhesColaborador usa filterInContext/updateInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cadastros/DetalhesColaborador.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Ponto'/);
  assert.match(src, /filterInContext\(\s*'Ferias'/);
  assert.match(src, /filterInContext\(\s*\n?\s*'OrdemProducao'/);
  assert.match(src, /updateInContext\(\s*'Colaborador'/);
  assert.match(src, /DETALHES_COLABORADOR_PONTOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero horas/);
  assert.doesNotMatch(src, /entities\.Ponto\.filter\(/);
  assert.doesNotMatch(src, /entities\.Ferias\.filter\(/);
  assert.doesNotMatch(src, /entities\.OrdemProducao\.filter\(/);
  assert.doesNotMatch(src, /entities\.Colaborador\.update\(/);
  assert.doesNotMatch(src, /data:\s*pontos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator, sessão e colaborador', () => {
  assert.deepEqual(
    buildDetalhesColaboradorQueryKey('pontos-colaborador', {
      groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1', colaboradorId: 'c9',
    }),
    ['pontos-colaborador', 'g1', 'e1', 'a1', 's1', 'c9'],
  );
});

test('KPI loading/erro nunca é ready (≠ zero horas)', () => {
  assert.equal(resolveDetalhesColaboradorKpiState({
    contextoValido: true, colaboradorId: 'c1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveDetalhesColaboradorKpiState({
    contextoValido: true, colaboradorId: 'c1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveDetalhesColaboradorKpiState({
    contextoValido: true, colaboradorId: 'c1',
    isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('helpers de ponto/férias', () => {
  const now = new Date('2026-03-15');
  const pontos = [
    { data: '2026-03-01', horas_trabalhadas: 8, horas_extras: 1 },
    { data: '2026-02-01', horas_trabalhadas: 8, horas_extras: 9 },
  ];
  const mes = filterPontosDoMes(pontos, now);
  assert.equal(mes.length, 1);
  assert.equal(sumHorasTrabalhadas(mes), 8);
  assert.equal(sumHorasExtras(mes), 1);
  assert.equal(filterFeriasAtivas([
    { status: 'Aprovado' }, { status: 'Cancelado' }, { status: 'Em Gozo' },
  ]).length, 2);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isDetalhesColaboradorScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isDetalhesColaboradorScopeCurrent(expected, { actorId: 'a1', sessionKey: 'sX' }), false);
});
