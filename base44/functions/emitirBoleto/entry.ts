import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportBoletoFailure = (operation, error, context = {}) => {
  console.error('[emitirBoleto] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

const buildBoletoAuditPayload = ({ provider, billingType, externalId, pdf, linha, pix, forma_cobranca, projeto_obra }) => ({
  provider,
  billingType: billingType || null,
  external_id: externalId || null,
  tem_pdf: Boolean(pdf),
  tem_linha_digitavel: Boolean(linha),
  tem_pix: Boolean(pix),
  forma_cobranca: forma_cobranca || null,
  projeto_obra: projeto_obra || null,
});

async function auditBoleto(base44, user, { contaReceberId, empresaId, groupId, descricao, payload }) {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: user?.full_name || user?.email || 'Usuario',
    usuario_id: user?.id || null,
    acao: 'Criacao',
    modulo: 'Financeiro',
    tipo_auditoria: 'integracao',
    entidade: 'ContaReceber',
    registro_id: contaReceberId,
    descricao,
    empresa_id: empresaId || null,
    group_id: groupId || null,
    dados_novos: payload,
    data_hora: new Date().toISOString(),
    sucesso: true,
  });
}
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { conta_receber_id, forma_cobranca, projeto_obra, simular } = body || {};
    const me = await base44.auth.me();
    if (!conta_receber_id) {
      return Response.json({ error: 'conta_receber_id é obrigatório' }, { status: 400 });
    }

    // Buscar CR
    const crList = await base44.entities.ContaReceber.filter({ id: conta_receber_id });
    const cr = crList?.[0];
    if (!cr) {
      return Response.json({ error: 'ContaReceber não encontrada' }, { status: 404 });
    }

    // Contexto multiempresa obrigatorio
    if (!cr.empresa_id) {
      return Response.json({ error: 'empresa_id ausente no titulo' }, { status: 400 });
    }
    const resolvedScope = await completeGuardCallScope(base44, { empresaId: cr.empresa_id, groupId: cr.group_id || cr.grupo_id || body?.group_id || body?.grupo_id || null });
    const groupIdResolved = cr.group_id || cr.grupo_id || resolvedScope.groupId || null;
    if (!groupIdResolved) {
      return Response.json({ error: 'group_id ausente no titulo ou cadastro da empresa' }, { status: 400 });
    }

    // Permissão: libera autoatendimento do cliente (portal) para seus próprios títulos visíveis no portal
    let isPortalSelfAccess = false;
    try {
      const cList = await base44.entities.Cliente.filter({ portal_usuario_id: me.id }, undefined, 1);
      const c = cList?.[0] || null;
      isPortalSelfAccess = !!(c && cr.cliente_id === c.id && cr.visivel_no_portal === true);
    } catch (_) {}

    if (!isPortalSelfAccess) {
      const guardFailure = await requireEntityGuard(base44, {
        module: 'Financeiro', section: 'ContaReceber', action: 'emitir',
        empresa_id: cr.empresa_id || null, group_id: groupIdResolved,
      });
      if (guardFailure) return guardFailure;
    }

    // Integração real: Asaas / Juno (quando configurado)
    try {
      let cfgDoc = null;
      try {
        cfgDoc = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ categoria: 'Integracoes', chave: `integracoes_${cr.empresa_id}`, empresa_id: cr.empresa_id }, undefined, 1);
        cfgDoc = cfgDoc?.[0] || null;
      } catch (error) { reportBoletoFailure('consulta_configuracao', error, { empresa_id: cr.empresa_id, group_id: groupIdResolved }); cfgDoc = null; }
      const payCfg = cfgDoc?.integracao_boletos || cfgDoc?.integracao_pagamentos || null;

      if (payCfg?.ativo) {
        // Asaas
        if ((payCfg.provedor || '').toLowerCase() === 'asaas') {
          const apiUrl = payCfg.api_url || 'https://api.asaas.com/api/v3';
          const headers = { 'Content-Type': 'application/json', 'access_token': payCfg.api_key };
          const customerId = payCfg.customers_map?.[cr.cliente_id] || payCfg.customer_id_default || null;
          if (customerId) {
            const billingType = ((forma_cobranca || cr.forma_cobranca) === 'PIX') ? 'PIX' : 'BOLETO';
            const body = { customer: customerId, billingType, value: Number(cr.valor||0), dueDate: cr.data_vencimento, externalReference: cr.id, description: cr.descricao || 'Cobrança ERP' };
            const r = await fetch(`${apiUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (r.ok) {
              const j = await r.json();
              const pdf = j?.bankSlipUrl || j?.invoiceUrl || j?.boletoUrl || null;
              const linha = j?.identificationField || j?.bankSlipBarcode || null;
              const pix = j?.pixQrCode || j?.pixQrCodeId || null;
              await base44.asServiceRole.entities.ContaReceber.update(conta_receber_id, {
                url_boleto_pdf: pdf,
                url_fatura: j?.invoiceUrl || pdf,
                boleto_linha_digitavel: linha,
                pix_qrcode: pix,
                pix_copia_cola: j?.pixQrCodeText || j?.pixCopyPaste || j?.pix_copia_cola || null,
                id_cobranca_externa: j?.id,
                gateway_usado_nome: 'Asaas',
                gateway_usado_id: 'asaas',
                provedor_pagamento: 'Asaas',
                status_cobranca: 'gerada',
                data_envio_cobranca: new Date().toISOString()
              });
              await auditBoleto(base44, me, {
                contaReceberId: conta_receber_id,
                empresaId: cr.empresa_id,
                groupId: groupIdResolved,
                descricao: `Cobranca criada via Asaas (${billingType})`,
                payload: buildBoletoAuditPayload({ provider: 'Asaas', billingType, externalId: j?.id, pdf, linha, pix, forma_cobranca, projeto_obra }),
              });
              return Response.json({ url: pdf || j?.invoiceUrl || null, provider: 'Asaas', id: j?.id });
            }
          }
        }
        // Juno
        if ((payCfg.provedor || '').toLowerCase() === 'juno') {
          const apiUrl = payCfg.api_url || 'https://api.juno.com.br';
          const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${payCfg.api_key}` };
          const chargeBody = {
            charge: { description: cr.descricao || 'Cobrança ERP', amount: String(Number(cr.valor||0).toFixed(2)), dueDate: cr.data_vencimento, references: [cr.id] },
            billing: { name: cr.cliente || cr.cliente_id || 'Cliente', document: cr.cliente_cpf_cnpj || null }
          };
          const r = await fetch(`${apiUrl}/charges`, { method: 'POST', headers, body: JSON.stringify(chargeBody) });
          if (r.ok) {
            const j = await r.json();
            const ch = Array.isArray(j?.data) ? j.data[0] : j;
            const pdf = ch?.billetDetails?.bankSlipUrl || ch?.link || null;
            const linha = ch?.billetDetails?.barcodeNumber || null;
            await base44.asServiceRole.entities.ContaReceber.update(conta_receber_id, {
              url_boleto_pdf: pdf,
              boleto_linha_digitavel: linha,
              id_cobranca_externa: ch?.id,
              gateway_usado_nome: 'Juno',
              gateway_usado_id: 'juno',
              provedor_pagamento: 'Juno',
              status_cobranca: 'gerada',
              data_envio_cobranca: new Date().toISOString()
            });
            await auditBoleto(base44, me, {
              contaReceberId: conta_receber_id,
              empresaId: cr.empresa_id,
              groupId: groupIdResolved,
              descricao: 'Boleto criado via Juno',
              payload: buildBoletoAuditPayload({ provider: 'Juno', externalId: ch?.id, pdf, linha, pix: null, forma_cobranca, projeto_obra }),
            });
            return Response.json({ url: pdf, provider: 'Juno', id: ch?.id });
          }
        }
      }
    } catch (error) { reportBoletoFailure('integracao_pagamento_real', error, { conta_receber_id, empresa_id: cr.empresa_id, group_id: groupIdResolved }); /* fallback para simulado abaixo */ }

    // Gerar PDF simples do boleto (simulado)
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Boleto (Simulado) - ERP Zuccaro', 20, 20);

    doc.setFontSize(11);
    const y0 = 35;
    const linhas = [
      `Cliente ID: ${cr.cliente_id || '-'}`,
      `Descrição: ${cr.descricao || 'Boleto gerado via Chatbot'}`,
      `Valor: R$ ${(cr.valor || 0).toLocaleString('pt-BR')}`,
      `Vencimento: ${cr.data_vencimento || '-'}`,
      `Forma: ${cr.forma_cobranca || 'Boleto'}`,
      `Empresa: ${cr.empresa_id || '-'}`,
      `Linha Digitável: 00000.00000 00000.000000 00000.000000 0 00000000000000 (simulado)`
    ];
    linhas.forEach((t, i) => doc.text(t, 20, y0 + i * 8));

    doc.setFontSize(9);
    doc.text('Documento gerado automaticamente pelo Chatbot • Válido para testes e homologação', 20, y0 + linhas.length * 8 + 10);

    const pdfBytes = doc.output('arraybuffer');
    const file = new File([pdfBytes], `boleto_${conta_receber_id}.pdf`, { type: 'application/pdf' });

    // Upload privado e URL assinada
    const up = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const fileUri = up?.file_uri;
    let signedUrl = null;
    if (fileUri) {
      const su = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 * 24 });
      signedUrl = su?.signed_url || null;
    }

    // Atualizar CR
    await base44.asServiceRole.entities.ContaReceber.update(conta_receber_id, {
      url_boleto_pdf: signedUrl,
      status_cobranca: 'gerada',
      data_envio_cobranca: new Date().toISOString(),
      gateway_usado_nome: 'Boleto (Simulado)',
      gateway_usado_id: 'simulado',
      provedor_pagamento: 'boleto_simulado',
      linha_digitavel: '00000.00000 00000.000000 00000.000000 0 00000000000000 (simulado)',
      ...(forma_cobranca ? { forma_cobranca } : {}),
      ...(projeto_obra ? { projeto_obra } : {})
    });

    // Auditoria
    await auditBoleto(base44, me, {
      contaReceberId: conta_receber_id,
      empresaId: cr.empresa_id,
      groupId: groupIdResolved,
      descricao: 'Boleto PDF emitido e URL assinada gerada',
      payload: buildBoletoAuditPayload({ provider: 'Boleto (Simulado)', externalId: null, pdf: signedUrl, linha: true, pix: null, forma_cobranca: forma_cobranca || cr.forma_cobranca || 'Boleto', projeto_obra: projeto_obra || cr.projeto_obra || null }),
    });

    return Response.json({ url: signedUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
