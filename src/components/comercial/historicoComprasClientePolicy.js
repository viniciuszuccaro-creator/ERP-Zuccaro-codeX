/** Linhas de produto: legado `itens_*` + canônico HTTP `itens`. */
export function extractItensPedidoHistorico(pedido) {
  if (!pedido || typeof pedido !== "object") return [];
  const buckets = [
    pedido.itens,
    pedido.itens_revenda,
    pedido.itens_producao,
    pedido.itens_servico,
  ];
  const out = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (item && typeof item === "object") out.push(item);
    }
  }
  return out;
}

/**
 * Canal comprovado — HTTP Pedido não expõe origem_pedido/origem no contrato.
 * Nunca inventar "Manual" quando o campo está ausente.
 * @returns {string|null}
 */
export function resolveOrigemCanalComprovada(pedido) {
  if (!pedido || typeof pedido !== "object") return null;
  for (const key of ["origem_pedido", "origem", "canal_origem", "origemPedido"]) {
    const raw = pedido[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * Valor monetário do pedido: HTTP canônico `total`; legado `valor_total`.
 */
export function resolveValorPedidoHistorico(pedido) {
  if (!pedido || typeof pedido !== "object") return 0;
  const n = Number(pedido.total ?? pedido.valor_total);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Valor efetivo da linha: HTTP `item.total` (líquido) antes de bruto/fallback.
 */
export function resolveValorItemHistorico(item) {
  if (!item || typeof item !== "object") return 0;
  const qty = Number(item.quantidade) || 0;
  const n = Number(
    item.total
      ?? item.valor_item
      ?? item.valor_total
      ?? item.preco_venda_total
      ?? ((Number(item.preco_unitario) || 0) * qty),
  );
  return Number.isFinite(n) ? n : 0;
}

/**
 * Consolida top produtos a partir da página de pedidos confirmada.
 * Não inventa zeros quando a consulta falhou — o chamador só invoca com dados ok.
 */
export function consolidateTopProdutosFromPedidos(pedidos, { limit = 5 } = {}) {
  const produtosConsolidados = {};
  for (const pedido of Array.isArray(pedidos) ? pedidos : []) {
    for (const item of extractItensPedidoHistorico(pedido)) {
      const key = item.produto_id || item.produtoId || item.descricao || item.nome;
      if (!key) continue;
      if (!produtosConsolidados[key]) {
        produtosConsolidados[key] = {
          produto_id: item.produto_id || item.produtoId || null,
          descricao: item.descricao || item.nome || "Produto",
          codigo_sku: item.codigo_sku || item.sku || item.codigo || "",
          quantidade_total: 0,
          valor_total: 0,
          frequencia: 0,
          ultimo_preco: 0,
        };
      }
      const qty = Number(item.quantidade) || 0;
      const valorItem = resolveValorItemHistorico(item);
      produtosConsolidados[key].quantidade_total += qty;
      produtosConsolidados[key].valor_total += valorItem;
      produtosConsolidados[key].frequencia += 1;
      produtosConsolidados[key].ultimo_preco =
        Number(item.preco_unitario) || produtosConsolidados[key].ultimo_preco;
    }
  }
  return Object.values(produtosConsolidados)
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit);
}
