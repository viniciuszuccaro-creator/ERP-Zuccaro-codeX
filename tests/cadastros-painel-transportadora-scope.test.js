import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelTransportadoraKpiState,
  isPainelTransportadoraScopeCurrent,
  countPainelTransportadoraEntregasRealizadas,
  countPainelTransportadoraEntregasFrustradas,
  computePainelTransportadoraTaxaSucesso,
} from '../src/components/cadastros/painelDinamicoTransportadoraScope.js';

test('PainelDinamicoTransportadora usa filterInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cadastros/PainelDinamicoTransportadora.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Entrega'/);
  assert.match(src, /filterInContext\(\s*'Romaneio'/);
  assert.match(src, /PAINEL_TRANSPORTADORA_ENTREGAS_STALE_SCOPE/);
  assert.match(src, /Erro ≠ 0 entregas \/ 0%/);
  assert.doesNotMatch(src, /entities\.Entrega\.filter\(/);
  assert.doesNotMatch(src, /entities\.Romaneio\.filter\(/);
  assert.doesNotMatch(src, /data:\s*entregas\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e agregações', () => {
  assert.equal(resolvePainelTransportadoraKpiState({
    painelAberto: true, contextoValido: true, transportadoraId: 't1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePainelTransportadoraKpiState({
    painelAberto: true, contextoValido: true, transportadoraId: 't1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  const rows = [
    { status: 'Entregue' },
    { status: 'Entregue' },
    { status: 'Entrega Frustrada' },
  ];
  assert.equal(countPainelTransportadoraEntregasRealizadas(rows), 2);
  assert.equal(countPainelTransportadoraEntregasFrustradas(rows), 1);
  assert.equal(computePainelTransportadoraTaxaSucesso(rows), 66.7);
  assert.equal(isPainelTransportadoraScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
});
