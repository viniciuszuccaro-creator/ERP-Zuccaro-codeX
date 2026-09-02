import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission, assertContextPresence, audit } from './_lib/guard';

const maskEmail = (value) => {
  const email = String(value || '').trim();
  const [local, domain] = email.split('@');
  if (!local || !domain) return email || null;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
};

const buildEmailAuditPayload = ({ destinatario, destinatario_nome, assunto, tipo_conteudo, anexos, action, retorno }) => ({
  action,
  destinatario: maskEmail(destinatario),
  destinatario_nome: destinatario_nome || null,
  assunto,
  tipo_conteudo,
  quantidade_anexos: Array.isArray(anexos) ? anexos.length : 0,
  retorno: retorno ? {
    sucesso: retorno.sucesso ?? retorno.success ?? null,
    status: retorno.status || null,
    modo: retorno.modo || null,
  } : null,
});

async function resolveGroupId(base44, empresaId, groupId) {
  if (groupId || !empresaId) return groupId || null;
  const empresas = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId }, undefined, 1).catch(() => []);
  const empresa = Array.isArray(empresas) ? empresas[0] : null;
  return empresa?.group_id || empresa?.grupo_id || null;
}

async function auditEmailSend(base44, user, { descricao, empresaId, groupId, payload, retorno }) {
  await audit(base44, user, {
    acao: 'Criacao',
    modulo: 'Integracoes',
    entidade: 'Email',
    descricao,
    empresa_id: empresaId || null,
    group_id: groupId || null,
    dados_novos: buildEmailAuditPayload({ ...payload, retorno }),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    let { empresaId, empresa_id, groupId, group_id, grupo_id, destinatario, destinatario_nome, assunto, mensagem, tipo_conteudo = 'html', anexos = [], action = 'send' } = payload || {};
    empresaId = empresaId || empresa_id || null;
    groupId = groupId || group_id || grupo_id || null;
    groupId = await resolveGroupId(base44, empresaId, groupId);

    const ctx = await getUserAndPerfil(base44);
    const permErr = await assertPermission(base44, ctx, 'Integrações', 'Email', action === 'status' ? 'visualizar' : 'criar');
    if (permErr) return permErr;
    const ctxErr = assertContextPresence({ empresa_id: empresaId, group_id: groupId }, true);
    if (ctxErr) return ctxErr;

    // Busca configuração de Email
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Email', chave: `email_${empresaId}`, empresa_id: empresaId });
    const emailCfg = cfgs?.[0]?.configuracoes_email || null;

    if (action === 'status') {
      return Response.json({ configurado: !!emailCfg, provedor: emailCfg?.provedor || 'Core' });
    }

    // Se não configurado, usa integração segura do Core
    if (!emailCfg || emailCfg.ativo === false) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: destinatario, subject: assunto, body: mensagem });
      await auditEmailSend(base44, user, { descricao: 'Email enviado via Core', empresaId, groupId, payload: { destinatario, destinatario_nome, assunto, tipo_conteudo, anexos, action }, retorno: { sucesso: true, modo: 'core', status: 'enviado' } });
      return Response.json({ sucesso: true, modo: 'core', status: 'enviado' });
    }

    const provedor = emailCfg.provedor;

    if (provedor === 'SendGrid') {
      const payloadSG = {
        personalizations: [{ to: [{ email: destinatario, name: destinatario_nome }], subject: assunto }],
        from: { email: emailCfg.email_remetente || 'noreply@zuccaro.com.br', name: emailCfg.nome_remetente || 'ERP Zuccaro' },
        content: [{ type: tipo_conteudo === 'html' ? 'text/html' : 'text/plain', value: mensagem }],
      };
      if (anexos?.length) {
        payloadSG.attachments = anexos.map(a => ({ content: a.conteudo_base64, filename: a.nome_arquivo, type: a.tipo_mime, disposition: 'attachment' }));
      }
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emailCfg.api_key}` }, body: JSON.stringify(payloadSG) });
      if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
      await auditEmailSend(base44, user, { descricao: 'Email enviado via SendGrid', empresaId, groupId, payload: { destinatario, destinatario_nome, assunto, tipo_conteudo, anexos, action }, retorno: { sucesso: true, modo: 'real', status: 'enviado' } });
      return Response.json({ sucesso: true, modo: 'real', status: 'enviado' });
    }

    // Fallback padrão (ou provedores não implementados): usa Core
    await base44.asServiceRole.integrations.Core.SendEmail({ to: destinatario, subject: assunto, body: mensagem });
    await auditEmailSend(base44, user, { descricao: 'Email enviado via fallback Core', empresaId, groupId, payload: { destinatario, destinatario_nome, assunto, tipo_conteudo, anexos, action }, retorno: { sucesso: true, modo: 'core', status: 'enviado' } });
    return Response.json({ sucesso: true, modo: 'core', status: 'enviado' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
