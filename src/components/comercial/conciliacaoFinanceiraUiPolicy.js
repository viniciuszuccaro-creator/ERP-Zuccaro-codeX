export const MANUAL_RECONCILIATION_TYPE = "conciliacao_migracao_financeira";
export const FISCAL_MANUAL_RECONCILIATION_TYPE = "conciliacao_migracao_fiscal";

export const MAX_CONCILIACAO_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_FISCAL_STAGING_MANIFEST_BYTES = 256 * 1024;
export const ALLOWED_CONCILIACAO_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EVIDENCE_EXTENSIONS_BY_TYPE = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const textId = (value) => (typeof value === "string" ? value.trim() : "");
const HMAC_SHA256 = /^[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const BATCH_ID = /^[A-Z0-9][A-Z0-9._-]{2,79}$/;

const assertExactKeys = (record, keys, label) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${label} inválido.`);
  }
  const allowed = new Set(keys);
  const unexpected = Object.keys(record).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`${label} contém campo não permitido: ${unexpected}.`);
  const missing = keys.find((key) => !Object.prototype.hasOwnProperty.call(record, key));
  if (missing) throw new Error(`${label} não contém o campo obrigatório: ${missing}.`);
};

/** @param {{ name?: string, size?: number, type?: string } | null | undefined} file */
export const assertFiscalStagingManifestFile = (file) => {
  if (!file) throw new Error("Selecione o manifesto fiscal.");
  const name = textId(file.name);
  const size = Number(file.size);
  const type = textId(file.type).toLowerCase();
  if (!name.toLowerCase().endsWith(".json") || /[\\/]/.test(name)) {
    throw new Error("O manifesto deve ser um arquivo JSON válido.");
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FISCAL_STAGING_MANIFEST_BYTES) {
    throw new Error("O manifesto deve ter entre 1 byte e 256 KB.");
  }
  if (type && !["application/json", "text/json"].includes(type)) {
    throw new Error("O tipo do manifesto deve ser JSON.");
  }
  return { name, size, type: type || "application/json" };
};

/** @param {Record<string, unknown>} manifest */
export const assertFiscalStagingManifest = (manifest = {}) => {
  assertExactKeys(manifest, [
    "schema_version", "batch_id", "classification", "candidate_count", "source_stage",
    "requested_target_stage", "group_context_ref_hmac", "empresa_context_ref_hmac",
    "membership_ref_hmac", "context_resolution", "staging_entity", "operational_entity",
    "source_sha256", "candidates", "controls",
  ], "Manifesto fiscal");
  if (manifest.schema_version !== "1.0"
    || manifest.classification !== "READY_FOR_EXPLICIT_STAGING_AUTHORIZATION"
    || manifest.source_stage !== "quarantine"
    || manifest.requested_target_stage !== "staging"
    || manifest.context_resolution !== "CANONICAL_IDS_RESOLVED_ONLY_IN_MEMORY"
    || manifest.staging_entity !== "SolicitacaoAprovacao"
    || manifest.operational_entity !== "NotaFiscal") {
    throw new Error("O manifesto não pertence ao contrato fiscal de transição esperado.");
  }
  const batchId = textId(manifest.batch_id);
  if (!BATCH_ID.test(batchId)) throw new Error("Identificador do lote fiscal inválido.");
  for (const field of ["group_context_ref_hmac", "empresa_context_ref_hmac", "membership_ref_hmac"]) {
    if (!HMAC_SHA256.test(textId(manifest[field]))) throw new Error(`Referência protegida inválida: ${field}.`);
  }

  assertExactKeys(manifest.source_sha256, [
    "envelopes", "human_review", "canonical_context_map", "canonical_context_validation",
  ], "Integridade das fontes");
  if (Object.values(manifest.source_sha256).some((hash) => !SHA256.test(textId(hash)))) {
    throw new Error("Hash de origem inválido no manifesto fiscal.");
  }

  const candidates = Array.isArray(manifest.candidates) ? manifest.candidates : [];
  const candidateCount = Number(manifest.candidate_count);
  if (!Number.isSafeInteger(candidateCount) || candidateCount < 1 || candidateCount > 100 || candidates.length !== candidateCount) {
    throw new Error("A quantidade de candidatos do manifesto é inválida.");
  }
  const references = new Set();
  candidates.forEach((candidate) => {
    assertExactKeys(candidate, [
      "candidate_ref_hmac", "entity", "reconciliation_type", "decision", "pedido_link_policy",
      "source_stage", "requested_target_stage", "staging_entity", "staging_operation",
      "homologation_status", "production_reapproval_required", "import_authorized",
      "operational_promotion_allowed", "transition_authorized",
    ], "Candidato fiscal");
    const reference = textId(candidate.candidate_ref_hmac);
    if (!HMAC_SHA256.test(reference) || references.has(reference)) {
      throw new Error("Referência de candidato inválida ou duplicada.");
    }
    references.add(reference);
    if (candidate.entity !== "NotaFiscal"
      || candidate.reconciliation_type !== FISCAL_MANUAL_RECONCILIATION_TYPE
      || candidate.decision !== "PRESERVAR_SEM_VINCULO_PEDIDO"
      || candidate.pedido_link_policy !== "PRESERVE_NULL"
      || candidate.source_stage !== "quarantine"
      || candidate.requested_target_stage !== "staging"
      || candidate.staging_entity !== "SolicitacaoAprovacao"
      || candidate.staging_operation !== "manual_fiscal_reconciliation_staging"
      || candidate.homologation_status !== "LOCAL_HOMOLOGATION_COMPLETE_IMPORT_BLOCKED"
      || candidate.production_reapproval_required !== true
      || candidate.import_authorized !== false
      || candidate.operational_promotion_allowed !== false
      || candidate.transition_authorized !== false) {
      throw new Error("Candidato fiscal contém autorização ou destino incompatível com o staging bloqueado.");
    }
  });

  assertExactKeys(manifest.controls, [
    "explicit_staging_authorization_required", "files_moved_to_staging", "backend_or_base44_called",
    "erp_persistence_performed", "import_authorized", "operational_promotion_allowed",
    "production_reapproval_required", "raw_canonical_ids_persisted",
  ], "Controles do manifesto");
  const controls = /** @type {Record<string, unknown>} */ (manifest.controls);
  if (controls.explicit_staging_authorization_required !== true
    || controls.files_moved_to_staging !== false
    || controls.backend_or_base44_called !== false
    || controls.erp_persistence_performed !== false
    || controls.import_authorized !== false
    || controls.operational_promotion_allowed !== false
    || controls.production_reapproval_required !== true
    || controls.raw_canonical_ids_persisted !== false) {
    throw new Error("Os controles do manifesto não preservam o bloqueio operacional.");
  }

  return {
    batchId,
    candidateCount,
    classification: manifest.classification,
    operationalPromotionAllowed: false,
    requiresCanonicalContextVerification: true,
  };
};

/** @param {{ name?: string, size?: number, type?: string, text?: () => Promise<string> } | null | undefined} file */
export const readFiscalStagingManifest = async (file) => {
  assertFiscalStagingManifestFile(file);
  if (typeof file?.text !== "function") throw new Error("Não foi possível ler o manifesto neste navegador.");
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("O conteúdo do manifesto não é um JSON válido.");
  }
  return assertFiscalStagingManifest(parsed);
};

/** @param {{ name?: string, size?: number, type?: string } | null | undefined} file */
export const assertConciliacaoEvidenceFile = (file) => {
  if (!file) throw new Error("Selecione a evidência.");
  const type = textId(file.type).toLowerCase();
  const name = textId(file.name);
  const size = Number(file.size);
  if (!ALLOWED_CONCILIACAO_EVIDENCE_TYPES.has(type)) {
    throw new Error("Use um arquivo PDF, JPG, PNG ou WEBP.");
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CONCILIACAO_EVIDENCE_BYTES) {
    throw new Error("A evidência deve ter entre 1 byte e 10 MB.");
  }
  const allowedExtensions = EVIDENCE_EXTENSIONS_BY_TYPE[type] || [];
  if (!name || !allowedExtensions.some((extension) => name.toLowerCase().endsWith(extension))) {
    throw new Error("A extensão do arquivo não corresponde ao tipo informado.");
  }
  return { name, size, type };
};

/** @param {{ arrayBuffer?: () => Promise<ArrayBuffer> }} file */
export const calculateConciliacaoEvidenceSha256 = async (file) => {
  if (!globalThis.crypto?.subtle || typeof file?.arrayBuffer !== "function") {
    throw new Error("Não foi possível calcular a integridade da evidência neste navegador.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * @param {{ userId?: unknown, groupId?: unknown, empresaId?: unknown, contexto?: unknown, tipoSolicitacao?: unknown }} scope
 */
export const buildConciliacaoFinanceiraQueryKey = ({ userId, groupId, empresaId, contexto, tipoSolicitacao = MANUAL_RECONCILIATION_TYPE }) => [
  "conciliacoes-manuais-staging",
  textId(tipoSolicitacao) || MANUAL_RECONCILIATION_TYPE,
  textId(userId) || null,
  textId(groupId) || null,
  textId(empresaId) || null,
  textId(contexto) || null,
];

/**
 * @param {{ contexto?: unknown, groupId?: unknown, empresaId?: unknown, canReview?: boolean, canApprove?: boolean }} access
 */
export const resolveConciliacaoFinanceiraAccess = ({
  contexto,
  groupId,
  empresaId,
  canReview = false,
  canApprove = false,
}) => ({
  validContext: contexto === "empresa" && Boolean(textId(groupId) && textId(empresaId)),
  canView: canReview === true || canApprove === true,
});

/**
 * @param {{
 *   activeTab?: unknown,
 *   canViewApprovals?: boolean,
 *   canReviewFinance?: boolean,
 *   canApproveFinance?: boolean,
 *   canReviewFiscal?: boolean,
 *   canApproveFiscal?: boolean
 * }} access
 */
export const resolveConciliacaoCentralTabs = ({
  activeTab,
  canViewApprovals = false,
  canReviewFinance = false,
  canApproveFinance = false,
  canReviewFiscal = false,
  canApproveFiscal = false,
}) => {
  const tabsPermitidas = [
    ...(canViewApprovals ? ["descontos", "limite", "duplicatas"] : []),
    ...(canReviewFinance || canApproveFinance ? ["conciliacao"] : []),
    ...(canReviewFiscal || canApproveFiscal ? ["conciliacao-fiscal"] : []),
  ];
  const requestedTab = textId(activeTab);
  return {
    tabsPermitidas,
    tabVisivel: tabsPermitidas.includes(requestedTab) ? requestedTab : (tabsPermitidas[0] || null),
    totalTabs: tabsPermitidas.length,
  };
};

/**
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>}
 */
export const getConciliacaoEnvelope = (record = {}) => {
  const proposed = record.dados_propostos;
  if (!proposed || typeof proposed !== "object" || Array.isArray(proposed)) return {};
  const envelope = /** @type {Record<string, unknown>} */ (proposed).envelope_staging;
  return envelope && typeof envelope === "object" && !Array.isArray(envelope)
    ? /** @type {Record<string, unknown>} */ (envelope)
    : {};
};

/** @param {Record<string, unknown>} record */
export const getConciliacaoRecordId = (record = {}) => textId(record.id);

/** @param {Record<string, unknown>} record */
export const getConciliacaoReference = (record = {}) => textId(record.referencia_staging);

/** @param {Record<string, unknown>} record */
export const getConciliacaoEntityLabel = (record = {}) => (
  textId(record.entidade_alvo) === "ContaPagar"
    ? "Conta a pagar"
    : textId(record.entidade_alvo) === "NotaFiscal" ? "Nota fiscal" : "Conta a receber"
);

/** @param {Record<string, unknown>} record */
export const getConciliacaoStage = (record = {}) => textId(
  getConciliacaoEnvelope(record).etapa_conciliacao,
);

/** @param {Record<string, unknown>} record */
export const getConciliacaoEvidenceCount = (record = {}) => {
  const evidence = getConciliacaoEnvelope(record).evidencias_conciliacao;
  return Array.isArray(evidence) ? evidence.length : 0;
};

/** @param {Record<string, unknown>} record */
export const getConciliacaoEvidences = (record = {}) => {
  const evidence = getConciliacaoEnvelope(record).evidencias_conciliacao;
  return Array.isArray(evidence) ? evidence : [];
};

/** @param {Record<string, unknown>} record */
export const getConciliacaoDecision = (record = {}) => {
  const envelope = getConciliacaoEnvelope(record);
  const decision = textId(record.tipo_solicitacao) === FISCAL_MANUAL_RECONCILIATION_TYPE
    ? envelope.decisao_fiscal
    : envelope.decisao_financeira;
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return "";
  return textId(/** @type {Record<string, unknown>} */ (decision).classificacao);
};

/** @param {Record<string, unknown>} record */
export const getConciliacaoOriginUserId = (record = {}) => {
  const history = getConciliacaoEnvelope(record).historico_conciliacao;
  const firstEntry = Array.isArray(history) ? history[0] : null;
  return textId(firstEntry?.usuario_id) || textId(record.solicitante_id) || null;
};

/** @param {Record<string, unknown>} record */
export const getConciliacaoReviewerUserId = (record = {}) => {
  const approvals = getConciliacaoEnvelope(record).aprovacoes_conciliacao;
  const reviewStage = textId(record.tipo_solicitacao) === FISCAL_MANUAL_RECONCILIATION_TYPE
    ? "revisao_fiscal"
    : "revisao_financeira";
  const review = Array.isArray(approvals)
    ? approvals.find((item) => item?.etapa === reviewStage)
    : null;
  return textId(review?.usuario_id) || null;
};

/**
 * Mantem apenas registros do dominio e contexto explicitamente selecionados.
 * @param {Array<Record<string, unknown>>} records
 * @param {{ groupId?: unknown, empresaId?: unknown, tipoSolicitacao?: unknown }} scope
 */
export const filterConciliacoesByScope = (records, { groupId, empresaId, tipoSolicitacao = MANUAL_RECONCILIATION_TYPE }) => {
  const expectedGroupId = textId(groupId);
  const expectedEmpresaId = textId(empresaId);
  if (!expectedGroupId || !expectedEmpresaId) return [];
  return (Array.isArray(records) ? records : []).filter((record) => (
    textId(record.group_id) === expectedGroupId
    && textId(record.empresa_id) === expectedEmpresaId
    && textId(record.scope_type) === "empresa"
    && textId(record.tipo_solicitacao) === textId(tipoSolicitacao)
  ));
};

/**
 * @param {{ record?: Record<string, unknown>, userId?: unknown, canReview?: boolean, canApprove?: boolean }} input
 */
export const resolveConciliacaoRowActions = ({
  record = {},
  userId,
  canReview = false,
  canApprove = false,
}) => {
  const actorId = textId(userId);
  const stage = getConciliacaoStage(record);
  const originUserId = getConciliacaoOriginUserId(record);
  const reviewerUserId = getConciliacaoReviewerUserId(record);
  return {
    canAttach: canReview === true && ["aguardando_evidencia", "evidencia_anexada"].includes(stage),
    canPerformReview: canReview === true
      && stage === "evidencia_anexada"
      && Boolean(actorId)
      && actorId !== originUserId,
    canPerformApproval: canApprove === true
      && stage === "aguardando_aprovacao_final"
      && Boolean(actorId)
      && actorId !== originUserId
      && actorId !== reviewerUserId,
  };
};
