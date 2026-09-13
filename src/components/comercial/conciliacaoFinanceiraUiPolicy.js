const MANUAL_RECONCILIATION_TYPE = "conciliacao_migracao_financeira";

export const MAX_CONCILIACAO_EVIDENCE_BYTES = 10 * 1024 * 1024;
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
 * @param {{ userId?: unknown, groupId?: unknown, empresaId?: unknown, contexto?: unknown }} scope
 */
export const buildConciliacaoFinanceiraQueryKey = ({ userId, groupId, empresaId, contexto }) => [
  "conciliacoes-financeiras-staging",
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
  textId(record.entidade_alvo) === "ContaPagar" ? "Conta a pagar" : "Conta a receber"
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
  const decision = getConciliacaoEnvelope(record).decisao_financeira;
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
  const review = Array.isArray(approvals)
    ? approvals.find((item) => item?.etapa === "revisao_financeira")
    : null;
  return textId(review?.usuario_id) || null;
};

/**
 * Mantem apenas registros financeiros do contexto explicitamente selecionado.
 * @param {Array<Record<string, unknown>>} records
 * @param {{ groupId?: unknown, empresaId?: unknown }} scope
 */
export const filterConciliacoesByScope = (records, { groupId, empresaId }) => {
  const expectedGroupId = textId(groupId);
  const expectedEmpresaId = textId(empresaId);
  if (!expectedGroupId || !expectedEmpresaId) return [];
  return (Array.isArray(records) ? records : []).filter((record) => (
    textId(record.group_id) === expectedGroupId
    && textId(record.empresa_id) === expectedEmpresaId
    && textId(record.scope_type) === "empresa"
    && textId(record.tipo_solicitacao) === MANUAL_RECONCILIATION_TYPE
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
