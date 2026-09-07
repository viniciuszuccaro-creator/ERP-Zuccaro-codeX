const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

export const TITULO_FINANCEIRO_ENTITIES = ['ContaReceber', 'ContaPagar'];

const LIQUIDADO = new Set(['recebido', 'pago', 'liquidado', 'baixado']);
const ESTORNO = new Set(['estornado']);
const FROZEN_AFTER_SETTLEMENT = [
  'valor',
  'valor_total',
  'valor_original',
  'pedido_id',
  'nfe_id',
  'nota_fiscal_id',
  'nota_id',
  'cliente_id',
  'fornecedor_id',
  'empresa_id',
];

export const isTituloFinanceiroEntity = (entityName) => TITULO_FINANCEIRO_ENTITIES.includes(entityName);

export const normalizeTituloStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const isTituloLiquidado = (record = {}) => LIQUIDADO.has(normalizeTituloStatus(record.status));

export const isTituloEstorno = (record = {}) => ESTORNO.has(normalizeTituloStatus(record.status));

export const tituloSettlementAction = (entityName) => (entityName === 'ContaPagar' ? 'pagar' : 'receber');

export const parcelaKey = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : '';
};

export const tituloIdempotencyKey = (record = {}) => {
  const explicit = firstText(record.idempotency_key);
  if (explicit) return explicit;
  const pedido = firstText(record.pedido_id, record.origem_documento_id);
  const parcela = parcelaKey(record.numero_parcela);
  if (!pedido) return '';
  return ['titulo', firstText(record.origem_tipo) || 'pedido', pedido, parcela].join('|');
};

export const findDuplicateTitulo = (record = {}, titles = []) => {
  const key = tituloIdempotencyKey(record);
  if (!key) return null;
  return (Array.isArray(titles) ? titles : []).find((item) => tituloIdempotencyKey(item) === key) || null;
};

const linkCleared = (before, patch, field) => {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
  const previous = firstText(before[field]);
  const next = firstText(patch[field]);
  return Boolean(previous) && !next;
};

const moneyChanged = (before, patch, field) => {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
  if (patch[field] === undefined || patch[field] === null || patch[field] === '') return false;
  return Math.abs(toMoney(before[field]) - toMoney(patch[field])) > 0.009;
};

export const assertTituloOnCreate = ({ record = {}, titles = [] } = {}) => {
  if (!firstText(record.empresa_id)) {
    throw new Error('Empresa obrigatoria para titulo financeiro.');
  }
  const duplicate = findDuplicateTitulo(record, titles);
  if (duplicate) return { reuse: duplicate, record };
  return {
    reuse: null,
    record: {
      ...record,
      origem_tipo: firstText(record.origem_tipo) || (record.pedido_id ? 'pedido' : 'manual'),
      idempotency_key: tituloIdempotencyKey(record) || undefined,
    },
  };
};

export const assertTituloOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!before?.id) throw new Error('Titulo financeiro nao encontrado.');

  const nextStatus = firstText(patch.status) || before.status;
  const becomingLiquidado = !isTituloLiquidado(before) && isTituloLiquidado({ status: nextStatus });
  const becomingEstorno = isTituloLiquidado(before) && isTituloEstorno({ status: nextStatus });
  const retrySettlement = isTituloLiquidado(before)
    && Object.prototype.hasOwnProperty.call(patch, 'status')
    && isTituloLiquidado({ status: patch.status })
    && !becomingEstorno;

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
    return { reuse: before, record: before, settlement: false, estorno: false };
  }

  if (becomingEstorno) {
    return {
      reuse: null,
      settlement: false,
      estorno: true,
      record: {
        ...patch,
        valor: before.valor,
        valor_total: before.valor_total ?? before.valor,
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

  if (isTituloLiquidado(before) && normalizeTituloStatus(nextStatus) === 'cancelado') {
    throw new Error('Estorno deve preservar historico.');
  }

  return { reuse: null, record: patch, settlement: becomingLiquidado, estorno: false };
};

export const assertTituloOnDelete = (record = {}) => {
  if (isTituloLiquidado(record) || isTituloEstorno(record)) {
    const error = new Error('Nao excluir titulo liquidado.');
    error.code = 'TITULO_LIQUIDADO';
    throw error;
  }
};
