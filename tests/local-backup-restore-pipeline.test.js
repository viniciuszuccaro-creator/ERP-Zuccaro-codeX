import assert from 'node:assert/strict';
import test from 'node:test';

import { runLocalBackupRestorePipeline } from '../src/api/localBackupRestorePipeline.js';

const createDependencies = (records = [], overrides = {}) => ({
  assertPermissionAny: () => {},
  loadDb: () => ({ backups: records }),
  getStore: (db) => db.backups,
  getCurrentContext: () => ({ groupId: 'g1', empresaId: 'e1', user: { id: 'u1', full_name: 'Operador' } }),
  assertBackupRestore: () => ({ Cliente: [] }),
  backupCountEntities: ['Cliente'],
  mergeSnapshotRecords: () => ({ created: 0, updated: 0 }),
  now: () => '2026-09-15T10:00:00.000Z',
  saveDb: () => {},
  notify: () => {},
  auditMutation: () => {},
  ...overrides,
});

test('recusa restauracao fora de BackupAutomatico antes de autorizar ou carregar', () => {
  const calls = [];
  const dependencies = createDependencies([], {
    assertPermissionAny: () => calls.push('permission'),
    loadDb: () => { calls.push('load'); return {}; },
  });

  assert.throws(() => runLocalBackupRestorePipeline({
    entityName: 'Cliente',
    id: 'c1',
    dependencies,
  }), /restore nao suportado/);
  assert.deepEqual(calls, []);
});

test('exige permissao antes de carregar e falha para backup inexistente', () => {
  const calls = [];
  assert.throws(() => runLocalBackupRestorePipeline({
    entityName: 'BackupAutomatico',
    id: 'ausente',
    dependencies: createDependencies([], {
      assertPermissionAny: (...args) => calls.push(['permission', ...args]),
      loadDb: () => { calls.push(['load']); return { backups: [] }; },
    }),
  }), /nao encontrado/);
  assert.deepEqual(calls, [
    ['permission', 'BackupAutomatico', ['restaurar', 'executar'], 'ausente'],
    ['load'],
  ]);
});

test('opcoes explicitas definem o escopo validado e snapshot usa somente a allowlist', () => {
  const backup = { id: 'b1', group_id: 'g1', empresa_id: 'e1' };
  const validated = [];
  const merged = [];
  const result = runLocalBackupRestorePipeline({
    entityName: 'BackupAutomatico',
    id: 'b1',
    options: { group_id: 'g2', empresa_id: 'e2' },
    dependencies: createDependencies([backup], {
      assertBackupRestore: (input) => {
        validated.push(input);
        return { Cliente: [{ id: 'c1' }], Pedido: [{ id: 'p1' }], Extra: [{ id: 'x1' }] };
      },
      backupCountEntities: ['Cliente', 'Pedido'],
      mergeSnapshotRecords: (_db, entityName, rows) => {
        merged.push([entityName, rows.map((row) => row.id)]);
        return { created: rows.length, updated: 0 };
      },
    }),
  });

  assert.equal(validated[0].groupId, 'g2');
  assert.equal(validated[0].empresaId, 'e2');
  assert.deepEqual(merged, [['Cliente', ['c1']], ['Pedido', ['p1']]]);
  assert.deepEqual(result.summary, {
    Cliente: { created: 1, updated: 0 },
    Pedido: { created: 1, updated: 0 },
  });
});

test('registra historico, persiste, notifica e audita somente depois do merge', () => {
  const backup = { id: 'b1', numero_backup: 'BKP-000001', restauracoes: [{ sucesso: true }] };
  const calls = [];
  const result = runLocalBackupRestorePipeline({
    entityName: 'BackupAutomatico',
    id: 'b1',
    dependencies: createDependencies([backup], {
      mergeSnapshotRecords: () => {
        calls.push('merge');
        return { created: 1, updated: 0 };
      },
      saveDb: () => calls.push('save'),
      notify: (entity, action, record) => calls.push([entity, action, record.id]),
      auditMutation: (entity, action, options) => calls.push([entity, action, options.recordId, options.detalhes]),
    }),
  });

  assert.deepEqual(calls, [
    'merge',
    'save',
    ['BackupAutomatico', 'update', 'b1'],
    ['BackupAutomatico', 'Restauracao', 'b1', { Cliente: { created: 1, updated: 0 } }],
  ]);
  assert.equal(result.backup.restauracoes.length, 2);
  assert.deepEqual(result.backup.restauracoes[1], {
    data_hora: '2026-09-15T10:00:00.000Z',
    usuario: 'Operador',
    usuario_id: 'u1',
    tipo_restauracao: 'Completa',
    sucesso: true,
    observacoes: 'Restauracao aplicada do backup BKP-000001',
    resumo: { Cliente: { created: 1, updated: 0 } },
  });
});

test('falha de validacao do snapshot impede qualquer merge ou persistencia', () => {
  const calls = [];
  assert.throws(() => runLocalBackupRestorePipeline({
    entityName: 'BackupAutomatico',
    id: 'b1',
    dependencies: createDependencies([{ id: 'b1' }], {
      assertBackupRestore: () => { throw new Error('Escopo de backup invalido'); },
      mergeSnapshotRecords: () => calls.push('merge'),
      saveDb: () => calls.push('save'),
    }),
  }), /Escopo de backup invalido/);
  assert.deepEqual(calls, []);
});
