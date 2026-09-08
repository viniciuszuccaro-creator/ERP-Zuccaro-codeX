import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';

function buildPermissionOptimizationAudit(sugestoes = {}, blocksByModule = {}) {
  const entries = Object.entries(sugestoes || {});
  return {
    perfis_atualizados: entries.length,
    perfis_ids: entries.map(([id]) => id).slice(0, 50),
    perfis_com_aprovacao_especial: entries.filter(([, item]) => item?.requer_aprovacao_especial).length,
    modulos_com_bloqueio: Object.keys(blocksByModule || {}),
    total_bloqueios: Object.values(blocksByModule || {}).reduce((sum, value) => sum + Number(value || 0), 0),
  };
}

function buildSuggestions(perfis = [], blocksByModule = {}) {
  const sugestoes = {};
  for (const p of perfis) {
    const topModules = Object.entries(blocksByModule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, c]) => `${m}: ${c}`)
      .join(', ');
    const texto = `Sugestao IA: revisar permissoes (bloqueios por modulo → ${topModules || 'sem incidencia'}); aplicar SoD onde houver conflitos.`;
    const conflitos = Array.isArray(p.conflitos_sod_detectados) ? p.conflitos_sod_detectados : [];
    const requerAprovacao = conflitos.length > 0 || Object.values(blocksByModule).some((v) => v >= 10);
    sugestoes[p.id] = {
      nome: p.nome_perfil,
      observacao_sugerida: texto,
      requer_aprovacao_especial: requerAprovacao,
      observacoes_atuais: p.observacoes || '',
    };
  }
  return sugestoes;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getUserAndPerfil(base44);
    const perm = await assertPermission(base44, ctx, 'Sistema', 'Controle de Acesso', 'editar');
    if (perm) return perm;

    const simulate = payload?.simulate === true;
    const confirmado = payload?.confirmado === true;
    if (!simulate && !confirmado) {
      return Response.json({ error: 'Acao critica do agente exige confirmacao humana.' }, { status: 403 });
    }

    const groupId = payload?.group_id || user.grupo_atual_id || user.grupo_padrao_id || user.group_id || null;
    const auditFilter = groupId ? { group_id: groupId } : {};
    const ultimos = await base44.asServiceRole.entities.AuditLog.filter(auditFilter, '-data_hora', 800);
    const bloqueios = (ultimos || []).filter((l) => l.acao === 'Bloqueio');
    const countBy = (arr, fn) => arr.reduce((acc, v) => {
      const k = fn(v);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const blocksByModule = countBy(bloqueios, (l) => l.modulo || 'Sistema');

    const perfis = await base44.asServiceRole.entities.PerfilAcesso.list();
    const sugestoes = buildSuggestions(perfis || [], blocksByModule);

    if (simulate || !confirmado) {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        acao: 'Analise',
        modulo: 'Sistema',
        entidade: 'PerfilAcesso',
        descricao: 'Agente Seguranca gerou sugestoes de RBAC sem gravar (simulacao/pendente confirmacao)',
        dados_novos: buildPermissionOptimizationAudit(sugestoes, blocksByModule),
        group_id: groupId,
        duracao_ms: Date.now() - t0,
        data_hora: new Date().toISOString(),
      }).catch(() => null);
      return Response.json({
        success: true,
        modo: 'sugestao',
        perfis_sugeridos: Object.keys(sugestoes).length,
        sugestoes,
      });
    }

    let atualizados = 0;
    for (const [id, item] of Object.entries(sugestoes)) {
      const perfil = (perfis || []).find((p) => String(p.id) === String(id));
      if (!perfil) continue;
      const novoObs = perfil.observacoes
        ? `${perfil.observacoes}\n${item.observacao_sugerida}`
        : item.observacao_sugerida;
      const updated = { observacoes: novoObs };
      if (item.requer_aprovacao_especial) {
        updated.requer_aprovacao_especial = true;
      }
      await base44.asServiceRole.entities.PerfilAcesso.update(id, updated);
      atualizados += 1;
    }

    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Usuario',
      usuario_id: user?.id || null,
      acao: 'Edicao',
      modulo: 'Sistema',
      entidade: 'PerfilAcesso',
      descricao: 'Otimizacao de permissoes aplicada apos confirmacao humana (agente Seguranca)',
      dados_novos: buildPermissionOptimizationAudit(sugestoes, blocksByModule),
      group_id: groupId,
      duracao_ms: Date.now() - t0,
      data_hora: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ success: true, modo: 'confirmado', perfis_atualizados: atualizados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
