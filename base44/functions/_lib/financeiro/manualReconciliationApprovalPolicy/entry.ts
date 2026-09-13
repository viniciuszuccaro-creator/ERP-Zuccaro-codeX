export const MANUAL_RECONCILIATION_TYPE = 'conciliacao_migracao_financeira';
export const MANUAL_RECONCILIATION_STATUS = 'PENDING_MANUAL_RECONCILIATION';
const MANUAL_RECONCILIATION_ENTITIES = new Set(['ContaPagar', 'ContaReceber']);
const MANUAL_SECRET_PARTS = ['password', 'senha', 'token', 'secret', 'authorization', 'api_key', 'apikey', 'certificado', 'certificate'];

export const firstText = (...values) => values.map((value) => String(value ?? '').trim()).find(Boolean) || '';
const cleanText = (value, limit = 1000) => firstText(value).replace(/<[^>]*>/g, '').slice(0, limit).trim();

export function isManualReconciliationRequest(record: Record<string, unknown> = {}) {
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
  return typeof value === 'string' ? cleanText(value, 4000) : value;
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

export async function auditManualStaging(base44, user, record, acao, sucesso = true, previous = null) {
  await base44.asServiceRole.entities.AuditLog.create({
    usuario: user?.full_name || user?.email || 'Usuario', usuario_id: user?.id,
    empresa_id: record?.empresa_id || null, group_id: record?.group_id || null,
    acao, modulo: 'Financeiro', tipo_auditoria: 'migracao', entidade: 'SolicitacaoAprovacao',
    registro_id: record?.id || null, descricao: `${acao} de conciliacao financeira em staging`,
    dados_anteriores: previous ? summarizeManualRequest(previous) : null,
    dados_novos: summarizeManualRequest(record), data_hora: new Date().toISOString(), sucesso,
  });
}

const reportFailure = (operation, error, context = {}) => console.error('[manualReconciliationApprovalPolicy] ' + operation, { error: error?.message || String(error), ...context });

export async function resolveManualScope(base44, user, input: Record<string, unknown> = {}) {
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
      catch (auditError) { reportFailure('Falha ao auditar Empresa fora do Grupo', auditError, { group_id: groupId, empresa_id: empresaId }); return { response: Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }) }; }
      return { response: Response.json({ error: 'Empresa nao pertence ao Grupo informado' }, { status: 403 }) };
    }
  } catch (error) {
    reportFailure('Falha ao validar Empresa da conciliacao', error, { group_id: groupId, empresa_id: empresaId });
    return { response: Response.json({ error: 'Validacao multiempresa indisponivel' }, { status: 503 }) };
  }
  if (!userHasManualScope(user, groupId, empresaId)) {
    try { await auditManualStaging(base44, user, { group_id: groupId, empresa_id: empresaId }, 'Bloqueio', false); }
    catch (error) { reportFailure('Falha ao auditar escopo negado', error, { group_id: groupId, empresa_id: empresaId }); return { response: Response.json({ error: 'Controle de acesso indisponivel' }, { status: 503 }) }; }
    return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { groupId, empresaId, scopeType };
}

export function buildManualRecord(input, user, scope) {
  const request = input?.approval_request || input?.solicitacao || {};
  const envelope = request?.dados_propostos?.envelope_staging;
  const entityName = firstText(request?.entidade_alvo);
  const legacyCode = firstText(request?.referencia_staging);
  const expectedKey = ['migracao-conciliacao', scope.groupId, scope.empresaId, entityName, legacyCode].join('|');
  const envelopeSize = (() => { try { return JSON.stringify(envelope || {}).length; } catch { return Infinity; } })();
  const history = Array.isArray(envelope?.historico_conciliacao) ? envelope.historico_conciliacao : [];
  const initialEvent = history[0] || {};
  const valid = isManualReconciliationRequest(request) && request?.bloqueio_operacional === true
    && firstText(request?.status) === 'pendente' && firstText(request?.origem) === 'staging_migracao'
    && (request?.entidade_alvo_id === null || request?.entidade_alvo_id === undefined)
    && MANUAL_RECONCILIATION_ENTITIES.has(entityName) && Boolean(legacyCode)
    && firstText(request?.idempotency_key) === expectedKey && firstText(request?.group_id) === scope.groupId
    && firstText(request?.empresa_id) === scope.empresaId && firstText(request?.scope_type).toLowerCase() === 'empresa'
    && assertLockedEnvelope(envelope, scope, entityName, legacyCode)
    && firstText(envelope?.etapa_conciliacao) === 'aguardando_evidencia'
    && (envelope?.decisao_financeira === null || envelope?.decisao_financeira === undefined)
    && Array.isArray(envelope?.evidencias_conciliacao) && envelope.evidencias_conciliacao.length === 0
    && Array.isArray(envelope?.aprovacoes_conciliacao) && envelope.aprovacoes_conciliacao.length === 0
    && history.length === 1 && firstText(initialEvent?.acao) === 'marcado_pendente_conciliacao_manual'
    && Boolean(firstText(initialEvent?.usuario_id)) && !Number.isNaN(Date.parse(firstText(initialEvent?.timestamp)))
    && firstText(initialEvent?.group_id) === scope.groupId && firstText(initialEvent?.empresa_id) === scope.empresaId
    && envelopeSize <= 250000;
  if (!valid) return { error: 'Envelope de conciliacao financeira invalido ou inconsistente' };
  return { record: {
    group_id: scope.groupId, empresa_id: scope.empresaId, scope_type: 'empresa', solicitante_id: user.id,
    solicitante_nome: cleanText(firstText(user.full_name, user.email, user.id), 160), tipo_solicitacao: MANUAL_RECONCILIATION_TYPE,
    entidade_alvo: entityName, entidade_alvo_id: null, referencia_staging: legacyCode, idempotency_key: expectedKey,
    dados_propostos: { operation: 'manual_reconciliation_staging', envelope_staging: sanitizeManualValue(envelope) },
    justificativa: 'Pendencia legada exige conciliacao financeira manual.', perfil_aprovador_necessario: 'Financeiro.Migracao.aprovar',
    status: 'pendente', data_solicitacao: new Date().toISOString(), origem: 'staging_migracao', bloqueio_operacional: true,
  } };
}

function assertLockedEnvelope(envelope, scope, entityName, legacyCode) {
  return firstText(envelope?.status_migracao).toUpperCase() === MANUAL_RECONCILIATION_STATUS
    && firstText(envelope?.destino_migracao).toLowerCase() === 'staging'
    && envelope?.requer_conciliacao_manual === true && envelope?.bloqueio_operacional === true && envelope?.confirmado === false
    && firstText(envelope?.group_id, envelope?.grupo_id) === scope.groupId && firstText(envelope?.empresa_id) === scope.empresaId
    && firstText(envelope?.entidade_migracao) === entityName && firstText(envelope?.codigo_legado, envelope?.id_antigo) === legacyCode;
}

export function assertStoredManualRequest(record, scope) {
  const envelope = record?.dados_propostos?.envelope_staging;
  const entityName = firstText(record?.entidade_alvo);
  const legacyCode = firstText(record?.referencia_staging);
  if (!isManualReconciliationRequest(record) || record?.bloqueio_operacional !== true || firstText(record?.status) !== 'pendente'
    || firstText(record?.group_id) !== scope.groupId || firstText(record?.empresa_id) !== scope.empresaId
    || !MANUAL_RECONCILIATION_ENTITIES.has(entityName) || !assertLockedEnvelope(envelope, scope, entityName, legacyCode)) {
    throw new Error('Solicitacao de conciliacao fora do staging ou do contexto informado.');
  }
  return envelope;
}

const normalizeDecision = (value) => {
  const decision = firstText(value).toUpperCase();
  if (!['PAGO', 'ABERTO'].includes(decision)) throw new Error('Decisao financeira deve ser PAGO ou ABERTO.');
  return decision;
};

export function applyManualWorkflowTransition(record, action, input, user, timestamp = new Date().toISOString()) {
  const scope = { groupId: firstText(record?.group_id), empresaId: firstText(record?.empresa_id) };
  const envelope = assertStoredManualRequest(record, scope);
  const actor = firstText(user?.id);
  if (!actor || Number.isNaN(Date.parse(timestamp))) throw new Error('Usuario e data validos sao obrigatorios.');
  const evidences = Array.isArray(envelope?.evidencias_conciliacao) ? envelope.evidencias_conciliacao : [];
  const approvals = Array.isArray(envelope?.aprovacoes_conciliacao) ? envelope.aprovacoes_conciliacao : [];
  const history = Array.isArray(envelope?.historico_conciliacao) ? envelope.historico_conciliacao : [];
  const originActor = firstText(history[0]?.usuario_id, record?.solicitante_id);
  let next;

  if (action === 'attachManualReconciliationEvidence') {
    if (!['aguardando_evidencia', 'evidencia_anexada'].includes(firstText(envelope?.etapa_conciliacao))) throw new Error('Etapa nao permite anexar evidencia.');
    const evidence = input?.evidencia || {};
    const id = cleanText(firstText(evidence?.id, evidence?.evidencia_id), 120);
    const tipo = cleanText(evidence?.tipo, 80);
    const referencia = cleanText(firstText(evidence?.arquivo_url, evidence?.hash_sha256, evidence?.referencia), 1000);
    if (!id || !tipo || !referencia) throw new Error('Evidencia exige identificador, tipo e referencia.');
    const duplicate = evidences.find((item) => firstText(item?.id) === id);
    if (duplicate) {
      if (firstText(duplicate?.tipo) === tipo && firstText(duplicate?.arquivo_url, duplicate?.hash_sha256, duplicate?.referencia) === referencia) return { record, reused: true };
      throw new Error('Identificador de evidencia ja utilizado.');
    }
    const evidenceRecord = { id, tipo, arquivo_url: cleanText(evidence?.arquivo_url, 1000) || undefined, hash_sha256: cleanText(evidence?.hash_sha256, 160) || undefined, referencia: cleanText(evidence?.referencia, 1000) || undefined, descricao: cleanText(evidence?.descricao, 500) || undefined, anexado_por: actor, anexado_em: timestamp };
    next = { ...envelope, etapa_conciliacao: 'evidencia_anexada', evidencias_conciliacao: [...evidences, evidenceRecord], historico_conciliacao: [...history, { acao: 'evidencia_anexada', evidencia_id: id, usuario_id: actor, timestamp, group_id: scope.groupId, empresa_id: scope.empresaId }] };
  } else if (action === 'reviewManualReconciliation') {
    if (firstText(envelope?.etapa_conciliacao) !== 'evidencia_anexada' || !evidences.length) throw new Error('Revisao exige evidencia anterior.');
    if (actor === originActor) throw new Error('Registrante nao pode revisar a propria pendencia.');
    const decision = normalizeDecision(input?.decisao);
    const reason = cleanText(input?.justificativa, 1000);
    if (!reason) throw new Error('Justificativa obrigatoria para revisao.');
    if (approvals.some((item) => item?.etapa === 'revisao_financeira')) throw new Error('Revisao financeira ja registrada.');
    const review = { etapa: 'revisao_financeira', decisao: decision, justificativa: reason, usuario_id: actor, timestamp };
    next = { ...envelope, etapa_conciliacao: 'aguardando_aprovacao_final', decisao_financeira: { classificacao: decision, status: 'EM_APROVACAO', revisado_por: actor, revisado_em: timestamp }, aprovacoes_conciliacao: [...approvals, review], historico_conciliacao: [...history, { acao: 'revisao_financeira_registrada', decisao: decision, usuario_id: actor, timestamp, group_id: scope.groupId, empresa_id: scope.empresaId }] };
  } else if (action === 'approveManualReconciliation') {
    if (input?.confirmacao_humana !== true) throw new Error('Confirmacao humana obrigatoria.');
    const review = approvals.find((item) => item?.etapa === 'revisao_financeira');
    if (firstText(envelope?.etapa_conciliacao) !== 'aguardando_aprovacao_final' || !review) throw new Error('Aprovacao final exige revisao anterior.');
    const decision = normalizeDecision(input?.decisao);
    const reason = cleanText(input?.justificativa, 1000);
    if (!reason || firstText(review?.decisao) !== decision) throw new Error('Aprovacao deve justificar e confirmar a decisao revisada.');
    if ([originActor, firstText(review?.usuario_id)].includes(actor)) throw new Error('Aprovador final deve ser distinto do registrante e revisor.');
    if (approvals.some((item) => item?.etapa === 'aprovacao_final')) throw new Error('Aprovacao final ja registrada.');
    const approval = { etapa: 'aprovacao_final', decisao: decision, justificativa: reason, usuario_id: actor, timestamp };
    next = { ...envelope, etapa_conciliacao: 'aprovada_aguardando_promocao_manual', decisao_financeira: { ...envelope.decisao_financeira, classificacao: decision, status: 'APROVADA_AGUARDANDO_PROMOCAO', aprovado_por: actor, aprovado_em: timestamp }, aprovacoes_conciliacao: [...approvals, approval], historico_conciliacao: [...history, { acao: 'aprovacao_final_registrada', decisao: decision, usuario_id: actor, timestamp, group_id: scope.groupId, empresa_id: scope.empresaId }] };
  } else {
    throw new Error('Acao de conciliacao invalida.');
  }
  next = { ...sanitizeManualValue(next), status_migracao: MANUAL_RECONCILIATION_STATUS, destino_migracao: 'staging', confirmado: false, bloqueio_operacional: true };
  return { record: { ...record, status: 'pendente', bloqueio_operacional: true, dados_propostos: { operation: 'manual_reconciliation_staging', envelope_staging: next } }, reused: false };
}

export function summarizeManualRequest(record: {
  dados_propostos?: { envelope_staging?: Record<string, unknown> };
  entidade_alvo?: unknown;
  referencia_staging?: unknown;
  status?: unknown;
} = {}) {
  const envelope = record?.dados_propostos?.envelope_staging || {};
  return { tipo_solicitacao: MANUAL_RECONCILIATION_TYPE, entidade_alvo: record?.entidade_alvo || null, referencia_staging: record?.referencia_staging || null, status: record?.status || null, etapa_conciliacao: envelope?.etapa_conciliacao || null, evidencias: Array.isArray(envelope?.evidencias_conciliacao) ? envelope.evidencias_conciliacao.length : 0, aprovacoes: Array.isArray(envelope?.aprovacoes_conciliacao) ? envelope.aprovacoes_conciliacao.length : 0, bloqueio_operacional: true };
}
