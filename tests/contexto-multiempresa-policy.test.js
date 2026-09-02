import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeMultiempresaContext,
  toEntityScope,
  toGuardScope,
  validateMultiempresaContext,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

test('canonical context accepts Grupo CPA and both companies without mixing scope', () => {
  assert.deepEqual(normalizeMultiempresaContext({ scopeType: 'grupo', groupId: 'grupo-cpa', empresaId: 'cpa-aco' }), {
    groupId: 'grupo-cpa', empresaId: null, scopeType: 'grupo',
  });
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa', empresaId: 'cpa-aco' }).valid, true);
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa', empresaId: '3z' }).valid, true);
});

test('company scope is invalid without both group and company', () => {
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', empresaId: 'cpa-aco' }).valid, false);
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: 'grupo-cpa' }).valid, false);
});
test('multiempresa identifiers are trimmed and blank aliases fail closed', () => {
  assert.deepEqual(normalizeMultiempresaContext({ scopeType: ' empresa ', groupId: ' grupo-cpa ', empresaId: ' 3z ' }), {
    groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa',
  });
  assert.equal(validateMultiempresaContext({ scopeType: 'empresa', groupId: '   ', empresaId: '3z' }).valid, false);
  assert.deepEqual(toEntityScope({ contexto: 'empresa', group_id: 'grupo-cpa', empresa_id: '   ' }), {});
});

test('entity and guard scopes expose only normalized identifiers', () => {
  assert.deepEqual(toEntityScope({ contexto: 'empresa', grupo_id: 'grupo-cpa', empresa_id: '3z' }), {
    group_id: 'grupo-cpa', empresa_id: '3z',
  });
  assert.deepEqual(toEntityScope({ contexto: 'grupo', group_id: 'grupo-cpa' }), { group_id: 'grupo-cpa' });
  assert.deepEqual(toEntityScope({ group_id: ' grupo-cpa ' }), { group_id: 'grupo-cpa' });
  assert.equal(toGuardScope({ contexto: 'empresa', group_id: 'grupo-cpa' }).__blocked, true);
});
