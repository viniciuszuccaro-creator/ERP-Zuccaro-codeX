/**
 * Política de consulta do Histórico do Produto (cadastros).
 * HTTP: sem filterInContext Pedido/OP/Movimentação — não inventar zeros como “sem vendas”.
 * Legado/local: filterInContext permanece (capacidade existente).
 * Agregação por produto via API dedicada = gate futuro (não inventar facade).
 */
import { resolveErpBackendMode } from '../../api/runtimeBackend.js';

export function isHistoricoProdutoHttpMode(env) {
  return resolveErpBackendMode(env) === 'http';
}

/**
 * Consultas agregadas legado só fora de HTTP e com contexto/produto.
 * @param {{ produtoId?: string | null, contextoValido?: boolean, httpMode?: boolean }} [options]
 */
export function historicoProdutoLegadoConsultaEnabled({
  produtoId,
  contextoValido,
  httpMode = isHistoricoProdutoHttpMode(),
} = {}) {
  return Boolean(produtoId && contextoValido && !httpMode);
}

export function historicoProdutoHttpIndisponivelMessage() {
  return 'Agregados de pedidos/OP/movimentações por produto indisponíveis em HTTP até API dedicada. Não use zeros como “sem vendas”.';
}
