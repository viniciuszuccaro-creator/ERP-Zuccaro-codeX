import {
  SiteCpaCustomerError, buildCustomerAddresses, customerBelongsToScope,
  resolveApprovedSiteCustomerContext, resolveSiteCpaSeller,
} from '../siteCpaCustomerResolve/entry.ts';
import { assertAllowedWork, workAccessFromLink } from '../siteCpaWork/contract.ts';
import {
  SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION, SITE_CPA_OPPORTUNITY_GET_OPERATION,
  SITE_CPA_OPPORTUNITY_LIST_OPERATION, SITE_CPA_OPPORTUNITY_OPERATIONS,
  SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, SiteCpaOpportunityError,
  assertOpportunityRole, mapOpportunityStatus, normalizeOpportunityInput,
  normalizedOpportunityValue, paginateOpportunities,
} from './contract.ts';

export {
  SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION, SITE_CPA_OPPORTUNITY_GET_OPERATION,
  SITE_CPA_OPPORTUNITY_LIST_OPERATION, SITE_CPA_OPPORTUNITY_OPERATIONS,
  SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION, SiteCpaOpportunityError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const latestDate = (record = {}) => record.updated_date || record.created_date || null;

const requiredFilter = async (base44, name, criteria, sort = '-updated_date', limit = 1000) => {
  const entity = base44?.asServiceRole?.entities?.[name];
  if (!entity?.filter) throw new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
  try {
    const rows = await entity.filter(criteria, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    throw new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
  }
};

const optionalFilter = async (base44, name, criteria, limit = 100) => {
  const entity = base44?.asServiceRole?.entities?.[name];
  if (!entity?.filter) return { rows: [], available: false };
  try {
    const rows = await entity.filter(criteria, '-updated_date', limit);
    return { rows: Array.isArray(rows) ? rows : [], available: true };
  } catch {
    return { rows: [], available: false };
  }
};

const loadContext = async ({ base44, scope, input, operation }) => {
  try {
    const context = await resolveApprovedSiteCustomerContext({
      base44, scope, erpCustomerId: input.erpCustomerId, externalUserId: input.externalUserId,
    });
    assertOpportunityRole(context.role, operation);
    return context;
  } catch (error) {
    if (error instanceof SiteCpaOpportunityError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaOpportunityError(error.status === 503 ? 503 : 403,
        'site_cpa_opportunity_customer_invalid');
    }
    throw new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
  }
};

const owned = (record, scope, customerId) => customerBelongsToScope(record, scope)
  && text(record.cliente_id || record.customer_id) === text(customerId);

const publicOpportunity = (record = {}) => ({
  opportunityId: record.id,
  code: text(record.codigo_oportunidade) || null,
  title: text(record.titulo) || 'Oportunidade comercial',
  sourceType: normalizedOpportunityValue(record.origem || 'CRM'),
  status: mapOpportunityStatus(record),
  stage: text(record.etapa || record.etapa_funil) || null,
  seller: {
    sellerId: text(record.vendedor_id || record.responsavel_id) || null,
    sellerName: text(record.vendedor_nome || record.vendedor || record.responsavel) || null,
    assignmentStatus: text(record.vendedor_id || record.responsavel_id) ? 'ASSIGNED' : 'UNASSIGNED',
  },
  work: {
    obraId: text(record.obra_id) || null,
    projectId: text(record.projeto_id) || null,
    costCenterId: text(record.centro_custo_id) || null,
  },
  related: {
    erpQuoteId: text(record.orcamento_id) || null,
    erpOrderId: text(record.pedido_id) || null,
    conversationId: text(record.conversa_id) || null,
  },
  createdAt: record.created_date || record.data_abertura || null,
  updatedAt: latestDate(record),
  source: 'ERP',
});

const loadOpportunities = async ({ base44, scope, context }) => {
  const rows = await requiredFilter(base44, 'Oportunidade', {
    group_id: scope.groupId, empresa_id: scope.empresaId, cliente_id: context.customer.id,
  });
  return rows.filter((record) => owned(record, scope, context.customer.id));
};

const findOpportunity = async (args, required = true) => {
  const records = await loadOpportunities(args);
  const opportunity = records.find((record) => text(record.id) === text(args.input.opportunityId)) || null;
  if (!opportunity && required) throw new SiteCpaOpportunityError(404, 'site_cpa_opportunity_not_found');
  return opportunity;
};

const signalFromRecords = ({ quotes, orders, armacoes, chats, deliveries }) => {
  const signals = [];
  if (quotes.some((item) => ['UNDER_REVIEW', 'CUSTOMER_REVIEW', 'CHANGE_REQUESTED'].includes(
    normalizedOpportunityValue(item.site_proposal_status)))) {
    signals.push({ type: 'QUOTE_WAITING', reasonCode: 'QUOTE_REQUIRES_FOLLOW_UP', confidence: 1 });
  }
  if (armacoes.some((item) => normalizedOpportunityValue(item.site_armacao_status).includes('REVIEW'))) {
    signals.push({ type: 'CUSTOM_ITEM_NEEDS_REVIEW', reasonCode: 'ARMACAO_REQUIRES_REVIEW', confidence: 1 });
  }
  if (orders.some((item) => ['PENDENTE', 'EM ABERTO', 'AGUARDANDO PAGAMENTO'].includes(
    normalizedOpportunityValue(item.status)))) {
    signals.push({ type: 'ORDER_PENDING', reasonCode: 'ORDER_REQUIRES_FOLLOW_UP', confidence: 1 });
  }
  if (chats.some((item) => ['NOVA', 'AGUARDANDO', 'WAITING_AGENT'].includes(
    normalizedOpportunityValue(item.status)))) {
    signals.push({ type: 'CHAT_WAITING_AGENT', reasonCode: 'CUSTOMER_WAITING_AGENT', confidence: 1 });
  }
  if (deliveries.some((item) => normalizedOpportunityValue(item.status).includes('OCORR'))) {
    signals.push({ type: 'DELIVERY_OCCURRENCE', reasonCode: 'DELIVERY_REQUIRES_ATTENTION', confidence: 1 });
  }
  return signals.slice(0, 20);
};

const recommendationsFromSignals = (signals) => signals.slice(0, 10).map((signal, index) => ({
  recommendationId: `rule-${index + 1}-${signal.type}`,
  type: signal.type === 'CHAT_WAITING_AGENT' ? 'REVIEW_CONVERSATION' : 'REVIEW_COMMERCIAL_CONTEXT',
  reasonCode: signal.reasonCode,
  confidence: signal.confidence,
  executionPolicy: 'SUGGESTION_ONLY',
  requiresHumanConfirmation: true,
}));

const context360 = async ({ base44, scope, context, input, opportunity }) => {
  const criteria = { group_id: scope.groupId, empresa_id: scope.empresaId, cliente_id: context.customer.id };
  const [quotes, orders, armacoes, chats, deliveries, receivables] = await Promise.all([
    optionalFilter(base44, 'Pedido', { ...criteria, tipo: 'Orçamento' }),
    optionalFilter(base44, 'Pedido', criteria), optionalFilter(base44, 'Projeto', criteria),
    optionalFilter(base44, 'ConversaOmnicanal', criteria), optionalFilter(base44, 'Entrega', criteria),
    ['ADMIN_EMPRESA', 'FINANCEIRO'].includes(normalizedOpportunityValue(context.role))
      ? optionalFilter(base44, 'ContaReceber', criteria) : Promise.resolve({ rows: [], available: true }),
  ]);
  const own = (result) => result.rows.filter((record) => owned(record, scope, context.customer.id)).slice(0, 25);
  const ownedQuotes = own(quotes);
  const ownedOrders = own(orders).filter((record) => normalizedOpportunityValue(record.tipo) !== 'ORCAMENTO');
  const ownedArmacoes = own(armacoes).filter((record) => text(record.site_armacao_status));
  const ownedChats = own(chats);
  const ownedDeliveries = own(deliveries);
  const signals = signalFromRecords({
    quotes: ownedQuotes, orders: ownedOrders, armacoes: ownedArmacoes,
    chats: ownedChats, deliveries: ownedDeliveries,
  });
  const seller = await resolveSiteCpaSeller(base44, scope, context.customer);
  const unavailableSources = [quotes, orders, armacoes, chats, deliveries, receivables]
    .map((result, index) => !result.available ? ['QUOTES', 'ORDERS', 'ARMACAO', 'CHAT', 'DELIVERY', 'FINANCIAL'][index] : null)
    .filter(Boolean);
  return {
    opportunity: opportunity ? publicOpportunity(opportunity) : null,
    customer: { erpCustomerId: context.customer.id, status: 'VERIFIED' },
    seller,
    works: buildCustomerAddresses(context.customer).filter((item) => item.type === 'OBRA' && item.active !== false)
      .slice(0, 25).map((item) => ({ obraId: item.addressId, label: item.label || null })),
    summary: {
      openQuotes: ownedQuotes.length, orders: ownedOrders.length, armacoesPending: ownedArmacoes.length,
      conversations: ownedChats.length, deliveries: ownedDeliveries.length,
      financial: ['ADMIN_EMPRESA', 'FINANCEIRO'].includes(normalizedOpportunityValue(context.role))
        ? { receivablesCount: own(receivables).length } : null,
    },
    signals,
    recommendations: recommendationsFromSignals(signals),
    copilot: { mode: 'STRUCTURED_RULES', state: 'degraded', authority: 'SUGGESTION_ONLY' },
    unavailableSources,
    source: 'ERP',
    generatedAt: new Date().toISOString(),
  };
};

const validateSignalReference = async ({ base44, scope, context, input }) => {
  if (input.obraId) {
    const works = buildCustomerAddresses(context.customer).filter((item) => item.type === 'OBRA');
    const work = works.find((item) => text(item.addressId) === input.obraId && item.active !== false);
    if (!work) throw new SiteCpaOpportunityError(403, 'site_cpa_opportunity_context_forbidden');
    try { assertAllowedWork(workAccessFromLink(context.link, context.role), input.obraId); } catch {
      throw new SiteCpaOpportunityError(403, 'site_cpa_opportunity_context_forbidden');
    }
  }
  const references = [
    ['Pedido', input.erpQuoteId, { tipo: 'Orçamento' }], ['Pedido', input.erpOrderId, {}],
    ['ConversaOmnicanal', input.conversationId, {}], ['Projeto', input.projectId, {}],
  ].filter(([, id]) => id);
  for (const [name, id, extra] of references) {
    const rows = await requiredFilter(base44, name, {
      id, group_id: scope.groupId, empresa_id: scope.empresaId, cliente_id: context.customer.id, ...extra,
    }, undefined, 2);
    if (!rows.some((record) => text(record.id) === id && owned(record, scope, context.customer.id))) {
      throw new SiteCpaOpportunityError(403, 'site_cpa_opportunity_context_forbidden');
    }
  }
};

const createSignal = async ({ base44, scope, context, input, request }) => {
  await validateSignalReference({ base44, scope, context, input });
  const existing = await requiredFilter(base44, 'Oportunidade', {
    group_id: scope.groupId, empresa_id: scope.empresaId, cliente_id: context.customer.id,
    site_signal_id: input.externalSignalId,
  }, '-created_date', 2);
  const same = existing.find((item) => text(item.site_signal_type) === input.signalType);
  if (same) return { opportunity: publicOpportunity(same), signalStatus: 'ALREADY_RECORDED', replayed: true };
  if (existing.length) throw new SiteCpaOpportunityError(409, 'site_cpa_opportunity_signal_conflict');
  const seller = await resolveSiteCpaSeller(base44, scope, context.customer);
  const entity = base44?.asServiceRole?.entities?.Oportunidade;
  if (!entity?.create) throw new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
  let created;
  try {
    created = await entity.create({
      titulo: input.signalType === 'BETTER_PRICE_REQUESTED'
        ? 'Solicitação de melhor preço pelo Site CPA' : 'Contato solicitado pelo Site CPA',
      descricao: 'Sinal comercial explícito recebido pelo contrato oficial do Site CPA.',
      origem: 'SITE_CPA', group_id: scope.groupId, empresa_id: scope.empresaId,
      cliente_id: context.customer.id,
      cliente_nome: text(context.customer.razao_social || context.customer.nome_fantasia) || null,
      vendedor_id: seller.sellerId, vendedor_nome: seller.sellerName,
      status: 'Aberto', etapa: 'Contato Inicial', etapa_funil: 'Contato Inicial',
      data_abertura: new Date().toISOString().slice(0, 10),
      site_signal_id: input.externalSignalId, site_signal_type: input.signalType,
      orcamento_id: input.erpQuoteId, pedido_id: input.erpOrderId, conversa_id: input.conversationId,
      obra_id: input.obraId, projeto_id: input.projectId,
      site_signal_message: input.message,
      correlation_id: request?.correlationId || null,
    });
  } catch {
    throw new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
  }
  return { opportunity: publicOpportunity(created), signalStatus: 'RECORDED', replayed: false };
};

const audit = async ({ base44, scope, request, input, outcome, success, recordId = null, count = 0, duration = 0 }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA', acao: success ? (request.operation === SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION ? 'Criacao' : 'Consulta') : 'Bloqueio',
      modulo: 'CRM', tipo_auditoria: success ? 'integracao' : 'seguranca', entidade: 'Oportunidade',
      registro_id: recordId, descricao: `${request.operation} ${outcome}`,
      group_id: scope.groupId, empresa_id: scope.empresaId,
      dados_novos: { operation: request.operation, correlation_id: request.correlationId || null,
        customer_id: input.erpCustomerId, opportunity_id: input.opportunityId,
        signal_type: input.signalType, result_count: count, outcome },
      duracao_ms: duration, data_hora: new Date().toISOString(), sucesso: success === true,
    });
  } catch {
    throw new SiteCpaOpportunityError(503, 'site_cpa_audit_unavailable');
  }
};

export const resolveSiteCpaOpportunityOperation = async ({ base44, payload, scope, request } = {}) => {
  const started = Date.now();
  const input = normalizeOpportunityInput(payload, request.operation);
  let result;
  try {
    const context = await loadContext({ base44, scope, input, operation: request.operation });
    if (request.operation === SITE_CPA_OPPORTUNITY_LIST_OPERATION) {
      const records = await loadOpportunities({ base44, scope, context });
      result = { ...paginateOpportunities(records.map(publicOpportunity), input), source: 'ERP' };
    } else if (request.operation === SITE_CPA_OPPORTUNITY_GET_OPERATION) {
      result = { opportunity: publicOpportunity(await findOpportunity({ base44, scope, context, input })), source: 'ERP' };
    } else if (request.operation === SITE_CPA_OPPORTUNITY_CONTEXT_OPERATION) {
      const opportunity = input.opportunityId
        ? await findOpportunity({ base44, scope, context, input }) : null;
      result = await context360({ base44, scope, context, input, opportunity });
    } else if (request.operation === SITE_CPA_OPPORTUNITY_SIGNAL_OPERATION) {
      result = await createSignal({ base44, scope, context, input, request });
    } else throw new SiteCpaOpportunityError(501, 'site_cpa_opportunity_operation_invalid');
    await audit({ base44, scope, request, input, outcome: 'allowed', success: true,
      recordId: result?.opportunity?.opportunityId || null, count: result?.total || 1,
      duration: Date.now() - started });
    return result;
  } catch (error) {
    const failure = error instanceof SiteCpaOpportunityError ? error
      : new SiteCpaOpportunityError(503, 'site_cpa_opportunity_unavailable');
    await audit({ base44, scope, request, input, outcome: failure.code, success: false,
      duration: Date.now() - started });
    throw failure;
  }
};

const probe = async (base44, name, scope) => {
  try {
    const entity = base44?.asServiceRole?.entities?.[name];
    if (!entity?.filter) return false;
    await entity.filter({ group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1);
    return true;
  } catch { return false; }
};

export const opportunityCapabilities = async ({ base44, scope }) => {
  const opportunityReady = await probe(base44, 'Oportunidade', scope);
  const signalReady = opportunityReady && Boolean(base44?.asServiceRole?.entities?.Oportunidade?.create);
  if (!opportunityReady) return { OPPORTUNITY_READ: 'blocked', OPPORTUNITY_SIGNAL: 'blocked', COMMERCIAL_COPILOT: 'blocked' };
  const contextSources = await Promise.all(['Pedido', 'Projeto', 'ConversaOmnicanal', 'Entrega']
    .map((name) => probe(base44, name, scope)));
  return {
    OPPORTUNITY_READ: 'ready', OPPORTUNITY_SIGNAL: signalReady ? 'ready' : 'blocked',
    COMMERCIAL_COPILOT: contextSources.some(Boolean) ? 'degraded' : 'blocked',
  };
};
