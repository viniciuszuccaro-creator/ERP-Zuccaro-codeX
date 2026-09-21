import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase().slice(0, 254);
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const hashEmail = async (email) => {
  const bytes = new TextEncoder().encode(email);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const reportInviteFailure = (operation, error, scope = {}) => {
  console.error('[adminInviteUser] ' + operation, {
    error_type: error?.name || 'Error',
    group_id: scope.group_id || null,
    empresa_id: scope.empresa_id || null,
  });
};

Deno.serve(async (req) => {
  let scope = { group_id: null, empresa_id: null };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const role = body?.role === 'admin' ? 'admin' : 'user';
    if (!isValidEmail(email)) return Response.json({ error: 'email invalido' }, { status: 400 });
    if (role === 'admin' && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: convite administrativo restrito' }, { status: 403 });
    }

    const resolvedScope = await completeGuardCallScope(base44, body || {});
    if (!resolvedScope.groupId) {
      return Response.json({ error: 'group_id obrigatorio para convite auditavel' }, { status: 400 });
    }
    scope = {
      group_id: resolvedScope.groupId,
      empresa_id: resolvedScope.empresaId || null,
    };

    const empresasDoGrupo = await base44.asServiceRole.entities.Empresa.filter(
      { group_id: scope.group_id },
      undefined,
      500,
    );
    if (scope.empresa_id && !(empresasDoGrupo || []).some((empresa) => empresa.id === scope.empresa_id)) {
      return Response.json({ error: 'Empresa fora do grupo informado' }, { status: 403 });
    }

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Sistema',
      section: 'Controle de Acesso',
      action: 'criar',
      group_id: scope.group_id,
      empresa_id: scope.empresa_id,
    });
    if (guardFailure) return guardFailure;

    await base44.users.inviteUser(email, role);

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id,
        acao: 'Criacao',
        modulo: 'Sistema',
        entidade: 'ConviteUsuario',
        tipo_auditoria: 'seguranca',
        descricao: 'Convite de usuario enviado apos validacao de escopo e permissao.',
        dados_novos: {
          email_hash: await hashEmail(email),
          role,
          resultado: 'enviado',
        },
        group_id: scope.group_id,
        empresa_id: scope.empresa_id,
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      reportInviteFailure('auditoria', error, scope);
      return Response.json({ error: 'Convite enviado, mas a auditoria falhou' }, { status: 500 });
    }

    return Response.json({ ok: true, role, group_id: scope.group_id, empresa_id: scope.empresa_id });
  } catch (error) {
    reportInviteFailure('execucao', error, scope);
    return Response.json({ error: 'Nao foi possivel processar o convite' }, { status: 500 });
  }
});
