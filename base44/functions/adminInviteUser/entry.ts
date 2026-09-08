import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only: convidar usuário para o app
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const email = body?.email;
    const role = body?.role === 'admin' ? 'admin' : 'user';
    const groupId = body?.group_id || body?.grupo_id || user?.grupo_atual_id || user?.grupo_padrao_id || user?.group_id || null;
    const empresaId = body?.empresa_id || user?.empresa_atual_id || user?.empresa_padrao_id || null;

    if (!email) return Response.json({ error: 'email é obrigatório' }, { status: 400 });
    if (!groupId) {
      return Response.json({ error: 'group_id obrigatório para convite auditável' }, { status: 400 });
    }

    await base44.users.inviteUser(email, role);

    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id,
        acao: 'Criação',
        modulo: 'Sistema',
        entidade: 'ConviteUsuario',
        tipo_auditoria: 'seguranca',
        descricao: `Convite enviado para ${email} com role=${role}`,
        dados_novos: { email, role },
        group_id: groupId,
        empresa_id: empresaId,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[adminInviteUser] Falha ao registrar auditoria de convite', error?.message || error);
      return Response.json({
        error: 'Convite enviado, mas falhou ao registrar auditoria',
        detail: String(error?.message || error),
      }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
