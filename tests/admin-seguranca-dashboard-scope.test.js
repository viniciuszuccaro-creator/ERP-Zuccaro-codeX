import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveSegurancaDashboardKpiState,
  isSegurancaDashboardScopeCurrent,
  buildSegurancaDashboardQueryKey,
  buildSegurancaDashboardEstatisticas,
  usuarioNoEscopoSegurancaDashboard,
} from '../src/components/administracao-sistema/seguranca-governanca/segurancaDashboardScope.js';

test('SegurancaDashboard usa filterInContext sem User.list fallback / KPI 0 em loading', () => {
  const src = readFileSync('src/components/administracao-sistema/seguranca-governanca/SegurancaDashboard.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*"User"/);
  assert.match(src, /filterInContext\(\s*"PerfilAcesso"/);
  assert.match(src, /filterInContext\(\s*"AuditLog"/);
  assert.match(src, /SEGURANCA_DASHBOARD_STALE_SCOPE/);
  assert.match(src, /KPI 0 ≠ ready/);
  assert.doesNotMatch(src, /entities\.User\.list\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /estatisticas=\{data\?\.estatisticas \|\| \{ cobertura: 0/);
  assert.doesNotMatch(src, /\.catch\(\(\) => \{\}\)/);
});

test('KPI fail-closed e estatisticas', () => {
  assert.equal(resolveSegurancaDashboardKpiState({
    canView: true, contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveSegurancaDashboardKpiState({
    canView: true, contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(isSegurancaDashboardScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildSegurancaDashboardQueryKey({ groupId: 'g', empresaId: null, actorId: 'a', sessionKey: 's' }),
    ['seguranca-dashboard-real', 'g', null, 'a', 's'],
  );
  assert.deepEqual(
    buildSegurancaDashboardEstatisticas(
      [{ id: 1, perfil_acesso_id: 'p' }, { id: 2 }],
      [{ acao: 'conflito SoD' }, { acao: 'login' }],
    ),
    { cobertura: 50, totalUsuarios: 2, conflitosTotal: 1 },
  );
  assert.equal(usuarioNoEscopoSegurancaDashboard(
    { id: '1', empresa_id: 'e1' },
    { contexto: 'empresa', empresaAtivaId: 'e1', grupoAtivoId: 'g' },
  ), true);
});
