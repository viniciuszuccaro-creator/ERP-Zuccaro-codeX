/** Cache/invalidation key: Grupo + Empresa + ator + sessão (sem token). */
export function buildCalcularComissoesInvalidateKey(input) {
  return [
    'comissoes',
    input?.groupId || null,
    input?.empresaId || null,
    input?.actorId || null,
    input?.sessionKey || null,
  ];
}

export function isCalcularComissoesScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/** Filtra pedidos elegíveis no período (contrato legado de status). */
export function filtrarPedidosPeriodoComissao(pedidos, dataInicio, dataFim) {
  const rows = Array.isArray(pedidos) ? pedidos : [];
  const inicio = dataInicio instanceof Date ? dataInicio : new Date(dataInicio);
  const fim = dataFim instanceof Date ? dataFim : new Date(dataFim);
  return rows.filter((p) => {
    if (p?.status !== 'Aprovado' && p?.status !== 'Faturado' && p?.status !== 'Entregue') return false;
    const dataPedido = new Date(p.data_pedido);
    return dataPedido >= inicio && dataPedido <= fim;
  });
}

/** Agrupa totais por vendedor (percentual padrão 5%). */
export function agruparComissoesPorVendedor(pedidosPeriodo, percentual = 5) {
  const map = {};
  for (const pedido of Array.isArray(pedidosPeriodo) ? pedidosPeriodo : []) {
    const vendedor = pedido?.vendedor || 'Sem Vendedor';
    if (!map[vendedor]) {
      map[vendedor] = {
        vendedor,
        vendedor_id: pedido?.vendedor_id,
        pedidos: [],
        total_vendas: 0,
      };
    }
    map[vendedor].pedidos.push(pedido);
    map[vendedor].total_vendas += pedido?.valor_total || 0;
  }
  const pct = Number(percentual) || 0;
  return Object.values(map).map((dados) => ({
    ...dados,
    percentual_comissao: pct,
    valor_comissao: dados.total_vendas * (pct / 100),
  }));
}
