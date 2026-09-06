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
