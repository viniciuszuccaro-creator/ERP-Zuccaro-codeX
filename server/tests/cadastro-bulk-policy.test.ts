import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastroBulkPreflight, captureAppliedCadastroBatch, cadastroBulkReversalPlan } from '../src/services/cadastroBulkPolicy.ts';

const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222' };
const batchId = '33333333-3333-4333-8333-333333333333';
const row = (id: string | number) => ({ id, group_id: scope.groupId, empresa_id: scope.empresaId, ativo: true, codigo: '0007', nome: 'SYNTHETIC' });
test('three explicit cadastros preserve string/number/zero IDs and preflight quantities/reasons', () => {
  for (const name of ['Cliente', 'Fornecedor', 'Produto']) {
    const result = cadastroBulkPreflight(name, scope, ['1', 1, 0], [row('1'), row(1), row(0)], [
      { id: '1', allowed: true, reasons: [] }, { id: 1, allowed: false, reasons: ['ACTIVE_RELATION'] }, { id: 0, allowed: true, reasons: [] }]);
    assert.equal(result.requested, 3); assert.equal(result.eligible, 2); assert.equal(result.blocked, 1);
    assert.deepEqual(result.items.map(item => item.id), ['1', 1, 0]);
    assert.deepEqual(result.items[1].reasons, ['ACTIVE_RELATION']);
  }
});
test('unverified eligibility, inactive and cross-scope rows never become executable', () => {
  const result = cadastroBulkPreflight('Cliente', scope, ['A', 'B', 'C', 'D'], [row('A'), { ...row('B'), ativo: false },
    { ...row('C'), group_id: scope.empresaId }, { ...row('D'), empresa_id: null }], []);
  assert.equal(result.eligible, 0);
  assert.deepEqual(result.items.map(item => item.reasons[0]), ['ELIGIBILITY_NOT_VERIFIED', 'ALREADY_INACTIVE', 'NOT_FOUND_IN_SCOPE', 'NOT_FOUND_IN_SCOPE']);
});
test('fiscal documents, duplicates, unselected policy results and raw error reasons are rejected', () => {
  assert.throws(() => cadastroBulkPreflight('NotaFiscal', scope, ['A'], [row('A')], []));
  assert.throws(() => cadastroBulkPreflight('Cliente', scope, ['A', 'A'], [row('A')], []));
  assert.throws(() => cadastroBulkPreflight('Cliente', scope, ['A'], [row('A')], [{ id: 'B', allowed: true, reasons: [] }]));
  assert.throws(() => cadastroBulkPreflight('Cliente', scope, ['A'], [row('A')], [{ id: 'A', allowed: false, reasons: ['secret/raw-message'] }]));
});
test('batch captures immutable private before/after and reversal touches only its records', () => {
  const before = row('A'), after = { ...before, ativo: false };
  const batch = captureAppliedCadastroBatch(batchId, 'Cliente', scope, [{ id: 'A', before, after }]);
  before.nome = 'EXTERNAL_MUTATION';
  assert.equal(batch.items[0].before.nome, 'SYNTHETIC');
  const result = cadastroBulkReversalPlan(batch, scope, [after, row('UNRELATED')]);
  assert.deepEqual(result, [{ id: 'A', reversible: true, reason: null }]);
});
test('reversal refuses external edit, changed active flag, missing row, tenant change and target adoption', () => {
  const before = row('A'), after = { ...before, ativo: false };
  const batch = captureAppliedCadastroBatch(batchId, 'Produto', scope, [{ id: 'A', before, after }]);
  for (const current of [{ ...after, nome: 'EDITED' }, { ...after, ativo: true }]) {
    assert.equal(cadastroBulkReversalPlan(batch, scope, [current])[0].reason, 'EXTERNAL_CHANGE_CONFLICT');
  }
  assert.equal(cadastroBulkReversalPlan(batch, scope, [])[0].reason, 'NOT_FOUND_IN_SCOPE');
  assert.throws(() => cadastroBulkReversalPlan(batch, { ...scope, empresaId: null }, [after]));
  assert.throws(() => captureAppliedCadastroBatch(batchId, 'Cliente', scope, [{ id: 'A', before, after: { ...after, id: 'B' } }]));
});
