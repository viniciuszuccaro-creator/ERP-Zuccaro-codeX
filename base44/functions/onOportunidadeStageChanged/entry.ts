import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission, audit, ensureContextFields } from './_lib/guard.js';

function buildOrcamentoFromOportunidadeAuditPayload(orcamento = {}, origem = {}) {
  return {
    orcamento_id: orcamento?.id || null,
    oportunidade_id: origem?.id || orcamento?.oportunidade_id || null,
    cliente_id: orcamento?.cliente_id || null,
    empresa_id: orcamento?.empresa_id || null,
    group_id: orcamento?.group_id || orcamento?.grupo_id || null,
    origem: orcamento?.origem || null,
    status: orcamento?.status || null,
    etapa_origem: origem?.etapa || null,
    valor_total_estimado: Number(orcamento?.valor_total_estimado || 0),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ctx = await getUserAndPerfil(base44);
    const user = ctx.user;
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event, data, old_data } = body || {};
    if (!event || !data) return Response.json({ ok: true, skipped: true });

    const mudouEtapa = data?.etapa && data?.etapa !== old_data?.etapa;
    const etapaAlvo = ['Proposta', 'Qualifica\u00e7\u00e3o', 'Qualificacao', 'Contato Inicial'];
    if (!mudouEtapa || !etapaAlvo.includes(data.etapa)) {
      return Response.json({ ok: true, skipped: true });
    }

    const scopedData = await ensureContextFields(base44, data, true);
    if (scopedData instanceof Response) return scopedData;
    Object.assign(data, scopedData);

    const perm = await assertPermission(base44, ctx, 'Comercial', 'OrcamentoCliente', 'criar');
    if (perm) return perm;

    const orcPayload = {
      cliente_id: data?.cliente_id || null,
      cliente_nome: data?.cliente_nome || data?.cliente || '',
      descricao: data?.titulo || 'Orcamento gerado a partir da Oportunidade',
      origem: 'CRM',
      valor_total_estimado: data?.valor_estimado || 0,
      data_abertura: new Date().toISOString().slice(0, 10),
      status: 'Aberto',
      responsavel: data?.responsavel || user?.full_name || user?.email,
      responsavel_id: data?.responsavel_id || user?.id,
      group_id: data?.group_id || null,
      empresa_id: data?.empresa_id || null,
      oportunidade_id: data?.id,
    };

    const created = await base44.asServiceRole.entities.OrcamentoCliente.create(orcPayload);

    await audit(base44, user, {
      acao: 'Criacao',
      modulo: 'Comercial',
      entidade: 'OrcamentoCliente',
      registro_id: created?.id,
      descricao: 'Orcamento criado automaticamente ao avancar a Oportunidade',
      empresa_id: orcPayload.empresa_id || null,
      group_id: orcPayload.group_id || null,
      dados_novos: buildOrcamentoFromOportunidadeAuditPayload(created, orcPayload),
    });

    return Response.json({ ok: true, orcamento_id: created?.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});