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

const normalizeOpStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const isOpFinalizada = (record = {}) => {
  const status = normalizeOpStatus(record.status);
  return ['conclu', 'finaliz', 'cancel', 'expedid'].some((token) => status.includes(token))
    || Boolean(record.estoque_baixado)
    || Number(record.percentual_conclusao) >= 100 && status.includes('pronta');
};

export const classifyOpStatusTransition = (beforeStatus, nextStatus) => {
  const before = normalizeOpStatus(beforeStatus);
  const next = normalizeOpStatus(nextStatus);
  if (!next || before === next) return 'retry';
  if (next.includes('cancel')) return 'cancelar';
  if (next.includes('confer')) return 'apontar';
  if (next.includes('pronta') || next.includes('exped') || next.includes('conclu') || next.includes('finaliz')) {
    return 'aprovar';
  }
  if (next.includes('corte') || next.includes('dobra') || next.includes('armac') || next.includes('montag') || next.includes('produc')) {
    return 'apontar';
  }
  return 'editar';
};

export const opStatusPermissionActions = (action) => {
  if (action === 'apontar') return ['apontar', 'criar'];
  if (action === 'aprovar') return ['aprovar', 'liberar'];
  if (action === 'cancelar') return ['cancelar'];
  return ['editar'];
};

const FROZEN_AFTER_FINAL = ['empresa_id', 'pedido_id', 'numero_op', 'peso_total_kg'];

export const assertOpOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!before?.id) throw new Error('Ordem de producao nao encontrada.');

  if (firstText(patch.empresa_id) && firstText(before.empresa_id) && firstText(patch.empresa_id) !== firstText(before.empresa_id)) {
    throw new Error('OP deve pertencer a empresa correta.');
  }

  const nextStatus = firstText(patch.status) || before.status;
  const statusChanging = Object.prototype.hasOwnProperty.call(patch, 'status');
  let transition = statusChanging
    ? classifyOpStatusTransition(before.status, patch.status)
    : 'editar';

  const frozenHit = FROZEN_AFTER_FINAL.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
    if (field === 'peso_total_kg') {
      return Math.abs(toQty(before[field]) - toQty(patch[field])) > 0.009;
    }
    const previous = firstText(before[field]);
    const next = firstText(patch[field]);
    if (!previous) return false;
    return !next || next !== previous;
  });

  if (isOpFinalizada(before) && frozenHit && transition !== 'cancelar') {
    throw new Error('OP finalizada nao pode ser recalculada.');
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
    record: {
      ...patch,
      empresa_id: before.empresa_id || patch.empresa_id,
      pedido_id: before.pedido_id || patch.pedido_id,
      numero_op: before.numero_op || patch.numero_op,
      status: nextStatus,
    },
  };
};

export const assertOpOnDelete = (record = {}) => {
  const status = normalizeOpStatus(record.status);
  if (record.estoque_baixado || Number(record.percentual_conclusao) >= 100) {
    throw new Error('Nao excluir OP com estoque consumido ou apontamento concluido.');
  }
  if (['conclu', 'finaliz', 'cancel', 'expedid', 'pronta'].some((token) => status.includes(token))) {
    throw new Error('Nao excluir OP finalizada.');
  }
  if (['confer'].some((token) => status.includes(token))) {
    throw new Error('Nao excluir OP em conferencia.');
  }
};
