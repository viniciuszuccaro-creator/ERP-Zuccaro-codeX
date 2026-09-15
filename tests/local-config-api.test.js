import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeLocalConfigScope, upsertLocalConfig } from '../src/api/localConfigApi.js';

const createDependencies = (overrides = {}) => ({
  validateContext: (scope) => ({ valid: Boolean(scope.group_id), groupId: scope.group_id, empresaId: scope.empresa_id }),
  toEntityScope: (context) => ({ group_id: context.groupId, ...(context.empresaId ? { empresa_id: context.empresaId } : {}) }),
  filterConfigs: async () => [],
  updateConfig: async (_id, payload) => payload,
  createConfig: async (payload) => payload,
  now: () => '2026-09-15T11:00:00.000Z',
  ...overrides,
});

test('normalizacao de escopo falha fechada sem fabricar contexto', () => {
  const result = normalizeLocalConfigScope({}, createDependencies({
    validateContext: () => ({ valid: false, error: 'Grupo obrigatorio' }),
  }));
  assert.deepEqual(result, { valid: false, error: 'Grupo obrigatorio', scope: {} });
});

test('chave vazia e recusada antes de consultar configuracoes', async () => {
  const calls = [];
  await assert.rejects(() => upsertLocalConfig({
    chave: '   ',
    scope: { group_id: 'g1' },
  }, createDependencies({
    filterConfigs: async () => { calls.push('filter'); return []; },
  })), /Chave obrigatoria/);
  assert.deepEqual(calls, []);
});

test('contexto invalido impede busca, criacao e atualizacao', async () => {
  const calls = [];
  await assert.rejects(() => upsertLocalConfig({
    chave: 'seguranca',
    scope: {},
  }, createDependencies({
    validateContext: () => ({ valid: false, error: 'Empresa fora do grupo' }),
    filterConfigs: async () => { calls.push('filter'); return []; },
    createConfig: async () => { calls.push('create'); return {}; },
  })), /Empresa fora do grupo/);
  assert.deepEqual(calls, []);
});

test('configuracao existente usa filtro contextual e update', async () => {
  const calls = [];
  const result = await upsertLocalConfig({
    chave: '  seg_mfa  ',
    data: { categoria: 'Seguranca', ativa: true },
    scope: { group_id: 'g1', empresa_id: 'e1' },
  }, createDependencies({
    filterConfigs: async (...args) => {
      calls.push(['filter', ...args]);
      return [{ id: 'cfg1' }];
    },
    updateConfig: async (...args) => {
      calls.push(['update', ...args]);
      return { id: args[0], ...args[1] };
    },
    createConfig: async () => { throw new Error('nao deve criar'); },
  }));

  assert.deepEqual(calls[0], ['filter', {
    chave: 'seg_mfa',
    group_id: 'g1',
    empresa_id: 'e1',
  }, '-updated_date', 1]);
  assert.equal(calls[1][0], 'update');
  assert.equal(calls[1][1], 'cfg1');
  assert.equal(result.data.record.ativa, true);
});

test('configuracao ausente usa create e categoria padrao', async () => {
  const created = [];
  const result = await upsertLocalConfig({
    chave: 'integracao_ativa',
    data: { ativa: false },
    scope: { group_id: 'g1' },
  }, createDependencies({
    createConfig: async (payload) => {
      created.push(payload);
      return { id: 'cfg2', ...payload };
    },
  }));

  assert.equal(created[0].categoria, 'Sistema');
  assert.equal(created[0].group_id, 'g1');
  assert.equal(result.data.record.id, 'cfg2');
});

test('chave e contexto externos prevalecem sobre data adulterada', async () => {
  const created = [];
  await upsertLocalConfig({
    chave: 'config_correta',
    data: { chave: 'config_adulterada', group_id: 'g2', empresa_id: 'e2' },
    scope: { group_id: 'g1', empresa_id: 'e1' },
  }, createDependencies({
    createConfig: async (payload) => { created.push(payload); return payload; },
  }));

  assert.equal(created[0].chave, 'config_correta');
  assert.equal(created[0].group_id, 'g1');
  assert.equal(created[0].empresa_id, 'e1');
});
