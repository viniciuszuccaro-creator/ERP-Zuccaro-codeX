import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveRelatorioQualidadeKpiState,
  isRelatorioQualidadeScopeCurrent,
  buildRelatorioQualidadeQueryKey,
  filterInspecoesPorPeriodo,
  buildRelatorioQualidadeKpis,
} from '../src/components/qualidade/relatorioQualidadeScope.js';

test('RelatorioQualidade usa filterInContext sem InspecaoQualidade.list / default []', () => {
  const src = readFileSync('src/components/qualidade/RelatorioQualidade.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'InspecaoQualidade'/);
  assert.match(src, /RELATORIO_QUALIDADE_STALE_SCOPE/);
  assert.match(src, /KPI 0 ≠ ready/);
  assert.doesNotMatch(src, /entities\.InspecaoQualidade\.list\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /data:\s*inspecoes\s*=\s*\[\]/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
});

test('KPI fail-closed, periodo e agregados', () => {
  assert.equal(resolveRelatorioQualidadeKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveRelatorioQualidadeKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(isRelatorioQualidadeScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildRelatorioQualidadeQueryKey({
      groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's',
      periodoInicio: '2026-01-01', periodoFim: '2026-01-31',
    }),
    ['inspecoes', 'g', 'e', 'a', 's', '2026-01-01', '2026-01-31'],
  );
  const filtered = filterInspecoesPorPeriodo([
    { id: 1, data_inspecao: '2026-01-15', resultado: 'Aprovado', tempo_inspecao_min: 10 },
    { id: 2, data_inspecao: '2025-12-01', resultado: 'Reprovado', tempo_inspecao_min: 20 },
  ], '2026-01-01', '2026-01-31');
  assert.equal(filtered.length, 1);
  assert.deepEqual(buildRelatorioQualidadeKpis(filtered), {
    totalInspecoes: 1,
    aprovadas: 1,
    reprovadas: 0,
    revisar: 0,
    taxaAprovacao: '100.0',
    tempoMedio: 10,
  });
});
