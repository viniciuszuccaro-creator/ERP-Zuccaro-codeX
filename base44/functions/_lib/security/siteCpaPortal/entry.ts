import {
  SiteCpaCustomerError,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';
import { SITE_CPA_PAYMENT_ATTEMPT_OPERATION, SITE_CPA_PAYMENT_EVENT_ORIGIN } from '../siteCpaPayment/contract.ts';
import {
  SITE_CPA_PORTAL_BOLETOS_OPERATION,
  SITE_CPA_PORTAL_DOCUMENT_OPERATION,
  SITE_CPA_PORTAL_NFE_OPERATION,
  SITE_CPA_PORTAL_OPERATIONS,
  SITE_CPA_PORTAL_ORDER_GET_OPERATION,
  SITE_CPA_PORTAL_ORDERS_OPERATION,
  SITE_CPA_PORTAL_PAYMENTS_OPERATION,
  SITE_CPA_PORTAL_RECEIVABLES_OPERATION,
  SiteCpaPortalError,
  allowedWorkIdsFromLink,
  assertAllowedWork,
  assertPortalRole,
  customerIdFromNfe,
  isPortalVisibleOrder,
  isPortalVisibleReceivable,
  nfeDate,
  normalizePortalInput,
  orderDate,
  paginate,
  recordWorkId,
  withinDates,
  maskCnpj,
} from './contract.ts';
import {
  isBoleto,
  nfeBelongsToCustomer,
  paymentAttemptFromEvent,
  publicNfe,
  publicOrder,
  publicPayment,
  publicReceivable,
} from './mappers.ts';

export {
  SITE_CPA_PORTAL_BOLETOS_OPERATION,
  SITE_CPA_PORTAL_DOCUMENT_OPERATION,
  SITE_CPA_PORTAL_NFE_OPERATION,
  SITE_CPA_PORTAL_OPERATIONS,
  SITE_CPA_PORTAL_ORDER_GET_OPERATION,
  SITE_CPA_PORTAL_ORDERS_OPERATION,
  SITE_CPA_PORTAL_PAYMENTS_OPERATION,
  SITE_CPA_PORTAL_RECEIVABLES_OPERATION,
  SiteCpaPortalError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const normalize = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const entityFilter = async (base44, entityName, filter, sort, limit = 1000) => {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) throw new SiteCpaPortalError(503, 'site_cpa_portal_unavailable');
  try {
    const rows = await entity.filter(filter, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    throw new SiteCpaPortalError(503, 'site_cpa_portal_unavailable');
  }
};

const loadContext = async ({ base44, scope, input }) => {
  try {
    const context = await resolveApprovedSiteCustomerContext({
      base44,
      scope,
      erpCustomerId: input.erpCustomerId,
      externalUserId: input.externalUserId,
    });
    return {
      ...context,
      allowedWorkIds: allowedWorkIdsFromLink(context.link),
    };
  } catch (error) {
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaPortalError(error.status === 503 ? 503 : 403, 'site_cpa_portal_customer_invalid');
    }
    throw new SiteCpaPortalError(503, 'site_cpa_portal_unavailable');
  }
};

const auditPortal = async ({ base44, scope, request, input, outcome, success, resultCount = 0, entity = 'Cliente', recordId = null }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Consulta' : 'Bloqueio',
      modulo: ['sitePortalNfe', 'sitePortalDocumento'].includes(request.operation) ? 'Fiscal' : 'Financeiro',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: entity,
      registro_id: recordId,
      descricao: `${request.operation} ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_novos: {
        operation: request.operation,
        correlation_id: request.correlationId || null,
        customer_id: input.erpCustomerId || null,
        result_count: resultCount,
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaPortalError(503, 'site_cpa_audit_unavailable');
  }
};

const responseBase = (context, now) => ({
  customer: {
    erpCustomerId: context.customer.id,
    name: context.customer.nome_fantasia || context.customer.razao_social || context.customer.nome || null,
    cnpjMasked: maskCnpj(context.customer.cnpj || context.customer.cpf_cnpj),
  },
  source: 'ERP',
  snapshotAt: new Date(now).toISOString(),
});

const matchesWork = (record, context, requestedWorkId) => {
  const workId = recordWorkId(record);
  if (requestedWorkId && workId !== requestedWorkId) return false;
  if (context.allowedWorkIds.size && workId && !context.allowedWorkIds.has(workId)) return false;
  return true;
};

const listOrders = async ({ base44, scope, input, context, now }) => {
  assertAllowedWork(context.allowedWorkIds, input.obraId);
  const rows = await entityFilter(base44, 'Pedido', {
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    cliente_id: input.erpCustomerId,
  }, '-data_pedido');
  const filtered = rows.filter((record) => (
    customerBelongsToScope(record, scope)
    && text(record.cliente_id) === input.erpCustomerId
    && isPortalVisibleOrder(record)
    && matchesWork(record, context, input.obraId)
    && withinDates(orderDate(record), input.dateFrom, input.dateTo)
    && (!input.status || normalize(record.status) === normalize(input.status))
    && (!input.externalOrderId || text(record.site_external_order_id || record.external_order_id) === input.externalOrderId)
    && (!input.orderNumber || text(record.numero_pedido || record.numero).includes(input.orderNumber))
    && (!input.projectId || text(record.projeto_id || record.project_id) === input.projectId)
  ));
  const page = paginate(filtered, input);
  return { ...responseBase(context, now), ...page, items: page.items.map((item) => publicOrder(item, false)) };
};

const getOrder = async ({ base44, scope, input, context, now }) => {
  const rows = await entityFilter(base44, 'Pedido', {
    id: input.erpOrderId,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const order = rows.find((record) => customerBelongsToScope(record, scope));
  if (!order) throw new SiteCpaPortalError(404, 'site_cpa_portal_order_not_found');
  if (text(order.cliente_id) !== input.erpCustomerId || !isPortalVisibleOrder(order)) {
    throw new SiteCpaPortalError(403, 'site_cpa_portal_scope_forbidden');
  }
  assertAllowedWork(context.allowedWorkIds, recordWorkId(order));
  return { ...responseBase(context, now), order: publicOrder(order, true) };
};

const listNfe = async ({ base44, scope, input, context, now }) => {
  assertAllowedWork(context.allowedWorkIds, input.obraId);
  const rows = await entityFilter(base44, 'NotaFiscal', {
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, '-data_emissao');
  const filtered = rows.filter((record) => (
    customerBelongsToScope(record, scope)
    && nfeBelongsToCustomer(record, input.erpCustomerId)
    && matchesWork(record, context, input.obraId)
    && withinDates(nfeDate(record), input.dateFrom, input.dateTo)
    && (!input.nfeId || text(record.id) === input.nfeId)
    && (!input.nfeNumber || text(record.numero || record.numero_nfe).includes(input.nfeNumber))
    && (!input.status || normalize(record.status) === normalize(input.status))
  ));
  if (input.nfeId && !filtered.length) throw new SiteCpaPortalError(404, 'site_cpa_portal_nfe_not_found');
  const page = paginate(filtered, input);
  return { ...responseBase(context, now), ...page, items: page.items.map(publicNfe) };
};

const loadReceivables = async ({ base44, scope, input, context }) => {
  assertAllowedWork(context.allowedWorkIds, input.obraId);
  const rows = await entityFilter(base44, 'ContaReceber', {
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    cliente_id: input.erpCustomerId,
  }, '-data_vencimento');
  return rows.filter((record) => (
    customerBelongsToScope(record, scope)
    && text(record.cliente_id) === input.erpCustomerId
    && isPortalVisibleReceivable(record)
    && matchesWork(record, context, input.obraId)
    && withinDates(record.data_vencimento || record.created_date, input.dateFrom, input.dateTo)
    && (!input.receivableId || text(record.id) === input.receivableId)
    && (!input.documentNumber || text(record.numero_documento || record.documento).includes(input.documentNumber))
    && (!input.status || normalize(publicReceivable(record).status) === normalize(input.status))
  ));
};

const listReceivables = async (args, boletoOnly) => {
  const rows = await loadReceivables(args);
  const filtered = boletoOnly ? rows.filter(isBoleto) : rows;
  if (args.input.receivableId && !filtered.length) {
    throw new SiteCpaPortalError(404, boletoOnly ? 'site_cpa_portal_boleto_not_found' : 'site_cpa_portal_receivable_not_found');
  }
  const page = paginate(filtered, args.input);
  return {
    ...responseBase(args.context, args.now),
    ...page,
    items: page.items.map((item) => publicReceivable(item, args.now, boletoOnly)),
  };
};

const listPayments = async ({ base44, scope, input, context, now }) => {
  const rows = await entityFilter(base44, 'IntegracaoEvento', {
    origem: SITE_CPA_PAYMENT_EVENT_ORIGIN,
    operacao: SITE_CPA_PAYMENT_ATTEMPT_OPERATION,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, '-created_date');
  const filtered = rows.map(paymentAttemptFromEvent).filter((attempt) => (
    attempt
    && text(attempt.erpCustomerId) === input.erpCustomerId
    && text(attempt.externalUserId) === input.externalUserId
    && (!input.paymentAttemptId || text(attempt.paymentAttemptId) === input.paymentAttemptId)
    && (!input.erpOrderId || text(attempt.erpOrderId) === input.erpOrderId)
    && (!input.status || normalize(attempt.status) === normalize(input.status))
    && withinDates(attempt.createdAt, input.dateFrom, input.dateTo)
  ));
  if (input.paymentAttemptId && !filtered.length) throw new SiteCpaPortalError(404, 'site_cpa_portal_payment_not_found');
  const page = paginate(filtered, input);
  return { ...responseBase(context, now), ...page, items: page.items.map(publicPayment) };
};

const fileUriFor = (record, documentType) => {
  if (documentType === 'XML') return text(record.xml_file_uri || record.arquivo_xml_uri);
  if (documentType === 'DANFE') return text(record.danfe_file_uri || record.pdf_file_uri || record.arquivo_danfe_uri);
  return text(record.boleto_file_uri || record.arquivo_boleto_uri || record.pdf_boleto_file_uri);
};

const assertPrivateFileUri = (fileUri, documentType) => {
  const extension = documentType === 'XML' ? '.xml' : '.pdf';
  if (!fileUri || fileUri.length > 500 || fileUri.includes('..') || fileUri.includes('\\')
    || /^(?:https?|file|data):/i.test(fileUri) || !/^[A-Za-z0-9._/-]+$/.test(fileUri)
    || !fileUri.toLowerCase().endsWith(extension)) {
    throw new SiteCpaPortalError(503, 'site_cpa_portal_document_unavailable');
  }
};

const downloadDocument = async ({ base44, scope, input, context, now }) => {
  const isFiscal = ['DANFE', 'XML'].includes(input.documentType);
  const entityName = isFiscal ? 'NotaFiscal' : 'ContaReceber';
  const rows = await entityFilter(base44, entityName, {
    id: input.resourceId,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const record = rows.find((item) => customerBelongsToScope(item, scope));
  if (!record) throw new SiteCpaPortalError(404, 'site_cpa_portal_document_not_found');
  const ownerId = isFiscal ? customerIdFromNfe(record) : text(record.cliente_id);
  if (ownerId !== input.erpCustomerId) throw new SiteCpaPortalError(403, 'site_cpa_portal_download_forbidden');
  if (!isFiscal && (!isPortalVisibleReceivable(record) || !isBoleto(record))) {
    throw new SiteCpaPortalError(403, 'site_cpa_portal_download_forbidden');
  }
  assertAllowedWork(context.allowedWorkIds, recordWorkId(record));
  const fileUri = fileUriFor(record, input.documentType);
  assertPrivateFileUri(fileUri, input.documentType);
  const signer = base44?.asServiceRole?.integrations?.Core?.CreateFileSignedUrl;
  if (typeof signer !== 'function') throw new SiteCpaPortalError(503, 'site_cpa_portal_document_unavailable');
  let signed;
  try {
    signed = await signer({ file_uri: fileUri, expires_in: 300 });
  } catch {
    throw new SiteCpaPortalError(503, 'site_cpa_portal_document_unavailable');
  }
  if (!text(signed?.signed_url)) throw new SiteCpaPortalError(503, 'site_cpa_portal_document_unavailable');
  const label = text(isFiscal ? record.numero || record.numero_nfe : record.numero_documento || record.id)
    .replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'documento';
  return {
    ...responseBase(context, now),
    document: {
      resourceId: record.id,
      documentType: input.documentType,
      contentType: input.documentType === 'XML' ? 'application/xml' : 'application/pdf',
      fileName: `${input.documentType.toLowerCase()}-${label}.${input.documentType === 'XML' ? 'xml' : 'pdf'}`,
      signedUrl: signed.signed_url,
      expiresIn: 300,
    },
  };
};

const executePortalOperation = async (args) => {
  const { request, context } = args;
  switch (request.operation) {
    case SITE_CPA_PORTAL_ORDERS_OPERATION: return listOrders(args);
    case SITE_CPA_PORTAL_ORDER_GET_OPERATION: return getOrder(args);
    case SITE_CPA_PORTAL_NFE_OPERATION: return listNfe(args);
    case SITE_CPA_PORTAL_BOLETOS_OPERATION: return listReceivables(args, true);
    case SITE_CPA_PORTAL_RECEIVABLES_OPERATION: return listReceivables(args, false);
    case SITE_CPA_PORTAL_PAYMENTS_OPERATION: return listPayments(args);
    case SITE_CPA_PORTAL_DOCUMENT_OPERATION: return downloadDocument(args);
    default: throw new SiteCpaPortalError(501, 'site_cpa_operation_not_implemented');
  }
};

export const resolveSiteCpaPortalOperation = async ({ base44, payload, scope, request, now = Date.now() } = {}) => {
  const input = normalizePortalInput(payload, request?.operation);
  let context;
  try {
    context = await loadContext({ base44, scope, input });
    assertPortalRole(request.operation, context.role, input.documentType);
    const data = await executePortalOperation({ base44, scope, request, input, context, now });
    const resultCount = Array.isArray(data?.items) ? data.items.length : 1;
    await auditPortal({
      base44, scope, request, input, outcome: 'allowed', success: true, resultCount,
      entity: request.operation === SITE_CPA_PORTAL_NFE_OPERATION ? 'NotaFiscal' : 'Cliente',
      recordId: input.resourceId || input.erpOrderId || input.nfeId || input.receivableId || null,
    });
    return data;
  } catch (error) {
    const failure = error instanceof SiteCpaPortalError
      ? error
      : new SiteCpaPortalError(503, 'site_cpa_portal_unavailable');
    try {
      await auditPortal({ base44, scope, request, input, outcome: failure.code, success: false });
    } catch (auditError) {
      if (auditError instanceof SiteCpaPortalError) throw auditError;
      throw new SiteCpaPortalError(503, 'site_cpa_audit_unavailable');
    }
    throw failure;
  }
};

const capabilityFor = async (base44, scope, entityName) => {
  try {
    await entityFilter(base44, entityName, {
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    }, '-updated_date', 1);
    return 'ready';
  } catch {
    return 'blocked';
  }
};

export const portalCapabilities = async ({ base44, scope } = {}) => {
  const [orders, fiscal, receivables, payments] = await Promise.all([
    capabilityFor(base44, scope, 'Pedido'),
    capabilityFor(base44, scope, 'NotaFiscal'),
    capabilityFor(base44, scope, 'ContaReceber'),
    capabilityFor(base44, scope, 'IntegracaoEvento'),
  ]);
  const financial = receivables === 'ready' && payments === 'ready' ? 'ready' : 'blocked';
  const document = typeof base44?.asServiceRole?.integrations?.Core?.CreateFileSignedUrl === 'function'
    ? 'ready' : 'blocked';
  const states = [orders, fiscal, financial, document];
  const portal = states.every((state) => state === 'ready')
    ? 'ready' : states.some((state) => state === 'ready') ? 'degraded' : 'blocked';
  return { PORTAL: portal, PORTAL_FINANCIAL: financial, PORTAL_FISCAL: fiscal, PORTAL_DOCUMENT: document };
};
