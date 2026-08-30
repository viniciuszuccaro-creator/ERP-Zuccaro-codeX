import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeGuardCallScope,
  normalizeGuardCallScope,
  recordMatchesGuardScope,
  requireEntityGuard,
} from '../base44/functions/_lib/security/guardCallPolicy/entry.ts';

test('guard caller normalizes group and company aliases', () => {
  assert.deepEqual(normalizeGuardCallScope({ grupo_id: 'grupo-cpa', empresaId: 'cpa-aco' }), {
    groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa',
  });
});

test('guard caller completes group from the selected company', async () => {
  const base44 = {
    asServiceRole: { entities: { Empresa: { filter: async () => [{ group_id: 'grupo-cpa' }] } } },
  };
  assert.deepEqual(await completeGuardCallScope(base44, { empresa_id: '3z' }), {
    groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa',
  });
});

test('guard caller fails closed on missing context, denial and unavailability', async () => {
  const base44 = {
    functions: { invoke: async () => ({ data: { allowed: false } }) },
    asServiceRole: { entities: { Empresa: { filter: async () => [] } } },
  };
  assert.equal((await requireEntityGuard(base44, { module: 'Fiscal' })).status, 400);
  assert.equal((await requireEntityGuard(base44, { module: 'Fiscal', group_id: 'grupo-cpa' })).status, 403);

  base44.functions.invoke = async () => { throw new Error('offline'); };
  assert.equal((await requireEntityGuard(base44, { module: 'Fiscal', group_id: 'grupo-cpa' })).status, 503);
});

test('guard caller proceeds only with an explicit allowed response', async () => {
  const base44 = {
    functions: { invoke: async () => ({ data: { allowed: true } }) },
    asServiceRole: { entities: { Empresa: { filter: async () => [] } } },
  };
  assert.equal(await requireEntityGuard(base44, { module: 'Financeiro', group_id: 'grupo-cpa' }), null);
});

test('record ownership rejects another company or group', () => {
  const registro3z = { group_id: 'grupo-cpa', empresa_id: '3z' };
  assert.equal(recordMatchesGuardScope(registro3z, { group_id: 'grupo-cpa', empresa_id: '3z' }), true);
  assert.equal(recordMatchesGuardScope(registro3z, { group_id: 'grupo-cpa', empresa_id: 'cpa-aco' }), false);
  assert.equal(recordMatchesGuardScope(registro3z, { group_id: 'outro-grupo', empresa_id: '3z' }), false);
  assert.equal(recordMatchesGuardScope({ empresa_id: '3z' }, { group_id: 'grupo-cpa', empresa_id: '3z' }), false);
});
