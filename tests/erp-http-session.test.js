import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHttpDevAdminUser,
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

test('persist/readErpHttpSession guarda token + tenant sem exigir Base44 remote', () => {
  const storage = memoryStorage();
  persistErpHttpSession({
    accessToken: 'tok_abc',
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
    email: 'a@b.com',
    storage,
  });
  const session = readErpHttpSession(storage);
  assert.equal(session.token, 'tok_abc');
  assert.equal(session.groupId, '33333333-3333-4333-8333-333333333333');
  assert.equal(session.actorId, '22222222-2222-4222-8222-222222222222');
  clearErpHttpSession(storage);
  assert.equal(readErpHttpSession(storage), null);
});

test('buildHttpDevAdminUser libera role admin + perfil + empresa da sessão', () => {
  const user = buildHttpDevAdminUser({
    groupId: '33333333-3333-4333-8333-333333333333',
    empresaId: '44444444-4444-4444-8444-444444444444',
    actorId: '22222222-2222-4222-8222-222222222222',
    email: 'gate-d.synth@dev.synthetic.local',
  });
  assert.equal(user.role, 'admin');
  assert.equal(user.perfil_acesso_id, 'local_perfil_admin');
  assert.equal(user.empresa_atual_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(user.grupo_atual_id, '33333333-3333-4333-8333-333333333333');
  assert.equal(user.empresas_vinculadas.length, 1);
});
