import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { completeGuardCallScope, recordMatchesGuardScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportPaymentFailure = (operation, error, context = {}) => {
  console.error(`[paymentStatusManager] ${operation}`, { error: error?.message || String(error), ...context });
};
// Inline helpers to avoid local imports
async function getUserAndPerfil(base44){
  const user = await base44.auth.me();
  return { user, perfil: null };
}
async function assertPermission(base44, ctx, module, entity, action, scope){
  return requireEntityGuard(base44, { module, section: entity, action, ...scope });
}
async function audit(base44, user, log){
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Usuário',
      usuario_id: user?.id || null,
      acao: log.acao || 'Execução',
      modulo: log.modulo || 'Sistema',
      tipo_auditoria: log.tipo_auditoria || 'sistema',
      entidade: log.entidade || 'Function',
      registro_id: log.registro_id || null,
      descricao: log.descricao || '',
      empresa_id: log.empresa_id || null,
      group_id: log.group_id || null,
      dados_anteriores: log.dados_anteriores || null,
      dados_novos: log.dados_novos || null,
      data_hora: new Date().toISOString()
    });
  } catch (error) {
    reportPaymentFailure('auditoria', error, { entidade: log?.entidade, registro_id: log?.registro_id });
  }
}
// Inline minimal compute helpers (avoid external local imports)
function computeUpdatesForContaPagar(action, justificativa, registro){
  const up = {};
  if (action === 'cancelar') { up.status = 'Cancelado'; up.motivo_cancelamento = justificativa || 'Sem justificativa'; }
  if (action === 'aprovar') { up.status_pagamento = 'Aprovado'; }
  if (action === 'rejeitar') { up.status_pagamento = 'Rejeitado'; up.motivo_rejeicao = justificativa || 'Sem justificativa'; }
  return up;
}
function computeUpdatesForContaReceber(action, justificativa, registro){
  const up = {};
  if (action === 'cancelar') { up.status = 'Cancelado'; up.motivo_cancelamento = justificativa || 'Sem justificativa'; }
  if (action === 'cobrar') { up.status_cobranca = 'enviada'; }
  return up;
}


// Helpers Financeiro Profissional
function isCR(entity){ return entity==='ContaReceber'; }
function isCP(entity){ return entity==='ContaPagar'; }
function normalizePagamento(p){
  const v = Number(p?.valor)||0;
  return {
    meio: p?.meio || 'PIX',
    valor: v,
    data: p?.data || new Date().toISOString().slice(0,10),
    parcelas: Array.isArray(p?.parcelas)? p.parcelas : [],
    multiplos_meios: Array.isArray(p?.multiplos_meios)? p.multiplos_meios : [],
    obra_id: p?.obra_id || null,
    fornecedor_id: p?.fornecedor_id || null,
  };
}

const resolveFinancialScope = async (base44, input = {}) => completeGuardCallScope(base44, input || {});

const buildContaFinanceiraAuditSnapshot = (registro = {}) => ({
  id: registro?.id || null,
  empresa_id: registro?.empresa_id || null,
  group_id: registro?.group_id || registro?.grupo_id || null,
  status: registro?.status || null,
  status_pagamento: registro?.status_pagamento || null,
  status_cobranca: registro?.status_cobranca || null,
  valor: Number(registro?.valor || 0),
  valor_pago: Number(registro?.valor_pago || 0),
  valor_recebido: Number(registro?.valor_recebido || 0),
  data_vencimento: registro?.data_vencimento || null,
  data_pagamento: registro?.data_pagamento || null,
  data_recebimento: registro?.data_recebimento || null,
});

const buildPaymentAuditPayload = ({ action, updates = {}, justificativa = null, pagamento = null } = {}) => ({
  action: action || null,
  status: updates.status || null,
  status_pagamento: updates.status_pagamento || null,
  status_cobranca: updates.status_cobranca || null,
  valor_pago: updates.valor_pago ?? null,
  valor_recebido: updates.valor_recebido ?? null,
  data_pagamento: updates.data_pagamento || null,
  data_recebimento: updates.data_recebimento || null,
  motivo_cancelamento: updates.motivo_cancelamento || null,
  motivo_rejeicao: updates.motivo_rejeicao || null,
  tem_justificativa: Boolean(justificativa),
  pagamento: pagamento ? {
    meio: pagamento.meio || null,
    valor: Number(pagamento.valor || 0),
    data: pagamento.data || null,
    parcelas: Array.isArray(pagamento.parcelas) ? pagamento.parcelas.length : 0,
    multiplos_meios: Array.isArray(pagamento.multiplos_meios) ? pagamento.multiplos_meios.length : 0,
    obra_id: pagamento.obra_id || null,
    fornecedor_id: pagamento.fornecedor_id || null,
  } : null,
});

const buildConciliacaoAuditPayload = (result = {}) => ({
  ok: result?.ok === true,
  conciliados: Number(result?.conciliados || 0),
  divergencias: Array.isArray(result?.divergencias) ? result.divergencias.length : 0,
  origem: 'paymentStatusManager',
});
async function conciliarExtrato(base44, ctx, conc){
  if (!conc?.file_url) return { ok:false, error:'file_url obrigatório' };
  const toleranciaDias = Number(conc?.tolerancia_dias)||2;
  const tolerancia = Number(conc?.tolerancia_centavos)||1; // até 1 centavo
  const filtroBase = {};
  if (conc?.empresa_id) filtroBase.empresa_id = conc.empresa_id;
  if (conc?.group_id) filtroBase.group_id = conc.group_id;

  const parsed = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
    file_url: conc.file_url,
    json_schema: { type:'object', additionalProperties:true }
  });
  const linhas = Array.isArray(parsed?.output) ? parsed.output : [];

  const abrirCR = await base44.asServiceRole.entities.ContaReceber.filter({ status: 'Pendente', ...filtroBase }, '-data_vencimento', 500);
  const abrirCP = await base44.asServiceRole.entities.ContaPagar.filter({ status: 'Pendente', ...filtroBase }, '-data_vencimento', 500);

  let conciliados = 0; const divergencias = [];
  const toAbs = (n)=>Math.round(Math.abs(Number(n)||0)*100);

  for (const l of linhas){
    const valor = Number(l.valor ?? l.amount ?? l.valor_transacao ?? 0);
    const dataStr = (l.data || l.date || '').slice(0,10);
    const alvoCR = valor>0; // crédito => receber, débito => pagar
    const pool = alvoCR ? abrirCR : abrirCP;
    const valAbs = toAbs(valor);

    // match por valor exato +- tolerancia e data próxima a vencimento
    let melhor = null; let melhorGap = 9999;
    for (const r of pool){
      const alvo = toAbs(r.valor);
      if (Math.abs(alvo - valAbs) <= tolerancia){
        const venc = r.data_vencimento ? new Date(r.data_vencimento) : null;
        const mov = dataStr ? new Date(dataStr) : null;
        const gap = (venc && mov) ? Math.abs((mov - venc)/(1000*60*60*24)) : 0;
        if (gap <= toleranciaDias && gap < melhorGap){ melhor = r; melhorGap = gap; }
      }
    }

    if (!melhor){
      divergencias.push({ descricao: 'Sem correspondência', valor, data: dataStr, tipo: alvoCR?'CR':'CP' });
      continue;
    }

    try{
      if (alvoCR){
        const novoReceb = Number(melhor.valor_recebido||0) + Math.abs(valor);
        const quitado = novoReceb + 0.005 >= Number(melhor.valor||0);
        await base44.asServiceRole.entities.ContaReceber.update(melhor.id, {
          valor_recebido: novoReceb,
          data_recebimento: new Date().toISOString().slice(0,10),
          status: quitado ? 'Recebido' : 'Parcial',
          detalhes_pagamento: { ...(melhor.detalhes_pagamento||{}), forma_pagamento: 'Conciliação', valor_liquido: novoReceb, status_compensacao: 'Conciliado' }
        });
      } else {
        const novoPago = Number(melhor.valor_pago||0) + Math.abs(valor);
        const quitado = novoPago + 0.005 >= Number(melhor.valor||0);
        await base44.asServiceRole.entities.ContaPagar.update(melhor.id, {
          valor_pago: novoPago,
          data_pagamento: new Date().toISOString().slice(0,10),
          status: quitado ? 'Pago' : 'Parcelado',
          detalhes_pagamento: { ...(melhor.detalhes_pagamento||{}), forma_pagamento: 'Conciliação', valor_liquido: novoPago, status_compensacao: 'Conciliado' }
        });
      }
      conciliados++;
    } catch (e){
      divergencias.push({ descricao: 'Falha ao atualizar', erro: String(e?.message||e), registro_id: melhor?.id, tipo: alvoCR?'CR':'CP' });
    }
  }

  // Análise inteligente de divergências via IA Financeira
  try{
    if (divergencias.length){
      await base44.asServiceRole.functions.invoke('iaFinanceAnomalyScan', { filtros: filtroBase, origem: 'conciliacao', divergencias });
    }
  } catch(_){/* não bloquear conciliação */}

  return { ok:true, conciliados, divergencias };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ctx = await getUserAndPerfil(base44);
    const user = ctx.user;
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!user && !body?.action) body.action = 'lembretes_cobranca';
    const { entity, id, ids, action, justificativa, pagamento: pagamentoIn, conciliacao } = body || {};
    const internalToken = body?.internal_token || req.headers.get('x-internal-token') || null;
    const trustedInternal = !!(internalToken && Deno.env.get('DEPLOY_AUDIT_TOKEN') && internalToken === Deno.env.get('DEPLOY_AUDIT_TOKEN'));

    // Automação por evento (Entity Automation): lembretes de cobrança ao criar/atualizar CR perto do vencimento
    if (body?.event?.entity_name === 'ContaReceber' && (body.event.type === 'create' || body.event.type === 'update') && body?.data) {
      const cr = body.data;
      const empresaId = cr.empresa_id || null;
      const groupId = cr.group_id || null;
      const status = String(cr.status || '').toLowerCase();
      if (!empresaId || !cr.data_vencimento || !['pendente','atrasado','parcial'].includes(status)) {
        return Response.json({ ok: true, skipped: true });
      }
      const onlyDate = (d) => new Date(new Date(d).toISOString().slice(0,10));
      const diffDays = Math.floor((onlyDate(cr.data_vencimento).getTime() - onlyDate(new Date()).getTime()) / (1000*60*60*24));
      if (![3,0,-3].includes(diffDays)) {
        return Response.json({ ok: true, skipped: true, diffDays });
      }
      const valorFmt = Number(cr.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      let mensagem = '';
      if (diffDays === 3) mensagem = `Lembrete: sua cobrança ${cr.numero_documento || cr.id} vence em 3 dias (R$ ${valorFmt}).`;
      if (diffDays === 0) mensagem = `Hoje vence sua cobrança ${cr.numero_documento || cr.id} (R$ ${valorFmt}).`;
      if (diffDays === -3) mensagem = `Aviso: sua cobrança ${cr.numero_documento || cr.id} venceu há 3 dias (R$ ${valorFmt}).`;
      try {
        await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId, groupId, clienteId: cr.cliente_id || null, mensagem, internal_token: Deno.env.get('DEPLOY_AUDIT_TOKEN') || '' });
        await audit(base44, { id: 'Service' }, { acao: 'Criação', modulo: 'Financeiro', entidade: 'ContaReceber', registro_id: cr.id, descricao: 'Lembrete de cobrança enviado (automação)', empresa_id: empresaId, group_id: groupId, dados_novos: { diffDays } });
      } catch (error) {
        reportPaymentFailure('lembrete_cobranca', error, { conta_receber_id: cr.id });
      }
      return Response.json({ ok: true, reminder: true, diffDays });
    }

    // Execução agendada/service: varredura de CR e envio de lembretes (requer internal_token)
    if (action === 'lembretes_cobranca' && (trustedInternal || !user)) {
      const empresaIdIn = body.empresa_id || null;
      const groupIdIn = body.group_id || null;
      let empresas = [];
      if (groupIdIn) {
        const emps = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupIdIn }, undefined, 500);
        empresas = (emps || []).map(e => e.id);
      } else if (empresaIdIn) {
        empresas = [empresaIdIn];
      } else {
        // Sem escopo explícito: varre todas as empresas (multiempresa absoluta)
        const empsAll = await base44.asServiceRole.entities.Empresa.filter({}, undefined, 500);
        empresas = (empsAll || []).map(e => e.id);
      }
      let enviados = 0;
      const onlyDate = (d) => new Date(new Date(d).toISOString().slice(0,10));
      for (const eid of empresas) {
        const lista = await base44.asServiceRole.entities.ContaReceber.filter({ empresa_id: eid }, '-data_vencimento', 1000);
        for (const r of (lista || [])) {
          const st = String(r.status || '').toLowerCase();
          if (!r.data_vencimento || !['pendente','atrasado','parcial'].includes(st)) continue;
          const diff = Math.floor((onlyDate(r.data_vencimento).getTime() - onlyDate(new Date()).getTime()) / (1000*60*60*24));
          if (![3,0,-3].includes(diff)) continue;
          const valorFmt = Number(r.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          let msg = '';
          if (diff === 3) msg = `Lembrete: sua cobrança ${r.numero_documento || r.id} vence em 3 dias (R$ ${valorFmt}).`;
          if (diff === 0) msg = `Hoje vence sua cobrança ${r.numero_documento || r.id} (R$ ${valorFmt}).`;
          if (diff === -3) msg = `Aviso: sua cobrança ${r.numero_documento || r.id} venceu há 3 dias (R$ ${valorFmt}).`;
          try {
            await base44.asServiceRole.functions.invoke('whatsappSend', { action: 'sendText', empresaId: eid, groupId: groupIdIn || r.group_id || null, clienteId: r.cliente_id || null, mensagem: msg, internal_token: Deno.env.get('DEPLOY_AUDIT_TOKEN') || '' });
            await audit(base44, { id: 'Service' }, { acao: 'Criação', modulo: 'Financeiro', entidade: 'ContaReceber', registro_id: r.id, descricao: 'Lembrete de cobrança enviado (varredura)', empresa_id: eid, group_id: groupIdIn || r.group_id || null, dados_novos: { diffDays: diff } });
            enviados++;
          } catch (error) {
            reportPaymentFailure('lembrete_varredura', error, { conta_receber_id: r.id });
          }
        }
      }
      return Response.json({ ok: true, enviados });
    }

    // Checkout iniciado: gera link de pagamento e dispara mensageria
    if (action === 'checkout_iniciado') {
      const empresaId = body?.empresa_id || null;
      const pedidoId = body?.pedido_id || null;
      const contaReceberId = body?.conta_receber_id || null;
      const valor = Number(body?.valor || 0);
      if (!empresaId || !pedidoId || !contaReceberId || !(valor > 0)) {
        return Response.json({ error: 'Parâmetros inválidos (checkout_iniciado)' }, { status: 400 });
      }
      const checkoutScope = await resolveFinancialScope(base44, body);
      const checkoutGroupId = checkoutScope.groupId || null;
      if (!checkoutGroupId) {
        return Response.json({ error: 'group_id ausente para checkout_iniciado' }, { status: 400 });
      }
      const checkoutCr = await base44.asServiceRole.entities.ContaReceber.get(contaReceberId);
      if (!recordMatchesGuardScope(checkoutCr, { group_id: checkoutGroupId, empresa_id: empresaId })) {
        return Response.json({ error: 'ContaReceber fora do contexto multiempresa informado' }, { status: 403 });
      }
      // Busca config do gateway ativo
      let cfg = null;
      try {
        const cfgs = await base44.asServiceRole.entities.ConfiguracaoGatewayPagamento.filter({ empresa_id: empresaId, ativo: true }, undefined, 1);
        cfg = cfgs?.[0] || null;
      } catch (error) {
        reportPaymentFailure('consulta_gateway', error, { empresa_id: empresaId });
      }
      // Gera link de pagamento via função existente (emitirBoleto como fallback)
      let url_fatura = null;
      try {
        const payload = {
          empresa_id: empresaId,
          group_id: checkoutGroupId,
          conta_receber_id: contaReceberId,
          pedido_id: pedidoId,
          valor,
          provider: cfg?.provedor || cfg?.gateway || 'Asaas',
          webhook: true,
        };
        const res = await base44.functions.invoke('emitirBoleto', payload);
        url_fatura = res?.data?.url || res?.data?.url_boleto || res?.data?.pix_qrcode || null;
      } catch (error) {
        reportPaymentFailure('emissao_cobranca', error, { conta_receber_id: contaReceberId });
      }
      // Atualiza CR com link (se houver)
      try {
        if (url_fatura) {
          await base44.asServiceRole.entities.ContaReceber.update(contaReceberId, {
            url_fatura: url_fatura,
            status_cobranca: 'enviada',
            data_envio_cobranca: new Date().toISOString()
          });
        }
      } catch (error) {
        reportPaymentFailure('persistencia_link_pagamento', error, { conta_receber_id: contaReceberId });
      }
      // Auditoria
      try {
        await audit(base44, user, {
          acao: 'Criação',
          modulo: 'Comercial',
          entidade: 'Checkout',
          registro_id: pedidoId,
          descricao: 'Checkout iniciado (link gerado)',
          empresa_id: empresaId,
          group_id: checkoutGroupId,
          dados_novos: { conta_receber_id: contaReceberId, valor, tem_url_fatura: Boolean(url_fatura), provider: cfg?.provedor || cfg?.gateway || 'Asaas' }
        });
      } catch (error) {
        reportPaymentFailure('auditoria_link_pagamento', error, { conta_receber_id: contaReceberId });
      }
      return Response.json({ ok: true, url_fatura });
    }

    // Webhook confirmação de pagamento do gateway
    if (action === 'webhook_pagamento') {
      const empresaId = body?.empresa_id || null;
      const contaReceberId = body?.conta_receber_id || null;
      const pedidoId = body?.pedido_id || null;
      const status = String(body?.status || '').toLowerCase();
      const valorPago = Number(body?.valor_pago || body?.valor || 0);
      if (!empresaId || !contaReceberId || !status) {
        return Response.json({ error: 'Parâmetros inválidos (webhook_pagamento)' }, { status: 400 });
      }
      try {
        const cr = await base44.asServiceRole.entities.ContaReceber.get(contaReceberId);
        const webhookScope = await resolveFinancialScope(base44, { ...body, group_id: body?.group_id || cr?.group_id || cr?.grupo_id || null, empresa_id: empresaId });
        const webhookGroupId = webhookScope.groupId || null;
        if (!webhookGroupId) {
          return Response.json({ error: 'group_id ausente para webhook_pagamento' }, { status: 400 });
        }
        if (!recordMatchesGuardScope(cr, { group_id: webhookGroupId, empresa_id: empresaId })) {
          return Response.json({ error: 'ContaReceber fora do contexto multiempresa informado' }, { status: 403 });
        }
        const beforeWebhook = buildContaFinanceiraAuditSnapshot(cr);
        const novo = Number(cr?.valor_recebido || 0) + (valorPago > 0 ? valorPago : 0);
        const quitado = novo + 0.005 >= Number(cr?.valor || 0);
        await base44.asServiceRole.entities.ContaReceber.update(contaReceberId, {
          valor_recebido: novo,
          data_recebimento: new Date().toISOString().slice(0,10),
          status: quitado ? 'Recebido' : (status === 'pago' ? 'Recebido' : cr?.status || 'Pendente'),
          status_cobranca: status === 'pago' ? 'paga' : status
        });
        // NF-e pós-pagamento (best-effort)
        try {
          if (quitado && pedidoId) {
            await base44.functions.invoke('nfeActions', { action: 'emitir_pos_pagamento', pedido_id: pedidoId, empresa_id: empresaId, group_id: webhookGroupId });
          }
        } catch (error) {
          reportPaymentFailure('emissao_fiscal_pos_pagamento', error, { pedido_id: pedidoId, empresa_id: empresaId });
        }
        await audit(base44, user, {
          acao: 'Edição',
          modulo: 'Financeiro',
          entidade: 'ContaReceber',
          registro_id: contaReceberId,
          descricao: 'Confirmação pagamento (webhook)',
          empresa_id: empresaId,
          group_id: webhookGroupId,
          dados_anteriores: beforeWebhook,
          dados_novos: { status, valorPago, valor_recebido: novo, status_final: quitado ? 'Recebido' : (status === 'pago' ? 'Recebido' : cr?.status || 'Pendente') }
        });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
      return Response.json({ ok: true, processed: true });
    }

    if (action === 'conciliar_extrato') {
      // validaremos adiante
    } else if (!['ContaPagar','ContaReceber'].includes(entity) || (!id && (!ids || !Array.isArray(ids) || ids.length === 0))) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // RBAC por módulo Financeiro
    const entityForPerm = action === 'conciliar_extrato' ? 'ContaReceber' : entity;
    const permissionScope = action === 'conciliar_extrato'
      ? { ...body, ...(conciliacao || {}) }
      : body;
    const resolvedPermissionScope = await resolveFinancialScope(base44, permissionScope);
    const scopedPermissionScope = { ...permissionScope, group_id: resolvedPermissionScope.groupId, empresa_id: resolvedPermissionScope.empresaId };
    const perm = await assertPermission(base44, ctx, 'Financeiro', entityForPerm, 'editar', scopedPermissionScope);
    if (perm) return perm;

    // Conciliacao automatica por extrato bancario
    if (action === 'conciliar_extrato') {
      const scopedConciliacao = { ...(conciliacao || {}), group_id: resolvedPermissionScope.groupId, empresa_id: resolvedPermissionScope.empresaId };
      const result = await conciliarExtrato(base44, ctx, scopedConciliacao);
      await audit(base44, user, {
        acao:'Edi��o',
        modulo:'Financeiro',
        entidade:'Concilia��o',
        registro_id: null,
        descricao: `Conciliacao automatica executada (${result.conciliados} itens)`,
        empresa_id: scopedConciliacao?.empresa_id || null,
        group_id: scopedConciliacao?.group_id || null,
        dados_novos: buildConciliacaoAuditPayload(result)
      });
      return Response.json(result);
    }

    const api = base44.asServiceRole.entities[entity];
    const idsList = (ids && Array.isArray(ids) && ids.length) ? ids : [id];
    const pagamento = normalizePagamento(pagamentoIn);
    const extraFromMulti = Array.isArray(pagamento.multiplos_meios) ? pagamento.multiplos_meios.reduce((s,m)=> s + (Number(m?.valor)||0), 0) : 0;
    const valorTotal = (Number(pagamento.valor)||0) + extraFromMulti;

    const resultados = [];
    for (const alvoId of idsList){
      const registro = await api.get(alvoId);
      if (!recordMatchesGuardScope(registro, scopedPermissionScope)) {
        return Response.json({ error: 'Registro fora do contexto multiempresa informado' }, { status: 403 });
      }
      let updates = {};
      if (isCP(entity)) {
        updates = computeUpdatesForContaPagar(action, justificativa, registro) || {};
        if (valorTotal>0) {
          const novo = Number(registro.valor_pago||0) + valorTotal;
          const quitado = novo + 0.005 >= Number(registro.valor||0);
          updates.valor_pago = novo;
          updates.data_pagamento = new Date().toISOString().slice(0,10);
          updates.status = quitado ? 'Pago' : 'Parcelado';
          updates.detalhes_pagamento = { ...(registro.detalhes_pagamento||{}), forma_pagamento: pagamento.meio, valor_liquido: novo, multimeios: pagamento.multiplos_meios, parcelas: pagamento.parcelas };
          if (pagamento.fornecedor_id && !registro.fornecedor_id) updates.fornecedor_id = pagamento.fornecedor_id;
        }
      } else if (isCR(entity)) {
        updates = computeUpdatesForContaReceber(action, justificativa, registro) || {};
        if (valorTotal>0) {
          const novo = Number(registro.valor_recebido||0) + valorTotal;
          const quitado = novo + 0.005 >= Number(registro.valor||0);
          updates.valor_recebido = novo;
          updates.data_recebimento = new Date().toISOString().slice(0,10);
          updates.status = quitado ? 'Recebido' : 'Parcial';
          updates.detalhes_pagamento = { ...(registro.detalhes_pagamento||{}), forma_pagamento: pagamento.meio, valor_liquido: novo, multimeios: pagamento.multiplos_meios, parcelas: pagamento.parcelas };
          if (pagamento.obra_id && !registro.projeto_obra) updates.projeto_obra = pagamento.obra_id;
        }
      }

      const updated = await api.update(alvoId, updates);

      await audit(base44, user, {
        acao: 'Edição', modulo: 'Financeiro', entidade: entity, registro_id: alvoId,
        descricao: idsList.length>1 ? `Baixa em lote: ${action}` : `Transição pagamento: ${action}`,
        empresa_id: registro?.empresa_id || null,
        group_id: registro?.group_id || registro?.grupo_id || scopedPermissionScope.group_id || null,
        dados_anteriores: buildContaFinanceiraAuditSnapshot(registro),
        dados_novos: buildPaymentAuditPayload({ action, updates, justificativa, pagamento })
      });

      resultados.push({ id: alvoId, ok: true });
    }

    return Response.json({ ok: true, processados: resultados.length, resultados });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});
