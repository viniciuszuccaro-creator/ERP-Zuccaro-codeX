import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHmlConfig, readHmlConfig, hmlAuthFetch, preflightHml } from '../scripts/vps/hml-bootstrap.mjs';

function fixture() {
  const expected = { database: 'hml_test', schema: 'hml_test', role: 'hml_app',
    clusterIdentifier: '123456', schemaOid: '17000',
    groupId: '10000000-0000-4000-8000-000000000001',
    profileId: '10000000-0000-4000-8000-000000000002',
    authUserId: '10000000-0000-4000-8000-000000000003' };
  const url = new URL('postgresql://hml_app:synthetic@localhost/hml_test');
  url.searchParams.set('host', '/run/hml-pg');
  url.searchParams.set('options', '-c search_path=hml_test,pg_catalog,pg_temp -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000');
  return { expected, databaseUrl: url.href, sha: 'a'.repeat(40), origin: 'https://hml.example.test',
    provider: { SUPABASE_URL: 'https://auth.example.test',
      SUPABASE_ANON_KEY: 'synthetic.' + Buffer.from(JSON.stringify({ role: 'anon', exp: 4102444800 })).toString('base64url') + '.signature' } };
}

test('HML config rejects operational/fallback/privileged provider settings', () => {
  assert.equal(validateHmlConfig(fixture()).sha, 'a'.repeat(40));
  for (const change of [v => { v.extra = true; }, v => { v.sha = 'main'; },
    v => { v.expected.database = 'postgres'; }, v => { v.expected.schema = 'public'; },
    v => { v.origin = 'http://hml.example.test'; }, v => { v.databaseUrl += '&options=-c+search_path=public'; },
    v => { v.expected.role = 'postgres'; }, v => { v.expected.profileId = ''; },
    v => { v.provider.SUPABASE_SERVICE_ROLE_KEY = 'synthetic'; },
    v => { v.provider.SUPABASE_URL = 'http://auth.example.test'; },
    v => { v.provider.SUPABASE_ANON_KEY = 'synthetic.' + Buffer.from(JSON.stringify({ role: 'service_role', exp: 4102444800 })).toString('base64url') + '.sig'; }]) {
    const value = fixture(); change(value); assert.throws(() => validateHmlConfig(value));
  }
  assert.throws(() => validateHmlConfig(fixture(), 4102444800001));
});

test('HML private config checks owner, permissions, symlink and real path', () => {
  const file = '/run/hml/config.json';
  const exercise = options => readHmlConfig(file, {
    lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => options?.link || false,
      uid: options?.uid ?? 1000, mode: options?.mode ?? 0o100600 }),
    realpathSync: () => options?.real || file,
    readFileSync: () => JSON.stringify(fixture()),
  }, 1000);
  assert.equal(exercise().origin, fixture().origin);
  for (const value of [{ link: true }, { uid: 0 }, { mode: 0o100640 }, { real: '/other/config.json' }]) {
    assert.throws(() => exercise(value));
  }
});

test('HML egress allows only real-provider user GET/token POST and refuses redirects', async () => {
  const calls = []; const fetch = hmlAuthFetch(fixture().provider, async (...args) => { calls.push(args); return 'ok'; });
  assert.equal(await fetch('https://auth.example.test/auth/v1/user'), 'ok');
  assert.equal(await fetch(new Request('https://auth.example.test/auth/v1/token?grant_type=password', { method: 'POST' })), 'ok');
  assert.equal(calls.length, 2); assert.ok(calls.every(([, options]) => options.redirect === 'error'));
  for (const [url, method] of [['https://other.test/auth/v1/user', 'GET'],
    ['https://auth.example.test/auth/v1/signup', 'POST'], ['https://auth.example.test/auth/v1/user', 'DELETE'],
    ['https://auth.example.test/auth/v1/token', 'GET'], ['https://auth.example.test/messages', 'POST'],
    ['https://user:password@auth.example.test/auth/v1/user', 'GET']]) {
    assert.throws(() => fetch(url, { method }), /HML_EXTERNAL_EFFECT_BLOCKED/);
  }
  assert.equal(calls.length, 2);
});

function database(changes = {}) {
  const expected = fixture().expected;
  const physical = { database: expected.database, schema: expected.schema, schema_oid: expected.schemaOid,
    role: expected.role, login: expected.role, cluster: expected.clusterIdentifier, rolsuper: false,
    rolbypassrls: false, login_super: false, login_bypass: false, dangerous_memberships: 0, ...changes.physical };
  const profile = { id: expected.profileId, group_id: expected.groupId, auth_user_id: expected.authUserId,
    empresa_id: null, ativo: true, ...changes.profile };
  const queries = [];
  return { queries, withTransaction: fn => fn({ query: async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('pg_control_system')) return { rows: changes.absentPhysical ? [] : [physical] };
    if (sql.includes('FROM profiles')) return { rows: changes.absentProfile ? [] : [profile] };
    return { rows: [] };
  } }) };
}

test('HML preflight checks physical identity, direct/inherited privileges and exact group profile', async () => {
  const expected = fixture().expected; const db = database();
  assert.equal((await preflightHml(db, expected)).clusterIdentifier, expected.clusterIdentifier);
  assert.equal(db.queries[0][0], 'SET TRANSACTION READ ONLY');
  assert.deepEqual(db.queries[2][1], [expected.groupId]);
  assert.deepEqual(db.queries[3][1], [expected.profileId, expected.groupId]);
  for (const change of [{ absentPhysical: true }, { absentProfile: true },
    ...['database', 'schema', 'schema_oid', 'role', 'login', 'cluster'].map(k => ({ physical: { [k]: 'wrong' } })),
    ...['rolsuper', 'rolbypassrls', 'login_super', 'login_bypass'].map(k => ({ physical: { [k]: true } })),
    { physical: { dangerous_memberships: 1 } }, { profile: { ativo: false } }, { profile: { empresa_id: expected.groupId } },
    ...['id', 'group_id', 'auth_user_id'].map(k => ({ profile: { [k]: 'wrong' } }))]) {
    await assert.rejects(preflightHml(database(change), expected));
  }
});
