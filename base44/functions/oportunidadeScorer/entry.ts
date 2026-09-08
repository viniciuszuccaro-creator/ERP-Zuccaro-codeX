import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    let payload;
    try { payload = await req.json(); } catch { payload = {}; }

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getUserAndPerfil(base44);
    const permCrm = await assertPermission(base44, ctx, 'CRM', null, 'editar');
    const permComercial = permCrm
      ? await assertPermission(base44, ctx, 'Comercial', null, 'editar')
      : null;
    if (permCrm && permComercial) {
      return permCrm;
    }

    const event = payload?.event || null;
    const entityId = event?.entity_id || payload?.oportunidade_id;
    if (!entityId) {
      return Response.json({ error: 'oportunidade_id obrigatorio' }, { status: 400 });
    }

    const simulate = payload?.simulate === true;
    const confirmado = payload?.confirmado === true;
    if (!simulate && !confirmado) {
      return Response.json({ error: 'Acao critica do agente exige confirmacao humana.' }, { status: 403 });
    }

    const opp = payload?.data || await base44.asServiceRole.entities.Oportunidade.get(entityId);
    const groupId = payload?.group_id || opp?.group_id || opp?.grupo_id || user.grupo_atual_id || null;
    const empresaId = payload?.empresa_id || opp?.empresa_id || user.empresa_atual_id || null;

    const prompt = `Calcule score (0-100) e temperatura (Frio/Morno/Quente) para a oportunidade abaixo. Responda JSON.\nDados: ${JSON.stringify({
      valor_estimado: opp?.valor_estimado,
      probabilidade: opp?.probabilidade,
      dias_sem_contato: opp?.dias_sem_contato,
      etapa: opp?.etapa,
      historico_interacoes: opp?.quantidade_interacoes,
      data_previsao: opp?.data_previsao,
      cliente: opp?.cliente_nome,
    })}`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      group_id: groupId,
      empresa_id: empresaId,
      agente: 'comercial',
      tipo_ia: 'oportunidade_scorer',
      response_json_schema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          temperatura: { type: 'string' },
          proxima_acao: { type: 'string' },
        },
      },
    });

    const patch = {};
    if (typeof res?.score === 'number') patch.score = Math.max(0, Math.min(100, Math.round(res.score)));
    if (typeof res?.temperatura === 'string') patch.temperatura = res.temperatura;
    if (res?.proxima_acao) {
      patch.proxima_acao = res.proxima_acao;
      patch.data_proxima_acao = patch.data_proxima_acao || new Date().toISOString();
    }

    if (simulate || !confirmado) {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario',
        usuario_id: user?.id || null,
        acao: 'Analise',
        modulo: 'CRM',
        entidade: 'Oportunidade',
        registro_id: entityId,
        descricao: 'Score/Temperatura sugeridos por agente Comercial sem gravacao',
        dados_novos: patch,
        group_id: groupId,
        empresa_id: empresaId,
        duracao_ms: Date.now() - t0,
        data_hora: new Date().toISOString(),
      }).catch(() => null);
      return Response.json({ success: true, modo: 'sugestao', suggested: patch });
    }

    if (Object.keys(patch).length) {
      await base44.asServiceRole.entities.Oportunidade.update(entityId, patch);
    }

    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Usuario',
      usuario_id: user?.id || null,
      acao: 'Edicao',
      modulo: 'CRM',
      entidade: 'Oportunidade',
      registro_id: entityId,
      descricao: 'Score/Temperatura atualizados por agente Comercial apos confirmacao',
      dados_novos: patch,
      group_id: groupId,
      empresa_id: empresaId,
      duracao_ms: Date.now() - t0,
      data_hora: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ success: true, modo: 'confirmado', updated: patch });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
