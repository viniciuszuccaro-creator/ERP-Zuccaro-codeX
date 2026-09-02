import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission, audit, ensureContextFields } from './_lib/guard.js';

function buildPedidoFromOrcamentoAuditPayload(pedido = {}, origem = {}) {
  return {
    pedido_id: pedido?.id || null,
    orcamento_id: origem?.id || pedido?.orcamento_id || null,
    numero_pedido: pedido?.numero_pedido || null,
    cliente_id: pedido?.cliente_id || null,
    empresa_id: pedido?.empresa_id || null,
    group_id: pedido?.group_id || pedido?.grupo_id || null,
    origem_pedido: pedido?.origem_pedido || null,
    status: pedido?.status || null,
    valor_total: Number(pedido?.valor_total || 0),
    quantidade_itens: ['itens', 'itens_revenda', 'itens_armado_padrao', 'itens_corte_dobra']
      .reduce((total, key) => total + (Array.isArray(pedido?.[key]) ? pedido[key].length : 0), 0),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ctx = await getUserAndPerfil(base44);
    const user = ctx.user;
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { event, data } = body || {};
    if (!event?.type || !data) return Response.json({ error: 'Invalid payload' }, { status: 400 });

    const confirmado = data?.status === 'Confirmado' || data?.aprovado === true || data?.confirmado === true;
    if (!confirmado) return Response.json({ ok: true, skipped: true });

    const scopedData = await ensureContextFields(base44, data, true);
    if (scopedData instanceof Response) return scopedData;
    Object.assign(data, scopedData);

    const perm = await assertPermission(base44, ctx, 'Comercial', 'Pedido', 'criar');
    if (perm) return perm;

    const pedidoPayload = {
      tipo: 'Pedido',
      origem_pedido: data?.origem || 'Manual',
      cliente_id: data?.cliente_id || null,
      cliente_nome: data?.cliente_nome || data?.cliente || null,
      valor_total: data?.valor_total || 0,
      data_pedido: new Date().toISOString().slice(0, 10),
      status: 'Aguardando Aprova\u00e7\u00e3o',
      orcamento_id: data?.id,
      group_id: data?.group_id || null,
      empresa_id: data?.empresa_id || null,
      vendedor: user?.full_name || user?.email || 'Usuario',
      vendedor_id: user?.id,
    };

    ['itens', 'itens_revenda', 'itens_armado_padrao', 'itens_corte_dobra'].forEach((key) => {
      if (Array.isArray(data?.[key]) && data[key].length > 0) {
        pedidoPayload[key] = data[key];
      }
    });

    const created = await base44.asServiceRole.entities.Pedido.create(pedidoPayload);

    await audit(base44, user, {
      acao: 'Criacao',
      modulo: 'Comercial',
      entidade: 'Pedido',
      registro_id: created?.id,
      descricao: 'Pedido gerado automaticamente a partir do Orcamento confirmado',
      empresa_id: pedidoPayload.empresa_id || null,
      group_id: pedidoPayload.group_id || null,
      dados_novos: buildPedidoFromOrcamentoAuditPayload(created, pedidoPayload),
    });

    return Response.json({ ok: true, pedido_id: created?.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});