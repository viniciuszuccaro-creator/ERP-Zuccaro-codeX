const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MIGRACAO_ORIGENS = ['erp_antigo', 'migracao', 'lote_csv', 'planilha', 'nfe_xml'];
export const MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION = 'PENDING_MANUAL_RECONCILIATION';
export const MIGRACAO_DESTINO_STAGING = 'staging';
export const MIGRACAO_RECONCILIACAO_TIPO_SOLICITACAO = 'conciliacao_migracao_financeira';
export const MIGRACAO_RECONCILIACAO_TIPO_FISCAL = 'conciliacao_migracao_fiscal';
export const MIGRACAO_RECONCILIACAO_PERMISSOES = Object.freeze({
  evidenciar: 'Financeiro.Migracao.conciliar',
  revisar: 'Financeiro.Migracao.conciliar',
  aprovar: 'Financeiro.Migracao.aprovar',
});
export const MIGRACAO_RECONCILIACAO_FISCAL_PERMISSOES = Object.freeze({
  evidenciar: 'Fiscal.Migracao.conciliar',
  revisar: 'Fiscal.Migracao.conciliar',
  aprovar: 'Fiscal.Migracao.aprovar',
});
const MIGRACAO_RECONCILIACAO_CONFIG = Object.freeze({
  ContaPagar: {
    tipo: MIGRACAO_RECONCILIACAO_TIPO_SOLICITACAO,
    permissoes: MIGRACAO_RECONCILIACAO_PERMISSOES,
    decisaoCampo: 'decisao_financeira',
    dominio: 'financeira',
  },
  ContaReceber: {
    tipo: MIGRACAO_RECONCILIACAO_TIPO_SOLICITACAO,
    permissoes: MIGRACAO_RECONCILIACAO_PERMISSOES,
    decisaoCampo: 'decisao_financeira',
    dominio: 'financeira',
  },
  NotaFiscal: {
    tipo: MIGRACAO_RECONCILIACAO_TIPO_FISCAL,
    permissoes: MIGRACAO_RECONCILIACAO_FISCAL_PERMISSOES,
    decisaoCampo: 'decisao_fiscal',
    dominio: 'fiscal',
  },
});
const MIGRACAO_EVIDENCIA_MAX_BYTES = 10 * 1024 * 1024;
const MIGRACAO_EVIDENCIA_EXTENSOES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
const MIGRACAO_EVIDENCIA_HASH = /^[a-f0-9]{64}$/;

export const SECRET_MIGRACAO_KEYS = [
  'senha',
  'password',
  'senha_hash',
  'senha_legado',
  'password_hash',
  'token',
  'refresh_token',
  'api_key',
  'secret',
];

const slug = (value) => firstText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const sanitizeManualText = (value, maxLength = 500) => firstText(value).replace(/<[^>]*>/g, '').slice(0, maxLength).trim();
const getManualReconciliationConfig = (entityName) => MIGRACAO_RECONCILIACAO_CONFIG[firstText(entityName)] || null;

const normalizeManualEvidence = (evidence = {}) => {
  const id = sanitizeManualText(firstText(evidence.id, evidence.evidencia_id), 120);
  const type = sanitizeManualText(evidence.tipo, 80).toLowerCase();
  const fileUri = sanitizeManualText(evidence.file_uri, 1000);
  const fileName = sanitizeManualText(evidence.arquivo_nome, 255);
  const fileSize = Number(evidence.arquivo_tamanho);
  const hashSha256 = sanitizeManualText(evidence.hash_sha256, 64).toLowerCase();
  const extensions = MIGRACAO_EVIDENCIA_EXTENSOES[type] || [];
  const validPrivateUri = fileUri.startsWith('private/') && !fileUri.includes('..') && !/[\\\s?#]/.test(fileUri);
  if (!id || !validPrivateUri || !MIGRACAO_EVIDENCIA_HASH.test(hashSha256)
    || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MIGRACAO_EVIDENCIA_MAX_BYTES
    || !fileName || /[\\/]/.test(fileName) || !extensions.some((extension) => fileName.toLowerCase().endsWith(extension))
    || firstText(evidence.armazenamento).toLowerCase() !== 'privado'
    || firstText(evidence.hash_algoritmo).toUpperCase() !== 'SHA-256') {
    throw new Error('Evidencia privada exige arquivo, MIME, tamanho, nome e SHA-256 validos.');
  }
  return {
    id,
    tipo: type,
    file_uri: fileUri,
    arquivo_nome: fileName,
    arquivo_tamanho: fileSize,
    hash_sha256: hashSha256,
    hash_algoritmo: 'SHA-256',
    armazenamento: 'privado',
    descricao: sanitizeManualText(evidence.descricao, 500) || undefined,
  };
};


/** @param {Record<string, unknown>} record */
export const isPendingManualReconciliation = (record = {}) => (
  firstText(record.status_migracao).toUpperCase() === MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION
  || record.requer_conciliacao_manual === true
);

export const isMigracaoOrigem = (value) => MIGRACAO_ORIGENS.includes(firstText(value).toLowerCase());

export const isMigracaoRecord = (record = {}) => Boolean(
  firstText(record.origem_migracao)
  || firstText(record.lote_migracao)
  || firstText(record.destino_migracao)
  || firstText(record.status_migracao)
  || record.importacao_erp === true
  || isMigracaoOrigem(record.origem)
  || isMigracaoOrigem(record.origem_cadastro)
);

/**
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>}
 */
export const stripSegredosMigracao = (record = {}) => {
  const next = { ...record };
  SECRET_MIGRACAO_KEYS.forEach((key) => {
    if (key in next) delete next[key];
  });
  return next;
};

/** @param {{ arquivoNome?: unknown, groupId?: unknown, empresaId?: unknown, entidade?: string }} options */
export const buildLoteMigracaoId = ({
  arquivoNome,
  groupId,
  empresaId,
  entidade = 'registro',
} = {}) => {
  const fileSlug = slug(arquivoNome) || 'sem-arquivo';
  return `MIG-${slug(entidade) || 'registro'}-${firstText(groupId) || 'grupo'}-${firstText(empresaId) || 'grupo'}-${fileSlug}`;
};

/**
 * @param {Record<string, unknown>} record
 * @param {{ arquivoNome?: unknown, entidade?: string, confirmado?: boolean, destino?: string }} options
 */
export const stampMigracaoRecord = (record = {}, {
  arquivoNome,
  entidade = 'registro',
  confirmado = false,
  destino = 'producao',
} = {}) => {
  const pendingManualReconciliation = isPendingManualReconciliation(record);
  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const codigoLegado = firstText(record.codigo_legado, record.id_antigo, record.codigo_origem, record.codigo, record.numero_pedido);
  return stripSegredosMigracao({
    ...record,
    origem_migracao: firstText(record.origem_migracao, record.origem, 'erp_antigo') || 'erp_antigo',
    origem_cadastro: firstText(record.origem_cadastro, 'migracao'),
    lote_migracao: firstText(record.lote_migracao) || buildLoteMigracaoId({
      arquivoNome,
      groupId,
      empresaId,
      entidade,
    }),
    codigo_legado: codigoLegado || record.codigo_legado,
    id_antigo: firstText(record.id_antigo, codigoLegado) || record.id_antigo,
    destino_migracao: pendingManualReconciliation
      ? MIGRACAO_DESTINO_STAGING
      : firstText(record.destino_migracao, destino) || 'producao',
    status_migracao: pendingManualReconciliation
      ? MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION
      : firstText(record.status_migracao, confirmado ? 'validado' : 'staging'),
    importacao_erp: true,
    confirmado: pendingManualReconciliation ? false : confirmado || record.confirmado === true,
  });
};

/**
 * @param {Record<string, unknown>} record
 * @param {{ arquivoNome?: unknown, entidade?: string, registradoPor?: unknown, registradoEm?: unknown, motivo?: string }} options
 */
export const buildPendingManualReconciliation = (record = {}, {
  arquivoNome,
  entidade = 'ContaPagar',
  registradoPor,
  registradoEm,
  motivo,
} = {}) => {
  /** @type {Record<string, unknown>} */
  const origem = stripSegredosMigracao(record);
  const groupId = firstText(origem.group_id, origem.grupo_id);
  const empresaId = firstText(origem.empresa_id);
  const codigoLegado = firstText(origem.codigo_legado, origem.id_antigo, origem.codigo_origem, origem.codigo, origem.numero_documento);
  const usuarioId = sanitizeManualText(registradoPor, 120);
  const timestamp = firstText(registradoEm);

  const config = getManualReconciliationConfig(entidade);
  if (!config) throw new Error('Entidade invalida para conciliacao manual de migracao.');
  if (!groupId || !empresaId) {
    throw new Error('Grupo e Empresa sao obrigatorios para conciliacao manual de registro migrado.');
  }
  if (!codigoLegado) {
    throw new Error('Codigo legado obrigatorio para conciliacao manual de registro migrado.');
  }
  if (!usuarioId || !timestamp) {
    throw new Error('Usuario e data sao obrigatorios para auditar a conciliacao manual.');
  }
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error('Data de auditoria invalida para conciliacao manual.');
  }
  const auditTimestamp = new Date(timestamp).toISOString();

  return stampMigracaoRecord({
    group_id: groupId,
    grupo_id: groupId,
    empresa_id: empresaId,
    codigo_legado: codigoLegado,
    id_antigo: firstText(origem.id_antigo, codigoLegado),
    entidade_migracao: entidade,
    dados_origem_migracao: { ...origem },
    status_migracao: MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
    destino_migracao: MIGRACAO_DESTINO_STAGING,
    requer_conciliacao_manual: true,
    bloqueio_operacional: true,
    etapa_conciliacao: 'aguardando_evidencia',
    [config.decisaoCampo]: null,
    pedido_id: entidade === 'NotaFiscal' ? (firstText(origem.pedido_id) || null) : origem.pedido_id,
    evidencias_conciliacao: [],
    aprovacoes_conciliacao: [],
    historico_conciliacao: [{
      acao: 'marcado_pendente_conciliacao_manual',
      usuario_id: usuarioId,
      timestamp: auditTimestamp,
      group_id: groupId,
      empresa_id: empresaId,
      motivo: sanitizeManualText(motivo, 500) || (entidade === 'NotaFiscal'
        ? 'Vinculo do documento fiscal legado exige validacao manual.'
        : 'Evidencia insuficiente para classificar automaticamente o titulo financeiro.'),
    }],
  }, { arquivoNome, entidade, confirmado: false, destino: MIGRACAO_DESTINO_STAGING });
};

/** @param {Record<string, unknown>} record */
const assertPendingManualReconciliation = (record = {}) => {
  if (!isPendingManualReconciliation(record)
    || firstText(record.destino_migracao).toLowerCase() !== MIGRACAO_DESTINO_STAGING
    || record.confirmado === true
    || record.bloqueio_operacional !== true) {
    throw new Error('Registro nao esta em staging bloqueado para conciliacao manual.');
  }
  if (!firstText(record.group_id, record.grupo_id) || !firstText(record.empresa_id)) {
    throw new Error('Grupo e Empresa sao obrigatorios na conciliacao manual.');
  }
};

const assertAuditActor = (usuarioId, timestamp) => {
  const actor = sanitizeManualText(usuarioId, 120);
  const at = firstText(timestamp);
  if (!actor || !at) throw new Error('Usuario e data sao obrigatorios na conciliacao manual.');
  if (!Number.isFinite(Date.parse(at))) throw new Error('Data de auditoria invalida na conciliacao manual.');
  return { actor, at: new Date(at).toISOString() };
};

const assertManualPermission = (allowed, permission) => {
  if (allowed !== true) throw new Error(`Permissao ${permission} obrigatoria para conciliacao manual.`);
};

const originActorId = (record) => {
  const history = Array.isArray(record.historico_conciliacao) ? record.historico_conciliacao : [];
  return firstText(history.find((item) => item?.acao === 'marcado_pendente_conciliacao_manual')?.usuario_id);
};

const normalizeManualDecision = (value) => {
  const decision = firstText(value).toUpperCase();
  if (!['PAGO', 'ABERTO'].includes(decision)) {
    throw new Error('Decisao manual deve ser PAGO ou ABERTO.');
  }
  return decision;
};

/**
 * @param {Record<string, unknown>} record
 * @param {{ evidencia?: Record<string, unknown>, usuarioId?: unknown, timestamp?: unknown, temPermissao?: boolean }} options
 */
export const appendManualReconciliationEvidence = (record = {}, {
  evidencia = {},
  usuarioId,
  timestamp,
  temPermissao = false,
} = {}) => {
  assertPendingManualReconciliation(record);
  assertManualPermission(temPermissao, MIGRACAO_RECONCILIACAO_PERMISSOES.evidenciar);
  const { actor, at } = assertAuditActor(usuarioId, timestamp);
  const normalizedEvidence = normalizeManualEvidence(evidencia);

  const current = Array.isArray(record.evidencias_conciliacao) ? record.evidencias_conciliacao : [];
  const duplicate = current.find((item) => firstText(item?.id) === normalizedEvidence.id);
  if (duplicate) {
    if (firstText(duplicate.tipo) === normalizedEvidence.tipo
      && firstText(duplicate.file_uri) === normalizedEvidence.file_uri
      && firstText(duplicate.hash_sha256) === normalizedEvidence.hash_sha256) {
      return record;
    }
    throw new Error('Identificador de evidencia ja utilizado com outro conteudo.');
  }

  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  return {
    ...record,
    etapa_conciliacao: 'evidencia_anexada',
    evidencias_conciliacao: [...current, {
      ...normalizedEvidence,
      anexado_por: actor,
      anexado_em: at,
    }],
    historico_conciliacao: [
      ...(Array.isArray(record.historico_conciliacao) ? record.historico_conciliacao : []),
      { acao: 'evidencia_anexada', evidencia_id: normalizedEvidence.id, usuario_id: actor, timestamp: at, group_id: groupId, empresa_id: empresaId },
    ],
  };
};

/**
 * @param {Record<string, unknown>} record
 * @param {{ decisao?: unknown, justificativa?: unknown, usuarioId?: unknown, timestamp?: unknown, temPermissao?: boolean }} options
 */
export const reviewPendingManualReconciliation = (record = {}, {
  decisao,
  justificativa,
  usuarioId,
  timestamp,
  temPermissao = false,
} = {}) => {
  assertPendingManualReconciliation(record);
  assertManualPermission(temPermissao, MIGRACAO_RECONCILIACAO_PERMISSOES.revisar);
  const { actor, at } = assertAuditActor(usuarioId, timestamp);
  const decision = normalizeManualDecision(decisao);
  const reason = sanitizeManualText(justificativa, 1000);
  const evidences = Array.isArray(record.evidencias_conciliacao) ? record.evidencias_conciliacao : [];
  const approvals = Array.isArray(record.aprovacoes_conciliacao) ? record.aprovacoes_conciliacao : [];
  if (!evidences.length) throw new Error('Revisao financeira exige ao menos uma evidencia.');
  if (!reason) throw new Error('Justificativa obrigatoria para revisao financeira.');
  if (actor === originActorId(record)) throw new Error('Segregacao de funcoes: registrante nao pode revisar a propria pendencia.');
  if (approvals.some((item) => item?.etapa === 'revisao_financeira')) throw new Error('Pendencia ja possui revisao financeira.');

  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const review = { etapa: 'revisao_financeira', decisao: decision, justificativa: reason, usuario_id: actor, timestamp: at };
  return {
    ...record,
    etapa_conciliacao: 'aguardando_aprovacao_final',
    decisao_financeira: { classificacao: decision, status: 'EM_APROVACAO', revisado_por: actor, revisado_em: at },
    aprovacoes_conciliacao: [...approvals, review],
    historico_conciliacao: [
      ...(Array.isArray(record.historico_conciliacao) ? record.historico_conciliacao : []),
      { acao: 'revisao_financeira_registrada', decisao: decision, usuario_id: actor, timestamp: at, group_id: groupId, empresa_id: empresaId },
    ],
  };
};

/**
 * @param {Record<string, unknown>} record
 * @param {{ decisao?: unknown, justificativa?: unknown, usuarioId?: unknown, timestamp?: unknown, temPermissao?: boolean, confirmacaoHumana?: boolean }} options
 */
export const approvePendingManualReconciliation = (record = {}, {
  decisao,
  justificativa,
  usuarioId,
  timestamp,
  temPermissao = false,
  confirmacaoHumana = false,
} = {}) => {
  assertPendingManualReconciliation(record);
  assertManualPermission(temPermissao, MIGRACAO_RECONCILIACAO_PERMISSOES.aprovar);
  if (confirmacaoHumana !== true) throw new Error('Confirmacao humana obrigatoria para aprovacao final.');
  const { actor, at } = assertAuditActor(usuarioId, timestamp);
  const decision = normalizeManualDecision(decisao);
  const reason = sanitizeManualText(justificativa, 1000);
  const approvals = Array.isArray(record.aprovacoes_conciliacao) ? record.aprovacoes_conciliacao : [];
  const review = approvals.find((item) => item?.etapa === 'revisao_financeira');
  if (!review) throw new Error('Aprovacao final exige revisao financeira anterior.');
  if (!reason) throw new Error('Justificativa obrigatoria para aprovacao final.');
  if (firstText(review.decisao) !== decision) throw new Error('Aprovacao final deve confirmar a decisao revisada.');
  if ([originActorId(record), firstText(review.usuario_id)].includes(actor)) {
    throw new Error('Segregacao de funcoes exige aprovador final distinto do registrante e do revisor.');
  }
  if (approvals.some((item) => item?.etapa === 'aprovacao_final')) throw new Error('Pendencia ja possui aprovacao final.');

  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const approval = { etapa: 'aprovacao_final', decisao: decision, justificativa: reason, usuario_id: actor, timestamp: at };
  return {
    ...record,
    etapa_conciliacao: 'aprovada_aguardando_promocao_manual',
    decisao_financeira: {
      ...(record.decisao_financeira && typeof record.decisao_financeira === 'object' ? record.decisao_financeira : {}),
      classificacao: decision, status: 'APROVADA', aprovado_por: actor, aprovado_em: at,
    },
    aprovacoes_conciliacao: [...approvals, approval],
    historico_conciliacao: [
      ...(Array.isArray(record.historico_conciliacao) ? record.historico_conciliacao : []),
      { acao: 'aprovacao_final_registrada', decisao: decision, usuario_id: actor, timestamp: at, group_id: groupId, empresa_id: empresaId },
    ],
    status_migracao: MIGRACAO_STATUS_PENDING_MANUAL_RECONCILIATION,
    destino_migracao: MIGRACAO_DESTINO_STAGING,
    confirmado: false,
    bloqueio_operacional: true,
  };
};

/** @param {Record<string, unknown>} record */
export const isManualReconciliationApprovalRequest = (record = {}) => (
  [MIGRACAO_RECONCILIACAO_TIPO_SOLICITACAO, MIGRACAO_RECONCILIACAO_TIPO_FISCAL].includes(firstText(record.tipo_solicitacao))
  && record.bloqueio_operacional === true
  && record.dados_propostos
  && typeof record.dados_propostos === 'object'
);

/**
 * @param {Record<string, unknown>} staging
 * @param {{ solicitanteId?: unknown, solicitanteNome?: unknown, timestamp?: unknown }} options
 */
export const buildManualReconciliationApprovalRequest = (staging = {}, {
  solicitanteId,
  solicitanteNome,
  timestamp,
} = {}) => {
  assertPendingManualReconciliation(staging);
  const { actor, at } = assertAuditActor(solicitanteId, timestamp);
  const groupId = firstText(staging.group_id, staging.grupo_id);
  const empresaId = firstText(staging.empresa_id);
  const entityName = firstText(staging.entidade_migracao);
  const legacyCode = firstText(staging.codigo_legado, staging.id_antigo);
  const config = getManualReconciliationConfig(entityName);
  if (!config) throw new Error('Entidade invalida no envelope de staging.');
  if (!legacyCode) throw new Error('Codigo legado obrigatorio no envelope de staging.');

  return {
    group_id: groupId,
    empresa_id: empresaId,
    scope_type: 'empresa',
    solicitante_id: actor,
    solicitante_nome: sanitizeManualText(solicitanteNome, 160) || actor,
    tipo_solicitacao: config.tipo,
    entidade_alvo: entityName,
    entidade_alvo_id: null,
    referencia_staging: legacyCode,
    idempotency_key: ['migracao-conciliacao', groupId, empresaId, entityName, legacyCode].join('|'),
    dados_propostos: {
      operation: config.dominio === 'fiscal' ? 'manual_fiscal_reconciliation_staging' : 'manual_reconciliation_staging',
      envelope_staging: { ...staging },
    },
    justificativa: `Pendencia legada exige conciliacao ${config.dominio} manual.`,
    perfil_aprovador_necessario: config.permissoes.aprovar,
    status: 'pendente',
    data_solicitacao: at,
    origem: 'staging_migracao',
    bloqueio_operacional: true,
  };
};

/**
 * @param {Record<string, unknown>} request
 * @param {Array<Record<string, unknown>>} requests
 */
export const findManualReconciliationApprovalRequest = (request = {}, requests = []) => {
  if (!isManualReconciliationApprovalRequest(request)) return null;
  const key = firstText(request.idempotency_key);
  if (!key) throw new Error('Chave idempotente obrigatoria para persistencia do staging.');
  return (Array.isArray(requests) ? requests : []).find((item) => (
    isManualReconciliationApprovalRequest(item)
    && firstText(item.idempotency_key) === key
    && firstText(item.group_id) === firstText(request.group_id)
    && firstText(item.empresa_id) === firstText(request.empresa_id)
  )) || null;
};

export const findRegistroMigracaoDuplicado = (record = {}, records = []) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const legado = firstText(record.codigo_legado, record.id_antigo);
  if (!groupId || !legado) return null;
  return (Array.isArray(records) ? records : []).find((item) => (
    firstText(item.group_id, item.grupo_id) === groupId
    && firstText(item.codigo_legado, item.id_antigo) === legado
    && (!empresaId || firstText(item.empresa_id) === empresaId)
  )) || null;
};

export const buildReconciliacaoMigracao = ({ origem = [], gravados = [], reusos = [], campoValor = 'preco_venda' } = {}) => {
  const origemList = Array.isArray(origem) ? origem : [];
  const gravadoList = Array.isArray(gravados) ? gravados : [];
  const reusoList = Array.isArray(reusos) ? reusos : [];
  const soma = (lista) => lista.reduce((total, item) => total + (Number(item?.[campoValor]) || 0), 0);
  const amostra = gravadoList.slice(0, 5).map((item) => ({
    codigo_legado: firstText(item.codigo_legado, item.id_antigo),
    codigo_novo: firstText(item.codigo, item.numero_pedido, item.id),
    empresa_id: firstText(item.empresa_id),
    status: firstText(item.status, item.status_migracao),
  }));
  return {
    quantidade_origem: origemList.length,
    quantidade_gravada: gravadoList.length,
    quantidade_reuso: reusoList.length,
    divergencia_quantidade: origemList.length - gravadoList.length - reusoList.length,
    total_financeiro_origem: soma(origemList),
    total_financeiro_gravado: soma(gravadoList),
    amostra,
  };
};

export const assertReconciliacaoMigracao = (report = {}) => {
  if (!report || typeof report !== 'object') {
    throw new Error('Reconciliacao de migracao obrigatoria.');
  }
  if (!(Number(report.quantidade_origem) > 0)) {
    throw new Error('Migracao piloto exige ao menos uma linha de origem.');
  }
  if (Number(report.divergencia_quantidade) !== 0) {
    throw new Error(`Migracao com divergencia de quantidade: ${report.divergencia_quantidade}.`);
  }
  const amostra = Array.isArray(report.amostra) ? report.amostra : [];
  if (amostra.length === 0 && Number(report.quantidade_gravada) > 0) {
    throw new Error('Reconciliacao exige amostra com codigo legado e codigo novo.');
  }
  const semLegado = amostra.find((item) => !firstText(item?.codigo_legado));
  if (semLegado) {
    throw new Error('Amostra da reconciliacao exige codigo legado.');
  }
  return true;
};

export const applyMigracaoOnCreate = ({ entityName, record = {}, records = [] } = {}) => {
  if (!isMigracaoRecord(record)) return { reuse: null, record };
  const stripped = stripSegredosMigracao(record);

  if (isPendingManualReconciliation(stripped)) {
    throw new Error('Pendencia de conciliacao manual permanece no staging e nao pode ser gravada em producao.');
  }

  if (!firstText(stripped.group_id, stripped.grupo_id)) {
    throw new Error('Grupo obrigatorio para migracao do ERP antigo.');
  }

  const stamped = stampMigracaoRecord(stripped, {
    entidade: entityName,
    confirmado: stripped.confirmado === true,
    destino: firstText(stripped.destino_migracao) || undefined,
  });

  if (!firstText(stamped.codigo_legado, stamped.id_antigo)) {
    throw new Error('Codigo legado obrigatorio para migracao do ERP antigo.');
  }

  if (stamped.confirmado !== true) {
    throw new Error('Migracao para producao exige staging, reconciliacao e confirmacao.');
  }

  const reuse = findRegistroMigracaoDuplicado(stamped, records);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};
