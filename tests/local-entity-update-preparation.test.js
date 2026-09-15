import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareLocalEntityUpdate } from '../src/api/localEntityUpdatePreparation.js';

const createDependencies = (overrides = {}) => ({
  isTituloFinanceiro: () => false,
  notaFiscalEntities: [],
  assertMutationAllowed: () => {},
  assertLegacyFieldAllowed: () => {},
  assertSupplierFieldsAllowed: () => {},
  stampRecordContext: (_entity, data) => ({ ...data }),
  getCurrentContext: () => ({ groupId: 'g1' }),
  getStore: () => [],
  normalizeFornecedorCadastro: (record) => ({ ...record }),
  assertFornecedorScope: () => {},
  findDuplicateMaster: () => null,
  assertBackupExpire: () => {},
  assertPermissionAny: () => {},
  applyPilotoWrite: (_db, _entity, record) => record,
  applyBackupWrite: (_db, _entity, record) => record,
  applyLegacyReferenceUpdate: (_db, _entity, _before, record) => record,
  ...overrides,
});

const run = (entityName, dependencies, data = { nome: 'Atualizado' }, before = { id: 'r1' }) => (
  prepareLocalEntityUpdate({
    db: {},
    entityName,
    id: 'r1',
    data,
    records: [before],
    before,
    dependencies,
  })
);

test('entidade generica valida permissao e campos antes de preparar o registro', () => {
  const calls = [];
  run('Cliente', createDependencies({
    assertMutationAllowed: (...args) => calls.push(['permission', ...args]),
    assertLegacyFieldAllowed: () => calls.push(['legacy']),
    assertSupplierFieldsAllowed: () => calls.push(['supplier']),
    stampRecordContext: (_entity, data) => {
      calls.push(['context']);
      return data;
    },
  }));

  assert.deepEqual(calls, [
    ['permission', 'Cliente', 'editar', 'r1'],
    ['legacy'],
    ['supplier'],
    ['context'],
  ]);
});

test('Fornecedor normaliza documento, valida escopo e bloqueia duplicidade no grupo', () => {
  const before = { id: 'f1', group_id: 'g1', nome: 'Fornecedor' };
  let scopedRecord;
  assert.throws(() => run('Fornecedor', createDependencies({
    normalizeFornecedorCadastro: (record) => ({ ...record, cpf_cnpj: '12345678900', cpf: '12345678900', cnpj: '' }),
    assertFornecedorScope: ({ record }) => { scopedRecord = record; },
    findDuplicateMaster: () => ({ id: 'f2' }),
  }), { cpf_cnpj: '123.456.789-00' }, before), /Cadastro duplicado no grupo/);

  assert.equal(scopedRecord.cpf_cnpj, '12345678900');
  assert.equal(scopedRecord.group_id, 'g1');
});

test('preserva contexto omitido e mantem adulteracao financeira visivel para a transicao', () => {
  const before = { id: 'r1', empresa_id: 'e1', group_id: 'g1' };
  const omitted = run('ContaReceber', createDependencies({
    isTituloFinanceiro: () => true,
  }), { valor: 10 }, before);
  const explicit = run('ContaReceber', createDependencies({
    isTituloFinanceiro: () => true,
  }), { empresa_id: 'e2' }, before);
  const fiscal = run('NotaFiscal', createDependencies({
    notaFiscalEntities: ['NotaFiscal'],
  }), { empresa_id: 'e2' }, before);

  assert.equal(omitted.payload.empresa_id, 'e1');
  assert.equal(omitted.payload.group_id, 'g1');
  assert.equal(explicit.payload.empresa_id, 'e2');
  assert.equal(fiscal.payload.empresa_id, 'e1');
});

test('Backup expirado exige validacao propria e permissoes de exclusao ou edicao', () => {
  const calls = [];
  run('BackupAutomatico', createDependencies({
    assertBackupExpire: () => calls.push('expire'),
    assertPermissionAny: (_entity, actions) => calls.push(actions),
  }), { status: 'Expirado' });

  assert.deepEqual(calls, ['expire', ['excluir', 'editar']]);
});

test('Backup comum aceita editar, restaurar ou executar', () => {
  const permissions = [];
  run('BackupAutomatico', createDependencies({
    assertPermissionAny: (_entity, actions) => permissions.push(actions),
  }), { status: 'Disponivel' });

  assert.deepEqual(permissions, [['editar', 'restaurar', 'executar']]);
});

test('aplica preparadores na ordem piloto, backup e referencia legada', () => {
  const order = [];
  const result = run('Cliente', createDependencies({
    applyPilotoWrite: (_db, _entity, record) => {
      order.push('piloto');
      return { ...record, piloto: true };
    },
    applyBackupWrite: (_db, _entity, record) => {
      order.push('backup');
      return { ...record, backup: true };
    },
    applyLegacyReferenceUpdate: (_db, _entity, _before, record) => {
      order.push('legacy');
      return { ...record, legacy: true };
    },
  }));

  assert.deepEqual(order, ['piloto', 'backup', 'legacy']);
  assert.deepEqual(result.initialRecord, {
    nome: 'Atualizado',
    piloto: true,
    backup: true,
    legacy: true,
  });
});
