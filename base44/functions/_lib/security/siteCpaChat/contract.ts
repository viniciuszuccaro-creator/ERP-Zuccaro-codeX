export const SITE_CPA_CHAT_START_OPERATION = 'siteChatStart';
export const SITE_CPA_CHAT_MESSAGE_OPERATION = 'siteChatMessage';
export const SITE_CPA_CHAT_POLL_OPERATION = 'siteChatPoll';
export const SITE_CPA_CHAT_HISTORY_OPERATION = 'siteChatHistory';
export const SITE_CPA_CHAT_CLOSE_OPERATION = 'siteChatClose';
export const SITE_CPA_CHAT_REOPEN_OPERATION = 'siteChatReopen';

export const SITE_CPA_CHAT_OPERATIONS = new Set([
  SITE_CPA_CHAT_START_OPERATION,
  SITE_CPA_CHAT_MESSAGE_OPERATION,
  SITE_CPA_CHAT_POLL_OPERATION,
  SITE_CPA_CHAT_HISTORY_OPERATION,
  SITE_CPA_CHAT_CLOSE_OPERATION,
  SITE_CPA_CHAT_REOPEN_OPERATION,
]);

export const CHAT_LIMITS = Object.freeze({
  maxMessageLength: 4000,
  maxSubjectLength: 180,
  maxAttachments: 3,
  maxAttachmentSize: 10 * 1024 * 1024,
  maxMessagesPerMinute: 20,
  historyPageSize: 100,
  pollPageSize: 50,
});

const CHAT_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']);
const text = (value) => String(value ?? '').trim();
export const normalizedChatValue = (value) => text(value)
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

export class SiteCpaChatError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaChatError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const safeId = (value, code, required = false) => {
  const result = text(value);
  if ((!result && required) || result.length > 160 || (result && !/^[A-Za-z0-9._:@/-]+$/.test(result))) {
    throw new SiteCpaChatError(400, code);
  }
  return result || null;
};

const safeText = (value, max, code) => {
  const result = text(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (result.length > max || /<\/?[A-Za-z!][^>]*>|javascript\s*:/i.test(result)) {
    throw new SiteCpaChatError(400, code);
  }
  return result || null;
};

const safeTimestamp = (value) => {
  if (!value) return null;
  const result = text(value);
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp)) throw new SiteCpaChatError(400, 'site_cpa_chat_cursor_invalid');
  return new Date(timestamp).toISOString();
};

const payloadData = (payload = {}) => (
  payload?.data && typeof payload.data === 'object' ? payload.data : payload
);

const assertNoAuthorityFields = (data) => {
  for (const field of [
    'authorType', 'tipoRemetente', 'senderType', 'sellerId', 'agentId', 'internalUserId',
    'groupId', 'group_id', 'empresaId', 'empresa_id', 'role', 'status', 'internal', 'interno',
  ]) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      throw new SiteCpaChatError(400, 'site_cpa_chat_input_forbidden');
    }
  }
};

const normalizeAttachments = (value) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > CHAT_LIMITS.maxAttachments) {
    throw new SiteCpaChatError(400, 'site_cpa_chat_attachment_invalid');
  }
  return value.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      throw new SiteCpaChatError(400, 'site_cpa_chat_attachment_invalid');
    }
    const mime = text(attachment.mimeType || attachment.type).toLowerCase();
    const name = safeText(attachment.name, 180, 'site_cpa_chat_attachment_invalid');
    const size = Number(attachment.size);
    if (!name || !['application/pdf', 'image/jpeg', 'image/png'].includes(mime)
      || !Number.isFinite(size) || size <= 0 || size > CHAT_LIMITS.maxAttachmentSize
      || /\.(?:exe|js|html?|svg|bat|cmd|ps1)$/i.test(name)) {
      throw new SiteCpaChatError(400, 'site_cpa_chat_attachment_invalid');
    }
    return { name, mimeType: mime, size };
  });
};

export const normalizeChatInput = (payload = {}, operation = '') => {
  const data = payloadData(payload);
  assertNoAuthorityFields(data);
  const page = Number(data.page ?? 1);
  const defaultSize = operation === SITE_CPA_CHAT_POLL_OPERATION
    ? CHAT_LIMITS.pollPageSize : 25;
  const maxSize = operation === SITE_CPA_CHAT_POLL_OPERATION
    ? CHAT_LIMITS.pollPageSize : CHAT_LIMITS.historyPageSize;
  const pageSize = Number(data.pageSize ?? defaultSize);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxSize) {
    throw new SiteCpaChatError(400, 'site_cpa_chat_page_invalid');
  }
  const input = {
    externalUserId: safeId(data.externalUserId || data.siteUserId, 'site_cpa_chat_customer_invalid', true),
    erpCustomerId: safeId(data.erpCustomerId, 'site_cpa_chat_customer_invalid', true),
    conversationId: safeId(data.conversationId, 'site_cpa_chat_not_found'),
    externalConversationId: safeId(data.externalConversationId, 'site_cpa_chat_conversation_invalid'),
    externalMessageId: safeId(data.externalMessageId, 'site_cpa_chat_message_invalid'),
    erpOrderId: safeId(data.erpOrderId, 'site_cpa_chat_context_invalid'),
    erpQuoteId: safeId(data.erpQuoteId, 'site_cpa_chat_context_invalid'),
    obraId: safeId(data.obraId, 'site_cpa_chat_context_invalid'),
    projectId: safeId(data.projectId, 'site_cpa_chat_context_invalid'),
    subject: safeText(data.subject || data.context, CHAT_LIMITS.maxSubjectLength, 'site_cpa_chat_subject_invalid'),
    sourcePage: safeText(data.sourcePage, 240, 'site_cpa_chat_context_invalid'),
    message: safeText(data.message || data.initialMessage, CHAT_LIMITS.maxMessageLength, 'site_cpa_chat_message_invalid'),
    clientSentAt: safeTimestamp(data.clientSentAt),
    afterMessageId: safeId(data.afterMessageId || data.cursor, 'site_cpa_chat_cursor_invalid'),
    afterTimestamp: safeTimestamp(data.afterTimestamp),
    attachments: normalizeAttachments(data.attachments),
    page,
    pageSize,
  };
  if (operation !== SITE_CPA_CHAT_START_OPERATION && !input.conversationId) {
    throw new SiteCpaChatError(400, 'site_cpa_chat_not_found');
  }
  if (operation === SITE_CPA_CHAT_MESSAGE_OPERATION) {
    if (!input.externalMessageId || !input.message) {
      throw new SiteCpaChatError(400, 'site_cpa_chat_message_invalid');
    }
  }
  return input;
};

export const assertChatRole = (role) => {
  if (!CHAT_ROLES.has(normalizedChatValue(role))) {
    throw new SiteCpaChatError(403, 'site_cpa_chat_forbidden');
  }
};

export const mapChatStatus = (record = {}) => {
  const status = normalizedChatValue(record.status);
  if (record.resolvido === true || status.includes('RESOLV') || status.includes('FINALIZ') || status.includes('ARQUIV')) return 'CLOSED';
  if (status.includes('TRANSFER')) return 'TRANSFERRED';
  if (status.includes('PROGRESS') || status.includes('ATEND')) return 'IN_PROGRESS';
  if (status.includes('CLIENTE')) return 'WAITING_CUSTOMER';
  if (status.includes('AGUARD') || status.includes('NAO ATRIB') || status === 'NOVA') return 'WAITING_AGENT';
  return 'OPEN';
};

export const chatIsOpen = (record = {}) => mapChatStatus(record) !== 'CLOSED';
