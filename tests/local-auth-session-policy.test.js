import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  evaluateLocalUserSession,
  resolveUserEmpresaId,
  resolveUserGroupId,
} from '../src/api/localAuthSessionPolicy.js';

const admin = {
  id: 'local-admin-user',
  disabled: false,
  ativo: true,
  pode_operar_em_grupo: true,
  grupo_atual_id: 'local_grupo_cpa',
  empresa_atual_id: 'local_empresa_3z',
};

test('active local admin with group and company is allowed', () => {
  const result = evaluateLocalUserSession(admin);
  assert.equal(result.allowed, true);
  assert.equal(result.groupId, 'local_grupo_cpa');
  assert.equal(result.empresaId, 'local_empresa_3z');
});

test('missing user, disabled, inactive and dismissed accounts fail closed', () => {
  assert.equal(evaluateLocalUserSession(null).type, 'auth_required');
  assert.equal(evaluateLocalUserSession({ ...admin, disabled: true }).type, 'account_disabled');
  assert.equal(evaluateLocalUserSession({ ...admin, ativo: false }).type, 'account_inactive');
  assert.equal(evaluateLocalUserSession({ ...admin, status: 'Desligado' }).type, 'account_inactive');
});

test('profile without group or company is blocked', () => {
  assert.equal(evaluateLocalUserSession({ ...admin, grupo_atual_id: null, grupo_padrao_id: null, group_id: null, grupos_vinculados: [] }).type, 'missing_group');
  assert.equal(evaluateLocalUserSession({
    ...admin,
    pode_operar_em_grupo: false,
    empresa_atual_id: null,
    empresa_padrao_id: null,
    empresas_vinculadas: [],
  }).type, 'missing_company');
});

test('revoked and idle sessions are rejected', () => {
  assert.equal(evaluateLocalUserSession(admin, { ativa: false, status: 'Revogada' }).reason, 'session_revoked');
  const expired = evaluateLocalUserSession(admin, {
    ativa: true,
    data_hora_ultimo_acesso: '2020-01-01T00:00:00.000Z',
    max_idle_ms: 60_000,
  }, Date.parse('2020-01-01T01:00:00.000Z'));
  assert.equal(expired.reason, 'session_expired');
});

test('linked group and company ids resolve from active vinculos', () => {
  assert.equal(resolveUserGroupId({ grupos_vinculados: [{ grupo_id: 'g1', ativo: true }] }), 'g1');
  assert.equal(resolveUserEmpresaId({ empresas_vinculadas: [{ empresa_id: 'e1', ativo: false }, { empresa_id: 'e2', ativo: true }] }), 'e2');
});

test('local auth stack fails closed for inactive users and unauthenticated app routes', async () => {
  const policy = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sessoes = await readFile(new URL('../src/components/sistema/GerenciadorSessoes.jsx', import.meta.url), 'utf8');

  assert.match(policy, /evaluateLocalUserSession/);
  assert.match(policy, /createAuthDeniedError/);
  assert.match(policy, /async isAuthenticated\(\)/);
  assert.match(policy, /return evaluateLocalUserSession\(user\)\.allowed/);
  assert.match(auth, /const currentUser = await base44\.auth\.me\(\)/);
  assert.match(auth, /setIsAuthenticated\(false\)/);
  assert.match(auth, /error\?\.authType \|\| 'auth_required'/);
  assert.match(app, /if \(!isAuthenticated\)/);
  assert.match(app, /account_inactive/);
  assert.doesNotMatch(sessoes, /localStorage\.getItem\('group_atual_id'\)/);
  assert.match(sessoes, /filterInContext/);
});
