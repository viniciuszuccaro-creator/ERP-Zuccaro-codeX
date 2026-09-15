import assert from 'node:assert/strict';
import test from 'node:test';

import { createLocalEntityProxy, createLocalEntityReadApi } from '../src/api/localEntityReadApi.js';

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
