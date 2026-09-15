/** @typedef {Record<string, unknown>} LocalRecord */
/** @typedef {(event: { type: string, data: LocalRecord }) => void} EntityListener */

/**
 * @typedef {{
 *   loadDb: () => LocalRecord,
 *   expandFilter: (entityName: string, filter: LocalRecord) => LocalRecord,
 *   applyReadScope: (db: LocalRecord, entityName: string, records: LocalRecord[]) => LocalRecord[],
 *   getStore: (db: LocalRecord, entityName: string) => LocalRecord[],
 *   matchesFilter: (record: LocalRecord, filter: LocalRecord) => boolean,
 *   sortRecords: (records: LocalRecord[], order?: string) => LocalRecord[],
 *   listeners: Map<string, Set<EntityListener>>,
 * }} LocalEntityReadDependencies
 */

/**
 * Cria somente a parte de leitura da API local. O escopo e aplicado antes de
 * ordenar ou paginar para impedir que a primeira pagina misture empresas.
 * @param {string} entityName
 * @param {LocalEntityReadDependencies} dependencies
 */
export const createLocalEntityReadApi = (entityName, dependencies) => {
  const filter = async (query = {}, order, limit, skip = 0) => {
    if (typeof order === 'number') {
      skip = limit || 0;
      limit = order;
      order = undefined;
    }
    const db = dependencies.loadDb();
    const scopedFilter = dependencies.expandFilter(entityName, query);
    const records = dependencies.applyReadScope(
      db,
      entityName,
      dependencies.getStore(db, entityName).filter((record) => (
        dependencies.matchesFilter(record, scopedFilter)
      )),
    );
    return dependencies.sortRecords(records, order)
      .slice(skip || 0, limit ? (skip || 0) + limit : undefined);
  };

  return {
    async list(order, limit, skip = 0) {
      return filter({}, order, limit, skip);
    },
    filter,
    async get(id) {
      const db = dependencies.loadDb();
      const record = dependencies.getStore(db, entityName)
        .find((item) => String(item.id) === String(id));
      if (!record) throw new Error(`${entityName} local nao encontrado: ${id}`);
      const scoped = dependencies.applyReadScope(db, entityName, [record]);
      if (!scoped.length) throw new Error(`${entityName} local nao encontrado: ${id}`);
      return scoped[0];
    },
    async schema() {
      const db = dependencies.loadDb();
      const sample = dependencies.getStore(db, entityName)[0] || {};
      const properties = Object.fromEntries(
        ['id', 'created_date', 'updated_date', 'empresa_id', 'group_id', ...Object.keys(sample)]
          .map((key) => [key, { type: 'string' }]),
      );
      return { properties };
    },
    subscribe(listener) {
      if (!dependencies.listeners.has(entityName)) {
        dependencies.listeners.set(entityName, new Set());
      }
      dependencies.listeners.get(entityName)?.add(listener);
      return () => dependencies.listeners.get(entityName)?.delete(listener);
    },
  };
};

/**
 * Mantem o carregamento tardio das entidades e a mesma instancia por nome.
 * @template T
 * @param {(entityName: string) => T} createEntityApi
 * @returns {Record<string, T>}
 */
export const createLocalEntityProxy = (createEntityApi) => new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined;
    if (!target[prop]) target[prop] = createEntityApi(prop);
    return target[prop];
  },
});
