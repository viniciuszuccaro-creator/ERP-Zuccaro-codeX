/**
 * Bridge de contagem para entidades piloto HTTP no cliente hibrido.
 * useEntityCounts chama countEntities em lote (`entities: [...]`); o caminho
 * so-single (`entityName`) deixava o batch cair no store local → badge 0
 * enquanto entityListSorted ja lia a API.
 */
import { runLocalEntityCounts } from './localEntityCountApi.js';

/**
 * @param {unknown} payload
 * @param {Set<string>} pilotSet
 * @param {Record<string, { filter?: Function } | undefined>} httpEntities
 * @returns {string[]}
 */
export function listCountEntityNames(payload = {}) {
  const single = String(payload?.entityName || '').trim();
  if (single) return [single];
  const entitiesList = Array.isArray(payload?.entities) ? payload.entities : [];
  return entitiesList
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      return String(item.entityName || item.name || '').trim();
    })
    .filter(Boolean);
}

/**
 * @param {unknown} payload
 * @param {Set<string>} pilotSet
 * @param {Record<string, unknown>} httpEntities
 */
export function countEntitiesTouchesHttpPilot(payload, pilotSet, httpEntities = {}) {
  return listCountEntityNames(payload).some(
    (name) => pilotSet.has(name) && Boolean(httpEntities?.[name]),
  );
}

/**
 * Conta via HTTP piloto (batch ou single) e cai no store local para nao-piloto.
 * @param {object} payload
 * @param {{
 *   pilotSet: Set<string>,
 *   httpEntities: Record<string, { filter: Function }>,
 *   countLocal: (entityName: string, filter: object) => Promise<number>,
 *   httpLimit?: number,
 * }} deps
 */
export async function runHttpPilotAwareCountEntities(payload = {}, deps) {
  const pilotSet = deps.pilotSet || new Set();
  const httpEntities = deps.httpEntities || {};
  const httpLimit = Number.isInteger(deps.httpLimit) && deps.httpLimit > 0
    ? deps.httpLimit
    : 500;

  return runLocalEntityCounts(payload, {
    expandFilter: (_entity, nextFilter) => nextFilter || {},
    countEntity: async (entityName, filter) => {
      if (pilotSet.has(entityName) && httpEntities[entityName]?.filter) {
        const rows = await httpEntities[entityName].filter(
          filter && typeof filter === 'object' ? filter : {},
          undefined,
          httpLimit,
          0,
        );
        return Array.isArray(rows) ? rows.length : 0;
      }
      return deps.countLocal(entityName, filter && typeof filter === 'object' ? filter : {});
    },
  });
}
