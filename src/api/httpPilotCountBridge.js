/**
 * Bridge de contagem para entidades piloto HTTP no cliente hibrido.
 * useEntityCounts chama countEntities em lote (`entities: [...]`); o caminho
 * so-single (`entityName`) deixava o batch cair no store local → badge 0
 * enquanto entityListSorted ja lia a API.
 */
import { runLocalEntityCounts } from './localEntityCountApi.js';

/**
 * @param {{ entityName?: unknown, entities?: unknown }} payload
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
 * @param {{ entityName?: unknown, entities?: unknown }} payload
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
 *   httpEntities: Record<string, { filter: Function, count?: Function }>,
 *   countLocal: (entityName: string, filter: object) => Promise<number>,
 *   httpLimit?: number,
 * }} deps
 */
export async function runHttpPilotAwareCountEntities(payload = {}, deps) {
  const pilotSet = deps.pilotSet || new Set();
  const httpEntities = deps.httpEntities || {};
  return runLocalEntityCounts(payload, {
    expandFilter: (_entity, nextFilter) => nextFilter || {},
    countEntity: async (entityName, filter) => {
      if (pilotSet.has(entityName) && httpEntities[entityName]?.filter) {
        if (typeof httpEntities[entityName].count !== 'function') {
          throw new Error('HTTP_COUNT_UNAVAILABLE: entidade sem contrato de contagem.');
        }
        const total = await httpEntities[entityName].count(
          filter && typeof filter === 'object' ? filter : {},
        );
        if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
          throw new Error('HTTP_COUNT_UNAVAILABLE: total autoritativo invalido.');
        }
        return total;
      }
      return deps.countLocal(entityName, filter && typeof filter === 'object' ? filter : {});
    },
  });
}
