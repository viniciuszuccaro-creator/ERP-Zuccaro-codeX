import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { mountSupplierSettlementHistoryRead } from '../src/api/supplierSettlementHistoryRead.js';
import type { DbClient } from '../src/db/client.js';

test('supplier history excludes archived rows before pagination', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const groupId = '11111111-1111-4111-8111-111111111111';
  const empresaId = '22222222-2222-4222-8222-222222222222';
  const anotherCompany = '33333333-3333-4333-8333-333333333333';
  await pg.exec(`
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
  `);
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { authVerified: true, actorId: groupId, groupId, empresaId, scopeType: 'empresa' });
    next();
  });
  const q = { query: (sql: string, args: unknown[]) => sql.includes('row_security_active')
    ? Promise.resolve({ rows: [{ ns: 'hml_trial', path: ['hml_trial', 'pg_catalog'], restricted: true, rls: true }] })
    : pg.query(sql, args) };
  mountSupplierSettlementHistoryRead(app, { withTransaction: (fn: (executor: typeof q) => unknown) => fn(q) } as unknown as DbClient, {
    async assertAllowed(ctx, module, section, action) {
      assert.equal(ctx.empresaId, empresaId);
      assert.deepEqual([module, section, action], ['Financeiro', 'historico_baixas_fornecedores', 'visualizar']);
    },
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/financeiro/historico-baixas-fornecedores`;
  const read = async (offset: number) => {
    const response = await fetch(`${base}?limit=1&offset=${offset}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    return { sequences: body.items.map((row: { source_sequence_hex: string }) => row.source_sequence_hex), next: body.nextOffset };
  };
  assert.deepEqual(await read(0), { sequences: ['02'], next: 1 });
  assert.deepEqual(await read(1), { sequences: ['03'], next: null });
});
