import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportReadyToInvoiceFailure = (operation, error, context = {}) => {
  console.error('[onPedidoReadyToInvoice] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

function buildWebhookAuditPayload(pedido = {}) {
  return {
    pedido_id: pedido?.id || null,
    numero_pedido: pedido?.numero_pedido || null,
    status: pedido?.status || null,
    empresa_id: pedido?.empresa_id || null,
    group_id: pedido?.group_id || pedido?.grupo_id || null,
    webhook_configurado: true,
  };
}

function summarizeNfeItems(itens = []) {
  const list = Array.isArray(itens) ? itens : [];
  return {
    quantidade_itens: list.length,
    produtos_ids: list.map((item) => item?.produto_id).filter(Boolean).slice(0, 50),
    quantidade_total: list.reduce((total, item) => total + Number(item?.quantidade || 0), 0),
  };
}

function buildAutoNfeAuditPayload({ pedido = {}, nfe = {}, retorno = null } = {}) {
  return {
    pedido_id: pedido?.id || nfe?.pedido_id || null,
    numero_pedido: pedido?.numero_pedido || nfe?.numero_pedido || null,
    cliente_id: pedido?.cliente_id || nfe?.cliente_fornecedor_id || null,
    empresa_id: nfe?.empresa_faturamento_id || pedido?.empresa_id || null,
    group_id: nfe?.group_id || pedido?.group_id || pedido?.grupo_id || null,
    valor_total: Number(nfe?.valor_total || 0),
    status_nfe: retorno?.status || nfe?.status || null,
    nfe_id: retorno?.id || retorno?.data?.id || null,
    modo: retorno?.modo || retorno?.data?.modo || null,
    tem_danfe: Boolean(retorno?.danfeUrl || retorno?.pdf_danfe || retorno?.data?.danfeUrl || retorno?.data?.pdf_danfe),
    tem_xml: Boolean(retorno?.xmlUrl || retorno?.xml_nfe || retorno?.data?.xmlUrl || retorno?.data?.xml_nfe),
    ...summarizeNfeItems(nfe?.itens),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { data, old_data } = body || {};
    if (!data) return Response.json({ ok: true, skipped: true, reason: 'no data' });

    const ficouPronto = data?.status === 'Pronto para Faturar' && old_data?.status !== 'Pronto para Faturar';
    const ficouAprovado = data?.status === 'Aprovado' && old_data?.status !== 'Aprovado';
    if (!(ficouPronto || ficouAprovado)) return Response.json({ ok: true, skipped: true });

    const empresaId = data?.empresa_id || null;
    let groupId = data?.group_id || data?.grupo_id || null;
    if (!empresaId) return Response.json({ error: 'Empresa nao definida no pedido' }, { status: 400 });

    const resolvedScope = await completeGuardCallScope(base44, { empresa_id: empresaId, group_id: groupId });
    groupId = groupId || resolvedScope.groupId || null;
    if (!groupId) return Response.json({ error: 'Grupo nao definido no pedido' }, { status: 400 });

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Fiscal', section: 'NF-e', action: 'criar', empresa_id: empresaId, group_id: groupId,
    });
    if (guardFailure) return guardFailure;

    try {
      let cfg = null;
      if (empresaId) {
        const c = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${empresaId}`, empresa_id: empresaId }, undefined, 1);
        cfg = c?.[0]?.erp || c?.[0]?.integracao_erp || null;
      }
      if (!cfg && groupId) {
        const cg = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_group_${groupId}`, group_id: groupId }, undefined, 1);
        cfg = cg?.[0]?.erp || cg?.[0]?.integracao_erp || null;
      }
      if (cfg?.webhook_url) {
        await fetch(cfg.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
          body: JSON.stringify({
            tipo: 'pedido_status',
            status: data?.status,
            pedido_id: data?.id,
            numero_pedido: data?.numero_pedido,
            empresa_id: empresaId,
            group_id: groupId,
          }),
        }).catch((error) => {
          reportReadyToInvoiceFailure('Falha ao disparar webhook ERP', error, { pedido_id: data?.id, empresa_id: empresaId, group_id: groupId });
          return null;
        });
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            usuario: user?.full_name || user?.email || 'Usuario', usuario_id: user?.id,
            acao: 'Execucao', modulo: 'Integracoes', tipo_auditoria: 'integracao', entidade: 'ERP',
            descricao: 'Webhook disparado (Pedido para ERP)', empresa_id: empresaId, group_id: groupId,
            dados_novos: buildWebhookAuditPayload(data),
          });
        } catch (error) {
          reportReadyToInvoiceFailure('Falha ao auditar webhook ERP', error, { pedido_id: data?.id, empresa_id: empresaId, group_id: groupId });
        }
      }
    } catch (error) {
      reportReadyToInvoiceFailure('Falha ao preparar webhook ERP', error, { pedido_id: data?.id, empresa_id: empresaId, group_id: groupId });
    }

    const itens = [];
    const pushFrom = (arr, unidadeFallback) => (Array.isArray(arr) ? arr : []).forEach((it) => itens.push({
      produto_id: it.produto_id,
      codigo_produto: it.codigo_sku,
      descricao: it.produto_descricao || it.descricao,
      ncm: it.ncm || undefined,
      cfop: data?.cfop_pedido || undefined,
      unidade: it.unidade || unidadeFallback || 'UN',
      quantidade: Number(it.quantidade || 0),
      valor_unitario: Number(it.preco_unitario || it.valor_unitario || 0),
      valor_total: Number(it.valor_total || 0),
    }));
    pushFrom(data?.itens_revenda, 'UN');
    pushFrom(data?.itens_armado_padrao, 'UN');
    pushFrom(data?.itens_corte_dobra, 'UN');

    const nfe = {
      numero_pedido: data.numero_pedido,
      pedido_id: data.id,
      cliente_fornecedor: data.cliente_nome,
      cliente_fornecedor_id: data.cliente_id,
      data_emissao: new Date().toISOString().slice(0, 10),
      valor_total: data.valor_total || 0,
      empresa_faturamento_id: empresaId,
      empresa_atendimento_id: empresaId,
      empresa_origem_id: empresaId,
      group_id: groupId || null,
      itens,
      natureza_operacao: data.natureza_operacao || 'Venda de Mercadorias',
      cfop: data.cfop_pedido || '5102',
      status: 'Rascunho',
    };

    const res = await base44.asServiceRole.functions.invoke('nfeActions', { action: 'emitir', nfe, empresaId, groupId });

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuario', usuario_id: user?.id,
        acao: 'Criacao', modulo: 'Fiscal', tipo_auditoria: 'entidade', entidade: 'NotaFiscal',
        registro_id: res?.data?.id || null,
        descricao: `NF-e disparada automaticamente a partir do Pedido ${data.numero_pedido}`,
        empresa_id: empresaId, group_id: groupId,
        dados_novos: buildAutoNfeAuditPayload({ pedido: data, nfe, retorno: res?.data }),
      });
    } catch (error) {
      reportReadyToInvoiceFailure('Falha ao auditar NF-e automatica', error, { pedido_id: data?.id, empresa_id: empresaId, group_id: groupId });
    }

    return Response.json({ ok: true, retorno: res?.data || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
