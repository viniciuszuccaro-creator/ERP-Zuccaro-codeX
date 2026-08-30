import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'emitir', nfe, empresaId, nfeId, justificativa, correcao } = body || {};

    // Empresa requerida (proíbe emissão no grupo)
    let empresaIdResolved = empresaId || nfe?.empresa_faturamento_id || nfe?.empresa_id || null;
    if (!empresaIdResolved && nfe?.pedido_id) {
      try { const ped = await base44.asServiceRole.entities.Pedido.get(nfe.pedido_id); empresaIdResolved = ped?.empresa_id || null; } catch (_) {}
    }
    if (!empresaIdResolved) {
      return Response.json({ error: 'Emissão NF-e no GRUPO bloqueada. Selecione uma EMPRESA (empresa_faturamento_id).' }, { status: 400 });
    }

    const guardFailure = await requireEntityGuard(base44, {
      module: 'Fiscal', section: 'NF-e', action,
      empresa_id: empresaIdResolved,
      group_id: body?.group_id || nfe?.group_id || null,
    });
    if (guardFailure) return guardFailure;

    // Carrega integração NF-e da empresa (Integracoes → integracao_nfe)
    let integracao = null;
    try {
      const rows = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${empresaIdResolved}` }, undefined, 1);
      const doc = rows?.[0] || null;
      integracao = doc?.integracao_nfe || doc?.nfe || null;
    } catch (_) {}

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
        } } catch (_) {}
        return Response.json(fake);
      }
      if (action === 'status') return Response.json({ status: 'Autorizada', modo: 'simulado' });
      if (action === 'cancelar') return Response.json({ sucesso: true, protocolo: `SIMC${Date.now()}`, modo: 'simulado' });
      if (action === 'carta') return Response.json({ sucesso: true, protocolo: `SIMK${Date.now()}`, modo: 'simulado' });
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
        } } catch (_) {}
        return Response.json({ ...j, modo: 'real' });
      }
      if (action === 'status') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}`, { headers: { Authorization: `Basic ${btoa(apiKey + ':')}` } });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json(j);
      }
      if (action === 'cancelar') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}/cancelamento`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` }, body: JSON.stringify({ motivo: justificativa || 'Cancelado pelo sistema' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json({ sucesso: true, protocolo: j?.protocolo || null });
      }
      if (action === 'carta') {
        const r = await fetch(`${baseUrl}/empresas/${empresaProvId}/nfes/${nfeId}/cartaCorrecao`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(apiKey + ':')}` }, body: JSON.stringify({ correcao: correcao || '' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json({ sucesso: true, protocolo: j?.protocolo || null });
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
        } } catch (_) {}
        return Response.json({ ...j, modo: 'real' });
      }
      if (action === 'status') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}`, { headers });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json(j);
      }
      if (action === 'cancelar') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}/cancel`, { method: 'POST', headers, body: JSON.stringify({ reason: justificativa || 'Cancelado pelo sistema' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json({ sucesso: true, protocolo: j?.protocol || j?.protocolo || null });
      }
      if (action === 'carta') {
        const r = await fetch(`${baseUrl}/nfe/${nfeId}/correction`, { method: 'POST', headers, body: JSON.stringify({ correction: correcao || '' }) });
        if (!r.ok) return Response.json({ error: await r.text() }, { status: 502 });
        const j = await r.json();
        return Response.json({ sucesso: true, protocolo: j?.protocol || j?.protocolo || null });
      }
    }

    return Response.json({ error: 'Provedor NF-e não implementado ou configuração ausente' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
