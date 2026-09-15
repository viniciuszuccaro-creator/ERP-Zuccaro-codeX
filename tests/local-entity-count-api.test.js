import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCountEntityName, runLocalEntityCounts } from '../src/api/localEntityCountApi.js';

test('normaliza nome PascalCase e bloqueia chaves dinamicas perigosas', () => {
  assert.equal(normalizeCountEntityName('  ContaReceber  '), 'ContaReceber');
  assert.equal(normalizeCountEntityName(null), '');
  assert.throws(() => normalizeCountEntityName('__proto__'), /Nome de entidade invalido/);
  assert.throws(() => normalizeCountEntityName('Cliente;drop'), /Nome de entidade invalido/);
  assert.throws(() => normalizeCountEntityName('cliente'), /Nome de entidade invalido/);
});

test('contagem unica aplica contexto antes da consulta e preserva resposta compativel', async () => {
  const calls = [];
  const result = await runLocalEntityCounts({
    entityName: 'Pedido',
    filter: { status: 'Aberto' },
  }, {
    expandFilter: (entityName, filter) => {
      calls.push(['expand', entityName, filter]);
      return { group_id: 'g1', empresa_id: 'e1', ...filter };
    },
    countEntity: async (entityName, filter) => {
      calls.push(['count', entityName, filter]);
      return 3;
    },
  });

  assert.deepEqual(calls, [
    ['expand', 'Pedido', { status: 'Aberto' }],
    ['count', 'Pedido', { group_id: 'g1', empresa_id: 'e1', status: 'Aberto' }],
  ]);
  assert.deepEqual(result, {
    data: { count: 3, counts: { Pedido: 3 }, Pedido: 3 },
  });
});

test('contagens multiplas aceitam string e descritor e executam sequencialmente', async () => {
  const calls = [];
  const result = await runLocalEntityCounts({
    entities: [
      'Cliente',
      { name: 'Fornecedor', filter: { ativo: true } },
    ],
  }, {
    expandFilter: (entityName, filter) => {
      calls.push(`expand-${entityName}`);
      return { group_id: 'g1', ...filter };
    },
    countEntity: async (entityName, filter) => {
      calls.push(`count-${entityName}-${String(filter.ativo || '')}`);
      return entityName === 'Cliente' ? 10 : 4;
    },
  });

  assert.deepEqual(calls, [
    'expand-Cliente',
    'count-Cliente-',
    'expand-Fornecedor',
    'count-Fornecedor-true',
  ]);
  assert.deepEqual(result, {
    data: { counts: { Cliente: 10, Fornecedor: 4 }, Cliente: 10, Fornecedor: 4 },
  });
});

test('entrada sem entidades retorna estrutura vazia sem consultar', async () => {
  const calls = [];
  const result = await runLocalEntityCounts({}, {
    expandFilter: () => { calls.push('expand'); return {}; },
    countEntity: async () => { calls.push('count'); return 0; },
  });
  assert.deepEqual(result, { data: { counts: {} } });
  assert.deepEqual(calls, []);
});

test('descritor vazio e ignorado e entidade invalida interrompe antes da consulta', async () => {
  const calls = [];
  await assert.rejects(() => runLocalEntityCounts({
    entities: [{}, { entityName: 'constructor' }],
  }, {
    expandFilter: () => { calls.push('expand'); return {}; },
    countEntity: async () => { calls.push('count'); return 0; },
  }), /Nome de entidade invalido/);
  assert.deepEqual(calls, []);
});

test('falha na primeira contagem impede consultas seguintes', async () => {
  const counted = [];
  await assert.rejects(() => runLocalEntityCounts({
    entities: ['Cliente', 'Fornecedor'],
  }, {
    expandFilter: (_entityName, filter) => filter,
    countEntity: async (entityName) => {
      counted.push(entityName);
      throw new Error('Consulta indisponivel');
    },
  }), /Consulta indisponivel/);
  assert.deepEqual(counted, ['Cliente']);
});
