import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { sendEmail } from './_lib/notificationUtils.js';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';

/**
 * Agregado de alertas de seguranca (sugestao).
 * Heuristicas: exclusoes, perfis, bloqueios em janela curta.
 * Fail-closed: exige group_id; envio externo so com confirmado/alertar.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    const isScheduled = !user;

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }
    const filtros = payload?.filtros || {};
    const groupId = filtros.group_id || payload.group_id || user?.grupo_atual_id || user?.grupo_padrao_id || user?.group_id || null;
    const empresaId = filtros.empresa_id || payload.empresa_id || null;

    if (!groupId) {
      return Response.json({ error: 'Grupo obrigatorio para deteccao de anomalias de seguranca.' }, { status: 400 });
    }

    if (!isScheduled) {
      const ctx = await getUserAndPerfil(base44);
      const deny = await assertPermission(base44, ctx, 'Sistema', 'Auditoria', 'visualizar');
      if (deny) {
        const denyAlt = await assertPermission(base44, ctx, 'Sistema', 'Controle de Acesso', 'visualizar');
        if (denyAlt) return denyAlt;
      }
    }

    const WINDOW_MIN = 15;
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MIN * 60 * 1000);
    const confirmado = payload?.confirmado === true || payload?.alertar === true;

    const logs = await base44.asServiceRole.entities.AuditLog.filter(
      { group_id: groupId },
      '-created_date',
      500,
    );

    const getLogDate = (l) => {
      if (l?.data_hora) return new Date(l.data_hora);
      if (l?.created_date) return new Date(l.created_date);
      return null;
    };

    const inScope = (l) => {
      if (empresaId) {
        const eid = l?.empresa_id ?? l?.dados_novos?.empresa_id ?? null;
        if (eid && eid !== empresaId) return false;
      }
      const gid = l?.group_id ?? l?.dados_novos?.group_id ?? null;
      if (gid && gid !== groupId) return false;
      return true;
    };

    const recent = (logs || []).filter((l) => {
      const d = getLogDate(l);
      return d && d >= windowStart && inScope(l);
    });

    const countBy = (arr, fn) => arr.reduce((acc, v) => {
      const k = fn(v);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const byAction = countBy(recent, (l) => l.acao || '');
    const suspicious = [];

    if ((byAction['Exclusão'] || byAction.Exclusao || 0) >= 5) {
      suspicious.push({
        tipo: 'Exclusoes em massa',
        severidade: 'Alta',
        detalhes: `Exclusoes recentes: ${byAction['Exclusão'] || byAction.Exclusao}`,
      });
    }

    const perfilChanges = recent.filter((l) => (
      l.entidade === 'PerfilAcesso'
      && (l.acao === 'Criação' || l.acao === 'Criacao' || l.acao === 'Edição' || l.acao === 'Edicao')
    ));
    if (perfilChanges.length >= 3) {
      suspicious.push({
        tipo: 'Mudancas frequentes de perfil',
        severidade: 'Media',
        detalhes: `${perfilChanges.length} mudancas em ${WINDOW_MIN} min`,
      });
    }

    const blocks = recent.filter((l) => l.acao === 'Bloqueio');
    if (blocks.length >= 10) {
      suspicious.push({
        tipo: 'Muitos bloqueios de acesso',
        severidade: 'Media',
        detalhes: `${blocks.length} bloqueios em ${WINDOW_MIN} min`,
      });
    }

    const rbacBlocks = recent.filter((l) => (
      l.acao === 'Bloqueio'
      && (l.tipo_auditoria === 'seguranca' || (l.descricao && /RBAC backend negou/i.test(l.descricao)))
    ));
    if (rbacBlocks.length >= 5) {
      suspicious.push({
        tipo: 'RBAC backend negacoes',
        severidade: 'Media',
        detalhes: `${rbacBlocks.length} negacoes em ${WINDOW_MIN} min`,
      });
    }

    const funcLatency = recent.filter((l) => (
      l.entidade === 'FunctionLatency' && (Number(l?.duracao_ms) || 0) > 1500
    ));
    if (funcLatency.length >= 5) {
      const max = Math.max(...funcLatency.map((l) => Number(l?.duracao_ms) || 0));
      suspicious.push({
        tipo: 'Funcoes lentas',
        severidade: max > 3000 ? 'Alta' : 'Media',
        detalhes: `${funcLatency.length} chamadas >1500ms (pico ${Math.round(max)}ms)`,
      });
    }

    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'automacao',
      usuario_id: user?.id || null,
      acao: 'Analise',
      modulo: 'Sistema',
      tipo_auditoria: 'seguranca',
      entidade: 'SecurityAlerts',
      descricao: suspicious.length
        ? `Alertas de seguranca sugeridos (${suspicious.length}) na janela de ${WINDOW_MIN} min`
        : `Analise de seguranca sem alertas (${WINDOW_MIN} min)`,
      dados_novos: {
        suspicious,
        totais: byAction,
        analisados: recent.length,
        modo: 'sugestao',
      },
      group_id: groupId,
      empresa_id: empresaId,
      data_hora: new Date().toISOString(),
    }).catch((error) => {
      console.error('[securityAlerts] Falha ao auditar analise', error?.message || error);
    });

    if (suspicious.length === 0) {
      return Response.json({
        ok: true,
        modo: 'sugestao',
        anomaly: false,
        alerts: 0,
        message: 'Sem alertas',
        analyzed: recent.length,
        group_id: groupId,
      });
    }

    let recipients = 0;
    if (confirmado) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, undefined, 100);
      const toList = (admins || []).map((u) => u.email).filter(Boolean);
      recipients = toList.length;
      const highAlerts = suspicious.filter((s) => s.severidade === 'Alta');
      if (toList.length > 0 && highAlerts.length > 0) {
        const subject = 'Alerta de Seguranca • ERP Zuccaro (Critico)';
        const body = [
          `Janela analisada: ultimos ${WINDOW_MIN} minutos`,
          '',
          ...highAlerts.map((s, i) => `${i + 1}. ${s.tipo} [${s.severidade}] - ${s.detalhes}`),
          '',
          `Total de eventos analisados: ${recent.length}`,
        ].join('\n');
        await Promise.all(toList.map((to) => sendEmail(base44, to, subject, body)));
      }
    }

    return Response.json({
      ok: true,
      modo: 'sugestao',
      anomaly: true,
      alerts: suspicious.length,
      details: suspicious,
      recipients: confirmado ? recipients : 0,
      alertar_externo: confirmado,
      group_id: groupId,
      empresa_id: empresaId,
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
