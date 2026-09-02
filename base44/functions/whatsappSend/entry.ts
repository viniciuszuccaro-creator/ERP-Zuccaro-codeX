import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportWhatsappFailure = (operation, error, context = {}) => {
  console.error('[whatsappSend] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

const maskPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? digits.replace(/\d(?=\d{4})/g, '*') : null;
};

const buildWhatsappAuditPayload = ({ action, destinatario, mensagem, arquivoUrl, legenda, retorno }) => ({
  action,
  numero_destino: maskPhone(destinatario),
  tipo: action === 'sendMedia' ? 'arquivo' : 'texto',
  tem_arquivo: Boolean(arquivoUrl),
  tem_legenda: Boolean(legenda),
  tamanho_mensagem: mensagem ? String(mensagem).length : 0,
  retorno: retorno ? {
    sucesso: retorno.sucesso ?? retorno.success ?? null,
    id: retorno.messageId || retorno.id || null,
    status: retorno.status || null,
    modo: retorno.modo || null,
  } : null,
});

async function auditWhatsapp(base44, user, { descricao, empresaId, groupId, auditPayload }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Service',
      usuario_id: user?.id || null,
      acao: 'Criacao',
      modulo: 'Integracoes',
      tipo_auditoria: 'integracao',
      entidade: 'WhatsApp',
      descricao,
      empresa_id: empresaId || null,
      group_id: groupId || null,
      dados_novos: auditPayload,
      data_hora: new Date().toISOString(),
      sucesso: true,
    });
  } catch (error) {
    reportWhatsappFailure('Falha ao auditar WhatsApp', error, { empresaId, groupId });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    let { action = 'sendText', numero, mensagem, empresaId, groupId, clienteId, pedidoId, templateKey, vars = {}, arquivoUrl, legenda, internal_token } = payload || {};

    const user = await base44.auth.me().catch(() => null);
    const trustedInternal = internal_token && Deno.env.get('DEPLOY_AUDIT_TOKEN') && internal_token === Deno.env.get('DEPLOY_AUDIT_TOKEN');
    if (!user && !trustedInternal) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Contexto multiempresa obrigatório (empresa preferencial)
    if (!empresaId && groupId) {
      // tenta resolver por pedido/cliente
      try {
        if (pedidoId) {
          const p = await base44.asServiceRole.entities.Pedido.filter({ id: pedidoId }, undefined, 1);
          empresaId = p?.[0]?.empresa_id || null;
        }
      } catch (error) { reportWhatsappFailure('Falha ao resolver Empresa pelo pedido', error, { pedidoId, groupId }); }
    }

    const resolvedScope = await completeGuardCallScope(base44, { empresaId, groupId });
    empresaId = empresaId || resolvedScope.empresaId;
    groupId = groupId || resolvedScope.groupId;

    if (!trustedInternal) {
      const guardFailure = await requireEntityGuard(base44, {
        module: 'Atendimento',
        section: 'WhatsApp',
        action: 'executar',
        empresa_id: empresaId || null,
        group_id: groupId || null,
      });
      if (guardFailure) return guardFailure;
    }

    // Resolve configuração WhatsApp
    let cfgDoc = null;
    if (empresaId) {
      const a = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${empresaId}` }, undefined, 1);
      cfgDoc = a?.[0] || null;
    }
    if (!cfgDoc && groupId) {
      const b = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_group_${groupId}` }, undefined, 1);
      cfgDoc = b?.[0] || null;
    }
    const config = cfgDoc?.integracao_whatsapp || cfgDoc?.whatsapp || null;

    // Descobrir destinatário quando não passado
    let destinatario = (numero || '').toString();
    if (!destinatario) {
      try {
        if (pedidoId) {
          const ped = await base44.asServiceRole.entities.Pedido.filter({ id: pedidoId }, undefined, 1).then(r=>r?.[0]).catch(()=>null);
          const fromContatos = Array.isArray(ped?.contatos_cliente) ? ped.contatos_cliente.find(c => /whatsapp|celular|telefone/i.test(c?.tipo || '') && c?.valor) : null;
          destinatario = fromContatos?.valor || '';
          if (!destinatario && ped?.cliente_id) {
            const cli = await base44.asServiceRole.entities.Cliente.filter({ id: ped.cliente_id }, undefined, 1).then(r=>r?.[0]).catch(()=>null);
            const contato = Array.isArray(cli?.contatos) ? cli.contatos.find(c => /whatsapp|celular|telefone/i.test(c?.tipo || '') && c?.valor) : null;
            destinatario = contato?.valor || '';
          }
        } else if (clienteId) {
          const cli = await base44.asServiceRole.entities.Cliente.filter({ id: clienteId }, undefined, 1).then(r=>r?.[0]).catch(()=>null);
          const contato = Array.isArray(cli?.contatos) ? cli.contatos.find(c => /whatsapp|celular|telefone/i.test(c?.tipo || '') && c?.valor) : null;
          destinatario = contato?.valor || '';
        }
      } catch (error) { reportWhatsappFailure('Falha ao resolver destinatario', error, { pedidoId, clienteId, empresaId, groupId }); }
    }
    destinatario = String(destinatario || '').replace(/\D/g, '');
    if (!destinatario) {
      return Response.json({ error: 'Numero de WhatsApp obrigatorio' }, { status: 400 });
    }

    // Resolve mensagem via template simples
    const templates = (config?.templates || {});
    const interpolate = (tplStr, v) => tplStr?.replace(/\{\{(.*?)\}\}/g, (_, k) => (v?.[k.trim()] ?? '')) || '';
    if (!mensagem && templateKey && templates[templateKey]) {
      mensagem = interpolate(templates[templateKey], { ...vars, pedidoId, data: new Date().toLocaleString('pt-BR') });
    }
    if (!mensagem) mensagem = `Mensagem automática do sistema. (${new Date().toLocaleString('pt-BR')})`;

    // Simulado quando nao configurado
    if (!config || config.ativo === false || config.simulacao_ativa === true) {
      const result = { sucesso: true, modo: 'simulado', messageId: `SIM_${Date.now()}`, status: 'sent' };
      await auditWhatsapp(base44, user, {
        descricao: 'Envio simulado sem configuracao ativa',
        empresaId,
        groupId,
        auditPayload: buildWhatsappAuditPayload({ action, destinatario, mensagem, arquivoUrl, legenda, retorno: result }),
      });
      return Response.json(result);
    }
    const apiKey = config.api_key;
    const apiUrl = config.api_url || 'https://evolution-api.com';
    const instanceName = config.instance_name;

    if (action === 'sendMedia') {
      const body = { number: destinatario, mediaUrl: arquivoUrl, caption: legenda || '' };
      const r = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey }, body: JSON.stringify(body) });
      if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
      const res = await r.json();
      const result = { sucesso: true, messageId: res.key?.id, status: 'sent', modo: 'real' };
      await auditWhatsapp(base44, user, {
        descricao: 'Midia enviada',
        empresaId,
        groupId,
        auditPayload: buildWhatsappAuditPayload({ action: 'sendMedia', destinatario, mensagem, arquivoUrl, legenda, retorno: result }),
      });
      return Response.json(result);
    }

    // sendText
    const bodySend = { number: destinatario, text: mensagem };
    const r = await fetch(`${apiUrl}/message/sendText/${instanceName}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey }, body: JSON.stringify(bodySend) });
    if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
    const res = await r.json();

    const result = { sucesso: true, messageId: res.key?.id, status: 'sent', modo: 'real' };
    await auditWhatsapp(base44, user, {
      descricao: 'Texto enviado',
      empresaId,
      groupId,
      auditPayload: buildWhatsappAuditPayload({ action: 'sendText', destinatario, mensagem, arquivoUrl, legenda, retorno: result }),
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
