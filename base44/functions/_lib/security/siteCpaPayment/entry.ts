import {
  SiteCpaCustomerError,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
} from '../siteCpaCustomerResolve/entry.ts';
import {
  SITE_CPA_PAYMENT_ATTEMPT_OPERATION,
  SITE_CPA_PAYMENT_CANCEL_OPERATION,
  SITE_CPA_PAYMENT_CREATE_OPERATION,
  SITE_CPA_PAYMENT_EVENT_ORIGIN,
  SITE_CPA_PAYMENT_STATUS_OPERATION,
  SiteCpaPaymentError,
  TERMINAL_PAYMENT_STATUSES,
  assertPaymentRole,
  canonicalPaymentStatus,
  money,
  normalizePaymentCancelInput,
  normalizePaymentCreateInput,
  normalizePaymentLookupInput,
  paymentAttemptIdFor,
  paymentPublicResponse,
  sha256,
  stableStringify,
} from './contract.ts';
import {
  cancelProviderPayment,
  createProviderPayment,
  getProviderPayment,
  resolvePaymentProviderConfig,
} from './provider.ts';

export {
  SITE_CPA_PAYMENT_CANCEL_OPERATION,
  SITE_CPA_PAYMENT_CREATE_OPERATION,
  SITE_CPA_PAYMENT_STATUS_OPERATION,
  SiteCpaPaymentError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const nowIso = (now) => new Date(now).toISOString();
const isPaidTitle = (record) => ['recebido', 'pago', 'liquidado', 'baixado', 'conciliado']
  .includes(text(record?.status).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());
const isCancelled = (value) => ['cancelado', 'cancelled', 'canceled', 'recusado']
  .includes(text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());

const auditPayment = async ({ base44, scope, request, attempt = null, outcome, success, before = null, after = null }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Atualizacao' : 'Bloqueio',
      modulo: 'Financeiro',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'ContaReceber',
      registro_id: attempt?.receivableId || null,
      descricao: `${request?.operation || 'sitePagamento'} ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_anteriores: before,
      dados_novos: after || {
        operation: request?.operation || null,
        correlation_id: request?.correlationId || null,
        payment_attempt_id: attempt?.paymentAttemptId || null,
        order_id: attempt?.erpOrderId || null,
        status: attempt?.status || null,
        reconciliation_status: attempt?.reconciliationStatus || null,
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_audit_unavailable');
  }
};

const loadCustomer = async ({ base44, scope, input }) => {
  try {
    const context = await resolveApprovedSiteCustomerContext({
      base44,
      scope,
      erpCustomerId: input.erpCustomerId,
      externalUserId: input.externalUserId,
    });
    assertPaymentRole(context.role);
    return context.customer;
  } catch (error) {
    if (error instanceof SiteCpaPaymentError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaPaymentError(error.status === 503 ? 503 : 403, 'site_cpa_payment_customer_invalid');
    }
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
};

const loadOrder = async ({ base44, scope, input }) => {
  let rows;
  try {
    rows = await base44.asServiceRole.entities.Pedido.filter({
      id: input.erpOrderId,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      tipo: 'Pedido',
      origem_pedido: 'SITE_CPA',
    }, undefined, 2);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const order = (Array.isArray(rows) ? rows : []).find((item) => customerBelongsToScope(item, scope));
  if (!order) throw new SiteCpaPaymentError(404, 'site_cpa_payment_order_invalid');
  if (text(order.cliente_id) !== input.erpCustomerId
    || text(order.site_external_user_id) !== input.externalUserId) {
    throw new SiteCpaPaymentError(403, 'site_cpa_payment_scope_forbidden');
  }
  if (isCancelled(order.status)) throw new SiteCpaPaymentError(422, 'site_cpa_payment_order_invalid');
  return order;
};

const loadReceivable = async ({ base44, scope, input, order }) => {
  let rows;
  try {
    rows = await base44.asServiceRole.entities.ContaReceber.filter({
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      cliente_id: input.erpCustomerId,
    }, 'data_vencimento', 100);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const linked = (Array.isArray(rows) ? rows : []).filter((item) => (
    customerBelongsToScope(item, scope)
    && [text(item.pedido_id), text(item.origem_documento_id)].includes(text(order.id))
    && !isCancelled(item.status)
  ));
  const selected = input.receivableId
    ? linked.find((item) => text(item.id) === input.receivableId)
    : linked.length === 1 ? linked[0] : null;
  if (!selected && linked.length > 1 && !input.receivableId) {
    throw new SiteCpaPaymentError(409, 'site_cpa_payment_receivable_ambiguous');
  }
  if (!selected) {
    throw new SiteCpaPaymentError(422, 'site_cpa_payment_receivable_pending', 'BLOCKED_PENDING_RECEIVABLE');
  }
  const value = money(selected.valor ?? selected.valor_total ?? 0);
  const received = money(selected.valor_recebido || 0);
  const openAmount = money(value - received);
  if (isPaidTitle(selected) || openAmount <= 0) {
    throw new SiteCpaPaymentError(409, 'site_cpa_payment_already_paid');
  }
  return { record: selected, amount: openAmount };
};

const attemptFromEvent = (event) => event?.response_payload?.attempt || null;

const findAttempt = async ({ base44, scope, paymentAttemptId }) => {
  let rows;
  try {
    rows = await base44.asServiceRole.entities.IntegracaoEvento.filter({
      origem: SITE_CPA_PAYMENT_EVENT_ORIGIN,
      operacao: SITE_CPA_PAYMENT_ATTEMPT_OPERATION,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      idempotency_key: paymentAttemptId,
    }, '-created_date', 2);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const event = (Array.isArray(rows) ? rows : [])[0] || null;
  const attempt = attemptFromEvent(event);
  if (!event || !attempt) throw new SiteCpaPaymentError(404, 'site_cpa_payment_not_found');
  return { event, attempt };
};

const assertAttemptOwner = (attempt, input) => {
  if (text(attempt.erpOrderId) !== input.erpOrderId
    || text(attempt.erpCustomerId) !== input.erpCustomerId
    || text(attempt.externalUserId) !== input.externalUserId) {
    throw new SiteCpaPaymentError(403, 'site_cpa_payment_scope_forbidden');
  }
};

const saveAttempt = async ({ base44, event, attempt, status = 'concluido', httpStatus = 200 }) => {
  try {
    await base44.asServiceRole.entities.IntegracaoEvento.update(event.id, {
      status,
      http_status: httpStatus,
      response_payload: { attempt },
      erro_codigo: null,
    });
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
};

const createAttemptEvent = async ({ base44, scope, request, input, attempt, payloadHash, now }) => {
  try {
    return await base44.asServiceRole.entities.IntegracaoEvento.create({
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      origem: SITE_CPA_PAYMENT_EVENT_ORIGIN,
      operacao: SITE_CPA_PAYMENT_ATTEMPT_OPERATION,
      correlation_id: request?.correlationId || attempt.paymentAttemptId,
      idempotency_key: attempt.paymentAttemptId,
      nonce_hash: await sha256(input.externalPaymentId),
      request_hash: payloadHash,
      status: 'processando',
      http_status: 102,
      tentativas: 1,
      expires_at: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      response_payload: { attempt },
      erro_codigo: null,
    });
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
};

const attemptForExternalPayment = async ({ base44, scope, attemptId, payloadHash }) => {
  try {
    const existing = await findAttempt({ base44, scope, paymentAttemptId: attemptId });
    if (text(existing.event.request_hash) !== payloadHash) {
      throw new SiteCpaPaymentError(409, 'site_cpa_payment_idempotency_conflict');
    }
    return existing;
  } catch (error) {
    if (error instanceof SiteCpaPaymentError && error.code === 'site_cpa_payment_not_found') return null;
    throw error;
  }
};

const reconcilePayment = async ({ base44, scope, request, event, attempt, providerResult, now }) => {
  const status = canonicalPaymentStatus(providerResult.status);
  const previousPaidAmount = money(attempt.paidAmount || 0);
  const paidAmount = money(providerResult.paidAmount || 0);
  const updatedAttempt = {
    ...attempt,
    status,
    paidAmount: Math.max(previousPaidAmount, paidAmount),
    paidAt: providerResult.paidAt || attempt.paidAt || null,
    updatedAt: nowIso(now),
  };
  if (!['PAID', 'PARTIALLY_PAID'].includes(status)) {
    await saveAttempt({ base44, event, attempt: updatedAttempt });
    return updatedAttempt;
  }
  let titles;
  try {
    titles = await base44.asServiceRole.entities.ContaReceber.filter({
      id: attempt.receivableId,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    }, undefined, 2);
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  const title = (Array.isArray(titles) ? titles : []).find((item) => customerBelongsToScope(item, scope));
  if (!title || text(title.cliente_id) !== attempt.erpCustomerId) {
    throw new SiteCpaPaymentError(403, 'site_cpa_payment_scope_forbidden');
  }
  const marker = `${attempt.externalProviderId}:${status}:${paidAmount}`;
  const previousMarkers = Array.isArray(title?.detalhes_pagamento?.site_cpa_provider_events)
    ? title.detalhes_pagamento.site_cpa_provider_events : [];
  if (previousMarkers.includes(marker)) {
    updatedAttempt.reconciliationStatus = title?.detalhes_pagamento?.status_conciliacao || 'MATCHED';
    await saveAttempt({ base44, event, attempt: updatedAttempt });
    return updatedAttempt;
  }
  if (paidAmount <= 0) {
    updatedAttempt.status = 'UNDER_REVIEW';
    updatedAttempt.reconciliationStatus = 'MANUAL_REVIEW';
    updatedAttempt.nextAction = 'MANUAL_RECONCILIATION';
    await saveAttempt({ base44, event, attempt: updatedAttempt });
    await auditPayment({ base44, scope, request, attempt: updatedAttempt, outcome: 'amount_missing', success: false });
    return updatedAttempt;
  }
  if (paidAmount > money(attempt.amount) + 0.009) {
    updatedAttempt.status = 'UNDER_REVIEW';
    updatedAttempt.reconciliationStatus = 'MANUAL_REVIEW';
    updatedAttempt.nextAction = 'MANUAL_RECONCILIATION';
    await saveAttempt({ base44, event, attempt: updatedAttempt });
    await auditPayment({ base44, scope, request, attempt: updatedAttempt, outcome: 'amount_mismatch', success: false });
    return updatedAttempt;
  }
  const titleValue = money(title.valor ?? title.valor_total ?? 0);
  const beforeReceived = money(title.valor_recebido || 0);
  const remaining = money(titleValue - beforeReceived);
  const deltaPaid = money(paidAmount - previousPaidAmount);
  const applied = Math.min(Math.max(deltaPaid, 0), remaining);
  if (applied <= 0) {
    updatedAttempt.reconciliationStatus = 'MATCHED';
    await saveAttempt({ base44, event, attempt: updatedAttempt });
    return updatedAttempt;
  }
  const newReceived = money(beforeReceived + applied);
  const fullyPaid = newReceived + 0.009 >= titleValue;
  const reconciliationStatus = fullyPaid ? 'MATCHED' : 'PARTIAL';
  const titlePatch = {
    valor_recebido: newReceived,
    data_recebimento: text(providerResult.paidAt).slice(0, 10) || nowIso(now).slice(0, 10),
    status: fullyPaid ? 'Recebido' : 'Parcial',
    status_cobranca: fullyPaid ? 'paga' : 'parcial',
    data_retorno_pagamento: nowIso(now),
    detalhes_pagamento: {
      ...(title.detalhes_pagamento || {}),
      forma_pagamento: attempt.method,
      payment_attempt_id: attempt.paymentAttemptId,
      provider_transaction_id: attempt.externalProviderId,
      status_conciliacao: reconciliationStatus,
      site_cpa_provider_events: [...previousMarkers, marker].slice(-100),
    },
  };
  await auditPayment({
    base44, scope, request, attempt, outcome: 'settlement_requested', success: true,
    before: { status: title.status, valor: titleValue, valor_recebido: beforeReceived },
    after: { status: titlePatch.status, valor_recebido: newReceived, reconciliationStatus },
  });
  try {
    await base44.asServiceRole.entities.ContaReceber.update(title.id, titlePatch);
    await base44.asServiceRole.entities.Pedido.update(attempt.erpOrderId, {
      status_pagamento: fullyPaid ? 'Pago' : 'Parcial',
      pagamento_confirmado: fullyPaid,
    });
  } catch {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  updatedAttempt.status = fullyPaid ? 'PAID' : 'PARTIALLY_PAID';
  updatedAttempt.reconciliationStatus = reconciliationStatus;
  updatedAttempt.nextAction = fullyPaid ? 'ORDER_FLOW_CONTINUES' : 'PAYMENT_REMAINING';
  await saveAttempt({ base44, event, attempt: updatedAttempt });
  await auditPayment({ base44, scope, request, attempt: updatedAttempt, outcome: 'payment_reconciled', success: true });
  return updatedAttempt;
};

const createPayment = async ({ base44, payload, scope, request, env, now, providerApi }) => {
  const input = normalizePaymentCreateInput(payload);
  const customer = await loadCustomer({ base44, scope, input });
  const order = await loadOrder({ base44, scope, input });
  const receivable = await loadReceivable({ base44, scope, input, order });
  const payloadHash = await sha256(stableStringify(input));
  const paymentAttemptId = await paymentAttemptIdFor({ scope, input });
  const existing = await attemptForExternalPayment({ base44, scope, attemptId: paymentAttemptId, payloadHash });
  if (existing) {
    assertAttemptOwner(existing.attempt, input);
    await auditPayment({ base44, scope, request, attempt: existing.attempt, outcome: 'payment_replayed', success: true });
    return paymentPublicResponse(existing.attempt);
  }
  const config = await resolvePaymentProviderConfig({ base44, scope, env, customerId: customer.id });
  if (!config) throw new SiteCpaPaymentError(503, 'site_cpa_payment_provider_unavailable', 'BLOCKED_PENDING_PAYMENT_PROVIDER');
  if (!config.methods.includes(input.method)) throw new SiteCpaPaymentError(422, 'site_cpa_payment_method_invalid');
  const attempt = {
    paymentAttemptId,
    externalPaymentId: input.externalPaymentId,
    erpOrderId: order.id,
    erpCustomerId: customer.id,
    externalUserId: input.externalUserId,
    receivableId: receivable.record.id,
    provider: config.provider,
    method: input.method,
    amount: receivable.amount,
    paidAmount: 0,
    status: 'PROCESSING',
    externalProviderId: null,
    expiresAt: null,
    reconciliationStatus: 'PENDING',
    providerPublicData: null,
    nextAction: 'AWAIT_PROVIDER',
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    source: 'SITE_CPA',
  };
  await auditPayment({ base44, scope, request, attempt, outcome: 'payment_requested', success: true });
  const event = await createAttemptEvent({ base44, scope, request, input, attempt, payloadHash, now });
  let providerResult;
  try {
    providerResult = await providerApi.create({ config, attempt, receivable: receivable.record, customer });
  } catch (error) {
    if (error instanceof SiteCpaPaymentError && error.status === 202) {
      attempt.nextAction = 'CHECK_PAYMENT_STATUS';
      await saveAttempt({ base44, event, attempt, status: 'processando', httpStatus: 202 });
      return paymentPublicResponse(attempt);
    }
    attempt.status = 'FAILED';
    attempt.nextAction = 'RETRY_WITH_NEW_ATTEMPT';
    await saveAttempt({ base44, event, attempt, status: 'erro', httpStatus: error?.status || 503 });
    throw error;
  }
  const updated = {
    ...attempt,
    ...providerResult,
    status: canonicalPaymentStatus(providerResult.status || 'PENDING'),
    nextAction: 'CHECK_PAYMENT_STATUS',
    updatedAt: nowIso(now),
  };
  try {
    await base44.asServiceRole.entities.ContaReceber.update(receivable.record.id, {
      id_cobranca_externa: updated.externalProviderId,
      gateway_usado_nome: config.provider,
      gateway_usado_id: config.id,
      provedor_pagamento: config.provider,
      status_cobranca: text(updated.status).toLowerCase(),
      data_envio_cobranca: nowIso(now),
      forma_cobranca: updated.method,
      url_fatura: updated.providerPublicData?.paymentUrl || updated.providerPublicData?.documentUrl || null,
      url_boleto_pdf: updated.providerPublicData?.documentUrl || null,
      boleto_linha_digitavel: updated.providerPublicData?.barcode || null,
      pix_qrcode: updated.providerPublicData?.qrCode || null,
      pix_copia_cola: updated.providerPublicData?.qrCodeText || null,
    });
  } catch {
    await saveAttempt({ base44, event, attempt: updated, status: 'processando', httpStatus: 202 });
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
  }
  await saveAttempt({ base44, event, attempt: updated, httpStatus: 201 });
  await auditPayment({ base44, scope, request, attempt: updated, outcome: 'provider_payment_created', success: true });
  return paymentPublicResponse(updated);
};

const lookupPayment = async ({ base44, payload, scope, request, env, now, providerApi, cancel = false }) => {
  const input = cancel ? normalizePaymentCancelInput(payload) : normalizePaymentLookupInput(payload);
  await loadCustomer({ base44, scope, input });
  await loadOrder({ base44, scope, input });
  const { event, attempt } = await findAttempt({ base44, scope, paymentAttemptId: input.paymentAttemptId });
  assertAttemptOwner(attempt, input);
  const config = await resolvePaymentProviderConfig({ base44, scope, env, customerId: input.erpCustomerId });
  if (!config || config.provider !== attempt.provider) {
    throw new SiteCpaPaymentError(503, 'site_cpa_payment_provider_unavailable');
  }
  if (!attempt.externalProviderId) {
    if (cancel) throw new SiteCpaPaymentError(422, 'site_cpa_payment_not_cancelable');
    return paymentPublicResponse(attempt);
  }
  if (cancel) {
    if (attempt.status === 'CANCELLED') return paymentPublicResponse(attempt);
    if (!['PENDING', 'PROCESSING', 'FAILED'].includes(attempt.status)) {
      throw new SiteCpaPaymentError(422, 'site_cpa_payment_not_cancelable');
    }
    const result = await providerApi.cancel({ config, externalProviderId: attempt.externalProviderId });
    const updated = {
      ...attempt,
      status: canonicalPaymentStatus(result.status || 'CANCELLED'),
      reconciliationStatus: 'PENDING',
      nextAction: 'NEW_PAYMENT_ATTEMPT',
      cancelReason: input.reason,
      updatedAt: nowIso(now),
    };
    try {
      await base44.asServiceRole.entities.ContaReceber.update(attempt.receivableId, {
        status_cobranca: 'cancelada',
        data_retorno_pagamento: nowIso(now),
      });
    } catch {
      throw new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
    }
    await saveAttempt({ base44, event, attempt: updated });
    await auditPayment({ base44, scope, request, attempt: updated, outcome: 'payment_cancelled', success: true });
    return paymentPublicResponse(updated);
  }
  if (TERMINAL_PAYMENT_STATUSES.has(attempt.status)) return paymentPublicResponse(attempt);
  const providerResult = await providerApi.status({ config, externalProviderId: attempt.externalProviderId });
  const updated = await reconcilePayment({ base44, scope, request, event, attempt, providerResult, now });
  await auditPayment({ base44, scope, request, attempt: updated, outcome: 'payment_status_checked', success: true });
  return paymentPublicResponse(updated);
};

const defaultProviderApi = {
  create: createProviderPayment,
  status: getProviderPayment,
  cancel: cancelProviderPayment,
};

export const resolveSiteCpaPaymentOperation = async ({
  base44,
  payload = {},
  scope,
  request,
  env = () => '',
  now = Date.now(),
  providerApi = defaultProviderApi,
} = {}) => {
  try {
    if (request?.operation === SITE_CPA_PAYMENT_CREATE_OPERATION) {
      return await createPayment({ base44, payload, scope, request, env, now, providerApi });
    }
    if (request?.operation === SITE_CPA_PAYMENT_STATUS_OPERATION) {
      return await lookupPayment({ base44, payload, scope, request, env, now, providerApi });
    }
    if (request?.operation === SITE_CPA_PAYMENT_CANCEL_OPERATION) {
      return await lookupPayment({ base44, payload, scope, request, env, now, providerApi, cancel: true });
    }
    throw new SiteCpaPaymentError(501, 'site_cpa_payment_operation_not_implemented');
  } catch (error) {
    const failure = error instanceof SiteCpaPaymentError
      ? error : new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable');
    if (failure.code !== 'site_cpa_audit_unavailable') {
      try {
        await auditPayment({ base44, scope, request, outcome: failure.code, success: false });
      } catch (auditError) {
        throw auditError;
      }
    }
    throw failure;
  }
};

export const reconcileSiteCpaProviderPayment = reconcilePayment;
export const findSiteCpaPaymentAttempt = findAttempt;
