import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// auditEntityEvents: registra em AuditLog todos os eventos de entidade (create/update/delete)
// Payload recebido por automação de entidade:
// { event:{type, entity_name, entity_id}, data, old_data, payload_too_large }
// Sem imports locais (função autônoma) e com foco em multiempresa + segurança

// Mapeia entidade -> módulo (granular para RBAC/auditoria)
function getModuleForEntity(entity) {
  const map = {
    Cliente: 'CRM', Oportunidade: 'CRM', Interacao: 'CRM',
    Pedido: 'Comercial', Comissao: 'Comercial',
    NotaFiscal: 'Fiscal',
    Entrega: 'Expedição', Romaneio: 'Expedição',
    Fornecedor: 'Compras', SolicitacaoCompra: 'Compras', OrdemCompra: 'Compras',
    Produto: 'Estoque', MovimentacaoEstoque: 'Estoque', Inventario: 'Estoque',
    ContaPagar: 'Financeiro', ContaReceber: 'Financeiro', CentroCusto: 'Financeiro',
    Evento: 'Agenda', User: 'Administração', PerfilAcesso: 'Administração'
  };
  return map[entity] || 'Sistema';
}

// Remove campos potencialmente perigosos e limita tamanho de payloads (anti-log bloat)
function safeTrimPayload(input, depth = 0) {
  if (input == null) return null;
  if (typeof input === 'string') return input.slice(0, 4000);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (Array.isArray(input)) {
    const max = 50;
    return input.slice(0, max).map((v) => safeTrimPayload(v, depth + 1));
  }
  if (typeof input === 'object') {
    const out = {};
    const entries = Object.entries(input);
    const limit = 100;
    const sensitive = /(token|senha|password|secret|api[_-]?key|authorization|certificado|private|webhook[_-]?url)/i;
    for (let i = 0; i < Math.min(entries.length, limit); i++) {
      const [k, v] = entries[i];
      if (sensitive.test(k)) {
        out[k] = { protegido: true };
        continue;
      }
      if (typeof v === 'string' && v.length > 200000) continue;
      out[k] = safeTrimPayload(v, depth + 1);
    }
    return out;
  }
  return null;
}

function computeSimpleRisk({ entity, type, record, gaps, diffSensitive }) {
  // Heurística simples de risco
  const highEntities = new Set(['NotaFiscal', 'MovimentacaoEstoque', 'ContaPagar', 'ContaReceber']);
  const hasGaps = gaps && gaps.length > 0;
  const sensitiveChange = diffSensitive && diffSensitive.length > 0;
  if (type === 'delete' && (entity === 'NotaFiscal' || entity === 'Pedido')) return { level: 'Crítico' };
  if (highEntities.has(entity) && (sensitiveChange || hasGaps)) return { level: 'Alto' };
  if (hasGaps) return { level: 'Médio' };
  return { level: 'Baixo' };
}

function detectBusinessAction(entity, type, before, after) {
  // Promove "Edição" para ações de negócio (Aprovação/Emissão/Cancelamento) quando detectar mudança de status
  if (type !== 'update') return null;
  const b = before || {}; const a = after || {};
  // Financeiro
  if (entity === 'ContaPagar' && b.status_pagamento !== a.status_pagamento) {
    if (/aprov/i.test(String(a.status_pagamento))) return 'Aprovação';
    if (/pago/i.test(String(a.status_pagamento))) return 'Liquidação';
  }
  if (entity === 'ContaReceber' && b.status !== a.status) {
    if (/recebid/i.test(String(a.status))) return 'Recebimento';
  }
  // Comercial
  if (entity === 'Pedido' && b.status_aprovacao !== a.status_aprovacao) {
    if (/aprov/i.test(String(a.status_aprovacao))) return 'Aprovação';
    if (/negad/i.test(String(a.status_aprovacao))) return 'Reprovação';
  }
  // Fiscal
  if (entity === 'NotaFiscal' && b.status !== a.status) {
    if (/autorizad/i.test(String(a.status))) return 'Emissão';
    if (/cancelad/i.test(String(a.status))) return 'Cancelamento';
  }
  return null;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const event = body?.event;
    const data = body?.data;
    const oldData = body?.old_data;
    const ua = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '';

    if (!event?.entity_name || !event?.entity_id || !event?.type) {
      return Response.json({ ok: true, skipped: true, reason: 'payload incompleto' });
    }

    // Recupera registro quando payload é grande/ausente
    let recordData = data;
    let previousData = oldData;
    try {
      if ((!recordData || body?.payload_too_large) && event?.entity_name && event?.entity_id) {
        const rows = await base44.asServiceRole.entities?.[event.entity_name]?.filter?.({ id: event.entity_id }, undefined, 1);
        recordData = rows?.[0] || recordData;
      }
    } catch (error) {
      console.error('[auditEntityEvents] Falha ao recuperar registro para auditoria', error);
    }

    const entidade = event.entity_name;
    const tipoEvento = event.type; // create | update | delete
    const modulo = getModuleForEntity(entidade);

    // Contexto multiempresa
    const empresa_id = recordData?.empresa_id || previousData?.empresa_id || null;
    const group_id = recordData?.group_id || previousData?.group_id || null;

    const gaps = [];
    if (!empresa_id) gaps.push('sem_empresa');
    if (!group_id) gaps.push('sem_grupo');

    // Campos sensíveis por entidade
    const sensitiveFieldsMap = {
      Produto: ['preco_venda','custo_aquisicao','margem_minima_percentual'],
      ContaPagar: ['valor','status_pagamento','data_pagamento','forma_pagamento'],
      ContaReceber: ['valor','status','data_recebimento','forma_recebimento'],
      MovimentacaoEstoque: ['quantidade','tipo_movimento','localizacao_destino','valor_total'],
      NotaFiscal: ['status','valor_total','chave_acesso'],
      Pedido: ['status_aprovacao','valor_total']
    };
    const sensitiveFields = sensitiveFieldsMap[entidade] || [];
    const diffSensitive = [];
    if (tipoEvento === 'update' && previousData && recordData && sensitiveFields.length) {
      for (const f of sensitiveFields) {
        const before = previousData?.[f];
        const after = recordData?.[f];
        if ((before ?? null) !== (after ?? null)) diffSensitive.push({ campo: f, antes: before, depois: after });
      }
    }

    const risk = computeSimpleRisk({ entity: entidade, type: tipoEvento, record: recordData, gaps, diffSensitive });
    const businessAction = detectBusinessAction(entidade, tipoEvento, previousData, recordData);

    // Define ação para AuditLog
    const acao = tipoEvento === 'create' ? 'Criação' : tipoEvento === 'delete' ? 'Exclusão' : (businessAction || 'Edição');

    // Tipo de auditoria enfatiza segurança quando sensível/alto risco
    const tipo_auditoria = (risk.level === 'Crítico' || risk.level === 'Alto' || diffSensitive.length)
      ? 'seguranca' : 'entidade';

    // Persistência em AuditLog (service role)
    {
      const usuarioPref = recordData?.__meta?.changed_by || recordData?.updated_by || recordData?.created_by || 'Sistema (Automação)';
      const usuarioIdPref = recordData?.updated_by_id || recordData?.created_by_id || null;
      const paramKey = entidade === 'ConfiguracaoSistema' ? (recordData?.chave || previousData?.chave || null) : null;
      const extractToggle = (obj) => {
        if (!obj || typeof obj !== 'object') return undefined;
        return (obj.notificacoes?.ativa ?? obj.seguranca?.ativa ?? obj.ia?.ativa ?? obj.integracao_nfe?.ativa ?? obj.integracao_boletos?.ativa ?? obj.integracao_maps?.ativa ?? obj.integracao_whatsapp?.ativa);
      };
      const beforeVal = extractToggle(previousData);
      const afterVal = extractToggle(recordData);
      const resumoValor = (beforeVal !== undefined || afterVal !== undefined) ? ` • valor: ${String(beforeVal)} → ${String(afterVal)}` : '';
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: usuarioPref,
        usuario_id: usuarioIdPref,
        acao,
        modulo,
        tipo_auditoria,
        entidade: entidade,
        registro_id: event.entity_id,
        descricao: `${entidade} • ${acao}${paramKey ? ' • param: ' + paramKey : ''} • risco ${risk.level}${gaps.length ? ' • gaps: ' + gaps.join(',') : ''}${diffSensitive.length ? ' • mudança sensível' : ''}${resumoValor}`,
        empresa_id: empresa_id || null,
        group_id: group_id || null,
        dados_anteriores: tipoEvento !== 'create' ? safeTrimPayload(previousData) : null,
        dados_novos: tipoEvento !== 'delete' ? safeTrimPayload({ ...recordData, __diff_sensitive: diffSensitive, __risk: risk }) : null,
        ip_address: ip,
        user_agent: ua,
        data_hora: new Date().toISOString(),
      });
    }

    // Telemetria de performance
    const dur = Date.now() - t0;
    if (dur > 500) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: 'Sistema',
          acao: 'Visualização',
          modulo: 'Sistema',
          tipo_auditoria: 'sistema',
          entidade: 'Performance',
          descricao: `auditEntityEvents lento: ${dur}ms`,
          dados_novos: { entidade, tipoEvento, dur },
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[auditEntityEvents] Falha ao registrar telemetria de performance', error);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[auditEntityEvents]', err?.message || err);
    return Response.json({ error: 'Falha ao registrar auditoria' }, { status: 500 });
  }
});