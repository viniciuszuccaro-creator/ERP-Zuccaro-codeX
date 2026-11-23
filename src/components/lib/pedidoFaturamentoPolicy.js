/**
 * @typedef {Record<string, unknown> & {
 *   id?: string | number,
 *   pedido_id?: unknown,
 *   valor_total?: unknown,
 *   valor_produtos?: unknown,
 *   status?: unknown,
 *   cliente_id?: unknown,
 *   limite_credito_override?: boolean,
 *   limite_credito_justificativa?: unknown,
 * }} PedidoFaturamentoRecord
 * @typedef {Record<string, unknown> & {
 *   condicao_comercial?: {
 *     limite_credito?: unknown,
 *     limite_credito_utilizado?: unknown,
 *   } & Record<string, unknown>,
 * }} ClienteCreditoRecord
 * @typedef {Record<string, unknown> & {
 *   tipo_movimento?: unknown,
 *   origem_documento_id?: unknown,
 *   produto_id?: unknown,
 * }} MovimentoPedidoRecord
 * @typedef {{ pedido?: PedidoFaturamentoRecord, notasExistentes?: PedidoFaturamentoRecord[] }} FaturamentoLeituraOptions
 * @typedef {{ pedido?: PedidoFaturamentoRecord, notasExistentes?: PedidoFaturamentoRecord[], notaNova?: PedidoFaturamentoRecord }} FaturamentoOptions
 * @typedef {{ pedido?: PedidoFaturamentoRecord, cliente?: ClienteCreditoRecord | null, permitirOverride?: boolean }} PedidoCreditoOptions
 * @typedef {{ movimentos?: MovimentoPedidoRecord[], pedidoId?: unknown, produtoId?: unknown }} MovimentoPedidoOptions
 * @typedef {Error & { code?: string, restante?: number }} FaturamentoError
 */

/** @param {unknown} value */
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

/** @param {PedidoFaturamentoRecord} nota */
const notaAtiva = (nota = {}) => !/cancel/i.test(String(nota.status || ''));

/** @param {FaturamentoLeituraOptions} options */
export const remainingValorFaturar = ({ pedido = {}, notasExistentes = [] } = {}) => {
  const pedidoValor = toMoney(pedido.valor_total || pedido.valor_produtos);
  const pedidoId = String(pedido.id || '');
  const faturado = (Array.isArray(notasExistentes) ? notasExistentes : [])
    .filter((nota) => pedidoId && String(nota.pedido_id || '') === pedidoId && notaAtiva(nota))
    .reduce((sum, nota) => sum + toMoney(nota.valor_total || nota.valor_produtos), 0);
  return Math.max(0, toMoney(pedidoValor - faturado));
};

/** @param {FaturamentoOptions} options */
export const resolveStatusFaturamentoPedido = ({ pedido = {}, notasExistentes = [], notaNova = {} } = {}) => {
  const pedidoValor = toMoney(pedido.valor_total || pedido.valor_produtos);
  const faturado = pedidoValor - remainingValorFaturar({ pedido, notasExistentes }) + toMoney(notaNova.valor_total || notaNova.valor_produtos);
  if (faturado <= 0) return pedido.status || 'Aprovado';
  if (faturado + 0.009 < pedidoValor) return 'Faturado Parcial';
  return 'Faturado';
};

/** @param {FaturamentoOptions} options */
export const assertFaturamentoDentroDoPedido = ({ pedido, notasExistentes = [], notaNova = {} } = {}) => {
  if (!pedido?.id && !pedido?.valor_total && !pedido?.valor_produtos) {
    throw new Error('Pedido obrigatorio para faturar.');
  }
  const restante = remainingValorFaturar({ pedido, notasExistentes });
  const novoValor = toMoney(notaNova.valor_total || notaNova.valor_produtos);
  if (novoValor <= 0) {
    throw new Error('Valor de faturamento invalido.');
  }
  if (novoValor > restante + 0.009) {
    const error = /** @type {FaturamentoError} */ (new Error('Faturamento acima do pedido bloqueado.'));
    error.code = 'FATURAMENTO_ACIMA_PEDIDO';
    error.restante = restante;
    throw error;
  }
  return {
    restante,
    status: resolveStatusFaturamentoPedido({ pedido, notasExistentes, notaNova }),
  };
};

/** Credito do pedido: fail-closed sem cliente, sem limite ou sem alçada de override. */
/** @param {PedidoCreditoOptions} options */
export const evaluatePedidoCredito = ({
  pedido = {},
  cliente = null,
  permitirOverride = false,
} = {}) => {
  if (!pedido?.cliente_id) {
    return { aprovado: false, motivo: 'Cliente obrigatorio para validar credito' };
  }
  if (!cliente) {
    return { aprovado: false, motivo: 'Cliente nao encontrado' };
  }

  const limiteTotal = Number(cliente.condicao_comercial?.limite_credito || 0);
  const limiteUtilizado = Number(cliente.condicao_comercial?.limite_credito_utilizado || 0);
  const limiteDisponivel = limiteTotal - limiteUtilizado;
  const valorPedido = toMoney(pedido.valor_total || pedido.valor_produtos);

  if (pedido.limite_credito_override) {
    if (!permitirOverride || !String(pedido.limite_credito_justificativa || '').trim()) {
      return {
        aprovado: false,
        limite_total: limiteTotal,
        limite_utilizado: limiteUtilizado,
        limite_disponivel: limiteDisponivel,
        valor_pedido: valorPedido,
        motivo: 'Override de credito sem alcada ou justificativa',
      };
    }
    return {
      aprovado: true,
      limite_total: limiteTotal,
      limite_utilizado: limiteUtilizado,
      limite_disponivel: limiteDisponivel,
      valor_pedido: valorPedido,
      motivo: `Override aprovado: ${pedido.limite_credito_justificativa}`,
    };
  }

  if (limiteTotal <= 0) {
    return {
      aprovado: false,
      limite_total: limiteTotal,
      limite_utilizado: limiteUtilizado,
      limite_disponivel: limiteDisponivel,
      valor_pedido: valorPedido,
      motivo: 'Cliente sem limite de credito cadastrado',
    };
  }

  const aprovado = valorPedido <= limiteDisponivel + 0.009;
  return {
    aprovado,
    limite_total: limiteTotal,
    limite_utilizado: limiteUtilizado,
    limite_disponivel: limiteDisponivel,
    valor_pedido: valorPedido,
    motivo: aprovado ? 'Credito aprovado' : 'Limite insuficiente',
  };
};

/** Idempotencia: ja existe saida/liberacao de reserva do pedido para o produto. */
/** @param {MovimentoPedidoOptions} options */
export const pedidoJaTemSaidaEstoque = ({ movimentos = [], pedidoId, produtoId } = {}) => {
  const pid = String(pedidoId || '');
  const prod = String(produtoId || '');
  if (!pid || !prod) return false;
  return (Array.isArray(movimentos) ? movimentos : []).some((mov) => {
    const tipo = String(mov?.tipo_movimento || '').toLowerCase();
    const isSaida = tipo === 'saida' || tipo === 'liberacao_reserva' || tipo === 'liberação_reserva';
    return isSaida
      && String(mov?.origem_documento_id || '') === pid
      && String(mov?.produto_id || '') === prod;
  });
};

/** @param {MovimentoPedidoOptions} options */
export const pedidoJaTemReservaEstoque = ({ movimentos = [], pedidoId, produtoId } = {}) => {
  const pid = String(pedidoId || '');
  const prod = String(produtoId || '');
  if (!pid || !prod) return false;
  return (Array.isArray(movimentos) ? movimentos : []).some((mov) => (
    String(mov?.tipo_movimento || '').toLowerCase() === 'reserva'
    && String(mov?.origem_documento_id || '') === pid
    && String(mov?.produto_id || '') === prod
  ));
};

/**
 * Fixtures sintéticas do contrato §7 (DEV). Não inventar quitação na HML.
 * @type {ReadonlyArray<{ readonly parcela: number, readonly data_vencimento: string, readonly valor: string, readonly valor_recebido: string, readonly saldo: string }>}
 */
export const SYNTHETIC_PEDIDO_TITULOS = Object.freeze([
  Object.freeze({ parcela: 1, data_vencimento: '2026-12-01', valor: '100.00', valor_recebido: '40.00', saldo: '60.00' }),
  Object.freeze({ parcela: 2, data_vencimento: '2027-01-01', valor: '100.00', valor_recebido: '0.00', saldo: '100.00' }),
  Object.freeze({ parcela: 3, data_vencimento: '2027-02-01', valor: '50.00', valor_recebido: '50.00', saldo: '0.00' }),
]);

/**
 * Situação canônica a partir dos valores do servidor (strings decimais ou number).
 * Parcial: recebido > 0 e saldo > 0. Quitado: saldo === 0. Pendente: recebido === 0.
 * @param {{ valor_recebido?: unknown, saldo?: unknown, valor?: unknown }} titulo
 * @returns {'pendente' | 'parcial' | 'quitado' | 'indisponivel'}
 */
export function classifyTituloSituacao(titulo = {}) {
  const missing = (v) => v === null || v === undefined || v === '';
  if (missing(titulo.saldo) && (missing(titulo.valor) || missing(titulo.valor_recebido))) {
    return 'indisponivel';
  }
  const saldo = missing(titulo.saldo)
    ? Number(titulo.valor) - Number(titulo.valor_recebido)
    : Number(titulo.saldo);
  const recebido = missing(titulo.valor_recebido) ? NaN : Number(titulo.valor_recebido);
  if (!Number.isFinite(saldo)) return 'indisponivel';
  if (saldo <= 0) return 'quitado';
  if (Number.isFinite(recebido) && recebido > 0) return 'parcial';
  return 'pendente';
}

/**
 * Formata valor monetário do contrato (string decimal) sem alterar casas.
 * @param {unknown} value
 * @returns {string}
 */
export function formatContratoDecimal(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Evento estável de baixa — reutilizar no retry (não gerar outro id).
 * @param {{ pedidoId?: unknown, parcela?: unknown, attemptKey?: unknown }} options
 * @returns {string}
 */
export function buildPedidoTituloBaixaEvento({ pedidoId, parcela, attemptKey } = {}) {
  const pedido = String(pedidoId || '').trim();
  const part = String(parcela || '').trim();
  const key = String(attemptKey || '').trim() || 'attempt';
  const raw = `pedido.${pedido}.parcela.${part}.${key}`;
  return raw.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);
}

/**
 * Mensagem fail-closed para erros do contrato §7.
 * @param {unknown} error
 * @returns {{ code: string, message: string, status?: number }}
 */
export function mapPedidoFinanceiroHttpError(error) {
  const status = error && typeof error === 'object' && 'status' in error
    ? Number(/** @type {{ status?: unknown }} */ (error).status)
    : undefined;
  const code = error && typeof error === 'object' && typeof /** @type {{ code?: unknown }} */ (error).code === 'string'
    ? /** @type {{ code: string }} */ (error).code
    : 'HTTP_ERROR';
  /** @type {Record<string, string>} */
  const byCode = {
    AUTH_REQUIRED: 'Sessão expirada. Faça login novamente.',
    EMPRESA_REQUIRED: 'Selecione a empresa antes de faturar ou baixar.',
    PEDIDO_INVALIDO: 'Pedido inválido para operação financeira.',
    PEDIDO_NAO_ENCONTRADO: 'Pedido não encontrado neste contexto.',
    PEDIDO_NAO_FATURAVEL: 'Pedido ainda não está pronto para faturar.',
    FATURAMENTO_VINCULOS_OBRIGATORIOS: 'Informe centro de custo e plano de contas.',
    FATURAMENTO_VINCULOS_DIVERGENTES: 'Vínculos divergentes do faturamento já gravado (conflito).',
    FATURAMENTO_VINCULO_FORA_DA_EMPRESA: 'Centro ou plano fora da empresa selecionada.',
    TITULO_NAO_ENCONTRADO: 'Nenhum título encontrado para este pedido.',
    RECEBIMENTO_INVALIDO: 'Dados de baixa inválidos (parcela, evento ou valor).',
    RECEBIMENTO_EVENTO_DIVERGENTE: 'Mesmo evento com valor diferente (conflito).',
    RECEBIMENTO_EXCEDE_SALDO: 'Valor excede o saldo do título.',
    FINANCEIRO_SCHEMA_INVALIDO: 'Financeiro indisponível neste ambiente (schema).',
  };
  if (byCode[code]) return { code, message: byCode[code], status };
  if (status === 401) return { code, message: 'Acesso não autenticado.', status };
  if (status === 403) return { code, message: 'Sem permissão para esta operação financeira.', status };
  if (status === 404) return { code, message: 'Recurso financeiro não disponível neste ambiente.', status };
  if (status === 409) return { code, message: 'Conflito na operação financeira.', status };
  if (status === 422) return { code, message: 'Dados rejeitados pelo contrato financeiro.', status };
  if (status === 503) return { code, message: 'Financeiro temporariamente indisponível.', status };
  return { code, message: 'Falha na operação financeira do pedido.', status };
}
