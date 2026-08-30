import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const reportApprovalFailure = (operation, error, context = {}) => {
  console.error('[solicitacoesAprovacao] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

// Self-contained guards (no local imports per platform rules)
async function hasPermission(base44, user, moduleName, section, action) {
  try {
    if (user?.role === 'admin') return true;
    const pid = user?.perfil_acesso_id;
    if (!pid) return false;
    const perfil = await base44.asServiceRole.entities.PerfilAcesso.get(pid);
    const mod = perfil?.permissoes?.[moduleName];
    if (!mod) return false;
    const actions = Array.isArray(mod?.[section]) ? mod[section] : Array.isArray(mod?.['*']) ? mod['*'] : [];
    const aliases = { visualizar: ['ver', 'visualizar'], aprovar: ['aprovar', 'gerir'], criar: ['criar', 'inserir', 'abrir'] };
    const list = aliases[action] || [action];
    return actions.some(a => list.includes(String(a).toLowerCase()));
  } catch { return false; }
}

function assertContextPresence(ctx, requireEmpresa) {
  const empresa_id = ctx?.empresa_id ?? ctx?.empresaId ?? null;
  const group_id = ctx?.group_id ?? ctx?.groupId ?? null;
  if (requireEmpresa && !(empresa_id || group_id)) {
    return Response.json({ error: 'Contexto multiempresa ausente (empresa_id ou group_id)' }, { status: 400 });
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { action } = payload || {};

    // Auto-evaluate when called by entity automation (event + data)
    if (payload?.event && payload?.data) {
      try {
        const ev = payload.event;
        const d = payload.data;
        const entity_name = ev?.entity_name || null;
        const entity_id = ev?.entity_id || d?.id || null;
        const empresa_id = d?.empresa_id || d?.empresa_faturamento_id || null;
        const group_id = d?.group_id || null;
        let valor = null;
        if (entity_name === 'ContaPagar') valor = d?.valor;
        else if (entity_name === 'NotaFiscal') valor = d?.valor_total ?? d?.valor_produtos ?? 0;
        else if (entity_name === 'ContaReceber') valor = d?.valor;
        else if (entity_name === 'Pedido') valor = d?.valor_total;
        const r = await base44.asServiceRole.functions.invoke('solicitacoesAprovacao', {
          action: 'evaluateApproval', entity_name, entity_id, valor, empresa_id, group_id, operation: 'auto'
        });
        return Response.json(r?.data || { success: true });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // UPSERT approval policies (admin only)
    if (action === 'upsertPolicy') {
      if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { group_id, empresa_id, policies } = payload || {};
      if (!policies || typeof policies !== 'object') {
        return Response.json({ error: 'policies inválido' }, { status: 400 });
      }
      const filtro = { chave: 'aprovacao_politicas' };
      if (empresa_id) filtro['empresa_id'] = empresa_id;
      if (!empresa_id && group_id) filtro['group_id'] = group_id;
      const existentes = await base44.entities.ConfiguracaoSistema.filter(filtro, undefined, 1);
      let cfg;
      if (existentes && existentes[0]) {
        cfg = await base44.entities.ConfiguracaoSistema.update(existentes[0].id, { valor_json: policies });
      } else {
        cfg = await base44.entities.ConfiguracaoSistema.create({ ...filtro, valor_json: policies });
      }
      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Edição', modulo: 'Sistema', entidade: 'ConfiguracaoSistema', registro_id: cfg.id, descricao: 'Atualização de políticas de aprovação', dados_novos: policies, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar politica de aprovacao', error, { group_id, empresa_id, registro_id: cfg.id }); }
      return Response.json({ sucesso: true, id: cfg.id });
    }

    // CREATE generic approval (alçada)
    if (action === 'create') {
      const { group_id, empresa_id, tipo_solicitacao, entidade_alvo, entidade_alvo_id, dados_propostos, justificativa, aprovador_id, perfil_aprovador_necessario } = payload;
      const permOk = await hasPermission(base44, user, 'Comercial', 'Aprovacoes', 'criar');
      if (!permOk) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const ctxErr = assertContextPresence({ empresa_id, group_id }, true);
      if (ctxErr) return ctxErr;

      const record = await base44.entities.SolicitacaoAprovacao.create({
        group_id: group_id || null,
        empresa_id: empresa_id || null,
        solicitante_id: user.id,
        solicitante_nome: user.full_name || user.email,
        tipo_solicitacao,
        entidade_alvo,
        entidade_alvo_id,
        dados_propostos,
        justificativa,
        aprovador_id: aprovador_id || null,
        perfil_aprovador_necessario: perfil_aprovador_necessario || null,
        status: 'pendente',
        data_solicitacao: new Date().toISOString()
      });

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criação', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: record.id, descricao: `Solicitação (${tipo_solicitacao}) para ${entidade_alvo}#${entidade_alvo_id}`, dados_novos: record, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar criacao de solicitacao', error, { group_id, empresa_id, solicitacao_id: record.id }); }
      try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, intent: 'aprovacao_criada', vars: { entidade: entidade_alvo, id: entidade_alvo_id || 'novo' } }); } catch (error) { reportApprovalFailure('Falha ao notificar solicitacao por WhatsApp', error, { group_id, empresa_id, solicitacao_id: record.id }); }
      try { await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: empresa_id || null, assunto: 'Aprovação criada', destinatario: user.email || 'noreply@local', mensagem: `Solicitação de aprovação (${tipo_solicitacao}) aberta para ${entidade_alvo} ${entidade_alvo_id || 'novo'}.` }); } catch (error) { reportApprovalFailure('Falha ao notificar solicitacao por email', error, { group_id, empresa_id, solicitacao_id: record.id }); }
      return Response.json(record);
    }

    // APPROVE / REJECT generic
    if (action === 'approve' || action === 'reject') {
      const { solicitacao_id, comentarios_aprovacao, group_id, empresa_id } = payload;
      if (!solicitacao_id) return Response.json({ error: 'solicitacao_id é obrigatório' }, { status: 400 });
      const permOk = await hasPermission(base44, user, 'Comercial', 'Aprovacoes', 'aprovar');
      if (!permOk) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const ctxErr = assertContextPresence({ empresa_id, group_id }, false);
      if (ctxErr) return ctxErr;

      const s = await base44.entities.SolicitacaoAprovacao.get(solicitacao_id);
      if (!s) return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
      const novoStatus = action === 'approve' ? 'aprovado' : 'rejeitado';
      const updated = await base44.entities.SolicitacaoAprovacao.update(solicitacao_id, { status: novoStatus, comentarios_aprovacao: comentarios_aprovacao || null, data_decisao: new Date().toISOString() });

      // Multi-nível: se aprovado e há próximos níveis, reabrir pendência para o próximo nível e notificar aprovadores desse nível
      if (novoStatus === 'aprovado' && s?.dados_propostos?.niveis_total > 1) {
        const nextIndex = Number(s?.dados_propostos?.nivel_index || 0) + 1;
        if (nextIndex < Number(s?.dados_propostos?.niveis_total)) {
          const faixa = s?.dados_propostos?.faixa || {};
          const niveis = Array.isArray(faixa?.niveis) ? faixa.niveis : [];
          await base44.entities.SolicitacaoAprovacao.update(solicitacao_id, {
            status: 'pendente',
            dados_propostos: { ...s.dados_propostos, nivel_index: nextIndex },
          });
          try {
            const lvl = niveis[nextIndex] || {};
            const emails = Array.isArray(lvl.emails) ? lvl.emails : [];
            const whatsapps = Array.isArray(lvl.whatsapps) ? lvl.whatsapps : [];
            for (const em of emails) {
              await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: s.empresa_id || null, destinatario: em, assunto: `Aprovação pendente • ${s.entidade_alvo}` , mensagem: `Nível ${nextIndex + 1}/${niveis.length || 1} para ${s.entidade_alvo} (${s.entidade_alvo_id || 'novo'}) no valor de R$ ${Number(s?.dados_propostos?.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}.` });
            }
            for (const w of whatsapps) {
              await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: s.empresa_id || null, groupId: s.group_id || null, numero: String(w), mensagem: `Aprovação pendente (nível ${nextIndex + 1}/${niveis.length || 1}): ${s.entidade_alvo} ${s.entidade_alvo_id || 'novo'} • Valor: R$ ${Number(s?.dados_propostos?.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}` });
            }
          } catch (error) {
            reportApprovalFailure('Falha ao notificar proximo nivel de aprovacao', error, { solicitacao_id, nivel: nextIndex + 1 });
          }
          return Response.json({ escalated_to_level: nextIndex + 1 });
        }
      }

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: s.empresa_id || null, group_id: s.group_id || null, acao: action === 'approve' ? 'Aprovação' : 'Rejeição', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: solicitacao_id, descricao: `${novoStatus} para ${s.entidade_alvo}#${s.entidade_alvo_id}`, dados_anteriores: s, dados_novos: updated, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar decisao de aprovacao', error, { solicitacao_id, status: novoStatus }); }
      try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: s.empresa_id || null, groupId: s.group_id || null, intent: novoStatus === 'aprovado' ? 'aprovacao_concedida' : 'aprovacao_recusada', vars: { entidade: s.entidade_alvo, id: s.entidade_alvo_id || 'novo' } }); } catch (error) { reportApprovalFailure('Falha ao notificar decisao por WhatsApp', error, { solicitacao_id, status: novoStatus }); }
      try { await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: s.empresa_id || null, assunto: `Solicitação ${novoStatus}`, destinatario: user.email || 'noreply@local', mensagem: `Sua solicitação ${solicitacao_id} foi ${novoStatus}.` }); } catch (error) { reportApprovalFailure('Falha ao notificar decisao por email', error, { solicitacao_id, status: novoStatus }); }

      // Aplicações automáticas simples (ex.: desconto de pedido)
      if (novoStatus === 'aprovado' && s.tipo_solicitacao === 'desconto_pedido' && s.entidade_alvo === 'Pedido') {
        try {
          const pedidoAtual = await base44.entities.Pedido.get(s.entidade_alvo_id);
          if (pedidoAtual) {
            const merged = { ...pedidoAtual, ...s.dados_propostos, status: 'Aprovado' };
            await base44.entities.Pedido.update(pedidoAtual.id, merged);
          }
        } catch (error) {
          reportApprovalFailure('Falha ao aplicar aprovacao ao pedido', error, { solicitacao_id, pedido_id: s.entidade_alvo_id });
        }
      }

      return Response.json(updated);
    }

    // PORTAL: aceitar orçamento
    if (action === 'acceptBudget') {
      const { pedido_id, comments } = payload;
      if (!pedido_id) return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
      const pedido = await base44.entities.Pedido.get(pedido_id);
      if (!pedido || (pedido?.tipo !== 'Orçamento')) return Response.json({ error: 'Orçamento inválido' }, { status: 404 });
      const meusClientes = await base44.entities.Cliente.filter({ portal_usuario_id: user.id }, undefined, 50);
      const isDono = Array.isArray(meusClientes) && meusClientes.some(c => c.id === pedido.cliente_id);
      if (!isDono) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await base44.entities.Pedido.update(pedido_id, {
        status_aprovacao: 'aprovado',
        status: pedido.status === 'Rascunho' ? 'Aprovado' : pedido.status,
        data_aprovacao: new Date().toISOString(),
        observacoes_publicas: (pedido.observacoes_publicas ? (pedido.observacoes_publicas + '\n') : '') + `Aceito pelo cliente via Portal: ${user.full_name || user.email}${comments ? ' — ' + comments : ''}`
      });

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: pedido.empresa_id || null, group_id: pedido.group_id || null, acao: 'Aprovação', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido_id, descricao: 'Orçamento aceito pelo cliente no Portal', dados_anteriores: pedido, dados_novos: updated, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar aceite de orcamento', error, { pedido_id }); }

      // Notificações (melhor esforço)
      try {
        const vars = { cliente: pedido.cliente_nome || '', pedido: pedido.numero_pedido || pedido.id, valor_total: pedido.valor_total };
        await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: pedido.empresa_id || null, groupId: pedido.group_id || null, intent: 'orcamento_aceito', vars, pedidoId: pedido.id });
        await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: pedido.empresa_id || null, destinatario: (user.email || 'noreply@local'), assunto: `Orçamento #${pedido.numero_pedido || pedido.id} aceito`, mensagem: `O cliente aceitou o orçamento ${pedido.numero_pedido || pedido.id}.` });
      } catch (error) {
        reportApprovalFailure('Falha ao notificar aceite de orcamento', error, { pedido_id });
      }

      return Response.json({ sucesso: true, pedido: updated });
    }

    // PORTAL: solicitar revisão de orçamento
    if (action === 'requestRevision') {
      const { pedido_id, comments } = payload;
      if (!pedido_id) return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
      const pedido = await base44.entities.Pedido.get(pedido_id);
      if (!pedido || (pedido?.tipo !== 'Orçamento')) return Response.json({ error: 'Orçamento inválido' }, { status: 404 });
      const meusClientes = await base44.entities.Cliente.filter({ portal_usuario_id: user.id }, undefined, 50);
      const isDono = Array.isArray(meusClientes) && meusClientes.some(c => c.id === pedido.cliente_id);
      if (!isDono) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await base44.entities.Pedido.update(pedido_id, {
        status_aprovacao: 'pendente',
        observacoes_publicas: (pedido.observacoes_publicas ? (pedido.observacoes_publicas + '\n') : '') + `Revisão solicitada pelo cliente via Portal: ${comments || ''}`
      });

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: pedido.empresa_id || null, group_id: pedido.group_id || null, acao: 'Criação', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: pedido.id, descricao: 'Cliente solicitou revisão de orçamento via Portal', dados_novos: { pedido_id, comments }, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar revisao de orcamento', error, { pedido_id }); }
      try {
        const vars = { cliente: pedido.cliente_nome || '', pedido: pedido.numero_pedido || pedido.id };
        await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: pedido.empresa_id || null, groupId: pedido.group_id || null, intent: 'orcamento_revisao', vars, pedidoId: pedido.id });
        await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: pedido.empresa_id || null, destinatario: (user.email || 'noreply@local'), assunto: `Revisão solicitada • Orçamento #${pedido.numero_pedido || pedido.id}`, mensagem: `O cliente solicitou revisão do orçamento ${pedido.numero_pedido || pedido.id}. Comentários: ${comments || ''}` });
      } catch (error) {
        reportApprovalFailure('Falha ao notificar revisao de orcamento', error, { pedido_id });
      }

      return Response.json({ sucesso: true, pedido: updated });
    }

    // EVALUATE approval by value and entity (políticas personalizadas)
    if (action === 'evaluateApproval') {
      const { entity_name, entity_id, valor, empresa_id, group_id, operation } = payload || {};
      if (!entity_name || (!entity_id && (valor === undefined || valor === null))) {
        return Response.json({ error: 'entity_name e (entity_id ou valor) são obrigatórios' }, { status: 400 });
      }

      const entityToModule = {
        Pedido: 'Comercial', ContaReceber: 'Financeiro', ContaPagar: 'Financeiro', OrdemCompra: 'Compras',
        NotaFiscal: 'Fiscal', MovimentacaoEstoque: 'Estoque'
      };
      const moduleName = entityToModule[entity_name] || 'Sistema';

      // Deriva valor se não fornecido
      let valorBase = valor;
      try {
        if (valorBase == null && entity_id) {
          const api = base44.entities?.[entity_name];
          const reg = api && api.get ? await api.get(entity_id) : null;
          if (reg) {
            if (entity_name === 'Pedido') valorBase = reg.valor_total;
            else if (entity_name === 'ContaPagar' || entity_name === 'ContaReceber') valorBase = reg.valor;
            else if (entity_name === 'OrdemCompra') valorBase = reg.valor_total;
            else if (entity_name === 'NotaFiscal') valorBase = reg.valor_total || reg.valor_produtos || 0;
          }
        }
      } catch (error) {
        reportApprovalFailure('Falha ao obter valor da entidade', error, { entity_name, entity_id });
      }
      if (valorBase == null) valorBase = 0;

      // Carrega políticas (empresa > grupo)
      let politicas = null;
      try {
        const byEmpresa = empresa_id ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'aprovacao_politicas', empresa_id }, undefined, 1) : [];
        const byGrupo = (!byEmpresa?.length && group_id) ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'aprovacao_politicas', group_id }, undefined, 1) : [];
        const cfg = (byEmpresa?.[0] || byGrupo?.[0]) || null;
        politicas = cfg?.valor_json || cfg?.politicas || null; // aceita tanto valor_json quanto politicas
      } catch (error) {
        reportApprovalFailure('Falha ao carregar politicas de aprovacao', error, { group_id, empresa_id, entity_name });
      }
      const ranges = (politicas && politicas[entity_name]) || [];

      // Encontra a faixa
      const faixa = Array.isArray(ranges) ? ranges.find(r => {
        const min = Number(r?.min ?? 0);
        const max = (r?.max == null) ? Infinity : Number(r.max);
        return valorBase >= min && valorBase <= max;
      }) : null;

      // Verifica se o usuário já pode aprovar (perfil com ação 'aprovar')
      const canApprove = await hasPermission(base44, user, moduleName, entity_name, 'aprovar');

      if (!faixa) {
        // Sem política definida para este valor → se tem permissão, segue; caso contrário, cria pendência genérica
        if (canApprove) {
          return Response.json({ required: false, reason: 'sem_politica' });
        }
        const rec = await base44.entities.SolicitacaoAprovacao.create({
          group_id: group_id || null,
          empresa_id: empresa_id || null,
          solicitante_id: user.id,
          solicitante_nome: user.full_name || user.email,
          tipo_solicitacao: 'aprovacao_valor',
          entidade_alvo: entity_name,
          entidade_alvo_id: entity_id || null,
          dados_propostos: { operation: operation || 'execucao', valor: valorBase },
          justificativa: 'Aprovação exigida por ausência de política explícita',
          status: 'pendente',
          data_solicitacao: new Date().toISOString(),
          perfil_aprovador_necessario: 'aprovar',
        });
        try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criação', modulo: moduleName, entidade: 'SolicitacaoAprovacao', registro_id: rec.id, descricao: `Avaliação de aprovação criada (${entity_name} ${entity_id || ''})`, dados_novos: rec, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar avaliacao de aprovacao', error, { solicitacao_id: rec.id, entity_name, entity_id }); }
        // Notifica solicitante
        try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, intent: 'aprovacao_pendente', vars: { entidade: entity_name, id: entity_id || 'novo', valor: valorBase } }); } catch (error) { reportApprovalFailure('Falha ao notificar aprovacao pendente por WhatsApp', error, { solicitacao_id: rec.id }); }
        try { await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: empresa_id || null, assunto: 'Aprovação pendente', destinatario: user.email || 'noreply@local', mensagem: `Gerada solicitação de aprovação para ${entity_name} (${entity_id || 'novo'}), valor ${valorBase}.` }); } catch (error) { reportApprovalFailure('Falha ao notificar aprovacao pendente por email', error, { solicitacao_id: rec.id }); }
        // Notifica gestores (configuração por empresa/grupo: chave 'gestores_financeiros')
        try {
          const cfgEmp = empresa_id ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'gestores_financeiros', empresa_id }, undefined, 1) : [];
          const cfgGrp = (!cfgEmp?.length && group_id) ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'gestores_financeiros', group_id }, undefined, 1) : [];
          const gestores = (cfgEmp?.[0]?.valor_json || cfgGrp?.[0]?.valor_json || []);
          if (Array.isArray(gestores)) {
            for (const g of gestores) {
              if (g?.whatsapp) { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, numero: String(g.whatsapp), mensagem: `Aprovação pendente: ${entity_name} ${entity_id || 'novo'} • Valor: R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}` }); }
              if (g?.email) { await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: empresa_id || null, destinatario: g.email, assunto: 'Aprovação pendente', mensagem: `Existe uma solicitação de aprovação para ${entity_name} (${entity_id || 'novo'}) no valor de R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}.` }); }
            }
          }
        } catch (error) {
          reportApprovalFailure('Falha ao notificar gestores financeiros', error, { solicitacao_id: rec.id, group_id, empresa_id });
        }
        return Response.json({ required: true, solicitacao_id: rec.id });
      }

      // Há política → se não possui permissão, cria solicitação (suporta multi-nível via faixa.niveis)
      if (!canApprove) {
        const niveis = Array.isArray(faixa?.niveis) ? faixa.niveis : [];
        const nivel_index = 0;
        const rec = await base44.entities.SolicitacaoAprovacao.create({
          group_id: group_id || null,
          empresa_id: empresa_id || null,
          solicitante_id: user.id,
          solicitante_nome: user.full_name || user.email,
          tipo_solicitacao: 'aprovacao_valor',
          entidade_alvo: entity_name,
          entidade_alvo_id: entity_id || null,
          dados_propostos: { operation: operation || 'execucao', valor: valorBase, faixa, nivel_index, niveis_total: niveis.length },
          justificativa: faixa?.justificativa_padrao || 'Aprovação por valor',
          status: 'pendente',
          data_solicitacao: new Date().toISOString(),
          perfil_aprovador_necessario: 'aprovar',
        });
        try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criação', modulo: moduleName, entidade: 'SolicitacaoAprovacao', registro_id: rec.id, descricao: `Solicitação por valor (${valorBase}) para ${entity_name} ${entity_id || ''} • Nível ${nivel_index + 1}/${niveis.length || 1}` , dados_novos: rec, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar solicitacao por valor', error, { solicitacao_id: rec.id, entity_name, entity_id }); }
        // Notifica solicitante (melhor esforço)
        try { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, intent: 'aprovacao_pendente', vars: { entidade: entity_name, id: entity_id || 'novo', valor: valorBase } }); } catch (error) { reportApprovalFailure('Falha ao notificar solicitacao por valor', error, { solicitacao_id: rec.id }); }
        
        // Notifica aprovadores do nível atual, se definidos na política; senão, cai no fallback de gestores_financeiros
        let notified = false;
        try {
          const lvl = niveis[nivel_index] || {};
          const emails = Array.isArray(lvl.emails) ? lvl.emails : [];
          const whatsapps = Array.isArray(lvl.whatsapps) ? lvl.whatsapps : [];
          for (const em of emails) {
            notified = true;
            await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: empresa_id || null, destinatario: em, assunto: `Aprovação pendente • ${entity_name}` , mensagem: `Nível ${nivel_index + 1}/${niveis.length || 1} para ${entity_name} (${entity_id || 'novo'}) no valor de R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}.` });
          }
          for (const w of whatsapps) {
            notified = true;
            await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, numero: String(w), mensagem: `Aprovação pendente (nível ${nivel_index + 1}/${niveis.length || 1}): ${entity_name} ${entity_id || 'novo'} • Valor: R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}` });
          }
        } catch (error) {
          reportApprovalFailure('Falha ao notificar nivel atual de aprovacao', error, { solicitacao_id: rec.id, nivel: nivel_index + 1 });
        }
        
        // Fallback para gestores financeiros cadastrados por empresa/grupo
        if (!notified) {
          try {
            const cfgEmp = empresa_id ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'gestores_financeiros', empresa_id }, undefined, 1) : [];
            const cfgGrp = (!cfgEmp?.length && group_id) ? await base44.entities.ConfiguracaoSistema.filter({ chave: 'gestores_financeiros', group_id }, undefined, 1) : [];
            const gestores = (cfgEmp?.[0]?.valor_json || cfgGrp?.[0]?.valor_json || []);
            if (Array.isArray(gestores)) {
              for (const g of gestores) {
                if (g?.whatsapp) { await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: empresa_id || null, groupId: group_id || null, numero: String(g.whatsapp), mensagem: `Aprovação pendente: ${entity_name} ${entity_id || 'novo'} • Valor: R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}` }); }
                if (g?.email) { await base44.asServiceRole.functions.invoke('sendEmailProvider', { empresaId: empresa_id || null, destinatario: g.email, assunto: 'Aprovação pendente', mensagem: `Existe uma solicitação de aprovação para ${entity_name} (${entity_id || 'novo'}) no valor de R$ ${Number(valorBase).toLocaleString('pt-BR',{minimumFractionDigits:2})}.` }); }
              }
            }
          } catch (error) {
            reportApprovalFailure('Falha no fallback de gestores financeiros', error, { solicitacao_id: rec.id, group_id, empresa_id });
          }
        }
        return Response.json({ required: true, solicitacao_id: rec.id, nivel_index, niveis_total: niveis.length });
      }

      return Response.json({ required: false, faixa });
    }

    // LIST approvals
    if (action === 'list') {
      const { status, tipo_solicitacao, group_id, empresa_id } = payload;
      const permOk = await hasPermission(base44, user, 'Comercial', 'Aprovacoes', 'visualizar');
      if (!permOk) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const ctxErr = assertContextPresence({ empresa_id, group_id }, true);
      if (ctxErr) return ctxErr;

      const filtro = {};
      if (status) filtro.status = status;
      if (tipo_solicitacao) filtro.tipo_solicitacao = tipo_solicitacao;
      if (group_id) filtro.group_id = group_id;
      if (empresa_id) filtro.empresa_id = empresa_id;

      const items = await base44.entities.SolicitacaoAprovacao.filter(filtro, '-created_date', 50);
      return Response.json(items);
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});
