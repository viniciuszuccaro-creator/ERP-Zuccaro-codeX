const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const toQty = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

export const opIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const pedidoId = firstText(record.pedido_id);
  if (!pedidoId) return '';
  return ['op', firstText(record.empresa_id), pedidoId].join('|');
};

export const findDuplicateOp = (record = {}, ops = []) => {
  const key = opIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(ops) ? ops : []).find((item) => {
    const status = String(item.status || '').toLowerCase();
    if (status.includes('cancel')) return false;
    return opIdempotencyKey(item) === key;
  }) || null;
};

export const assertOpOnCreate = ({ record = {}, ops = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para ordem de producao.');
  }
  const duplicate = findDuplicateOp(record, ops);
  if (duplicate) return { reuse: duplicate, record };
  return {
    reuse: null,
    record: {
      ...record,
      origem: firstText(record.origem) || (record.pedido_id ? 'pedido' : 'manual'),
      idempotency_key: opIdempotencyKey(record) || undefined,
    },
  };
};

export const resolveStatusAposApontamento = ({ percentual = 0, statusAtual } = {}) => {
  if (Number(percentual) >= 100) return 'Em Conferência';
  return statusAtual || 'Em Producao';
};

export const assertApontamento = ({ op, apontamento = {}, empresaId } = {}) => {
  if (!op?.id) throw new Error('OP obrigatoria para apontar producao.');
  const emitente = firstText(empresaId, op.empresa_id);
  if (!emitente) throw new Error('Empresa obrigatoria para apontar producao.');
  if (firstText(op.empresa_id) && firstText(op.empresa_id) !== emitente) {
    throw new Error('Apontamento em empresa errada.');
  }
  if (toQty(apontamento.quantidade_produzida) <= 0 && toQty(apontamento.peso_produzido_kg) <= 0) {
    throw new Error('Informe quantidade ou peso produzido.');
  }
  return true;
};

export const shouldLiberarExpedicao = (op = {}) => {
  const status = String(op.status || '').toLowerCase();
  return status.includes('confer') || Number(op.percentual_conclusao) >= 100;
};
