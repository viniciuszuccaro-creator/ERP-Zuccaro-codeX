import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordAuthSession } from '../src/services/authSessionService.ts';

test('createPasswordAuthSession troca senha por Bearer e lista perfis ativos', async () => {
  const authUserId = '11111111-1111-4111-8111-111111111111';
  const profileId = '22222222-2222-4222-8222-222222222222';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const empresaId = '44444444-4444-4444-8444-444444444444';

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        access_token: 'tok_test_abc',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: authUserId, email: 'synth@dev.synthetic.local' },
      };
    },
  });

  const db = {
    async query() {
      return {
        rows: [{
          id: profileId,
          group_id: groupId,
          empresa_id: empresaId,
          role: 'admin',
          full_name: 'Proprietario Teste',
        }],
      };
    },
  };

  const session = await createPasswordAuthSession({
    config: {
      authMode: 'supabase_user',
      supabaseUrl: 'http://127.0.0.1:8000',
      supabaseAnonKey: 'anon-test',
    },
    db,
    body: { email: 'synth@dev.synthetic.local', password: 'senha-forte-123' },
    fetchImpl,
  });

  assert.equal(session.accessToken, 'tok_test_abc');
  assert.equal(session.user.id, authUserId);
  assert.equal(session.profiles.length, 1);
  assert.equal(session.profiles[0].groupId, groupId);
  assert.equal(session.profiles[0].empresaId, empresaId);
  assert.equal(session.profiles[0].role, 'admin');
  assert.equal(session.profiles[0].fullName, 'Proprietario Teste');
});

test('createPasswordAuthSession rejeita credenciais inválidas sem vazar detalhes', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    async json() { return { error: 'invalid_grant', error_description: 'secret' }; },
  });
  await assert.rejects(
    () => createPasswordAuthSession({
      config: {
        authMode: 'supabase_user',
        supabaseUrl: 'http://127.0.0.1:8000',
        supabaseAnonKey: 'anon-test',
      },
      db: { async query() { return { rows: [] }; } },
      body: { email: 'x@y.com', password: 'senha-forte-123' },
      fetchImpl,
    }),
    (err) => err?.code === 'AUTH_INVALID_CREDENTIALS' && err?.statusCode === 401,
  );
});
