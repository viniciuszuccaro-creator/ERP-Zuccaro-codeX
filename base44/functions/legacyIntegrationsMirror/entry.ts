import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

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
      const group_id = payload.group_id || null;
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
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: user?.full_name || 'Service', acao: 'Visualização', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: 'status_pedido', descricao: 'Consulta status pedido (API)', empresa_id, group_id, dados_novos: { pedido_id: resumo.id }, data_hora: new Date().toISOString() }); } catch {}
        return Response.json({ ok: true, pedido: resumo });
      }

      if (action === 'cotar_aco') {
        const filtro = { empresa_id };
        const prods = await base44.asServiceRole.entities.Produto.filter(filtro, '-updated_date', 50).then(arr => (arr || []).filter(p => p.eh_bitola === true));
        const itens = prods.map(p => ({ id: p.id, descricao: p.descricao, tipo_aco: p.tipo_aco, bitola_mm: p.bitola_diametro_mm, preco_venda: p.preco_venda, estoque_disponivel: (p.estoque_disponivel ?? (p.estoque_atual - (p.estoque_reservado || 0))) }));
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: user?.full_name || 'Service', acao: 'Visualização', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: 'cotar_aco', descricao: 'Cotação via API', empresa_id, group_id, dados_novos: { itens: itens.slice(0, 5) }, data_hora: new Date().toISOString() }); } catch {}
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
    const group_id = payload.group_id || null;
    try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criação', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: prov, descricao: `Webhook recebido`, empresa_id, group_id, dados_novos: { payload, trusted }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}

    if (prov === 'asaas') {
      const p = payload?.payment || payload?.data || payload || {};
      const extId = p?.id || payload?.id || null;
      if (extId) {
        const crList = await base44.asServiceRole.entities.ContaReceber.filter({ id_cobranca_externa: extId }, undefined, 1);
        const cr = crList?.[0] || null;
        if (cr) {
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
          await base44.asServiceRole.entities.ContaReceber.update(cr.id, updates);
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edição', modulo: 'Financeiro', tipo_auditoria: 'integracao', entidade: 'Asaas', descricao: `Atualização cobrança ${extId}`, empresa_id, group_id, dados_novos: updates, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
        }
      }
      return Response.json({ ok: true, action: 'asaas_webhook_processed' });
    }

    if (prov === 'juno') {
      const ch = payload?.data?.charge || payload?.charge || payload || {};
      const extId = ch?.id || payload?.id || null;
      if (extId) {
        const crList = await base44.asServiceRole.entities.ContaReceber.filter({ id_cobranca_externa: extId }, undefined, 1);
        const cr = crList?.[0] || null;
        if (cr) {
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
          await base44.asServiceRole.entities.ContaReceber.update(cr.id, updates);
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edição', modulo: 'Financeiro', tipo_auditoria: 'integracao', entidade: 'Juno', descricao: `Atualização cobrança ${extId}`, empresa_id, group_id, dados_novos: updates, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
        }
      }
      return Response.json({ ok: true, action: 'juno_webhook_processed' });
    }

    if (prov === 'enotas' || prov === 'nfe_io') {
      const nfId = payload?.nfeId || payload?.id || payload?.nota_id || null;
      const status = (payload?.status || payload?.evento || '').toString();
      if (nfId) {
        const map = { autorizada: 'Autorizada', autorizadauso: 'Autorizada', cancelada: 'Cancelada', denegada: 'Denegada', rejeitada: 'Rejeitada' };
        const statusKey = status.toLowerCase().replace(/\s/g,'');
        const nfStatus = map[statusKey] || status;
        await base44.asServiceRole.entities.NotaFiscal.update(nfId, { status: nfStatus, mensagem_sefaz: payload?.mensagem || null, codigo_status_sefaz: String(payload?.codigo || payload?.statusCode || ''), xml_nfe: payload?.xmlUrl || payload?.xml || null, pdf_danfe: payload?.pdfUrl || payload?.danfeUrl || null, chave_acesso: payload?.chave || payload?.chaveAcesso || null });
        if (/autorizad/i.test(nfStatus)) {
          try { await base44.asServiceRole.functions.invoke('onNotaFiscalAuthorized', { nota_fiscal_id: nfId, empresa_id }); } catch(_) {}
        }
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edição', modulo: 'Fiscal', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualização NF-e ${nfId}`, empresa_id, group_id, dados_novos: { status: nfStatus }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
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
        const group_id = payload.group_id || null;

        // Token/assinatura obrigatória (Zero Trust)
        const hdrToken = req.headers.get('x-internal-token') || req.headers.get('x-webhook-token') || null;
        const expected = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
        const trusted = !!(expected && hdrToken === expected);
        if (!trusted) {
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Bloqueio', modulo: 'Integrações', tipo_auditoria: 'seguranca', entidade: prov, descricao: 'Token inválido no webhook', dados_novos: { headers: { hasToken: !!hdrToken } }, data_hora: new Date().toISOString(), sucesso: false }); } catch {}
          return Response.json({ error: 'unauthorized_webhook' }, { status: 401 });
        }

        if (!empresa_id) { return Response.json({ error: 'empresa_id_obrigatorio' }, { status: 400 }); }

        const clean = (v) => {
          if (typeof v === 'string') return v.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,'').replace(/on[a-z]+\s*=\s*(["']).*?\1/gi,'').replace(/javascript:\s*/gi,'').slice(0, 4000);
          return v;
        };
        const safeNum = (n, d=0) => { const x = Number(n); return isFinite(x) ? x : d; };

        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criação', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: prov, descricao: `Webhook recebido: ${payload.event || 'evento'}`, empresa_id, group_id, dados_novos: { provider: prov }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}

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
              await base44.asServiceRole.entities.Pedido.update(found.id, { status, valor_total: total });
              pedidoResult = { action: 'update', id: found.id };
            } else {
              const novo = await base44.asServiceRole.entities.Pedido.create({
                numero_pedido: numero,
                cliente_nome: cliente,
                data_pedido,
                valor_total: total,
                empresa_id, group_id,
                origem_pedido: 'Marketplace',
                origem_externa_id: extId,
                tipo: 'Pedido'
              });
              pedidoResult = { action: 'create', id: novo.id };
            }
            try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: pedidoResult.action === 'create' ? 'Criação' : 'Edição', modulo: 'Comercial', tipo_auditoria: 'integracao', entidade: prov, descricao: `Sync pedido ${extId}`, empresa_id, group_id, dados_novos: { pedidoResult }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
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
                  await base44.asServiceRole.entities.Produto.update(target.id, { estoque_atual: qtd });
                  invCount++;
                }
              } catch(_){}
            }
          }
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edição', modulo: 'Estoque', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualização de estoque (${invCount})`, empresa_id, group_id, dados_novos: { invCount }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
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
                if (target) { await base44.asServiceRole.entities.Produto.update(target.id, patch); priceCount++; }
              } catch(_){}
            }
          }
          try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Edição', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: prov, descricao: `Atualização de preços (${priceCount})`, empresa_id, group_id, dados_novos: { priceCount }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
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
      const groupId = data.group_id || null;
      const disp = Number(data.estoque_disponivel || data.estoque_atual || 0);
      const minimo = Number(data.estoque_minimo || 0);
      if (empresaId && minimo > 0 && disp <= minimo) {
        const internal_token = Deno.env.get('DEPLOY_AUDIT_TOKEN') || '';
        const vars = { produto: data.descricao || data.codigo || data.id, disponivel: disp, minimo };
        try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId, groupId, templateKey: 'estoque_baixo', vars, internal_token }); } catch (_) {}
        try { await base44.asServiceRole.entities.AuditLog.create({ usuario: 'Webhook', acao: 'Criação', modulo: 'Estoque', tipo_auditoria: 'integracao', entidade: 'WhatsApp', descricao: 'Alerta de estoque baixo enviado', empresa_id: empresaId, group_id: groupId, dados_novos: { produto_id: data.id, descricao: data.descricao, disponivel: disp, minimo }, data_hora: new Date().toISOString(), sucesso: true }); } catch {}
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
    const groupId = data.group_id || null;

    const chave = empresaId ? `integracoes_${empresaId}` : (groupId ? `integracoes_group_${groupId}` : null);
    if (!chave) return Response.json({ ok: false, error: 'Sem empresa_id ou group_id' }, { status: 400 });

    const existentes = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ chave }, undefined, 1);

    const payloadCfg = { chave, categoria: 'Integracoes', [keyName]: data };

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
