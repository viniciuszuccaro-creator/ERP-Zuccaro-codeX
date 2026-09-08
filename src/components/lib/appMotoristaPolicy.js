const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MOTORISTA_QUEUE_KEY = 'erp_zuccaro_motorista_sync_queue';

export const STATUS_ENTREGA_MOTORISTA = [
  'Pronto para Expedir',
  'Saiu para Entrega',
  'Em Trânsito',
  'Chegada no Cliente',
  'Entrega Parcial',
];

export const statusOf = (record = {}) => String(record.status || '').toLowerCase();

export const isStatusAtivoMotorista = (status) => {
  const value = String(status || '');
  return STATUS_ENTREGA_MOTORISTA.some((item) => item.toLowerCase() === value.toLowerCase())
    || statusOf({ status: value }).includes('transito')
    || statusOf({ status: value }).includes('saiu');
};

export const entregaAtribuidaAoMotoristaLocal = (entrega = {}, user = {}) => {
  if (!entrega?.id || !user) return false;
  if (firstText(entrega.motorista_id) && firstText(entrega.motorista_id) === firstText(user.id)) return true;
  const motoristaNome = firstText(entrega.motorista, entrega.motorista_nome).toLowerCase();
  const userNome = firstText(user.full_name, user.email).toLowerCase();
  if (motoristaNome && userNome && motoristaNome === userNome) return true;
  const email = firstText(user.email).toLowerCase();
  return Boolean(email && firstText(entrega.motorista_email).toLowerCase() === email);
};

export const entregaAtribuidaAoMotorista = entregaAtribuidaAoMotoristaLocal;

export const hasProvaEntregaLocal = (record = {}) => {
  const prova = record.comprovante_entrega || {};
  const nome = firstText(prova.nome_recebedor);
  if (!nome) return false;
  if (String(record.tipo_frete || '').toLowerCase().includes('retir')) return true;
  return Boolean(firstText(prova.foto_comprovante, prova.assinatura_digital, prova.documento_recebedor));
};

export const hasProvaEntrega = hasProvaEntregaLocal;

export const filtrarEntregasDoMotorista = (entregas = [], user = {}) => (
  (Array.isArray(entregas) ? entregas : []).filter((entrega) => (
    entregaAtribuidaAoMotoristaLocal(entrega, user)
    && isStatusAtivoMotorista(entrega.status)
  ))
);

export const ordenarEntregasRota = (entregas = []) => (
  [...(Array.isArray(entregas) ? entregas : [])].sort((a, b) => {
    const sa = Number(a.sequencia_rota || a.ordem_sequencia || a.sequencia || 9999);
    const sb = Number(b.sequencia_rota || b.ordem_sequencia || b.sequencia || 9999);
    if (sa !== sb) return sa - sb;
    return String(a.data_saida || a.created_date || '').localeCompare(String(b.data_saida || b.created_date || ''));
  })
);

export const proximaParada = (entregas = [], user = {}) => {
  const ordenadas = ordenarEntregasRota(filtrarEntregasDoMotorista(entregas, user));
  return ordenadas.find((item) => !statusOf(item).includes('entregue') && !statusOf(item).includes('frustr') && !statusOf(item).includes('devolv')) || null;
};

export const motoristaActionKey = ({ tipo, entregaId, nonce = '' } = {}) => {
  const t = firstText(tipo);
  const id = firstText(entregaId);
  if (!t || !id) return '';
  return ['motorista', t, id, firstText(nonce)].filter(Boolean).join('|');
};

export const buildHistoricoStatus = (entrega = {}, status, user = {}, localizacao = null, observacao = '') => ([
  ...(Array.isArray(entrega.historico_status) ? entrega.historico_status : []),
  {
    status,
    data_hora: new Date().toISOString(),
    usuario: firstText(user.full_name, user.email, 'Motorista'),
    localizacao: localizacao || undefined,
    observacao: firstText(observacao) || undefined,
  },
]);

export const assertMotoristaPodeAgir = ({ entrega = {}, user = {} } = {}) => {
  if (!firstText(user?.id, user?.email, user?.full_name)) {
    throw new Error('Motorista nao autenticado.');
  }
  if (!entregaAtribuidaAoMotoristaLocal(entrega, user)) {
    throw new Error('Entrega nao atribuida a este motorista.');
  }
  return true;
};

export const buildChegadaPatch = ({ entrega = {}, user = {}, localizacao = null } = {}) => {
  assertMotoristaPodeAgir({ entrega, user });
  return {
    status: 'Chegada no Cliente',
    data_chegada: new Date().toISOString(),
    geolocalizacao_chegada: localizacao || undefined,
    historico_status: buildHistoricoStatus(entrega, 'Chegada no Cliente', user, localizacao, 'Chegada registrada no app'),
    idempotency_key: motoristaActionKey({ tipo: 'chegada', entregaId: entrega.id, nonce: entrega.updated_date || entrega.id }),
  };
};

export const buildConfirmacaoPatch = ({
  entrega = {},
  user = {},
  localizacao = null,
  comprovante = {},
  parcial = false,
  quantidade_entregue = null,
} = {}) => {
  assertMotoristaPodeAgir({ entrega, user });
  const nextComprovante = {
    ...(entrega.comprovante_entrega || {}),
    ...comprovante,
    data_hora_recebimento: new Date().toISOString(),
    latitude_entrega: localizacao?.latitude,
    longitude_entrega: localizacao?.longitude,
  };
  const status = parcial ? 'Entrega Parcial' : 'Entregue';
  const stamped = {
    status,
    data_entrega: new Date().toISOString(),
    comprovante_entrega: nextComprovante,
    entrega_parcial: parcial
      ? {
        ativada: true,
        quantidade_entregue: Number(quantidade_entregue) || 0,
      }
      : entrega.entrega_parcial,
    historico_status: buildHistoricoStatus(
      entrega,
      status,
      user,
      localizacao,
      parcial
        ? `Entrega parcial por ${firstText(nextComprovante.nome_recebedor)}`
        : `Recebido por: ${firstText(nextComprovante.nome_recebedor)}`,
    ),
    idempotency_key: motoristaActionKey({
      tipo: parcial ? 'parcial' : 'confirmacao',
      entregaId: entrega.id,
      nonce: firstText(nextComprovante.nome_recebedor, nextComprovante.foto_comprovante, nextComprovante.assinatura_digital),
    }),
  };
  if (!hasProvaEntregaLocal({ ...entrega, ...stamped })) {
    throw new Error('Informe recebedor e comprovante (foto, assinatura ou documento).');
  }
  if (parcial && !(Number(quantidade_entregue) > 0)) {
    throw new Error('Quantidade entregue obrigatoria na entrega parcial.');
  }
  return stamped;
};

export const buildOcorrenciaPatch = ({
  entrega = {},
  user = {},
  localizacao = null,
  motivo = '',
  foto = null,
} = {}) => {
  assertMotoristaPodeAgir({ entrega, user });
  if (!firstText(motivo)) throw new Error('Motivo da ocorrencia obrigatorio.');
  return {
    status: 'Entrega Frustrada',
    entrega_frustrada: {
      motivo: firstText(motivo),
      detalhes: '',
      tentativa_numero: Number(entrega.entrega_frustrada?.tentativa_numero || 0) + 1,
      reagendamento: null,
      foto_ocorrencia: foto || null,
    },
    historico_status: buildHistoricoStatus(entrega, 'Entrega Frustrada', user, localizacao, motivo),
    idempotency_key: motoristaActionKey({ tipo: 'ocorrencia', entregaId: entrega.id, nonce: motivo }),
  };
};

export const buildReversaPatch = ({
  entrega = {},
  user = {},
  localizacao = null,
  motivo = '',
  quantidade = 0,
  valor = 0,
} = {}) => {
  assertMotoristaPodeAgir({ entrega, user });
  if (!firstText(motivo)) throw new Error('Motivo da devolucao obrigatorio.');
  if (!(Number(quantidade) > 0) && !(Number(valor) > 0)) {
    throw new Error('Informe quantidade ou valor devolvido.');
  }
  return {
    status: 'Devolvido',
    logistica_reversa: {
      ativada: true,
      motivo: firstText(motivo),
      quantidade_devolvida: Number(quantidade) || 0,
      valor_devolvido: Number(valor) || 0,
    },
    historico_status: buildHistoricoStatus(entrega, 'Devolvido', user, localizacao, motivo),
    idempotency_key: motoristaActionKey({ tipo: 'reversa', entregaId: entrega.id, nonce: `${motivo}|${quantidade}|${valor}` }),
  };
};

export const buildInicioPatch = ({ entrega = {}, user = {}, localizacao = null } = {}) => {
  assertMotoristaPodeAgir({ entrega, user });
  return {
    status: 'Em Trânsito',
    historico_status: buildHistoricoStatus(entrega, 'Em Trânsito', user, localizacao, 'Entrega iniciada no app do motorista'),
    idempotency_key: motoristaActionKey({ tipo: 'inicio', entregaId: entrega.id, nonce: entrega.status }),
  };
};

export const readMotoristaQueue = (storage = globalThis.localStorage) => {
  if (!storage?.getItem) return [];
  try {
    const raw = storage.getItem(MOTORISTA_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeMotoristaQueue = (queue = [], storage = globalThis.localStorage) => {
  if (!storage?.setItem) return queue;
  storage.setItem(MOTORISTA_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  return queue;
};

export const enqueueMotoristaAction = (action = {}, storage = globalThis.localStorage) => {
  const queue = readMotoristaQueue(storage);
  const key = firstText(action.idempotency_key, motoristaActionKey(action));
  if (!key) throw new Error('Acao offline sem chave de idempotencia.');
  const existing = queue.find((item) => item.idempotency_key === key);
  if (existing) return { queue, action: existing, reused: true };
  const nextAction = {
    id: `mq-${Date.now()}-${queue.length + 1}`,
    created_at: new Date().toISOString(),
    ...action,
    idempotency_key: key,
  };
  const next = [...queue, nextAction];
  writeMotoristaQueue(next, storage);
  return { queue: next, action: nextAction, reused: false };
};

export const dequeueMotoristaAction = (actionId, storage = globalThis.localStorage) => {
  const queue = readMotoristaQueue(storage).filter((item) => item.id !== actionId && item.idempotency_key !== actionId);
  writeMotoristaQueue(queue, storage);
  return queue;
};

export const assertEntregaMotoristaOnUpdate = ({ before = {}, patch = {}, user = null } = {}) => {
  const next = {
    ...before,
    ...patch,
    comprovante_entrega: patch.comprovante_entrega || before.comprovante_entrega,
  };
  if (firstText(before.empresa_id) && firstText(next.empresa_id) && firstText(before.empresa_id) !== firstText(next.empresa_id)) {
    throw new Error('Empresa da entrega nao pode ser alterada.');
  }

  const status = statusOf(next);
  if (user && (
    status.includes('entregue')
    || status.includes('frustr')
    || status.includes('devolv')
    || status.includes('chegada')
    || status.includes('transito')
    || status.includes('parcial')
  )) {
    assertMotoristaPodeAgir({ entrega: before, user });
  }

  if (status.includes('entregue') && !status.includes('frustr') && !hasProvaEntregaLocal(next)) {
    throw new Error('Entrega exige comprovante (recebedor e prova).');
  }
  if (status.includes('parcial') && !hasProvaEntregaLocal(next)) {
    throw new Error('Entrega parcial exige comprovante (recebedor e prova).');
  }
  if (status.includes('devolv')) {
    const reversa = next.logistica_reversa || {};
    if (!firstText(reversa.motivo) || (!(Number(reversa.quantidade_devolvida) > 0) && !(Number(reversa.valor_devolvido) > 0))) {
      throw new Error('Devolucao exige motivo e quantidade ou valor.');
    }
  }
  if (status.includes('frustr') && !firstText(next.entrega_frustrada?.motivo)) {
    throw new Error('Ocorrencia exige motivo.');
  }
  return next;
};
