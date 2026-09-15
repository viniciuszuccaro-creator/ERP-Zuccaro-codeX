import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLocalEntityProxy,
  createLocalEntityReadApi,
  normalizeLocalReadEntityName,
  runLocalEntityReadFunction,
} from '../src/api/localEntityReadApi.js';

const records = [
  { id: 'a', group_id: 'g1', empresa_id: 'e1', nome: 'A' },
  { id: 'b', group_id: 'g1', empresa_id: 'e2', nome: 'B' },
];

const createDependencies = () => ({
  loadDb: () => ({ Cliente: records }),
  expandFilter: (_entityName, filter) => ({ ...filter, group_id: 'g1', empresa_id: 'e1' }),
  applyReadScope: (_db, _entityName, rows) => rows.filter((record) => record.empresa_id === 'e1'),
  getStore: (db, entityName) => db[entityName] || [],
  matchesFilter: (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value),
  sortRecords: (rows) => rows,
  listeners: new Map(),
});

test('entity read API scopes before pagination and blocks invisible record', async () => {
  const dependencies = createDependencies();
  const api = createLocalEntityReadApi('Cliente', dependencies);

  assert.deepEqual(await api.list('-created_date', 1), [records[0]]);
  await assert.rejects(() => api.get('b'), /nao encontrado/);
  assert.equal((await api.schema()).properties.empresa_id.type, 'string');
});

test('entity subscriptions and lazy proxy preserve one instance per entity', () => {
  const dependencies = createDependencies();
  const api = createLocalEntityReadApi('Cliente', dependencies);
  const listener = () => {};
  const unsubscribe = api.subscribe(listener);
  assert.equal(dependencies.listeners.get('Cliente')?.has(listener), true);
  unsubscribe();
  assert.equal(dependencies.listeners.get('Cliente')?.has(listener), false);

  let creations = 0;
  const proxy = createLocalEntityProxy((entityName) => ({ entityName, creation: ++creations }));
  assert.equal(proxy.Cliente, proxy.Cliente);
  assert.equal(proxy.Cliente.entityName, 'Cliente');
  assert.equal(proxy.Fornecedor.creation, 2);
});

test('dispatcher read normalizes entity names and blocks unsafe dynamic keys', () => {
  assert.equal(normalizeLocalReadEntityName('  ConfiguracaoSistema '), 'ConfiguracaoSistema');
  assert.equal(normalizeLocalReadEntityName(undefined), '');
  assert.throws(() => normalizeLocalReadEntityName('__proto__'), /Nome de entidade invalido/);
  assert.throws(() => normalizeLocalReadEntityName('cliente'), /Nome de entidade invalido/);
  assert.throws(() => normalizeLocalReadEntityName('Cliente;drop'), /Nome de entidade invalido/);
});

test('getEntityRecord applies context before one paginated query', async () => {
  const calls = [];
  const result = await runLocalEntityReadFunction('getEntityRecord', {
    entityName: 'ConfiguracaoSistema',
    filter: { chave: 'integracoes_e1' },
    sortField: '-updated_date',
    limit: 1,
    skip: 2,
  }, {
    expandFilter: (entityName, filter) => {
      calls.push(['expand', entityName, filter]);
      return { group_id: 'g1', empresa_id: 'e1', ...filter };
    },
    listEntity: async (...args) => {
      calls.push(['list', ...args]);
      return [records[0]];
    },
  });

  assert.deepEqual(calls, [
    ['expand', 'ConfiguracaoSistema', { chave: 'integracoes_e1' }],
    ['list', 'ConfiguracaoSistema', {
      group_id: 'g1', empresa_id: 'e1', chave: 'integracoes_e1',
    }, '-updated_date', 1, 2],
  ]);
  assert.deepEqual(result, { data: [records[0]] });
});

test('entityListSorted composes direction before limit and preserves skip', async () => {
  const calls = [];
  await runLocalEntityReadFunction('entityListSorted', {
    entityName: 'Cliente',
    filter: { ativo: true },
    sortField: 'nome',
    sortDirection: 'desc',
    limit: 50,
    skip: 100,
  }, {
    expandFilter: (_entityName, filter) => ({ group_id: 'g1', empresa_id: 'e1', ...filter }),
    listEntity: async (...args) => {
      calls.push(args);
      return [];
    },
  });

  assert.deepEqual(calls, [[
    'Cliente',
    { group_id: 'g1', empresa_id: 'e1', ativo: true },
    '-nome',
    50,
    100,
  ]]);
});

test('generic reads cap limit and reject invalid filter, pagination and sort', async () => {
  const dependencies = {
    expandFilter: (_entityName, filter) => filter,
    listEntity: async (_entityName, _filter, _order, limit) => [{ limit }],
  };
  assert.deepEqual(
    await runLocalEntityReadFunction('entityListSorted', {
      entityName: 'Cliente', limit: 9999,
    }, dependencies),
    { data: [{ limit: 500 }] },
  );
  await assert.rejects(() => runLocalEntityReadFunction('getEntityRecord', {
    entityName: 'Cliente', filter: 'empresa=e2',
  }, dependencies), /Filtro invalido/);
  await assert.rejects(() => runLocalEntityReadFunction('entityListSorted', {
    entityName: 'Cliente', sortField: 'nome;drop',
  }, dependencies), /Campo de ordenacao invalido/);
  await assert.rejects(() => runLocalEntityReadFunction('entityListSorted', {
    entityName: 'Cliente', sortField: 'nome', sortDirection: 'sideways',
  }, dependencies), /Direcao de ordenacao invalida/);
  await assert.rejects(() => runLocalEntityReadFunction('entityListSorted', {
    entityName: 'Cliente', skip: -1,
  }, dependencies), /Deslocamento invalido/);
});

test('missing entity returns empty response without expanding or querying', async () => {
  const calls = [];
  const result = await runLocalEntityReadFunction('getEntityRecord', {}, {
    expandFilter: () => { calls.push('expand'); return {}; },
    listEntity: async () => { calls.push('list'); return []; },
  });
  assert.deepEqual(result, { data: [] });
  assert.deepEqual(calls, []);
});
