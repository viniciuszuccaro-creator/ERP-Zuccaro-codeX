import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveAuditTrailKpiState,
  isAuditTrailScopeCurrent,
  buildAuditTrailLogsQueryKey,
  buildAuditTrailUsersQueryKey,
  usuarioNoEscopoAuditTrail,
} from '../src/components/auditoria/auditTrailPanelScope.js';

test('AuditTrailPanel usa filterInContext sem User.list unscoped / default []', () => {
  const src = readFileSync('src/components/auditoria/AuditTrailPanel.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'AuditLog'/);
  assert.match(src, /filterInContext\(\s*'User'/);
  assert.match(src, /AUDIT_TRAIL_STALE_SCOPE/);
  assert.match(src, /lista vazia ≠ ready/);
  assert.doesNotMatch(src, /entities\.User\.list\(/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
  assert.doesNotMatch(src, /data:\s*logs\s*=\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*users\s*=\s*\[\]/);
});

test('KPI fail-closed e query keys multi-ator', () => {
  assert.equal(resolveAuditTrailKpiState({
    canView: true, contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveAuditTrailKpiState({
    canView: true, contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveAuditTrailKpiState({
    canView: true, contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(isAuditTrailScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isAuditTrailScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
  assert.deepEqual(
    buildAuditTrailLogsQueryKey({
      groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's', filtro: { x: 1 }, limit: 50,
    }),
    ['audit-logs', 'g', 'e', 'a', 's', { x: 1 }, 50],
  );
  assert.deepEqual(
    buildAuditTrailUsersQueryKey({ groupId: 'g', empresaId: null, actorId: 'a', sessionKey: 's' }),
    ['admin-users', 'g', null, 'a', 's'],
  );
  assert.equal(usuarioNoEscopoAuditTrail(
    { id: '1', empresa_id: 'e1' },
    { contexto: 'empresa', empresaAtivaId: 'e1', grupoAtivoId: 'g' },
  ), true);
  assert.equal(usuarioNoEscopoAuditTrail(
    { id: '2', empresa_id: 'e2' },
    { contexto: 'empresa', empresaAtivaId: 'e1', grupoAtivoId: 'g' },
  ), false);
});
