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
