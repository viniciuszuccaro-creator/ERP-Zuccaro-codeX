import { evaluateLocalGuardScope } from './localEntityGuardApi.js';

const DEFAULT_MFA_VALIDITY_MINUTES = 5;
const normalizeId = (value) => String(value || '').trim();
const isSixDigitCode = (value) => /^\d{6}$/.test(String(value || '').trim());

/** Verifica apenas prova MFA previamente emitida por um verificador confiavel. */
export const runLocalTotpVerification = (payload = {}, dependencies) => {
  const context = dependencies.validateContext(payload);
  const state = dependencies.loadState();
  const sessionId = normalizeId(state.session?.id) || null;
  const action = String(payload.action || 'verify').trim().toLowerCase();
  const finish = (success, reason, extra = {}) => {
    dependencies.auditAttempt({ success, reason, groupId: context.groupId || null, empresaId: context.empresaId || null, sessionId });
    return { data: { ok: success, valid: success, local: true, reason, ...extra } };
  };

  if (!context.valid) return finish(false, context.error || 'contexto-invalido');
  if (!['request', 'verify'].includes(action)) return finish(false, 'acao-invalida');
  const scope = evaluateLocalGuardScope(context, state);
  if (!scope.allowed) return finish(false, scope.reason || 'escopo-nao-autorizado');

  const nowMs = dependencies.nowMs?.() ?? Date.now();
  const sessionEvaluation = dependencies.evaluateSession(state.user || null, state.session || null, nowMs);
  if (!sessionEvaluation.allowed) {
    const reason = sessionEvaluation.reason === 'session_owner_mismatch'
      ? 'sessao-usuario-divergente'
      : sessionEvaluation.reason || 'sessao-invalida';
    return finish(false, reason);
  }
  if (normalizeId(state.session?.usuario_id) !== normalizeId(state.user?.id)) return finish(false, 'sessao-usuario-divergente');
  if (normalizeId(state.session?.group_id || state.session?.grupo_id) !== normalizeId(context.groupId)) return finish(false, 'sessao-grupo-divergente');

  const permission = dependencies.evaluatePermission({ module: 'Sistema', section: 'Seguranca', action: 'executar' });
  if (!permission.allowed) return finish(false, permission.reason || 'permissao-negada');
  if (state.mfaRequired !== true) return finish(false, 'mfa-nao-configurado');
  if (state.session?.mfa_validado !== true) return finish(false, 'mfa-nao-validado');

  const validatedAt = Date.parse(String(state.session.mfa_validado_em || state.session.mfa_validated_at || state.session.data_hora_mfa_validado || ''));
  const configuredMinutes = Number(state.validityMinutes || DEFAULT_MFA_VALIDITY_MINUTES);
  const validityMinutes = Number.isFinite(configuredMinutes) ? Math.min(Math.max(configuredMinutes, 1), 15) : DEFAULT_MFA_VALIDITY_MINUTES;
  if (!Number.isFinite(validatedAt) || validatedAt <= 0 || nowMs - validatedAt > validityMinutes * 60_000) return finish(false, 'mfa-expirado');
  if (action === 'request') return finish(true, 'mfa-sessao-valida', { requested: false });
  if (!isSixDigitCode(payload.code)) return finish(false, 'codigo-invalido');

  return finish(true, 'mfa-sessao-valida');
};
