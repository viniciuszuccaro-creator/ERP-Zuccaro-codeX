import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const reportFiscalValidationFailure = (error) => {
  console.error('[fiscalValidation] Falha em operacao auxiliar', error?.message || String(error));
};

Deno.serve(async (req) => {
  const start = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    // Suporta payload de automação (event + data) ou chamada direta
    let payload;
    try { payload = await req.json(); } catch { payload = {}; }

    const event = payload?.event || null;
    const dataIn = payload?.data || null;
    const entityName = event?.entity_name || payload?.entity_name;
    const entityId = event?.entity_id || payload?.entity_id;

    if (!entityName || !entityId || !['Cliente','Fornecedor','NotaFiscal'].includes(entityName)) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Busca registro atual com service role (automação interna)
    const registro = dataIn || await base44.asServiceRole.entities[entityName].get(entityId);

    // Regra: NF-e só pode ser emitida na empresa de origem do Pedido
    if (entityName === 'NotaFiscal') {
      const empresaNota = registro?.empresa_faturamento_id || registro?.empresa_origem_id || registro?.empresa_id || null;
      let empresaPedido = null;
      try {
        if (registro?.pedido_id) {
          const ped = await base44.asServiceRole.entities.Pedido.get(registro.pedido_id);
          empresaPedido = ped?.empresa_id || ped?.empresa_faturamento_id || null;
        }
      } catch (error) { reportFiscalValidationFailure(error); }
      if (empresaPedido && empresaNota && empresaNota !== empresaPedido) {
        try {
          const prev = registro?.validacao_ia_pre_emissao || {};
          await base44.asServiceRole.entities.NotaFiscal.update(entityId, {
            status: 'Rascunho',
            validacao_ia_pre_emissao: {
              ...prev,
              validada: false,
              bloqueio_emissao: true,
              data_validacao: new Date().toISOString(),
              conflitos_detectados: [
                ...(Array.isArray(prev?.conflitos_detectados) ? prev.conflitos_detectados : []),
                { tipo: 'Empresa Origem Divergente', descricao: `Pedido: ${empresaPedido} → NF: ${empresaNota}`, severidade: 'Bloqueante', campo_afetado: 'empresa_faturamento_id' }
              ]
            }
          });
        } catch (error) { reportFiscalValidationFailure(error); }
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            usuario: 'automacao', acao: 'Bloqueio', modulo: 'Fiscal', tipo_auditoria: 'ia', entidade: 'NotaFiscal', registro_id: entityId,
            descricao: 'Bloqueio de emissão: empresa de origem divergente do Pedido',
            empresa_id: empresaNota || null, group_id: registro?.group_id || null,
            data_hora: new Date().toISOString(), sucesso: true
          });
        } catch (error) { reportFiscalValidationFailure(error); }
        return Response.json({ success: false, blocked: true, reason: 'empresa_origem_mismatch' });
      }
      // OK quando não há divergência
      return Response.json({ success: true, validated: true });
    }

    const cnpj = registro?.cnpj || null;
    if (!cnpj) {
      return Response.json({ success: true, skipped: true, reason: 'Sem CNPJ para validar' });
    }

    let consulta = null;
    try {
      const r = await base44.asServiceRole.functions.invoke('ConsultarCNPJ', { cnpj });
      consulta = r?.data || null;
    } catch (err) {
      // Fallback simples via LLM para sugerir status/regime a partir de descrição
      try {
        const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Você é um assistente fiscal. Com base no CNPJ ${cnpj} e nos dados: ${JSON.stringify({ nome: registro?.nome || registro?.razao_social, ramo_atividade: registro?.ramo_atividade })}\nResponda JSON com status_fiscal_receita (Ativa/Inapta/Suspensa/Baixada/Não Verificado), cnae_principal (string), regime_tributario (Simples Nacional/Lucro Presumido/Lucro Real).`,
          response_json_schema: {
            type: 'object',
            properties: {
              status_fiscal_receita: { type: 'string' },
              cnae_principal: { type: 'string' },
              regime_tributario: { type: 'string' },
            },
          },
        });
        consulta = llm;
      } catch (error) { reportFiscalValidationFailure(error); }
    }

    const patch = {};
    const statusLLM = consulta?.status_fiscal_receita || consulta?.status || consulta?.situacao;
    if (statusLLM) patch.status_fiscal_receita = statusLLM;
    if (consulta?.cnae_principal) patch.cnae_principal = String(consulta.cnae_principal);

    // Sinalização de revisão quando houver divergência
    if (registro?.status_fiscal_receita && statusLLM && registro.status_fiscal_receita !== statusLLM) {
      patch.validacao_ia_pre_emissao = {
        ...(registro?.validacao_ia_pre_emissao || {}),
        validada: false,
        conflitos_detectados: [
          { tipo: 'Status Fiscal Divergente', descricao: `Anterior: ${registro.status_fiscal_receita} → Novo: ${statusLLM}`, severidade: 'Aviso', campo_afetado: 'status_fiscal_receita' }
        ],
        bloqueio_emissao: false,
        data_validacao: new Date().toISOString(),
      };
    }
    if (consulta?.regime_tributario) {
      if (entityName === 'Cliente') {
        patch.configuracao_fiscal = {
          ...(registro?.configuracao_fiscal || {}),
          regime_tributario: consulta.regime_tributario,
        };
      }
    }

    if (Object.keys(patch).length > 0) {
      await base44.asServiceRole.entities[entityName].update(entityId, patch);
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: 'automacao',
        acao: 'Edição',
        modulo: 'Fiscal',
        entidade: entityName,
        registro_id: entityId,
        descricao: `Validação fiscal automática (${cnpj})`,
        dados_novos: patch,
        duracao_ms: Date.now() - start,
      });
    } catch (error) { reportFiscalValidationFailure(error); }

    return Response.json({ success: true, updated: patch });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
