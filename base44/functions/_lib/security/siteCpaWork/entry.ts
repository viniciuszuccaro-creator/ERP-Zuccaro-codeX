import {
  SiteCpaCustomerError, buildCustomerAddresses, customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';
import {
  SITE_CPA_COST_CENTER_GET_OPERATION, SITE_CPA_COST_CENTER_LIST_OPERATION,
  SITE_CPA_PROJECT_GET_OPERATION, SITE_CPA_PROJECT_LIST_OPERATION,
  SITE_CPA_WORK_GET_OPERATION, SITE_CPA_WORK_LIST_OPERATION, SITE_CPA_WORK_OPERATIONS,
  SiteCpaWorkError, assertAllowedWork, assertWorkRole, mapWorkStatus, normalizeWorkInput,
  paginate, recordCustomerId, recordProjectId, recordWorkId, selectionState, workAccessFromLink,
} from './contract.ts';

export {
  SITE_CPA_COST_CENTER_GET_OPERATION, SITE_CPA_COST_CENTER_LIST_OPERATION,
  SITE_CPA_PROJECT_GET_OPERATION, SITE_CPA_PROJECT_LIST_OPERATION,
  SITE_CPA_WORK_GET_OPERATION, SITE_CPA_WORK_LIST_OPERATION, SITE_CPA_WORK_OPERATIONS,
  SiteCpaWorkError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const normalized = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

const filter = async (base44, entityName, criteria, sort = '-updated_date', limit = 1000) => {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) throw new SiteCpaWorkError(503, 'site_cpa_work_unavailable');
  try {
    const rows = await entity.filter(criteria, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    throw new SiteCpaWorkError(503, 'site_cpa_work_unavailable');
  }
};

const loadContext = async ({ base44, scope, input }) => {
  try {
    const context = await resolveApprovedSiteCustomerContext({
      base44, scope, erpCustomerId: input.erpCustomerId, externalUserId: input.externalUserId,
    });
    assertWorkRole(context.role);
    return { ...context, workAccess: workAccessFromLink(context.link, context.role) };
  } catch (error) {
    if (error instanceof SiteCpaWorkError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaWorkError(error.status === 503 ? 503 : 403, 'site_cpa_work_customer_invalid');
    }
    throw new SiteCpaWorkError(503, 'site_cpa_work_unavailable');
  }
};

const customerWorks = (context) => {
  const rawWorks = Array.isArray(context.customer?.locais_entrega) ? context.customer.locais_entrega : [];
  return buildCustomerAddresses(context.customer).filter((address) => address.type === 'OBRA').map((address) => {
    const raw = rawWorks.find((item) => text(item?.id || item?.endereco_id || item?.codigo) === address.addressId) || {};
    return {
      ...address, code: text(raw.codigo || raw.code) || null, status: raw.status || raw.situacao || null,
      active: raw.ativo !== false, createdAt: raw.created_date || raw.createdAt || null,
      updatedAt: raw.updated_date || raw.updatedAt || null,
    };
  });
};

const findWork = (context, obraId) => {
  if (!obraId) return null;
  assertAllowedWork(context.workAccess, obraId);
  const work = customerWorks(context).find((item) => text(item.addressId) === text(obraId));
  if (!work) throw new SiteCpaWorkError(404, 'site_cpa_work_not_found');
  return work;
};

const projectOwnedByCustomer = (project, scope, customerId) => (
  customerBelongsToScope(project, scope) && recordCustomerId(project) === text(customerId)
);

const costCenterOwnedByCustomer = (record, scope, context, projects) => {
  if (!customerBelongsToScope(record, scope)) return false;
  const ownerId = recordCustomerId(record);
  if (ownerId && ownerId !== text(context.customer.id)) return false;
  const workId = recordWorkId(record);
  const projectId = recordProjectId(record);
  const project = projectId ? projects.find((item) => text(item.id) === projectId) : null;
  if (projectId && !project) return false;
  const projectWorkId = project ? recordWorkId(project) : '';
  if (workId && projectWorkId && workId !== projectWorkId) return false;
  const effectiveWorkId = workId || projectWorkId;
  if (effectiveWorkId) {
    try { findWork(context, effectiveWorkId); } catch { return false; }
    return true;
  }
  return Boolean(ownerId && context.workAccess.allWorks);
};

const loadProjects = async ({ base44, scope, context }) => {
  const rows = await filter(base44, 'Projeto', {
    group_id: scope.groupId, empresa_id: scope.empresaId,
  });
  return rows.filter((record) => projectOwnedByCustomer(record, scope, context.customer.id));
};

const assertProjectHierarchy = (project, projects) => {
  const parentId = text(project.parent_project_id || project.projeto_pai_id);
  if (!parentId) return;
  const parent = projects.find((item) => text(item.id) === parentId);
  if (!parent || recordCustomerId(parent) !== recordCustomerId(project)
    || (recordWorkId(parent) && recordWorkId(project) && recordWorkId(parent) !== recordWorkId(project))) {
    throw new SiteCpaWorkError(422, 'site_cpa_work_context_mismatch');
  }
};

const loadCostCenters = async ({ base44, scope, context, projects }) => {
  const rows = await filter(base44, 'CentroCusto', {
    group_id: scope.groupId, empresa_id: scope.empresaId,
  });
  return rows.filter((record) => costCenterOwnedByCustomer(record, scope, context, projects));
};

export const resolveWorkContext = async ({
  base44, scope, context, obraId = null, projectId = null, costCenterId = null,
} = {}) => {
  const work = findWork(context, obraId);
  const projects = projectId || costCenterId ? await loadProjects({ base44, scope, context }) : [];
  const project = projectId ? projects.find((item) => text(item.id) === text(projectId)) : null;
  if (projectId && !project) throw new SiteCpaWorkError(404, 'site_cpa_project_not_found');
  if (project) {
    assertProjectHierarchy(project, projects);
    const projectWorkId = recordWorkId(project);
    if (projectWorkId) {
      findWork(context, projectWorkId);
      if (obraId && projectWorkId !== text(obraId)) {
        throw new SiteCpaWorkError(422, 'site_cpa_work_context_mismatch');
      }
    } else if (!context.workAccess.allWorks && context.workAccess.allowedWorkIds.size) {
      throw new SiteCpaWorkError(403, 'site_cpa_work_forbidden');
    }
  }
  const costCenters = costCenterId
    ? await loadCostCenters({ base44, scope, context, projects }) : [];
  const costCenter = costCenterId
    ? costCenters.find((item) => text(item.id) === text(costCenterId)) : null;
  if (costCenterId && !costCenter) throw new SiteCpaWorkError(404, 'site_cpa_cost_center_not_found');
  if (costCenter) {
    const centerProjectId = recordProjectId(costCenter);
    const centerProject = centerProjectId
      ? projects.find((item) => text(item.id) === centerProjectId) : null;
    const centerWorkId = recordWorkId(costCenter) || recordWorkId(centerProject);
    if (centerWorkId && obraId && centerWorkId !== text(obraId)) {
      throw new SiteCpaWorkError(422, 'site_cpa_work_context_mismatch');
    }
    if (centerProjectId && projectId && centerProjectId !== text(projectId)) {
      throw new SiteCpaWorkError(422, 'site_cpa_work_context_mismatch');
    }
  }
  return { work, project, costCenter };
};

const publicWork = (work, projects, costCenters) => {
  const status = mapWorkStatus(work.status, work.active);
  return {
    obraId: work.addressId,
    code: text(work.code || work.addressId) || null,
    name: work.label || `Obra ${work.addressId}`,
    status,
    ...selectionState(status),
    addressSummary: {
      bairro: work.bairro || null, cidade: work.cidade || null, estado: work.estado || null,
    },
    projectCount: projects.filter((item) => recordWorkId(item) === text(work.addressId)).length,
    costCenterCount: costCenters.filter((item) => recordWorkId(item) === text(work.addressId)).length,
    createdAt: work.createdAt || null,
    updatedAt: work.updatedAt || null,
  };
};

const publicProject = (project) => {
  const status = mapWorkStatus(project.status || project.situacao, project.ativo !== false);
  return {
    projectId: project.id,
    obraId: recordWorkId(project) || null,
    name: text(project.nome || project.titulo || project.descricao) || null,
    code: text(project.codigo || project.code) || null,
    status,
    ...selectionState(status),
    description: text(project.descricao_publica || project.descricao_site) || null,
    parentProjectId: text(project.parent_project_id || project.projeto_pai_id) || null,
    stage: text(project.etapa || project.fase) || null,
    level: text(project.pavimento || project.nivel) || null,
    area: text(project.area || project.setor) || null,
    createdAt: project.created_date || project.createdAt || null,
    updatedAt: project.updated_date || project.updatedAt || null,
  };
};

const publicCostCenter = (record) => {
  const status = mapWorkStatus(record.status || record.situacao, record.ativo !== false);
  return {
    costCenterId: record.id,
    code: text(record.codigo || record.code) || null,
    name: text(record.nome || record.descricao) || null,
    status,
    active: status === 'ACTIVE',
    ...selectionState(status),
    obraId: recordWorkId(record) || null,
    projectId: recordProjectId(record) || null,
    parentCostCenterId: text(record.centro_custo_pai_id) || null,
    createdAt: record.created_date || record.createdAt || null,
    updatedAt: record.updated_date || record.updatedAt || null,
  };
};

const matches = (record, input, name, code, status) => {
  const query = normalized(input.search);
  if (query && !normalized(name).includes(query) && !normalized(code).includes(query)) return false;
  if (input.status && normalized(status) !== normalized(input.status)) return false;
  if (input.active !== null && (status === 'ACTIVE') !== input.active) return false;
  return true;
};

const sorted = (records, input) => [...records].sort((left, right) => {
  const key = input.sort === 'CODE' ? 'code' : input.sort === 'STATUS' ? 'status'
    : input.sort === 'UPDATED_AT' ? 'updatedAt' : 'name';
  return text(left[key]).localeCompare(text(right[key]), 'pt-BR');
});

const listWorks = async ({ base44, scope, context, input }) => {
  const projects = await loadProjects({ base44, scope, context });
  const costCenters = await loadCostCenters({ base44, scope, context, projects });
  const items = customerWorks(context)
    .filter((work) => context.workAccess.allWorks || context.workAccess.allowedWorkIds.has(text(work.addressId)))
    .map((work) => publicWork(work, projects, costCenters))
    .filter((work) => matches(work, input, work.name, work.code, work.status));
  return paginate(sorted(items, input), input);
};

const getWork = async ({ base44, scope, context, input }) => {
  const work = findWork(context, input.obraId);
  const projects = await loadProjects({ base44, scope, context });
  const costCenters = await loadCostCenters({ base44, scope, context, projects });
  return {
    work: publicWork(work, projects, costCenters),
    projects: projects.filter((item) => recordWorkId(item) === input.obraId).map(publicProject),
    costCenters: costCenters.filter((item) => recordWorkId(item) === input.obraId).map(publicCostCenter),
  };
};

const listProjects = async ({ base44, scope, context, input }) => {
  if (input.obraId) findWork(context, input.obraId);
  const projects = await loadProjects({ base44, scope, context });
  const items = projects.filter((project) => {
    assertProjectHierarchy(project, projects);
    const workId = recordWorkId(project);
    if (input.obraId && workId !== input.obraId) return false;
    if (input.parentProjectId && text(project.parent_project_id || project.projeto_pai_id) !== input.parentProjectId) return false;
    if (workId) {
      try { findWork(context, workId); } catch { return false; }
    } else if (!context.workAccess.allWorks) return false;
    const publicItem = publicProject(project);
    return matches(project, input, publicItem.name, publicItem.code, publicItem.status);
  }).map(publicProject);
  return paginate(sorted(items, input), input);
};

const getProject = async ({ base44, scope, context, input }) => {
  const resolved = await resolveWorkContext({
    base44, scope, context, obraId: input.obraId, projectId: input.projectId,
  });
  return { project: publicProject(resolved.project) };
};

const listCostCenters = async ({ base44, scope, context, input }) => {
  if (input.obraId) findWork(context, input.obraId);
  const projects = await loadProjects({ base44, scope, context });
  if (input.projectId) await resolveWorkContext({
    base44, scope, context, obraId: input.obraId, projectId: input.projectId,
  });
  const centers = await loadCostCenters({ base44, scope, context, projects });
  const items = centers.map(publicCostCenter).filter((center) => (
    (!input.obraId || center.obraId === input.obraId)
    && (!input.projectId || center.projectId === input.projectId)
    && matches(center, input, center.name, center.code, center.status)
  ));
  return paginate(sorted(items, input), input);
};

const getCostCenter = async ({ base44, scope, context, input }) => {
  const resolved = await resolveWorkContext({
    base44, scope, context, obraId: input.obraId,
    projectId: input.projectId, costCenterId: input.costCenterId,
  });
  return { costCenter: publicCostCenter(resolved.costCenter) };
};

const execute = (args) => {
  switch (args.request.operation) {
    case SITE_CPA_WORK_LIST_OPERATION: return listWorks(args);
    case SITE_CPA_WORK_GET_OPERATION: return getWork(args);
    case SITE_CPA_PROJECT_LIST_OPERATION: return listProjects(args);
    case SITE_CPA_PROJECT_GET_OPERATION: return getProject(args);
    case SITE_CPA_COST_CENTER_LIST_OPERATION: return listCostCenters(args);
    case SITE_CPA_COST_CENTER_GET_OPERATION: return getCostCenter(args);
    default: throw new SiteCpaWorkError(501, 'site_cpa_operation_not_implemented');
  }
};

const audit = async ({ base44, scope, request, input, success, outcome, resultCount, durationMs }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA', acao: success ? 'Consulta' : 'Bloqueio', modulo: 'Cadastros',
      tipo_auditoria: success ? 'integracao' : 'seguranca', entidade: 'ObraProjetoCentroCusto',
      registro_id: input?.obraId || input?.projectId || input?.costCenterId || null,
      descricao: `${request?.operation || 'siteWork'} ${outcome}`,
      group_id: scope?.groupId || null, empresa_id: scope?.empresaId || null,
      dados_novos: {
        operation: request?.operation || null, correlation_id: request?.correlationId || null,
        customer_id: input?.erpCustomerId || null, obra_id: input?.obraId || null,
        project_id: input?.projectId || null, cost_center_id: input?.costCenterId || null,
        result_count: Math.max(0, Number(resultCount) || 0),
        duration_ms: Math.max(0, Number(durationMs) || 0), outcome,
      },
      data_hora: new Date().toISOString(), sucesso: success === true,
    });
  } catch {
    throw new SiteCpaWorkError(503, 'site_cpa_audit_unavailable');
  }
};

export const resolveSiteCpaWorkOperation = async ({ base44, payload, scope, request, now = Date.now() } = {}) => {
  let input = null;
  const startedAt = Date.now();
  try {
    input = normalizeWorkInput(payload, request?.operation);
    const context = await loadContext({ base44, scope, input });
    const result = await execute({ base44, scope, request, input, context, now });
    const resultCount = Array.isArray(result.items) ? result.items.length : 1;
    await audit({ base44, scope, request, input, success: true, outcome: 'allowed', resultCount, durationMs: Date.now() - startedAt });
    return {
      erpCustomerId: context.customer.id,
      ...result,
      source: 'ERP', snapshotAt: new Date(now).toISOString(),
    };
  } catch (error) {
    const failure = error instanceof SiteCpaWorkError
      ? error : new SiteCpaWorkError(503, 'site_cpa_work_unavailable');
    await audit({ base44, scope, request, input, success: false, outcome: failure.code, resultCount: 0, durationMs: Date.now() - startedAt });
    throw failure;
  }
};

export const workCapabilities = async ({ base44, scope } = {}) => {
  const state = async (entityName) => {
    try {
      await filter(base44, entityName, { group_id: scope.groupId, empresa_id: scope.empresaId }, undefined, 1);
      return 'ready';
    } catch { return 'blocked'; }
  };
  const [projects, costCenters] = await Promise.all([state('Projeto'), state('CentroCusto')]);
  return {
    WORK: projects === 'ready' ? 'ready' : 'blocked',
    WORK_PROJECTS: projects,
    WORK_COST_CENTER: costCenters,
  };
};
