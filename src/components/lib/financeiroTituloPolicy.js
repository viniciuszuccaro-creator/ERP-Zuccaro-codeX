import { isPendingManualReconciliation } from './migracaoErpPolicy.js';

/**
 * @typedef {Record<string, unknown> & {
 *   id?: string | number,
 *   status?: unknown,
 *   empresa_id?: unknown,
 *   idempotency_key?: unknown,
 *   pedido_id?: unknown,
 *   origem_documento_id?: unknown,
 *   numero_parcela?: unknown,
 *   origem_tipo?: unknown,
 *   valor?: unknown,
 *   valor_total?: unknown,
 *   valor_original?: unknown,
 *   valor_recebido?: unknown,
 *   valor_pago?: unknown,
 *   nfe_id?: unknown,
 *   nota_fiscal_id?: unknown,
 *   nota_id?: unknown,
 *   cliente_id?: unknown,
 *   fornecedor_id?: unknown,
 *   historico_eventos?: FinanceRecord[],
 * }} FinanceRecord
 * @typedef {{ record?: FinanceRecord, titles?: FinanceRecord[] }} TituloCreateOptions
 * @typedef {{ before?: FinanceRecord, patch?: FinanceRecord }} TituloUpdateOptions
 * @typedef {Error & { code?: string }} TituloPolicyError
 */

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** @param {unknown} value */
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

export const TITULO_FINANCEIRO_ENTITIES = ['ContaReceber', 'ContaPagar'];

const LIQUIDADO = new Set(['recebido', 'pago', 'liquidado', 'baixado', 'conciliado']);
const ESTORNO = new Set(['estornado']);
const CONCILIADO = new Set(['conciliado']);
const FROZEN_AFTER_SETTLEMENT = [
  'valor',
  'valor_total',
  'valor_original',
  'valor_recebido',
  'valor_pago',
  'pedido_id',
  'nfe_id',
  'nota_fiscal_id',
  'nota_id',
  'cliente_id',
  'fornecedor_id',
  'empresa_id',
];

/** @param {string} entityName */
export const isTituloFinanceiroEntity = (entityName) => TITULO_FINANCEIRO_ENTITIES.includes(entityName);

/** @param {unknown} status */
export const normalizeTituloStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** @param {FinanceRecord} record */
export const isTituloLiquidado = (record = {}) => LIQUIDADO.has(normalizeTituloStatus(record.status));

/** @param {FinanceRecord} record */
export const isTituloEstorno = (record = {}) => ESTORNO.has(normalizeTituloStatus(record.status));

/** @param {FinanceRecord} record */
export const isTituloConciliado = (record = {}) => CONCILIADO.has(normalizeTituloStatus(record.status));

/** @param {string} entityName */
export const tituloSettlementAction = (entityName) => (entityName === 'ContaPagar' ? 'pagar' : 'receber');

/** @param {string} entityName */
export const tituloSettlementPermissionActions = (entityName) => {
  const primary = tituloSettlementAction(entityName);
  return [primary, 'baixar', 'liquidar'];
};

/** @param {unknown} value */
export const parcelaKey = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : '';
};

/** @param {FinanceRecord} record */
export const tituloIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const pedido = firstText(record.pedido_id, record.origem_documento_id);
  const parcela = parcelaKey(record.numero_parcela);
  if (!pedido) return '';
  return ['titulo', firstText(record.origem_tipo) || 'pedido', pedido, parcela].join('|');
};

/**
 * @param {FinanceRecord} record
 * @param {FinanceRecord[]} titles
 */
export const findDuplicateTitulo = (record = {}, titles = []) => {
  const key = tituloIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(titles) ? titles : []).find((item) => tituloIdempotencyKey(item) === key) || null;
};

/**
 * @param {FinanceRecord} before
 * @param {FinanceRecord} patch
 * @param {string} field
 */
const linkCleared = (before, patch, field) => {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
  const previous = firstText(before[field]);
  const next = firstText(patch[field]);
  return Boolean(previous) && !next;
};

/**
 * @param {FinanceRecord} before
 * @param {FinanceRecord} patch
 * @param {string} field
 */
const moneyChanged = (before, patch, field) => {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
  if (patch[field] === undefined || patch[field] === null || patch[field] === '') return false;
  return Math.abs(toMoney(before[field]) - toMoney(patch[field])) > 0.009;
};

/**
 * Onda 6 — pedidos elegíveis ao vínculo ContaReceber no mesmo grupo/empresa.
 * @param {{ pedidos?: FinanceRecord[], groupId?: unknown, empresaId?: unknown }} options
 */
export const filterPedidosParaTitulo = ({ pedidos = [], groupId, empresaId } = {}) => {
  const group = firstText(groupId);
  const empresa = firstText(empresaId);
  return (Array.isArray(pedidos) ? pedidos : []).filter((pedido) => {
    const pedidoEmpresa = firstText(pedido?.empresa_id);
    const pedidoGroup = firstText(pedido?.group_id, pedido?.grupo_id);
    if (empresa && pedidoEmpresa && pedidoEmpresa !== empresa) return false;
    if (group && pedidoGroup && pedidoGroup !== group) return false;
    if (empresa && !pedidoEmpresa) return false;
    return Boolean(firstText(pedido?.id));
  });
};

/**
 * Aplica vínculo Pedido → ContaReceber sem inventar cadastro paralelo.
 * @param {{ form?: FinanceRecord, pedido?: FinanceRecord | null }} options
 */
export const applyPedidoVinculoAoForm = ({ form = {}, pedido = null } = {}) => {
  if (!pedido || !firstText(pedido.id)) {
    const nextOrigem = firstText(form.origem_tipo) === 'pedido' ? 'manual' : firstText(form.origem_tipo) || 'manual';
    return {
      ...form,
      pedido_id: '',
      origem_documento_id: firstText(form.origem_documento_id) === firstText(form.pedido_id)
        ? ''
        : form.origem_documento_id,
      origem_tipo: nextOrigem,
    };
  }
  const clienteId = firstText(form.cliente_id) || firstText(pedido.cliente_id);
  const clienteNome = firstText(form.cliente) || firstText(pedido.cliente_nome, pedido.cliente);
  const pedidoValor = toMoney(pedido.valor_total ?? pedido.total ?? pedido.valor);
  const keepValor = toMoney(form.valor) > 0;
  const numero = firstText(pedido.numero_pedido, pedido.numero, pedido.id);
  return {
    ...form,
    pedido_id: firstText(pedido.id),
    origem_tipo: 'pedido',
    origem_documento_id: firstText(pedido.id),
    ...(clienteId ? { cliente_id: clienteId, cliente: clienteNome } : {}),
    ...(!keepValor && pedidoValor > 0 ? { valor: pedidoValor } : {}),
    ...(!firstText(form.descricao) ? { descricao: `Pedido ${numero}` } : {}),
  };
};

/**
 * Fail-closed: vínculo Pedido só no mesmo groupId/empresaId do título.
 * @param {{ record?: FinanceRecord, pedido?: FinanceRecord | null, groupId?: unknown, empresaId?: unknown }} options
 */
export const assertPedidoVinculoTitulo = ({ record = {}, pedido = null, groupId, empresaId } = {}) => {
  const pedidoId = firstText(record.pedido_id);
  if (!pedidoId) {
    return { record };
  }
  const group = firstText(groupId, record.group_id, record.grupo_id);
  const empresa = firstText(empresaId, record.empresa_id);
  if (!group || !empresa) {
    const error = /** @type {TituloPolicyError} */ (new Error('Contexto de grupo e empresa obrigatorio para vincular pedido ao titulo.'));
    error.code = 'PEDIDO_VINCULO_CONTEXTO';
    throw error;
  }
  if (!pedido || !firstText(pedido.id)) {
    const error = /** @type {TituloPolicyError} */ (new Error('Pedido vinculado nao encontrado no contexto.'));
    error.code = 'PEDIDO_VINCULO_NAO_ENCONTRADO';
    throw error;
  }
  if (firstText(pedido.id) !== pedidoId) {
    const error = /** @type {TituloPolicyError} */ (new Error('Pedido vinculado diverge do titulo.'));
    error.code = 'PEDIDO_VINCULO_DIVERGENTE';
    throw error;
  }
  const pedidoGroup = firstText(pedido.group_id, pedido.grupo_id);
  const pedidoEmpresa = firstText(pedido.empresa_id);
  if (!pedidoEmpresa) {
    const error = /** @type {TituloPolicyError} */ (new Error('Pedido sem empresa nao pode vincular titulo.'));
    error.code = 'PEDIDO_VINCULO_SEM_EMPRESA';
    throw error;
  }
  if (pedidoEmpresa !== empresa) {
    const error = /** @type {TituloPolicyError} */ (new Error('Pedido de outra empresa bloqueado no titulo.'));
    error.code = 'PEDIDO_VINCULO_EMPRESA';
    throw error;
  }
  if (pedidoGroup && pedidoGroup !== group) {
    const error = /** @type {TituloPolicyError} */ (new Error('Pedido de outro grupo bloqueado no titulo.'));
    error.code = 'PEDIDO_VINCULO_GRUPO';
    throw error;
  }
  return {
    record: {
      ...record,
      origem_tipo: firstText(record.origem_tipo) || 'pedido',
      origem_documento_id: firstText(record.origem_documento_id) || pedidoId,
    },
  };
};

/** @param {TituloCreateOptions & { pedido?: FinanceRecord | null, groupId?: unknown, empresaId?: unknown }} options */
export const assertTituloOnCreate = ({ record = {}, titles = [], pedido = null, groupId, empresaId } = {}) => {
  if (isPendingManualReconciliation(record)) {
    throw new Error('Titulo pendente de conciliacao manual deve permanecer no staging.');
  }
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para titulo financeiro.');
  }
  const linked = assertPedidoVinculoTitulo({ record, pedido, groupId, empresaId });
  const nextRecord = linked.record;
  const duplicate = findDuplicateTitulo(nextRecord, titles);
  if (duplicate) return { reuse: duplicate, record: nextRecord };
  return {
    reuse: null,
    record: {
      ...nextRecord,
      origem_tipo: firstText(nextRecord.origem_tipo) || (nextRecord.pedido_id ? 'pedido' : 'manual'),
      idempotency_key: tituloIdempotencyKey(nextRecord) || undefined,
    },
  };
};

/** @param {TituloUpdateOptions} options */
export const assertTituloOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!before?.id) throw new Error('Titulo financeiro nao encontrado.');

  if (isPendingManualReconciliation(before) || isPendingManualReconciliation(patch)) {
    throw new Error('Titulo pendente de conciliacao manual nao pode ser alterado pelo fluxo operacional.');
  }

  const nextStatus = firstText(patch.status) || before.status;
  const becomingLiquidado = !isTituloLiquidado(before) && isTituloLiquidado({ status: nextStatus });
  const becomingEstorno = isTituloLiquidado(before) && isTituloEstorno({ status: nextStatus });
  const becomingConciliado = isTituloLiquidado(before)
    && !isTituloConciliado(before)
    && isTituloConciliado({ status: nextStatus })
    && !becomingEstorno;
  const retrySettlement = isTituloLiquidado(before)
    && Object.prototype.hasOwnProperty.call(patch, 'status')
    && isTituloLiquidado({ status: patch.status })
    && !becomingEstorno
    && !becomingConciliado;

  if (firstText(patch.empresa_id) && firstText(before.empresa_id) && firstText(patch.empresa_id) !== firstText(before.empresa_id)) {
    throw new Error('Pagamento deve pertencer a empresa correta.');
  }

  const frozenHit = FROZEN_AFTER_SETTLEMENT.some((field) => (
    field.startsWith('valor')
      ? moneyChanged(before, patch, field)
      : (
        linkCleared(before, patch, field)
        || (
          field !== 'empresa_id'
          && Object.prototype.hasOwnProperty.call(patch, field)
          && firstText(patch[field])
          && firstText(patch[field]) !== firstText(before[field])
        )
      )
  ));

  if (isTituloLiquidado(before) && frozenHit && !becomingEstorno) {
    throw new Error('Valores nao podem ser recalculados apos baixa.');
  }

  if (retrySettlement) {
    return { reuse: before, record: before, settlement: false, estorno: false, conciliation: false };
  }

  if (becomingEstorno) {
    return {
      reuse: null,
      settlement: false,
      estorno: true,
      conciliation: false,
      record: {
        ...patch,
        valor: before.valor,
        valor_total: before.valor_total ?? before.valor,
        valor_recebido: before.valor_recebido,
        valor_pago: before.valor_pago,
        pedido_id: before.pedido_id,
        nfe_id: before.nfe_id || before.nota_fiscal_id,
        empresa_id: before.empresa_id,
        status: 'Estornado',
        historico_eventos: [
          ...(Array.isArray(before.historico_eventos) ? before.historico_eventos : []),
          {
            acao: 'estorno',
            status_anterior: before.status,
            valor: before.valor,
            em: new Date().toISOString(),
          },
        ],
      },
    };
  }

  if (becomingConciliado) {
    return {
      reuse: null,
      settlement: false,
      estorno: false,
      conciliation: true,
      record: {
        ...patch,
        valor: before.valor,
        valor_total: before.valor_total ?? before.valor,
        valor_recebido: before.valor_recebido,
        valor_pago: before.valor_pago,
        pedido_id: before.pedido_id,
        nfe_id: before.nfe_id || before.nota_fiscal_id,
        empresa_id: before.empresa_id,
        status: 'Conciliado',
      },
    };
  }

  if (isTituloLiquidado(before) && normalizeTituloStatus(nextStatus) === 'cancelado') {
    throw new Error('Estorno deve preservar historico.');
  }

  return { reuse: null, record: patch, settlement: becomingLiquidado, estorno: false, conciliation: false };
};

/** @param {FinanceRecord} record */
export const assertTituloOnDelete = (record = {}) => {
  if (isTituloLiquidado(record) || isTituloEstorno(record)) {
    const error = /** @type {TituloPolicyError} */ (new Error('Nao excluir titulo liquidado.'));
    error.code = 'TITULO_LIQUIDADO';
    throw error;
  }
};

/**
 * Onda 6 — envio ao caixa: mesmo grupo/empresa, títulos com contexto e não liquidados.
 * @param {{ titulos?: FinanceRecord[], groupId?: unknown, empresaId?: unknown }} options
 */
export const assertTitulosProntosParaCaixa = ({ titulos = [], groupId, empresaId } = {}) => {
  const group = firstText(groupId);
  const empresa = firstText(empresaId);
  if (!group || !empresa) {
    const error = /** @type {TituloPolicyError} */ (new Error('Contexto de grupo e empresa obrigatorio para enviar ao caixa.'));
    error.code = 'CAIXA_CONTEXTO_OBRIGATORIO';
    throw error;
  }
  const rows = Array.isArray(titulos) ? titulos : [];
  if (rows.length === 0) {
    const error = /** @type {TituloPolicyError} */ (new Error('Selecione ao menos um titulo para o caixa.'));
    error.code = 'CAIXA_SEM_TITULOS';
    throw error;
  }
  for (const titulo of rows) {
    const tituloGroup = firstText(titulo.group_id, titulo.grupo_id);
    const tituloEmpresa = firstText(titulo.empresa_id);
    if (!tituloGroup || !tituloEmpresa) {
      const error = /** @type {TituloPolicyError} */ (new Error('Titulo sem group_id/empresa_id nao pode ir ao caixa.'));
      error.code = 'CAIXA_TITULO_SEM_CONTEXTO';
      throw error;
    }
    if (tituloGroup !== group || tituloEmpresa !== empresa) {
      const error = /** @type {TituloPolicyError} */ (new Error('Titulos de outro grupo/empresa bloqueados no envio ao caixa.'));
      error.code = 'CAIXA_CONTEXTO_DIVERGENTE';
      throw error;
    }
    if (isTituloLiquidado(titulo) || isTituloEstorno(titulo) || isTituloConciliado(titulo)) {
      const error = /** @type {TituloPolicyError} */ (new Error('Titulo ja liquidado/conciliado nao pode ser reenviado ao caixa.'));
      error.code = 'CAIXA_TITULO_JA_LIQUIDADO';
      throw error;
    }
  }
  return {
    groupId: group,
    empresaId: empresa,
    total: rows.reduce((sum, titulo) => sum + toMoney(titulo.valor || titulo.valor_total), 0),
    quantidade: rows.length,
  };
};
