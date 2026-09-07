const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const conversaAberta = (record = {}) => {
  const status = String(record.status || '').toLowerCase();
  return !status.includes('resolv') && !status.includes('arquiv') && !status.includes('cancel') && !status.includes('finaliz');
};

export const conversaIdempotencyKey = (record = {}) => {
  const empresaId = firstText(record.empresa_id);
  const canal = firstText(record.canal) || 'Portal';
  const identity = firstText(record.sessao_id) || digitsOnly(record.cliente_telefone || record.telefone || record.from) || firstText(record.cliente_id);
  if (!empresaId || !identity) return '';
  return ['chat', empresaId, canal, identity].join('|');
};

export const findDuplicateConversa = (record = {}, conversas = []) => {
  const key = conversaIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(conversas) ? conversas : []).find((item) => (
    conversaAberta(item) && conversaIdempotencyKey(item) === key
  )) || null;
};

export const matchClientePorContato = (clientes = [], record = {}) => {
  const clienteId = firstText(record.cliente_id);
  if (clienteId) {
    return (Array.isArray(clientes) ? clientes : []).find((item) => firstText(item.id) === clienteId) || null;
  }
  const fone = digitsOnly(record.cliente_telefone || record.telefone || record.from);
  const email = firstText(record.cliente_email || record.email).toLowerCase();
  return (Array.isArray(clientes) ? clientes : []).find((item) => {
    if (fone && digitsOnly(item.telefone || item.celular || item.whatsapp || item.fone) === fone) return true;
    return Boolean(email && firstText(item.email).toLowerCase() === email);
  }) || null;
};

export const assertConversaOnCreate = ({ record = {}, conversas = [], clientes = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para conversa de atendimento.');
  }
  const cliente = matchClientePorContato(clientes, record);
  const next = {
    ...record,
    cliente_id: firstText(record.cliente_id) || cliente?.id || undefined,
    cliente_nome: firstText(record.cliente_nome, cliente?.nome, cliente?.razao_social, cliente?.nome_fantasia),
    origem_canal: firstText(record.origem_canal, record.canal),
  };
  const reuse = findDuplicateConversa(next, conversas);
  if (reuse) return { reuse, record: next };
  return { reuse: null, record: next };
};

export const assertMensagemOnCreate = ({ record = {} } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para mensagem de atendimento.');
  }
  if (!firstText(record.conversa_id, record.sessao_id)) {
    throw new Error('Conversa obrigatoria para mensagem.');
  }
  if (!firstText(record.mensagem, record.texto, record.midia_url)) {
    throw new Error('Mensagem vazia.');
  }
  return { reuse: null, record };
};

export const ingestCanalExterno = ({ payload = {}, canal = 'WhatsApp', empresaId, groupId } = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para ingestao de canal.');
  }
  const waMessage = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const waContact = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
  const texto = firstText(payload.text, payload.message, payload.mensagem, waMessage?.text?.body);
  const telefone = firstText(payload.from, payload.phone, payload.telefone, waMessage?.from);
  const nome = firstText(payload.name, payload.nome, waContact?.profile?.name, 'Cliente canal');
  if (!texto) throw new Error('Payload sem mensagem.');
  const sessaoId = `session-${firstText(canal) || 'WhatsApp'}-${digitsOnly(telefone) || firstText(payload.sessao_id) || 'ext'}`;
  return {
    conversa: {
      empresa_id: empresaId,
      group_id: groupId || undefined,
      canal: firstText(canal) || 'WhatsApp',
      sessao_id: sessaoId,
      cliente_telefone: telefone,
      cliente_nome: nome,
      cliente_email: payload.email,
      status: 'Aguardando',
      tipo_atendimento: 'Humano',
      origem_canal: firstText(canal) || 'WhatsApp',
    },
    mensagem: {
      empresa_id: empresaId,
      group_id: groupId || undefined,
      sessao_id: sessaoId,
      canal: firstText(canal) || 'WhatsApp',
      tipo_remetente: 'Cliente',
      remetente_nome: nome,
      mensagem: texto,
      tipo_conteudo: 'texto',
      origem_externa: true,
    },
  };
};

export const resolveSessaoEstavel = ({ conversaId, canal = 'Portal', empresaId, clienteId } = {}) => {
  if (firstText(conversaId)) return conversaId;
  const identity = firstText(clienteId) || 'anon';
  const key = `erp_chat_sessao_${firstText(canal) || 'Portal'}_${firstText(empresaId) || 'ctx'}_${identity}`;
  if (typeof sessionStorage !== 'undefined') {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const next = `session-${firstText(canal) || 'Portal'}-${identity}`;
    sessionStorage.setItem(key, next);
    return next;
  }
  return `session-${firstText(canal) || 'Portal'}-${identity}`;
};

export const applyAtendimentoCreate = (entityName, record, stores = {}) => {
  if (entityName === 'ConversaOmnicanal') {
    return assertConversaOnCreate({
      record,
      conversas: stores.conversas,
      clientes: stores.clientes,
    });
  }
  if (entityName === 'MensagemOmnicanal') {
    return assertMensagemOnCreate({ record });
  }
  return { reuse: null, record };
};
