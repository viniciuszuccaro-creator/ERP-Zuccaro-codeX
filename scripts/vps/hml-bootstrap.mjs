import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = /^[a-f0-9]{40}$/;

// Portable form of the recovered private HML bootstrap; app/Auth/DB remain canonical.
export function validateHmlConfig(value, now = Date.now()) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), ['databaseUrl', 'expected', 'origin', 'provider', 'sha']);
  assert.match(value.sha, sha);
  const origin = new URL(value.origin);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, value.origin);
  const url = new URL(value.databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(url.username && url.password);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.port, '');
  assert.equal(url.hash, '');
  const parameters = [...url.searchParams.keys()];
  assert.deepEqual(parameters.sort(), ['host', 'options']);
  assert.equal(url.searchParams.get('host'), '/run/hml-pg');
  const expected = value.expected;
  assert.deepEqual(Object.keys(expected).sort(), ['authUserId', 'clusterIdentifier', 'database',
    'groupId', 'profileId', 'role', 'schema', 'schemaOid']);
  assert.match(expected.database, /^hml[0-9a-z_]+$/);
  assert.match(expected.schema, /^hml[0-9a-z_]+$/);
  assert.equal(decodeURIComponent(url.pathname.slice(1)), expected.database);
  assert.equal(decodeURIComponent(url.username), expected.role);
  assert.match(expected.clusterIdentifier, /^[0-9]+$/);
  assert.match(expected.schemaOid, /^[0-9]+$/);
  for (const key of ['profileId', 'authUserId', 'groupId']) assert.match(expected[key], uuid);
  assert.equal(url.searchParams.get('options'),
    `-c search_path=${expected.schema},pg_catalog,pg_temp -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000`);
  assert.deepEqual(Object.keys(value.provider).sort(), ['SUPABASE_ANON_KEY', 'SUPABASE_URL']);
  const provider = new URL(value.provider.SUPABASE_URL);
  assert.equal(provider.protocol, 'https:');
  assert.equal(provider.origin, value.provider.SUPABASE_URL);
  const token = JSON.parse(Buffer.from(value.provider.SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
  assert.equal(token.role, 'anon');
  assert.ok(Number.isSafeInteger(token.exp) && token.exp * 1000 > now);
  return value;
}

export function readHmlConfig(file, io = fs, uid = process.getuid?.()) {
  assert.ok(Number.isInteger(uid), 'PRIVATE_CONFIG_OWNER_REQUIRED');
  const stat = io.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.uid, uid);
  assert.equal(stat.mode & 0o077, 0);
  assert.equal(io.realpathSync(file), file);
  return validateHmlConfig(JSON.parse(io.readFileSync(file, 'utf8')));
}

export function hmlAuthFetch(provider, originalFetch) {
  const origin = new URL(provider.SUPABASE_URL).origin;
  return (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input));
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const allowed = (url.pathname === '/auth/v1/user' && method === 'GET')
      || (url.pathname === '/auth/v1/token' && method === 'POST');
    if (url.origin !== origin || url.username || url.password || !allowed) {
      throw new Error('HML_EXTERNAL_EFFECT_BLOCKED');
    }
    return originalFetch(input, { ...init, redirect: 'error' });
  };
}

export async function preflightHml(db, expected) {
  return db.withTransaction(async q => {
    await q.query('SET TRANSACTION READ ONLY');
    const physical = (await q.query(`SELECT current_database() AS database,current_schema() AS schema,
      current_schema()::regnamespace::oid::text AS schema_oid,current_user AS role,session_user AS login,
      (SELECT system_identifier::text FROM pg_control_system()) AS cluster,
      r.rolsuper,r.rolbypassrls,s.rolsuper AS login_super,s.rolbypassrls AS login_bypass,
      (SELECT count(*)::int FROM pg_roles p WHERE (p.rolsuper OR p.rolbypassrls)
        AND pg_has_role(session_user,p.oid,'MEMBER')) AS dangerous_memberships
      FROM pg_roles r JOIN pg_roles s ON s.rolname=session_user WHERE r.rolname=current_user`)).rows[0];
    assert.ok(physical);
    for (const [actual, key] of [['database', 'database'], ['schema', 'schema'], ['schema_oid', 'schemaOid'],
      ['role', 'role'], ['login', 'role'], ['cluster', 'clusterIdentifier']]) {
      assert.equal(physical[actual], expected[key], 'HML_PHYSICAL_TARGET_MISMATCH');
    }
    for (const key of ['rolsuper', 'rolbypassrls', 'login_super', 'login_bypass']) assert.equal(physical[key], false);
    assert.equal(physical.dangerous_memberships, 0);
    await q.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id','',true)", [expected.groupId]);
    const profile = (await q.query(`SELECT id,auth_user_id,group_id,empresa_id,ativo FROM profiles
      WHERE id=$1 AND group_id=$2`, [expected.profileId, expected.groupId])).rows[0];
    assert.ok(profile && profile.ativo === true && profile.empresa_id === null, 'HML_PROFILE_INVALID');
    assert.equal(profile.id, expected.profileId);
    assert.equal(profile.auth_user_id, expected.authUserId);
    assert.equal(profile.group_id, expected.groupId);
    return { database: physical.database, schema: physical.schema, role: physical.role,
      schemaOid: physical.schema_oid, clusterIdentifier: physical.cluster };
  });
}

export async function startHml(file, apiRoot) {
  const source = readHmlConfig(file);
  const { loadConfig } = await import(pathToFileURL(path.join(apiRoot, 'dist/config/env.js')));
  const { createRuntimeDbClients } = await import(pathToFileURL(path.join(apiRoot, 'dist/db/client.js')));
  const { createApp } = await import(pathToFileURL(path.join(apiRoot, 'dist/app.js')));
  const config = loadConfig({ NODE_ENV: 'production', ERP_ENV: 'hml', ERP_AUTH_MODE: 'supabase_user',
    REQUIRE_DATABASE: 'true', ENABLE_TENANT_CONTEXT: 'true', DATABASE_URL: source.databaseUrl,
    AUTH_DATABASE_URL: source.databaseUrl, ...source.provider, APP_VERSION: source.sha, CORS_ORIGINS: source.origin });
  const clients = await createRuntimeDbClients(config);
  const originalFetch = globalThis.fetch;
  try {
    assert.equal(clients.db, clients.authDb);
    await preflightHml(clients.db, source.expected);
    const authFetch = hmlAuthFetch(source.provider, originalFetch);
    globalThis.fetch = authFetch;
    const { app } = createApp({ config, db: clients.db, authDb: clients.authDb,
      tenantContextEnabled: true, authFetchImpl: authFetch });
    const server = app.listen(config.port, '0.0.0.0');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await new Promise(resolve => server.close(resolve));
      await clients.end();
    };
    process.once('SIGTERM', () => void close());
    process.once('SIGINT', () => void close());
    console.log(JSON.stringify({ event: 'HML_CANONICAL_API_READY', sha: source.sha,
      auth: 'supabase_user', physicalVerified: true, externalEffects: false }));
    return { close, server };
  } catch (error) {
    globalThis.fetch = originalFetch;
    await clients.end();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startHml(process.argv[2], process.argv[3]).catch(() => {
    console.error('HML_STARTUP_PREFLIGHT_FAILED');
    process.exitCode = 1;
  });
}
