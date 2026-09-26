import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHttpDevAdminUser,
  buildHttpSessionUser,
  clearErpHttpSession,
  loginErpHttpSession,
  persistErpHttpSession,
  readErpHttpSession,
  switchErpHttpSessionEmpresa,
} from '../src/api/erpHttpSession.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

const GROUP = '33333333-3333-4333-8333-333333333333';
const EMPRESA_A = '44444444-4444-4444-8444-444444444444';
const EMPRESA_B = '55555555-5555-4555-8555-555555555555';
const ACTOR = '22222222-2222-4222-8222-222222222222';

test('persist/readErpHttpSession guarda token + tenant + role + expiresAt', () => {
  const storage = memoryStorage();
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  persistErpHttpSession({
    accessToken: 'tok_abc',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'a@b.com',
    role: 'admin',
    fullName: 'Proprietario',
    expiresAt,
    storage,
  });
  const session = readErpHttpSession(storage);
  assert.equal(session.token, 'tok_abc');
  assert.equal(session.groupId, GROUP);
  assert.equal(session.actorId, ACTOR);
  assert.equal(session.role, 'admin');
  assert.equal(session.fullName, 'Proprietario');
  assert.equal(session.expiresAt, expiresAt);
  clearErpHttpSession(storage);
  assert.equal(readErpHttpSession(storage), null);
});

test('buildHttpSessionUser libera admin só quando role=admin no perfil', () => {
  const admin = buildHttpSessionUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'vinicius.zuccaro@gmail.com',
    role: 'admin',
    fullName: 'Vinicius Zuccaro',
  });
  assert.equal(admin.role, 'admin');
  assert.equal(admin.perfil_acesso_id, 'local_perfil_admin');
  assert.equal(admin.pode_ver_todas_empresas, true);
  assert.equal(admin.full_name, 'Vinicius Zuccaro');
  assert.equal(admin.empresa_atual_id, EMPRESA_A);

  const synth = buildHttpSessionUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'gate-d.synth@dev.synthetic.local',
    role: 'user',
    fullName: 'Synth DEV',
  });
  assert.equal(synth.role, 'user');
  assert.equal(synth.perfil_acesso_id, null);
  assert.equal(synth.pode_ver_todas_empresas, false);
  assert.equal(synth.full_name, 'Synth DEV');
});

test('buildHttpDevAdminUser permanece alias de buildHttpSessionUser (sem forçar admin)', () => {
  const user = buildHttpDevAdminUser({
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'gate-d.synth@dev.synthetic.local',
    role: 'user',
  });
  assert.equal(user.role, 'user');
  assert.equal(user.perfil_acesso_id, null);
});

test('sessão expirada é limpa (fail-closed)', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_exp',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    role: 'admin',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    storage,
  });
  assert.equal(readErpHttpSession(storage, { now: Date.now() }), null);
  assert.equal(storage.getItem('erp_runtime_scope'), null);
  assert.equal(storage.getItem('base44_access_token'), null);
});

test('armazenamento adulterado (JSON inválido / role / uuid) é limpo', () => {
  const badJson = memoryStorage({ erp_runtime_scope: '{not-json' });
  assert.equal(readErpHttpSession(badJson), null);

  const badRole = memoryStorage();
  badRole.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: GROUP,
    actorId: ACTOR,
    empresaId: EMPRESA_A,
    role: 'superadmin',
  }));
  assert.equal(readErpHttpSession(badRole), null);

  const badUuid = memoryStorage();
  badUuid.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: 'not-a-uuid',
    actorId: ACTOR,
    role: 'admin',
  }));
  assert.equal(readErpHttpSession(badUuid), null);

  const badEmpresa = memoryStorage();
  badEmpresa.setItem('erp_runtime_scope', JSON.stringify({
    token: 'tok',
    groupId: GROUP,
    actorId: ACTOR,
    empresaId: 'empresa-adulterada',
    role: 'user',
  }));
  assert.equal(readErpHttpSession(badEmpresa), null);
});

test('troca de empresa atualiza sessão HTTP preservando token e expiração', () => {
  const storage = memoryStorage();
  const expiresAt = new Date(Date.now() + 7200_000).toISOString();
  persistErpHttpSession({
    accessToken: 'tok_switch',
    groupId: GROUP,
    empresaId: EMPRESA_A,
    actorId: ACTOR,
    email: 'owner@example.com',
    role: 'admin',
    expiresAt,
    storage,
  });
  const switched = switchErpHttpSessionEmpresa({ empresaId: EMPRESA_B, storage });
  assert.equal(switched.empresaId, EMPRESA_B);
  assert.equal(switched.token, 'tok_switch');
  assert.equal(switched.groupId, GROUP);
  assert.equal(switched.expiresAt, expiresAt);
  assert.equal(readErpHttpSession(storage).empresaId, EMPRESA_B);
});

test('loginErpHttpSession persiste expires_in e monta admin/comum conforme role HTTP', async () => {
  const adminBody = {
    data: {
      access_token: 'tok_admin',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com' },
      profiles: [{
        id: ACTOR,
        group_id: GROUP,
        empresa_id: EMPRESA_A,
        role: 'admin',
        full_name: 'Admin Real',
      }],
    },
  };
  const commonBody = {
    data: {
      access_token: 'tok_user',
      token_type: 'bearer',
      expires_in: 1800,
      user: { id: '11111111-1111-4111-8111-111111111112', email: 'user@example.com' },
      profiles: [{
        id: ACTOR,
        group_id: GROUP,
        empresa_id: EMPRESA_B,
        role: 'user',
        full_name: 'Usuario Comum',
      }],
    },
  };

  const adminStorage = memoryStorage();
  const origLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: adminStorage,
  });
  try {
    const admin = await loginErpHttpSession({
      email: 'admin@example.com',
      password: 'senha-forte-123',
      baseUrl: '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() { return adminBody; },
      }),
    });
    assert.equal(admin.role, 'admin');
    assert.equal(admin.user.role, 'admin');
    assert.ok(admin.expiresAt);
    assert.equal(readErpHttpSession(adminStorage).role, 'admin');
    assert.equal(readErpHttpSession(adminStorage).empresaId, EMPRESA_A);

    clearErpHttpSession(adminStorage);
    const common = await loginErpHttpSession({
      email: 'user@example.com',
      password: 'senha-forte-123',
      baseUrl: '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() { return commonBody; },
      }),
    });
    assert.equal(common.role, 'user');
    assert.equal(common.user.role, 'user');
    assert.equal(common.empresaId, EMPRESA_B);
    assert.equal(readErpHttpSession(adminStorage).role, 'user');
  } finally {
    if (origLocal === undefined) {
      delete globalThis.localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: origLocal,
      });
    }
  }
});
