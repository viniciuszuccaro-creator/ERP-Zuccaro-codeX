import assert from 'node:assert/strict';
import test from 'node:test';

import { runLocalTotpVerification } from '../src/api/localTotpVerificationApi.js';
import { evaluateLocalUserSession } from '../src/api/localAuthSessionPolicy.js';
import { validateGuardContext } from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';

const nowMs = Date.parse('2026-09-15T12:00:00.000Z');
const user = { id: 'vinicius', grupo_atual_id: 'grupo-cpa', empresa_atual_id: '3z', grupos_vinculados: [{ grupo_id: 'grupo-cpa', ativo: true }], empresas_vinculadas: [{ empresa_id: '3z', ativo: true }] };
const baseState = {
  user,
  session: { id: 'sessao-1', usuario_id: 'vinicius', group_id: 'grupo-cpa', empresa_id: '3z', ativa: true, mfa_validado: true, mfa_validado_em: '2026-09-15T11:58:00.000Z' },
  groups: [{ id: 'grupo-cpa' }],
  companies: [{ id: '3z', group_id: 'grupo-cpa' }, { id: 'externa', group_id: 'outro-grupo' }],
  mfaRequired: true,
  validityMinutes: 5,
};

const run = (payload = {}, state = baseState, overrides = {}) => {
  const audits = [];
  const result = runLocalTotpVerification({ group_id: 'grupo-cpa', empresa_id: '3z', code: '123456', ...payload }, {
    validateContext: validateGuardContext,
    evaluateSession: evaluateLocalUserSession,
    evaluatePermission: () => ({ allowed: true }),
    loadState: () => state,
    auditAttempt: (audit) => audits.push(audit),
    nowMs: () => nowMs,
    ...overrides,
  });
  return { result, audits };
};

test('accepts only a recent MFA proof bound to the active session', () => {
  const { result, audits } = run();
  assert.equal(result.data.ok, true);
  assert.equal(result.data.valid, true);
  assert.equal(result.data.reason, 'mfa-sessao-valida');
  assert.deepEqual(audits[0], { success: true, reason: 'mfa-sessao-valida', groupId: 'grupo-cpa', empresaId: '3z', sessionId: 'sessao-1' });
});

test('fails closed without MFA configuration or trusted session proof', () => {
  assert.equal(run({}, { ...baseState, mfaRequired: false }).result.data.reason, 'mfa-nao-configurado');
  assert.equal(run({}, { ...baseState, session: { ...baseState.session, mfa_validado: false } }).result.data.reason, 'mfa-nao-validado');
  assert.equal(run({}, { ...baseState, session: { ...baseState.session, mfa_validado_em: '2026-09-15T11:40:00.000Z' } }).result.data.reason, 'mfa-expirado');
});

test('blocks invalid code, permission, session owner and external company', () => {
  assert.equal(run({ code: '12ab' }).result.data.reason, 'codigo-invalido');
  assert.equal(run({}, baseState, { evaluatePermission: () => ({ allowed: false, reason: 'rbac-negado' }) }).result.data.reason, 'rbac-negado');
  assert.equal(run({}, { ...baseState, session: { ...baseState.session, usuario_id: 'outro' } }).result.data.reason, 'sessao-usuario-divergente');
  assert.equal(run({ empresa_id: 'externa' }).result.data.reason, 'empresa-fora-do-grupo');
});

test('audit contract never receives the informed MFA code', () => {
  const { audits } = run({ code: '654321' });
  assert.equal(JSON.stringify(audits).includes('654321'), false);
  assert.deepEqual(Object.keys(audits[0]).sort(), ['empresaId', 'groupId', 'reason', 'sessionId', 'success']);
});
