import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isReadOnlyGuardAction,
  normalizeGuardAction,
  permissionNodeAllows,
  resolveGuardPermission,
  normalizeGuardContext,
  validateGuardContext,
} from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';

test('guard action aliases normalize to the canonical action', () => {
  assert.equal(normalizeGuardAction('view'), 'visualizar');
  assert.equal(normalizeGuardAction('update'), 'editar');
  assert.equal(normalizeGuardAction('delete'), 'excluir');
  assert.equal(normalizeGuardAction('ajustar'), 'aprovar');
});

test('visualizar permission never grants a mutation', () => {
  assert.equal(permissionNodeAllows(['visualizar'], 'editar'), false);
  assert.equal(permissionNodeAllows(['visualizar'], 'excluir'), false);
  assert.equal(permissionNodeAllows(['visualizar', 'editar'], 'editar'), true);
});

test('executar, emitir and importar stay distinct from editar and criar', () => {
  assert.equal(normalizeGuardAction('executar'), 'executar');
  assert.equal(normalizeGuardAction('emitir'), 'emitir');
  assert.equal(normalizeGuardAction('importar'), 'importar');
  assert.equal(permissionNodeAllows(['visualizar', 'editar'], 'executar'), false);
  assert.equal(permissionNodeAllows(['visualizar', 'criar'], 'emitir'), false);
});

test('wildcard profile grants explicit actions without a module shortcut by role', () => {
  assert.equal(resolveGuardPermission({
    permissions: { '*': ['visualizar', 'executar'] },
    moduleName: 'Financeiro',
    section: 'Caixa',
    action: 'executar',
  }), true);
  assert.equal(resolveGuardPermission({
    permissions: { '*': ['visualizar'] },
    moduleName: 'Financeiro',
    section: 'Caixa',
    action: 'baixa-manual',
  }), false);
});

test('permission resolution requires the requested module and section', () => {
  const permissions = {
    Comercial: {
      Pedidos: ['visualizar', 'editar'],
    },
  };

  assert.equal(resolveGuardPermission({ permissions, moduleName: 'Comercial', section: 'Pedidos', action: 'editar' }), true);
  assert.equal(resolveGuardPermission({ permissions, moduleName: 'Comercial', section: 'Pedidos', action: 'excluir' }), false);
  assert.equal(resolveGuardPermission({ permissions, moduleName: 'Financeiro', section: 'Pedidos', action: 'editar' }), false);
});

test('only visualizar and its read aliases are read-only', () => {
  assert.equal(isReadOnlyGuardAction('listar'), true);
  assert.equal(isReadOnlyGuardAction('visualizar'), true);
  assert.equal(isReadOnlyGuardAction('exportar'), false);
  assert.equal(isReadOnlyGuardAction('executar'), false);
});

test('guard context normalizes aliases to the canonical contract', () => {
  assert.deepEqual(normalizeGuardContext({ grupo_id: 'grupo-cpa', empresa_id: 'cpa-aco' }), {
    groupId: 'grupo-cpa',
    empresaId: 'cpa-aco',
    scopeType: 'empresa',
  });
  assert.deepEqual(normalizeGuardContext({ scope_type: 'grupo', group_id: 'grupo-cpa', empresa_id: 'ignorada' }), {
    groupId: 'grupo-cpa',
    empresaId: null,
    scopeType: 'grupo',
  });
});

test('group and company contexts require their complete identifiers', () => {
  assert.equal(validateGuardContext({ scopeType: 'grupo', groupId: 'grupo-cpa' }).valid, true);
  assert.equal(validateGuardContext({ scopeType: 'empresa', groupId: 'grupo-cpa', empresaId: '3z' }).valid, true);
  assert.equal(validateGuardContext({ scopeType: 'grupo' }).error, 'group_id_required');
  assert.equal(validateGuardContext({ scopeType: 'empresa', groupId: 'grupo-cpa' }).error, 'empresa_id_required');
});

test('entityGuard and local RBAC no longer allow every action by admin role', async () => {
  const guard = await readFile(new URL('../base44/functions/entityGuard/entry.ts', import.meta.url), 'utf8');
  const permissions = await readFile(new URL('../src/components/lib/usePermissions.jsx', import.meta.url), 'utf8');
  const localClient = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');

  assert.doesNotMatch(guard, /role === 'admin'[\s\S]{0,80}allowed: true/);
  assert.match(guard, /perfil_acesso_id/);
  assert.doesNotMatch(permissions, /user\.role === "admin"\) return true/);
  assert.doesNotMatch(localClient, /admin-local/);
  assert.match(localClient, /perfil-wildcard/);
  assert.match(permissions, /normalizeGuardAction/);
});
