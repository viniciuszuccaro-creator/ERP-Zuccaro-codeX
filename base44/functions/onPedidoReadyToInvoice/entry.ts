import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event, data, old_data } = body || {};
    if (!data) return Response.json({ ok: true, skipped: true, reason: 'no data' });

    const ficouPronto = data?.status === 'Pronto para Faturar' && old_data?.status !== 'Pronto para Faturar';
    const ficouAprovado = data?.status === 'Aprovado' && old_data?.status !== 'Aprovado';
    if (!(ficouPronto || ficouAprovado)) return Response.json({ ok: true, skipped: true });

    const empresaId = data?.empresa_id || null;
    const groupId = data?.group_id || null;
    if (!empresaId) return Response.json({ error: 'Empresa não definida no pedido' }, { status: 400 });

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Fiscal', section: 'NF-e', action: 'criar', empresa_id: empresaId, group_id: groupId,
    });
    if (guardFailure) return guardFailure;

    // Dispara webhook ERP (se configurado) antes da emissão
    try {
      let cfg = null;
      if (empresaId) {
        const c = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${empresaId}` }, undefined, 1);
        cfg = c?.[0]?.erp || c?.[0]?.integracao_erp || null;
      }
      if (!cfg && groupId) {
        const cg = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_group_${groupId}` }, undefined, 1);
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
          })
        }).catch(() => null);
        try { await base44.asServiceRole.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuário', usuario_id: user?.id,
          acao: 'Execução', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: 'ERP',
          descricao: 'Webhook disparado (Pedido→ERP)', empresa_id: empresaId, group_id: groupId,
          dados_novos: { pedido: data?.id, status: data?.status }
        }); } catch {}
      }
    } catch (_) {}

    // Monta itens para NF
    const itens = [];
    const pushFrom = (arr, unidadeFallback) => (Array.isArray(arr) ? arr : []).forEach(it => itens.push({
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
      data_emissao: new Date().toISOString().slice(0,10),
      valor_total: data.valor_total || 0,
      empresa_faturamento_id: empresaId,
      empresa_atendimento_id: empresaId,
      empresa_origem_id: empresaId,
      group_id: groupId || null,
      itens,
      natureza_operacao: data.natureza_operacao || 'Venda de Mercadorias',
      cfop: data.cfop_pedido || '5102',
      status: 'Rascunho'
    };

    // Emissão (simulado quando não configurado)
    const res = await base44.asServiceRole.functions.invoke('nfeActions', { action: 'emitir', nfe, empresaId });

    // Auditoria
    try { await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Usuário', usuario_id: user?.id,
      acao: 'Criação', modulo: 'Fiscal', tipo_auditoria: 'entidade', entidade: 'NotaFiscal',
      registro_id: res?.data?.id || null,
      descricao: `NF-e disparada automaticamente a partir do Pedido ${data.numero_pedido}`,
      empresa_id: empresaId, group_id: groupId,
      dados_novos: { nfe, retorno: res?.data }
    }); } catch {}

    return Response.json({ ok: true, retorno: res?.data || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
