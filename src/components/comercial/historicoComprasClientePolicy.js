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
 * Unidade comprovada da linha — nunca inventar "UN" quando ausente.
 * HTTP: unidade_sigla; legado: unidade / unidade_medida.
 * @returns {string|null}
 */
export function resolveUnidadeItemHistorico(item) {
  if (!item || typeof item !== "object") return null;
  for (const key of ["unidade_sigla", "unidade", "unidade_medida", "sigla_unidade"]) {
    const raw = item[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * Data do pedido para último preço — não depender da ordem do loop.
 * HTTP canônico: `created_at`; legado: `data_pedido` / `created_date`.
 */
export function resolveDataPedidoHistorico(pedido) {
  if (!pedido || typeof pedido !== "object") return null;
  const raw = pedido.data_pedido || pedido.created_date || pedido.created_at || null;
  if (raw == null || raw === "") return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? raw : null;
}

/**
 * Preço unitário comprovado — zero válido (≠ ausente/inválido).
 * @returns {number|null} null = desconhecido; 0 = comprovado zero
 */
export function resolvePrecoUnitarioComprovado(item) {
  if (!item || typeof item !== "object") return null;
  if (item.preco_unitario == null || item.preco_unitario === "") return null;
  const preco = Number(item.preco_unitario);
  if (!Number.isFinite(preco) || preco < 0) return null;
  return preco;
}

function isDataPedidoNewer(candidate, current) {
  if (!candidate) return false;
  if (!current) return true;
  return new Date(candidate).getTime() > new Date(current).getTime();
}

/**
 * Consolida top produtos a partir da página de pedidos confirmada.
 * - Unidade comprovada por linha; KG ≠ UN; sem inventar UN.
 * - Quantidades de unidades distintas NÃO somam (chave produto+unidade).
 * - Último preço pela data do pedido mais recente (inclui `created_at` HTTP).
 * - Preço zero comprovado vence preço antigo positivo (Codex P2).
 * - `limit: null` = sem corte (Sugestões ordena por frequência depois).
 * Não inventa zeros quando a consulta falhou — o chamador só invoca com dados ok.
 */
export function consolidateTopProdutosFromPedidos(pedidos, { limit = 5 } = {}) {
  const produtosConsolidados = {};
  for (const pedido of Array.isArray(pedidos) ? pedidos : []) {
    const dataPedido = resolveDataPedidoHistorico(pedido);
    for (const item of extractItensPedidoHistorico(pedido)) {
      const produtoId = item.produto_id || item.produtoId || item.descricao || item.nome;
      if (!produtoId) continue;
      const unidade = resolveUnidadeItemHistorico(item);
      // Escopo por unidade comprovada (ou ausência explícita) — não misturar KG+PC.
      const key = `${produtoId}::${unidade ?? ""}`;
      if (!produtosConsolidados[key]) {
        produtosConsolidados[key] = {
          produto_id: item.produto_id || item.produtoId || null,
          descricao: item.descricao || item.nome || "Produto",
          codigo_sku: item.codigo_sku || item.sku || item.codigo || "",
          quantidade_total: 0,
          valor_total: 0,
          frequencia: 0,
          ultimo_preco: null, // null = desconhecido (≠ inventar 0)
          unidade: unidade, // null = indisponível (≠ inventar UN)
          ultima_compra: null,
        };
      }
      const acc = produtosConsolidados[key];
      const qty = Number(item.quantidade) || 0;
      const valorItem = resolveValorItemHistorico(item);
      acc.quantidade_total += qty;
      acc.valor_total += valorItem;
      acc.frequencia += 1;

      const preco = resolvePrecoUnitarioComprovado(item);
      if (preco != null && isDataPedidoNewer(dataPedido, acc.ultima_compra)) {
        acc.ultimo_preco = preco;
        acc.ultima_compra = dataPedido;
      } else if (preco != null && !acc.ultima_compra && acc.ultimo_preco == null) {
        // Sem data comprovada: só preenche se ainda desconhecido (não sobrescrever).
        acc.ultimo_preco = preco;
      }
    }
  }
  const ranked = Object.values(produtosConsolidados)
    .sort((a, b) => b.valor_total - a.valor_total);
  if (limit == null) return ranked;
  return ranked.slice(0, limit);
}

/**
 * Seed do modal canônico AdicionarItemRevenda a partir do histórico/sugestão.
 * Só campos comprovados; frequência/qty histórica ≠ demanda; ausente ≠ inventar UN/zero.
 * @returns {object|null}
 */
export function seedProdutoFromHistorico(produto) {
  const produtoId = produto?.id || produto?.produto_id || null;
  if (!produtoId) return null;
  const seed = {
    id: produtoId,
    codigo: produto.codigo || produto.codigo_sku || null,
    descricao: produto.descricao || "",
  };
  const unidade = produto.unidade_medida || produto.unidade_sigla || produto.unidade || null;
  if (unidade) {
    seed.unidade_medida = unidade;
    seed.unidade_sigla = unidade;
  }
  const precoRaw = produto.preco_venda ?? produto.ultimo_preco;
  if (precoRaw != null && precoRaw !== "") {
    const preco = Number(precoRaw);
    if (Number.isFinite(preco)) seed.preco_venda = preco; // zero comprovado ok
  }
  return seed;
}
