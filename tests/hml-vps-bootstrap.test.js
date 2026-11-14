import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
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

test('HML review SQL guards abort in memory and minimal rehearsal preserves existing data and controls', async t => {
  const require = createRequire(new URL('../server/package.json', import.meta.url));
  const { PGlite } = require('@electric-sql/pglite');
  // No path, connection URL, environment or real metadata: an isolated in-memory engine.
  const db = new PGlite();
  const schema = 'hml_proposal_synthetic';
  const instantiate = sql => sql.replaceAll(':"verified_hml_schema"', '"' + schema + '"');
  const minimal = await readFile(new URL('../docs/evidence/hml-existing-five-additive-20261114.proposal.sql', import.meta.url), 'utf8');
  const missing = await readFile(new URL('../docs/evidence/hml-missing-object-additive-20261114.proposal.sql', import.meta.url), 'utf8');
  try {
    await db.exec([
      'CREATE SCHEMA hml_proposal_synthetic;',
      'CREATE TABLE hml_proposal_synthetic.marcas(id integer PRIMARY KEY, nome text);',
      'CREATE TABLE hml_proposal_synthetic.clientes(id integer PRIMARY KEY, contatos jsonb, rg text, ativo boolean);',
      "INSERT INTO hml_proposal_synthetic.marcas VALUES(1,'SYNTHETIC BRAND');",
      "INSERT INTO hml_proposal_synthetic.clientes VALUES(1,NULL,'SYNTHETIC_KEEP',false);",
      'CREATE INDEX keep_synthetic_rg ON hml_proposal_synthetic.clientes(rg);',
      'ALTER TABLE hml_proposal_synthetic.clientes ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE hml_proposal_synthetic.clientes FORCE ROW LEVEL SECURITY;',
      'CREATE POLICY keep_synthetic_scope ON hml_proposal_synthetic.clientes USING(ativo=false);',
      'CREATE FUNCTION hml_proposal_synthetic.keep_synthetic_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;',
      'CREATE TRIGGER keep_synthetic_trigger BEFORE UPDATE ON hml_proposal_synthetic.clientes FOR EACH ROW EXECUTE FUNCTION hml_proposal_synthetic.keep_synthetic_trigger();',
    ].join('\n'));
    const snapshot = async () => ({
      columns: (await db.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='hml_proposal_synthetic' ORDER BY table_name,ordinal_position")).rows,
      indexes: (await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='hml_proposal_synthetic' ORDER BY tablename,indexname")).rows,
      policies: (await db.query("SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='hml_proposal_synthetic' ORDER BY tablename,policyname")).rows,
      triggers: (await db.query("SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='hml_proposal_synthetic' ORDER BY event_object_table,trigger_name")).rows,
      constraints: (await db.query("SELECT table_name,constraint_name,constraint_type FROM information_schema.table_constraints WHERE table_schema='hml_proposal_synthetic' ORDER BY table_name,constraint_name")).rows,
      rows: (await db.query('SELECT id,contatos,rg,ativo FROM hml_proposal_synthetic.clientes ORDER BY id')).rows,
      brands: (await db.query('SELECT id,nome FROM hml_proposal_synthetic.marcas ORDER BY id')).rows,
    });
    const before = await snapshot();
    for (const [sql, message] of [
      [minimal, 'HML_SCHEMA_PROPOSAL_ONLY_NOT_AUTHORIZED'],
      [missing, 'HML_OBJECT_DELTA_PROPOSAL_ONLY_NOT_AUTHORIZED'],
    ]) {
      await assert.rejects(db.exec(instantiate(sql)), error => (
        error.code === 'P0001' && error.message.includes(message)
      ));
      await db.exec('ROLLBACK');
      assert.deepEqual(await snapshot(), before);
    }
    // Only this transient string in this synthetic engine is unguarded; never persist it.
    // This validates the three minimal clauses, NOT the incomplete missing-object overlay.
    const rehearsal = instantiate(minimal)
      .replace(/DO \$review_gate\$[\s\S]*?\$review_gate\$;/, '')
      .replace(/ROLLBACK;\s*$/, '');
    assert.ok(!rehearsal.includes('HML_SCHEMA_PROPOSAL_ONLY_NOT_AUTHORIZED'));
    await db.exec(rehearsal);
    assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='hml_proposal_synthetic' AND table_name='marcas' AND column_name IN ('codigo','codigo_origem') ORDER BY column_name")).rows,
      [{ column_name: 'codigo' }, { column_name: 'codigo_origem' }]);
    assert.deepEqual((await db.query('SELECT codigo,codigo_origem FROM hml_proposal_synthetic.marcas WHERE id=1')).rows,
      [{ codigo: null, codigo_origem: null }]);
    assert.equal((await db.query("SELECT column_default FROM information_schema.columns WHERE table_schema='hml_proposal_synthetic' AND table_name='clientes' AND column_name='contatos'")).rows[0].column_default, "'[]'::jsonb");
    assert.deepEqual((await db.query('SELECT id,contatos,rg,ativo FROM hml_proposal_synthetic.clientes WHERE id=1')).rows, before.rows);
    await db.exec("INSERT INTO hml_proposal_synthetic.clientes(id,rg,ativo) VALUES(2,'SYNTHETIC_NEW',false)");
    assert.deepEqual((await db.query('SELECT contatos FROM hml_proposal_synthetic.clientes WHERE id=2')).rows[0].contatos, []);
    const during = await snapshot();
    for (const key of ['indexes', 'policies', 'triggers', 'constraints', 'brands']) {
      assert.deepEqual(during[key], before[key]);
    }
    await db.exec('ROLLBACK');
    assert.deepEqual(await snapshot(), before);
    t.diagnostic('Embedded PostgreSQL synthetic memory only; no restored HML, real-role authorization or complete overlay claim.');
  } finally {
    await db.close();
  }
});
