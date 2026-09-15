/** @typedef {Record<string, unknown>} LocalRecord */
/** @typedef {(event: { type: string, data: LocalRecord }) => void} EntityListener */

const ENTITY_NAME_PATTERN = /^[A-Z][A-Za-z0-9]{0,79}$/;
const SORT_FIELD_PATTERN = /^-?[A-Za-z_][A-Za-z0-9_.]*$/;
const BLOCKED_ENTITY_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

/** @param {unknown} value */
export const normalizeLocalReadEntityName = (value) => {
  const entityName = String(value || '').trim();
  if (!entityName) return '';
  if (BLOCKED_ENTITY_NAMES.has(entityName) || !ENTITY_NAME_PATTERN.test(entityName)) {
    throw new Error('Nome de entidade invalido para leitura local.');
  }
  return entityName;
};

/** @param {unknown} value */
const normalizeLocalReadSort = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const sortField = String(value).trim();
  if (!SORT_FIELD_PATTERN.test(sortField)) {
    throw new Error('Campo de ordenacao invalido para leitura local.');
  }
  return sortField;
};

/** @param {unknown} value */
const normalizeLocalReadLimit = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Limite invalido para leitura local.');
  }
  return Math.min(limit, 500);
};

/** @param {unknown} value */
const normalizeLocalReadSkip = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const skip = Number(value);
  if (!Number.isInteger(skip) || skip < 0) {
    throw new Error('Deslocamento invalido para leitura local.');
  }
  return skip;
};

/**
 * Executa as leituras genericas do dispatcher pela API de entidades existente.
 * O filtro contextual e composto antes da consulta, que recebe ordenacao e
 * paginacao juntas para selecionar a pagina correta.
 * @param {'getEntityRecord' | 'entityListSorted'} functionName
 * @param {{ entityName?: unknown, filter?: LocalRecord, sortField?: unknown, sortDirection?: unknown, limit?: unknown, skip?: unknown }} payload
 * @param {{
 *   expandFilter: (entityName: string, filter: LocalRecord) => LocalRecord,
 *   listEntity: (entityName: string, filter: LocalRecord, order?: string, limit?: number, skip?: number) => Promise<LocalRecord[]>,
 * }} dependencies
 */
export const runLocalEntityReadFunction = async (functionName, payload = {}, dependencies) => {
  const entityName = normalizeLocalReadEntityName(payload.entityName);
  if (!entityName) return { data: [] };
  if (payload.filter !== undefined && (payload.filter === null || typeof payload.filter !== 'object' || Array.isArray(payload.filter))) {
    throw new Error('Filtro invalido para leitura local.');
  }

  const filter = dependencies.expandFilter(entityName, payload.filter || {});
  const requestedSort = normalizeLocalReadSort(payload.sortField);
  let order = requestedSort || undefined;
  if (functionName === 'entityListSorted' && requestedSort) {
    const field = requestedSort.startsWith('-') ? requestedSort.slice(1) : requestedSort;
    const embeddedDirection = requestedSort.startsWith('-') ? 'desc' : 'asc';
    const direction = payload.sortDirection === undefined || payload.sortDirection === null || payload.sortDirection === ''
      ? embeddedDirection
      : String(payload.sortDirection).trim().toLowerCase();
    if (direction !== 'asc' && direction !== 'desc') {
      throw new Error('Direcao de ordenacao invalida para leitura local.');
    }
    order = `${direction === 'desc' ? '-' : ''}${field}`;
  }

  const data = await dependencies.listEntity(
    entityName,
    filter,
    order,
    normalizeLocalReadLimit(payload.limit),
    normalizeLocalReadSkip(payload.skip),
  );
  return { data };
};

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
