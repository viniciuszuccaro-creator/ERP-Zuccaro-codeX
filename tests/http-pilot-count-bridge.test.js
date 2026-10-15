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
        filter: async (filter, _order, limit, skip) => {
          calls.push(['http', filter, limit, skip]);
          return [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }];
        },
      },
    },
    countLocal: async (entityName, filter) => {
      calls.push(['local', entityName, filter]);
      return 2;
    },
  });

  assert.deepEqual(result.data.counts, { Cliente: 5, Fornecedor: 2 });
  assert.equal(result.data.Cliente, 5);
  assert.equal(result.data.Fornecedor, 2);
  assert.deepEqual(calls[0], ['http', { group_id: 'g1' }, 500, 0]);
  assert.deepEqual(calls[1], ['local', 'Fornecedor', { group_id: 'g1' }]);
});
