import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createMfaDeliverySignature,
  createScopedMfaCode,
  evaluateMfaScopeAccess,
  evaluateMfaRequestRateLimit,
  evaluateMfaVerificationRateLimit,
  mfaStepForTime,
  resolveMfaDestination,
  validateMfaProviderConfig,
  verifyMfaDeliverySignature,
  verifyScopedMfaCode,
} from '../base44/functions/_lib/security/totpVerificationPolicy/entry.ts';

const secret = '0123456789abcdef0123456789abcdef';
const nowMs = Date.parse('2026-09-16T12:00:00.000Z');
const codeInput = {
  secret,
  userId: 'vinicius',
  moduleName: 'Financeiro',
  section: 'Caixa',
  groupId: 'grupo-cpa',
  empresaId: '3z',
};

test('MFA backend requires a dedicated provider and strong dedicated secret', () => {
  assert.equal(validateMfaProviderConfig({ provider: '', secret }).error, 'mfa_provider_unavailable');
  assert.equal(validateMfaProviderConfig({ provider: 'email', secret: 'short' }).error, 'mfa_secret_unavailable');
  assert.equal(validateMfaProviderConfig({ provider: 'authenticator', secret }).error, 'mfa_provider_unavailable');
  assert.deepEqual(validateMfaProviderConfig({ provider: 'email', secret }), {
    valid: true,
    error: null,
    provider: 'email',
  });
});

test('scoped HMAC code accepts current and previous windows only', async () => {
  const current = await createScopedMfaCode({ ...codeInput, step: mfaStepForTime(nowMs) });
  const previous = await createScopedMfaCode({ ...codeInput, step: mfaStepForTime(nowMs) - 1 });
  const expired = await createScopedMfaCode({ ...codeInput, step: mfaStepForTime(nowMs) - 2 });
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code: current, nowMs }), true);
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code: previous, nowMs }), true);
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code: expired, nowMs }), false);
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code: '12ab', nowMs }), false);
});

test('code is bound to user, module, section, group and company', async () => {
  const code = await createScopedMfaCode({ ...codeInput, step: mfaStepForTime(nowMs) });
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code, userId: 'outro', nowMs }), false);
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code, empresaId: 'cpa-aco', nowMs }), false);
  assert.equal(await verifyScopedMfaCode({ ...codeInput, code, groupId: 'outro-grupo', nowMs }), false);
});

test('scope blocks external company and accepts only linked group/company', () => {
  const user = {
    id: 'vinicius',
    grupo_atual_id: 'grupo-cpa',
    empresas_vinculadas: [{ empresa_id: '3z', ativo: true }],
    grupos_vinculados: [{ grupo_id: 'grupo-cpa', ativo: true }],
  };
  const groups = [{ id: 'grupo-cpa' }];
  assert.equal(evaluateMfaScopeAccess({ groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa' }, {
    user, groups, companies: [{ id: '3z', group_id: 'grupo-cpa' }],
  }).allowed, true);
  assert.equal(evaluateMfaScopeAccess({ groupId: 'grupo-cpa', empresaId: 'externa', scopeType: 'empresa' }, {
    user, groups, companies: [{ id: 'externa', group_id: 'outro-grupo' }],
  }).reason, 'company_outside_group');
});

test('MFA delivery resolves and masks only valid user-owned contacts', () => {
  assert.equal(resolveMfaDestination('email', { email: 'vinicius@example.com' }).masked, 'vi******@example.com');
  assert.equal(resolveMfaDestination('whatsapp', { telefone: '(11) 99999-1234' }).masked, '*******1234');
  assert.equal(resolveMfaDestination('email', { email: 'invalid' }).error, 'mfa_email_unavailable');
  assert.equal(resolveMfaDestination('whatsapp', { telefone: '123' }).error, 'mfa_whatsapp_unavailable');
});

test('persistent audit history controls resend and verification abuse', () => {
  const audit = (motivo, millisecondsAgo) => ({
    created_date: new Date(nowMs - millisecondsAgo).toISOString(),
    dados_novos: { motivo },
  });
  assert.equal(evaluateMfaRequestRateLimit([audit('challenge_sent', 30_000)], nowMs).reused, true);
  assert.equal(evaluateMfaRequestRateLimit(Array.from({ length: 5 }, (_, index) => audit('challenge_sent', 70_000 + index)), nowMs).reason, 'challenge_rate_limited');
  assert.equal(evaluateMfaRequestRateLimit(Array.from({ length: 5 }, (_, index) => audit('challenge_delivery_failed', index)), nowMs).reason, 'challenge_rate_limited');
  assert.equal(evaluateMfaVerificationRateLimit(Array.from({ length: 5 }, (_, index) => audit('invalid_code', index)), nowMs).reason, 'rate_limited');
  assert.equal(evaluateMfaVerificationRateLimit([audit('invalid_code', 6 * 60_000)], nowMs).allowed, true);
});

test('WhatsApp MFA handoff signature is scoped and expires quickly', async () => {
  const delivery = {
    secret,
    userId: 'vinicius',
    groupId: 'grupo-cpa',
    empresaId: '3z',
    destination: '5511999991234',
    message: 'Codigo MFA 123456',
    timestamp: nowMs,
  };
  const signature = await createMfaDeliverySignature(delivery);
  assert.equal(await verifyMfaDeliverySignature({ ...delivery, signature }, nowMs), true);
  assert.equal(await verifyMfaDeliverySignature({ ...delivery, signature, destination: '5511888881234' }, nowMs), false);
  assert.equal(await verifyMfaDeliverySignature({ ...delivery, signature }, nowMs + 61_000), false);
});

test('backend source never reuses backup/deploy secrets or audits informed code', async () => {
  const source = await readFile(new URL('../base44/functions/verifyTotp/entry.ts', import.meta.url), 'utf8');
  const whatsapp = await readFile(new URL('../base44/functions/whatsappSend/entry.ts', import.meta.url), 'utf8');
  const prompt = await readFile(new URL('../src/components/security/TwoFactorAuthPrompt.jsx', import.meta.url), 'utf8');
  assert.match(source, /MFA_TOTP_SECRET/);
  assert.match(source, /MFA_TOTP_PROVIDER/);
  assert.match(source, /AuditLog\.filter/);
  assert.match(source, /action === 'request'/);
  assert.doesNotMatch(source, /BACKUP_ENCRYPTION_KEY|DEPLOY_AUDIT_TOKEN|b44_fallback_secret/);
  assert.doesNotMatch(source, /__verifyTotpAttempts/);
  assert.doesNotMatch(source, /dados_novos:\s*\{[^}]*code/s);
  assert.doesNotMatch(source, /catch\s*\{\s*\}/);
  assert.match(whatsapp, /trustedMfaDelivery/);
  assert.match(whatsapp, /WhatsApp MFA indisponivel/);
  assert.doesNotMatch(whatsapp, /dados_novos:\s*\{[^}]*mfa_delivery/s);
  assert.match(prompt, /action: 'request'/);
  assert.match(prompt, /action: 'verify'/);
});
