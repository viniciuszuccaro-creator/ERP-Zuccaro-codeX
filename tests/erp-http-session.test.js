import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHttpDevAdminUser,
  buildHttpSessionUser,
  clearErpHttpSession,
  persistErpHttpSession,
  readErpHttpSession,
} from '../src/api/erpHttpSession.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('persist/readErpHttpSession guarda token + tenant + role sem exigir Base44 remote', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_abc',
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
    email: 'a@b.com',
    role: 'admin',
    fullName: 'Proprietario',
    storage,
  });
  const session = readErpHttpSession(storage);
  assert.equal(session.token, 'tok_abc');
  assert.equal(session.groupId, '33333333-3333-4333-8333-333333333333');
  assert.equal(session.actorId, '22222222-2222-4222-8222-222222222222');
  assert.equal(session.role, 'admin');
  assert.equal(session.fullName, 'Proprietario');
  clearErpHttpSession(storage);
  assert.equal(readErpHttpSession(storage), null);
});

test('buildHttpSessionUser libera admin só quando role=admin no perfil', () => {
  const admin = buildHttpSessionUser({
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
    email: 'vinicius.zuccaro@gmail.com',
    role: 'admin',
    fullName: 'Vinicius Zuccaro',
  });
  assert.equal(admin.role, 'admin');
  assert.equal(admin.perfil_acesso_id, 'local_perfil_admin');
  assert.equal(admin.pode_ver_todas_empresas, true);
  assert.equal(admin.full_name, 'Vinicius Zuccaro');
  assert.equal(admin.empresa_atual_id, '44444444-4444-4444-8444-444444444444');

  const synth = buildHttpSessionUser({
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
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
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
    email: 'gate-d.synth@dev.synthetic.local',
    role: 'user',
  });
  assert.equal(user.role, 'user');
  assert.equal(user.perfil_acesso_id, null);
});
