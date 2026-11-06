import test from 'node:test';
import assert from 'node:assert/strict';
import { projectAssistedLegacyReview, isReleasedProductPilotRow } from '../scripts/legado/pilot-functional-policy.mjs';
test('product release preserves both source quarantine contracts and never reactivates inactive rows', () => {
  assert.equal(isReleasedProductPilotRow({ status: 'Ativo', quarantine_reason: '', quarantine_reasons: '[]' }), true);
  for (const field of ['quarantine_reason', 'quarantine_reasons']) {
    for (const value of ['["CONFLICT"]', 'UNPROVEN', ['CONFLICT'], {}])
      assert.equal(isReleasedProductPilotRow({ status: 'Ativo', [field]: value }), false);
  }
  for (const status of ['Inativo', '', undefined, 'Ativo ']) assert.equal(isReleasedProductPilotRow({ status }), false);
  const original = { status: 'Inativo', codigo: '000017' };
  isReleasedProductPilotRow(original); assert.deepEqual(original, { status: 'Inativo', codigo: '000017' });
});

const proven = { identityVerified: true, scopeVerified: true, canonicalValidated: true,
  reconciled: true, imported: true, issues: [] };
test('assisted review projects four explicit states without granting operational release', () => {
  assert.equal(projectAssistedLegacyReview(proven).status, 'VALIDATED_ELIGIBLE');
  const issue = { field: 'numero', reason: 'SOURCE_FIELD_ABSENT', critical: false, blocks: ['endereco.entrega'] };
  const pending = projectAssistedLegacyReview({ ...proven, issues: [issue] });
  assert.equal(pending.status, 'IMPORTED_PENDING');
  assert(pending.blockedOperations.includes('endereco.entrega'));
  assert(!pending.blockedOperations.includes('cadastro.utilizar'));
  assert(pending.blockedOperations.includes('financeiro.cobrar'));
  assert(pending.blockedOperations.includes('estoque.disponibilizar'));
  assert(pending.blockedOperations.includes('fiscal.emitir'));
  assert.equal(projectAssistedLegacyReview({ ...proven, issues: [{ ...issue, critical: true }] }).status, 'REVIEW_REQUIRED');
  assert.equal(projectAssistedLegacyReview({ ...proven, batchReverted: true }).status, 'HISTORY_ONLY');
  for (const result of [projectAssistedLegacyReview(proven), pending]) {
    assert.equal(result.grantsPermissions, false); assert.equal(result.operationalLoadAuthorized, false);
  }
});
test('unproven identity, tenant, validation and reconciliation remain fail closed', () => {
  for (const gate of ['identityVerified', 'scopeVerified', 'canonicalValidated', 'reconciled']) {
    const result = projectAssistedLegacyReview({ ...proven, [gate]: false });
    assert.equal(result.status, 'REVIEW_REQUIRED'); assert(result.blockedOperations.includes('cadastro.utilizar'));
    assert(result.reasons.some(reason => reason.field === gate));
  }
  assert.equal(projectAssistedLegacyReview({ ...proven, ambiguousIdentity: true }).status, 'REVIEW_REQUIRED');
  assert.equal(projectAssistedLegacyReview({ ...proven, destinationConflict: true }).status, 'REVIEW_REQUIRED');
});
test('source inactivity and reversed batches cannot implicitly reactivate records', () => {
  for (const state of [{ sourceInactive: true }, { batchReverted: true }, { historyOnly: true }]) {
    const result = projectAssistedLegacyReview({ ...proven, ...state });
    assert.equal(result.status, 'HISTORY_ONLY'); assert(result.blockedOperations.includes('cadastro.utilizar'));
  }
});
test('review preserves evidence and explicit field reasons, rejecting unknown dependencies', () => {
  const input = { ...proven, original: { codigo: '000017', sourceId: 'SYNTHETIC' },
    issues: [{ field: 'pais', reason: 'SOURCE_FIELD_ABSENT', critical: true, blocks: ['endereco.entrega'] }] };
  const before = structuredClone(input), first = projectAssistedLegacyReview(input);
  assert.deepEqual(input, before); assert.deepEqual(projectAssistedLegacyReview(input), first);
  assert.equal(first.autoMerge, false);
  assert.throws(() => projectAssistedLegacyReview({ ...proven, issues: [{}] }), /FIELD_CONTRACT_REQUIRED/);
  assert.throws(() => projectAssistedLegacyReview({ ...proven, issues: [{ field: 'x', reason: 'x', critical: false, blocks: ['unknown'] }] }), /FIELD_CONTRACT_REQUIRED/);
});
test('manual correction needs fresh canonical revalidation and reconciliation before eligible projection', () => {
  const issue = { field: 'nome', reason: 'SOURCE_RESIDUAL_PENDING', critical: true, blocks: ['cadastro.utilizar'] };
  assert.equal(projectAssistedLegacyReview({ ...proven, issues: [issue] }).status, 'REVIEW_REQUIRED');
  assert.equal(projectAssistedLegacyReview({ ...proven, canonicalValidated: false }).status, 'REVIEW_REQUIRED');
  assert.equal(projectAssistedLegacyReview(proven).status, 'VALIDATED_ELIGIBLE');
});
