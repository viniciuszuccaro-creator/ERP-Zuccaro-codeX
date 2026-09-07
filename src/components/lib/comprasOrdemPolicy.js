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
