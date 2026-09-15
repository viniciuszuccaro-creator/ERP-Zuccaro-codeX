import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLocalEntityUpdateTransitions } from '../src/api/localEntityUpdateTransitions.js';

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
