/**
 * Política UI Produto HTTP (Onda 3) — seletor de itens em Orçamento/Pedido.
 * Reutiliza API R03 já existente; sem migration; sem cadastro paralelo.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de Produto exige visualizar Cadastros.produto
 * OU visualizar Comercial (orçamento/pedido) — o seletor some sem permissão.
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadProdutosHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'produto', 'visualizar')
    || hasPermission('Cadastros', 'Produto', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Normaliza envelope list HTTP (`{ data, meta }` ou array) para linhas ativas.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeProdutosListPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && row.ativo !== false);
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.filter((row) => row && row.ativo !== false);
  }
  return [];
}

/**
 * Label comercial estável a partir do mestre Produto (sem inventar dados).
 * @param {object | null | undefined} produto
 * @param {string} [fallback]
 */
export function buildProdutoDisplayLabel(produto, fallback = '') {
  if (!produto || typeof produto !== 'object') return fallback || '';
  const nome = produto.descricao || produto.nome || '';
  const codigo = produto.codigo ? String(produto.codigo) : '';
  if (codigo && nome) return `${codigo} - ${nome}`;
  return nome || codigo || fallback || '';
}

/**
 * Garante que o Produto ecoa tenant quando o servidor enviar ids.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, empresaId?: string }} scope
 */
export function assertProdutoNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('Produto inválido.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('Produto fora do grupo ativo.');
  }
  if (row.empresa_id && row.empresa_id !== scope.empresaId) {
    throw new Error('Produto fora da empresa ativa.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de produto inválido.');
  }
  return row;
}
