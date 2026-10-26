import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { QueryResultRow } from 'pg';
import { localCrmFixture } from './helpers/crmFixture.ts';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { SEED_IDS as ID, SEED_DOCS as DOC } from '../scripts/seedDevIds.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { createInMemoryClienteRepo } from '../src/repositories/inMemoryClienteRepository.ts';
import type { DbClient } from '../src/db/client.ts';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { createHttpApiClient } from '../../src/api/httpApiClient.js';

test('canonical memory document lookup refuses duplicates instead of choosing an arbitrary inactive/history row', async () => {
  const repo = createInMemoryClienteRepo(), scope = { groupId: ID.groupA };
  const first = await repo.create(scope, { tipo: 'Pessoa Jurídica', documento: DOC.clientePjA, ativo: true });
  const second = await repo.create(scope, { tipo: 'Pessoa Jurídica', documento: DOC.clientePjB, ativo: false });
  // Simulate pre-existing inconsistent data in this disposable memory fixture, not an import or merge.
  second.documento_normalizado = first.documento_normalizado;
  await assert.rejects(repo.findByDocumento(ID.groupA, DOC.clientePjA), { statusCode: 409, code: 'LEGACY_RECONCILIATION_REQUIRED' });
  assert.equal(await repo.findByDocumento(ID.groupB, DOC.clientePjA), null);
  assert.equal(first.ativo, true); assert.equal(second.ativo, false);
});

test('canonical SQL + Supabase middleware + RBAC + HTTP adapter deny ambiguous documents without business writes', async t => {
  const url = process.env.CLIENTE_CONFERENCIA_PG_TEST_URL;
  const fixture = url ? await realCrmFixture(url) : await localCrmFixture();
  const { admin } = fixture;
  let server: ReturnType<ReturnType<typeof createApp>['app']['listen']> | undefined;
  try {
    await admin.query('UPDATE clientes SET empresa_id=NULL,source_system=$1,codigo_legado=$2 WHERE id=$3',
      ['SYNTHETIC_CONFERENCE', 'native-001', ID.clientePjA]);
    const permissions = { Cadastros: { cliente: ['visualizar', 'importar'] } };
    await admin.query('UPDATE profiles SET empresa_id=NULL,permissoes=$1::jsonb,auth_user_id=$3 WHERE id=$2',
      [JSON.stringify(permissions), ID.runtimeActorA, randomUUID()]);
    const profile = (await admin.query<{ auth_user_id: string }>('SELECT auth_user_id FROM profiles WHERE id=$1', [ID.runtimeActorA])).rows[0];
    assert.ok(profile?.auth_user_id);
    const repo = new PostgresClienteRepository(admin), original = await repo.findByDocumento(ID.groupA, DOC.clientePjA);
    assert.ok(original); assert.equal(original.id, ID.clientePjA);
    assert.equal(await repo.findByDocumento(ID.groupA, '00000000000000'), null);
    assert.equal(await repo.findByDocumento(ID.groupB, DOC.clientePjA), null);
    const duplicateId = randomUUID();
    const insertDuplicate = () => admin.query(`INSERT INTO clientes
      SELECT (jsonb_populate_record(NULL::clientes,to_jsonb(c)||jsonb_build_object(
        'id',$1::text,'codigo','900099','ativo',false,'source_system',NULL,'codigo_legado',NULL,'email',NULL))).*
      FROM clientes c WHERE c.id=$2`, [duplicateId, ID.clientePjA]);
    await assert.rejects(insertDuplicate(), /uq_clientes_group_documento|unique constraint/);
    // Only this newly created isolated fixture models a drifted historical destination.
    // No applied migration or operational index is modified by this test.
    await fixture.exec('DROP INDEX uq_clientes_group_documento');
    await insertDuplicate();
    await assert.rejects(repo.findByDocumento(ID.groupA, DOC.clientePjA), { statusCode: 409, code: 'LEGACY_RECONCILIATION_REQUIRED' });

    let points = 0, writes = 0, authenticated = true;
    let afterPoint: (() => Promise<void>) | undefined;
    const query: DbClient['query'] = async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
      if (!/^\s*SELECT\b/i.test(sql)) { writes++; throw new Error('BUSINESS_WRITE_FORBIDDEN'); }
      if (/FROM clientes\b/i.test(sql)) {
        assert.match(sql, /WHERE group_id\s*=\s*\$1 AND (documento_normalizado\s*=\s*\$2|source_system=\$2 AND codigo_legado=\$3)/);
        if (/documento_normalizado/.test(sql)) assert.match(sql, /LIMIT 2\b/);
        points++;
      }
      const result = await admin.query<T>(sql, params);
      if (/FROM clientes\b/i.test(sql) && afterPoint) { const run = afterPoint; afterPoint = undefined; await run(); }
      return result;
    };
    const db: DbClient = { ...admin, query };
    const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'dev', REQUIRE_DATABASE: 'false',
      DATABASE_URL: 'postgresql://synthetic.invalid/erp_test', ERP_AUTH_MODE: 'supabase_user',
      SUPABASE_URL: 'https://auth.synthetic.test', SUPABASE_ANON_KEY: 'synthetic', CORS_ORIGINS: 'http://127.0.0.1:4175' });
    const runtime = createApp({ config, db, authFetchImpl: async (_url, init) => {
      assert.equal(String(_url).startsWith('https://auth.synthetic.test/'), true);
      const token = new Headers(init?.headers).get('authorization');
      return token === 'Bearer synthetic-valid' && authenticated
        ? new Response(JSON.stringify({ id: profile.auth_user_id }), { status: 200 })
        : new Response('{}', { status: 401 });
    } });
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const baseUrl = 'http://127.0.0.1:' + address.port;
    const scope = { groupId: ID.groupA, actorId: ID.runtimeActorA, token: 'synthetic-valid' };
    const api = createHttpApiClient({ baseUrl, getScope: () => scope });
    const input = { identidades: [{ documento: DOC.clientePjA, sourceSystem: 'SYNTHETIC_CONFERENCE', codigoLegado: 'native-001' }] };
    const snapshot = async () => JSON.stringify((await admin.query('SELECT to_jsonb(c) AS row FROM clientes c ORDER BY id')).rows);
    const before = await snapshot(), audits = (await admin.query('SELECT count(*)::text AS count FROM audit_logs')).rows[0].count;
    await assert.rejects(api.clientes.conferirLegado(input), { status: 409 });
    assert.equal(points, 1); // No fallback to the unambiguous legacy key after ambiguous document.
    assert.equal(await snapshot(), before);
    await admin.query('DELETE FROM clientes WHERE id=$1', [duplicateId]); // Fixture cleanup only.
    const settled = await snapshot();
    assert.deepEqual(await api.clientes.conferirLegado(input), [{ indice: 0,
      documento: { id: original.id, codigo: original.codigo, ativo: original.ativo },
      legado: { id: original.id, codigo: original.codigo, ativo: original.ativo } }]);
    const request = (body: unknown, token = 'synthetic-valid', group: string = ID.groupA) => fetch(baseUrl + '/api/v1/clientes/conferencia-legado', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-group-id': group }, body: JSON.stringify(body) });
    const zeroRead = async (body: unknown, status: number, token = 'synthetic-valid', group: string = ID.groupA) => {
      const saved = points; assert.equal((await request(body, token, group)).status, status); assert.equal(points, saved);
    };
    await zeroRead(input, 401, 'expired'); await zeroRead(input, 403, 'synthetic-valid', ID.groupB);
    await zeroRead({ identidades: Array(101).fill(input.identidades[0]) }, 422);
    await zeroRead({ identidades: [{ documento: 'invalid' }] }, 422);
    await zeroRead({ identidades: [{ documento: DOC.clientePjA, extra: true }] }, 422);
    const previous = points;
    assert.equal((await request({ identidades: Array(100).fill(input.identidades[0]) })).status, 200);
    assert.equal(points - previous, 200);
    afterPoint = async () => { await admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', ['{}', ID.runtimeActorA]); };
    assert.equal((await request(input)).status, 403);
    await zeroRead(input, 403);
    await admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify(permissions), ID.runtimeActorA]);
    if (process.env.CLIENTE_CONFERENCIA_BROWSER_MODULE) {
      const { exerciseClienteConferenciaBrowser } = await import('../../scripts/legado/cliente-conferencia-browser-smoke.mjs');
      const proof = await exerciseClienteConferenciaBrowser({ modulePath: process.env.CLIENTE_CONFERENCIA_BROWSER_MODULE,
        baseUrl, groupId: ID.groupA, actorId: ID.runtimeActorA, repo: fileURLToPath(new URL('../../', import.meta.url)),
        output: process.env.CLIENTE_CONFERENCIA_BROWSER_OUTPUT || '/tmp/cliente-conferencia-browser-proof' });
      assert.equal(proof.passed, 5); assert.equal(proof.failed, 0);
      t.diagnostic('Synthetic real-consumer browser checks: ' + proof.passed + ' PASS; no operational session or data');
    }
    authenticated = false; await zeroRead(input, 401);
    assert.equal(writes, 0); assert.equal(await snapshot(), settled);
    assert.equal((await admin.query('SELECT count(*)::text AS count FROM audit_logs')).rows[0].count, audits);
    t.diagnostic(url ? 'Synthetic PostgreSQL server fixture; no operational access' : 'PGlite SQL fixture; not PostgreSQL server proof');
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await fixture.close();
  }
});
