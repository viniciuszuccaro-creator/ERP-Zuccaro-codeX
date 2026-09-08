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

export const assertCanalAtivo = ({ canal, configs = [], empresaId } = {}) => {
  const canalNome = firstText(canal);
  if (!canalNome) throw new Error('Canal obrigatorio.');
  const list = Array.isArray(configs) ? configs : [];
  if (!list.length) return true;
  const scoped = list.filter((item) => {
    const itemEmpresa = firstText(item.empresa_id);
    if (!empresaId || !itemEmpresa) return firstText(item.canal) === canalNome;
    return firstText(item.canal) === canalNome && itemEmpresa === firstText(empresaId);
  });
  if (!scoped.length) return true;
  const ativo = scoped.some((item) => item.ativo !== false && item.ativo !== 'false' && item.ativo !== 0);
  if (!ativo) throw new Error(`Canal ${canalNome} inativo para a empresa.`);
  return true;
};

export const ingestCanalExterno = ({ payload = {}, canal = 'WhatsApp', empresaId, groupId, configs } = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para ingestao de canal.');
  }
  assertCanalAtivo({ canal, configs, empresaId });
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

const prioridadeScore = (conversa = {}) => {
  const p = String(conversa.prioridade || '').toLowerCase();
  if (p.includes('urgent')) return 1000;
  if (p.includes('alta') || p.includes('high')) return 500;
  if (p.includes('media') || p.includes('méd')) return 100;
  return 0;
};

const sentimentoScore = (conversa = {}) => {
  const s = String(conversa.sentimento_geral || '').toLowerCase();
  if (s.includes('frustr')) return 300;
  if (s.includes('urgent')) return 200;
  return 0;
};

export const statusNaFilaAtendimento = (status) => {
  const s = String(status || '').toLowerCase();
  return s.includes('aguard') || s.includes('não atribu') || s.includes('nao atribu') || s.includes('nao_atribu') || s === 'nova';
};

export const filtrarFilaAtendimento = (conversas = []) => (
  (Array.isArray(conversas) ? conversas : []).filter((item) => statusNaFilaAtendimento(item.status) && conversaAberta(item))
);

export const ordenarFilaAtendimento = (conversas = []) => (
  [...filtrarFilaAtendimento(conversas)].sort((a, b) => {
    const scoreDiff = (prioridadeScore(b) + sentimentoScore(b)) - (prioridadeScore(a) + sentimentoScore(a));
    if (scoreDiff !== 0) return scoreDiff;
    const ta = new Date(a.transferido_em || a.data_inicio || a.created_date || 0).getTime();
    const tb = new Date(b.transferido_em || b.data_inicio || b.created_date || 0).getTime();
    return ta - tb;
  })
);

export const buildAssumirConversa = ({ conversa = {}, user = {}, empresaId } = {}) => {
  if (!conversa?.id) throw new Error('Conversa obrigatoria.');
  if (!firstText(user.id)) throw new Error('Atendente obrigatorio.');
  if (!firstText(conversa.empresa_id) && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para assumir conversa.');
  }
  if (firstText(empresaId) && firstText(conversa.empresa_id) && firstText(conversa.empresa_id) !== firstText(empresaId)) {
    throw new Error('Conversa de outra empresa.');
  }
  if (!conversaAberta(conversa)) {
    throw new Error('Conversa ja finalizada.');
  }
  if (firstText(conversa.atendente_id) === firstText(user.id) && String(conversa.status || '') === 'Em Progresso') {
    return { reuse: true, patch: conversa };
  }
  if (firstText(conversa.atendente_id) && firstText(conversa.atendente_id) !== firstText(user.id)) {
    throw new Error('Conversa ja atribuida a outro atendente.');
  }
  const when = new Date().toISOString();
  return {
    reuse: false,
    patch: {
      atendente_id: user.id,
      atendente_nome: firstText(user.full_name, user.email, 'Atendente'),
      status: 'Em Progresso',
      tipo_atendimento: 'Humano',
      assumido_em: when,
      transferido_em: firstText(conversa.transferido_em) || when,
      portal_assume_key: `assume|${conversa.id}|${user.id}`,
    },
  };
};

export const buildTransferirConversa = ({
  conversa = {},
  user = {},
  tipo = 'fila',
  destinoId = '',
  destinoNome = '',
  departamento = '',
  nota = '',
  empresaId,
} = {}) => {
  if (!conversa?.id) throw new Error('Conversa obrigatoria.');
  if (!firstText(user.id)) throw new Error('Usuario obrigatorio para transferir.');
  if (!firstText(conversa.empresa_id) && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para transferir conversa.');
  }
  if (!conversaAberta(conversa)) throw new Error('Conversa ja finalizada.');
  const kind = firstText(tipo) || 'fila';
  const when = new Date().toISOString();
  const key = ['transfer', conversa.id, kind, firstText(destinoId, departamento) || 'fila', firstText(nota)].join('|');
  if (conversa.portal_transfer_key === key) {
    return { reuse: true, patch: conversa, systemMessage: null };
  }
  const patch = {
    transferido_em: when,
    transferido_por: user.id,
    motivo_transferencia: firstText(nota) || 'Transferencia manual',
    portal_transfer_key: key,
    tipo_atendimento: 'Humano',
  };
  let mensagemSistema = 'Conversa retornada para a fila geral';
  if (kind === 'atendente') {
    if (!firstText(destinoId)) throw new Error('Atendente destino obrigatorio.');
    patch.atendente_id = destinoId;
    patch.atendente_nome = firstText(destinoNome) || 'Atendente';
    patch.status = 'Aguardando';
    patch.departamento = conversa.departamento || undefined;
    mensagemSistema = `Conversa transferida para ${patch.atendente_nome}`;
  } else if (kind === 'departamento') {
    if (!firstText(departamento, destinoId)) throw new Error('Departamento destino obrigatorio.');
    patch.departamento = firstText(departamento, destinoId);
    patch.atendente_id = null;
    patch.atendente_nome = null;
    patch.status = 'Aguardando';
    mensagemSistema = `Conversa transferida para o departamento ${patch.departamento}`;
  } else {
    patch.atendente_id = null;
    patch.atendente_nome = null;
    patch.departamento = null;
    patch.status = 'Não Atribuída';
  }
  if (firstText(nota)) {
    patch.observacoes_internas = `${firstText(conversa.observacoes_internas)}\n[${when}] Transferido por ${firstText(user.full_name, user.email)}: ${nota}`.trim();
  }
  return {
    reuse: false,
    patch,
    systemMessage: {
      conversa_id: conversa.id,
      sessao_id: conversa.sessao_id,
      canal: conversa.canal,
      empresa_id: conversa.empresa_id || empresaId,
      group_id: conversa.group_id || conversa.grupo_id,
      tipo_remetente: 'Sistema',
      remetente_nome: 'Sistema',
      mensagem: mensagemSistema,
      tipo_conteudo: 'texto',
      data_envio: when,
      interno: true,
      idempotency_key: key,
    },
  };
};

export const buildFecharConversa = ({ conversa = {}, user = {}, empresaId } = {}) => {
  if (!conversa?.id) throw new Error('Conversa obrigatoria.');
  if (!firstText(conversa.empresa_id) && !firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para fechar conversa.');
  }
  if (!conversaAberta(conversa) && (conversa.resolvido || String(conversa.status || '').toLowerCase().includes('resolv'))) {
    return { reuse: true, patch: conversa };
  }
  const when = new Date().toISOString();
  return {
    reuse: false,
    patch: {
      status: 'Resolvida',
      resolvido: true,
      data_finalizacao: when,
      fechado_por: user?.id || undefined,
      fechado_por_nome: firstText(user?.full_name, user?.email) || undefined,
      portal_fecha_key: `fecha|${conversa.id}|${when.slice(0, 16)}`,
    },
  };
};

export const buildEscalarParaHub = ({
  sessaoId,
  empresaId,
  groupId,
  canal = 'Portal',
  cliente = null,
  mensagem = '',
  sentimento = {},
  prioridade = '',
} = {}) => {
  if (!firstText(empresaId)) throw new Error('Empresa obrigatoria para escalar ao Hub.');
  const sessao = firstText(sessaoId) || `session-${firstText(canal) || 'Portal'}-${firstText(cliente?.id) || 'anon'}`;
  const prioridadeFinal = firstText(prioridade)
    || (sentimento.frustrado || sentimento.urgente || String(sentimento.tipo || '').toLowerCase().includes('urgent') ? 'Urgente' : 'Alta');
  const conversa = {
    empresa_id: empresaId,
    group_id: groupId || undefined,
    canal: firstText(canal) || 'Portal',
    sessao_id: sessao,
    cliente_id: cliente?.id,
    cliente_nome: firstText(cliente?.nome, cliente?.razao_social, cliente?.nome_fantasia, 'Cliente portal'),
    cliente_telefone: firstText(cliente?.telefone, cliente?.celular, cliente?.whatsapp),
    cliente_email: firstText(cliente?.email),
    status: 'Aguardando',
    tipo_atendimento: 'Humano',
    origem_canal: firstText(canal) || 'Portal',
    prioridade: prioridadeFinal,
    sentimento_geral: firstText(sentimento.tipo) || undefined,
    transferido_em: new Date().toISOString(),
    motivo_transferencia: firstText(mensagem) || 'Transbordo automatico do chatbot',
  };
  const msg = firstText(mensagem)
    ? {
      empresa_id: empresaId,
      group_id: groupId || undefined,
      sessao_id: sessao,
      canal: conversa.canal,
      tipo_remetente: 'Sistema',
      remetente_nome: 'Chatbot',
      mensagem: `Transbordo: ${mensagem}`,
      tipo_conteudo: 'texto',
      data_envio: new Date().toISOString(),
      interno: false,
    }
    : null;
  return { conversa, mensagem: msg };
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
