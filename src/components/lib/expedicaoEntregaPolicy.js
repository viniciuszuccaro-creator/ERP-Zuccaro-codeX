const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const statusOf = (record = {}) => String(record.status || '').toLowerCase();

const isEntregue = (record = {}) => statusOf(record).includes('entregue') && !statusOf(record).includes('frustr');

const isRetirada = (record = {}) => String(record.tipo_frete || '').toLowerCase().includes('retir');

const sortedEntregaIds = (record = {}) => (Array.isArray(record.entregas_ids) ? record.entregas_ids : [])
  .map((id) => String(id))
  .filter(Boolean)
  .sort()
  .join(',');

export const hasProvaEntrega = (record = {}) => {
  const prova = record.comprovante_entrega || {};
  const nome = firstText(prova.nome_recebedor);
  if (!nome) return false;
  if (isRetirada(record)) return true;
  return Boolean(firstText(prova.foto_comprovante, prova.assinatura_digital, prova.documento_recebedor));
};

export const entregaAtribuidaAoMotorista = (entrega = {}, user = {}) => {
  if (!entrega?.id || !user) return false;
  if (firstText(entrega.motorista_id) && firstText(entrega.motorista_id) === firstText(user.id)) return true;
  const motoristaNome = firstText(entrega.motorista, entrega.motorista_nome).toLowerCase();
  const userNome = firstText(user.full_name, user.email).toLowerCase();
  if (motoristaNome && userNome && motoristaNome === userNome) return true;
  const email = firstText(user.email).toLowerCase();
  return Boolean(email && firstText(entrega.motorista_email).toLowerCase() === email);
};

export const findDuplicateEntrega = (record = {}, entregas = []) => {
  const pedidoId = firstText(record.pedido_id);
  const empresaId = firstText(record.empresa_id);
  if (!pedidoId || !empresaId) return null;
  return (Array.isArray(entregas) ? entregas : []).find((item) => {
    if (statusOf(item).includes('cancel')) return false;
    return firstText(item.pedido_id) === pedidoId && firstText(item.empresa_id) === empresaId;
  }) || null;
};

export const findDuplicateRomaneio = (record = {}, romaneios = []) => {
  const key = sortedEntregaIds(record);
  const empresaId = firstText(record.empresa_id);
  if (!key || !empresaId) return null;
  return (Array.isArray(romaneios) ? romaneios : []).find((item) => {
    if (statusOf(item).includes('cancel')) return false;
    return firstText(item.empresa_id) === empresaId && sortedEntregaIds(item) === key;
  }) || null;
};

export const findDuplicateSeparacao = (record = {}, separacoes = []) => {
  const origem = firstText(record.entrega_id, record.pedido_id);
  const empresaId = firstText(record.empresa_id);
  const tipo = firstText(record.tipo) || 'conferencia';
  if (!origem || !empresaId) return null;
  return (Array.isArray(separacoes) ? separacoes : []).find((item) => (
    firstText(item.empresa_id) === empresaId
    && firstText(item.tipo) === tipo
    && firstText(item.entrega_id, item.pedido_id) === origem
  )) || null;
};

export const assertEntregaOnCreate = ({ record = {}, entregas = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para entrega.');
  }
  if (isEntregue(record) && !hasProvaEntrega(record)) {
    throw new Error('Entrega exige comprovante (recebedor e prova).');
  }
  const reuse = findDuplicateEntrega(record, entregas);
  if (reuse) return { reuse, record };
  return { reuse: null, record };
};

export const assertRomaneioOnCreate = ({ record = {}, romaneios = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para romaneio.');
  }
  if (!firstText(record.motorista, record.motorista_id, record.motorista_nome)) {
    throw new Error('Motorista obrigatorio para romaneio.');
  }
  if (!firstText(record.veiculo, record.veiculo_id, record.placa)) {
    throw new Error('Veiculo ou placa obrigatorio para romaneio.');
  }
  if (!sortedEntregaIds(record)) {
    throw new Error('Selecione pelo menos uma entrega.');
  }
  const reuse = findDuplicateRomaneio(record, romaneios);
  if (reuse) return { reuse, record };
  return { reuse: null, record };
};

export const assertSeparacaoOnCreate = ({ record = {}, separacoes = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para separacao.');
  }
  const reuse = findDuplicateSeparacao(record, separacoes);
  if (reuse) return { reuse, record };
  return { reuse: null, record };
};

export const assertEntregaOnUpdate = ({ before = {}, patch = {} } = {}) => {
  const next = { ...before, ...patch, comprovante_entrega: patch.comprovante_entrega || before.comprovante_entrega };
  if (firstText(before.empresa_id) && firstText(next.empresa_id) && firstText(before.empresa_id) !== firstText(next.empresa_id)) {
    throw new Error('Empresa da entrega nao pode ser alterada.');
  }
  if (isEntregue(next) && !hasProvaEntrega(next)) {
    throw new Error('Entrega exige comprovante (recebedor e prova).');
  }
  if (statusOf(next).includes('parcial') && !hasProvaEntrega(next)) {
    throw new Error('Entrega parcial exige comprovante (recebedor e prova).');
  }
  if (statusOf(next).includes('devolv')) {
    const reversa = next.logistica_reversa || {};
    if (!firstText(reversa.motivo) || (!(Number(reversa.quantidade_devolvida) > 0) && !(Number(reversa.valor_devolvido) > 0))) {
      throw new Error('Devolucao exige motivo e quantidade ou valor.');
    }
  }
  if (statusOf(next).includes('frustr') && !firstText(next.entrega_frustrada?.motivo)) {
    throw new Error('Ocorrencia exige motivo.');
  }
  return next;
};

export const applyExpedicaoCreate = (entityName, record, stores = {}) => {
  if (entityName === 'Entrega') return assertEntregaOnCreate({ record, entregas: stores.entregas });
  if (entityName === 'Romaneio') return assertRomaneioOnCreate({ record, romaneios: stores.romaneios });
  if (entityName === 'SeparacaoConferencia') return assertSeparacaoOnCreate({ record, separacoes: stores.separacoes });
  return { reuse: null, record };
};

export const syncEntregaNumero = (entityName, record = {}) => {
  if (entityName !== 'Entrega') return record;
  const code = firstText(record.qr_code, record.numero_entrega);
  if (!code) return record;
  return {
    ...record,
    qr_code: firstText(record.qr_code) || code,
    numero_entrega: firstText(record.numero_entrega) || code,
  };
};
