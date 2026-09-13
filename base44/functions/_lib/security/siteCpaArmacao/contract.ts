export const SITE_CPA_ARMACAO_CREATE_OPERATION = 'siteArmacaoCreate';
export const SITE_CPA_ARMACAO_GET_OPERATION = 'siteArmacaoGet';
export const SITE_CPA_ARMACAO_UPDATE_OPERATION = 'siteArmacaoUpdate';
export const SITE_CPA_ARMACAO_CONFIRM_OPERATION = 'siteArmacaoConfirm';
export const SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION = 'siteArmacaoEnviarParaComercial';

export const SITE_CPA_ARMACAO_OPERATIONS = new Set([
  SITE_CPA_ARMACAO_CREATE_OPERATION,
  SITE_CPA_ARMACAO_GET_OPERATION,
  SITE_CPA_ARMACAO_UPDATE_OPERATION,
  SITE_CPA_ARMACAO_CONFIRM_OPERATION,
  SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION,
]);

export const ARMATION_LIMITS = Object.freeze({ maxPieces: 100, maxVersions: 50, maxText: 1000 });
const WRITE_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR']);
const READ_ROLES = new Set([...WRITE_ROLES, 'CONSULTA']);
const SOURCES = new Set(['MANUAL', 'PROJECT_READER', 'SELLER_ASSISTED', 'QUOTE_CONVERSION']);
const PIECE_TYPES = new Set(['VIGA', 'COLUNA', 'ESTACA', 'BLOCO', 'SAPATA']);
const BEND_TYPES = new Set(['NONE', 'START', 'END', 'BOTH']);
const UNITS_TO_MM = Object.freeze({ MM: 1, CM: 10, M: 1000 });
const FORBIDDEN_FIELDS = new Set([
  'technicallyApproved', 'technicalApproval', 'productionReleased', 'opCreated', 'sellerApproved',
  'readyForProduction', 'productionStatus', 'ordemProducaoId', 'productionOrderId',
]);

const text = (value) => String(value ?? '').trim();
export const normalizedArmationValue = (value) => text(value)
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaArmacaoError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaArmacaoError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaArmacaoError(400, code);
  }
  return result || null;
};

const safeText = (value, max = ARMATION_LIMITS.maxText) => {
  const result = text(value);
  if (result.length > max || /<\/?(?:script|iframe|object|embed)|javascript:/i.test(result)) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_text_invalid');
  }
  return result.replace(/[<>]/g, '') || null;
};

const positive = (value, code, integer = false) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0 || (integer && !Number.isInteger(result))) {
    throw new SiteCpaArmacaoError(400, code);
  }
  return result;
};

const dimensionMm = (value, fallbackUnit = 'MM') => {
  if (value == null || value === '') return null;
  const raw = typeof value === 'object' ? value.value : value;
  const unit = normalizedArmationValue(typeof value === 'object' ? value.unit : fallbackUnit);
  if (!UNITS_TO_MM[unit]) throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_unit_invalid');
  return Math.round(positive(raw, 'site_cpa_armacao_dimension_invalid') * UNITS_TO_MM[unit] * 1000) / 1000;
};

const normalizeReinforcement = (items) => (Array.isArray(items) ? items : []).map((item, index) => ({
  reinforcementId: safeId(item?.reinforcementId || `R-${index + 1}`, 'site_cpa_armacao_reinforcement_invalid', true),
  erpProductId: safeId(item?.erpProductId, 'site_cpa_armacao_product_invalid'),
  diameterMm: positive(item?.diameterMm ?? item?.diameter, 'site_cpa_armacao_diameter_invalid'),
  quantity: positive(item?.quantity, 'site_cpa_armacao_reinforcement_invalid', true),
  lengthMm: dimensionMm(item?.length, item?.unit || 'MM'),
  position: safeText(item?.position, 120),
}));

const normalizeStirrups = (value, lengthMm) => {
  if (!value) return null;
  const spacingMm = dimensionMm(value.spacing, value.unit || 'MM');
  const diameterMm = positive(value.diameterMm ?? value.diameter, 'site_cpa_armacao_diameter_invalid');
  const calculatedCount = spacingMm && lengthMm ? Math.floor(lengthMm / spacingMm) + 1 : null;
  if (value.count != null && calculatedCount !== positive(value.count, 'site_cpa_armacao_stirrup_invalid', true)) {
    throw new SiteCpaArmacaoError(422, 'site_cpa_armacao_stirrup_count_mismatch', undefined, { calculatedCount });
  }
  return { diameterMm, spacingMm, count: calculatedCount };
};

const normalizePiece = (piece, index) => {
  const pieceType = normalizedArmationValue(piece?.pieceType || piece?.type || piece?.tipo_peca);
  if (!PIECE_TYPES.has(pieceType)) throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_piece_type_invalid');
  const unit = normalizedArmationValue(piece?.unit || 'MM');
  const lengthMm = dimensionMm(piece?.length ?? piece?.comprimento, unit);
  if (!lengthMm) throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_dimension_invalid');
  const bend = normalizedArmationValue(piece?.bend || piece?.dobra || 'NONE');
  if (!BEND_TYPES.has(bend)) throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_bend_invalid');
  return {
    pieceId: safeId(piece?.pieceId || piece?.identificador || `P-${index + 1}`, 'site_cpa_armacao_piece_invalid', true),
    pieceType,
    quantity: positive(piece?.quantity ?? piece?.quantidade, 'site_cpa_armacao_quantity_invalid', true),
    dimensions: {
      lengthMm,
      widthMm: dimensionMm(piece?.width ?? piece?.largura, unit),
      heightMm: dimensionMm(piece?.height ?? piece?.altura, unit),
    },
    location: {
      level: safeText(piece?.location?.level || piece?.pavimento, 100),
      axis: safeText(piece?.location?.axis || piece?.eixo, 100),
      reference: safeText(piece?.location?.reference || piece?.localizacao, 160),
    },
    bend,
    reinforcement: normalizeReinforcement(piece?.reinforcement || piece?.armadura),
    stirrups: normalizeStirrups(piece?.stirrups || piece?.estribos, lengthMm),
    notes: safeText(piece?.notes || piece?.observacoes),
  };
};

const normalizeVariables = (variables) => (Array.isArray(variables) ? variables : []).map((item, index) => {
  if (item?.expression || item?.formula || item?.script) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_variable_expression_forbidden');
  }
  return {
    variableId: safeId(item?.variableId || `V-${index + 1}`, 'site_cpa_armacao_variable_invalid', true),
    name: safeText(item?.name, 120), resolvedValue: safeText(item?.resolvedValue ?? item?.value, 200),
    unit: safeText(item?.unit, 20), resolved: item?.resolved === true && item?.resolvedValue != null,
  };
});

const normalizeEvidence = (evidence) => (Array.isArray(evidence) ? evidence : []).map((item, index) => {
  for (const field of ['url', 'path', 'fileUrl', 'signedUrl', 'base64', 'content']) {
    if (Object.prototype.hasOwnProperty.call(item || {}, field)) {
      throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_document_input_forbidden');
    }
  }
  const confidence = item?.confidence == null ? null : Number(item.confidence);
  if (confidence != null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_confidence_invalid');
  }
  return {
    evidenceId: safeId(item?.evidenceId || `E-${index + 1}`, 'site_cpa_armacao_evidence_invalid', true),
    sourceFileId: safeId(item?.sourceFileId, 'site_cpa_armacao_document_invalid'),
    page: item?.page == null ? null : positive(item.page, 'site_cpa_armacao_evidence_invalid', true),
    excerpt: safeText(item?.excerpt, 500), confidence,
  };
});

const normalizeDocument = (value) => {
  if (!value) return null;
  for (const field of ['url', 'path', 'fileUrl', 'signedUrl', 'base64', 'content']) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_document_input_forbidden');
    }
  }
  const sha256 = text(value.sha256).toLowerCase();
  const fileName = safeText(value.fileName, 200);
  const mimeType = text(value.mimeType).toLowerCase();
  const extension = fileName?.toLowerCase().match(/\.(pdf|dwg|dxf|png|jpe?g)$/)?.[1] || null;
  const allowedMimes = new Set([
    'application/pdf', 'application/dwg', 'application/dxf', 'application/acad',
    'image/vnd.dwg', 'image/vnd.dxf', 'image/png', 'image/jpeg', 'application/octet-stream',
  ]);
  if (!safeId(value.sourceFileId || value.fileId, 'site_cpa_armacao_document_invalid')
    || !/^[a-f0-9]{64}$/.test(sha256) || !extension || !allowedMimes.has(mimeType)) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_document_invalid');
  }
  const size = positive(value.size, 'site_cpa_armacao_document_invalid', true);
  if (size > 25 * 1024 * 1024) throw new SiteCpaArmacaoError(413, 'site_cpa_armacao_document_too_large');
  return {
    sourceFileId: safeId(value.sourceFileId || value.fileId, 'site_cpa_armacao_document_invalid', true),
    fileName, mimeType,
    size, sha256, reviewStatus: 'PENDING_SECURE_STORAGE_REVIEW',
  };
};

const packageData = (data) => {
  const pieces = Array.isArray(data?.pieces) ? data.pieces : [];
  if (!pieces.length || pieces.length > ARMATION_LIMITS.maxPieces) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_piece_limit');
  }
  const normalizedPieces = pieces.map(normalizePiece);
  if (new Set(normalizedPieces.map((piece) => piece.pieceId)).size !== normalizedPieces.length) {
    throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_piece_duplicate');
  }
  const variables = normalizeVariables(data?.variables);
  const conflicts = (Array.isArray(data?.conflicts) ? data.conflicts : []).map((item) => safeText(item, 500)).filter(Boolean);
  const unresolved = (Array.isArray(data?.unresolved) ? data.unresolved : []).map((item) => safeText(item, 500)).filter(Boolean);
  if (variables.some((item) => !item.resolved) && !unresolved.length) unresolved.push('VARIABLES_PENDING_REVIEW');
  return {
    title: safeText(data?.title || data?.name, 200), source: normalizedArmationValue(data?.source),
    pieces: normalizedPieces, variables, evidence: normalizeEvidence(data?.evidence),
    document: normalizeDocument(data?.document || data?.fileMetadata), conflicts, unresolved,
    notes: safeText(data?.notes),
  };
};

const dataOf = (payload = {}) => payload?.data && typeof payload.data === 'object' ? payload.data : payload;

export const normalizeArmationInput = (payload = {}, operation = '') => {
  const data = dataOf(payload);
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_production_input_forbidden');
    }
  }
  const result = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_armacao_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_armacao_customer_invalid', true),
    armacaoId: safeId(data.armacaoId || data.erpArmacaoId, 'site_cpa_armacao_not_found'),
    externalArmacaoId: safeId(data.externalArmacaoId, 'site_cpa_armacao_external_id_invalid'),
    externalProjectId: safeId(data.externalProjectId, 'site_cpa_armacao_project_invalid'),
    erpQuoteId: safeId(data.erpQuoteId, 'site_cpa_armacao_quote_invalid'),
    erpOrderId: safeId(data.erpOrderId, 'site_cpa_armacao_order_invalid'),
    obraId: safeId(data.obraId, 'site_cpa_armacao_work_invalid'),
    projectId: safeId(data.projectId, 'site_cpa_armacao_project_invalid'),
    costCenterId: safeId(data.costCenterId, 'site_cpa_armacao_cost_center_invalid'),
    expectedVersion: data.expectedVersion == null ? null : Number(data.expectedVersion),
    externalQuoteId: safeId(data.externalQuoteId, 'site_cpa_armacao_quote_invalid'), package: null,
  };
  if ([SITE_CPA_ARMACAO_CREATE_OPERATION, SITE_CPA_ARMACAO_UPDATE_OPERATION].includes(operation)) {
    result.package = packageData(data);
    if (!SOURCES.has(result.package.source)) throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_source_invalid');
  }
  if (operation === SITE_CPA_ARMACAO_CREATE_OPERATION && !result.externalArmacaoId) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_external_id_invalid');
  }
  if (operation !== SITE_CPA_ARMACAO_CREATE_OPERATION && !result.armacaoId) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_not_found');
  }
  if ([SITE_CPA_ARMACAO_UPDATE_OPERATION, SITE_CPA_ARMACAO_CONFIRM_OPERATION,
    SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION].includes(operation)
    && (!Number.isInteger(result.expectedVersion) || result.expectedVersion < 1)) {
    throw new SiteCpaArmacaoError(400, 'site_cpa_armacao_version_required');
  }
  return result;
};

export const assertArmationRole = (role, operation) => {
  const allowed = operation === SITE_CPA_ARMACAO_GET_OPERATION ? READ_ROLES : WRITE_ROLES;
  if (!allowed.has(normalizedArmationValue(role))) {
    throw new SiteCpaArmacaoError(403, 'site_cpa_armacao_forbidden');
  }
};
