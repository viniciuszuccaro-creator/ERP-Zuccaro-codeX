import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateLocalGuardScope,
  runLocalEntityGuard,
} from '../src/api/localEntityGuardApi.js';
import {
  normalizeGuardAction,
  validateGuardContext,
} from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';

const group = { id: 'grupo-cpa' };
const companies = [
  { id: '3z', group_id: 'grupo-cpa' },
  { id: 'cpa-aco', group_id: 'grupo-cpa' },
  { id: 'externa', group_id: 'outro-grupo' },
];
const user = {
  id: 'vinicius',
  grupo_atual_id: 'grupo-cpa',
  empresa_atual_id: '3z',
  pode_operar_em_grupo: true,
  pode_ver_todas_empresas: false,
  grupos_vinculados: [{ grupo_id: 'grupo-cpa', ativo: true }],
  empresas_vinculadas: [
    { empresa_id: '3z', ativo: true },
    { empresa_id: 'cpa-aco', ativo: true },
  ],
};

const scopeData = { user, groups: [group], companies };
const guardDependencies = (overrides = {}) => ({
  normalizeAction: normalizeGuardAction,
  validateContext: validateGuardContext,
  evaluatePermission: () => ({ allowed: true, reason: 'secao' }),
  loadScopeData: () => scopeData,
  auditDenied: () => {},
  ...overrides,
});

test('guard scope authorizes linked group and both linked companies', () => {
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: null, scopeType: 'grupo',
  }, scopeData).allowed, true);
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa',
  }, scopeData).allowed, true);
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa',
  }, scopeData).allowed, true);
});

test('guard scope blocks absent user, external group and company outside group', () => {
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: '3z', scopeType: 'empresa',
  }, { ...scopeData, user: null }).reason, 'usuario-local-ausente');
  assert.equal(evaluateLocalGuardScope({
    groupId: 'outro-grupo', empresaId: null, scopeType: 'grupo',
  }, scopeData).reason, 'grupo-nao-encontrado');
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: 'externa', scopeType: 'empresa',
  }, scopeData).reason, 'empresa-fora-do-grupo');
});

test('guard scope blocks unlinked company and disabled group operation', () => {
  const restrictedUser = {
    ...user,
    empresa_atual_id: null,
    empresa_padrao_id: null,
    empresas_vinculadas: [{ empresa_id: '3z', ativo: true }],
  };
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa',
  }, { ...scopeData, user: restrictedUser }).reason, 'empresa-nao-autorizada');
  assert.equal(evaluateLocalGuardScope({
    groupId: 'grupo-cpa', empresaId: null, scopeType: 'grupo',
  }, { ...scopeData, user: { ...restrictedUser, pode_operar_em_grupo: false } }).reason, 'operacao-em-grupo-negada');
});

test('entity guard normalizes action and preserves successful response aliases', () => {
  const evaluated = [];
  const audits = [];
  const result = runLocalEntityGuard({
    module: 'Financeiro',
    section: 'Caixa',
    action: 'update',
    entity_name: 'CaixaMovimento',
    group_id: 'grupo-cpa',
    empresa_id: '3z',
  }, guardDependencies({
    evaluatePermission: (payload) => {
      evaluated.push(payload);
      return { allowed: true, reason: 'secao' };
    },
    auditDenied: (...args) => audits.push(args),
  }));

  assert.equal(evaluated[0].action, 'editar');
  assert.deepEqual(result, {
    data: { allowed: true, can: true, permitido: true, local: true, reason: 'secao' },
  });
  assert.deepEqual(audits, []);
});

test('invalid context and denied permission fail closed and are audited', () => {
  const audits = [];
  const dependencies = guardDependencies({
    evaluatePermission: () => ({ allowed: false, reason: 'secao-negada' }),
    auditDenied: (...args) => audits.push(args),
  });

  const invalid = runLocalEntityGuard({
    module: 'Financeiro', action: 'pagar', empresa_id: '3z',
  }, dependencies);
  const denied = runLocalEntityGuard({
    module: 'Financeiro', action: 'pagar', group_id: 'grupo-cpa', empresa_id: '3z',
  }, dependencies);

  assert.equal(invalid.data.allowed, false);
  assert.equal(invalid.data.reason, 'group_id_required');
  assert.equal(denied.data.allowed, false);
  assert.equal(denied.data.reason, 'secao-negada');
  assert.deepEqual(audits, [
    ['Financeiro', 'pagar', null],
    ['Financeiro', 'pagar', null],
  ]);
});

test('denial audit receives only bounded identifiers', () => {
  const audits = [];
  runLocalEntityGuard({
    module: '<script>Financeiro</script>',
    action: 'pagar',
    record_id: '../../titulo?<script>',
    group_id: 'grupo-cpa',
    empresa_id: '3z',
  }, guardDependencies({
    evaluatePermission: () => ({ allowed: false, reason: 'secao-negada' }),
    auditDenied: (...args) => audits.push(args),
  }));

  assert.deepEqual(audits, [['scriptFinanceiroscript', 'pagar', 'tituloscript']]);
});

test('AuditLog mutations remain immutable even with wildcard permission', () => {
  let evaluated = false;
  const audits = [];
  const result = runLocalEntityGuard({
    module: 'Sistema',
    action: 'delete',
    entity_name: 'AuditLog',
    group_id: 'grupo-cpa',
    empresa_id: '3z',
  }, guardDependencies({
    evaluatePermission: () => { evaluated = true; return { allowed: true }; },
    auditDenied: (...args) => audits.push(args),
  }));

  assert.equal(result.data.allowed, false);
  assert.equal(result.data.reason, 'audit-log-immutable');
  assert.equal(evaluated, false);
  assert.deepEqual(audits, [['AuditLog', 'excluir', null]]);
});
