import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { mountSupplierSettlementHistoryRead } from '../src/api/supplierSettlementHistoryRead.js';
import type { DbClient, DbQueryExecutor } from '../src/db/client.js';
import type { QueryResultRow } from 'pg';
import { PostgresRbacGuard } from '../src/db/rbacGuard.js';
import { createSupabaseAuthMiddleware, scopeMiddleware } from '../src/middleware/requestContext.js';

test('authenticated supplier history enforces explicit RBAC and excludes archived rows before pagination', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const groupId = '11111111-1111-4111-8111-111111111111';
  const empresaId = '22222222-2222-4222-8222-222222222222';
  const anotherCompany = '33333333-3333-4333-8333-333333333333';
  const authId = '44444444-4444-4444-8444-444444444444';
  const actorId = '55555555-5555-4555-8555-555555555555';
  const deniedAuthId = '66666666-6666-4666-8666-666666666666';
  const deniedActorId = '77777777-7777-4777-8777-777777777777';
  await pg.exec(`
    CREATE SCHEMA hml_trial;
    SET search_path TO hml_trial,pg_catalog;
    CREATE ROLE history_trial NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE TABLE empresas(id uuid, group_id uuid, status text);
    INSERT INTO empresas VALUES ('${empresaId}', '${groupId}', 'Ativa'), ('${anotherCompany}', '${groupId}', 'Ativa');
    CREATE TABLE profiles(id uuid, auth_user_id uuid, ativo boolean, group_id uuid, empresa_id uuid, permissoes jsonb);
    INSERT INTO profiles VALUES
      ('${actorId}', '${authId}', true, '${groupId}', '${empresaId}', '{"Financeiro":{"historico_baixas_fornecedores":["visualizar"]}}'),
      ('${deniedActorId}', '${deniedAuthId}', true, '${groupId}', '${empresaId}', '{"*":["visualizar"]}');
    CREATE TABLE legacy_supplier_settlement_history (
      empresa_id uuid, source_report int, source_sequence_hex text,
      supplier_legacy_code int, fiscal_note_number int, legacy_settlement_marker int,
      original_title_amount numeric, source_archive_sha256 text, archived boolean NOT NULL
    );
    INSERT INTO legacy_supplier_settlement_history VALUES
      ('${empresaId}', 1, '01', 1, 1, 1, 1, 'a', true),
      ('${empresaId}', 1, '02', 1, 1, 1, 2, 'a', false),
      ('${empresaId}', 1, '03', 1, 1, 1, 3, 'a', false),
      ('${anotherCompany}', 1, '01', 1, 1, 1, 1, 'a', false);
    ALTER TABLE legacy_supplier_settlement_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE legacy_supplier_settlement_history FORCE ROW LEVEL SECURITY;
    CREATE POLICY scoped ON legacy_supplier_settlement_history FOR SELECT TO history_trial
      USING (empresa_id::text = current_setting('app.empresa_id', true));
    GRANT USAGE ON SCHEMA hml_trial TO history_trial;
    GRANT SELECT ON profiles, legacy_supplier_settlement_history TO history_trial;
  `);
  const app = express();
  const context = new AsyncLocalStorage<string>();
  const adapt = (engine: Pick<PGlite, 'query'>): DbQueryExecutor['query'] =>
    async <T extends QueryResultRow>(sql: string, params?: unknown[]) => {
      const result = await engine.query<T>(sql, params);
      return { rows: result.rows, rowCount: result.rows.length, command: 'SELECT', oid: 0, fields: [] };
  };
  const adminQuery = adapt(pg);
  app.use(createSupabaseAuthMiddleware({
    supabaseUrl: 'https://auth.synthetic.invalid', anonKey: 'synthetic-only', db: { query: adminQuery },
    fetchImpl: async (_url, init) => {
      const token = new Headers(init?.headers).get('authorization');
      if (token === 'Bearer permitted') return Response.json({ id: authId });
      if (token === 'Bearer wildcard-only') return Response.json({ id: deniedAuthId });
      return new Response(null, { status: 401 });
    },
  }));
  app.use(scopeMiddleware);
  app.use((req, _res, next) => {
    context.run(req.empresaId ?? '', next);
  });
  const db: DbClient = {
    pool: null, query: adminQuery, checkConnection: async () => true, end: async () => {},
    withTransaction: fn => pg.transaction(async tx => {
      await tx.exec('SET LOCAL ROLE history_trial');
      await tx.query("SELECT set_config('app.empresa_id', $1, true)", [context.getStore() ?? '']);
      return fn({ query: adapt(tx) });
    }),
  };
  mountSupplierSettlementHistoryRead(app, db, new PostgresRbacGuard(db));
  const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error.statusCode ?? error.status ?? 500).json({ code: error.code });
  };
  app.use(errors);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/financeiro/historico-baixas-fornecedores`;
  const headers = { Authorization: 'Bearer permitted', 'x-group-id': groupId, 'x-empresa-id': empresaId };
  const deny = async (changes: Record<string, string>, status: number, code: string) => {
    const response = await fetch(base, { headers: { ...headers, ...changes } });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  };
  await deny({ Authorization: 'Bearer invalid' }, 401, 'AUTH_INVALID');
  await deny({ Authorization: 'Bearer wildcard-only' }, 403, 'PERMISSION_DENIED');
  await deny({ 'x-empresa-id': anotherCompany }, 403, 'ACTOR_SCOPE_DENIED');
  const read = async (offset: number) => {
    const response = await fetch(`${base}?limit=1&offset=${offset}`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    return { sequences: body.items.map((row: { source_sequence_hex: string }) => row.source_sequence_hex), next: body.nextOffset };
  };
  assert.deepEqual(await read(0), { sequences: ['02'], next: 1 });
  assert.deepEqual(await read(1), { sequences: ['03'], next: null });
});
