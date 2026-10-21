import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countEntitiesTouchesHttpPilot,
  listCountEntityNames,
  runHttpPilotAwareCountEntities,
} from '../src/api/httpPilotCountBridge.js';

test('listCountEntityNames cobre single e batch', () => {
  assert.deepEqual(listCountEntityNames({ entityName: 'Cliente' }), ['Cliente']);
  assert.deepEqual(listCountEntityNames({
    entities: ['Cliente', { entityName: 'Produto' }, { name: 'Fornecedor' }],
  }), ['Cliente', 'Produto', 'Fornecedor']);
});

test('countEntitiesTouchesHttpPilot detecta piloto no batch (regressao badge 0)', () => {
  const pilotSet = new Set(['Cliente']);
  const httpEntities = { Cliente: { filter: async () => [] } };
  assert.equal(
    countEntitiesTouchesHttpPilot({ entities: [{ entityName: 'Cliente', filter: {} }] }, pilotSet, httpEntities),
    true,
  );
  assert.equal(
    countEntitiesTouchesHttpPilot({ entities: [{ entityName: 'Fornecedor' }] }, pilotSet, httpEntities),
    false,
  );
  assert.equal(
    countEntitiesTouchesHttpPilot({ entityName: 'Cliente' }, pilotSet, httpEntities),
    true,
  );
});

test('runHttpPilotAwareCountEntities batch usa HTTP no piloto e local no restante', async () => {
  const calls = [];
  const result = await runHttpPilotAwareCountEntities({
    entities: [
      { entityName: 'Cliente', filter: { group_id: 'g1' } },
      { entityName: 'Fornecedor', filter: { group_id: 'g1' } },
    ],
  }, {
    pilotSet: new Set(['Cliente']),
    httpEntities: {
      Cliente: {
        filter: async () => { throw new Error('must not count page rows'); },
        count: async filter => { calls.push(['http', filter]); return 1505; },
      },
    },
    countLocal: async (entityName, filter) => {
      calls.push(['local', entityName, filter]);
      return 2;
    },
  });

  assert.deepEqual(result.data.counts, { Cliente: 1505, Fornecedor: 2 });
  assert.equal(result.data.Cliente, 1505);
  assert.equal(result.data.Fornecedor, 2);
  assert.deepEqual(calls[0], ['http', { group_id: 'g1' }]);
  assert.deepEqual(calls[1], ['local', 'Fornecedor', { group_id: 'g1' }]);
});

test('HTTP count never falls back to rows or local data when its contract is unavailable', async () => {
  for (const count of [undefined, async () => null, async () => -1, async () => NaN]) {
    await assert.rejects(runHttpPilotAwareCountEntities({ entityName: 'Cliente' }, {
      pilotSet: new Set(['Cliente']),
      httpEntities: { Cliente: { filter: async () => { throw new Error('page must not be read'); }, count } },
      countLocal: async () => { throw new Error('local must not be read'); },
    }), /HTTP_COUNT_UNAVAILABLE/);
  }
});
