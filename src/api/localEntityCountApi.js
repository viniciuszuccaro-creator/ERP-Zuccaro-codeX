/** @typedef {Record<string, unknown>} LocalRecord */
/** @typedef {string | { entityName?: unknown, name?: unknown, filter?: LocalRecord }} CountEntityItem */

const BLOCKED_ENTITY_NAMES = new Set(['__proto__', 'prototype', 'constructor']);
const ENTITY_NAME_PATTERN = /^[A-Z][A-Za-z0-9]{0,79}$/;

/** @param {unknown} value */
export const normalizeCountEntityName = (value) => {
  const entityName = String(value || '').trim();
  if (!entityName) return '';
  if (BLOCKED_ENTITY_NAMES.has(entityName) || !ENTITY_NAME_PATTERN.test(entityName)) {
    throw new Error('Nome de entidade invalido para contagem local.');
  }
  return entityName;
};

/**
 * Executa contagem unica ou multipla aplicando o filtro contextual antes da
 * leitura. A consulta concreta permanece na API de entidades existente.
 * @param {{
 *   entityName?: unknown,
 *   filter?: LocalRecord,
 *   entities?: CountEntityItem[],
 * }} payload
 * @param {{
 *   expandFilter: (entityName: string, filter: LocalRecord) => LocalRecord,
 *   countEntity: (entityName: string, filter: LocalRecord) => Promise<number>,
 * }} dependencies
 * @returns {Promise<{ data: LocalRecord }>}
 */
export const runLocalEntityCounts = async (payload = {}, dependencies) => {
  const singleEntityName = normalizeCountEntityName(payload.entityName);
  if (singleEntityName) {
    const filter = dependencies.expandFilter(singleEntityName, payload.filter || {});
    const count = await dependencies.countEntity(singleEntityName, filter);
    return {
      data: {
        count,
        counts: { [singleEntityName]: count },
        [singleEntityName]: count,
      },
    };
  }

  const entitiesList = Array.isArray(payload.entities) ? payload.entities : [];
  const counts = /** @type {Record<string, number>} */ ({});
  for (const item of entitiesList) {
    if (!item) continue;
    const entityName = normalizeCountEntityName(
      typeof item === 'string' ? item : item.entityName || item.name,
    );
    if (!entityName) continue;
    const itemFilter = typeof item === 'string' ? {} : item.filter || {};
    const contextualFilter = dependencies.expandFilter(entityName, itemFilter);
    counts[entityName] = await dependencies.countEntity(entityName, contextualFilter);
  }
  return { data: { counts, ...counts } };
};
