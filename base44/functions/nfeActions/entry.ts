import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportNfeFailure = (error, context = {}) => {
  console.error('[nfeActions] Falha em operacao auxiliar', {
    error: error?.message || String(error),
    ...context,
  });
};

const buildNfeAuditPayload = ({ action, nfe, nfeId, result }) => ({
  action,
  nfe_id: nfe?.id || nfeId || null,
  pedido_id: nfe?.pedido_id || null,
  status: result?.status || null,
  numero: result?.numero || result?.number || null,
  serie: result?.serie || result?.series || null,
  protocolo: result?.protocolo || result?.protocol || null,
  modo: result?.modo || null,
  tem_danfe: Boolean(result?.danfeUrl || result?.pdf_url || result?.pdfUrl),
  tem_xml: Boolean(result?.xmlUrl),
  sucesso: result?.sucesso ?? true,
});

async function auditNfeAction(base44, user, { action, empresaId, groupId, nfe, nfeId, result, descricao }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user?.full_name || user?.email || 'Sistema',
      usuario_id: user?.id || null,
      acao: action === 'status' ? 'Consulta' : 'Execucao',
      modulo: 'Fiscal',
      tipo_auditoria: 'integracao',
      entidade: 'NotaFiscal',
      registro_id: nfe?.id || nfeId || null,
      descricao,
      empresa_id: empresaId || null,
      group_id: groupId || null,
      dados_novos: buildNfeAuditPayload({ action, nfe, nfeId, result }),
      data_hora: new Date().toISOString(),
      sucesso: true,
    });
  } catch (error) {
    reportNfeFailure(error, { empresaId, groupId, action, nfe_id: nfe?.id || nfeId || null });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let { action = 'emitir', nfe, empresaId, empresa_id, groupId, group_id, grupo_id, nfeId, justificativa, correcao } = body || {};
    empresaId = empresaId || empresa_id || null;
    groupId = groupId || group_id || grupo_id || nfe?.group_id || nfe?.grupo_id || null;

    // Empresa requerida (proíbe emissão no grupo)
    let empresaIdResolved = empresaId || nfe?.empresa_faturamento_id || nfe?.empresa_id || null;
    if (!empresaIdResolved && nfe?.pedido_id) {
      try { const ped = await base44.asServiceRole.entities.Pedido.get(nfe.pedido_id); empresaIdResolved = ped?.empresa_id || null; groupId = groupId || ped?.group_id || ped?.grupo_id || null; } catch (error) { reportNfeFailure(error, { pedido_id: nfe.pedido_id }); }
    }
    if (!empresaIdResolved) {
      return Response.json({ error: 'Emissao NF-e no GRUPO bloqueada. Selecione uma EMPRESA (empresa_faturamento_id).' }, { status: 400 });
    }

    const resolvedScope = await completeGuardCallScope(base44, { empresaId: empresaIdResolved, groupId });
    const groupIdResolved = groupId || resolvedScope.groupId || null;

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Fiscal', section: 'NF-e', action,
      empresa_id: empresaIdResolved,
      group_id: groupIdResolved,
    });
    if (guardFailure) return guardFailure;

    // Carrega integração NF-e da empresa (Integracoes → integracao_nfe)
    let integracao = null;
    try {
      const rows = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${empresaIdResolved}`, empresa_id: empresaIdResolved }, undefined, 1);
      const doc = rows?.[0] || null;
      integracao = doc?.integracao_nfe || doc?.nfe || null;
    } catch (error) { reportNfeFailure(error, { empresaId: empresaIdResolved, groupId: groupIdResolved }); }

    // Simulado quando não configurado
    if (!integracao || integracao.ativa === false) {
      if (action === 'emitir') {
        const fake = {
          id: nfe?.id || null,
          sucesso: true,
          modo: 'simulado',
          status: 'Autorizada',
          numero: String(Math.floor(Math.random() * 999999)).padStart(6, '0'),
          serie: '1',
          chave: '00000000000000000000000000000000000000000000',
          protocolo: `SIM${Date.now()}`,
          dataAutorizacao: new Date().toISOString(),
          danfeUrl: 'https://example.com/danfe-simulado.pdf',
          xmlUrl: 'https://example.com/nfe-simulado.xml'
        };
        // Persiste se houver ID
        try { if (nfe?.id) {
          await base44.asServiceRole.entities.NotaFiscal.update(nfe.id, {
            status: 'Autorizada', numero: fake.numero, serie: fake.serie, chave_acesso: fake.chave,
            protocolo_autorizacao: fake.protocolo, pdf_danfe: fake.danfeUrl, xml_nfe: fake.xmlUrl,
            data_autorizacao: fake.dataAutorizacao
          });
        } } catch (error) { reportNfeFailure(error, { empresaId: empresaIdResolved, groupId: groupIdResolved }); }
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result: fake, descricao: 'NF-e simulada autorizada' });
        return Response.json(fake);
      }
      if (action === 'status') { const result = { status: 'Autorizada', modo: 'simulado' }; await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'Status NF-e consultado em modo simulado' }); return Response.json(result); }
      if (action === 'cancelar') { const result = { sucesso: true, protocolo: `SIMC${Date.now()}`, modo: 'simulado' }; await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'NF-e cancelada em modo simulado' }); return Response.json(result); }
      if (action === 'carta') { const result = { sucesso: true, protocolo: `SIMK${Date.now()}`, modo: 'simulado' }; await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'Carta de correcao NF-e simulada' }); return Response.json(result); }
    }

    const prov = String(integracao?.provedor || '').toLowerCase();
    // eNotas
    if (prov.includes('enotas')) {
      const apiKey = integracao.api_key;
      const empresaProvId = integracao.empresa_id_provedor;
      const baseUrl = integracao.api_url || 'https://api.enotas.com.br/v2';

      if (action === 'emitir') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` }, body: JSON.stringify(nfe)
        });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        try { if (nfe?.id) {
          await base44.asServiceRole.entities.NotaFiscal.update(nfe.id, {
            status: j?.status || 'Autorizada', numero: j?.numero || null, serie: j?.serie || null, chave_acesso: j?.chaveAcesso || j?.chave || null,
            protocolo_autorizacao: j?.protocolo || null, pdf_danfe: j?.danfeUrl || j?.pdf_url || null, xml_nfe: j?.xmlUrl || null,
            data_autorizacao: j?.dataAutorizacao || new Date().toISOString()
          });
        } } catch (error) { reportNfeFailure(error, { empresaId: empresaIdResolved, groupId: groupIdResolved }); }
        const result = { ...j, modo: 'real' };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'NF-e enviada ao provedor fiscal' });
        return Response.json(result);
      }
      if (action === 'status') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}`, { headers: { Authorization: `Basic ${btoa(apiKey + ':')}` } });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result: j, descricao: 'Status NF-e consultado no provedor fiscal' });
        return Response.json(j);
      }
      if (action === 'cancelar') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}/cancelamento`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` }, body: JSON.stringify({ motivo: justificativa || 'Cancelado pelo sistema' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        const result = { sucesso: true, protocolo: j?.protocolo || null };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'NF-e cancelada no provedor fiscal' });
        return Response.json(result);
      }
      if (action === 'carta') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}/cartaCorrecao`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` }, body: JSON.stringify({ correcao: correcao || '' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        const result = { sucesso: true, protocolo: j?.protocolo || null };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'Carta de correcao NF-e enviada ao provedor fiscal' });
        return Response.json(result);
      }
    }

    // NFe.io
    if (prov.includes('nfe.io') || prov.includes('nfeio') || prov.includes('nfeio')) {
      const apiKey = integracao.api_key;
      const baseUrl = integracao.api_url || 'https://api.nfe.io/v1';
      const headers = { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` };

      if (action === 'emitir') {
        const r = await fetch(`${baseUrl}/nfe/issue`, { method: 'POST', headers, body: JSON.stringify({ ...nfe, companyId: integracao.empresa_id_provedor }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        try { if (nfe?.id) {
          await base44.asServiceRole.entities.NotaFiscal.update(nfe.id, {
            status: j?.status || 'Autorizada', numero: j?.number || j?.numero || null, serie: j?.series || j?.serie || null, chave_acesso: j?.accessKey || j?.chave || null,
            protocolo_autorizacao: j?.protocol || j?.protocolo || null, pdf_danfe: j?.danfeUrl || j?.pdfUrl || null, xml_nfe: j?.xmlUrl || null, data_autorizacao: j?.authorizedAt || new Date().toISOString()
          });
        } } catch (error) { reportNfeFailure(error, { empresaId: empresaIdResolved, groupId: groupIdResolved }); }
        const result = { ...j, modo: 'real' };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'NF-e enviada ao provedor fiscal' });
        return Response.json(result);
      }
      if (action === 'status') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}`, { headers });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result: j, descricao: 'Status NF-e consultado no provedor fiscal' });
        return Response.json(j);
      }
      if (action === 'cancelar') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: justificativa || 'Cancelado pelo sistema' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        const result = { sucesso: true, protocolo: j?.protocol || j?.protocolo || null };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'NF-e cancelada no provedor fiscal' });
        return Response.json(result);
      }
      if (action === 'carta') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}/correction`, { method: 'POST', headers, body: JSON.stringify({ correction: correcao || '' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        const result = { sucesso: true, protocolo: j?.protocol || j?.protocolo || null };
        await auditNfeAction(base44, user, { action, empresaId: empresaIdResolved, groupId: groupIdResolved, nfe, nfeId, result, descricao: 'Carta de correcao NF-e enviada ao provedor fiscal' });
        return Response.json(result);
      }
    }

    return Response.json({ error: 'Provedor NF-e não implementado ou configuração ausente' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
