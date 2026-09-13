export const SITE_CPA_WORK_LIST_OPERATION = 'siteObraList';
export const SITE_CPA_WORK_GET_OPERATION = 'siteObraGet';
export const SITE_CPA_PROJECT_LIST_OPERATION = 'siteProjetoList';
export const SITE_CPA_PROJECT_GET_OPERATION = 'siteProjetoGet';
export const SITE_CPA_COST_CENTER_LIST_OPERATION = 'siteCentroCustoList';
export const SITE_CPA_COST_CENTER_GET_OPERATION = 'siteCentroCustoGet';

export const SITE_CPA_WORK_OPERATIONS = new Set([
  SITE_CPA_WORK_LIST_OPERATION,
  SITE_CPA_WORK_GET_OPERATION,
  SITE_CPA_PROJECT_LIST_OPERATION,
  SITE_CPA_PROJECT_GET_OPERATION,
  SITE_CPA_COST_CENTER_LIST_OPERATION,
  SITE_CPA_COST_CENTER_GET_OPERATION,
]);

const READ_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']);
const SORT_FIELDS = new Set(['NAME', 'CODE', 'STATUS', 'UPDATED_AT']);
const text = (value) => String(value ?? '').trim();
const normalized = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaWorkError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaWorkError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaWorkError(400, code);
  }
  return result || null;
};

const safeSearch = (value) => {
  const result = text(value);
  if (result.length > 100 || /[{}$<>]/.test(result)) {
    throw new SiteCpaWorkError(400, 'site_cpa_work_filter_invalid');
  }
  return result || null;
};

const dataOf = (payload = {}) => (
  payload?.data && typeof payload.data === 'object' ? payload.data : payload
);

export const normalizeWorkInput = (payload = {}, operation = '') => {
  const data = dataOf(payload);
  for (const field of ['allowedWorkIds', 'allowed_work_ids', 'allWorks', 'all_works', 'customerId', 'cliente_id']) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      throw new SiteCpaWorkError(400, 'site_cpa_work_authority_input_forbidden');
    }
  }
  const page = Number(data.page ?? 1);
  const pageSize = Number(data.pageSize ?? 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new SiteCpaWorkError(400, 'site_cpa_work_page_invalid');
  }
  const sort = normalized(data.sort || 'NAME');
  if (!SORT_FIELDS.has(sort)) throw new SiteCpaWorkError(400, 'site_cpa_work_sort_invalid');
  const input = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_work_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_work_customer_invalid', true),
    obraId: safeId(data.obraId || data.workId, 'site_cpa_work_not_found'),
    projectId: safeId(data.projectId, 'site_cpa_project_not_found'),
    costCenterId: safeId(data.costCenterId || data.centroCustoId, 'site_cpa_cost_center_not_found'),
    parentProjectId: safeId(data.parentProjectId, 'site_cpa_project_not_found'),
    search: safeSearch(data.search || data.query),
    status: safeSearch(data.status),
    active: typeof data.active === 'boolean' ? data.active : null,
    page,
    pageSize,
    sort,
  };
  const required = {
    [SITE_CPA_WORK_GET_OPERATION]: 'obraId',
    [SITE_CPA_PROJECT_GET_OPERATION]: 'projectId',
    [SITE_CPA_COST_CENTER_GET_OPERATION]: 'costCenterId',
  }[operation];
  if (required && !input[required]) {
    const code = required === 'obraId' ? 'site_cpa_work_not_found'
      : required === 'projectId' ? 'site_cpa_project_not_found' : 'site_cpa_cost_center_not_found';
    throw new SiteCpaWorkError(400, code);
  }
  return input;
};

export const assertWorkRole = (role) => {
  if (!READ_ROLES.has(normalized(role))) throw new SiteCpaWorkError(403, 'site_cpa_work_forbidden');
};

export const workAccessFromLink = (link = {}, role = '') => {
  const proposed = link?.dados_propostos || {};
  const raw = proposed.allowedWorkIds || proposed.allowed_work_ids || proposed.obras_autorizadas || [];
  const allowedWorkIds = new Set((Array.isArray(raw) ? raw : []).map(text).filter(Boolean));
  const hasAllWorksPolicy = Object.prototype.hasOwnProperty.call(proposed, 'allWorks')
    || Object.prototype.hasOwnProperty.call(proposed, 'all_works');
  const requestedAll = proposed.allWorks === true || proposed.all_works === true;
  return {
    allowedWorkIds,
    allWorks: requestedAll || (!hasAllWorksPolicy && allowedWorkIds.size === 0
      && normalized(role) === 'ADMIN_EMPRESA'),
  };
};

export const assertAllowedWork = (access, obraId) => {
  const id = text(obraId);
  if (!id || access?.allWorks === true) return;
  if (!access?.allowedWorkIds?.has(id)) throw new SiteCpaWorkError(403, 'site_cpa_work_forbidden');
};

export const mapWorkStatus = (value, active = true) => {
  const status = normalized(value || (active === false ? 'INACTIVE' : 'ACTIVE'));
  if (active === false || status.includes('INATIV')) return 'INACTIVE';
  if (status.includes('CANCEL')) return 'CANCELLED';
  if (status.includes('CONCLU') || status.includes('FINALIZ')) return 'COMPLETED';
  return 'ACTIVE';
};

export const selectionState = (status) => ({
  selectable: status === 'ACTIVE',
  reason: status === 'ACTIVE' ? null : status === 'COMPLETED' ? 'WORK_COMPLETED'
    : status === 'CANCELLED' ? 'WORK_CANCELLED' : 'WORK_INACTIVE',
});

export const recordWorkId = (record = {}) => text(
  record.obra_id || record.obra_destino_id || record.endereco_obra_id || record.work_id,
);
export const recordProjectId = (record = {}) => text(
  record.projeto_id || record.projeto_pai_id || record.project_id,
);
export const recordCustomerId = (record = {}) => text(
  record.cliente_id || record.customer_id,
);

export const paginate = (records, input) => {
  const start = (input.page - 1) * input.pageSize;
  return {
    items: records.slice(start, start + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    total: records.length,
    hasMore: records.length > start + input.pageSize,
  };
};
