import {
  SiteCpaCustomerError,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';
import { allowedWorkIdsFromLink, recordWorkId } from '../siteCpaPortal/contract.ts';
import {
  SITE_CPA_DELIVERY_GET_OPERATION,
  SITE_CPA_DELIVERY_LIST_OPERATION,
  SITE_CPA_DELIVERY_OPERATIONS,
  SITE_CPA_DELIVERY_PROOFS_OPERATION,
  SITE_CPA_DELIVERY_TIMELINE_OPERATION,
  SiteCpaDeliveryError,
  assertDeliveryRole,
  deliveryDate,
  mapDeliveryStatus,
  normalizeDeliveryInput,
  paginateDeliveries,
  withinDeliveryDates,
} from './contract.ts';
import {
  deliveryProofDescriptors,
  publicDelivery,
  publicTimeline,
} from './mappers.ts';

export {
  SITE_CPA_DELIVERY_GET_OPERATION,
  SITE_CPA_DELIVERY_LIST_OPERATION,
  SITE_CPA_DELIVERY_OPERATIONS,
  SITE_CPA_DELIVERY_PROOFS_OPERATION,
  SITE_CPA_DELIVERY_TIMELINE_OPERATION,
  SiteCpaDeliveryError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const normalize = (value) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

const entityFilter = async (base44, entityName, filter, sort, limit = 1000) => {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.filter) throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_unavailable');
  try {
    const rows = await entity.filter(filter, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_unavailable');
  }
};

const auditDelivery = async ({ base44, scope, request, input, outcome, success, resultCount = 0, durationMs = 0 }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Consulta' : 'Bloqueio',
      modulo: 'Expedicao',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'Entrega',
      registro_id: input?.deliveryId || null,
      descricao: `${request?.operation || 'siteEntrega'} ${outcome}`,
      group_id: scope?.groupId || null,
      empresa_id: scope?.empresaId || null,
      dados_novos: {
        operation: request?.operation || null,
        correlation_id: request?.correlationId || null,
        customer_id: input?.erpCustomerId || null,
        delivery_id: input?.deliveryId || null,
        result_count: resultCount,
        duration_ms: Math.max(0, Number(durationMs) || 0),
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaDeliveryError(503, 'site_cpa_audit_unavailable');
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
    assertDeliveryRole(context.role);
    return { ...context, allowedWorkIds: allowedWorkIdsFromLink(context.link) };
  } catch (error) {
    if (error instanceof SiteCpaDeliveryError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaDeliveryError(error.status === 503 ? 503 : 403, 'site_cpa_delivery_customer_invalid');
    }
    throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_unavailable');
  }
};

const workAllowed = (allowedWorkIds, workId) => (
  !allowedWorkIds?.size || !workId || allowedWorkIds.has(text(workId))
);

const assertRequestedWork = (context, obraId) => {
  if (context.allowedWorkIds.size && obraId && !context.allowedWorkIds.has(text(obraId))) {
    throw new SiteCpaDeliveryError(403, 'site_cpa_delivery_work_forbidden');
  }
};

const orderIsOwned = (order, scope, customerId) => (
  order
  && customerBelongsToScope(order, scope)
  && text(order.cliente_id) === text(customerId)
  && order.pode_ver_no_portal === true
);

const deliveryIsOwned = (delivery, order, scope, input, context) => {
  if (!delivery || !customerBelongsToScope(delivery, scope) || !orderIsOwned(order, scope, input.erpCustomerId)) return false;
  if (text(delivery.pedido_id) !== text(order.id)) return false;
  if (text(delivery.cliente_id) && text(delivery.cliente_id) !== input.erpCustomerId) return false;
  const workId = recordWorkId(delivery) || recordWorkId(order);
  return workAllowed(context.allowedWorkIds, workId);
};

const loadOwnedDeliveries = async ({ base44, scope, input, context }) => {
  assertRequestedWork(context, input.obraId);
  const [deliveries, orders] = await Promise.all([
    entityFilter(base44, 'Entrega', {
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    }, '-data_previsao'),
    entityFilter(base44, 'Pedido', {
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      cliente_id: input.erpCustomerId,
    }, '-data_pedido'),
  ]);
  const orderMap = new Map(orders.filter((order) => orderIsOwned(order, scope, input.erpCustomerId))
    .map((order) => [text(order.id), order]));
  return deliveries.map((delivery) => ({ delivery, order: orderMap.get(text(delivery.pedido_id)) }))
    .filter(({ delivery, order }) => deliveryIsOwned(delivery, order, scope, input, context));
};

const loadOwnedDelivery = async (args) => {
  const { base44, scope, input, context } = args;
  const deliveries = await entityFilter(base44, 'Entrega', {
    id: input.deliveryId,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const delivery = deliveries.find((item) => customerBelongsToScope(item, scope));
  if (!delivery) throw new SiteCpaDeliveryError(404, 'site_cpa_delivery_not_found');
  if (!text(delivery.pedido_id)) throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_order_link_unavailable');
  const orders = await entityFilter(base44, 'Pedido', {
    id: delivery.pedido_id,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const order = orders.find((item) => customerBelongsToScope(item, scope));
  if (!order) throw new SiteCpaDeliveryError(404, 'site_cpa_delivery_order_not_found');
  if (!deliveryIsOwned(delivery, order, scope, input, context)) {
    throw new SiteCpaDeliveryError(403, 'site_cpa_delivery_scope_forbidden');
  }
  if (input.erpOrderId && input.erpOrderId !== text(order.id)) {
    throw new SiteCpaDeliveryError(403, 'site_cpa_delivery_scope_forbidden');
  }
  assertRequestedWork(context, input.obraId);
  if (input.obraId && input.obraId !== (recordWorkId(delivery) || recordWorkId(order))) {
    throw new SiteCpaDeliveryError(404, 'site_cpa_delivery_not_found');
  }
  return { delivery, order };
};

const responseBase = (context, now) => ({
  customer: { erpCustomerId: context.customer.id },
  source: 'ERP',
  snapshotAt: new Date(now).toISOString(),
});

const listDeliveries = async (args) => {
  const { input, context, now } = args;
  const owned = await loadOwnedDeliveries(args);
  const filtered = owned.filter(({ delivery, order }) => {
    const workId = recordWorkId(delivery) || recordWorkId(order);
    return (!input.deliveryId || text(delivery.id) === input.deliveryId)
      && (!input.erpOrderId || text(order.id) === input.erpOrderId)
      && (!input.obraId || workId === input.obraId)
      && (!input.orderNumber || text(delivery.numero_pedido || order.numero_pedido || order.numero).includes(input.orderNumber))
      && (!input.status || mapDeliveryStatus(delivery) === normalize(input.status))
      && withinDeliveryDates(deliveryDate(delivery), input.dateFrom, input.dateTo);
  });
  const page = paginateDeliveries(filtered, input);
  return {
    ...responseBase(context, now),
    ...page,
    items: page.items.map(({ delivery, order }) => publicDelivery(delivery, order, false)),
  };
};

const getDelivery = async (args) => {
  const { input, context, now } = args;
  const { delivery, order } = await loadOwnedDelivery(args);
  return { ...responseBase(context, now), delivery: publicDelivery(delivery, order, true) };
};

const getTimeline = async (args) => {
  const { context, now } = args;
  const { delivery, order } = await loadOwnedDelivery(args);
  return {
    ...responseBase(context, now),
    delivery: publicDelivery(delivery, order, false),
    events: publicTimeline(delivery),
  };
};

const signedProofs = async (args) => {
  const { base44, input, context, now } = args;
  const { delivery, order } = await loadOwnedDelivery(args);
  let proofs = deliveryProofDescriptors(delivery);
  if (input.proofId) proofs = proofs.filter((proof) => proof.proofId === input.proofId);
  if (!proofs.length) throw new SiteCpaDeliveryError(404, 'site_cpa_delivery_proof_not_found');
  const signer = base44?.asServiceRole?.integrations?.Core?.CreateFileSignedUrl;
  if (typeof signer !== 'function') throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_document_unavailable');
  const result = [];
  for (const proof of proofs.slice(0, 20)) {
    let signed;
    try {
      signed = await signer({ file_uri: proof.fileUri, expires_in: 300 });
    } catch {
      throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_document_unavailable');
    }
    if (!text(signed?.signed_url)) throw new SiteCpaDeliveryError(503, 'site_cpa_delivery_document_unavailable');
    result.push({
      proofId: proof.proofId,
      type: proof.type,
      createdAt: proof.createdAt,
      signedUrl: signed.signed_url,
      expiresIn: 300,
      metadata: proof.metadata,
    });
  }
  return {
    ...responseBase(context, now),
    delivery: publicDelivery(delivery, order, false),
    proofs: result,
  };
};

const execute = (args) => {
  switch (args.request.operation) {
    case SITE_CPA_DELIVERY_LIST_OPERATION: return listDeliveries(args);
    case SITE_CPA_DELIVERY_GET_OPERATION: return getDelivery(args);
    case SITE_CPA_DELIVERY_TIMELINE_OPERATION: return getTimeline(args);
    case SITE_CPA_DELIVERY_PROOFS_OPERATION: return signedProofs(args);
    default: throw new SiteCpaDeliveryError(501, 'site_cpa_operation_not_implemented');
  }
};

export const resolveSiteCpaDeliveryOperation = async ({ base44, payload, scope, request, now = Date.now() } = {}) => {
  let input = null;
  const startedAt = Date.now();
  try {
    input = normalizeDeliveryInput(payload, request?.operation);
    const context = await loadContext({ base44, scope, input });
    const data = await execute({ base44, scope, request, input, context, now });
    await auditDelivery({
      base44, scope, request, input, outcome: 'allowed', success: true,
      resultCount: Array.isArray(data?.items) ? data.items.length
        : Array.isArray(data?.events) ? data.events.length : Array.isArray(data?.proofs) ? data.proofs.length : 1,
      durationMs: Date.now() - startedAt,
    });
    return data;
  } catch (error) {
    const failure = error instanceof SiteCpaDeliveryError
      ? error : new SiteCpaDeliveryError(503, 'site_cpa_delivery_unavailable');
    try {
      await auditDelivery({
        base44, scope, request, input, outcome: failure.code, success: false, durationMs: Date.now() - startedAt,
      });
    } catch (auditError) {
      if (auditError instanceof SiteCpaDeliveryError) throw auditError;
      throw new SiteCpaDeliveryError(503, 'site_cpa_audit_unavailable');
    }
    throw failure;
  }
};

const capabilityEntity = async (base44, scope, name) => {
  try {
    await entityFilter(base44, name, { group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1);
    return true;
  } catch {
    return false;
  }
};

export const deliveryCapability = async ({ base44, scope } = {}) => {
  const [deliveries, orders] = await Promise.all([
    capabilityEntity(base44, scope, 'Entrega'),
    capabilityEntity(base44, scope, 'Pedido'),
  ]);
  if (!deliveries || !orders) return 'blocked';
  return typeof base44?.asServiceRole?.integrations?.Core?.CreateFileSignedUrl === 'function'
    ? 'ready' : 'degraded';
};
