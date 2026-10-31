import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
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
import { rowHash } from '../../scripts/legado/pilot-functional-policy.mjs';
import { buildClientReconciliationReadPlan, classifyClientReconciliationReadResult }
  from '../../scripts/legado/pilot-functional-load-plan.mjs';

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

function fixedReadInput(canonicals: Array<Record<string, unknown>>) {
  const selectedDetails = canonicals.map((canonical, sourceIndex) => ({ sourceIndex,
    sourceFingerprint: rowHash({ canonical, sourceIndex }), fileSha256: rowHash('SYNTHETIC_SOURCE_ONLY'),
    canonical, original: { retainedInPrivateSource: true } }));
  const cohort = selectedDetails.map(({ sourceIndex, sourceFingerprint, fileSha256 }) =>
    ({ sourceIndex, sourceFingerprint, fileSha256 }));
  const sourceBytes = Buffer.from(JSON.stringify({ cohort, cohortSha256: rowHash(cohort), selectedDetails,
    validationContextIsNotOperationalCrosswalk: true }));
  return { sourceBytes, expectedSourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    expectedCohortSha256: rowHash(cohort),
    target: { identitySha256: rowHash('SYNTHETIC_TARGET_ONLY'), database: 'postgres', schema: 'public', executorRole: 'postgres',
      groupId: ID.groupA, companyIds: [ID.empresaA] } };
}

test('fixed reconciliation plan pins existing source bytes, preserves binding and refuses broad or ambiguous inputs', () => {
  const input = fixedReadInput([{ documento: DOC.clientePjA, empresa_id: 'SOURCE_CONTEXT_IS_NOT_BINDING' }]);
  const before = Buffer.from(input.sourceBytes), plan = buildClientReconciliationReadPlan(input);
  assert.deepEqual(input.sourceBytes, before);
  assert.equal(plan.operationalAuthorized, false); assert.equal(plan.authenticationProven, false);
  assert.equal(plan.query.params[0], ID.groupA);
  assert.deepEqual(JSON.parse(plan.query.params[1]), [{ source_index: 0, documento: DOC.clientePjA,
    source_system: null, codigo_legado: null }]);
  assert.deepEqual(plan.query.params[2], [ID.empresaA]);
  assert.equal(plan.query.sql.includes(DOC.clientePjA), false);
  assert.equal(plan.query.sql.includes('SOURCE_CONTEXT_IS_NOT_BINDING'), false);
  const extraTarget = buildClientReconciliationReadPlan({ ...input,
    target: { ...input.target, forbiddenCredentialField: 'SYNTHETIC_NOT_TO_PROPAGATE' } });
  assert.equal(JSON.stringify(extraTarget).includes('SYNTHETIC_NOT_TO_PROPAGATE'), false);
  assert.doesNotMatch(plan.query.sql, /SELECT\s+\*|LIMIT\s+1\b|\b(?:UPDATE|INSERT|DELETE|CREATE|GRANT|REVOKE)\b/i);
  assert.equal(Object.isFrozen(plan.query.params[1]), true);
  input.target.groupId = ID.groupB;
  assert.equal(plan.target.groupId, ID.groupA);
  for (const bad of [{ ...input, sourceBytes: Buffer.concat([input.sourceBytes, Buffer.from(' ')]) },
    { ...input, target: { ...input.target, companyIds: [ID.empresaA, ID.empresaA] } },
    { ...input, target: { ...input.target, schema: 'other_schema' } },
    { ...input, target: { ...input.target, executorRole: 'postgres; SELECT 1' } }])
    assert.throws(() => buildClientReconciliationReadPlan(bad));
  const excessive = fixedReadInput(Array.from({ length: 101 }, () => ({ documento: DOC.clientePjA })));
  assert.throws(() => buildClientReconciliationReadPlan(excessive), /COHORT_INVALID/);
  assert.throws(() => buildClientReconciliationReadPlan({ ...input,
    expectedCohortSha256: rowHash('OTHER_COHORT') }), /COHORT_INVALID/);
  const empty = Buffer.from('null');
  assert.throws(() => buildClientReconciliationReadPlan({ ...input, sourceBytes: empty,
    expectedSourceSha256: createHash('sha256').update(empty).digest('hex') }), /COHORT_INVALID/);
  const changed = JSON.parse(input.sourceBytes.toString('utf8'));
  changed.selectedDetails[0].sourceFingerprint = rowHash('DIFFERENT_SOURCE');
  const bytes = Buffer.from(JSON.stringify(changed));
  assert.throws(() => buildClientReconciliationReadPlan({ ...input, sourceBytes: bytes,
    expectedSourceSha256: createHash('sha256').update(bytes).digest('hex') }), /SOURCE_IDENTITY_INVALID/);
});

test('fixed reconciliation withholds bad or repeated source documents without blocking independent rows', () => {
  const plan = buildClientReconciliationReadPlan(fixedReadInput([
    { documento: '00000000000' }, { documento: DOC.clientePfA },
    { documento: DOC.clientePfA }, { documento: DOC.clientePjA },
  ]));
  assert.deepEqual(plan.documents, [DOC.clientePjA]);
  assert.deepEqual(plan.rows.map(row => row.blockedReason), ['SOURCE_DOCUMENT_UNVERIFIED',
    'SOURCE_DOCUMENT_AMBIGUOUS', 'SOURCE_DOCUMENT_AMBIGUOUS', null]);
  const native = buildClientReconciliationReadPlan(fixedReadInput([
    { documento: DOC.clientePjA, source_system: 'SYNTHETIC_NATIVE', codigo_legado: '001' },
    { documento: DOC.clientePfA, source_system: 'SYNTHETIC_NATIVE', codigo_legado: '001' },
    { documento: DOC.clientePjB, source_system: 'SYNTHETIC_NATIVE' },
  ]));
  assert.equal(native.query, null);
  assert.deepEqual(native.rows.map(row => row.blockedReason), ['SOURCE_LEGACY_IDENTITY_AMBIGUOUS',
    'SOURCE_LEGACY_IDENTITY_AMBIGUOUS', 'SOURCE_LEGACY_IDENTITY_INCOMPLETE']);
});

test('fixed reconciliation accepts a proven native-only identity without inventing a document', () => {
  const plan = buildClientReconciliationReadPlan(fixedReadInput([
    { source_system: 'SYNTHETIC_NATIVE', codigo_legado: '001' },
  ]));
  assert.equal(plan.identities.length, 1);
  assert.equal(plan.identities[0].documento, null);
  assert.equal(Object.hasOwn(plan.rows[0].projection, 'documento'), false);
  assert.equal(plan.operationalAuthorized, false);
});

test('fixed reconciliation detects native collisions across rejected and eligible source rows', () => {
  const plan = buildClientReconciliationReadPlan(fixedReadInput([
    { documento: '00000000000', source_system: 'SYNTHETIC_NATIVE', codigo_legado: '001' },
    { documento: DOC.clientePfA, source_system: 'SYNTHETIC_NATIVE', codigo_legado: '001' },
    { documento: DOC.clientePjA, source_system: 'SYNTHETIC_INDEPENDENT', codigo_legado: '002' },
  ]));
  assert.equal(plan.rows[1].blockedReason, 'SOURCE_LEGACY_IDENTITY_AMBIGUOUS');
  assert.deepEqual(plan.identities.map(row => row.source_index), [2]);
});

test('fixed reconciliation executes exact SQL and rollback on canonical isolated fixture; duplicates never select a row', async t => {
  const fixture = await localCrmFixture(), { admin } = fixture;
  try {
    await admin.query('UPDATE clientes SET empresa_id=NULL,nome=$1,razao_social=$2,ativo=false WHERE id=$3',
      ['SYNTHETIC PRESERVED NAME', 'SYNTHETIC LEGAL NAME', ID.clientePjA]);
    await fixture.exec('DROP INDEX uq_clientes_group_documento');
    await admin.query(`INSERT INTO clientes SELECT (jsonb_populate_record(NULL::clientes,to_jsonb(c)
      ||jsonb_build_object('id',$1::text,'codigo','900098','ativo',false,'source_system',NULL,
        'codigo_legado',NULL,'email',NULL))).* FROM clientes c WHERE c.id=$2`, [randomUUID(), ID.clientePfA]);
    const input = fixedReadInput([{ documento: DOC.clientePjA, nome: 'SYNTHETIC PRESERVED NAME',
      razao_social: 'SYNTHETIC LEGAL NAME', ativo: false }, { documento: DOC.clientePfA },
      { documento: DOC.clientePjB }]);
    const plan = buildClientReconciliationReadPlan(input);
    const snapshot = async () => JSON.stringify((await admin.query(
      'SELECT to_jsonb(c) AS value FROM clientes c ORDER BY id')).rows);
    const before = await snapshot();
    let result;
    await fixture.exec(plan.transaction.begin);
    try {
      for (const sql of plan.transaction.settings) await fixture.exec(sql);
      const session = (await admin.query(plan.precheck.sql, plan.precheck.params)).rows[0];
      assert.equal(session.executor_role, session.session_role);
      const rows = (await admin.query(plan.query.sql, plan.query.params)).rows;
      result = classifyClientReconciliationReadResult(plan, { session, rows });
      const replay = classifyClientReconciliationReadResult(plan,
        { session, rows: (await admin.query(plan.query.sql, plan.query.params)).rows });
      assert.deepEqual(replay, result);
      assert.deepEqual(result.publicSummary.counts, { NEW: 1, COMPATIBLE: 1, DUPLICATE: 1, DIVERGENT: 0, BLOCKED: 0 });
      assert.equal(result.details[0].record.id, ID.clientePjA);
      assert.equal(result.details[0].record.ativo, false);
      assert.equal(result.details[0].record.nome, 'SYNTHETIC PRESERVED NAME');
      assert.equal(result.details[1].matches, 2);
      assert.equal(Object.hasOwn(result.details[1], 'record'), false);
      assert.equal(JSON.stringify(result.publicSummary).includes('SYNTHETIC PRESERVED NAME'), false);
      assert.equal(JSON.stringify(result.publicSummary).includes(DOC.clientePjA), false);
      assert.equal(result.publicSummary.operationalEligible, 0);
      for (const patch of [{ database_name: 'wrong_destination' }, { executor_role: 'wrong_role' },
        { session_role: 'different_login' }, { read_only: 'off' }, { isolation: 'read committed' }, { search_path: 'public' },
        { group_matches: 0 }, { company_matches: 0 }])
        assert.throws(() => classifyClientReconciliationReadResult(plan,
          { session: { ...session, ...patch }, rows }), /SESSION_UNVERIFIED/);
      assert.throws(() => classifyClientReconciliationReadResult(plan, { session, rows: rows.slice(1) }), /INCOMPLETE/);
      assert.throws(() => classifyClientReconciliationReadResult(plan, { session, rows: [rows[0], rows[0], rows[2]] }), /INVALID/);
      const forged = structuredClone(rows);
      forged[0].record.group_id = ID.groupB;
      assert.throws(() => classifyClientReconciliationReadResult(plan, { session, rows: forged }), /SCOPE_INVALID/);
      const multipleAddresses = structuredClone(rows);
      multipleAddresses[0].address_links = 2;
      assert.equal(classifyClientReconciliationReadResult(plan,
        { session, rows: multipleAddresses }).details[0].addressLinks, 2);
      for (const [index, field, value] of [
        [0, 'company_links', plan.target.companyIds.length + 1],
        [1, 'company_links', 1], [1, 'address_links', 1],
        [2, 'company_links', 1], [2, 'address_links', 1],
      ] as const) {
        const impossible = structuredClone(rows);
        impossible[index][field] = value;
        assert.throws(() => classifyClientReconciliationReadResult(plan,
          { session, rows: impossible }), /RESULT_INVALID/);
      }
      await assert.rejects(admin.query('UPDATE public.clientes SET ativo=true WHERE id=$1', [ID.clientePjA]), /read.only/i);
    } finally { await fixture.exec(plan.transaction.end); }
    assert.equal(await snapshot(), before);
    assert.ok(result);
    t.diagnostic('PGlite canonical fixture/READ ONLY/ROLLBACK only; no network login, actual destination or load authorization proven');
  } finally { await fixture.close(); }
});

test('fixed reconciliation refuses divergent native/document identities and company-owned records without modifying them', async () => {
  const fixture = await localCrmFixture(), { admin } = fixture;
  try {
    await admin.query('UPDATE clientes SET empresa_id=NULL,source_system=$1,codigo_legado=$2 WHERE id=$3',
      ['SYNTHETIC_NATIVE_344', 'legacy-001', ID.clientePjA]);
    const snapshot = async () => JSON.stringify((await admin.query('SELECT to_jsonb(c) AS value FROM clientes c ORDER BY id')).rows);
    const before = await snapshot();
    const cases = [
      { canonical: { documento: DOC.clientePjB, source_system: 'SYNTHETIC_NATIVE_344', codigo_legado: 'legacy-001' },
        expected: 'DIVERGENT', matches: 1 },
      { canonical: { documento: DOC.clientePfA, source_system: 'SYNTHETIC_NATIVE_344', codigo_legado: 'legacy-001' },
        expected: 'DIVERGENT', matches: 2 },
      { canonical: { documento: DOC.clientePjA, source_system: 'SYNTHETIC_OTHER', codigo_legado: 'other-code' },
        expected: 'DIVERGENT', matches: 1 },
      { canonical: { documento: DOC.clientePfA }, expected: 'BLOCKED', matches: 1 },
      { canonical: { source_system: 'SYNTHETIC_NATIVE_344', codigo_legado: 'legacy-001' },
        expected: 'COMPATIBLE', matches: 1 },
    ];
    for (const item of cases) {
      const plan = buildClientReconciliationReadPlan(fixedReadInput([item.canonical]));
      await fixture.exec(plan.transaction.begin);
      try {
        for (const sql of plan.transaction.settings) await fixture.exec(sql);
        const session = (await admin.query(plan.precheck.sql, plan.precheck.params)).rows[0];
        const rows = (await admin.query(plan.query.sql, plan.query.params)).rows;
        const result = classifyClientReconciliationReadResult(plan, { session, rows });
        assert.equal(rows[0].matches, item.matches);
        assert.equal(result.details[0].status, item.expected);
        if (item.matches > 1) assert.equal(Object.hasOwn(result.details[0], 'record'), false);
        assert.equal(result.publicSummary.operationalAuthorized, false);
      } finally { await fixture.exec(plan.transaction.end); }
    }
    assert.equal(await snapshot(), before);
  } finally { await fixture.close(); }
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
