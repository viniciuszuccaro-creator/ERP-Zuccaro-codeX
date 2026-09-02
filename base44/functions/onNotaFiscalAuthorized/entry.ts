import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, recordMatchesGuardScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportPostFiscalFailure = (operation, error, context = {}) => {
  console.error(`[onNotaFiscalAuthorized] ${operation}`, { error: error?.message || String(error), ...context });
};

const isScopedRecord = (record, scope) => recordMatchesGuardScope(record, {
  group_id: scope.groupId,
  empresa_id: scope.empresaId,
});

const buildAuthorizedNfeAuditPayload = (data, scope, movimentosSaida) => ({
  nota_fiscal_id: data?.id || null,
  numero: data?.numero || null,
  serie: data?.serie || null,
  empresa_id: scope.empresaId,
  group_id: scope.groupId,
  itens_processados: movimentosSaida.length,
  danfe_gerado: Boolean(data?.pdf_danfe || data?.pdf_url),
  xml_gerado: Boolean(data?.xml_nfe),
  chave_registrada: Boolean(data?.chave_acesso),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let data = body?.data || null;
    if (!data && body?.nota_fiscal_id) {
      const notas = await base44.asServiceRole.entities.NotaFiscal.filter({ id: body.nota_fiscal_id }, undefined, 1);
      data = notas?.[0] || null;
    }
    if (!data) return Response.json({ ok: true, skipped: true, reason: 'no data' });

    if (data?.status !== 'Autorizada') return Response.json({ ok: true, skipped: true });

    const notaFiscalId = data?.id || body?.nota_fiscal_id || null;
    const resolvedScope = await completeGuardCallScope(base44, {
      empresa_id: data?.empresa_faturamento_id || data?.empresa_id || data?.empresa_origem_id || body?.empresa_id || null,
      group_id: data?.group_id || body?.group_id || null,
    });
    if (!resolvedScope.groupId || !resolvedScope.empresaId) {
      return Response.json({ error: 'Contexto multiempresa incompleto para a NF-e' }, { status: 400 });
    }
    const empresaId = resolvedScope.empresaId;
    const groupId = resolvedScope.groupId;
    const notaComEscopo = { ...data, empresa_id: empresaId, group_id: data?.group_id || groupId };
    if (!isScopedRecord(notaComEscopo, resolvedScope)) {
      return Response.json({ error: 'Nota fiscal fora do contexto multiempresa' }, { status: 403 });
    }

    const commissionGuardFailure = await requireEntityGuard(base44, {
      module: 'Comercial', section: 'Comissao', action: 'criar', empresa_id: empresaId, group_id: groupId,
    });
    if (commissionGuardFailure) return commissionGuardFailure;
    const stockGuardFailure = await requireEntityGuard(base44, {
      module: 'Estoque', section: 'MovimentacaoEstoque', action: 'criar', empresa_id: empresaId, group_id: groupId,
    });
    if (stockGuardFailure) return stockGuardFailure;

    // Localiza pedido ligado (opcional)
    let pedido = null;
    try {
      if (data?.pedido_id) {
        const ps = await base44.asServiceRole.entities.Pedido.filter({ id: data.pedido_id }, undefined, 1);
        pedido = ps?.[0] || null;
        if (!pedido || !isScopedRecord(pedido, resolvedScope)) {
          return Response.json({ error: 'Pedido fora do contexto multiempresa' }, { status: 403 });
        }
      }
    } catch (error) { reportPostFiscalFailure('consulta_pedido', error, { pedido_id: data?.pedido_id, nota_fiscal_id: notaFiscalId }); }

    // Gera Comissão
    const valor_venda = Number(pedido?.valor_total ?? data?.valor_total ?? 0);
    const perc = Number(pedido?.percentual_comissao || 5);
    const comPayload = {
      vendedor: pedido?.vendedor || user?.full_name || user?.email,
      vendedor_id: pedido?.vendedor_id || user?.id,
      pedido_id: pedido?.id || null,
      numero_pedido: pedido?.numero_pedido || null,
      cliente: data?.cliente_fornecedor || pedido?.cliente_nome || '',
      data_venda: data?.data_emissao || new Date().toISOString().slice(0,10),
      valor_venda,
      percentual_comissao: perc,
      valor_comissao: Math.round(valor_venda * perc) / 100,
      status: 'Pendente',
      observacoes: 'Gerada automaticamente na autorização da NF-e',
      group_id: groupId || null,
      empresa_id: empresaId || null
    };
    let comissao = null;
    try { comissao = await base44.asServiceRole.entities.Comissao.create(comPayload); } catch (error) { reportPostFiscalFailure('criacao_comissao', error, { nota_fiscal_id: notaFiscalId }); }

    // Movimentações de saída por itens
    const itens = Array.isArray(data?.itens) ? data.itens : [];
    const movimentosSaida = [];
    for (const it of itens) {
      const pid = it?.produto_id;
      const qtd = Number(it?.quantidade || 0);
      if (!pid || qtd <= 0) continue;
      let produto = null;
      try {
        const pr = await base44.asServiceRole.entities.Produto.filter({ id: pid }, undefined, 1);
        produto = pr?.[0] || null;
        if (!produto || !isScopedRecord(produto, resolvedScope)) {
          return Response.json({ error: 'Produto fora do contexto multiempresa' }, { status: 403 });
        }
      } catch (error) { reportPostFiscalFailure('consulta_produto', error, { produto_id: pid, nota_fiscal_id: notaFiscalId }); }
      if (produto) {
        const novoReservado = Math.max(0, Number(produto.estoque_reservado || 0) - qtd);
        try { await base44.asServiceRole.entities.Produto.update(produto.id, { estoque_reservado: novoReservado }); } catch (error) { reportPostFiscalFailure('liberacao_estoque_reservado', error, { produto_id: produto.id, nota_fiscal_id: notaFiscalId }); }
      }
      try {
        const mov = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          origem_movimento: 'nfe',
          tipo_movimento: 'saida',
          produto_id: pid,
          produto_descricao: produto?.descricao || it?.descricao || '',
          quantidade: qtd,
          unidade_medida: it?.unidade || produto?.unidade_estoque || 'UN',
          empresa_id: data?.empresa_origem_id || empresaId || null,
          group_id: groupId || null,
          data_movimentacao: new Date().toISOString(),
          motivo: `Saída NF ${data?.numero || data?.id}`,
          valor_total: Number(it?.valor_total || 0),
          responsavel: user?.full_name || user?.email,
          responsavel_id: user?.id
        });
        movimentosSaida.push(mov?.id);
      } catch (error) {
        reportPostFiscalFailure('movimentacao_saida', error, { produto_id: pid, nota_fiscal_id: notaFiscalId });
      }
    }

    // Auditoria específica da autorização com links
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'automacao',
        usuario_id: user?.id || null,
        acao: 'Autorização', modulo: 'Fiscal', tipo_auditoria: 'entidade', entidade: 'NotaFiscal',
        registro_id: data?.id || null,
        descricao: `NF-e autorizada ${data?.numero || ''}/${data?.serie || ''}`,
        empresa_id: empresaId || null, group_id: groupId || null,
        dados_novos: buildAuthorizedNfeAuditPayload(data, resolvedScope, movimentosSaida),
        data_hora: new Date().toISOString(), sucesso: true
      });
    } catch (error) {
      reportPostFiscalFailure('auditoria_pos_fiscal', error, { nota_fiscal_id: notaFiscalId });
    }

    // Notificação WhatsApp/Email com link do DANFE
    try {
      const danfeLink = data?.pdf_danfe || data?.pdf_url || '';
      const msg = `Olá! Sua Nota Fiscal ${data?.numero || ''}/${data?.serie || ''} foi autorizada.\nDANFE: ${danfeLink}\nChave: ${data?.chave_acesso || ''}`;

      // WhatsApp (função interna simulada caso não configurado)
      await base44.asServiceRole.functions.invoke('whatsappSend', {
        action: 'sendText', empresaId: empresaId, groupId: groupId,
        pedidoId: data?.pedido_id || null,
        clienteId: data?.cliente_fornecedor_id || null,
        mensagem: msg,
        internal_token: Deno.env.get('DEPLOY_AUDIT_TOKEN') || undefined
      }).catch((error) => reportPostFiscalFailure('notificacao_whatsapp', error, { nota_fiscal_id: notaFiscalId }));

      // E-mail (usa Core se não existir provedor configurado)
      let emailDest = null;
      try {
        if (data?.cliente_fornecedor_id) {
          const cli = await base44.asServiceRole.entities.Cliente.filter({ id: data.cliente_fornecedor_id }, undefined, 1);
          const c = cli?.[0] || null;
          if (c && !isScopedRecord(c, resolvedScope)) {
            reportPostFiscalFailure('cliente_fora_do_escopo', new Error('Cliente fora do contexto multiempresa'), { cliente_id: c.id, nota_fiscal_id: notaFiscalId });
          } else if (Array.isArray(c?.contatos)) {
            const ce = c.contatos.find(x => /e-?mail/i.test(x?.tipo || '') && x?.valor);
            emailDest = ce?.valor || null;
          }
        }
      } catch (error) {
        reportPostFiscalFailure('consulta_cliente_notificacao', error, { nota_fiscal_id: notaFiscalId });
      }
      if (emailDest) {
        const assunto = `NF-e ${data?.numero || ''}/${data?.serie || ''} autorizada`;
        const corpo = `<p>Olá,</p><p>Sua Nota Fiscal foi autorizada.</p><p><a href="${danfeLink}" target="_blank">Baixar DANFE</a></p><p>Chave de acesso: ${data?.chave_acesso || ''}</p>`;
        await base44.asServiceRole.integrations.Core.SendEmail({ to: emailDest, subject: assunto, body: corpo });
      }
    } catch (error) {
      reportPostFiscalFailure('notificacao_email', error, { nota_fiscal_id: notaFiscalId });
    }

    return Response.json({ ok: true, comissao_id: comissao?.id || null, movimentos_saida: movimentosSaida });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
