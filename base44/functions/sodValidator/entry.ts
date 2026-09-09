import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { notify } from './_lib/notificationService.js';
import { detectSodConflicts } from './_lib/security/sodRules.js';

// Validador SoD para PerfilAcesso — apenas sugere (Gate 17).
// Nao grava conflitos automaticamente; IAGovernanca aplica apos confirmacao humana.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const event = payload?.event || null;
    const incoming = payload?.data || null;

    if (!event || event.entity_name !== 'PerfilAcesso') {
      return Response.json({ ok: true, skipped: true, reason: 'Evento nao e PerfilAcesso' });
    }

    const user = await base44.auth.me().catch(() => null);
    const entities = user ? base44.entities : base44.asServiceRole.entities;

    let perfil = incoming;
    if (!perfil && event.entity_id) {
      const list = await entities.PerfilAcesso.filter({ id: event.entity_id }, undefined, 1);
      perfil = list?.[0] || null;
    }

    if (!perfil) {
      return Response.json({ ok: false, error: 'Perfil nao encontrado' }, { status: 400 });
    }

    const permissoes = perfil?.permissoes || {};
    const { conflitos, severidadeMax } = detectSodConflicts(permissoes);
    const patchSugerido = {
      conflitos_sod_detectados: conflitos,
      requer_aprovacao_especial: (severidadeMax === 'Alta' || severidadeMax === 'Crítica') || perfil?.requer_aprovacao_especial || false,
    };

    try {
      await entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id || null,
        acao: 'Analise',
        modulo: 'Controle de Acesso',
        entidade: 'PerfilAcesso',
        registro_id: event.entity_id,
        descricao: `SoD sugeriu ${conflitos.length} conflito(s) sem gravacao automatica`,
        dados_novos: { modo: 'sugestao', severidadeMax, ...patchSugerido },
        group_id: perfil?.group_id || null,
        empresa_id: perfil?.empresa_id || null,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}

    if (severidadeMax === 'Alta' || severidadeMax === 'Crítica') {
      try {
        await notify(base44, {
          titulo: 'Conflitos SoD detectados (sugestao)',
          mensagem: `${conflitos.length} conflito(s) • severidade ${severidadeMax}. Confirme na IA de Governanca para gravar.`,
          categoria: 'Segurança',
          prioridade: 'Alta',
          empresa_id: perfil?.empresa_id || null,
          dados: { perfil_id: event.entity_id, conflitos, modo: 'sugestao' }
        });
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      modo: 'sugestao',
      conflitos: conflitos.length,
      severidadeMax,
      suggested: patchSugerido,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
