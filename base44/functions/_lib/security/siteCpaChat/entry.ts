import {
  SiteCpaCustomerError,
  buildCustomerAddresses,
  customerBelongsToScope,
  resolveApprovedSiteCustomerContext,
  resolveSiteCpaSeller,
} from '../siteCpaCustomerResolve/entry.ts';
import { allowedWorkIdsFromLink } from '../siteCpaPortal/contract.ts';
import {
  CHAT_LIMITS,
  SITE_CPA_CHAT_CLOSE_OPERATION,
  SITE_CPA_CHAT_HISTORY_OPERATION,
  SITE_CPA_CHAT_MESSAGE_OPERATION,
  SITE_CPA_CHAT_OPERATIONS,
  SITE_CPA_CHAT_POLL_OPERATION,
  SITE_CPA_CHAT_REOPEN_OPERATION,
  SITE_CPA_CHAT_START_OPERATION,
  SiteCpaChatError,
  assertChatRole,
  chatIsOpen,
  normalizeChatInput,
} from './contract.ts';
import {
  pageHistory,
  pollMessages,
  publicChatMessage,
  publicConversation,
} from './mappers.ts';

export {
  SITE_CPA_CHAT_CLOSE_OPERATION,
  SITE_CPA_CHAT_HISTORY_OPERATION,
  SITE_CPA_CHAT_MESSAGE_OPERATION,
  SITE_CPA_CHAT_OPERATIONS,
  SITE_CPA_CHAT_POLL_OPERATION,
  SITE_CPA_CHAT_REOPEN_OPERATION,
  SITE_CPA_CHAT_START_OPERATION,
  SiteCpaChatError,
} from './contract.ts';

const text = (value) => String(value ?? '').trim();
const first = (...values) => values.find((value) => text(value)) ?? null;

const entityApi = (base44, name) => {
  const entity = base44?.asServiceRole?.entities?.[name];
  if (!entity?.filter) throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  return entity;
};

const entityFilter = async (base44, name, filter, sort, limit = 500) => {
  try {
    const rows = await entityApi(base44, name).filter(filter, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error instanceof SiteCpaChatError) throw error;
    throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  }
};

const entityCreate = async (base44, name, record) => {
  const entity = entityApi(base44, name);
  if (!entity.create) throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  try {
    return await entity.create(record);
  } catch {
    throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  }
};

const entityUpdate = async (base44, name, id, patch) => {
  const entity = entityApi(base44, name);
  if (!entity.update) throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  try {
    return await entity.update(id, patch);
  } catch {
    throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  }
};

const sha256 = async (value) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const auditChat = async ({ base44, scope, request, input, conversation, outcome, success, messageCount = 0, durationMs = 0 }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? (request?.operation === SITE_CPA_CHAT_MESSAGE_OPERATION ? 'Criacao' : 'Consulta') : 'Bloqueio',
      modulo: 'CRM',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'ConversaOmnicanal',
      registro_id: conversation?.id || conversation?.conversationId || input?.conversationId || null,
      descricao: `${request?.operation || 'siteChat'} ${outcome}`,
      group_id: scope?.groupId || null,
      empresa_id: scope?.empresaId || null,
      dados_novos: {
        operation: request?.operation || null,
        correlation_id: request?.correlationId || null,
        conversation_id: conversation?.id || conversation?.conversationId || input?.conversationId || null,
        customer_id: input?.erpCustomerId || null,
        message_count: Math.max(0, Number(messageCount) || 0),
        duration_ms: Math.max(0, Number(durationMs) || 0),
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaChatError(503, 'site_cpa_audit_unavailable');
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
    assertChatRole(context.role);
    return { ...context, allowedWorkIds: allowedWorkIdsFromLink(context.link) };
  } catch (error) {
    if (error instanceof SiteCpaChatError) throw error;
    if (error instanceof SiteCpaCustomerError) {
      throw new SiteCpaChatError(error.status === 503 ? 503 : 403, 'site_cpa_chat_customer_invalid');
    }
    throw new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
  }
};

const conversationOwned = (conversation, scope, input) => (
  conversation
  && customerBelongsToScope(conversation, scope)
  && text(conversation.cliente_id) === input.erpCustomerId
  && text(conversation.site_external_user_id) === input.externalUserId
  && text(conversation.origem_canal || conversation.canal).toUpperCase() === 'SITE_CPA'
);

const loadConversation = async ({ base44, scope, input }) => {
  const rows = await entityFilter(base44, 'ConversaOmnicanal', {
    id: input.conversationId,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const conversation = rows.find((item) => customerBelongsToScope(item, scope));
  if (!conversation) throw new SiteCpaChatError(404, 'site_cpa_chat_not_found');
  if (!conversationOwned(conversation, scope, input)) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_scope_forbidden');
  }
  return conversation;
};

const validateReference = async ({ base44, scope, name, id, customerId, type = null }) => {
  if (!id) return null;
  const rows = await entityFilter(base44, name, {
    id,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, undefined, 2);
  const record = rows.find((item) => customerBelongsToScope(item, scope));
  if (!record || (text(record.cliente_id) && text(record.cliente_id) !== customerId)) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_context_invalid');
  }
  if (type && text(record.tipo).toLowerCase() !== type.toLowerCase()) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_context_invalid');
  }
  return record;
};

const validateStartContext = async ({ base44, scope, input, context }) => {
  const customerAddresses = buildCustomerAddresses(context.customer);
  if (input.obraId && !customerAddresses.some((address) => (
    text(address.addressId) === input.obraId && address.type === 'OBRA'
  ))) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_context_invalid');
  }
  if (context.allowedWorkIds.size && input.obraId && !context.allowedWorkIds.has(input.obraId)) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_context_invalid');
  }
  await Promise.all([
    validateReference({ base44, scope, name: 'Pedido', id: input.erpOrderId, customerId: input.erpCustomerId }),
    validateReference({ base44, scope, name: 'Pedido', id: input.erpQuoteId, customerId: input.erpCustomerId, type: 'Orçamento' }),
    validateReference({ base44, scope, name: 'Projeto', id: input.projectId, customerId: input.erpCustomerId }),
  ]);
};

const responseBase = (context, now) => ({
  customer: { erpCustomerId: context.customer.id },
  source: 'ERP',
  snapshotAt: new Date(now).toISOString(),
});

const loadMessages = (base44, scope, conversationId) => entityFilter(base44, 'MensagemOmnicanal', {
  conversa_id: conversationId,
  group_id: scope.groupId,
  empresa_id: scope.empresaId,
}, 'data_envio', 1000);

const createCustomerMessage = async ({ base44, scope, input, conversation, message, externalMessageId, now }) => {
  if (input.attachments.length) {
    throw new SiteCpaChatError(503, 'site_cpa_chat_attachment_unavailable');
  }
  const contentHash = await sha256(message);
  const existing = await entityFilter(base44, 'MensagemOmnicanal', {
    conversa_id: conversation.id,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    site_external_message_id: externalMessageId,
  }, '-created_date', 2);
  if (existing.length) {
    const previous = existing[0];
    if (text(previous.site_message_hash) !== contentHash || text(previous.remetente_id) !== input.externalUserId) {
      throw new SiteCpaChatError(409, 'site_cpa_chat_idempotency_conflict');
    }
    return { message: previous, replayed: true };
  }
  const recentMessages = await loadMessages(base44, scope, conversation.id);
  const windowStart = now - 60 * 1000;
  const sentByUser = recentMessages.filter((item) => (
    text(item.remetente_id) === input.externalUserId
    && (Date.parse(item.data_envio || item.created_date || '') || 0) >= windowStart
  ));
  if (sentByUser.length >= CHAT_LIMITS.maxMessagesPerMinute) {
    throw new SiteCpaChatError(429, 'site_cpa_chat_rate_limited');
  }
  const created = await entityCreate(base44, 'MensagemOmnicanal', {
    group_id: scope.groupId,
    grupo_id: scope.groupId,
    empresa_id: scope.empresaId,
    conversa_id: conversation.id,
    sessao_id: conversation.sessao_id,
    canal: 'SITE_CPA',
    tipo_remetente: 'Cliente',
    remetente_id: input.externalUserId,
    remetente_nome: 'Cliente',
    mensagem: message,
    tipo_conteudo: 'texto',
    data_envio: new Date(now).toISOString(),
    client_sent_at: input.clientSentAt,
    entregue: true,
    interno: false,
    origem_externa: true,
    site_external_message_id: externalMessageId,
    site_message_hash: contentHash,
  });
  await entityUpdate(base44, 'ConversaOmnicanal', conversation.id, {
    data_ultima_mensagem: new Date(now).toISOString(),
    total_mensagens: Number(conversation.total_mensagens || 0) + 1,
    mensagens_cliente: Number(conversation.mensagens_cliente || 0) + 1,
    status: conversation.atendente_id ? 'Em Progresso' : 'Aguardando',
  });
  return { message: created, replayed: false };
};

const startChat = async (args) => {
  const { base44, scope, input, context, request, now } = args;
  await validateStartContext(args);
  const seller = await resolveSiteCpaSeller(base44, scope, context.customer);
  const conversations = await entityFilter(base44, 'ConversaOmnicanal', {
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
    cliente_id: input.erpCustomerId,
  }, '-data_ultima_mensagem', 100);
  const sameExternalId = input.externalConversationId && conversations.find((item) => (
    text(item.site_external_conversation_id) === input.externalConversationId
  ));
  if (sameExternalId && !conversationOwned(sameExternalId, scope, input)) {
    throw new SiteCpaChatError(409, 'site_cpa_chat_idempotency_conflict');
  }
  const compatible = (item) => conversationOwned(item, scope, input)
    && chatIsOpen(item)
    && (!input.externalConversationId || text(item.site_external_conversation_id) === input.externalConversationId)
    && (!input.erpOrderId || text(item.pedido_id) === input.erpOrderId)
    && (!input.erpQuoteId || text(item.orcamento_id) === input.erpQuoteId)
    && (!input.obraId || text(item.obra_id) === input.obraId)
    && (!input.projectId || text(item.projeto_id) === input.projectId);
  let conversation = conversations.find(compatible) || null;
  let reused = Boolean(conversation);
  if (!conversation) {
    const createdAt = new Date(now).toISOString();
    conversation = await entityCreate(base44, 'ConversaOmnicanal', {
      group_id: scope.groupId,
      grupo_id: scope.groupId,
      empresa_id: scope.empresaId,
      cliente_id: input.erpCustomerId,
      cliente_nome: first(context.customer.nome, context.customer.razao_social, context.customer.nome_fantasia),
      canal: 'SITE_CPA',
      origem_canal: 'SITE_CPA',
      sessao_id: `site-cpa-${scope.empresaId}-${input.externalUserId}`,
      site_external_user_id: input.externalUserId,
      site_external_conversation_id: input.externalConversationId,
      assunto_site: input.subject,
      pagina_origem_site: input.sourcePage,
      pedido_id: input.erpOrderId,
      orcamento_id: input.erpQuoteId,
      obra_id: input.obraId,
      projeto_id: input.projectId,
      status: seller.assignmentStatus === 'ASSIGNED' ? 'Em Progresso' : 'Aguardando',
      tipo_atendimento: 'Humano',
      atendente_id: seller.assignmentStatus === 'ASSIGNED' ? seller.sellerId : null,
      atendente_nome: seller.assignmentStatus === 'ASSIGNED' ? seller.sellerName : null,
      data_inicio: createdAt,
      data_ultima_mensagem: createdAt,
      total_mensagens: 0,
      mensagens_cliente: 0,
      resolvido: false,
      origem_s2s_correlation_id: request?.correlationId || null,
    });
  }
  let initialMessage = null;
  if (input.message) {
    const result = await createCustomerMessage({
      base44, scope, input, conversation, message: input.message,
      externalMessageId: `start:${request?.idempotencyKey}`, now,
    });
    initialMessage = publicChatMessage(result.message);
    reused = reused || result.replayed;
  }
  return {
    ...responseBase(context, now),
    conversation: publicConversation(conversation, seller),
    initialMessage,
    reused,
    nextAction: conversation.atendente_id ? 'WAIT_AGENT_RESPONSE' : 'WAIT_QUEUE',
  };
};

const sendMessage = async (args) => {
  const { base44, scope, input, context, now } = args;
  const conversation = await loadConversation(args);
  if (!chatIsOpen(conversation)) throw new SiteCpaChatError(409, 'site_cpa_chat_closed');
  const result = await createCustomerMessage({
    base44, scope, input, conversation, message: input.message,
    externalMessageId: input.externalMessageId, now,
  });
  return {
    ...responseBase(context, now), conversation: publicConversation(conversation),
    message: publicChatMessage(result.message), replayed: result.replayed,
  };
};

const history = async (args) => {
  const { base44, scope, input, context, now } = args;
  const conversation = await loadConversation(args);
  const messages = await loadMessages(base44, scope, conversation.id);
  return {
    ...responseBase(context, now), conversation: publicConversation(conversation),
    ...pageHistory(messages, input),
  };
};

const poll = async (args) => {
  const { base44, scope, input, context, now } = args;
  const conversation = await loadConversation(args);
  const messages = await loadMessages(base44, scope, conversation.id);
  const result = pollMessages(messages, input);
  if (input.afterMessageId && !result.cursorFound) {
    throw new SiteCpaChatError(400, 'site_cpa_chat_cursor_invalid');
  }
  return {
    ...responseBase(context, now), conversation: publicConversation(conversation),
    items: result.items, cursor: result.cursor, hasMore: result.hasMore,
  };
};

const changeState = async (args, reopen) => {
  const { base44, input, context, now } = args;
  const conversation = await loadConversation(args);
  const alreadyDesired = reopen ? chatIsOpen(conversation) : !chatIsOpen(conversation);
  let updated = conversation;
  if (!alreadyDesired) {
    updated = await entityUpdate(base44, 'ConversaOmnicanal', conversation.id, reopen ? {
      status: 'Aguardando', resolvido: false, data_finalizacao: null,
      reaberto_em: new Date(now).toISOString(), reaberto_por: 'SITE_CPA',
    } : {
      status: 'Resolvida', resolvido: true, data_finalizacao: new Date(now).toISOString(),
      fechado_por: 'SITE_CPA', fechado_por_nome: 'Cliente Site CPA',
    });
  }
  return {
    ...responseBase(context, now), conversation: publicConversation(updated), reused: alreadyDesired,
  };
};

const execute = (args) => {
  switch (args.request.operation) {
    case SITE_CPA_CHAT_START_OPERATION: return startChat(args);
    case SITE_CPA_CHAT_MESSAGE_OPERATION: return sendMessage(args);
    case SITE_CPA_CHAT_POLL_OPERATION: return poll(args);
    case SITE_CPA_CHAT_HISTORY_OPERATION: return history(args);
    case SITE_CPA_CHAT_CLOSE_OPERATION: return changeState(args, false);
    case SITE_CPA_CHAT_REOPEN_OPERATION: return changeState(args, true);
    default: throw new SiteCpaChatError(501, 'site_cpa_operation_not_implemented');
  }
};

export const resolveSiteCpaChatOperation = async ({ base44, payload, scope, request, now = Date.now() } = {}) => {
  let input = null;
  let conversation = null;
  const startedAt = Date.now();
  try {
    input = normalizeChatInput(payload, request?.operation);
    const context = await loadContext({ base44, scope, input });
    const data = await execute({ base44, scope, request, input, context, now });
    conversation = data?.conversation;
    await auditChat({
      base44, scope, request, input, conversation, outcome: 'allowed', success: true,
      messageCount: Array.isArray(data?.items) ? data.items.length : data?.message || data?.initialMessage ? 1 : 0,
      durationMs: Date.now() - startedAt,
    });
    return data;
  } catch (error) {
    const failure = error instanceof SiteCpaChatError
      ? error : new SiteCpaChatError(503, 'site_cpa_chat_unavailable');
    try {
      await auditChat({
        base44, scope, request, input, conversation, outcome: failure.code,
        success: false, durationMs: Date.now() - startedAt,
      });
    } catch (auditError) {
      if (auditError instanceof SiteCpaChatError) throw auditError;
      throw new SiteCpaChatError(503, 'site_cpa_audit_unavailable');
    }
    throw failure;
  }
};

export const chatCapability = async ({ base44, scope } = {}) => {
  try {
    await Promise.all([
      entityFilter(base44, 'ConversaOmnicanal', { group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1),
      entityFilter(base44, 'MensagemOmnicanal', { group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1),
    ]);
    return 'degraded';
  } catch {
    return 'blocked';
  }
};
