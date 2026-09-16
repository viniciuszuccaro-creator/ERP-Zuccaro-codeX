import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { resolveGuardPermission, validateGuardContext } from '../_lib/security/entityGuardPolicy/entry.ts';
import {
  evaluateMfaScopeAccess,
  isSixDigitMfaCode,
  validateMfaProviderConfig,
  verifyScopedMfaCode,
} from '../_lib/security/totpVerificationPolicy/entry.ts';

const attempts = globalThis.__verifyTotpAttempts || (globalThis.__verifyTotpAttempts = new Map());
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const safeIdentifier = (value, fallback = '-') => String(value || fallback)
  .trim()
  .replace(/[^A-Za-z0-9_. -]/g, '')
  .slice(0, 100) || fallback;

const consumeAttempt = (key, nowMs = Date.now()) => {
  const recent = (attempts.get(key) || []).filter((timestamp) => nowMs - timestamp < RATE_WINDOW_MS);
  recent.push(nowMs);
  attempts.set(key, recent);
  if (attempts.size > 1_000) {
    const oldest = attempts.keys().next().value;
    attempts.delete(oldest);
  }
  return recent.length <= MAX_ATTEMPTS;
};

const auditAttempt = async (base44, user, context, details) => {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: user.full_name || user.email || 'Usuario',
    usuario_id: user.id,
    acao: details.success ? 'Validacao MFA' : 'Bloqueio MFA',
    modulo: safeIdentifier(details.moduleName, 'Sistema'),
    tipo_auditoria: 'seguranca',
    entidade: '2FA.Verify',
    descricao: details.success ? 'MFA verificado' : 'MFA recusado',
    empresa_id: context.empresaId || null,
    group_id: context.groupId || null,
    dados_novos: {
      resultado: details.success ? 'permitido' : 'bloqueado',
      motivo: details.reason,
      scope_type: context.scopeType || null,
      section: safeIdentifier(details.section),
      provider: details.provider || null,
    },
    sucesso: details.success,
    data_hora: new Date().toISOString(),
  });
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const context = validateGuardContext(body);
    const moduleName = safeIdentifier(body?.module, 'Sistema');
    const section = safeIdentifier(Array.isArray(body?.section) ? body.section.join('.') : body?.section);

    if (!context.valid) {
      await auditAttempt(base44, user, context, { success: false, reason: context.error, moduleName, section, provider: null });
      return Response.json({ ok: false, error: context.error }, { status: 400 });
    }
    if (!isSixDigitMfaCode(body?.code)) {
      await auditAttempt(base44, user, context, { success: false, reason: 'invalid_code_format', moduleName, section, provider: null });
      return Response.json({ ok: false, error: 'invalid_code_format' }, { status: 400 });
    }

    const groups = await base44.asServiceRole.entities.GrupoEmpresarial.filter({ id: context.groupId }, undefined, 1);
    const companies = context.scopeType === 'empresa'
      ? await base44.asServiceRole.entities.Empresa.filter({ id: context.empresaId }, undefined, 1)
      : [];
    const scopeAccess = evaluateMfaScopeAccess(context, { user, groups, companies });
    if (!scopeAccess.allowed) {
      await auditAttempt(base44, user, context, { success: false, reason: scopeAccess.reason, moduleName, section, provider: null });
      return Response.json({ ok: false, error: 'scope_forbidden' }, { status: 403 });
    }

    if (!user.perfil_acesso_id) {
      await auditAttempt(base44, user, context, { success: false, reason: 'access_profile_required', moduleName, section, provider: null });
      return Response.json({ ok: false, error: 'access_profile_required' }, { status: 403 });
    }
    const profile = await base44.asServiceRole.entities.PerfilAcesso.get(user.perfil_acesso_id);
    const allowed = resolveGuardPermission({
      permissions: profile?.permissoes,
      moduleName: 'Sistema',
      section: 'Seguranca',
      action: 'executar',
    });
    if (!allowed) {
      await auditAttempt(base44, user, context, { success: false, reason: 'permission_denied', moduleName, section, provider: null });
      return Response.json({ ok: false, error: 'permission_denied' }, { status: 403 });
    }

    const providerConfig = validateMfaProviderConfig({
      provider: Deno.env.get('MFA_TOTP_PROVIDER'),
      secret: Deno.env.get('MFA_TOTP_SECRET'),
    });
    if (!providerConfig.valid) {
      await auditAttempt(base44, user, context, { success: false, reason: providerConfig.error, moduleName, section, provider: providerConfig.provider });
      return Response.json({ ok: false, error: 'mfa_unavailable' }, { status: 503 });
    }

    const ip = String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    if (!consumeAttempt(`${user.id}:${ip}`)) {
      await auditAttempt(base44, user, context, { success: false, reason: 'rate_limited', moduleName, section, provider: providerConfig.provider });
      return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }

    const ok = await verifyScopedMfaCode({
      code: body.code,
      secret: Deno.env.get('MFA_TOTP_SECRET'),
      userId: user.id,
      moduleName,
      section,
      groupId: context.groupId,
      empresaId: context.empresaId,
    });
    await auditAttempt(base44, user, context, {
      success: ok,
      reason: ok ? 'mfa_verified' : 'invalid_code',
      moduleName,
      section,
      provider: providerConfig.provider,
    });
    return Response.json({ ok }, { status: ok ? 200 : 403 });
  } catch (error) {
    console.error('[verifyTotp] verification unavailable', { error: error?.message || String(error) });
    return Response.json({ ok: false, error: 'mfa_unavailable' }, { status: 503 });
  }
});
