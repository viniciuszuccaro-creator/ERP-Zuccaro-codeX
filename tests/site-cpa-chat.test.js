import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_CHAT_CLOSE_OPERATION,
  SITE_CPA_CHAT_HISTORY_OPERATION,
  SITE_CPA_CHAT_MESSAGE_OPERATION,
  SITE_CPA_CHAT_POLL_OPERATION,
  SITE_CPA_CHAT_REOPEN_OPERATION,
  SITE_CPA_CHAT_START_OPERATION,
  SiteCpaChatError,
  chatCapability,
  resolveSiteCpaChatOperation,
} from '../base44/functions/_lib/security/siteCpaChat/entry.ts';
import { mapChatStatus, normalizeChatInput } from '../base44/functions/_lib/security/siteCpaChat/contract.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const now = Date.parse('2026-09-13T20:00:00.000Z');
const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const customer = (overrides = {}) => ({
  id: 'customer-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'Ativo',
  razao_social: 'Cliente Um', vendedor_responsavel_id: 'seller-1', ...overrides,
});
const link = (role = 'ADMIN_EMPRESA', allowedWorkIds = []) => ({
  id: 'link-1', tipo_solicitacao: 'vinculo_site_cpa_cliente', entidade_alvo_id: 'customer-1',
  group_id: 'grupo-cpa', empresa_id: 'cpa-aco', status: 'aprovado',
  dados_propostos: { source: 'SITE_CPA', externalUserId: 'site-user-1', role, allowedWorkIds },
});
const conversation = (overrides = {}) => ({
  id: 'conversation-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1',
  site_external_user_id: 'site-user-1', canal: 'SITE_CPA', origem_canal: 'SITE_CPA',
  sessao_id: 'site-session-1', status: 'Aguardando', total_mensagens: 0, mensagens_cliente: 0,
  created_date: '2026-09-13T18:00:00.000Z', ...overrides,
});
const message = (id, overrides = {}) => ({
  id, group_id: 'grupo-cpa', empresa_id: 'cpa-aco', conversa_id: 'conversation-1',
  tipo_remetente: 'Atendente', remetente_nome: 'Maria Silva', mensagem: `Mensagem ${id}`,
  data_envio: `2026-09-13T18:0${id.at(-1) || 0}:00.000Z`, interno: false, ...overrides,
});
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);

const createState = ({
  role = 'ADMIN_EMPRESA', allowedWorkIds = [], customers = [customer()], conversations = [], messages = [],
  sellers = [{ id: 'seller-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', ativo: true, nome: 'Vendedor Oficial' }],
  orders = [], projects = [], failEntity = null,
} = {}) => {
  const audits = [];
  const records = {
    Cliente: customers,
    SolicitacaoAprovacao: [link(role, allowedWorkIds)],
    Colaborador: sellers,
    ConversaOmnicanal: conversations,
    MensagemOmnicanal: messages,
    Pedido: orders,
    Projeto: projects,
    IntegracaoEvento: [],
    Empresa: [{ id: 'cpa-aco', group_id: 'grupo-cpa' }],
    Entrega: [], NotaFiscal: [], ContaReceber: [],
  };
  const entities = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, {
    filter: async (filter = {}) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      return rows.filter((record) => matches(record, filter));
    },
    create: async (record) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const created = { id: `${name}-${rows.length + 1}`, created_date: new Date(now).toISOString(), ...record };
      rows.push(created);
      return created;
    },
    update: async (id, update) => {
      if (failEntity === name) throw new Error(`${name} unavailable`);
      const found = rows.find((record) => record.id === id);
      if (!found) throw new Error(`${name} missing`);
      Object.assign(found, update);
      return found;
    },
  }]));
  entities.AuditLog = { create: async (record) => {
    if (failEntity === 'AuditLog') throw new Error('audit unavailable');
    audits.push(record);
    return record;
  } };
  return { base44: { asServiceRole: { entities, integrations: { Core: {} } } }, records, audits };
};

const input = (overrides = {}) => ({
  externalUserId: 'site-user-1', erpCustomerId: 'customer-1', ...overrides,
});
const call = (state, operation, data = {}) => resolveSiteCpaChatOperation({
  base44: state.base44, payload: { data: input(data) }, scope,
  request: { operation, correlationId: `corr-${operation}`, idempotencyKey: `idem-${operation}` }, now,
});
const rejects = (promise, code, status) => assert.rejects(promise, (error) => (
  error instanceof SiteCpaChatError && error.code === code && error.status === status
));

test('contrato limita campos, HTML, tamanho, anexos e paginacao', () => {
  assert.equal(normalizeChatInput({ data: input({ conversationId: 'c1', pageSize: 100 }) }, SITE_CPA_CHAT_HISTORY_OPERATION).pageSize, 100);
  assert.throws(() => normalizeChatInput({ data: input({ authorType: 'SYSTEM' }) }), /input_forbidden/);
  assert.throws(() => normalizeChatInput({ data: input({ conversationId: 'c1', externalMessageId: 'm1', message: '<script>x</script>' }) }, SITE_CPA_CHAT_MESSAGE_OPERATION), /message_invalid/);
  assert.throws(() => normalizeChatInput({ data: input({ conversationId: 'c1', pageSize: 101 }) }, SITE_CPA_CHAT_HISTORY_OPERATION), /page_invalid/);
  assert.throws(() => normalizeChatInput({ data: input({ attachments: [{ name: 'malware.exe', mimeType: 'application/pdf', size: 2 }] }) }), /attachment_invalid/);
});

test('mapeia lifecycle externo sem criar status paralelo', () => {
  assert.equal(mapChatStatus({ status: 'Aguardando' }), 'WAITING_AGENT');
  assert.equal(mapChatStatus({ status: 'Em Progresso' }), 'IN_PROGRESS');
  assert.equal(mapChatStatus({ status: 'Resolvida', resolvido: true }), 'CLOSED');
  assert.equal(mapChatStatus({ status: 'Transferido' }), 'TRANSFERRED');
});

test('start cria conversa real, atribui vendedor oficial e registra mensagem do Cliente', async () => {
  const state = createState();
  const result = await call(state, SITE_CPA_CHAT_START_OPERATION, {
    externalConversationId: 'site-conv-1', subject: 'Pedido em andamento', initialMessage: 'Preciso de ajuda',
  });
  assert.equal(result.conversation.channel, 'SITE_CPA');
  assert.equal(result.conversation.assignment.displayName, 'Vendedor Oficial');
  assert.equal(result.initialMessage.authorType, 'CUSTOMER');
  assert.equal(state.records.ConversaOmnicanal[0].origem_canal, 'SITE_CPA');
  assert.equal(state.records.MensagemOmnicanal[0].tipo_remetente, 'Cliente');
  assert.equal(state.records.MensagemOmnicanal[0].interno, false);
});

test('start reutiliza conversa aberta compativel e nao cria chats em refresh', async () => {
  const state = createState({ conversations: [conversation({ site_external_conversation_id: 'site-conv-1' })] });
  const result = await call(state, SITE_CPA_CHAT_START_OPERATION, { externalConversationId: 'site-conv-1' });
  assert.equal(result.conversation.conversationId, 'conversation-1');
  assert.equal(result.reused, true);
  assert.equal(state.records.ConversaOmnicanal.length, 1);
});

test('seller ausente deixa conversa na fila sem inventar atendente', async () => {
  const state = createState({ sellers: [] });
  const result = await call(state, SITE_CPA_CHAT_START_OPERATION);
  assert.equal(result.conversation.assignment.status, 'WAITING_QUEUE');
  assert.equal(result.conversation.assignment.displayName, null);
  assert.equal(state.records.ConversaOmnicanal[0].atendente_id, null);
});

test('message define autor server-side e double send e idempotente', async () => {
  const state = createState({ conversations: [conversation()] });
  const data = { conversationId: 'conversation-1', externalMessageId: 'site-msg-1', message: 'Ola' };
  const firstResult = await call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, data);
  const secondResult = await call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, data);
  assert.equal(firstResult.message.authorType, 'CUSTOMER');
  assert.equal(secondResult.replayed, true);
  assert.equal(state.records.MensagemOmnicanal.length, 1);
  assert.equal(state.records.MensagemOmnicanal[0].remetente_id, 'site-user-1');
});

test('externalMessageId com conteudo diferente retorna conflito', async () => {
  const state = createState({ conversations: [conversation()] });
  await call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, {
    conversationId: 'conversation-1', externalMessageId: 'site-msg-1', message: 'Primeira',
  });
  await rejects(call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, {
    conversationId: 'conversation-1', externalMessageId: 'site-msg-1', message: 'Alterada',
  }), 'site_cpa_chat_idempotency_conflict', 409);
});

test('conversa fechada rejeita mensagem', async () => {
  const state = createState({ conversations: [conversation({ status: 'Resolvida', resolvido: true })] });
  await rejects(call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, {
    conversationId: 'conversation-1', externalMessageId: 'site-msg-1', message: 'Nova',
  }), 'site_cpa_chat_closed', 409);
});

test('rate limit por remetente bloqueia spam sem afetar replay idempotente', async () => {
  const recent = Array.from({ length: 20 }, (_, index) => message(`rate-${index}`, {
    tipo_remetente: 'Cliente', remetente_id: 'site-user-1',
    data_envio: new Date(now - index * 1000).toISOString(),
  }));
  const state = createState({ conversations: [conversation()], messages: recent });
  await rejects(call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, {
    conversationId: 'conversation-1', externalMessageId: 'site-msg-rate', message: 'Mais uma',
  }), 'site_cpa_chat_rate_limited', 429);
});

test('history pagina e nunca retorna nota interna ou dados do usuario interno', async () => {
  const state = createState({ conversations: [conversation()], messages: [
    message('m1'),
    message('m2', { interno: true, mensagem: 'nota confidencial', remetente_email: 'interno@cpa.com' }),
    message('m3', { tipo_remetente: 'Cliente', remetente_id: 'site-user-1' }),
  ] });
  const result = await call(state, SITE_CPA_CHAT_HISTORY_OPERATION, { conversationId: 'conversation-1', pageSize: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.total, 2);
  assert.equal(result.hasMore, true);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('nota confidencial'), false);
  assert.equal(serialized.includes('interno@cpa.com'), false);
  assert.equal(serialized.includes('internalUserId'), false);
});

test('poll retorna somente mensagens posteriores ao cursor', async () => {
  const state = createState({ conversations: [conversation()], messages: [message('m1'), message('m2'), message('m3')] });
  const result = await call(state, SITE_CPA_CHAT_POLL_OPERATION, {
    conversationId: 'conversation-1', afterMessageId: 'm1', pageSize: 1,
  });
  assert.deepEqual(result.items.map((item) => item.messageId), ['m2']);
  assert.equal(result.cursor, 'm2');
  assert.equal(result.hasMore, true);
  await rejects(call(state, SITE_CPA_CHAT_POLL_OPERATION, {
    conversationId: 'conversation-1', afterMessageId: 'missing',
  }), 'site_cpa_chat_cursor_invalid', 400);
});

test('close e reopen preservam historico e sao idempotentes', async () => {
  const state = createState({ conversations: [conversation()], messages: [message('m1')] });
  const closed = await call(state, SITE_CPA_CHAT_CLOSE_OPERATION, { conversationId: 'conversation-1' });
  assert.equal(closed.conversation.status, 'CLOSED');
  const replay = await call(state, SITE_CPA_CHAT_CLOSE_OPERATION, { conversationId: 'conversation-1' });
  assert.equal(replay.reused, true);
  const reopened = await call(state, SITE_CPA_CHAT_REOPEN_OPERATION, { conversationId: 'conversation-1' });
  assert.equal(reopened.conversation.status, 'WAITING_AGENT');
  assert.equal(state.records.MensagemOmnicanal.length, 1);
});

test('ownership bloqueia Cliente, usuario, Grupo e Empresa adulterados', async () => {
  await rejects(call(createState({ conversations: [conversation({ cliente_id: 'customer-2' })] }),
    SITE_CPA_CHAT_HISTORY_OPERATION, { conversationId: 'conversation-1' }), 'site_cpa_chat_scope_forbidden', 403);
  await rejects(call(createState({ conversations: [conversation({ site_external_user_id: 'other-user' })] }),
    SITE_CPA_CHAT_HISTORY_OPERATION, { conversationId: 'conversation-1' }), 'site_cpa_chat_scope_forbidden', 403);
  await rejects(call(createState({ conversations: [conversation({ group_id: 'other-group' })] }),
    SITE_CPA_CHAT_HISTORY_OPERATION, { conversationId: 'conversation-1' }), 'site_cpa_chat_not_found', 404);
  await rejects(call(createState({ conversations: [conversation({ empresa_id: '3z' })] }),
    SITE_CPA_CHAT_HISTORY_OPERATION, { conversationId: 'conversation-1' }), 'site_cpa_chat_not_found', 404);
});

test('referencias de Pedido, Orcamento, obra e Projeto exigem ownership', async () => {
  const valid = createState({ customers: [customer({ locais_entrega: [{ id: 'obra-1', obra: true, ativo: true }] })], allowedWorkIds: ['obra-1'], orders: [
    { id: 'order-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', tipo: 'Pedido' },
    { id: 'quote-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1', tipo: 'Orçamento' },
  ], projects: [{ id: 'project-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-1' }] });
  const result = await call(valid, SITE_CPA_CHAT_START_OPERATION, {
    erpOrderId: 'order-1', erpQuoteId: 'quote-1', obraId: 'obra-1', projectId: 'project-1',
  });
  assert.equal(result.conversation.context.erpOrderId, 'order-1');
  await rejects(call(createState({ allowedWorkIds: ['obra-2'] }), SITE_CPA_CHAT_START_OPERATION, { obraId: 'obra-1' }),
    'site_cpa_chat_context_invalid', 403);
  await rejects(call(createState({ orders: [{ id: 'order-1', group_id: 'grupo-cpa', empresa_id: 'cpa-aco', cliente_id: 'customer-2' }] }),
    SITE_CPA_CHAT_START_OPERATION, { erpOrderId: 'order-1' }), 'site_cpa_chat_context_invalid', 403);
});

test('matriz RBAC permite somente os quatro papeis do portal', async () => {
  for (const role of ['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']) {
    const result = await call(createState({ role }), SITE_CPA_CHAT_START_OPERATION);
    assert.equal(result.conversation.channel, 'SITE_CPA');
  }
  await rejects(call(createState({ role: 'VISITANTE' }), SITE_CPA_CHAT_START_OPERATION),
    'site_cpa_chat_customer_invalid', 403);
});

test('anexo seguro permanece bloqueado sem storage privado e scanner comprovados', async () => {
  const state = createState({ conversations: [conversation()] });
  await rejects(call(state, SITE_CPA_CHAT_MESSAGE_OPERATION, {
    conversationId: 'conversation-1', externalMessageId: 'site-msg-1', message: 'Segue arquivo',
    attachments: [{ name: 'documento.pdf', mimeType: 'application/pdf', size: 1024 }],
  }), 'site_cpa_chat_attachment_unavailable', 503);
});

test('dependencia e auditoria indisponiveis falham fechadas', async () => {
  await rejects(call(createState({ failEntity: 'ConversaOmnicanal' }), SITE_CPA_CHAT_START_OPERATION),
    'site_cpa_chat_unavailable', 503);
  await rejects(call(createState({ failEntity: 'AuditLog' }), SITE_CPA_CHAT_START_OPERATION),
    'site_cpa_audit_unavailable', 503);
});

test('capability fica degraded sem anexos seguros e blocked sem fluxo operacional', async () => {
  assert.equal(await chatCapability({ base44: createState().base44, scope }), 'degraded');
  assert.equal(await chatCapability({ base44: createState({ failEntity: 'MensagemOmnicanal' }).base44, scope }), 'blocked');
});

test('siteChatStart atravessa autenticacao, ledger e gateway v1', async () => {
  const state = createState();
  const payload = { version: '1', operation: SITE_CPA_CHAT_START_OPERATION, data: input({ subject: 'Ajuda' }) };
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date(now).toISOString();
  const nonce = 'nonce-chat-123456789012';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({ timestamp, nonce, rawBody }));
  const response = await handleSiteCpaGatewayRequest({
    req: { headers: new Headers({
      authorization: 'Bearer service-token', 'content-type': 'application/json', 'x-origin': 'SITE_CPA',
      'x-correlation-id': 'corr-chat-start', 'x-site-cpa-timestamp': timestamp,
      'x-site-cpa-nonce': nonce, 'x-site-cpa-signature': signature, 'idempotency-key': 'idem-chat-start',
    }) },
    base44: state.base44, payload, rawBody,
    env: (name) => ({ SITE_CPA_SERVICE_TOKEN: 'service-token', SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa', SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco' })[name] || '',
    now,
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.data.conversation.channel, 'SITE_CPA');
  assert.equal(state.audits.some((audit) => audit.descricao === 'siteChatStart allowed'), true);
});
