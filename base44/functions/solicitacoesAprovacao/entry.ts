import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MANUAL_RECONCILIATION_TYPE = 'conciliacao_migracao_financeira';
const MANUAL_RECONCILIATION_STATUS = 'PENDING_MANUAL_RECONCILIATION';
const MANUAL_RECONCILIATION_ENTITIES = new Set(['ContaPagar', 'ContaReceber']);
const MANUAL_SECRET_PARTS = ['password', 'senha', 'token', 'secret', 'authorization', 'api_key', 'apikey', 'certificado', 'certificate'];

const firstText = (...values) => values.map((value) => String(value ?? '').trim()).find(Boolean) || '';

function isManualReconciliationRequest(record: Record<string, unknown> = {}) {
  return firstText(record?.tipo_solicitacao) === MANUAL_RECONCILIATION_TYPE;
}

function sanitizeManualValue(value, depth = 0) {
  if (depth > 8) return '[limite-de-profundidade]';
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeManualValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 300).flatMap(([key, item]) => {
      const normalized = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (MANUAL_SECRET_PARTS.some((part) => normalized.includes(part))) return [];
      return [[key, sanitizeManualValue(item, depth + 1)]];
    }));
  }
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').slice(0, 4000).trim();
  return value;
}

function userHasManualScope(user, groupId, empresaId) {
  const groupIds = new Set([
    user?.group_id, user?.grupo_atual_id, user?.grupo_padrao_id,
    ...(Array.isArray(user?.grupos_vinculados) ? user.grupos_vinculados.filter((item) => item?.ativo !== false).map((item) => item?.grupo_id) : []),
    ...(Array.isArray(user?.empresas_vinculadas) ? user.empresas_vinculadas.filter((item) => item?.ativo !== false).map((item) => item?.group_id || item?.grupo_id) : []),
  ].map((value) => firstText(value)).filter(Boolean));
  const empresaIds = new Set([
    user?.empresa_atual_id, user?.empresa_padrao_id,
    ...(Array.isArray(user?.empresas_vinculadas) ? user.empresas_vinculadas.filter((item) => item?.ativo !== false).map((item) => item?.empresa_id) : []),
  ].map((value) => firstText(value)).filter(Boolean));
  return groupIds.has(groupId) && empresaIds.has(empresaId);
}

async function resolveManualScope(base44, user, input: Record<string, unknown> = {}) {
  const groupId = firstText(input?.group_id, input?.groupId);
  const empresaId = firstText(input?.empresa_id, input?.empresaId);
  const scopeType = firstText(input?.scope_type, input?.scopeType).toLowerCase();
  if (scopeType !== 'empresa' || !groupId || !empresaId) {
    return { response: Response.json({ error: 'Contexto de Empresa exige scope_type, group_id e empresa_id' }, { status: 400 }) };
  }
  try {
    const empresa = await base44.asServiceRole.entities.Empresa.get(empresaId);
    if (!empresa || firstText(empresa?.group_id, empresa?.grupo_id) !== groupId) {
      try { await auditManualStaging(base44, user, { group_id: groupId, empresa_id: empresaId }, 'Bloqueio', false); }
      catch (auditError) { reportApprovalFailure('Falha ao auditar Empresa fora do Grupo', auditError, { group_id: groupId, empresa_id: empresaId }); return { response: Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }) }; }
      return { response: Response.json({ error: 'Empresa nao pertence ao Grupo informado' }, { status: 403 }) };
    }
  } catch (error) {
    reportApprovalFailure('Falha ao validar Empresa da conciliacao', error, { group_id: groupId, empresa_id: empresaId });
    return { response: Response.json({ error: 'Validacao multiempresa indisponivel' }, { status: 503 }) };
  }
  if (!userHasManualScope(user, groupId, empresaId)) {
    try { await auditManualStaging(base44, user, { group_id: groupId, empresa_id: empresaId }, 'Bloqueio', false); }
    catch (error) { reportApprovalFailure('Falha ao auditar escopo negado', error, { group_id: groupId, empresa_id: empresaId }); return { response: Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }) }; }
    return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { groupId, empresaId, scopeType };
}

function buildManualRecord(input, user, scope) {
  const request = input?.approval_request || input?.solicitacao || {};
  const envelope = request?.dados_propostos?.envelope_staging;
  const entityName = firstText(request?.entidade_alvo);
  const legacyCode = firstText(request?.referencia_staging);
  const expectedKey = ['migracao-conciliacao', scope.groupId, scope.empresaId, entityName, legacyCode].join('|');
  const envelopeSize = (() => { try { return JSON.stringify(envelope || {}).length; } catch { return Infinity; } })();
  const history = Array.isArray(envelope?.historico_conciliacao) ? envelope.historico_conciliacao : [];
  const initialEvent = history[0] || {};
  const valid = isManualReconciliationRequest(request)
    && request?.bloqueio_operacional === true
    && firstText(request?.status) === 'pendente'
    && firstText(request?.origem) === 'staging_migracao'
    && (request?.entidade_alvo_id === null || request?.entidade_alvo_id === undefined)
    && MANUAL_RECONCILIATION_ENTITIES.has(entityName)
    && Boolean(legacyCode)
    && firstText(request?.idempotency_key) === expectedKey
    && firstText(request?.group_id) === scope.groupId
    && firstText(request?.empresa_id) === scope.empresaId
    && firstText(request?.scope_type).toLowerCase() === 'empresa'
    && firstText(envelope?.status_migracao).toUpperCase() === MANUAL_RECONCILIATION_STATUS
    && firstText(envelope?.destino_migracao).toLowerCase() === 'staging'
    && envelope?.requer_conciliacao_manual === true
    && envelope?.bloqueio_operacional === true
    && envelope?.confirmado === false
    && firstText(envelope?.etapa_conciliacao) === 'aguardando_evidencia'
    && (envelope?.decisao_financeira === null || envelope?.decisao_financeira === undefined)
    && Array.isArray(envelope?.evidencias_conciliacao) && envelope.evidencias_conciliacao.length === 0
    && Array.isArray(envelope?.aprovacoes_conciliacao) && envelope.aprovacoes_conciliacao.length === 0
    && history.length === 1
    && firstText(initialEvent?.acao) === 'marcado_pendente_conciliacao_manual'
    && Boolean(firstText(initialEvent?.usuario_id))
    && !Number.isNaN(Date.parse(firstText(initialEvent?.timestamp)))
    && firstText(initialEvent?.group_id) === scope.groupId
    && firstText(initialEvent?.empresa_id) === scope.empresaId
    && firstText(envelope?.group_id, envelope?.grupo_id) === scope.groupId
    && firstText(envelope?.empresa_id) === scope.empresaId
    && firstText(envelope?.entidade_migracao) === entityName
    && firstText(envelope?.codigo_legado, envelope?.id_antigo) === legacyCode
    && envelopeSize <= 250000;
  if (!valid) return { error: 'Envelope de conciliacao financeira invalido ou inconsistente' };

  const now = new Date().toISOString();
  return { record: {
    group_id: scope.groupId, empresa_id: scope.empresaId, scope_type: 'empresa',
    solicitante_id: user.id,
    solicitante_nome: firstText(user.full_name, user.email, user.id).replace(/<[^>]*>/g, '').slice(0, 160),
    tipo_solicitacao: MANUAL_RECONCILIATION_TYPE, entidade_alvo: entityName, entidade_alvo_id: null,
    referencia_staging: legacyCode, idempotency_key: expectedKey,
    dados_propostos: { operation: 'manual_reconciliation_staging', envelope_staging: sanitizeManualValue(envelope) },
    justificativa: 'Pendencia legada exige conciliacao financeira manual.',
    perfil_aprovador_necessario: 'Financeiro.Migracao.aprovar',
    status: 'pendente', data_solicitacao: now, origem: 'staging_migracao', bloqueio_operacional: true,
  } };
}

async function auditManualStaging(base44, user, record, acao, sucesso = true) {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: user?.full_name || user?.email || 'Usuario', usuario_id: user?.id,
    empresa_id: record?.empresa_id || null, group_id: record?.group_id || null,
    acao, modulo: 'Financeiro', tipo_auditoria: 'migracao', entidade: 'SolicitacaoAprovacao',
    registro_id: record?.id || null, descricao: `${acao} de conciliacao financeira em staging`,
    dados_novos: { tipo_solicitacao: MANUAL_RECONCILIATION_TYPE, entidade_alvo: record?.entidade_alvo || null, referencia_staging: record?.referencia_staging || null, status: record?.status || null, bloqueio_operacional: true },
    data_hora: new Date().toISOString(), sucesso,
  });
}

const reportApprovalFailure = (operation, error, context = {}) => {
  console.error('[solicitacoesAprovacao] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

// Self-contained guards (no local imports per platform rules)
async function hasPermission(base44, user, moduleName, section, action) {
  try {
    const pid = user?.perfil_acesso_id;
    if (!pid) return false;
    const perfil = await base44.asServiceRole.entities.PerfilAcesso.get(pid);
    const perms = perfil?.permissoes;
    if (!perms) return false;
    const desired = String(action || 'visualizar').toLowerCase();
    if (Array.isArray(perms['*']) && (perms['*'].includes(desired) || (desired === 'visualizar' && perms['*'].includes('ver')))) {
      return true;
    }
    const mod = perms?.[moduleName];
    if (!mod) return false;
    const actions = Array.isArray(mod?.[section]) ? mod[section] : Array.isArray(mod?.['*']) ? mod['*'] : [];
    const aliases = { visualizar: ['ver', 'visualizar'], aprovar: ['aprovar', 'gerir'], criar: ['criar', 'inserir', 'abrir'] };
    const list = aliases[desired] || [desired];
    return actions.some((a) => list.includes(String(a).toLowerCase()));
  } catch (error) {
    reportApprovalFailure('Falha ao avaliar permissao', error, { moduleName, section, action, user_id: user?.id });
    return false;
  }
}

function assertContextPresence(ctx, requireEmpresa) {
  const empresa_id = ctx?.empresa_id ?? ctx?.empresaId ?? null;
  const group_id = ctx?.group_id ?? ctx?.groupId ?? null;
  if (requireEmpresa && !(empresa_id || group_id)) {
    return Response.json({ error: 'Contexto multiempresa ausente (empresa_id ou group_id)' }, { status: 400 });
  }
  return null;
}

function summarizeText(value) {
  if (!value) return null;
  return { informado: true, tamanho: String(value).length };
}

function summarizeApprovalPolicies(policies = {}) {
  const entidades = Object.keys(policies || {});
  const total_faixas = entidades.reduce((total, entidade) => total + (Array.isArray(policies?.[entidade]) ? policies[entidade].length : 0), 0);
  const total_niveis = entidades.reduce((total, entidade) => {
    const faixas = Array.isArray(policies?.[entidade]) ? policies[entidade] : [];
    return total + faixas.reduce((sum, faixa) => sum + (Array.isArray(faixa?.niveis) ? faixa.niveis.length : 0), 0);
  }, 0);
  return { entidades, total_entidades: entidades.length, total_faixas, total_niveis };
}

function summarizeProposedData(dados = {}) {
  return {
    operation: dados?.operation || null,
    valor: Number(dados?.valor || 0),
    nivel_index: dados?.nivel_index ?? null,
    niveis_total: dados?.niveis_total ?? (Array.isArray(dados?.faixa?.niveis) ? dados.faixa.niveis.length : null),
    tem_faixa: Boolean(dados?.faixa),
    campos: Object.keys(dados || {}).filter((key) => !['faixa'].includes(key)),
  };
}

function buildApprovalAuditSnapshot(record = {}, action = null) {
  return {
    action,
    id: record?.id || null,
    group_id: record?.group_id || null,
    empresa_id: record?.empresa_id || null,
    status: record?.status || null,
    tipo_solicitacao: record?.tipo_solicitacao || null,
    entidade_alvo: record?.entidade_alvo || null,
    entidade_alvo_id: record?.entidade_alvo_id || null,
    solicitante_id: record?.solicitante_id || null,
    aprovador_id: record?.aprovador_id || null,
    perfil_aprovador_necessario: record?.perfil_aprovador_necessario || null,
    dados_propostos: summarizeProposedData(record?.dados_propostos || {}),
    tem_justificativa: Boolean(record?.justificativa),
    comentarios_aprovacao: summarizeText(record?.comentarios_aprovacao),
  };
}

function buildPedidoAuditSnapshot(pedido = {}, action = null) {
  return {
    action,
    id: pedido?.id || null,
    numero_pedido: pedido?.numero_pedido || null,
    tipo: pedido?.tipo || null,
    status: pedido?.status || null,
    status_aprovacao: pedido?.status_aprovacao || null,
    empresa_id: pedido?.empresa_id || null,
    group_id: pedido?.group_id || pedido?.grupo_id || null,
    cliente_id: pedido?.cliente_id || null,
    valor_total: Number(pedido?.valor_total || 0),
    tem_observacoes_publicas: Boolean(pedido?.observacoes_publicas),
  };
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
      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Edicao', modulo: 'Sistema', entidade: 'ConfiguracaoSistema', registro_id: cfg.id, descricao: 'Atualizacao de politicas de aprovacao', dados_novos: summarizeApprovalPolicies(policies), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar politica de aprovacao', error, { group_id, empresa_id, registro_id: cfg.id }); }
      return Response.json({ sucesso: true, id: cfg.id });
    }

    // CREATE generic approval (alçada)
    if (action === 'createManualReconciliation') {
      const scope = await resolveManualScope(base44, user, payload);
      if (scope.response) return scope.response;
      const permOk = await hasPermission(base44, user, 'Financeiro', 'Migracao', 'conciliar');
      if (!permOk) {
        try { await auditManualStaging(base44, user, { group_id: scope.groupId, empresa_id: scope.empresaId }, 'Bloqueio', false); }
        catch (error) { reportApprovalFailure('Falha ao auditar bloqueio da conciliacao', error, { group_id: scope.groupId, empresa_id: scope.empresaId }); return Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }); }
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const prepared = buildManualRecord(payload, user, scope);
      if (prepared.error) return Response.json({ error: prepared.error }, { status: 400 });
      let existing;
      try {
        const matches = await base44.asServiceRole.entities.SolicitacaoAprovacao.filter({ idempotency_key: prepared.record.idempotency_key, group_id: scope.groupId, empresa_id: scope.empresaId, tipo_solicitacao: MANUAL_RECONCILIATION_TYPE }, undefined, 2);
        existing = Array.isArray(matches) ? matches[0] : null;
      } catch (error) {
        reportApprovalFailure('Falha ao consultar idempotencia da conciliacao', error, { group_id: scope.groupId, empresa_id: scope.empresaId });
        return Response.json({ error: 'Persistencia de staging indisponivel' }, { status: 503 });
      }
      if (existing) {
        if (!isManualReconciliationRequest(existing) || firstText(existing?.referencia_staging) !== prepared.record.referencia_staging) {
          return Response.json({ error: 'Conflito de idempotencia no staging' }, { status: 409 });
        }
        try { await auditManualStaging(base44, user, existing, 'Reutilizacao', true); }
        catch (error) { reportApprovalFailure('Falha ao auditar reutilizacao idempotente', error, { solicitacao_id: existing.id }); return Response.json({ error: 'Auditoria da conciliacao indisponivel' }, { status: 503 }); }
        return Response.json({ record: existing, reused: true });
      }
      let created = null;
      try {
        created = await base44.asServiceRole.entities.SolicitacaoAprovacao.create(prepared.record);
        await auditManualStaging(base44, user, created, 'Criacao', true);
        return Response.json({ record: created, reused: false });
      } catch (error) {
        reportApprovalFailure('Falha ao persistir conciliacao em staging', error, { group_id: scope.groupId, empresa_id: scope.empresaId, solicitacao_id: created?.id });
        if (created?.id) {
          try { await base44.asServiceRole.entities.SolicitacaoAprovacao.delete(created.id); }
          catch (rollbackError) { reportApprovalFailure('Falha no rollback da conciliacao sem auditoria', rollbackError, { solicitacao_id: created.id }); }
        }
        return Response.json({ error: 'Persistencia ou auditoria da conciliacao falhou' }, { status: 503 });
      }
    }

    if (action === 'listManualReconciliations') {
      const scope = await resolveManualScope(base44, user, payload);
      if (scope.response) return scope.response;
      const canReview = await hasPermission(base44, user, 'Financeiro', 'Migracao', 'conciliar');
      const canApprove = await hasPermission(base44, user, 'Financeiro', 'Migracao', 'aprovar');
      if (!canReview && !canApprove) {
        try { await auditManualStaging(base44, user, { group_id: scope.groupId, empresa_id: scope.empresaId }, 'Bloqueio', false); }
        catch (error) { reportApprovalFailure('Falha ao auditar bloqueio da listagem', error, { group_id: scope.groupId, empresa_id: scope.empresaId }); return Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }); }
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      try {
        const items = await base44.asServiceRole.entities.SolicitacaoAprovacao.filter({ tipo_solicitacao: MANUAL_RECONCILIATION_TYPE, group_id: scope.groupId, empresa_id: scope.empresaId }, '-created_date', 50);
        await auditManualStaging(base44, user, { group_id: scope.groupId, empresa_id: scope.empresaId }, 'Visualizacao', true);
        return Response.json((Array.isArray(items) ? items : []).filter((item) => isManualReconciliationRequest(item) && firstText(item?.group_id) === scope.groupId && firstText(item?.empresa_id) === scope.empresaId));
      } catch (error) {
        reportApprovalFailure('Falha ao listar conciliacoes em staging', error, { group_id: scope.groupId, empresa_id: scope.empresaId });
        return Response.json({ error: 'Consulta de staging indisponivel' }, { status: 503 });
      }
    }

    if (action === 'create') {
      const { group_id, empresa_id, tipo_solicitacao, entidade_alvo, entidade_alvo_id, dados_propostos, justificativa, aprovador_id, perfil_aprovador_necessario } = payload;
      if (firstText(tipo_solicitacao) === MANUAL_RECONCILIATION_TYPE) {
        return Response.json({ error: 'Use a acao financeira especializada para conciliacao em staging' }, { status: 400 });
      }
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

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criacao', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: record.id, descricao: `Solicitacao (${tipo_solicitacao}) para ${entidade_alvo}#${entidade_alvo_id}`, dados_novos: buildApprovalAuditSnapshot(record, 'create'), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar criacao de solicitacao', error, { group_id, empresa_id, solicitacao_id: record.id }); }
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
      if (isManualReconciliationRequest(s)) {
        return Response.json({ error: 'Conciliacao financeira nao pode ser decidida pelo fluxo comercial generico' }, { status: 409 });
      }
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

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: s.empresa_id || null, group_id: s.group_id || null, acao: action === 'approve' ? 'Aprovacao' : 'Rejeicao', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: solicitacao_id, descricao: `${novoStatus} para ${s.entidade_alvo}#${s.entidade_alvo_id}`, dados_anteriores: buildApprovalAuditSnapshot(s, 'before_decision'), dados_novos: buildApprovalAuditSnapshot(updated, 'decision'), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar decisao de aprovacao', error, { solicitacao_id, status: novoStatus }); }
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

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: pedido.empresa_id || null, group_id: pedido.group_id || null, acao: 'Aprovacao', modulo: 'Comercial', entidade: 'Pedido', registro_id: pedido_id, descricao: 'Orcamento aceito pelo cliente no Portal', dados_anteriores: buildPedidoAuditSnapshot(pedido, 'before_accept_budget'), dados_novos: buildPedidoAuditSnapshot(updated, 'accept_budget'), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar aceite de orcamento', error, { pedido_id }); }

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

      try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: pedido.empresa_id || null, group_id: pedido.group_id || null, acao: 'Criacao', modulo: 'Comercial', entidade: 'SolicitacaoAprovacao', registro_id: pedido.id, descricao: 'Cliente solicitou revisao de orcamento via Portal', dados_novos: { pedido_id, comentarios: summarizeText(comments) }, data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar revisao de orcamento', error, { pedido_id }); }
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
        try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criacao', modulo: moduleName, entidade: 'SolicitacaoAprovacao', registro_id: rec.id, descricao: `Avaliacao de aprovacao criada (${entity_name} ${entity_id || ''})`, dados_novos: buildApprovalAuditSnapshot(rec, 'auto_create'), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar avaliacao de aprovacao', error, { solicitacao_id: rec.id, entity_name, entity_id }); }
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
        try { await base44.entities.AuditLog.create({ usuario: user.full_name || user.email, usuario_id: user.id, empresa_id: empresa_id || null, group_id: group_id || null, acao: 'Criacao', modulo: moduleName, entidade: 'SolicitacaoAprovacao', registro_id: rec.id, descricao: `Solicitacao por valor (${valorBase}) para ${entity_name} ${entity_id || ''} • Nivel ${nivel_index + 1}/${niveis.length || 1}` , dados_novos: buildApprovalAuditSnapshot(rec, 'auto_create'), data_hora: new Date().toISOString() }); } catch (error) { reportApprovalFailure('Falha ao auditar solicitacao por valor', error, { solicitacao_id: rec.id, entity_name, entity_id }); }
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
      if (firstText(tipo_solicitacao) === MANUAL_RECONCILIATION_TYPE) {
        return Response.json({ error: 'Use a listagem financeira especializada' }, { status: 400 });
      }
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
      return Response.json((Array.isArray(items) ? items : []).filter((item) => !isManualReconciliationRequest(item)));
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});
