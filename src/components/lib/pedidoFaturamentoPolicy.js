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

/**
 * Snapshot de crédito para UI (Onda 4/6) — espelha CreditPort sem migration.
 * Prefer ClienteEmpresa.limite_credito (+ limite_utilizado); fallback condicao_comercial.
 * limite_credito null/ausente → null (não inventa; paridade porta ausente / snap null).
 *
 * @param {{
 *   clienteEmpresa?: Record<string, unknown> | null,
 *   cliente?: ClienteCreditoRecord | null,
 * }} [options]
 * @returns {{ limite_credito: number|string, limite_utilizado: number|string, fonte: string } | null}
 */
export const resolvePedidoCreditoSnapshot = ({
  clienteEmpresa = null,
  cliente = null,
} = {}) => {
  if (clienteEmpresa && typeof clienteEmpresa === 'object' && 'limite_credito' in clienteEmpresa) {
    const raw = clienteEmpresa.limite_credito;
    if (raw == null || raw === '') return null;
    const utilizado = clienteEmpresa.limite_utilizado ?? clienteEmpresa.limite_credito_utilizado ?? 0;
    return { limite_credito: raw, limite_utilizado: utilizado, fonte: 'cliente_empresa' };
  }
  const cond = cliente?.condicao_comercial;
  if (cond && typeof cond === 'object' && 'limite_credito' in cond) {
    const raw = cond.limite_credito;
    if (raw == null || raw === '') return null;
    return {
      limite_credito: raw,
      limite_utilizado: cond.limite_credito_utilizado ?? 0,
      fonte: 'cliente_condicao',
    };
  }
  return null;
};

/**
 * RBAC fail-closed para override de crédito (chave granular `aprovar-credito`).
 * @param {(module: string, section?: string|string[], action?: string) => boolean} [hasPermission]
 */
export const canAprovarCreditoPedido = (hasPermission) => {
  if (typeof hasPermission !== 'function') return false;
  return hasPermission('Comercial', 'pedido', 'aprovar-credito') === true;
};

/**
 * Gate UI fail-closed do Pedido (display + Salvar).
 * - Sem group/empresa: bloqueia.
 * - Sem cliente selecionado: idle (não bloqueia; payload exige cliente).
 * - Snapshot ausente (porta/campo null): status porta_ausente — não inventa; não bloqueia
 *   (paridade CreditPort null no tip; bloqueio real quando snapshot existir e reprovar).
 * - Snapshot presente e reprovado: bloqueia sem `aprovar-credito`.
 *
 * @param {{
 *   groupId?: string|null,
 *   empresaId?: string|null,
 *   clienteEmpresaId?: string|null,
 *   clienteId?: string|null,
 *   clienteEmpresa?: Record<string, unknown>|null,
 *   cliente?: ClienteCreditoRecord|null,
 *   valorPedido?: unknown,
 *   creditPortSnapshot?: { limite_credito: unknown, limite_utilizado?: unknown }|null,
 *   hasPermission?: Function,
 * }} [options]
 */
export const evaluatePedidoCreditoUiGate = ({
  groupId = null,
  empresaId = null,
  clienteEmpresaId = null,
  clienteId = null,
  clienteEmpresa = null,
  cliente = null,
  valorPedido = 0,
  creditPortSnapshot,
  hasPermission,
} = {}) => {
  const emptyEval = {
    aprovado: false,
    limite_total: 0,
    limite_utilizado: 0,
    limite_disponivel: 0,
    valor_pedido: toMoney(valorPedido),
    motivo: '',
  };
  if (!groupId || !empresaId) {
    return {
      canSave: false,
      blockSave: true,
      status: 'contexto',
      hint: 'Selecione grupo e empresa para validar crédito (fail-closed).',
      evaluation: { ...emptyEval, motivo: 'Contexto groupId/empresaId obrigatório' },
      snapshotFonte: null,
      canOverride: false,
    };
  }
  const canOverride = canAprovarCreditoPedido(hasPermission);
  if (!clienteEmpresaId) {
    return {
      canSave: true,
      blockSave: false,
      status: 'idle',
      hint: null,
      evaluation: null,
      snapshotFonte: null,
      canOverride,
    };
  }

  let snap = null;
  let snapshotFonte = null;
  if (creditPortSnapshot !== undefined) {
    if (creditPortSnapshot == null) {
      snap = null;
      snapshotFonte = 'credit_port';
    } else {
      snap = {
        limite_credito: creditPortSnapshot.limite_credito,
        limite_utilizado: creditPortSnapshot.limite_utilizado ?? 0,
        fonte: 'credit_port',
      };
      snapshotFonte = 'credit_port';
    }
  } else {
    snap = resolvePedidoCreditoSnapshot({ clienteEmpresa, cliente });
    snapshotFonte = snap?.fonte || null;
  }

  if (!snap) {
    // Porta/campo ausente: não inventa limite. Com creditPort explícito null → exige override.
    const portSaidMissing = creditPortSnapshot !== undefined && creditPortSnapshot == null;
    if (portSaidMissing && !canOverride) {
      return {
        canSave: false,
        blockSave: true,
        status: 'indisponivel',
        hint: 'Snapshot de crédito indisponível — exige permissão Comercial.pedido.aprovar-credito.',
        evaluation: {
          ...emptyEval,
          motivo: 'Credito ausente (CreditPort sem snapshot)',
        },
        snapshotFonte: 'credit_port',
        canOverride,
      };
    }
    if (portSaidMissing && canOverride) {
      return {
        canSave: true,
        blockSave: false,
        status: 'override',
        hint: 'Crédito ausente com alçada aprovar-credito — salvar permitido; servidor revalida.',
        evaluation: {
          ...emptyEval,
          aprovado: true,
          motivo: 'Credito ausente com alçada aprovar-credito',
        },
        snapshotFonte: 'credit_port',
        canOverride,
      };
    }
    return {
      canSave: true,
      blockSave: false,
      status: 'porta_ausente',
      hint: 'Snapshot de crédito não configurado no vínculo ClienteEmpresa — UI não inventa limite (fail-closed display).',
      evaluation: {
        ...emptyEval,
        motivo: 'Porta/snapshot de credito ausente (nao inventa)',
      },
      snapshotFonte: null,
      canOverride,
    };
  }

  const clienteParaEval = {
    id: clienteId || cliente?.id || clienteEmpresaId,
    condicao_comercial: {
      limite_credito: snap.limite_credito,
      limite_credito_utilizado: snap.limite_utilizado,
    },
  };
  const evaluation = evaluatePedidoCredito({
    pedido: {
      cliente_id: clienteId || cliente?.id || clienteEmpresaId,
      valor_total: valorPedido,
      limite_credito_override: false,
    },
    cliente: clienteParaEval,
    permitirOverride: canOverride,
  });

  if (evaluation.aprovado) {
    return {
      canSave: true,
      blockSave: false,
      status: 'aprovado',
      hint: null,
      evaluation,
      snapshotFonte,
      canOverride,
    };
  }

  if (canOverride) {
    return {
      canSave: true,
      blockSave: false,
      status: 'override',
      hint: `${evaluation.motivo || 'Crédito insuficiente'}; override aprovar-credito — servidor revalida.`,
      evaluation: { ...evaluation, aprovado: true, motivo: `${evaluation.motivo}; override aprovar-credito` },
      snapshotFonte,
      canOverride,
    };
  }

  return {
    canSave: false,
    blockSave: true,
    status: /sem limite/i.test(evaluation.motivo || '') ? 'sem_limite' : 'bloqueado',
    hint: `${evaluation.motivo || 'Crédito insuficiente'} — salvar bloqueado (fail-closed). Solicite Comercial.pedido.aprovar-credito ou ajuste o pedido.`,
    evaluation,
    snapshotFonte,
    canOverride,
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
