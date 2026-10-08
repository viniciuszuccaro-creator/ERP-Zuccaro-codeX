/** Página inicial por bloco (servidor pagina com *_limit/*_offset). */
export const CENTRAL360_BLOCK_PAGE_SIZE = 5;

export const INITIAL_CENTRAL360_BLOCK_LIMITS = {
  empresas: CENTRAL360_BLOCK_PAGE_SIZE,
  locais: CENTRAL360_BLOCK_PAGE_SIZE,
  obras: CENTRAL360_BLOCK_PAGE_SIZE,
  orcamentos: CENTRAL360_BLOCK_PAGE_SIZE,
  pedidos: CENTRAL360_BLOCK_PAGE_SIZE,
};

/**
 * Aumenta o limit de um bloco mantendo offset 0 (carregar mais desde o início).
 * @param {Record<string, number>} limits
 * @param {string} blockKey
 * @param {number} [pageSize]
 */
export function growCentral360BlockLimit(limits, blockKey, pageSize = CENTRAL360_BLOCK_PAGE_SIZE) {
  const current = Number(limits?.[blockKey]) || pageSize;
  return {
    ...limits,
    [blockKey]: current + pageSize,
  };
}

/**
 * Chave de escopo da paginação UI — se mudar, limits voltam ao inicial.
 * @param {{ clienteId?: unknown, groupId?: unknown, empresaId?: unknown, actorId?: unknown, sessionKey?: unknown }} input
 */
export function buildCentral360PaginationScopeKey(input = {}) {
  return [
    String(input.clienteId ?? '').trim() || 'sem-cliente',
    String(input.groupId ?? '').trim() || 'sem-grupo',
    String(input.empresaId ?? '').trim() || 'sem-empresa',
    String(input.actorId ?? '').trim() || 'sem-ator',
    String(input.sessionKey ?? '').trim() || 'sem-sessao',
  ].join('|');
}

/**
 * @param {string} prevScope
 * @param {string} nextScope
 * @param {Record<string, number>} limits
 */
export function resolveCentral360LimitsForScope(prevScope, nextScope, limits) {
  if (!nextScope || prevScope !== nextScope) {
    return { scopeKey: nextScope, limits: { ...INITIAL_CENTRAL360_BLOCK_LIMITS } };
  }
  return { scopeKey: nextScope, limits };
}
