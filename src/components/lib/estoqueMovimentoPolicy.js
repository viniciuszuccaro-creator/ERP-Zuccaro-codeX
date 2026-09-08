const toQty = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const HISTORICO_ESTOQUE_ENTITIES = ['MovimentacaoEstoque', 'AuditLog'];

const SET_TIPOS = new Set(['ajuste', 'inventario', 'inventário']);
const IN_TIPOS = new Set(['entrada', 'devolucao', 'devolução', 'compra', 'recebimento', 'producao_entrada']);
const OUT_TIPOS = new Set(['saida', 'saída', 'venda', 'consumo', 'baixa', 'producao']);

export const normalizeTipoMovimento = (record = {}) => String(
  record.tipo_movimento || record.tipo_movimentacao || '',
).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const isAjusteEstoque = (record = {}) => SET_TIPOS.has(normalizeTipoMovimento(record));

export const movementHasOrigin = (record = {}) => Boolean(
  firstText(
    record.origem_movimento,
    record.origem_documento_id,
    record.documento,
    record.documento_referencia,
    record.motivo,
  ),
);

export const movementIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const origemDoc = firstText(record.origem_documento_id);
  const documento = firstText(record.documento, record.documento_referencia);
  if (!origemDoc && !documento) return '';
  return [
    firstText(record.origem_movimento) || 'documento',
    origemDoc,
    firstText(record.empresa_id),
    firstText(record.produto_id),
    normalizeTipoMovimento(record),
    String(toQty(record.quantidade)),
    documento,
  ].join('|');
};

export const findDuplicateMovement = (record = {}, movements = []) => {
  const key = movementIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(movements) ? movements : []).find((item) => movementIdempotencyKey(item) === key) || null;
};

export const resolveSignedQuantity = (record = {}) => {
  const qty = toQty(record.quantidade);
  if (qty < 0) return qty;
  const tipo = normalizeTipoMovimento(record);
  if (!tipo) {
    const error = new Error('Tipo de movimentacao obrigatorio.');
    error.code = 'ESTOQUE_TIPO_OBRIGATORIO';
    throw error;
  }
  if (SET_TIPOS.has(tipo)) return null;
  if (tipo === 'liberacao_reserva' || tipo === 'reserva') return 0;
  if (tipo === 'transferencia' || tipo === 'transferencia_entrada') return qty;
  if (tipo === 'transferencia_saida') return -qty;
  if (OUT_TIPOS.has(tipo)) return -qty;
  if (IN_TIPOS.has(tipo)) return qty;
  const error = new Error(`Tipo de movimentacao nao suportado: ${tipo}`);
  error.code = 'ESTOQUE_TIPO_INVALIDO';
  throw error;
};

export const configAllowsNegativeStock = (configs = [], { groupId = null, empresaId = null } = {}) => (
  (Array.isArray(configs) ? configs : []).some((item) => {
    if (String(item?.chave || '') !== 'estoque_permite_saldo_negativo') return false;
    const cfgGroup = firstText(item.group_id, item.grupo_id);
    const cfgEmpresa = firstText(item.empresa_id);
    // Fail-closed: config global sem escopo nao libera saldo negativo
    if (!cfgGroup && !cfgEmpresa) return false;
    if (groupId && cfgGroup && cfgGroup !== String(groupId)) return false;
    if (empresaId && cfgEmpresa && cfgEmpresa !== String(empresaId)) return false;
    if (groupId && !cfgGroup && cfgEmpresa && empresaId && cfgEmpresa !== String(empresaId)) return false;
    const raw = String(item.valor ?? item.valor_texto ?? item.valor_booleano ?? '').trim().toLowerCase();
    return item.valor_booleano === true || raw === '1' || raw === 'true' || raw === 'sim';
  })
);

export const resolveNextEstoque = ({ produto = {}, record = {}, permiteNegativo = false } = {}) => {
  const current = toQty(produto.estoque_atual);
  const explicit = record.estoque_atual;
  const hasExplicit = explicit !== undefined && explicit !== null && String(explicit) !== '';
  let next;
  if (hasExplicit) {
    next = toQty(explicit);
  } else {
    const delta = resolveSignedQuantity(record);
    next = delta === null ? Math.abs(toQty(record.quantidade)) : current + delta;
  }
  if (next < -0.0001 && !permiteNegativo) {
    const error = new Error('Saldo negativo sem politica.');
    error.code = 'ESTOQUE_NEGATIVO';
    throw error;
  }
  return { current, next: Math.round(next * 1000) / 1000 };
};

export const assertMovimentacaoEstoque = ({ record = {}, produto = null, movements = [], permiteNegativo = false } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para movimentar estoque.');
  }
  if (!movementHasOrigin(record)) {
    throw new Error('Movimentacao de estoque exige origem.');
  }
  const duplicate = findDuplicateMovement(record, movements);
  if (duplicate) {
    return { reuse: duplicate, record, produtoPatch: null };
  }

  const produtoId = firstText(record.produto_id);
  if (!produtoId) {
    return { reuse: null, record, produtoPatch: null };
  }
  if (!produto) {
    throw new Error('Produto nao encontrado no estoque.');
  }

  const produtoEmpresa = firstText(produto.empresa_id, produto.empresa_dona_id);
  const movimentoEmpresa = firstText(record.empresa_id);
  if (produtoEmpresa && movimentoEmpresa && produtoEmpresa !== movimentoEmpresa) {
    const error = new Error('Movimentacao em empresa errada.');
    error.code = 'ESTOQUE_EMPRESA_ERRADA';
    throw error;
  }
  if (!produtoEmpresa) {
    const produtoGroup = firstText(produto.group_id, produto.grupo_id);
    const movimentoGroup = firstText(record.group_id, record.grupo_id);
    if (!produtoGroup || !movimentoGroup || produtoGroup !== movimentoGroup) {
      const error = new Error('Produto sem empresa proprietaria exige group_id compativel.');
      error.code = 'ESTOQUE_EMPRESA_ERRADA';
      throw error;
    }
  }

  const qty = toQty(record.quantidade);
  if (qty === 0 && !isAjusteEstoque(record) && record.estoque_atual === undefined) {
    throw new Error('Quantidade da movimentacao deve ser diferente de zero.');
  }

  const { current, next } = resolveNextEstoque({
    produto,
    record,
    permiteNegativo: Boolean(permiteNegativo || produto.permite_saldo_negativo),
  });

  const stamped = {
    ...record,
    origem_movimento: firstText(record.origem_movimento) || 'manual',
    tipo_movimento: firstText(record.tipo_movimento) || firstText(record.tipo_movimentacao) || 'Entrada',
    estoque_anterior: record.estoque_anterior ?? current,
    estoque_atual: next,
    quantidade: Math.abs(qty) || Math.abs(next - current),
    idempotency_key: movementIdempotencyKey(record) || undefined,
  };

  const produtoPatch = { estoque_atual: next };
  if (record.reservado_atual !== undefined && record.reservado_atual !== null) {
    produtoPatch.estoque_reservado = toQty(record.reservado_atual);
  }

  return { reuse: null, record: stamped, produtoPatch };
};
