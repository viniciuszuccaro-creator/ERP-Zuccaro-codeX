import assert from 'node:assert/strict';
import test from 'node:test';

import { runLocalEntityDeletePipeline } from '../src/api/localEntityDeletePipeline.js';

const createDependencies = (records = [], overrides = {}) => ({
  historicoEstoqueEntities: [],
  isTituloFinanceiro: () => false,
  notaFiscalEntities: [],
  loadDb: () => ({ entities: { Cliente: records } }),
  getStore: (db, entityName) => db.entities[entityName] || records,
  assertTituloOnDelete: () => {},
  assertOpOnDelete: () => {},
  assertEntregaOnDelete: () => {},
  assertNotaFiscalOnDelete: () => {},
  assertMutationAllowed: () => {},
  markRecordDeleted: () => {},
  saveDb: () => {},
  notify: () => {},
  auditMutation: () => {},
  ...overrides,
});

test('historico de estoque falha antes de carregar ou marcar o registro', () => {
  const calls = [];
  const dependencies = createDependencies([], {
    historicoEstoqueEntities: ['MovimentacaoEstoque'],
    loadDb: () => { calls.push('load'); return {}; },
    markRecordDeleted: () => calls.push('mark'),
  });

  assert.throws(() => runLocalEntityDeletePipeline({
    entityName: 'MovimentacaoEstoque',
    id: 'm1',
    dependencies,
  }), /Exclusao de historico bloqueada/);
  assert.deepEqual(calls, []);
});

test('titulo financeiro valida o registro atual antes da permissao e do marcador', () => {
  const records = [{ id: 't1', status: 'Pendente' }];
  const calls = [];
  runLocalEntityDeletePipeline({
    entityName: 'ContaReceber',
    id: 't1',
    dependencies: createDependencies(records, {
      isTituloFinanceiro: () => true,
      getStore: () => records,
      assertTituloOnDelete: (record) => calls.push(['policy', record.id]),
      assertMutationAllowed: (...args) => calls.push(['permission', ...args]),
      markRecordDeleted: () => calls.push(['mark']),
      saveDb: () => calls.push(['save']),
      notify: () => calls.push(['notify']),
      auditMutation: () => calls.push(['audit']),
    }),
  });

  assert.deepEqual(calls, [
    ['policy', 't1'],
    ['permission', 'ContaReceber', 'excluir', 't1'],
    ['mark'],
    ['save'],
    ['notify'],
    ['audit'],
  ]);
});

test('registro ausente recebe marcador idempotente sem salvar, notificar ou auditar', () => {
  const calls = [];
  const result = runLocalEntityDeletePipeline({
    entityName: 'Cliente',
    id: 'ausente',
    dependencies: createDependencies([], {
      markRecordDeleted: (...args) => calls.push(['mark', ...args]),
      saveDb: () => calls.push(['save']),
      notify: () => calls.push(['notify']),
      auditMutation: () => calls.push(['audit']),
    }),
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(calls, [['mark', 'Cliente', 'ausente']]);
});

test('registro existente e removido antes de persistir, notificar e auditar', () => {
  const records = [{ id: 'c1', nome: 'Cliente' }];
  const calls = [];
  runLocalEntityDeletePipeline({
    entityName: 'Cliente',
    id: 'c1',
    dependencies: createDependencies(records, {
      markRecordDeleted: () => calls.push('mark'),
      saveDb: () => calls.push('save'),
      notify: (entity, action, record) => calls.push([entity, action, record.id]),
      auditMutation: (entity, action, options) => calls.push([entity, action, options.recordId]),
    }),
  });

  assert.deepEqual(records, []);
  assert.deepEqual(calls, [
    'mark',
    'save',
    ['Cliente', 'delete', 'c1'],
    ['Cliente', 'Exclusao', 'c1'],
  ]);
});

test('guards especializados sao aplicados somente a sua familia de entidade', () => {
  const cases = [
    ['OrdemProducao', 'op'],
    ['Entrega', 'entrega'],
    ['NotaFiscal', 'fiscal'],
  ];
  for (const [entityName, expected] of cases) {
    const calls = [];
    runLocalEntityDeletePipeline({
      entityName,
      id: 'r1',
      dependencies: createDependencies([{ id: 'r1' }], {
        notaFiscalEntities: ['NotaFiscal'],
        getStore: () => [{ id: 'r1' }],
        assertOpOnDelete: () => calls.push('op'),
        assertEntregaOnDelete: () => calls.push('entrega'),
        assertNotaFiscalOnDelete: () => calls.push('fiscal'),
      }),
    });
    assert.deepEqual(calls, [expected]);
  }
});
