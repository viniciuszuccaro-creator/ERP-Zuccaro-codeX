import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelGovernancaKpiState,
  isPainelGovernancaScopeCurrent,
  countPainelGovernancaLoginsHoje,
  countPainelGovernancaAltoRisco,
  buildPainelGovernancaQueryKey,
} from '../src/components/governanca/painelGovernancaScope.js';

test('PainelGovernanca usa filterInContext sem entities unscoped / default []', () => {
  const src = readFileSync('src/components/governanca/PainelGovernanca.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'AuditoriaGlobal'/);
  assert.match(src, /filterInContext\(\s*'AuditoriaAcesso'/);
  assert.match(src, /filterInContext\(\s*'GovernancaEmpresa'/);
  assert.match(src, /PAINEL_GOVERNANCA_GLOBAL_STALE_SCOPE/);
  assert.match(src, /KPI ≠ zeros/);
  assert.doesNotMatch(src, /entities\.GovernancaEmpresa\.filter\(/);
  assert.doesNotMatch(src, /data:\s*auditoriaGlobal\s*=\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*auditoriaAcessos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e contagens fail-closed', () => {
  assert.equal(resolvePainelGovernancaKpiState({
    contextoValido: true, podeVerGovernanca: true,
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePainelGovernancaKpiState({
    contextoValido: true, podeVerGovernanca: true,
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  const now = new Date('2026-11-05T15:00:00Z');
  assert.equal(countPainelGovernancaLoginsHoje([
    { tipo_acao: 'Login', sucesso: true, data_hora: '2026-11-05T12:00:00Z' },
    { tipo_acao: 'Login', sucesso: false, data_hora: '2026-11-05T12:00:00Z' },
  ], now), 1);
  assert.equal(countPainelGovernancaAltoRisco([
    { nivel_risco: 'Alto' },
    { nivel_risco: 'Baixo' },
  ]), 1);
  assert.equal(isPainelGovernancaScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildPainelGovernancaQueryKey('auditoria-global', {
      groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's',
    }),
    ['auditoria-global', 'g', 'e', 'a', 's'],
  );
});
