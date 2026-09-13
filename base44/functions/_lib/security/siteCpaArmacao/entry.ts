import {
  SiteCpaCustomerError, customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';
import {
  SITE_CPA_QUOTE_CREATE_OPERATION, SiteCpaQuoteError, resolveSiteCpaQuoteOperation,
} from '../siteCpaQuoteNegotiation/entry.ts';
import { SiteCpaWorkError, resolveWorkContext } from '../siteCpaWork/entry.ts';
import { workAccessFromLink } from '../siteCpaWork/contract.ts';
import {
  ARMATION_LIMITS, SITE_CPA_ARMACAO_CONFIRM_OPERATION, SITE_CPA_ARMACAO_CREATE_OPERATION,
  SITE_CPA_ARMACAO_GET_OPERATION, SITE_CPA_ARMACAO_OPERATIONS,
  SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION, SITE_CPA_ARMACAO_UPDATE_OPERATION,
  SiteCpaArmacaoError, assertArmationRole, normalizeArmationInput,
} from './contract.ts';

export {
  SITE_CPA_ARMACAO_CONFIRM_OPERATION, SITE_CPA_ARMACAO_CREATE_OPERATION,
  SITE_CPA_ARMACAO_GET_OPERATION, SITE_CPA_ARMACAO_OPERATIONS,
  SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION, SITE_CPA_ARMACAO_UPDATE_OPERATION,
  SiteCpaArmacaoError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const sha256 = async (value) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const entity = (base44, name) => {
  const api = base44?.asServiceRole?.entities?.[name];
  if (!api?.filter) throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
  return api;
};
const filter = async (base44, name, criteria, sort, limit = 200) => {
  try {
    const rows = await entity(base44, name).filter(criteria, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error instanceof SiteCpaArmacaoError) throw error;
    throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
  }
};
const create = async (base44, name, record) => {
  try {
    const api = entity(base44, name);
    if (!api.create) throw new Error('create unavailable');
    return await api.create(record);
  } catch {
    throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
  }
};
const update = async (base44, name, id, patch) => {
  try {
    const api = entity(base44, name);
    if (!api.update) throw new Error('update unavailable');
    return await api.update(id, patch);
  } catch {
    throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
  }
};

const audit = async ({ base44, scope, request, input, record, outcome, success, durationMs }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA', acao: success ? 'Integracao' : 'Bloqueio', modulo: 'Producao',
      tipo_auditoria: success ? 'integracao' : 'seguranca', entidade: 'Projeto',
      registro_id: record?.id || input?.armacaoId || null,
      descricao: `${request?.operation || 'siteArmacao'} ${outcome}`,
      group_id: scope?.groupId || null, empresa_id: scope?.empresaId || null,
      dados_novos: {
        operation: request?.operation || null, correlation_id: request?.correlationId || null,
        customer_id: input?.erpCustomerId || null, external_armacao_id: input?.externalArmacaoId || null,
        version: Number(record?.site_armacao_version || input?.expectedVersion || 0) || null,
        piece_count: Array.isArray(record?.site_armacao_snapshot?.pieces)
          ? record.site_armacao_snapshot.pieces.length : 0,
        duration_ms: Math.max(0, Number(durationMs) || 0), outcome,
      },
      data_hora: new Date().toISOString(), sucesso: success === true,
    });
  } catch {
    throw new SiteCpaArmacaoError(503, 'site_cpa_audit_unavailable');
  }
};

const loadContext = async ({ base44, scope, input, operation }) => {
  try {
    const context = await resolveApprovedSiteCustomerContext({
      base44, scope, erpCustomerId: input.erpCustomerId, externalUserId: input.externalUserId,
    });
    assertArmationRole(context.role, operation);
    return context;
  } catch (error) {
    if (error instanceof SiteCpaArmacaoError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaArmacaoError(error.status === 503 ? 503 : 403, 'site_cpa_armacao_customer_invalid');
    }
    throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
  }
};

const validateReference = async ({ base44, scope, name, id, customerId, type = null }) => {
  if (!id) return null;
  const rows = await filter(base44, name, { id, group_id: scope.groupId, empresa_id: scope.empresaId }, undefined, 2);
  const record = rows.find((item) => customerBelongsToScope(item, scope));
  if (!record || (text(record.cliente_id) && text(record.cliente_id) !== customerId)
    || (type && text(record.tipo).toLowerCase() !== type.toLowerCase())) {
    throw new SiteCpaArmacaoError(403, 'site_cpa_armacao_context_invalid');
  }
  return record;
};

const validateContextReferences = async ({ base44, scope, input, context }) => {
  try {
    await resolveWorkContext({
      base44, scope, obraId: input.obraId, projectId: input.projectId, costCenterId: input.costCenterId,
      context: { ...context, workAccess: workAccessFromLink(context.link, context.role) },
    });
  } catch (error) {
    if (error instanceof SiteCpaWorkError) {
      if (input.obraId && ['site_cpa_work_forbidden', 'site_cpa_work_not_found'].includes(error.code)) {
        throw new SiteCpaArmacaoError(403, 'site_cpa_armacao_work_invalid');
      }
      if (error.status === 503) throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
      throw new SiteCpaArmacaoError(403, 'site_cpa_armacao_context_invalid');
    }
    throw error;
  }
  await Promise.all([
    validateReference({ base44, scope, name: 'Pedido', id: input.erpOrderId, customerId: input.erpCustomerId }),
    validateReference({ base44, scope, name: 'Pedido', id: input.erpQuoteId, customerId: input.erpCustomerId, type: 'Orçamento' }),
  ]);
};

const validateProducts = async ({ base44, scope, package: armationPackage }) => {
  const ids = new Set(armationPackage.pieces.flatMap((piece) => piece.reinforcement)
    .map((item) => item.erpProductId).filter(Boolean));
  if (!ids.size) return;
  const products = await filter(base44, 'Produto', {
    group_id: scope.groupId, empresa_id: scope.empresaId,
  }, undefined, 1000);
  const valid = new Set(products.filter((item) => customerBelongsToScope(item, scope)
    && item.ativo !== false && !text(item.status).toLowerCase().includes('inativ')).map((item) => text(item.id)));
  if ([...ids].some((id) => !valid.has(id))) {
    throw new SiteCpaArmacaoError(422, 'site_cpa_armacao_product_invalid');
  }
};

const readiness = (snapshot) => {
  if (snapshot.conflicts.length || snapshot.unresolved.length) return 'NEEDS_REVIEW';
  if (snapshot.source === 'PROJECT_READER'
    && (!snapshot.evidence.length || snapshot.evidence.some((item) => item.confidence == null || item.confidence < 0.8))) {
    return 'NEEDS_REVIEW';
  }
  return 'READY_FOR_CUSTOMER_REVIEW';
};

const publicRecord = (record, { replayed = false, now = Date.now() } = {}) => ({
  armacaoId: record.id, externalArmacaoId: record.site_external_armacao_id || null,
  externalProjectId: record.site_external_project_id || null, erpCustomerId: record.cliente_id,
  version: Number(record.site_armacao_version || 1), status: record.site_armacao_status || 'DRAFT',
  reviewStatus: record.site_armacao_review_status || 'NEEDS_REVIEW',
  customerConfirmed: record.site_customer_confirmed === true,
  technicalApproval: 'PENDING_INTERNAL_REVIEW', productionReleased: false, productionOrderId: null,
  commercial: {
    erpQuoteId: record.site_armacao_quote_id || null, quoteNumber: record.site_armacao_quote_number || null,
    status: record.site_armacao_quote_id ? 'SENT' : 'NOT_SENT',
  },
  context: {
    obraId: record.obra_id || null, projectId: record.projeto_pai_id || null,
    costCenterId: record.centro_custo_id || null, erpOrderId: record.pedido_id || null,
  },
  package: record.site_armacao_snapshot || null,
  versions: (Array.isArray(record.site_armacao_versions) ? record.site_armacao_versions : []).map((item) => ({
    version: item.version, status: item.status, createdAt: item.createdAt, actor: item.actor,
  })),
  source: 'ERP', updatedAt: record.updated_date || record.created_date || null,
  snapshotAt: new Date(now).toISOString(), replayed,
});

const loadRecord = async ({ base44, scope, input }) => {
  const rows = await filter(base44, 'Projeto', {
    id: input.armacaoId, group_id: scope.groupId, empresa_id: scope.empresaId,
  }, undefined, 2);
  const record = rows.find((item) => customerBelongsToScope(item, scope));
  if (!record) throw new SiteCpaArmacaoError(404, 'site_cpa_armacao_not_found');
  if (text(record.cliente_id) !== input.erpCustomerId
    || text(record.site_external_user_id) !== input.externalUserId || record.site_armacao_package !== true) {
    throw new SiteCpaArmacaoError(403, 'site_cpa_armacao_scope_forbidden');
  }
  return record;
};

const assertImmutableContext = (record, input) => {
  const references = [
    ['obraId', 'obra_id'], ['projectId', 'projeto_pai_id'], ['costCenterId', 'centro_custo_id'],
    ['erpOrderId', 'pedido_id'], ['erpQuoteId', 'orcamento_id'],
  ];
  if (references.some(([inputKey, recordKey]) => input[inputKey]
    && text(input[inputKey]) !== text(record[recordKey]))) {
    throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_context_immutable');
  }
};

const assertVersion = (record, input) => {
  const currentVersion = Number(record.site_armacao_version || 1);
  if (currentVersion !== input.expectedVersion) {
    throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_version_conflict', undefined, { currentVersion });
  }
};
const versionEntry = ({ version, status, snapshot, now }) => ({
  version, status, snapshot, actor: 'SITE_CPA_CUSTOMER', createdAt: new Date(now).toISOString(),
});

const createPackage = async ({ base44, scope, input, context, now }) => {
  await validateContextReferences({ base44, scope, input, context });
  await validateProducts({ base44, scope, package: input.package });
  const hash = await sha256(stableStringify(input.package));
  const existing = await filter(base44, 'Projeto', {
    group_id: scope.groupId, empresa_id: scope.empresaId, site_external_armacao_id: input.externalArmacaoId,
  }, '-created_date', 2);
  if (existing.length) {
    const record = existing[0];
    if (text(record.cliente_id) !== input.erpCustomerId
      || text(record.site_external_user_id) !== input.externalUserId
      || text(record.site_armacao_payload_hash) !== hash) {
      throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_idempotency_conflict');
    }
    return publicRecord(record, { replayed: true, now });
  }
  const status = 'DRAFT';
  const createdAt = new Date(now).toISOString();
  const payload = {
    group_id: scope.groupId, empresa_id: scope.empresaId, cliente_id: input.erpCustomerId,
    nome: input.package.title || `Armação ${input.externalArmacaoId}`,
    tipo: 'Armação', status: 'Rascunho', origem: 'SITE_CPA', site_armacao_package: true,
    site_external_armacao_id: input.externalArmacaoId, site_external_project_id: input.externalProjectId,
    site_external_user_id: input.externalUserId, site_armacao_payload_hash: hash,
    site_armacao_version: 1, site_armacao_status: status,
    site_armacao_review_status: readiness(input.package), site_customer_confirmed: false,
    site_technical_approved: false, site_production_released: false, site_op_created: false,
    site_armacao_snapshot: input.package,
    site_armacao_versions: [versionEntry({ version: 1, status, snapshot: input.package, now })],
    obra_id: input.obraId, projeto_pai_id: input.projectId, centro_custo_id: input.costCenterId,
    pedido_id: input.erpOrderId, orcamento_id: input.erpQuoteId,
    contract_version: '1', data_criacao: createdAt,
  };
  const created = await create(base44, 'Projeto', payload);
  return publicRecord({ ...payload, ...created }, { now });
};

const updatePackage = async ({ base44, scope, input, context, now }) => {
  const record = await loadRecord({ base44, scope, input });
  assertVersion(record, input);
  assertImmutableContext(record, input);
  if (record.site_armacao_quote_id) throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_commercial_locked');
  await validateContextReferences({ base44, scope, input: {
    ...input, obraId: input.obraId || record.obra_id, projectId: input.projectId || record.projeto_pai_id,
    costCenterId: input.costCenterId || record.centro_custo_id, erpOrderId: input.erpOrderId || record.pedido_id,
    erpQuoteId: input.erpQuoteId || record.orcamento_id,
  }, context });
  await validateProducts({ base44, scope, package: input.package });
  const nextVersion = input.expectedVersion + 1;
  const history = Array.isArray(record.site_armacao_versions) ? record.site_armacao_versions : [];
  if (history.length >= ARMATION_LIMITS.maxVersions) throw new SiteCpaArmacaoError(409, 'site_cpa_armacao_version_limit');
  const patch = {
    nome: input.package.title || record.nome, site_armacao_payload_hash: await sha256(stableStringify(input.package)),
    status: 'Rascunho', site_armacao_version: nextVersion, site_armacao_status: 'DRAFT',
    site_armacao_review_status: readiness(input.package), site_customer_confirmed: false,
    site_armacao_snapshot: input.package,
    site_armacao_versions: [...history, versionEntry({ version: nextVersion, status: 'DRAFT', snapshot: input.package, now })],
  };
  const updated = await update(base44, 'Projeto', record.id, patch);
  return publicRecord({ ...record, ...patch, ...updated }, { now });
};

const confirmPackage = async ({ base44, scope, input, now }) => {
  const record = await loadRecord({ base44, scope, input });
  assertVersion(record, input);
  if (record.site_customer_confirmed === true) return publicRecord(record, { replayed: true, now });
  const patch = {
    site_armacao_status: 'CUSTOMER_CONFIRMED', site_customer_confirmed: true,
    site_customer_confirmed_at: new Date(now).toISOString(), status: 'Aguardando Análise Técnica',
    site_technical_approved: false, site_production_released: false, site_op_created: false,
  };
  const updated = await update(base44, 'Projeto', record.id, patch);
  return publicRecord({ ...record, ...patch, ...updated }, { now });
};

const sendCommercial = async ({ base44, scope, input, request, now }) => {
  const record = await loadRecord({ base44, scope, input });
  assertVersion(record, input);
  if (record.site_customer_confirmed !== true) throw new SiteCpaArmacaoError(422, 'site_cpa_armacao_confirmation_required');
  if (record.site_armacao_quote_id) return publicRecord(record, { replayed: true, now });
  const snapshot = record.site_armacao_snapshot || {};
  const customItems = [{
    customItemRef: `ARM-${record.id}-V${record.site_armacao_version}`,
    description: snapshot.title || `Pacote de armacao ${record.site_external_armacao_id}`,
    quantity: 1,
    commercialUnit: 'PACOTE',
    specification: `${snapshot.pieces?.length || 0} pecas; pacote ${record.id}; revisao ${record.site_armacao_version}`,
  }];
  let quote;
  try {
    quote = await resolveSiteCpaQuoteOperation({
      base44, scope, now, request: { ...request, operation: SITE_CPA_QUOTE_CREATE_OPERATION },
      payload: { data: {
        externalQuoteId: input.externalQuoteId || `ARM-${record.site_external_armacao_id}`,
        externalUserId: input.externalUserId, erpCustomerId: input.erpCustomerId,
        source: 'ARMACAO', customItems, deliveryMode: 'PICKUP', obraId: record.obra_id,
        projectId: record.projeto_pai_id, costCenterId: record.centro_custo_id,
        armacaoPackageId: record.id, armacaoRevision: String(record.site_armacao_version), notes: snapshot.notes,
      } },
    });
  } catch (error) {
    if (error instanceof SiteCpaQuoteError) {
      throw new SiteCpaArmacaoError(error.status, error.code, error.message, error.details);
    }
    throw new SiteCpaArmacaoError(503, 'site_cpa_armacao_commercial_unavailable');
  }
  const patch = {
    site_armacao_status: 'WAITING_SELLER', status: 'Em Análise Comercial',
    site_armacao_quote_id: quote.erpQuoteId, site_armacao_quote_number: quote.quoteNumber,
    site_armacao_sent_commercial_at: new Date(now).toISOString(),
    site_technical_approved: false, site_production_released: false, site_op_created: false,
  };
  const updated = await update(base44, 'Projeto', record.id, patch);
  return publicRecord({ ...record, ...patch, ...updated }, { now });
};

const execute = (args) => {
  switch (args.request.operation) {
    case SITE_CPA_ARMACAO_CREATE_OPERATION: return createPackage(args);
    case SITE_CPA_ARMACAO_GET_OPERATION: return loadRecord(args).then((record) => publicRecord(record, { now: args.now }));
    case SITE_CPA_ARMACAO_UPDATE_OPERATION: return updatePackage(args);
    case SITE_CPA_ARMACAO_CONFIRM_OPERATION: return confirmPackage(args);
    case SITE_CPA_ARMACAO_SEND_COMMERCIAL_OPERATION: return sendCommercial(args);
    default: throw new SiteCpaArmacaoError(501, 'site_cpa_operation_not_implemented');
  }
};

export const resolveSiteCpaArmacaoOperation = async ({ base44, payload, scope, request, now = Date.now() } = {}) => {
  let input = null;
  let record = null;
  const startedAt = Date.now();
  try {
    input = normalizeArmationInput(payload, request?.operation);
    const context = await loadContext({ base44, scope, input, operation: request.operation });
    const data = await execute({ base44, scope, request, input, context, now });
    record = { id: data.armacaoId, site_armacao_version: data.version, site_armacao_snapshot: data.package };
    await audit({ base44, scope, request, input, record, outcome: 'allowed', success: true, durationMs: Date.now() - startedAt });
    return data;
  } catch (error) {
    const failure = error instanceof SiteCpaArmacaoError
      ? error : new SiteCpaArmacaoError(503, 'site_cpa_armacao_unavailable');
    await audit({ base44, scope, request, input, record, outcome: failure.code, success: false, durationMs: Date.now() - startedAt });
    throw failure;
  }
};

export const armationCapabilities = async ({ base44, scope } = {}) => {
  try {
    await Promise.all([
      filter(base44, 'Projeto', { group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1),
      filter(base44, 'Pedido', { group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1),
    ]);
    return { WORK: 'degraded', PRODUCTION_INTAKE: 'degraded', PRODUCTION_RELEASE: 'blocked' };
  } catch {
    return { WORK: 'blocked', PRODUCTION_INTAKE: 'blocked', PRODUCTION_RELEASE: 'blocked' };
  }
};
