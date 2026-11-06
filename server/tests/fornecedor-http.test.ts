import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID, SEED_DOCS } from '../scripts/seedDevIds.ts';
import { fingerprintFornecedor } from '../src/services/fornecedorService.ts';
import { PostgresFornecedorRepository } from '../src/repositories/postgresFornecedorRepository.ts';

test('Fornecedor HTTP uses canonical persistence/replay/reversal in synthetic PGlite, not real Auth/PostgreSQL/browser', async t => {
  const f = await localCrmFixture();
  const userId = randomUUID();
  const config = loadConfig({ NODE_ENV: 'test', ERP_ENV: 'hml', ERP_AUTH_MODE: 'supabase_user',
    DATABASE_URL: 'postgres://synthetic.invalid/test', SUPABASE_URL: 'https://synthetic.invalid',
    SUPABASE_ANON_KEY: 'synthetic-only', ENABLE_FORNECEDOR_HTTP: 'true' });
  const servers: ReturnType<ReturnType<typeof createApp>['app']['listen']>[] = [];
  const start = async (enabled: boolean, devHeaders = false) => {
    const { app } = createApp({ config: { ...config, fornecedorHttpEnabled: enabled,
      ...(devHeaders ? { authMode: 'dev_headers' as const, erpEnv: 'dev' as const } : {}) },
    db: f.data, authDb: f.admin, authFetchImpl: async (_url, init) => {
      return new Headers(init?.headers).get('authorization') === 'Bearer synthetic-valid'
        ? Response.json({ id: userId, email: 'supplier-test@synthetic.invalid' })
        : new Response('{}', { status: 401 });
    } });
    const server = app.listen(0, '127.0.0.1'); servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  try {
    await f.exec(await readFile(new URL('../schema-candidates/fornecedor_master.sql', import.meta.url), 'utf8'));
    await f.exec(`GRANT SELECT,INSERT,UPDATE ON fornecedores TO ${ROLE};
      CREATE POLICY supplier_http_fixture ON fornecedores FOR ALL TO ${ROLE}
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
      CREATE POLICY supplier_http_audit ON audit_logs FOR INSERT TO ${ROLE}
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    await f.admin.query('UPDATE profiles SET auth_user_id=$1,permissoes=$2::jsonb WHERE id=$3',
      [userId, JSON.stringify({ Cadastros: { fornecedor: ['visualizar', 'importar', 'criar', 'inativar'] } }), ID.runtimeActorA]);
    const base = await start(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-valid',
      'x-group-id': ID.groupA, 'x-actor-id': ID.runtimeActorA };
    const request = (url: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}, host = base) =>
      fetch(host + '/api/v1/fornecedores' + url, { method, headers: { ...headers, ...extra },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = { tipo_pessoa: 'Pessoa Juridica', cpf_cnpj: SEED_DOCS.clientePjA,
      razao_social: 'SYNTHETIC HTTP SUPPLIER', codigo: '000078', status: 'Ativo', status_fornecedor: 'Ativo',
      codigo_legado: '78', legacy_id: '78', source_system: 'SYNTHETIC', migration_batch: randomUUID() };
    const count = async () => (await f.admin.query<{ n: number }>('SELECT count(*)::int AS n FROM fornecedores')).rows[0].n;
    await t.test('flag defaults off; unauthenticated, forged actor, cross-group and company calls cannot write', async () => {
      assert.equal(loadConfig({}).fornecedorHttpEnabled, false);
      assert.equal((await request('/importar', 'POST', payload, { Authorization: '' })).status, 401);
      assert.equal((await request('/importar', 'POST', payload, { 'x-actor-id': ID.runtimeActorB })).status, 403);
      assert.equal((await request('/importar', 'POST', payload, { 'x-group-id': ID.groupB })).status, 403);
      assert.equal((await request('/importar', 'POST', payload, { 'x-empresa-id': ID.empresaA })).status, 403);
      const disabled = await start(false), dev = await start(true, true);
      assert.equal((await request('/importar', 'POST', payload, {}, disabled)).status, 503);
      assert.equal((await request('/importar', 'POST', payload, {}, dev)).status, 401);
      assert.equal(await count(), 0);
    });
    await t.test('create and replay perform one insert with canonical audit, exact read and no-store', async () => {
      const concurrent = await Promise.all([request('/importar', 'POST', payload), request('/importar', 'POST', payload)]);
      assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 201]);
      const first = concurrent.find(r => r.status === 201); assert.ok(first);
      assert.equal(first.headers.get('cache-control'), 'no-store');
      const data = (await first.json()).data;
      assert.equal(data.reutilizado, false); assert.equal(data.registro.codigo, payload.codigo);
      const replay = await request('/importar', 'POST', payload);
      assert.equal(replay.status, 200); assert.equal((await replay.json()).data.registro.id, data.registro.id);
      const reopened = await request('/' + data.registro.id);
      assert.equal(reopened.status, 200); assert.equal((await reopened.json()).data.razao_social, payload.razao_social);
      assert.equal(await count(), 1);
      assert.equal((await f.admin.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_logs WHERE entity='Fornecedor'")).rows[0].n, 3);
    });
    await t.test('invalid identity, extra fields and divergent replay never mutate', async () => {
      assert.equal((await request('/not-a-uuid')).status, 422);
      assert.equal((await request('/' + randomUUID())).status, 404);
      assert.equal((await request('/importar', 'POST', { ...payload, dados_bancarios: {} })).status, 400);
      assert.equal((await request('/importar', 'POST', { ...payload, razao_social: 'DIFFERENT SYNTHETIC' })).status, 409);
      assert.equal(await count(), 1);
    });
    await t.test('audit failure rolls back insert and code sequence', async auditTest => {
      const logged: unknown[][] = [];
      auditTest.mock.method(console, 'error', (...args: unknown[]) => { logged.push(args); });
      const before = await f.admin.query('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name');
      await f.exec(`CREATE FUNCTION supplier_http_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.entity='Fornecedor' AND NEW.action='create' THEN RAISE EXCEPTION 'SYNTHETIC AUDIT FAILURE'; END IF;
        RETURN NEW; END $$;
        CREATE TRIGGER supplier_http_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION supplier_http_fail_audit()`);
      try {
        assert.equal((await request('/importar', 'POST', { ...payload, cpf_cnpj: SEED_DOCS.clientePjB,
          codigo: '000079', codigo_legado: '79', legacy_id: '79' })).status, 500);
        assert.equal(await count(), 1);
        assert.deepEqual((await f.admin.query('SELECT * FROM entity_code_sequences ORDER BY group_id,entity_name')).rows, before.rows);
        assert.equal(logged.length, 1);
        const failure = logged[0].find(value => value instanceof Error);
        assert.ok(failure instanceof Error);
        assert.match(failure.message, /SYNTHETIC AUDIT FAILURE/);
      } finally { await f.exec('DROP TRIGGER supplier_http_audit_fail ON audit_logs; DROP FUNCTION supplier_http_fail_audit()'); }
    });
    await t.test('reversal validates CAS/batch/fingerprint; inactive history cannot be reactivated by replay', async () => {
      const id = (await f.admin.query<{ id: string }>('SELECT id FROM fornecedores')).rows[0].id;
      const row = await new PostgresFornecedorRepository(f.admin).byId(ID.groupA, id, f.admin); assert.ok(row);
      const body = { expectedRevision: row.revision, source: row.source_system, batch: row.migration_batch,
        expectedFingerprint: fingerprintFornecedor(row) };
      assert.equal((await request('/' + id + '/reverter', 'POST', { ...body, group_id: ID.groupB })).status, 422);
      assert.equal((await request('/' + id + '/reverter', 'POST', { ...body, batch: randomUUID() })).status, 409);
      const reversed = await request('/' + id + '/reverter', 'POST', body);
      assert.equal(reversed.status, 200); const after = (await reversed.json()).data;
      assert.equal(after.id, id); assert.equal(after.codigo, payload.codigo); assert.equal(after.ativo, false);
      assert.equal(after.status, 'Inativo'); assert.equal(after.migration_batch, payload.migration_batch);
      assert.equal((await request('/' + id + '/reverter', 'POST', body)).status, 409);
      assert.equal((await request('/importar', 'POST', payload)).status, 409);
      assert.equal(await count(), 1);
    });
    await t.test('permission and profile revocation deny subsequent reads', async () => {
      const id = (await f.admin.query<{ id: string }>('SELECT id FROM fornecedores')).rows[0].id;
      await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', ['{}', ID.runtimeActorA]);
      assert.equal((await request('/' + id)).status, 403);
      await f.admin.query('UPDATE profiles SET ativo=false WHERE id=$1', [ID.runtimeActorA]);
      assert.equal((await request('/' + id)).status, 403);
    });
  } finally {
    for (const server of servers) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await f.close();
  }
});
