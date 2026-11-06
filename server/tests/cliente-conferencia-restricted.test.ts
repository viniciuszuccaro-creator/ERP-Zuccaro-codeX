import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import pg from 'pg';
import type { QueryResultRow } from 'pg';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createRuntimeDbClients, type DbClient } from '../src/db/client.ts';
import { assertCrmIsolatedUrl } from './helpers/crmPostgresFixture.ts';
import { AUTH_IDS as I, authColumnGrants, authPolicy } from './helpers/authBootstrapFixture.ts';

test('conference restricted fixture refuses an unverified PostgreSQL destination', () => {
  for (const value of [undefined, 'postgresql://example.test/erp_test', 'postgresql://localhost/postgres']) {
    assert.throws(() => assertCrmIsolatedUrl(value), /CRM_ISOLATED_POSTGRES_REQUIRED/);
  }
});

const url = process.env.DATABASE_URL;
test('conference PostgreSQL contract: existing two-pool runtime, restricted logins, forced RLS and exact readonly requests',
  { skip: !url ? 'Isolated PostgreSQL URL required; not a PGlite proof' : false }, async t => {
  assertCrmIsolatedUrl(url);
  if (!url) throw new Error('ISOLATED_POSTGRES_REQUIRED');
  const tag = randomUUID().replaceAll('-', ''), schema = 'cf_' + tag;
  const authRole = 'cf_auth_' + tag, dataRole = 'cf_data_' + tag;
  const foreignRole = 'cf_foreign_' + tag;
  const admin = new pg.Pool({ connectionString: url, max: 2 });
  let clients: Awaited<ReturnType<typeof createRuntimeDbClients>> | undefined;
  let server: ReturnType<ReturnType<typeof createApp>['app']['listen']> | undefined;
  let provider: ReturnType<typeof createServer> | undefined;
  let providerActive = true;
  let schemaCreated = false, rolesCreated = false;
  const a = await admin.connect();
  try {
    t.diagnostic('Synthetic PostgreSQL server_version_num=' + (await a.query('SHOW server_version_num')).rows[0].server_version_num);
    const password = randomUUID(); // Ephemeral synthetic fixture only; never returned or logged.
    await a.query(`CREATE SCHEMA ${schema}`); schemaCreated = true;
    await a.query(`SET search_path=${schema},pg_catalog`);
    // Only the existing 001-009 structural contract. In particular, no 036-044 policies/indexes are assumed.
    const dir = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter(n => /^00[1-9]_.*\.sql$/.test(n)).sort()) {
      await a.query((await readFile(new URL(name, dir), 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    }
    const columns = await a.query(`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
      WHERE table_schema=$1 AND table_name IN ('clientes','profiles','groups','empresas')`, [schema]);
    const tuples = columns.rows.map(r => [r.table_name, r.column_name, r.data_type, r.is_nullable])
      .sort((x, y) => JSON.stringify(x) < JSON.stringify(y) ? -1 : 1);
    assert.equal(tuples.length, 55);
    // Sanitized structural projection captured read-only from the destination; NOT an applied-SQL attestation.
    assert.equal(createHash('sha256').update(JSON.stringify(tuples)).digest('hex'),
      '24479a48be3ef8f772eab46d41fec69706ce704f2b986b95485b3d6e325dfd3e');
    await a.query(`INSERT INTO groups(id,nome_do_grupo) VALUES($1,'Synthetic A'),($2,'Synthetic B')`, [I.group, I.other]);
    await a.query(`INSERT INTO empresas(id,group_id,razao_social) VALUES($1,$2,'Synthetic 1'),($3,$2,'Synthetic 2')`,
      [I.company, I.group, I.second]);
    const permissions = { Cadastros: { cliente: ['visualizar', 'importar'] } };
    for (const [id, auth, group, company] of [
      [I.ownerProfile, I.owner, I.group, null], [I.branchProfile, I.branch, I.group, I.company],
      [I.foreignProfile, I.foreign, I.other, null],
    ]) await a.query(`INSERT INTO profiles(id,auth_user_id,email,group_id,empresa_id,permissoes)
      VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [id, auth, id + '@synthetic.test', group, company, JSON.stringify(permissions)]);
    const client = randomUUID(), foreign = randomUUID();
    await a.query(`INSERT INTO clientes(id,group_id,codigo,tipo,source_system,codigo_legado,ativo)
      VALUES($1,$2,'000001','Pessoa Jurídica','SYNTHETIC_CONFERENCE','native-001',false),
      ($3,$4,'000001','Pessoa Jurídica','SYNTHETIC_CONFERENCE','native-001',true)`, [client, I.group, foreign, I.other]);
    await a.query(`CREATE ROLE ${authRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${password}';
      CREATE ROLE ${dataRole} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${password}';
      CREATE ROLE ${foreignRole} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`);
    rolesCreated = true;
    await a.query(`GRANT USAGE ON SCHEMA ${schema} TO ${authRole},${dataRole},${foreignRole}`);
    await a.query(authColumnGrants(authRole));
    await a.query(authColumnGrants(foreignRole)); // Models the destination's pre-existing broad grants, not a new operational grant.
    const clientColumns = columns.rows.filter(r => r.table_name === 'clientes').map(r => r.column_name);
    assert.equal(clientColumns.length, 28);
    await a.query(`GRANT SELECT(id,ativo,group_id,empresa_id,permissoes) ON profiles TO ${dataRole};
      GRANT SELECT(${clientColumns.join(',')}) ON clientes TO ${dataRole}`);
    const connection = (role: string) => {
      const u = new URL(url); u.username = role; u.password = password;
      u.searchParams.set('options', '-c search_path=' + schema + ',pg_catalog'); return u.toString();
    };
    provider = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      const token = req.headers.authorization;
      if (!providerActive || token === 'Bearer expired' || !['Bearer owner', 'Bearer branch'].includes(token || '')
        || req.url !== '/auth/v1/user' || req.method !== 'GET') {
        res.statusCode = 401; res.end('{}'); return;
      }
      res.end(JSON.stringify({ id: token === 'Bearer branch' ? I.branch : I.owner, email: 'owner@synthetic.test' }));
    }).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => provider!.once('listening', resolve));
    const providerAddress = provider.address(); assert.ok(providerAddress && typeof providerAddress !== 'string');
    const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', ERP_AUTH_MODE: 'supabase_user',
      DATABASE_URL: connection(dataRole), AUTH_DATABASE_URL: connection(authRole), ENABLE_TENANT_CONTEXT: 'true',
      SUPABASE_URL: 'http://127.0.0.1:' + providerAddress.port, SUPABASE_ANON_KEY: 'synthetic', APP_VERSION: 'conference-restricted-fixture' });
    clients = await createRuntimeDbClients(config);
    let points = 0, writes = 0, revokeAfterPoint = false;
    const data = clients.db;
    const db: DbClient = { ...data, query: async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
      if (!/^\s*SELECT\b/i.test(sql)) { writes++; throw new Error('BUSINESS_WRITE_FORBIDDEN'); }
      const isPoint = /FROM clientes\b/i.test(sql);
      if (isPoint) {
        points++;
        assert.match(sql, /WHERE group_id\s*=\s*\$1 AND (documento_normalizado\s*=\s*\$2|source_system=\$2 AND codigo_legado=\$3)/);
        assert.match(sql, /LIMIT 2\b/);
      }
      const result = await data.query<T>(sql, params);
      if (isPoint && revokeAfterPoint) {
        revokeAfterPoint = false;
        await a.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', ['{}', I.ownerProfile]);
      }
      return result;
    } };
    const runtime = createApp({ config, db, authDb: clients.authDb, tenantContextEnabled: true });
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const input = { identidades: [{ sourceSystem: 'SYNTHETIC_CONFERENCE', codigoLegado: 'native-001' }] };
    const request = (body: unknown = input, group: string = I.group, token = 'owner', company?: string) =>
      fetch('http://127.0.0.1:' + address.port + '/api/v1/clientes/conferencia-legado', { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-group-id': group,
          ...(company ? { 'x-empresa-id': company } : {}) }, body: JSON.stringify(body) });
    // Existing forced RLS without policies: grants alone cannot release the channel.
    assert.equal((await request()).status, 403); assert.equal(points, 0);
    await a.query(await authPolicy()); // Exact historical 042, unchanged, in this isolated fixture only.
    const foreignReads = async () => {
      await a.query('BEGIN READ ONLY');
      try {
        await a.query(`SET LOCAL ROLE ${foreignRole}`);
        await a.query("SELECT set_config('app.auth_user_id',$1,true)", [I.owner]);
        const counts = [];
        for (const table of ['profiles', 'groups', 'empresas']) counts.push((await a.query(`SELECT id FROM ${table}`)).rows.length);
        return counts;
      } finally { await a.query('ROLLBACK'); }
    };
    // 042 alone plus existing broad grants is insufficient against another SQL principal forging the GUC.
    assert.deepEqual(await foreignReads(), [1, 1, 2]);
    await a.query(`CREATE POLICY conference_fixture_auth_profile_guard ON profiles AS RESTRICTIVE FOR SELECT TO PUBLIC
      USING(current_user IN ('${authRole}','${dataRole}'));
      CREATE POLICY conference_fixture_auth_group_guard ON groups AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='${authRole}');
      CREATE POLICY conference_fixture_auth_company_guard ON empresas AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='${authRole}');
      CREATE POLICY conference_fixture_profile ON profiles FOR SELECT TO ${dataRole}
      USING(ativo AND group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
        AND (empresa_id IS NULL OR empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid));
      CREATE POLICY conference_fixture_client ON clientes FOR SELECT TO ${dataRole}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)`);
    assert.deepEqual(await foreignReads(), [0, 0, 0]);
    const snapshot = async () => JSON.stringify((await a.query('SELECT to_jsonb(c) AS row FROM clientes c ORDER BY id')).rows);
    const before = await snapshot();
    const good = await request(); assert.equal(good.status, 200);
    assert.deepEqual((await good.json()).data, [{ indice: 0, documento: null, legado: { id: client, codigo: '000001', ativo: false } }]);
    const restored = await fetch('http://127.0.0.1:' + address.port + '/api/v1/auth/session',
      { headers: { authorization: 'Bearer owner' } });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).data.profiles[0].empresas.length, 2);
    const zeroPoint = async (status: number, args: Parameters<typeof request>) => {
      const previous = points; assert.equal((await request(...args)).status, status); assert.equal(points, previous);
    };
    await zeroPoint(403, [input, I.other]);
    await zeroPoint(403, [input, I.group, 'branch', I.second]);
    await zeroPoint(403, [input, I.group, 'branch', I.company]); // Auth accepts own company; conference requires Group.
    await zeroPoint(401, [input, I.group, 'expired']);
    await zeroPoint(422, [{ identidades: Array(101).fill(input.identidades[0]) }]);
    await data.withTenantContext!({ groupId: I.group }, async () => {
      assert.equal((await data.query('SELECT id FROM clientes WHERE group_id=$1 AND source_system=$2 AND codigo_legado=$3 LIMIT 2',
        [I.other, 'SYNTHETIC_CONFERENCE', 'native-001'])).rows.length, 0);
      for (const sql of ['UPDATE clientes SET ativo=true WHERE false', 'DELETE FROM clientes WHERE false',
        "INSERT INTO clientes(group_id,codigo,tipo) VALUES('" + I.group + "','000099','Pessoa Jurídica')"]) {
        await assert.rejects(data.query(sql), /permission denied/i);
      }
    });
    assert.equal((await data.query("SELECT NULLIF(current_setting('app.group_id',true),'') AS id")).rows[0].id, null);
    assert.equal((await data.query('SELECT id FROM clientes WHERE id=$1', [client])).rows.length, 0);
    await assert.rejects(clients.authDb.withAuthIdentity!(I.owner, q => q.query('UPDATE profiles SET ativo=false WHERE false')),
      /permission denied|read-only/i);
    revokeAfterPoint = true; assert.equal((await request()).status, 403);
    await zeroPoint(403, []);
    await a.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), I.ownerProfile]);
    providerActive = false; await zeroPoint(401, []); providerActive = true;
    assert.equal(await snapshot(), before); assert.equal(writes, 0);
    // The real destination has no 043 unique legacy index. Bound the fail-closed read instead of assuming that migration.
    const duplicate = randomUUID();
    await a.query(`INSERT INTO clientes(id,group_id,codigo,tipo,source_system,codigo_legado)
      VALUES($1,$2,'000002','Pessoa Jurídica','SYNTHETIC_CONFERENCE','native-001')`, [duplicate, I.group]);
    const saved = points; assert.equal((await request()).status, 409); assert.equal(points - saved, 1);
    assert.equal((await a.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n, 0);
    t.diagnostic('Representative 55-column projection matches read-only target metadata; no applied-SQL equivalence claimed');
    t.diagnostic('Synthetic restricted Auth/Data logins, RLS, real middleware/service/repository; no operational role/grant changes');
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
    if (provider) await new Promise<void>((resolve, reject) => provider!.close(e => e ? reject(e) : resolve()));
    await clients?.end(); a.release();
    try {
      if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      if (rolesCreated) await admin.query(`DROP ROLE ${authRole};DROP ROLE ${dataRole};DROP ROLE ${foreignRole}`);
    } finally { await admin.end(); }
  }
});
