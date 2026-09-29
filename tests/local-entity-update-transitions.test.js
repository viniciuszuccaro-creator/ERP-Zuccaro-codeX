import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLocalEntityUpdateTransitions } from '../src/api/localEntityUpdateTransitions.js';
import { prepareLocalEntityUpdate } from '../src/api/localEntityUpdatePreparation.js';
import { assertNotaFiscalOnUpdate } from '../src/components/lib/notaFiscalEmissaoPolicy.js';

const createDependencies = (overrides = {}) => ({
  getStore: () => [],
  readUser: () => ({ id: 'u1' }),
  assertPermissionAny: () => {},
  assertMutationAllowed: () => {},
  assertTituloSettlementAllowed: () => {},
  isTituloFinanceiro: () => false,
  notaFiscalEntities: [],
  resolvePortalClienteId: () => null,
  assertPortalTituloWrite: () => {},
  assertEntregaOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch }, action: 'editar' }),
  entregaActions: () => ['editar'],
  isMotoristaIdempotencyKey: () => false,
  assertEntregaMotoristaOnUpdate: ({ patch }) => patch,
  assertOrdemCompraOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch }, action: 'editar' }),
  ordemCompraActions: () => ['editar'],
  assertOportunidadeOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch }, action: 'editar' }),
  oportunidadeActions: () => ['editar'],
  assertTituloOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch } }),
  assertNotaFiscalOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch } }),
  nfeEmitActions: () => ['emitir'],
  nfeCancelActions: () => ['cancelar'],
  assertOpOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch }, action: 'editar' }),
  opActions: () => ['editar'],
  ...overrides,
});

const run = (entityName, dependencies, payload = { status: 'Novo' }) => applyLocalEntityUpdateTransitions({
  db: {},
  entityName,
  id: 'r1',
  before: { id: 'r1', empresa_id: 'e1', empresa_faturamento_id: 'e1' },
  payload,
  initialRecord: { ...payload },
  dependencies,
});

test('retry de Entrega encerra sem persistencia e exige permissao', () => {
  const permissions = [];
  const result = run('Entrega', createDependencies({
    assertPermissionAny: (_entity, actions) => permissions.push(actions),
    assertEntregaOnUpdate: ({ before }) => ({ record: before, action: 'retry' }),
  }));

  assert.equal(result.reuse?.id, 'r1');
  assert.deepEqual(permissions, [['editar', 'entregar', 'conferir', 'expedir']]);
});

test('liquidacao financeira usa guarda propria e preserva decisao', () => {
  const checks = [];
  const result = run('ContaReceber', createDependencies({
    isTituloFinanceiro: () => true,
    assertTituloSettlementAllowed: () => checks.push('liquidar'),
    assertTituloOnUpdate: ({ before, patch }) => ({ record: { ...before, ...patch }, settlement: true }),
  }), { status: 'Pago' });

  assert.deepEqual(checks, ['liquidar']);
  assert.equal(result.record?.status, 'Pago');
});

test('nota fiscal preserva empresa emissora e usa permissao de emissao', () => {
  const permissions = [];
  const result = run('NotaFiscal', createDependencies({
    notaFiscalEntities: ['NotaFiscal'],
    assertPermissionAny: (_entity, actions) => permissions.push(actions),
    assertNotaFiscalOnUpdate: ({ patch }) => ({ record: { ...patch, empresa_id: 'e2' }, emit: true }),
  }), { status: 'Autorizada' });

  assert.deepEqual(permissions, [['emitir']]);
  assert.equal(result.record?.empresa_id, 'e1');
  assert.equal(result.record?.empresa_faturamento_id, 'e1');
});

test('emitente pode rejeitar somente NF pendente sem permissao editar/cancelar', () => {
  const checks = [];
  const dependencies = createDependencies({
    notaFiscalEntities: ['NotaFiscal'],
    assertNotaFiscalOnUpdate,
    assertPermissionAny: (_entity, actions) => {
      checks.push(actions);
      if (!actions.includes('emitir')) throw new Error('emitir obrigatorio');
    },
    assertMutationAllowed: () => { throw new Error('editar negado'); },
  });
  const before = { id: 'nf-1', status: 'Pendente', empresa_id: 'e1', empresa_faturamento_id: 'e1' };
  const result = applyLocalEntityUpdateTransitions({
    db: {}, entityName: 'NotaFiscal', id: 'nf-1', before,
    payload: { status: 'Rejeitada' }, initialRecord: { status: 'Rejeitada' }, dependencies,
  });
  assert.equal(result.record?.status, 'Rejeitada');
  assert.deepEqual(checks, [['emitir']]);
  assert.throws(() => applyLocalEntityUpdateTransitions({
    db: {}, entityName: 'NotaFiscal', id: 'nf-1', before,
    payload: { status: 'Rejeitada', valor_total: 1 }, initialRecord: { status: 'Rejeitada', valor_total: 1 }, dependencies,
  }), /editar negado/);
});

test('rejeição pendente preserva Grupo e Empresa após carimbo de contexto', () => {
  const before = { id: 'nf-1', status: 'Pendente', group_id: 'g-original', grupo_id: 'g-original',
    empresa_id: 'e1', empresa_faturamento_id: 'e1' };
  const data = { status: 'Rejeitada' };
  const prepared = prepareLocalEntityUpdate({
    db: {}, entityName: 'NotaFiscal', id: 'nf-1', data, records: [before], before,
    dependencies: {
      isTituloFinanceiro: () => false,
      notaFiscalEntities: ['NotaFiscal'],
      assertMutationAllowed: () => { throw new Error('editar negado'); },
      assertLegacyFieldAllowed: () => {},
      assertSupplierFieldsAllowed: () => {},
      stampRecordContext: (_entity, patch) => ({ ...patch, empresa_id: 'e1',
        group_id: 'g-contexto', grupo_id: 'g-contexto' }),
      getCurrentContext: () => ({ groupId: 'g-contexto' }),
      getStore: () => [],
      normalizeFornecedorCadastro: (record) => record,
      assertFornecedorScope: () => {},
      findDuplicateMaster: () => null,
      assertBackupExpire: () => {},
      assertPermissionAny: () => {},
      applyPilotoWrite: (_db, _entity, record) => record,
      applyBackupWrite: (_db, _entity, record) => record,
      applyLegacyReferenceUpdate: (_db, _entity, _before, patch) => patch,
    },
  });
  const result = applyLocalEntityUpdateTransitions({
    db: {}, entityName: 'NotaFiscal', id: 'nf-1', before,
    payload: prepared.payload, initialRecord: prepared.initialRecord,
    dependencies: createDependencies({
      notaFiscalEntities: ['NotaFiscal'],
      assertNotaFiscalOnUpdate,
      assertPermissionAny: (_entity, actions) => {
        if (!actions.includes('emitir')) throw new Error('emitir obrigatorio');
      },
      assertMutationAllowed: () => { throw new Error('editar negado'); },
    }),
  });
  assert.equal(result.record?.status, 'Rejeitada');
  assert.equal(result.record?.empresa_id, 'e1');
  assert.equal(result.record?.group_id, 'g-original');
  assert.equal(result.record?.grupo_id, 'g-original');
});
