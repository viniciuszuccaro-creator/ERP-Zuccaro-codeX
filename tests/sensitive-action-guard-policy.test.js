import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSensitiveGuardRequest,
  getSensitiveGuardState,
  isSensitiveGuardAllowed,
} from '../src/components/lib/sensitiveActionGuardPolicy.js';

const storageWith = (values) => ({ getItem: (key) => values[key] || null });

test('sensitive guard builds company context from the stable permission key', () => {
  const request = buildSensitiveGuardRequest({
    permission: 'comercial.pedido.aprovar',
    path: '/comercial',
    storage: storageWith({
      contexto_atual: 'empresa',
      group_atual_id: 'grupo-cpa',
      empresa_atual_id: 'cpa-ferro-aco',
    }),
  });

  assert.equal(request.valid, true);
  assert.deepEqual(request.payload, {
    module: 'comercial',
    section: 'pedido',
    action: 'aprovar',
    empresa_id: 'cpa-ferro-aco',
    group_id: 'grupo-cpa',
    scope_type: 'company',
  });
});

test('sensitive guard accepts group context without a company and rejects incomplete company context', () => {
  const groupRequest = buildSensitiveGuardRequest({
    actionName: 'Sistema.configuracao.editar',
    storage: storageWith({ contexto_atual: 'grupo', group_atual_id: 'grupo-cpa' }),
  });
  const companyRequest = buildSensitiveGuardRequest({
    storage: storageWith({ contexto_atual: 'empresa', group_atual_id: 'grupo-cpa' }),
  });

  assert.equal(groupRequest.valid, true);
  assert.equal(groupRequest.payload.empresa_id, null);
  assert.equal(companyRequest.valid, false);
});

test('sensitive guard fails closed unless backend explicitly allows the action', () => {
  assert.equal(isSensitiveGuardAllowed({ data: { allowed: true } }), true);
  assert.equal(isSensitiveGuardAllowed({ data: { allowed: false } }), false);
  assert.equal(isSensitiveGuardAllowed({ data: { can: true } }), false);
  assert.equal(isSensitiveGuardAllowed(null), false);
});

test('sensitive wrappers share one boolean cache and one inflight request map', () => {
  const host = {};
  const first = getSensitiveGuardState(host);
  const second = getSensitiveGuardState(host);
  const pending = Promise.resolve(true);

  first.inflight.set('guard-key', pending);
  first.cache.set('guard-key', { allowed: true, ts: 1 });

  assert.equal(second.inflight.get('guard-key'), pending);
  assert.deepEqual(second.cache.get('guard-key'), { allowed: true, ts: 1 });
});
