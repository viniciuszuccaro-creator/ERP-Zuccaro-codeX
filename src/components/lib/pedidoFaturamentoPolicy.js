const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

const notaAtiva = (nota = {}) => !/cancel/i.test(String(nota.status || ''));

export const remainingValorFaturar = ({ pedido = {}, notasExistentes = [] } = {}) => {
  const pedidoValor = toMoney(pedido.valor_total || pedido.valor_produtos);
  const pedidoId = String(pedido.id || '');
  const faturado = (Array.isArray(notasExistentes) ? notasExistentes : [])
    .filter((nota) => pedidoId && String(nota.pedido_id || '') === pedidoId && notaAtiva(nota))
    .reduce((sum, nota) => sum + toMoney(nota.valor_total || nota.valor_produtos), 0);
  return Math.max(0, toMoney(pedidoValor - faturado));
};

export const resolveStatusFaturamentoPedido = ({ pedido = {}, notasExistentes = [], notaNova = {} } = {}) => {
  const pedidoValor = toMoney(pedido.valor_total || pedido.valor_produtos);
  const faturado = pedidoValor - remainingValorFaturar({ pedido, notasExistentes }) + toMoney(notaNova.valor_total || notaNova.valor_produtos);
  if (faturado <= 0) return pedido.status || 'Aprovado';
  if (faturado + 0.009 < pedidoValor) return 'Faturado Parcial';
  return 'Faturado';
};

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
    const error = new Error('Faturamento acima do pedido bloqueado.');
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
