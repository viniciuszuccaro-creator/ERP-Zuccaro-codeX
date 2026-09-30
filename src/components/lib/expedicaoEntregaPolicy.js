/**
 * @typedef {Record<string, unknown> & {
 *   id?: unknown,
 *   status?: string,
 *   tipo_frete?: unknown,
 *   entregas_ids?: unknown[],
 *   comprovante_entrega?: ExpedicaoRecord,
 *   nome_recebedor?: unknown,
 *   foto_comprovante?: unknown,
 *   assinatura_digital?: unknown,
 *   documento_recebedor?: unknown,
 *   motorista?: unknown,
 *   motorista_id?: unknown,
 *   motorista_nome?: unknown,
 *   motorista_email?: unknown,
 *   email?: unknown,
 *   full_name?: unknown,
 *   pedido_id?: unknown,
 *   empresa_id?: unknown,
 *   veiculo?: unknown,
 *   veiculo_id?: unknown,
 *   placa?: unknown,
 *   entrega_id?: unknown,
 *   tipo?: unknown,
 *   idempotency_key?: unknown,
 *   logistica_reversa?: ExpedicaoRecord,
 *   entrega_frustrada?: ExpedicaoRecord,
 *   motivo?: unknown,
 *   quantidade_devolvida?: unknown,
 *   valor_devolvido?: unknown,
 *   qr_code?: unknown,
 *   numero_entrega?: unknown,
 * }} ExpedicaoRecord
 * @typedef {{ record?: ExpedicaoRecord, entregas?: ExpedicaoRecord[] }} EntregaCreateOptions
 * @typedef {{ record?: ExpedicaoRecord, romaneios?: ExpedicaoRecord[] }} RomaneioCreateOptions
 * @typedef {{ record?: ExpedicaoRecord, separacoes?: ExpedicaoRecord[] }} SeparacaoCreateOptions
 * @typedef {{ before?: ExpedicaoRecord, patch?: ExpedicaoRecord }} EntregaUpdateOptions
 * @typedef {{ entregas?: ExpedicaoRecord[], romaneios?: ExpedicaoRecord[], separacoes?: ExpedicaoRecord[] }} ExpedicaoStores
 */

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** @param {ExpedicaoRecord} record */
const statusOf = (record = {}) => String(record.status || '').toLowerCase();

/** @param {ExpedicaoRecord} record */
const isEntregue = (record = {}) => statusOf(record).includes('entregue') && !statusOf(record).includes('frustr');

/** @param {ExpedicaoRecord} record */
const isRetirada = (record = {}) => String(record.tipo_frete || '').toLowerCase().includes('retir');

/** @param {ExpedicaoRecord} record */
const sortedEntregaIds = (record = {}) => (Array.isArray(record.entregas_ids) ? record.entregas_ids : [])
  .map((id) => String(id))
  .filter(Boolean)
  .sort()
  .join(',');

/** @param {ExpedicaoRecord} record */
export const hasProvaEntrega = (record = {}) => {
  const prova = record.comprovante_entrega || {};
  const nome = firstText(prova.nome_recebedor);
  if (!nome) return false;
  if (isRetirada(record)) return true;
  return Boolean(firstText(prova.foto_comprovante, prova.assinatura_digital, prova.documento_recebedor));
};

/**
 * @param {ExpedicaoRecord} entrega
 * @param {ExpedicaoRecord} user
 */
export const entregaAtribuidaAoMotorista = (entrega = {}, user = {}) => {
  if (!entrega?.id || !user) return false;
  if (firstText(entrega.motorista_id) && firstText(entrega.motorista_id) === firstText(user.id)) return true;
  const motoristaNome = firstText(entrega.motorista, entrega.motorista_nome).toLowerCase();
  const userNome = firstText(user.full_name, user.email).toLowerCase();
  if (motoristaNome && userNome && motoristaNome === userNome) return true;
  const email = firstText(user.email).toLowerCase();
  return Boolean(email && firstText(entrega.motorista_email).toLowerCase() === email);
};

/**
 * @param {ExpedicaoRecord} record
 * @param {ExpedicaoRecord[]} entregas
 */
export const findDuplicateEntrega = (record = {}, entregas = []) => {
  const pedidoId = firstText(record.pedido_id);
  const empresaId = firstText(record.empresa_id);
  if (!pedidoId || !empresaId) return null;
  return (Array.isArray(entregas) ? entregas : []).find((item) => {
    if (statusOf(item).includes('cancel')) return false;
    return firstText(item.pedido_id) === pedidoId && firstText(item.empresa_id) === empresaId;
  }) || null;
};

/**
 * @param {ExpedicaoRecord} record
 * @param {ExpedicaoRecord[]} romaneios
 */
export const findDuplicateRomaneio = (record = {}, romaneios = []) => {
  const key = sortedEntregaIds(record);
  const empresaId = firstText(record.empresa_id);
  if (!key || !empresaId) return null;
  return (Array.isArray(romaneios) ? romaneios : []).find((item) => {
    if (statusOf(item).includes('cancel')) return false;
    return firstText(item.empresa_id) === empresaId && sortedEntregaIds(item) === key;
  }) || null;
};

/**
 * @param {ExpedicaoRecord} record
 * @param {ExpedicaoRecord[]} separacoes
 */
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

/** @param {EntregaCreateOptions} options */
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

/** @param {RomaneioCreateOptions} options */
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

/** @param {SeparacaoCreateOptions} options */
export const assertSeparacaoOnCreate = ({ record = {}, separacoes = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para separacao.');
  }
  const reuse = findDuplicateSeparacao(record, separacoes);
  if (reuse) return { reuse, record };
  return { reuse: null, record };
};

/** @param {EntregaUpdateOptions} options */
export const assertEntregaOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!firstText(before.empresa_id) && !firstText(patch.empresa_id)) {
    throw new Error('Empresa obrigatoria para entrega.');
  }
  if (firstText(before.empresa_id) && firstText(patch.empresa_id) && firstText(before.empresa_id) !== firstText(patch.empresa_id)) {
    throw new Error('Empresa da entrega nao pode ser alterada.');
  }

  const next = {
    ...before,
    ...patch,
    empresa_id: before.empresa_id || patch.empresa_id,
    comprovante_entrega: patch.comprovante_entrega || before.comprovante_entrega,
  };

  const statusChanging = Object.prototype.hasOwnProperty.call(patch, 'status');
  let transition = statusChanging
    ? classifyEntregaStatusTransition(before.status, patch.status)
    : 'editar';

  if (firstText(patch.idempotency_key) && firstText(before.idempotency_key) === firstText(patch.idempotency_key)) {
    return { reuse: before, record: before, action: 'retry' };
  }
  if (isEntregue(before) || statusOf(before).includes('frustr') || statusOf(before).includes('devolv')) {
    const frozen = ['empresa_id', 'pedido_id', 'qr_code', 'numero_entrega'];
    const frozenHit = frozen.some((field) => {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
      const previous = firstText(before[field]);
      const value = firstText(patch[field]);
      return Boolean(previous) && (!value || value !== previous);
    });
    if (frozenHit && transition !== 'cancelar') {
      throw new Error('Entrega finalizada nao pode ser recalculada.');
    }
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
  if (statusOf(next).includes('frustr') && !firstText(next.entrega_frustrada?.motivo, patch.entrega_frustrada?.motivo)) {
    throw new Error('Ocorrencia exige motivo.');
  }

  if (transition === 'retry') {
    const extraKeys = Object.keys(patch).filter((key) => !['status', 'historico_status', 'updated_date', 'id'].includes(key));
    if (extraKeys.length === 0) {
      return { reuse: before, record: before, action: 'retry' };
    }
    transition = 'editar';
  }

  return {
    reuse: null,
    action: transition,
    record: next,
  };
};

/** @param {unknown} status */
const normalizeEntregaStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** @param {ExpedicaoRecord} record */
export const assertEntregaOnDelete = (record = {}) => {
  const status = normalizeEntregaStatus(record.status);
  if (isEntregue(record) || status.includes('frustr') || status.includes('devolv') || hasProvaEntrega(record)) {
    throw new Error('Nao excluir entrega finalizada ou com comprovante.');
  }
  if (status.includes('transito') || status.includes('saiu')) {
    throw new Error('Nao excluir entrega em transito.');
  }
};

/**
 * @param {unknown} beforeStatus
 * @param {unknown} nextStatus
 */
export const classifyEntregaStatusTransition = (beforeStatus, nextStatus) => {
  const before = normalizeEntregaStatus(beforeStatus);
  const next = normalizeEntregaStatus(nextStatus);
  if (!next || before === next) return 'retry';
  if (next.includes('cancel')) return 'cancelar';
  if (next.includes('frustr') || next.includes('ocorr') || next.includes('devolv')) return 'ocorrencia';
  if (next.includes('entregue') || next.includes('parcial') || next.includes('chegada')) return 'entregar';
  if (next.includes('separ') || next.includes('confer') || next.includes('pronto')) return 'conferir';
  if (next.includes('transito') || next.includes('saiu') || next.includes('rota')) return 'expedir';
  return 'editar';
};

/** @param {unknown} action */
export const entregaStatusPermissionActions = (action) => {
  if (action === 'entregar') return ['entregar', 'confirmar'];
  if (action === 'conferir') return ['conferir', 'editar'];
  if (action === 'expedir') return ['expedir', 'editar'];
  if (action === 'ocorrencia') return ['ocorrencia', 'criar', 'editar'];
  if (action === 'cancelar') return ['cancelar'];
  return ['editar'];
};

/**
 * @param {unknown} entityName
 * @param {ExpedicaoRecord} record
 * @param {ExpedicaoStores} stores
 */
export const applyExpedicaoCreate = (entityName, record, stores = {}) => {
  if (entityName === 'Entrega') return assertEntregaOnCreate({ record, entregas: stores.entregas });
  if (entityName === 'Romaneio') return assertRomaneioOnCreate({ record, romaneios: stores.romaneios });
  if (entityName === 'SeparacaoConferencia') return assertSeparacaoOnCreate({ record, separacoes: stores.separacoes });
  return { reuse: null, record };
};

/**
 * @param {unknown} entityName
 * @param {ExpedicaoRecord} record
 */
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

/** @param {unknown} value */
export const calendarDayFromValue = (value) => {
  const raw = firstText(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** @param {Date} [now] */
export const todayCalendarDay = (now = new Date()) => calendarDayFromValue(now.toISOString());

/**
 * Data de entrega do cliente na Expedição: solicitada → previsão → data_entrega.
 * @param {ExpedicaoRecord} entrega
 */
export const resolveEntregaClienteCalendarDay = (entrega = {}) => (
  calendarDayFromValue(entrega.data_entrega_cliente)
  || calendarDayFromValue(entrega.data_entrega_solicitada)
  || calendarDayFromValue(entrega.data_previsao)
  || calendarDayFromValue(entrega.data_entrega)
);

/**
 * @param {ExpedicaoRecord} entrega
 * @param {Date} [now]
 */
export const isEntregaFutura = (entrega = {}, now = new Date()) => {
  const status = normalizeEntregaStatus(entrega.status);
  if (status.includes('entregue') || status.includes('cancel') || status.includes('frustr') || status.includes('devolv')) {
    return false;
  }
  const day = resolveEntregaClienteCalendarDay(entrega);
  if (!day) return false;
  return day >= todayCalendarDay(now);
};

/**
 * @param {Record<string, unknown>} input
 */
export const normalizeEntregaListFilters = (input = {}) => {
  const status = firstText(input.status) || 'todos';
  const empresaId = firstText(input.empresaId, input.empresa_id);
  const cidade = firstText(input.cidade).toLowerCase();
  const dataDe = calendarDayFromValue(input.dataDe || input.data_de);
  const dataAte = calendarDayFromValue(input.dataAte || input.data_ate);
  const soFuturas = input.soFuturas === true || input.so_futuras === true || input.soFuturas === 'true';
  const busca = firstText(input.busca, input.q, input.search).toLowerCase();
  const rangeInvalid = Boolean(dataDe && dataAte && dataDe > dataAte);
  return {
    status: status || 'todos',
    empresaId,
    cidade,
    dataDe,
    dataAte,
    soFuturas,
    busca,
    rangeInvalid,
  };
};

/**
 * @param {ExpedicaoRecord} entrega
 * @param {ReturnType<typeof normalizeEntregaListFilters>} filters
 * @param {{ now?: Date }} [options]
 */
export const matchEntregaListFilters = (entrega = {}, filters = normalizeEntregaListFilters({}), options = {}) => {
  if (filters.rangeInvalid) return false;
  const now = options.now || new Date();

  if (filters.empresaId) {
    const empresa = firstText(entrega.empresa_id, entrega.empresa_responsavel_id);
    if (empresa !== filters.empresaId) return false;
  }

  if (filters.cidade) {
    const cidade = firstText(entrega.endereco_entrega_completo?.cidade, entrega.cidade).toLowerCase();
    if (!cidade.includes(filters.cidade)) return false;
  }

  if (filters.status && filters.status !== 'todos') {
    if (firstText(entrega.status) !== filters.status) return false;
  }

  const day = resolveEntregaClienteCalendarDay(entrega);
  if (filters.dataDe) {
    if (!day || day < filters.dataDe) return false;
  }
  if (filters.dataAte) {
    if (!day || day > filters.dataAte) return false;
  }
  if (filters.soFuturas && !isEntregaFutura(entrega, now)) return false;

  if (filters.busca) {
    const hay = [
      entrega.numero_pedido,
      entrega.cliente_nome,
      entrega.codigo_rastreamento,
      entrega.qr_code,
      entrega.motorista,
      entrega.transportadora,
      entrega.regiao_entrega_nome,
      entrega.status,
      entrega.endereco_entrega_completo?.cidade,
      entrega.endereco_entrega_completo?.bairro,
      entrega.endereco_entrega_completo?.logradouro,
      entrega.contato_entrega?.nome,
      entrega.contato_entrega?.telefone,
    ].map((v) => firstText(v).toLowerCase()).join(' ');
    if (!hay.includes(filters.busca)) return false;
  }

  return true;
};

/**
 * @param {ExpedicaoRecord[]} entregas
 * @param {Record<string, unknown>} rawFilters
 * @param {{ now?: Date }} [options]
 */
export const filterEntregasList = (entregas = [], rawFilters = {}, options = {}) => {
  const filters = normalizeEntregaListFilters(rawFilters);
  if (filters.rangeInvalid) return [];
  return (Array.isArray(entregas) ? entregas : []).filter((row) => matchEntregaListFilters(row, filters, options));
};

/**
 * @param {ExpedicaoRecord[]} entregas
 */
export const listCidadesFromEntregas = (entregas = []) => {
  const set = new Set();
  for (const row of Array.isArray(entregas) ? entregas : []) {
    const cidade = firstText(row?.endereco_entrega_completo?.cidade, row?.cidade);
    if (cidade) set.add(cidade);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
