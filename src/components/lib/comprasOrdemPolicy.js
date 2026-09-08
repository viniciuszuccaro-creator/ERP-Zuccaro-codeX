const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const COMPRAS_ENTITIES = ['OrdemCompra', 'SolicitacaoCompra', 'Cotacao'];

export const isComprasEntity = (entityName) => COMPRAS_ENTITIES.includes(entityName);

export const ocIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const solicitacaoId = firstText(record.solicitacao_compra_id);
  if (solicitacaoId) {
    return ['oc', firstText(record.empresa_id), 'sc', solicitacaoId].join('|');
  }
  const cotacaoId = firstText(record.cotacao_id);
  if (cotacaoId) {
    return ['oc', firstText(record.empresa_id), 'cot', cotacaoId, firstText(record.fornecedor_id)].join('|');
  }
  return '';
};

export const findDuplicateOc = (record = {}, orders = []) => {
  const key = ocIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(orders) ? orders : []).find((item) => {
    const status = String(item.status || '').toLowerCase();
    if (status.includes('cancel')) return false;
    return ocIdempotencyKey(item) === key;
  }) || null;
};

export const assertOrdemCompraOnCreate = ({ record = {}, orders = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para ordem de compra.');
  }
  const stamped = {
    ...record,
    origem: firstText(record.origem, record.solicitacao_compra_id ? 'solicitacao' : record.cotacao_id ? 'cotacao' : 'manual'),
    idempotency_key: ocIdempotencyKey(record) || undefined,
  };
  const reuse = findDuplicateOc(stamped, orders);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};

export const assertSolicitacaoCompraOnCreate = ({ record = {} } = {}) => {
  if (!firstText(record.group_id, record.grupo_id) && !firstText(record.empresa_id)) {
    throw new Error('Grupo ou empresa obrigatorios para solicitacao de compra.');
  }
  return { reuse: null, record };
};

export const assertCotacaoOnCreate = ({ record = {} } = {}) => {
  if (!firstText(record.group_id, record.grupo_id) && !firstText(record.empresa_id)) {
    throw new Error('Grupo ou empresa obrigatorios para cotacao.');
  }
  return { reuse: null, record };
};

export const applyComprasCreate = (entityName, record = {}, stores = {}) => {
  if (entityName === 'OrdemCompra') {
    return assertOrdemCompraOnCreate({ record, orders: stores.ordensCompra });
  }
  if (entityName === 'SolicitacaoCompra') {
    return assertSolicitacaoCompraOnCreate({ record });
  }
  if (entityName === 'Cotacao') {
    return assertCotacaoOnCreate({ record });
  }
  return { reuse: null, record };
};

export const isOcRecebida = (oc = {}) => {
  const status = String(oc.status || '').toLowerCase();
  return status.includes('receb');
};

export const assertRecebimentoOc = ({ before = {}, patch = {} } = {}) => {
  if (!firstText(before.empresa_id || patch.empresa_id)) {
    throw new Error('Empresa obrigatoria para receber ordem de compra.');
  }
  const patchStatus = firstText(patch.status);
  const goingReceived = patchStatus && String(patchStatus).toLowerCase().includes('receb');
  if (!goingReceived) return { reuse: null, record: { ...before, ...patch } };
  if (isOcRecebida(before)) {
    return { reuse: before, record: before };
  }
  if (!Array.isArray(before.itens) || before.itens.length === 0) {
    if (!Array.isArray(patch.itens) || patch.itens.length === 0) {
      throw new Error('OC sem itens nao pode ser recebida.');
    }
  }
  return {
    reuse: null,
    record: {
      ...before,
      ...patch,
      empresa_id: before.empresa_id || patch.empresa_id,
      group_id: before.group_id || patch.group_id,
      grupo_id: before.grupo_id || patch.grupo_id || before.group_id || patch.group_id,
      status: 'Recebida',
    },
  };
};

export const stampMovimentacaoRecebimentoOc = ({ oc = {}, item = {}, dataRecebimento } = {}) => ({
  produto_id: item.produto_id,
  produto_descricao: item.descricao,
  tipo_movimentacao: 'Entrada',
  origem_movimento: 'compra',
  origem_documento_id: oc.id,
  quantidade: item.quantidade_solicitada || item.quantidade_recebida,
  data_movimentacao: dataRecebimento || new Date().toISOString().split('T')[0],
  documento: firstText(oc.numero_oc),
  motivo: 'Recebimento de Ordem de Compra',
  valor_unitario: item.valor_unitario,
  valor_total: item.valor_total,
  empresa_id: oc.empresa_id,
  group_id: oc.group_id || oc.grupo_id,
  grupo_id: oc.grupo_id || oc.group_id,
  responsavel: 'Sistema',
});

const normalizeOcStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const classifyOcStatusTransition = (beforeStatus, nextStatus) => {
  const before = normalizeOcStatus(beforeStatus);
  const next = normalizeOcStatus(nextStatus);
  if (!next || before === next) return 'retry';
  if (next.includes('cancel')) return 'cancelar';
  if (next.includes('receb')) return 'receber';
  if (next.includes('aprov')) return 'aprovar';
  if (next.includes('envi')) return 'enviar';
  return 'editar';
};

export const ocStatusPermissionActions = (action) => {
  if (action === 'receber') return ['receber'];
  if (action === 'aprovar') return ['aprovar'];
  if (action === 'enviar') return ['enviar_fornecedor', 'editar'];
  if (action === 'cancelar') return ['cancelar', 'editar'];
  return ['editar'];
};

export const stampContaPagarRecebimentoOc = ({ oc = {}, dataVencimento } = {}) => {
  if (!firstText(oc.id)) throw new Error('OC obrigatoria para gerar Conta a Pagar.');
  if (!firstText(oc.empresa_id)) throw new Error('Empresa obrigatoria para Conta a Pagar da OC.');
  if (!firstText(oc.fornecedor_id)) throw new Error('Fornecedor obrigatorio para Conta a Pagar da OC.');
  const valor = Number(oc.valor_total || oc.valor || 0);
  if (!(valor > 0)) throw new Error('Valor da OC obrigatorio para Conta a Pagar.');
  const vencimento = firstText(dataVencimento, oc.data_entrega_real, oc.data_prevista_entrega)
    || new Date().toISOString().split('T')[0];
  return {
    fornecedor_id: oc.fornecedor_id,
    fornecedor_nome: oc.fornecedor_nome,
    descricao: `OC ${firstText(oc.numero_oc) || oc.id}`,
    valor,
    valor_original: valor,
    valor_pago: 0,
    status: 'Em Aberto',
    data_emissao: firstText(oc.data_entrega_real) || new Date().toISOString().split('T')[0],
    data_vencimento: vencimento,
    numero_parcela: '1',
    origem_tipo: 'ordem_compra',
    origem_documento_id: oc.id,
    ordem_compra_id: oc.id,
    numero_documento: firstText(oc.numero_oc, oc.nota_fiscal_entrada),
    nota_fiscal: firstText(oc.nota_fiscal_entrada),
    empresa_id: oc.empresa_id,
    group_id: oc.group_id || oc.grupo_id,
    grupo_id: oc.grupo_id || oc.group_id,
    idempotency_key: ['titulo', 'ordem_compra', oc.id, '1'].join('|'),
  };
};

export const findContaPagarOc = (oc = {}, titles = []) => {
  const ocId = firstText(oc.id);
  if (!ocId) return null;
  return (Array.isArray(titles) ? titles : []).find((item) => (
    firstText(item.origem_documento_id, item.ordem_compra_id) === ocId
    && (
      firstText(item.origem_tipo) === 'ordem_compra'
      || firstText(item.origem_tipo) === 'compra'
      || Boolean(firstText(item.ordem_compra_id))
    )
  )) || null;
};

export const assertOrdemCompraOnUpdate = ({ before = {}, patch = {} } = {}) => {
  const statusChanging = Object.prototype.hasOwnProperty.call(patch, 'status');
  let action = statusChanging
    ? classifyOcStatusTransition(before.status, patch.status)
    : 'editar';

  if (action === 'receber' || (statusChanging && normalizeOcStatus(patch.status).includes('receb'))) {
    const decision = assertRecebimentoOc({ before, patch });
    if (decision.reuse) {
      return { reuse: decision.reuse, record: decision.reuse, action: 'retry' };
    }
    return { reuse: null, record: decision.record, action: 'receber' };
  }

  if (action === 'retry') {
    return { reuse: before, record: before, action: 'retry' };
  }

  return {
    reuse: null,
    action,
    record: {
      ...before,
      ...patch,
      empresa_id: before.empresa_id || patch.empresa_id,
      group_id: before.group_id || patch.group_id,
      grupo_id: before.grupo_id || patch.grupo_id || before.group_id || patch.group_id,
    },
  };
};
