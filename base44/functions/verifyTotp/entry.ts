import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { resolveGuardPermission, validateGuardContext } from '../_lib/security/entityGuardPolicy/entry.ts';
import { sendEmail } from '../_lib/notificationUtils/entry.ts';
import {
  createMfaDeliverySignature,
  createScopedMfaCode,
  evaluateMfaScopeAccess,
  evaluateMfaRequestRateLimit,
  evaluateMfaVerificationRateLimit,
  isSixDigitMfaCode,
  mfaStepForTime,
  resolveMfaDestination,
  validateMfaProviderConfig,
  verifyScopedMfaCode,
} from '../_lib/security/totpVerificationPolicy/entry.ts';

const safeIdentifier = (value, fallback = '-') => String(value || fallback)
  .trim()
  .replace(/[^A-Za-z0-9_. -]/g, '')
  .slice(0, 100) || fallback;

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

const loadRecentAttempts = (base44, user, context) => base44.asServiceRole.entities.AuditLog.filter({
  entidade: '2FA.Verify',
  usuario_id: user.id,
  group_id: context.groupId,
  empresa_id: context.empresaId || null,
}, '-created_date', 30);

const deliverChallenge = async ({ base44, provider, destination, code, user, context, secret }) => {
  const message = `Seu codigo de verificacao do ERP Zuccaro e ${code}. Ele expira em ate 5 minutos. Nao compartilhe este codigo.`;
  if (provider === 'email') {
    await sendEmail(base44, destination, 'Codigo de verificacao - ERP Zuccaro', message);
    return;
  }
  const timestamp = Date.now();
  const signature = await createMfaDeliverySignature({
    secret,
    userId: user.id,
    groupId: context.groupId,
    empresaId: context.empresaId,
    destination,
    message,
    timestamp,
  });
  await base44.asServiceRole.functions.invoke('whatsappSend', {
    action: 'sendText',
    numero: destination,
    mensagem: message,
    empresaId: context.empresaId || null,
    groupId: context.groupId,
    mfa_delivery: { user_id: user.id, timestamp, signature },
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
    const action = String(body?.action || 'verify').trim().toLowerCase();

    if (!context.valid) {
      await auditAttempt(base44, user, context, { success: false, reason: context.error, moduleName, section, provider: null });
      return Response.json({ ok: false, error: context.error }, { status: 400 });
    }
    if (!['request', 'verify'].includes(action)) {
      await auditAttempt(base44, user, context, { success: false, reason: 'invalid_action', moduleName, section, provider: null });
      return Response.json({ ok: false, error: 'invalid_action' }, { status: 400 });
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

    const recentAttempts = await loadRecentAttempts(base44, user, context);
    if (action === 'request') {
      const destination = resolveMfaDestination(providerConfig.provider, user);
      if (!destination.valid) {
        await auditAttempt(base44, user, context, { success: false, reason: destination.error, moduleName, section, provider: providerConfig.provider });
        return Response.json({ ok: false, error: destination.error }, { status: 409 });
      }
      const requestGate = evaluateMfaRequestRateLimit(recentAttempts);
      if (!requestGate.allowed) {
        await auditAttempt(base44, user, context, { success: false, reason: requestGate.reason, moduleName, section, provider: providerConfig.provider });
        return Response.json({ ok: false, error: requestGate.reason }, { status: 429 });
      }
      if (requestGate.reused) {
        await auditAttempt(base44, user, context, { success: true, reason: requestGate.reason, moduleName, section, provider: providerConfig.provider });
        return Response.json({
          ok: true,
          requested: true,
          reused: true,
          provider: providerConfig.provider,
          destination: destination.masked,
          retry_after_seconds: requestGate.retryAfterSeconds,
        });
      }

      const secret = Deno.env.get('MFA_TOTP_SECRET');
      const code = await createScopedMfaCode({
        secret,
        userId: user.id,
        moduleName,
        section,
        groupId: context.groupId,
        empresaId: context.empresaId,
        step: mfaStepForTime(),
      });
      try {
        await deliverChallenge({ base44, provider: providerConfig.provider, destination: destination.destination, code, user, context, secret });
      } catch (error) {
        console.error('[verifyTotp] challenge delivery failed', { provider: providerConfig.provider, error: error?.message || String(error) });
        await auditAttempt(base44, user, context, { success: false, reason: 'challenge_delivery_failed', moduleName, section, provider: providerConfig.provider });
        return Response.json({ ok: false, error: 'challenge_delivery_failed' }, { status: 503 });
      }
      await auditAttempt(base44, user, context, { success: true, reason: 'challenge_sent', moduleName, section, provider: providerConfig.provider });
      return Response.json({
        ok: true,
        requested: true,
        reused: false,
        provider: providerConfig.provider,
        destination: destination.masked,
        expires_in_seconds: 300,
      });
    }

    if (!isSixDigitMfaCode(body?.code)) {
      await auditAttempt(base44, user, context, { success: false, reason: 'invalid_code_format', moduleName, section, provider: providerConfig.provider });
      return Response.json({ ok: false, error: 'invalid_code_format' }, { status: 400 });
    }
    const verifyGate = evaluateMfaVerificationRateLimit(recentAttempts);
    if (!verifyGate.allowed) {
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
