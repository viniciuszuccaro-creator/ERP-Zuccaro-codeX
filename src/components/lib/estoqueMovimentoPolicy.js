/**
 * @typedef {Record<string, unknown> & {
 *   id?: string | number,
 *   empresa_id?: unknown,
 *   group_id?: unknown,
 *   grupo_id?: unknown,
 *   produto_id?: unknown,
 *   tipo_movimento?: unknown,
 *   tipo_movimentacao?: unknown,
 *   quantidade?: unknown,
 *   estoque_anterior?: unknown,
 *   estoque_atual?: unknown,
 *   reservado_atual?: unknown,
 *   origem_movimento?: unknown,
 *   origem_documento_id?: unknown,
 *   documento?: unknown,
 *   documento_referencia?: unknown,
 *   motivo?: unknown,
 *   idempotency_key?: unknown,
 * }} EstoqueMovimentoRecord
 * @typedef {Record<string, unknown> & {
 *   empresa_id?: unknown,
 *   empresa_dona_id?: unknown,
 *   group_id?: unknown,
 *   grupo_id?: unknown,
 *   estoque_atual?: unknown,
 *   permite_saldo_negativo?: unknown,
 * }} EstoqueProdutoRecord
 * @typedef {Record<string, unknown> & {
 *   chave?: unknown,
 *   group_id?: unknown,
 *   grupo_id?: unknown,
 *   empresa_id?: unknown,
 *   valor?: unknown,
 *   valor_texto?: unknown,
 *   valor_booleano?: unknown,
 * }} EstoqueConfigRecord
 * @typedef {{ groupId?: unknown, empresaId?: unknown }} EstoqueConfigScope
 * @typedef {{ produto?: EstoqueProdutoRecord, record?: EstoqueMovimentoRecord, permiteNegativo?: boolean }} ResolveEstoqueOptions
 * @typedef {{ record?: EstoqueMovimentoRecord, produto?: EstoqueProdutoRecord | null, movements?: EstoqueMovimentoRecord[], permiteNegativo?: boolean }} AssertEstoqueOptions
 * @typedef {Record<string, unknown> & {
 *   numero_recebimento?: unknown,
 *   numero_oc?: unknown,
 *   numero_nf?: unknown,
 *   nota_fiscal?: unknown,
 *   responsavel_recebimento?: unknown,
 *   conferente?: unknown,
 * }} RecebimentoAliasRecord
 * @typedef {Error & { code?: string }} EstoquePolicyError
 * @typedef {Record<string, unknown> & { id?: string, group_id?: unknown, grupo_id?: unknown, nome_fantasia?: unknown, razao_social?: unknown }} TransferCompanyRecord
 * @typedef {Record<string, unknown> & { id?: string, group_id?: unknown, grupo_id?: unknown, empresa_id?: unknown, empresa_dona_id?: unknown, descricao?: unknown, codigo?: unknown, status?: unknown, unidade_medida?: unknown, estoque_atual?: unknown, custo_medio?: unknown, custo_aquisicao?: unknown }} TransferProductRecord
 * @typedef {{ empresa_origem_id: string, empresa_destino_id: string, produto_id: string, quantidade: number, unidade: string, motivo: string, gerar_financeiro: boolean, observacoes: string }} TransferFormState
 */

/** @param {unknown} value */
const toQty = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const TRANSFERENCIA_MOTIVOS = ['reequilibrio', 'producao', 'emprestimo', 'devolucao', 'outros'];

/** @returns {TransferFormState} */
export const createTransferenciaFormState = () => ({
  empresa_origem_id: '',
  empresa_destino_id: '',
  produto_id: '',
  quantidade: 0,
  unidade: '',
  motivo: 'reequilibrio',
  gerar_financeiro: false,
  observacoes: '',
});

/** @param {unknown} value @param {number} [maxLength] */
const sanitizeTransferText = (value, maxLength = 500) => String(value || '')
  .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
  .replace(/javascript\s*:/gi, '')
  .split('')
  .filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  })
  .join('')
  .trim()
  .slice(0, maxLength);

/**
 * @param {{ groupId?: unknown, companies?: TransferCompanyRecord[], products?: TransferProductRecord[], form?: Partial<TransferFormState> }} input
 */
export const resolveTransferenciaEntreEmpresas = ({ groupId, companies = [], products = [], form = {} }) => {
  const resolvedGroupId = firstText(groupId);
  if (!resolvedGroupId) throw new Error('Grupo obrigatorio para transferencia entre empresas.');
  const companyList = Array.isArray(companies) ? companies : [];
  const originId = firstText(form.empresa_origem_id);
  const destinationId = firstText(form.empresa_destino_id);
  if (!originId || !destinationId) throw new Error('Selecione as empresas de origem e destino.');
  if (originId === destinationId) throw new Error('Empresa origem e destino devem ser diferentes.');

  const belongsToGroup = (/** @type {TransferCompanyRecord} */ company) => (
    firstText(company.group_id, company.grupo_id) === resolvedGroupId
  );
  const origin = companyList.find((company) => company.id === originId && belongsToGroup(company));
  const destination = companyList.find((company) => company.id === destinationId && belongsToGroup(company));
  if (!origin || !destination) throw new Error('Origem e destino devem pertencer ao Grupo selecionado.');

  const productId = firstText(form.produto_id);
  const product = (Array.isArray(products) ? products : []).find((item) => item.id === productId);
  if (!product || String(product.status || 'Ativo') !== 'Ativo') throw new Error('Produto ativo nao encontrado.');
  const productGroupId = firstText(product.group_id, product.grupo_id);
  const productCompanyId = firstText(product.empresa_id, product.empresa_dona_id);
  if (productGroupId && productGroupId !== resolvedGroupId) throw new Error('Produto pertence a outro Grupo.');
  if (productCompanyId && productCompanyId !== originId) throw new Error('Produto nao pertence a Empresa de origem.');

  const quantity = Number(form.quantidade);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade deve ser maior que zero.');
  const currentStock = Number(product.estoque_atual);
  if (Number.isFinite(currentStock) && quantity > currentStock) throw new Error('Quantidade excede o estoque disponivel na origem.');
  const reason = firstText(form.motivo);
  if (!TRANSFERENCIA_MOTIVOS.includes(reason)) throw new Error('Motivo da transferencia invalido.');

  return {
    groupId: resolvedGroupId,
    origin,
    destination,
    product,
    form: /** @type {TransferFormState} */ ({
      empresa_origem_id: originId,
      empresa_destino_id: destinationId,
      produto_id: productId,
      quantidade: Math.round(quantity * 1000) / 1000,
      unidade: sanitizeTransferText(product.unidade_medida || form.unidade, 20),
      motivo: reason,
      gerar_financeiro: form.gerar_financeiro === true,
      observacoes: sanitizeTransferText(form.observacoes, 500),
    }),
  };
};

/** @param {Partial<TransferFormState> & { transferencia_id?: unknown, status?: unknown }} data */
export const summarizeTransferenciaAudit = (data = {}) => ({
  transferencia_id: firstText(data.transferencia_id) || undefined,
  empresa_origem_id: firstText(data.empresa_origem_id) || undefined,
  empresa_destino_id: firstText(data.empresa_destino_id) || undefined,
  produto_id: firstText(data.produto_id) || undefined,
  quantidade: Number.isFinite(Number(data.quantidade)) ? Number(data.quantidade) : undefined,
  status: firstText(data.status) || undefined,
  gerar_financeiro: data.gerar_financeiro === true,
});

export const HISTORICO_ESTOQUE_ENTITIES = ['MovimentacaoEstoque', 'AuditLog'];

const SET_TIPOS = new Set(['ajuste', 'inventario', 'inventário']);
const IN_TIPOS = new Set(['entrada', 'devolucao', 'devolução', 'compra', 'recebimento', 'producao_entrada']);
const OUT_TIPOS = new Set(['saida', 'saída', 'venda', 'consumo', 'baixa', 'producao']);

/** @param {EstoqueMovimentoRecord} record */
export const normalizeTipoMovimento = (record = {}) => String(
  record.tipo_movimento || record.tipo_movimentacao || '',
).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** @param {EstoqueMovimentoRecord} record */
export const isAjusteEstoque = (record = {}) => SET_TIPOS.has(normalizeTipoMovimento(record));

/** @param {EstoqueMovimentoRecord} record */
export const movementHasOrigin = (record = {}) => Boolean(
  firstText(
    record.origem_movimento,
    record.origem_documento_id,
    record.documento,
    record.documento_referencia,
    record.motivo,
  ),
);

/** @param {RecebimentoAliasRecord} record */
export const normalizeRecebimentoAliases = (record = {}) => ({
  numeroRecebimento: firstText(record.numero_recebimento, record.numero_oc),
  numeroNota: firstText(record.numero_nf, record.nota_fiscal),
  responsavel: firstText(record.responsavel_recebimento, record.conferente),
});

/** @param {EstoqueMovimentoRecord} record */
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

/**
 * @param {EstoqueMovimentoRecord} record
 * @param {EstoqueMovimentoRecord[]} movements
 */
export const findDuplicateMovement = (record = {}, movements = []) => {
  const key = movementIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(movements) ? movements : []).find((item) => movementIdempotencyKey(item) === key) || null;
};

/** @param {EstoqueMovimentoRecord} record */
export const resolveSignedQuantity = (record = {}) => {
  const qty = toQty(record.quantidade);
  if (qty < 0) return qty;
  const tipo = normalizeTipoMovimento(record);
  if (!tipo) {
    const error = /** @type {EstoquePolicyError} */ (new Error('Tipo de movimentacao obrigatorio.'));
    error.code = 'ESTOQUE_TIPO_OBRIGATORIO';
    throw error;
  }
  if (SET_TIPOS.has(tipo)) return null;
  if (tipo === 'liberacao_reserva' || tipo === 'reserva') return 0;
  if (tipo === 'transferencia' || tipo === 'transferencia_entrada') return qty;
  if (tipo === 'transferencia_saida') return -qty;
  if (OUT_TIPOS.has(tipo)) return -qty;
  if (IN_TIPOS.has(tipo)) return qty;
  const error = /** @type {EstoquePolicyError} */ (new Error(`Tipo de movimentacao nao suportado: ${tipo}`));
  error.code = 'ESTOQUE_TIPO_INVALIDO';
  throw error;
};

/**
 * @param {EstoqueConfigRecord[]} configs
 * @param {EstoqueConfigScope} scope
 */
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

/** @param {ResolveEstoqueOptions} options */
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
    const error = /** @type {EstoquePolicyError} */ (new Error('Saldo negativo sem politica.'));
    error.code = 'ESTOQUE_NEGATIVO';
    throw error;
  }
  return { current, next: Math.round(next * 1000) / 1000 };
};

/** @param {AssertEstoqueOptions} options */
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
    const error = /** @type {EstoquePolicyError} */ (new Error('Movimentacao em empresa errada.'));
    error.code = 'ESTOQUE_EMPRESA_ERRADA';
    throw error;
  }
  if (!produtoEmpresa) {
    const produtoGroup = firstText(produto.group_id, produto.grupo_id);
    const movimentoGroup = firstText(record.group_id, record.grupo_id);
    if (!produtoGroup || !movimentoGroup || produtoGroup !== movimentoGroup) {
      const error = /** @type {EstoquePolicyError} */ (new Error('Produto sem empresa proprietaria exige group_id compativel.'));
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

  const produtoPatch = /** @type {Record<string, number>} */ ({ estoque_atual: next });
  if (record.reservado_atual !== undefined && record.reservado_atual !== null) {
    produtoPatch.estoque_reservado = toQty(record.reservado_atual);
  }

  return { reuse: null, record: stamped, produtoPatch };
};
