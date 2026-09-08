const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const CRM_ENTITIES = ['Oportunidade', 'Interacao', 'Campanha'];

export const CRM_ETAPAS = [
  'Prospecção',
  'Contato Inicial',
  'Qualificação',
  'Proposta',
  'Negociação',
  'Fechamento',
];

export const isCrmEntity = (entityName) => CRM_ENTITIES.includes(entityName);

export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const normalizeEtapaCrm = (value) => {
  const raw = firstText(value);
  if (!raw) return 'Prospecção';
  const hit = CRM_ETAPAS.find((etapa) => etapa.toLowerCase() === raw.toLowerCase());
  if (hit) return hit;
  const aliases = {
    contato: 'Contato Inicial',
    'contato inicial': 'Contato Inicial',
    qualificacao: 'Qualificação',
    qualificação: 'Qualificação',
    proposta: 'Proposta',
    negociacao: 'Negociação',
    negociação: 'Negociação',
    fechamento: 'Fechamento',
    prospeccao: 'Prospecção',
    prospecção: 'Prospecção',
  };
  return aliases[raw.toLowerCase()] || raw;
};

export const oportunidadeAberta = (record = {}) => {
  const status = String(record.status || '').toLowerCase();
  return !status.includes('ganh')
    && !status.includes('perd')
    && !status.includes('cancel')
    && !status.includes('convert')
    && !status.includes('fechad');
};

export const oportunidadeIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const scope = firstText(record.empresa_id, record.group_id, record.grupo_id);
  const siteRef = firstText(record.pedido_id, record.orcamento_site_id, record.orcamento_id);
  if (scope && siteRef) return ['opp', scope, 'ref', siteRef].join('|');
  const contact = firstText(record.cliente_email).toLowerCase()
    || digitsOnly(record.cliente_telefone)
    || firstText(record.cliente_id);
  const titulo = firstText(record.titulo).toLowerCase();
  if (!scope || !contact || !titulo) return '';
  return ['opp', scope, contact, titulo].join('|');
};

export const findDuplicateOportunidade = (record = {}, oportunidades = []) => {
  const key = oportunidadeIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(oportunidades) ? oportunidades : []).find((item) => (
    oportunidadeAberta(item) && oportunidadeIdempotencyKey(item) === key
  )) || null;
};

export const stampOportunidadeDefaults = (record = {}) => {
  const etapa = normalizeEtapaCrm(record.etapa || record.etapa_funil);
  return {
    ...record,
    etapa,
    etapa_funil: etapa,
    status: firstText(record.status) || 'Aberto',
    probabilidade: Number.isFinite(Number(record.probabilidade)) ? Number(record.probabilidade) : 50,
    valor_estimado: Number(record.valor_estimado) || 0,
    data_abertura: firstText(record.data_abertura) || new Date().toISOString().slice(0, 10),
    temperatura: firstText(record.temperatura) || 'Morno',
    idempotency_key: oportunidadeIdempotencyKey(record) || undefined,
  };
};

export const assertOportunidadeOnCreate = ({ record = {}, oportunidades = [] } = {}) => {
  if (!firstText(record.group_id, record.grupo_id) && !firstText(record.empresa_id)) {
    throw new Error('Grupo ou empresa obrigatorios para oportunidade.');
  }
  if (!firstText(record.titulo)) {
    throw new Error('Titulo obrigatorio para oportunidade.');
  }
  if (!firstText(record.cliente_nome, record.cliente_id, record.cliente_email)) {
    throw new Error('Cliente obrigatorio para oportunidade.');
  }
  const stamped = stampOportunidadeDefaults(record);
  const reuse = findDuplicateOportunidade(stamped, oportunidades);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const assertInteracaoOnCreate = ({ record = {} } = {}) => {
  if (!firstText(record.empresa_id) && !firstText(record.group_id, record.grupo_id)) {
    throw new Error('Grupo ou empresa obrigatorios para interacao.');
  }
  if (!firstText(record.titulo)) {
    throw new Error('Titulo obrigatorio para interacao.');
  }
  if (!firstText(record.cliente_nome, record.cliente_id, record.oportunidade_id)) {
    throw new Error('Cliente ou oportunidade obrigatorios para interacao.');
  }
  return {
    reuse: null,
    record: {
      ...record,
      tipo: firstText(record.tipo) || 'Ligação',
      data_interacao: firstText(record.data_interacao) || new Date().toISOString().slice(0, 10),
      resultado: firstText(record.resultado) || 'Neutro',
    },
  };
};

export const assertCampanhaOnCreate = ({ record = {} } = {}) => {
  if (!firstText(record.group_id, record.grupo_id) && !firstText(record.empresa_id, record.empresa_dona_id)) {
    throw new Error('Grupo ou empresa obrigatorios para campanha.');
  }
  if (!firstText(record.nome, record.titulo)) {
    throw new Error('Nome obrigatorio para campanha.');
  }
  const empresa = firstText(record.empresa_dona_id, record.empresa_id);
  return {
    reuse: null,
    record: {
      ...record,
      nome: firstText(record.nome, record.titulo),
      empresa_dona_id: empresa || record.empresa_dona_id,
      empresa_id: firstText(record.empresa_id, empresa) || undefined,
      status: firstText(record.status) || 'Planejamento',
      data_inicio: firstText(record.data_inicio) || new Date().toISOString().slice(0, 10),
    },
  };
};

export const assertOportunidadeOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!before?.id && !firstText(before.codigo_oportunidade)) {
    throw new Error('Oportunidade nao encontrada.');
  }

  const statusChanging = Object.prototype.hasOwnProperty.call(patch, 'status');
  const nextStatusProbe = firstText(patch.status, before.status);
  const closingNow = oportunidadeAberta(before) && !oportunidadeAberta({ status: nextStatusProbe });
  const converting = statusChanging && (
    String(patch.status || '').toLowerCase().includes('ganh')
    || String(patch.status || '').toLowerCase().includes('convert')
    || Boolean(patch.convertido_em)
  );

  if (!oportunidadeAberta(before) && !converting) {
    const keys = Object.keys(patch || {}).filter((key) => !['updated_date', 'id', 'historico_mudancas_etapa'].includes(key));
    const onlyRetryStatus = keys.length === 1 && statusChanging
      && String(patch.status || '').toLowerCase() === String(before.status || '').toLowerCase();
    if (keys.length > 0 && !onlyRetryStatus) {
      throw new Error('Oportunidade fechada ou convertida nao pode ser recalculada.');
    }
    return { reuse: before, record: before, action: 'retry' };
  }

  const merged = { ...before, ...patch };
  if (before.empresa_id) merged.empresa_id = before.empresa_id;
  if (before.group_id) merged.group_id = before.group_id;
  if (before.grupo_id) merged.grupo_id = before.grupo_id;
  if (before.codigo_oportunidade && !firstText(patch.codigo_oportunidade)) {
    merged.codigo_oportunidade = before.codigo_oportunidade;
  }

  const etapaIncoming = firstText(patch.etapa, patch.etapa_funil);
  if (etapaIncoming) {
    const etapa = normalizeEtapaCrm(etapaIncoming);
    merged.etapa = etapa;
    merged.etapa_funil = etapa;
    if (etapa !== normalizeEtapaCrm(before.etapa || before.etapa_funil)) {
      merged.historico_mudancas_etapa = [
        ...(Array.isArray(before.historico_mudancas_etapa) ? before.historico_mudancas_etapa : []),
        {
          etapa_anterior: before.etapa || before.etapa_funil,
          etapa_nova: etapa,
          data: new Date().toISOString(),
        },
      ];
    }
  }

  let action = 'editar';
  if (converting || closingNow) action = 'converter';
  else if (etapaIncoming && normalizeEtapaCrm(etapaIncoming) !== normalizeEtapaCrm(before.etapa || before.etapa_funil)) {
    action = 'mover_etapa';
  } else if (statusChanging && String(patch.status || '').toLowerCase().includes('perd')) {
    action = 'perder';
  }

  if (action === 'converter' && !firstText(merged.empresa_id)) {
    throw new Error('Empresa obrigatoria para converter oportunidade.');
  }

  return {
    reuse: null,
    action,
    record: stampOportunidadeDefaults(merged),
  };
};

export const oportunidadeStatusPermissionActions = (action) => {
  if (action === 'converter') return ['converter', 'aprovar', 'editar'];
  if (action === 'mover_etapa') return ['mover_etapa', 'editar'];
  if (action === 'perder') return ['rejeitar', 'cancelar', 'editar'];
  return ['editar'];
};

export const assertConversaoOportunidade = ({ oportunidade = {}, tipo = 'orcamento', empresaId } = {}) => {
  if (!oportunidadeAberta(oportunidade)) {
    throw new Error('Oportunidade ja convertida ou fechada.');
  }
  const empresa = firstText(empresaId, oportunidade.empresa_id);
  if (!empresa) {
    throw new Error('Empresa obrigatoria para converter oportunidade.');
  }
  const tipoNorm = firstText(tipo).toLowerCase();
  if (!['orcamento', 'pedido'].includes(tipoNorm)) {
    throw new Error('Conversao deve ser orcamento ou pedido.');
  }
  return { empresaId: empresa, tipo: tipoNorm };
};

export const buildDocumentoFromOportunidade = (oportunidade = {}, tipo = 'orcamento', empresaId) => {
  const decision = assertConversaoOportunidade({ oportunidade, tipo, empresaId });
  const base = {
    group_id: firstText(oportunidade.group_id, oportunidade.grupo_id) || undefined,
    empresa_id: decision.empresaId,
    cliente_id: oportunidade.cliente_id,
    cliente_nome: firstText(oportunidade.cliente_nome),
    cliente_email: oportunidade.cliente_email,
    cliente_telefone: oportunidade.cliente_telefone,
    cliente_cpf_cnpj: oportunidade.cliente_cpf_cnpj,
    origem: firstText(oportunidade.origem, 'CRM'),
    origem_pedido: firstText(oportunidade.origem, 'CRM'),
    oportunidade_id: oportunidade.id,
    observacoes: firstText(oportunidade.observacoes, oportunidade.necessidades),
    valor_total: Number(oportunidade.valor_estimado) || 0,
    valor_produtos: Number(oportunidade.valor_estimado) || 0,
  };

  if (decision.tipo === 'pedido') {
    return {
      ...base,
      tipo: 'Pedido',
      tipo_pedido: 'Revenda',
      status: 'Em Digitação',
      data_pedido: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    ...base,
    tipo: 'Orçamento',
    tipo_pedido: 'Orçamento',
    status: 'Orçamento',
    data_pedido: new Date().toISOString().slice(0, 10),
  };
};

export const stampOportunidadeConvertida = (oportunidade = {}, documento = {}, tipo = 'orcamento') => ({
  ...oportunidade,
  status: 'Ganho',
  etapa: 'Fechamento',
  etapa_funil: 'Fechamento',
  data_fechamento: new Date().toISOString().slice(0, 10),
  pedido_id: tipo === 'pedido' ? documento?.id : oportunidade.pedido_id,
  orcamento_id: tipo === 'orcamento' ? documento?.id : oportunidade.orcamento_id,
  convertido_em: tipo,
  convertido_em_id: documento?.id,
});

export const applyCrmCreate = (entityName, record = {}, stores = {}) => {
  if (entityName === 'Oportunidade') {
    return assertOportunidadeOnCreate({ record, oportunidades: stores.oportunidades });
  }
  if (entityName === 'Interacao') {
    return assertInteracaoOnCreate({ record });
  }
  if (entityName === 'Campanha') {
    return assertCampanhaOnCreate({ record });
  }
  return { reuse: null, record };
};
