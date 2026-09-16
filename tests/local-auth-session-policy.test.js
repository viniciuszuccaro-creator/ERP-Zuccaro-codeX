import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertInteractiveAuthAllowed,
  buildLocalAuthDeniedAuditRecord,
  createAuthDeniedError,
  evaluateLocalUserSession,
  markLocalLoggedOut,
  prepareLocalReauthentication,
  readLocalAuthState,
  resolveUserEmpresaId,
  resolveUserGroupId,
  writeLocalAuthState,
} from '../src/api/localAuthSessionPolicy.js';
import { createLocalStorageAdapter } from '../src/api/localStorageAdapter.js';

const admin = {
  id: 'local-admin-user',
  disabled: false,
  ativo: true,
  pode_operar_em_grupo: true,
  grupo_atual_id: 'local_grupo_cpa',
  empresa_atual_id: 'local_empresa_3z',
};

test('Gate 1 local authentication matrix fails closed with auditable reasons', async (t) => {
  const activeSession = {
    usuario_id: admin.id,
    ativa: true,
    status: 'Ativa',
    data_hora_ultimo_acesso: '2026-09-16T11:59:30.000Z',
    max_idle_ms: 60_000,
  };
  const cases = [
    { name: 'active user', user: admin, session: activeSession, expected: { allowed: true, reason: null, type: null } },
    { name: 'missing user', user: null, expected: { allowed: false, reason: 'unauthenticated', type: 'auth_required' } },
    { name: 'disabled account', user: { ...admin, disabled: true }, expected: { allowed: false, reason: 'disabled', type: 'account_disabled' } },
    { name: 'inactive account', user: { ...admin, ativo: false }, expected: { allowed: false, reason: 'inactive', type: 'account_inactive' } },
    { name: 'dismissed account', user: { ...admin, status: 'Desligado' }, expected: { allowed: false, reason: 'inactive', type: 'account_inactive' } },
    {
      name: 'missing group',
      user: { ...admin, grupo_atual_id: null, grupo_padrao_id: null, group_id: null, grupos_vinculados: [] },
      expected: { allowed: false, reason: 'missing_group', type: 'missing_group' },
    },
    {
      name: 'missing company',
      user: { ...admin, pode_operar_em_grupo: false, empresa_atual_id: null, empresa_padrao_id: null, empresas_vinculadas: [] },
      expected: { allowed: false, reason: 'missing_company', type: 'missing_company' },
    },
    {
      name: 'session owned by another user',
      user: admin,
      session: { ...activeSession, usuario_id: 'outro-usuario' },
      expected: { allowed: false, reason: 'session_owner_mismatch', type: 'auth_required' },
    },
    {
      name: 'revoked session',
      user: admin,
      session: { ...activeSession, ativa: false, status: 'Revogada' },
      expected: { allowed: false, reason: 'session_revoked', type: 'auth_required' },
    },
    {
      name: 'expired session',
      user: admin,
      session: { ...activeSession, data_hora_ultimo_acesso: '2020-01-01T00:00:00.000Z' },
      expected: { allowed: false, reason: 'session_expired', type: 'auth_required' },
      nowMs: Date.parse('2020-01-01T01:00:00.000Z'),
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, () => {
      const result = evaluateLocalUserSession(
        scenario.user,
        scenario.session || null,
        scenario.nowMs || Date.parse('2026-09-16T12:00:00.000Z'),
      );
      assert.equal(result.allowed, scenario.expected.allowed);
      assert.equal(result.reason, scenario.expected.reason);
      assert.equal(result.type, scenario.expected.type);
      if (result.allowed) {
        assert.equal(result.groupId, 'local_grupo_cpa');
        assert.equal(result.empresaId, 'local_empresa_3z');
        return;
      }
      const record = buildLocalAuthDeniedAuditRecord({
        error: createAuthDeniedError(result),
        user: scenario.user,
        sessionId: scenario.session ? 'sessao-gate-1' : null,
        id: `audit-${scenario.name}`,
        timestamp: '2026-09-16T12:00:00.000Z',
      });
      assert.deepEqual(record.dados_novos, { motivo: scenario.expected.reason, tipo: scenario.expected.type });
      assert.equal(record.sucesso, false);
    });
  }
});

test('linked group and company ids resolve from active vinculos', () => {
  assert.equal(resolveUserGroupId({ grupos_vinculados: [{ grupo_id: 'g1', ativo: true }] }), 'g1');
  assert.equal(resolveUserEmpresaId({ empresas_vinculadas: [{ empresa_id: 'e1', ativo: false }, { empresa_id: 'e2', ativo: true }] }), 'e2');
});

test('auth state logout and api-key interactive gate', () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  };
  writeLocalAuthState({ logged_in: true, sessao_id: 's1' }, storage);
  assert.equal(readLocalAuthState(storage).logged_in, true);
  markLocalLoggedOut(storage);
  assert.equal(readLocalAuthState(storage).logged_in, false);
  assert.equal(readLocalAuthState(storage).sessao_id, null);

  prepareLocalReauthentication(storage);
  assert.equal(readLocalAuthState(storage).logged_in, true);
  assert.equal(readLocalAuthState(storage).sessao_id, null);

  assert.equal(assertInteractiveAuthAllowed({ isLocalOnlyMode: true, hasApiKey: true, hasUserToken: false }).allowed, true);
  assert.equal(assertInteractiveAuthAllowed({ isLocalOnlyMode: false, hasApiKey: true, hasUserToken: false }).allowed, false);
  assert.equal(assertInteractiveAuthAllowed({ isLocalOnlyMode: false, hasApiKey: true, hasUserToken: true }).allowed, true);
});

test('denied authentication audit keeps controlled reason and scope without raw error data', () => {
  const error = createAuthDeniedError({ reason: 'session_revoked', type: 'auth_required' });
  error.stack = 'sensitive stack';
  const record = buildLocalAuthDeniedAuditRecord({
    error,
    user: { ...admin, full_name: 'Vinicius' },
    sessionId: 'sessao-1',
    id: 'audit-1',
    timestamp: '2026-09-16T12:00:00.000Z',
  });

  assert.equal(record.usuario, 'Vinicius');
  assert.equal(record.group_id, 'local_grupo_cpa');
  assert.equal(record.empresa_id, 'local_empresa_3z');
  assert.equal(record.registro_id, 'sessao-1');
  assert.deepEqual(record.dados_novos, { motivo: 'session_revoked', tipo: 'auth_required' });
  assert.equal(record.sucesso, false);
  assert.doesNotMatch(JSON.stringify(record), /sensitive stack/);
});

test('denied authentication audit replaces unknown provider details with safe values', () => {
  const record = buildLocalAuthDeniedAuditRecord({
    error: { status: 403, message: 'token=secret-value', authType: 'provider_internal' },
    id: 'audit-2',
  });

  assert.equal(record.usuario, 'Usuario nao autenticado');
  assert.deepEqual(record.dados_novos, { motivo: 'auth_required', tipo: 'auth_required' });
  assert.doesNotMatch(JSON.stringify(record), /secret-value|provider_internal/);
});

test('local storage adapter tolerates optional writes and confirms strict writes', () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  };

  try {
    const storage = createLocalStorageAdapter();
    storage.setItem('optional', 'ok');
    storage.setItemStrict('session', 'confirmed');
    assert.equal(storage.getItem('optional'), 'ok');
    assert.equal(storage.getItem('session'), 'confirmed');
    storage.removeItem('optional');
    assert.equal(storage.getItem('optional'), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }

  const unavailable = createLocalStorageAdapter();
  assert.doesNotThrow(() => unavailable.setItem('optional', 'ignored'));
  assert.throws(() => unavailable.setItemStrict('session', 'blocked'), /indisponivel/);
});

test('local auth stack binds session and refuses api-key browser bypass', async () => {
  const policy = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/components/ProtectedRoute.jsx', import.meta.url), 'utf8');
  const sessoes = await readFile(new URL('../src/components/sistema/GerenciadorSessoes.jsx', import.meta.url), 'utf8');

  assert.match(policy, /ensureLocalActiveSession/);
  assert.match(policy, /markLocalLoggedOut/);
  assert.match(policy, /evaluateLocalUserSession\(user, session\)/);
  assert.match(policy, /async logout\(\)/);
  assert.match(client, /assertInteractiveAuthAllowed/);
  assert.doesNotMatch(client, /isAuthenticated = async \(\) => true/);
  assert.match(auth, /authChecked/);
  assert.match(auth, /checkUserAuth/);
  assert.match(auth, /api_key_not_interactive|API key nao autentica/);
  assert.match(route, /authChecked/);
  assert.match(app, /if \(!isAuthenticated\)/);
  assert.match(app, /account_inactive/);
  assert.doesNotMatch(sessoes, /localStorage\.getItem\('group_atual_id'\)/);
  assert.match(sessoes, /filterInContext/);
});
