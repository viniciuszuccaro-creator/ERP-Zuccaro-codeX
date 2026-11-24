import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { createPoolDbClient } from '../src/db/client.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { importCentroCusto } from '../src/services/centroCustoImport.ts';

const group = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const companyB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('Centro de Custo candidato bloqueia fallback e restringe leitura e escrita por empresa', async () => {
  const pg = new PGlite();
  const sql = await readFile(new URL('../schema-candidates/centros_custo.sql', import.meta.url), 'utf8');
  try {
    await assert.rejects(pg.exec(sql), /CENTRO_CUSTO_SCHEMA_ISOLADO_OBRIGATORIO/);
    await pg.exec(`CREATE SCHEMA finance;
      SET search_path=finance,pg_catalog;
      CREATE TABLE empresas(id uuid PRIMARY KEY, group_id uuid NOT NULL);
      CREATE TABLE audit_logs(group_id uuid, empresa_id uuid, actor_id uuid, actor_email text,
        entity text, entity_id text, action text, before_data jsonb, after_data jsonb,
        request_id text CHECK (request_id <> 'reject-audit'), ip_address text);
      INSERT INTO empresas VALUES ('${companyA}','${group}'), ('${companyB}','${group}');
      CREATE ROLE finance_probe NOLOGIN NOSUPERUSER NOBYPASSRLS;`);
    await pg.exec(sql);
    await pg.exec(`GRANT USAGE ON SCHEMA finance TO finance_probe;
      GRANT SELECT,INSERT ON centros_custo TO finance_probe;
      GRANT SELECT,INSERT ON audit_logs TO finance_probe;
      SET ROLE finance_probe;`);
    const scope = (empresa: string) => pg.query(
      "SELECT set_config('app.group_id',$1,false),set_config('app.empresa_id',$2,false)", [group, empresa]);
    const insert = (empresa: string) => pg.query(
      "INSERT INTO centros_custo(group_id,empresa_id,codigo,descricao,ativo,source_system,legacy_id) VALUES ($1,$2,'001','Synthetic',true,'BASE44','reference')", [group, empresa]);
    await scope(companyA);
    await insert(companyA);
    await assert.rejects(insert(companyA), /duplicate key/);
    await assert.rejects(insert(companyB), /row-level security/);
    await scope(companyB);
    assert.equal((await pg.query('SELECT id FROM centros_custo')).rows.length, 0);
    await insert(companyB);
    assert.equal((await pg.query('SELECT id FROM centros_custo')).rows.length, 1);
    await scope('');
    assert.equal((await pg.query('SELECT id FROM centros_custo')).rows.length, 0);

    const db = createPoolDbClient({ connect: async () => ({
      query: pg.query.bind(pg), release() {},
    }) } as unknown as Pool);
    const rbac = new InMemoryRbacGuard();
    const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    rbac.link({ actorId, groupId: group, empresaId: companyA,
      permissions: { Cadastros: { centros_custo: ['importar'] } } });
    const deps = { db, rbac, audit: new PostgresAuditRepository(db) };
    const ctx = { groupId: group, empresaId: companyA, actorId, requestId: 'finance-proof' };
    const payload = { codigo: '002', descricao: 'Synthetic import', ativo: true, sourceSystem: 'BASE44', legacyId: 'import-1' };
    const first = await importCentroCusto(ctx, payload, deps);
    assert.equal(first.reused, false);
    assert.deepEqual(await importCentroCusto(ctx, payload, deps), { id: first.id, reused: true });
    await assert.rejects(importCentroCusto(ctx, { ...payload, descricao: 'Different' }, deps),
      { code: 'CENTRO_CUSTO_RECONCILIATION_REQUIRED' });
    await assert.rejects(importCentroCusto({ ...ctx, empresaId: companyB }, payload, deps), { code: 'PERMISSION_DENIED' });
    await assert.rejects(importCentroCusto({ ...ctx, requestId: 'reject-audit' },
      { ...payload, codigo: '003', legacyId: 'import-2' }, deps), /check constraint/);
    await scope(companyA);
    assert.equal((await pg.query("SELECT id FROM centros_custo WHERE codigo='003'")).rows.length, 0);
    assert.equal((await pg.query("SELECT entity_id FROM audit_logs WHERE entity='CentroCusto'")).rows.length, 1);
  } finally {
    await pg.close();
  }
});
