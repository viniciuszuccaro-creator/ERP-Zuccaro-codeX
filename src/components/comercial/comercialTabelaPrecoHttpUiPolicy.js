/**
 * Política UI TabelaPreco HTTP (Onda 2) — lista/resolve nas telas canônicas.
 * Persistência canônica: `tabela_preco_id` no Pedido; preço de item no servidor.
 * Preview de preço no formulário é só em memória (sem migration de snapshot).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de tabelas exige visualizar Cadastros.tabela_preco
 * OU visualizar Comercial (orçamento/pedido) — o seletor some sem permissão.
 */
export function canLoadTabelasPrecoHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'tabela_preco', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Normaliza envelope list HTTP (`{ data, meta }` ou array) para linhas ativas.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeTabelasListPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && row.ativo !== false);
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.filter((row) => row && row.ativo !== false);
  }
  return [];
}

/**
 * Aplica resolução de preço fail-closed no item do formulário (só `preco_unitario`).
 * @param {object} item
 * @param {{ tabela_preco_id?: string, preco?: string, origem_resolucao?: string } | null | undefined} resolved
 * @returns {{ item: object, applied: boolean, preview: object | null }}
 */
export function applyResolvedPrecoToItem(item, resolved) {
  const base = item && typeof item === 'object' ? { ...item } : {};
  if (!resolved?.tabela_preco_id || !UUID_RE.test(resolved.tabela_preco_id)) {
    return { item: base, applied: false, preview: null };
  }
  if (resolved.preco == null || resolved.preco === '') {
    return { item: base, applied: false, preview: null };
  }
  return {
    item: { ...base, preco_unitario: String(resolved.preco) },
    applied: true,
    preview: {
      tabela_preco_id: resolved.tabela_preco_id,
      tabela_preco_codigo: resolved.tabela_preco_codigo || null,
      tabela_preco_nome: resolved.tabela_preco_nome || null,
      origem_resolucao: resolved.origem_resolucao || null,
      preco: String(resolved.preco),
    },
  };
}

/**
 * Sugere `tabela_preco_id` no formulário a partir do preço resolvido (memória).
 * Não inventa id: só ecoa o id canônico do servidor.
 * @param {object} form
 * @param {{ tabela_preco_id?: string } | null | undefined} resolved
 */
export function applyResolvedTabelaToForm(form, resolved) {
  const base = form && typeof form === 'object' ? { ...form } : {};
  if (!resolved?.tabela_preco_id || !UUID_RE.test(resolved.tabela_preco_id)) {
    return { form: base, applied: false };
  }
  return {
    form: { ...base, tabela_preco_id: resolved.tabela_preco_id },
    applied: true,
  };
}

/**
 * Garante que o preço resolvido ecoa tenant quando o servidor enviar ids.
 * @param {object | null | undefined} resolved
 * @param {{ groupId?: string, empresaId?: string }} scope
 */
export function assertPrecoResolucaoNoContexto(resolved, scope) {
  if (resolved == null) return null;
  if (typeof resolved !== 'object') {
    throw new Error('Resolução de preço inválida.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  if (resolved.group_id && resolved.group_id !== scope.groupId) {
    throw new Error('Preço resolvido fora do grupo ativo.');
  }
  if (resolved.empresa_id && resolved.empresa_id !== scope.empresaId) {
    throw new Error('Preço resolvido fora da empresa ativa.');
  }
  return resolved;
}
