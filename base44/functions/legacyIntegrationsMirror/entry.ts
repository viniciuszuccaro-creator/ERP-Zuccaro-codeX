import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, recordMatchesGuardScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportIntegrationFailure = (operation, error, context = {}) => {
  console.error(`[legacyIntegrationsMirror] ${operation}`, { error: error?.message || String(error), ...context });
};

const providerEvent = (payload = {}) => String(payload?.event || payload?.type || payload?.status || payload?.evento || 'evento').slice(0, 80);

const buildWebhookAuditPayload = ({ provider, payload = {}, trusted = false } = {}) => ({
  provider: provider || null,
  event: providerEvent(payload),
  trusted: trusted === true,
  has_payment: Boolean(payload?.payment),
  has_charge: Boolean(payload?.charge || payload?.data?.charge),
  has_order: Boolean(payload?.order || payload?.pedido),
  items_count: Array.isArray(payload?.items) ? payload.items.length : 0,
  has_inventory_updates: Array.isArray(payload?.ajustes_estoque) || Array.isArray(payload?.inventory_updates),
  has_pricing_updates: Array.isArray(payload?.pricing_updates),
});

const buildContaReceberAuditSnapshot = (registro = {}) => ({
  id: registro?.id || null,
  empresa_id: registro?.empresa_id || null,
  group_id: registro?.group_id || registro?.grupo_id || null,
  status: registro?.status || null,
  status_cobranca: registro?.status_cobranca || null,
  valor: Number(registro?.valor || 0),
  valor_recebido: Number(registro?.valor_recebido || 0),
  data_recebimento: registro?.data_recebimento || null,
});

const buildPaymentWebhookAuditPayload = ({ provider, externalId, statusRaw, updates = {} } = {}) => ({
  provider: provider || null,
  external_id: externalId || null,
  status_cobranca: updates.status_cobranca || String(statusRaw || '').toLowerCase() || null,
  status: updates.status || null,
  valor_recebido: updates.valor_recebido ?? null,
  data_recebimento: updates.data_recebimento || null,
  data_retorno_pagamento: updates.data_retorno_pagamento || null,
  tem_detalhes_pagamento: Boolean(updates.detalhes_pagamento),
});

const resolveScopeOrReject = async (base44, input = {}, errorLabel = 'contexto_multiempresa_incompleto') => {
  const scope = await completeGuardCallScope(base44, input || {});
  if (!scope.groupId || (scope.scopeType === 'empresa' && !scope.empresaId)) {
    return { error: Response.json({ error: errorLabel }, { status: 400 }) };
  }
  return { scope };
};
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const evt = payload?.event || {};
    const data = payload?.data || null;

    // API-First genérica (app/portal/site): actions internas com RBAC/token e escopo multiempresa
    if (payload?.action && !payload?.provider) {
      const action = String(payload.action || '').toLowerCase();
      const empresa_id = payload.empresa_id || payload.company_id || null;
      const group_id = payload.group_id || payload.grupo_id || null;
      const internal_token = payload.internal_token || null;
      const trustedInternal = internal_token && Deno.env.get('DEPLOY_AUDIT_TOKEN') && internal_token === Deno.env.get('DEPLOY_AUDIT_TOKEN');

      let user = null; try { user = await base44.auth.me(); } catch { user = null; }
      if (!trustedInternal && !user) { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
      if (!empresa_id && !group_id) { return Response.json({ error: 'escopo_multiempresa_obrigatorio' }, { status: 400 }); }

      // RBAC quando houver usuário (actions sensíveis exigem executar)
      if (user) {
        const guardFailure = await requireEntityGuard(base44, {
          module: 'Integrações', section: 'API', action: 'executar', empresa_id, group_id,
        });
        if (guardFailure) return guardFailure;
      }

      if (action === 'status_pedido') {
        const pedido_id = payload.pedido_id || null;
        const numero_pedido = payload.numero_pedido || null;
        let q = { empresa_id }; if (numero_pedido) q.numero_pedido = numero_pedido; if (pedido_id) q.id = pedido_id;
        const ped = await base44.asServiceRole.entities.Pedido.filter(q, undefined, 1).then(r => r?.[0] || null);
        if (!ped) return Response.json({ ok: false, error: 'pedido_nao_encontrado' }, { status: 404 });
        const resumo = { id: ped.id, numero_pedido: ped.numero_pedido, status: ped.status, data_prevista_entrega: ped.data_prevista_entrega, cliente: ped.cliente_nome };
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: user?.full_name || 'Service', acao: 'Visualização', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: 'status_pedido', descricao: 'Consulta status pedido (API)', empresa_id, group_id, dados_novos: { pedido_id: resumo.id }, data_hora: new Date().toISOString() }); } catch (error) { reportIntegrationFailure('auditoria_status_pedido', error, { pedido_id: resumo.id }); }
        return Response.json({ ok: true, pedido: resumo });
      }

      if (action === 'cotar_aco') {
        const filtro = { empresa_id };
        const prods = await base44.asServiceRole.entities.Produto.filter(filtro, '-updated_date', 50).then(arr => (arr || []).filter(p => p.eh_bitola === true));
        const itens = prods.map(p => ({ id: p.id, descricao: p.descricao, tipo_aco: p.tipo_aco, bitola_mm: p.bitola_diametro_mm, preco_venda: p.preco_venda, estoque_disponivel: (p.estoque_disponivel ?? (p.estoque_atual - (p.estoque_reservado || 0))) }));
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: user?.full_name || 'Service', acao: 'Visualização', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: 'cotar_aco', descricao: 'Cotação via API', empresa_id, group_id, dados_novos: { itens: itens.slice(0, 5) }, data_hora: new Date().toISOString() }); } catch (error) { reportIntegrationFailure('auditoria_cotacao_aco', error); }
        return Response.json({ ok: true, itens });
      }

      return Response.json({ ok: false, error: 'action_nao_suportada' }, { status: 400 });
    }

    // Webhooks Pagamentos e Fiscal (Asaas, Juno, eNotas, NFe.io)
  if (payload?.provider && ['asaas','juno','enotas','nfe_io'].includes(String(payload.provider).toLowerCase())) {
    const prov = String(payload.provider).toLowerCase();
    const hdrToken = req.headers.get('x-internal-token') || req.headers.get('x-webhook-token') || null;
    const expected = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
    const trusted = !!(expected && hdrToken === expected);
    const empresa_id = payload.empresa_id || payload.company_id || null;
    const group_id = payload.group_id || payload.grupo_id || null;
    try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criação', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: prov, descricao: `Webhook recebido`, empresa_id, group_id, dados_novos: buildWebhookAuditPayload({ provider: prov, payload, trusted }), data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_webhook_recebido', error, { provedor: prov }); }

    if (prov === 'asaas') {
      const p = payload?.payment || payload?.data || payload || {};
      const extId = p?.id || payload?.id || null;
      if (extId) {
        const crFilter = { id_cobranca_externa: extId };
        if (empresa_id) crFilter.empresa_id = empresa_id;
        const crList = await base44.asServiceRole.entities.ContaReceber.filter(crFilter, undefined, 1);
        const cr = crList?.[0] || null;
        if (cr) {
          const { scope, error } = await resolveScopeOrReject(base44, { group_id: group_id || cr.group_id || cr.grupo_id || null, empresa_id: empresa_id || cr.empresa_id || null }, 'contexto_multiempresa_cobranca_incompleto');
          if (error) return error;
          if (!recordMatchesGuardScope(cr, { group_id: scope.groupId, empresa_id: scope.empresaId || cr.empresa_id || null })) {
            return Response.json({ error: 'cobranca_fora_do_contexto_multiempresa' }, { status: 403 });
          }
          const statusRaw = (p?.status || payload?.event || '').toString().toUpperCase();
          const pago = /RECEIVED|CONFIRMED|RECEIVED_IN_CASH|PAID/.test(statusRaw);
          const updates = {
            status_cobranca: statusRaw.toLowerCase(),
            data_retorno_pagamento: new Date().toISOString()
          };
          if (pago) {
            updates.status = 'Recebido';
            updates.valor_recebido = Number(cr.valor_recebido||0) + Number(p?.value || p?.netValue || cr.valor || 0);
            const d = (p?.confirmedDate || p?.paymentDate || '').toString().slice(0,10) || new Date().toISOString().slice(0,10);
            updates.data_recebimento = d;
            updates.detalhes_pagamento = { ...(cr.detalhes_pagamento||{}), forma_pagamento: 'Boleto/PIX', numero_autorizacao: p?.transactionReceipt || null, status_compensacao: 'Conciliado' };
          }
          const before = buildContaReceberAuditSnapshot(cr);
          await base44.asServiceRole.entities.ContaReceber.update(cr.id, updates);
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edicao', modulo: 'Financeiro', tipo_auditoria: 'integracao', entidade: 'Asaas', descricao: `Atualizacao cobranca ${extId}`, empresa_id: cr.empresa_id || scope.empresaId || null, group_id: scope.groupId, dados_anteriores: before, dados_novos: buildPaymentWebhookAuditPayload({ provider: 'Asaas', externalId: extId, statusRaw, updates }), data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_asaas', error, { external_id: extId }); }
        }
      }
      return Response.json({ ok: true, action: 'asaas_webhook_processed' });
    }

    if (prov === 'juno') {
      const ch = payload?.data?.charge || payload?.charge || payload || {};
      const extId = ch?.id || payload?.id || null;
      if (extId) {
        const crFilter = { id_cobranca_externa: extId };
        if (empresa_id) crFilter.empresa_id = empresa_id;
        const crList = await base44.asServiceRole.entities.ContaReceber.filter(crFilter, undefined, 1);
        const cr = crList?.[0] || null;
        if (cr) {
          const { scope, error } = await resolveScopeOrReject(base44, { group_id: group_id || cr.group_id || cr.grupo_id || null, empresa_id: empresa_id || cr.empresa_id || null }, 'contexto_multiempresa_cobranca_incompleto');
          if (error) return error;
          if (!recordMatchesGuardScope(cr, { group_id: scope.groupId, empresa_id: scope.empresaId || cr.empresa_id || null })) {
            return Response.json({ error: 'cobranca_fora_do_contexto_multiempresa' }, { status: 403 });
          }
          const statusRaw = (ch?.status || payload?.event || '').toString().toUpperCase();
          const pago = /PAID|CONFIRMED|COMPLETED/.test(statusRaw);
          const updates = {
            status_cobranca: statusRaw.toLowerCase(),
            data_retorno_pagamento: new Date().toISOString()
          };
          if (pago) {
            updates.status = 'Recebido';
            updates.valor_recebido = Number(cr.valor_recebido||0) + Number(ch?.amount || cr.valor || 0);
            const d = (ch?.date || '').toString().slice(0,10) || new Date().toISOString().slice(0,10);
            updates.data_recebimento = d;
            updates.detalhes_pagamento = { ...(cr.detalhes_pagamento||{}), forma_pagamento: 'Boleto', status_compensacao: 'Conciliado' };
          }
          const before = buildContaReceberAuditSnapshot(cr);
          await base44.asServiceRole.entities.ContaReceber.update(cr.id, updates);
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edicao', modulo: 'Financeiro', tipo_auditoria: 'integracao', entidade: 'Juno', descricao: `Atualizacao cobranca ${extId}`, empresa_id: cr.empresa_id || scope.empresaId || null, group_id: scope.groupId, dados_anteriores: before, dados_novos: buildPaymentWebhookAuditPayload({ provider: 'Juno', externalId: extId, statusRaw, updates }), data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_juno', error, { external_id: extId }); }
        }
      }
      return Response.json({ ok: true, action: 'juno_webhook_processed' });
    }

    if (prov === 'enotas' || prov === 'nfe_io') {
      const nfId = payload?.nfeId || payload?.id || payload?.nota_id || null;
      const status = (payload?.status || payload?.evento || '').toString();
      if (nfId) {
        let nf = null;
        try { nf = await base44.asServiceRole.entities.NotaFiscal.get(nfId); } catch (error) { reportIntegrationFailure('consulta_nfe_webhook', error, { nota_fiscal_id: nfId }); }
        const { scope, error } = await resolveScopeOrReject(base44, { group_id: group_id || nf?.group_id || nf?.grupo_id || null, empresa_id: empresa_id || nf?.empresa_id || null }, 'contexto_multiempresa_nfe_incompleto');
        if (error) return error;
        if (nf && !recordMatchesGuardScope(nf, { group_id: scope.groupId, empresa_id: scope.empresaId || nf.empresa_id || null })) {
          return Response.json({ error: 'nota_fiscal_fora_do_contexto_multiempresa' }, { status: 403 });
        }
        const map = { autorizada: 'Autorizada', autorizadauso: 'Autorizada', cancelada: 'Cancelada', denegada: 'Denegada', rejeitada: 'Rejeitada' };
        const statusKey = status.toLowerCase().replace(/\s/g,'');
        const nfStatus = map[statusKey] || status;
        const nfUpdates = { status: nfStatus, mensagem_sefaz: payload?.mensagem || null, codigo_status_sefaz: String(payload?.codigo || payload?.statusCode || ''), xml_nfe: payload?.xmlUrl || payload?.xml || null, pdf_danfe: payload?.pdfUrl || payload?.danfeUrl || null, chave_acesso: payload?.chave || payload?.chaveAcesso || null };
        await base44.asServiceRole.entities.NotaFiscal.update(nfId, nfUpdates);
        if (/autorizad/i.test(nfStatus)) {
          try { await base44.asServiceRole.functions.invoke('onNotaFiscalAuthorized', { nota_fiscal_id: nfId, empresa_id: scope.empresaId || empresa_id || nf?.empresa_id || null, group_id: scope.groupId }); } catch (error) { reportIntegrationFailure('pos_autorizacao_nfe', error, { nota_fiscal_id: nfId }); }
        }
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edicao', modulo: 'Fiscal', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualizacao NF-e ${nfId}`, empresa_id: scope.empresaId || empresa_id || nf?.empresa_id || null, group_id: scope.groupId, dados_anteriores: nf ? { id: nf.id, empresa_id: nf.empresa_id || null, group_id: nf.group_id || nf.grupo_id || null, status: nf.status || null, codigo_status_sefaz: nf.codigo_status_sefaz || null } : null, dados_novos: { status: nfStatus, codigo_status_sefaz: nfUpdates.codigo_status_sefaz, tem_xml: Boolean(nfUpdates.xml_nfe), tem_pdf: Boolean(nfUpdates.pdf_danfe), tem_chave_acesso: Boolean(nfUpdates.chave_acesso) }, data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_nfe', error, { nota_fiscal_id: nfId }); }
      }
      return Response.json({ ok: true, action: 'nfe_webhook_processed' });
    }
  }

  // Webhooks Marketplaces (Mercado Livre, Amazon, Shopee, Magalu, etc.)
    if (payload?.provider) {
      const rawProv = String(payload.provider).toLowerCase();
      const prov = ({
        'meli': 'mercado_livre', 'mercadolivre': 'mercado_livre', 'ml': 'mercado_livre',
        'magazineluiza': 'magalu', 'magazine_luiza': 'magalu',
      }[rawProv]) || rawProv;

      if (['mercado_livre','amazon','shopee','magalu','ecommerce_site'].includes(prov)) {
        const empresa_id = payload.empresa_id || payload.company_id || null;
        const group_id = payload.group_id || payload.grupo_id || null;

        // Token/assinatura obrigatória (Zero Trust)
        const hdrToken = req.headers.get('x-internal-token') || req.headers.get('x-webhook-token') || null;
        const expected = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
        const trusted = !!(expected && hdrToken === expected);
        if (!trusted) {
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Bloqueio', modulo: 'Integrações', tipo_auditoria: 'seguranca', entidade: prov, descricao: 'Token inválido no webhook', dados_novos: { headers: { hasToken: !!hdrToken } }, data_hora: new Date().toISOString(), sucesso: false }); } catch (error) { reportIntegrationFailure('auditoria_token_invalido', error, { provedor: prov }); }
          return Response.json({ error: 'unauthorized_webhook' }, { status: 401 });
        }

        if (!empresa_id) { return Response.json({ error: 'empresa_id_obrigatorio' }, { status: 400 }); }
        const { scope: marketplaceScope, error: marketplaceScopeError } = await resolveScopeOrReject(base44, { empresa_id, group_id }, 'contexto_multiempresa_marketplace_incompleto');
        if (marketplaceScopeError) return marketplaceScopeError;
        const scopedGroupId = marketplaceScope.groupId;

        const clean = (v) => {
          if (typeof v === 'string') return v.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,'').replace(/on[a-z]+\s*=\s*(["']).*?\1/gi,'').replace(/javascript:\s*/gi,'').slice(0, 4000);
          return v;
        };
        const safeNum = (n, d=0) => { const x = Number(n); return isFinite(x) ? x : d; };

        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criacao', modulo: 'Integracoes', tipo_auditoria: 'integracao', entidade: prov, descricao: `Webhook recebido: ${providerEvent(payload)}`, empresa_id, group_id: scopedGroupId, dados_novos: buildWebhookAuditPayload({ provider: prov, payload, trusted }), data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_evento', error, { provedor: prov }); }

        // 1) Pedido (order) - upsert por origem_externa_id
        const order = payload.order || payload.pedido || null;
        let pedidoResult = null;
        if (order) {
          const extId = String(order.id || order.order_id || order.code || order.external_id || '').trim();
          if (extId) {
            const numero = String(order.number || order.code || extId).slice(0,50);
            const statusRaw = String(order.status || '').toLowerCase();
            const statusMap = { paid: 'Aprovado', approved: 'Aprovado', canceled: 'Cancelado', shipped: 'Em Expedição', delivered: 'Entregue', pending: 'Aguardando Aprovação' };
            const status = statusMap[statusRaw] || 'Rascunho';
            const total = safeNum(order.total_amount || order.total || order.amount || 0);
            const cliente = clean(order.buyer_name || order.customer_name || 'Cliente Marketplace');
            const data_pedido = (order.date || order.created_at || new Date().toISOString()).toString().slice(0,10);

            const found = await base44.asServiceRole.entities.Pedido.filter({ empresa_id, origem_pedido: 'Marketplace', origem_externa_id: extId }, undefined, 1).then(r=>r?.[0]||null);
            if (found) {
              if (!recordMatchesGuardScope(found, { group_id: scopedGroupId, empresa_id })) {
                return Response.json({ error: 'pedido_fora_do_contexto_multiempresa' }, { status: 403 });
              }
              await base44.asServiceRole.entities.Pedido.update(found.id, { status, valor_total: total });
              pedidoResult = { action: 'update', id: found.id };
            } else {
              const novo = await base44.asServiceRole.entities.Pedido.create({
                numero_pedido: numero,
                cliente_nome: cliente,
                data_pedido,
                valor_total: total,
                empresa_id, group_id: scopedGroupId,
                origem_pedido: 'Marketplace',
                origem_externa_id: extId,
                tipo: 'Pedido'
              });
              pedidoResult = { action: 'create', id: novo.id };
            }
            try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: pedidoResult.action === 'create' ? 'Criacao' : 'Edicao', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: prov, descricao: `Sync pedido ${extId}`, empresa_id, group_id: scopedGroupId, dados_novos: { pedidoResult, external_id: extId, status, valor_total: total }, data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_sync_pedido', error, { external_id: extId }); }
          }
        }

        // 2) Estoque (inventory)
        const inv = payload.ajustes_estoque || payload.inventory_updates || (Array.isArray(payload.items) ? payload.items.map(it=>({ produto_id: it.produto_id, codigo: it.sku || it.codigo, quantidade: it.quantity ?? it.qty })) : null);
        let invCount = 0;
        if (Array.isArray(inv)) {
          for (const it of inv) {
            const pid = it.produto_id || null;
            const codigo = it.codigo || it.sku || null;
            const qtd = safeNum(it.quantidade ?? it.quantity, null);
            if (pid || codigo) {
              try {
                let target = null;
                if (pid) target = await base44.asServiceRole.entities.Produto.filter({ id: pid, empresa_id }, undefined, 1).then(r=>r?.[0]||null);
                if (!target && codigo) target = await base44.asServiceRole.entities.Produto.filter({ codigo, empresa_id }, undefined, 1).then(r=>r?.[0]||null);
                if (target && qtd != null) {
                  if (!recordMatchesGuardScope(target, { group_id: scopedGroupId, empresa_id })) { continue; }
                  await base44.asServiceRole.entities.Produto.update(target.id, { estoque_atual: qtd });
                  invCount++;
                }
              } catch (error) { reportIntegrationFailure('sync_estoque_item', error, { codigo }); }
            }
          }
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edicao', modulo: 'Estoque', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualizacao de estoque (${invCount})`, empresa_id, group_id: scopedGroupId, dados_novos: { invCount }, data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_sync_estoque', error, { quantidade: invCount }); }
        }

        // 3) Preços (pricing)
        const pricing = payload.pricing_updates || (Array.isArray(payload.items) ? payload.items.map(it=>({ produto_id: it.produto_id, codigo: it.sku || it.codigo, preco_venda: it.price })) : null);
        let priceCount = 0;
        if (Array.isArray(pricing)) {
          for (const upd of pricing) {
            const pid = upd.produto_id || null;
            const codigo = upd.codigo || upd.sku || null;
            const patch = {};
            if (upd.preco_venda != null) patch.preco_venda = safeNum(upd.preco_venda, null);
            if (upd.custo_medio != null) patch.custo_medio = safeNum(upd.custo_medio, null);
            if (Object.keys(patch).length) {
              try {
                let target = null;
                if (pid) target = await base44.asServiceRole.entities.Produto.filter({ id: pid, empresa_id }, undefined, 1).then(r=>r?.[0]||null);
                if (!target && codigo) target = await base44.asServiceRole.entities.Produto.filter({ codigo, empresa_id }, undefined, 1).then(r=>r?.[0]||null);
                if (target && recordMatchesGuardScope(target, { group_id: scopedGroupId, empresa_id })) { await base44.asServiceRole.entities.Produto.update(target.id, patch); priceCount++; }
              } catch (error) { reportIntegrationFailure('sync_preco_item', error, { codigo }); }
            }
          }
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edicao', modulo: 'Integracoes', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualizacao de precos (${priceCount})`, empresa_id, group_id: scopedGroupId, dados_novos: { priceCount }, data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_sync_precos', error, { quantidade: priceCount }); }
        }

        return Response.json({ ok: true, action: 'marketplace_webhook_processed', provider: prov, results: { pedido: pedidoResult, invCount, priceCount } });
      }
    }

    if (!evt?.entity_name) {
      return Response.json({ ok: true, skipped: true });
    }

    // Alerta de Estoque Baixo via WhatsApp (Produto atualizado)
    if (evt.entity_name === 'Produto' && evt.type === 'update' && data) {
      const empresaId = data.empresa_id || null;
      const groupId = data.group_id || data.grupo_id || null;
      const disp = Number(data.estoque_disponivel || data.estoque_atual || 0);
      const minimo = Number(data.estoque_minimo || 0);
      if (empresaId && minimo > 0 && disp <= minimo) {
        const internal_token = Deno.env.get('DEPLOY_AUDIT_TOKEN') || '';
        const vars = { produto: data.descricao || data.codigo || data.id, disponivel: disp, minimo };
        try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId, groupId, templateKey: 'estoque_baixo', vars, internal_token }); } catch (error) { reportIntegrationFailure('alerta_estoque_baixo', error, { produto_id: data.id }); }
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criação', modulo: 'Estoque', tipo_auditoria: 'integracao', entidade: 'WhatsApp', descricao: 'Alerta de estoque baixo enviado', empresa_id: empresaId, group_id: groupId, dados_novos: { produto_id: data.id, descricao: data.descricao, disponivel: disp, minimo }, data_hora: new Date().toISOString(), sucesso: true }); } catch (error) { reportIntegrationFailure('auditoria_alerta_estoque', error, { produto_id: data.id }); }
      }
    }

    const map = {
      'ConfiguracaoNFe': 'integracao_nfe',
      'ConfiguracaoBoletos': 'integracao_boletos',
      'ConfiguracaoWhatsApp': 'integracao_whatsapp'
    };

    const keyName = map[evt.entity_name];
    if (!keyName) return Response.json({ ok: true, skipped: true });

    if (evt.type === 'delete') {
      // Preserve; we don't remove from ConfiguracaoSistema automatically
      return Response.json({ ok: true, action: 'ignored_delete' });
    }

    if (!data) return Response.json({ ok: false, error: 'No data' }, { status: 400 });

    const empresaId = data.empresa_id || null;
    const groupId = data.group_id || data.grupo_id || null;
    const { scope: configScope, error: configScopeError } = await resolveScopeOrReject(base44, { empresa_id: empresaId, group_id: groupId }, 'contexto_multiempresa_configuracao_incompleto');
    if (configScopeError) return configScopeError;

    const chave = configScope.empresaId ? `integracoes_${configScope.empresaId}` : `integracoes_group_${configScope.groupId}`;
    const filtroConfig = configScope.empresaId
      ? { chave, categoria: 'Integracoes', empresa_id: configScope.empresaId }
      : { chave, categoria: 'Integracoes', group_id: configScope.groupId };

    const existentes = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(filtroConfig, undefined, 1);

    const payloadCfg = {
      chave,
      categoria: 'Integracoes',
      empresa_id: configScope.empresaId || null,
      group_id: configScope.groupId,
      [keyName]: data
    };

    if (existentes && existentes.length > 0) {
      await base44.asServiceRole.entities.ConfiguracaoSistema.update(existentes[0].id, payloadCfg);
      return Response.json({ ok: true, action: 'update', keyName });
    } else {
      await base44.asServiceRole.entities.ConfiguracaoSistema.create(payloadCfg);
      return Response.json({ ok: true, action: 'create', keyName });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
