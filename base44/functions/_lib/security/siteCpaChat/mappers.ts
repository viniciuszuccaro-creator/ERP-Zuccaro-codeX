import { mapChatStatus, normalizedChatValue } from './contract.ts';

const text = (value) => String(value ?? '').trim();
const first = (...values) => values.find((value) => text(value)) ?? null;

const publicAuthor = (message = {}) => {
  const type = normalizedChatValue(message.tipo_remetente || message.author_type);
  if (type.includes('CLIENT')) return { authorType: 'CUSTOMER', authorDisplayName: 'Cliente' };
  if (type.includes('ATEND') || type.includes('VENDED') || type.includes('HUMAN')) {
    return {
      authorType: 'AGENT',
      authorDisplayName: text(message.remetente_nome || message.author_name).slice(0, 100) || 'Equipe CPA',
    };
  }
  if (type.includes('BOT')) return { authorType: 'BOT', authorDisplayName: 'Assistente CPA' };
  return { authorType: 'SYSTEM', authorDisplayName: 'Equipe CPA' };
};

export const isPublicChatMessage = (message = {}) => (
  message.interno !== true
  && message.internal !== true
  && message.nota_interna !== true
  && !normalizedChatValue(message.tipo_conteudo).includes('NOTA_INTERNA')
);

export const publicChatMessage = (message = {}) => {
  if (!isPublicChatMessage(message)) return null;
  const author = publicAuthor(message);
  return {
    messageId: message.id,
    conversationId: first(message.conversa_id, message.conversation_id),
    ...author,
    message: text(message.mensagem || message.texto).slice(0, 4000),
    createdAt: first(message.data_envio, message.created_date),
    clientSentAt: first(message.client_sent_at),
    readState: message.lido === true ? 'READ' : message.entregue === true ? 'DELIVERED' : 'SENT',
    attachments: [],
  };
};

export const publicConversation = (conversation = {}, seller = null) => {
  const assigned = Boolean(conversation.atendente_id || seller?.assignmentStatus === 'ASSIGNED');
  return {
    conversationId: conversation.id,
    externalConversationId: first(conversation.site_external_conversation_id),
    status: mapChatStatus(conversation),
    subject: text(conversation.assunto_site || conversation.assunto).slice(0, 180) || null,
    channel: 'SITE_CPA',
    assignment: {
      status: assigned ? 'ASSIGNED' : 'WAITING_QUEUE',
      displayName: assigned
        ? text(conversation.atendente_nome || seller?.sellerName).slice(0, 100) || 'Equipe CPA'
        : null,
    },
    context: {
      erpOrderId: first(conversation.pedido_id),
      erpQuoteId: first(conversation.orcamento_id),
      obraId: first(conversation.obra_id),
      projectId: first(conversation.projeto_id),
    },
    attachmentsCapability: 'blocked',
    realtimeCapability: 'blocked',
    createdAt: first(conversation.data_inicio, conversation.created_date),
    updatedAt: first(conversation.data_ultima_mensagem, conversation.updated_date, conversation.created_date),
    closedAt: first(conversation.data_finalizacao),
    source: 'ERP',
  };
};

export const sortMessages = (messages = []) => [...messages].sort((left, right) => {
  const a = Date.parse(left.data_envio || left.created_date || '') || 0;
  const b = Date.parse(right.data_envio || right.created_date || '') || 0;
  if (a !== b) return a - b;
  return text(left.id).localeCompare(text(right.id));
});

export const pageHistory = (messages, { page, pageSize }) => {
  const visible = sortMessages(messages).filter(isPublicChatMessage);
  const start = (page - 1) * pageSize;
  const items = visible.slice(start, start + pageSize).map(publicChatMessage).filter(Boolean);
  return { items, page, pageSize, total: visible.length, hasMore: start + items.length < visible.length };
};

export const pollMessages = (messages, { afterMessageId, afterTimestamp, pageSize }) => {
  const visible = sortMessages(messages).filter(isPublicChatMessage);
  let start = 0;
  if (afterMessageId) {
    const index = visible.findIndex((message) => text(message.id) === text(afterMessageId));
    if (index < 0) return { items: [], cursor: afterMessageId, hasMore: false, cursorFound: false };
    start = index + 1;
  } else if (afterTimestamp) {
    const timestamp = Date.parse(afterTimestamp);
    start = visible.findIndex((message) => (Date.parse(message.data_envio || message.created_date || '') || 0) > timestamp);
    if (start < 0) start = visible.length;
  }
  const selected = visible.slice(start, start + pageSize);
  const items = selected.map(publicChatMessage).filter(Boolean);
  return {
    items,
    cursor: items.at(-1)?.messageId || afterMessageId || null,
    hasMore: start + selected.length < visible.length,
    cursorFound: true,
  };
};
