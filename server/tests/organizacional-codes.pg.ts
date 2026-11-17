import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { assertCrmIsolatedUrl } from './helpers/crmPostgresFixture.ts';
import { createPoolDbClient } from '../src/db/client.ts';
import { OrganizacionalService } from '../src/services/organizacionalService.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';

test('native PostgreSQL: concurrent organizational codes, rollback, replay and postimage reversal', async () => {
  const url = process.env.DATABASE_URL; assertCrmIsolatedUrl(url);
  const schema = 'org_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  const pool = new pg.Pool({ connectionString: url, max: 6, options: '-c search_path=' + schema + ',pg_catalog' });
  const db = createPoolDbClient(pool);
  let created = false;
  const group = randomUUID(), actor = randomUUID(), a = randomUUID(), b = randomUUID();
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    await db.query(`CREATE TABLE groups(id uuid PRIMARY KEY,codigo text UNIQUE,nome_do_grupo text,razao_social_grupo text,cnpj_grupo text,status text,observacoes text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE empresas(id uuid PRIMARY KEY,group_id uuid,codigo text,razao_social text,nome_fantasia text,cnpj text,status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(group_id,codigo));
      CREATE TABLE audit_logs(group_id uuid,empresa_id uuid,actor_id uuid,actor_email text,entity text,entity_id uuid,action text,before_data jsonb,after_data jsonb,request_id text,ip_address text);`);
    const source = readFileSync(new URL('../migrations/009_clientes_master_data.sql', import.meta.url), 'utf8');
    const sequence = source.match(/CREATE TABLE IF NOT EXISTS entity_code_sequences[\s\S]*?REVOKE ALL ON FUNCTION reserve_entity_codigo\(UUID, TEXT, INT\) FROM PUBLIC;/)?.[0];
    assert.ok(sequence); await db.query(sequence);
    await db.query('INSERT INTO groups(id,nome_do_grupo) VALUES($1,$2)', [group, 'Synthetic Group']);
    for (const [id, name] of [[a, 'Synthetic A'], [b, 'Synthetic B']]) {
      await db.query('INSERT INTO empresas(id,group_id,razao_social,status) VALUES($1,$2,$3,$4)', [id, group, name, 'Ativa']);
    }
    const rbac = new InMemoryRbacGuard(), tenants = new InMemoryTenantGuard();
    rbac.link({ actorId: actor, groupId: group, permissions: { Cadastros: { organizacional: ['visualizar', 'editar'] } } });
    tenants.link(a, group); tenants.link(b, group);
    const audit = new PostgresAuditRepository(db), service = new OrganizacionalService(db, audit, rbac, tenants);
    const ctx = { groupId: group, actorId: actor, requestId: 'synthetic-concurrent-org' };
    const before = await service.get(ctx, 'Empresa', a);
    const failure = new OrganizacionalService(db, { append: async () => { throw Error('AUDIT_FAILURE'); }, listByEntity: async () => [] }, rbac, tenants);
    await assert.rejects(failure.assignMissingCodigo(ctx, 'Empresa', a, String(before.version)), /AUDIT_FAILURE/);
    assert.deepEqual(await service.get(ctx, 'Empresa', a), before);
    const second = await service.get(ctx, 'Empresa', b);
    const assigned = await Promise.all([service.assignMissingCodigo(ctx, 'Empresa', a, String(before.version)),
      service.assignMissingCodigo(ctx, 'Empresa', b, String(second.version))]);
    assert.deepEqual(assigned.map(r => r.codigo).sort(), ['001', '002']);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n, 2);
    const replay = await Promise.all(Array.from({ length: 3 }, () => service.assignMissingCodigo(ctx, 'Empresa', a, String(before.version))));
    assert.ok(replay.every(r => r.codigo === assigned[0].codigo));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n, 2);
    assert.deepEqual(await service.get(ctx, 'Empresa', a), assigned[0]);
    const changed = await service.update(ctx, 'Empresa', a, { expected_version: assigned[0].version, nome_fantasia: 'Manual synthetic edit' });
    await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', a, String(assigned[0].version), String(assigned[0].codigo), ctx.requestId), { code: 'VERSION_CONFLICT' });
    assert.deepEqual(await service.get(ctx, 'Empresa', a), changed);
    await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', b, String(assigned[1].version), String(assigned[1].codigo), 'wrong-run'), { code: 'ASSIGNMENT_RECEIPT_REQUIRED' });
    const reversed = await service.reverseAssignedCodigo(ctx, 'Empresa', b, String(assigned[1].version), String(assigned[1].codigo), ctx.requestId);
    assert.equal(reversed.codigo, null); assert.equal(reversed.id, b);
    await db.query('UPDATE empresas SET codigo=$1 WHERE id=$2', ['900', b]);
    const external = await service.get(ctx, 'Empresa', b);
    await assert.rejects(service.reverseAssignedCodigo(ctx, 'Empresa', b, String(external.version), '900', ctx.requestId), { code: 'ASSIGNMENT_RECEIPT_REQUIRED' });
    assert.deepEqual(await service.get(ctx, 'Empresa', b), external);
    await assert.rejects(service.update(ctx, 'Empresa', a, { expected_version: changed.version, inscricao_estadual: '00123' }), { statusCode: 403 });
    rbac.link({ actorId: actor, groupId: group, permissions: { Cadastros: { organizacional: ['visualizar', 'editar'] }, Fiscal: { tabelas_fiscais: ['editar'] } } });
    await assert.rejects(service.update(ctx, 'Empresa', a, { expected_version: changed.version, inscricao_estadual: '00123' }), { code: 'FIELD_PERSISTENCE_UNAVAILABLE' });
    await db.query('ALTER TABLE groups ADD COLUMN inscricao_estadual text; ALTER TABLE empresas ADD COLUMN inscricao_estadual text, ADD COLUMN regime_tributario text');
    const fiscalBefore = await service.get(ctx, 'Empresa', a);
    assert.equal(fiscalBefore.regime_tributario, null);
    const fiscal = await service.update(ctx, 'Empresa', a, { expected_version: fiscalBefore.version, inscricao_estadual: '00123', regime_tributario: 'Lucro Real' });
    assert.equal(fiscal.inscricao_estadual, '00123');
    assert.equal(fiscal.codigo, assigned[0].codigo);
    assert.deepEqual(await service.get(ctx, 'Empresa', a), fiscal);
    await assert.rejects(service.update(ctx, 'Empresa', a, { expected_version: fiscalBefore.version, regime_tributario: 'MEI' }), { code: 'VERSION_CONFLICT' });
    await assert.rejects(failure.update(ctx, 'Empresa', a, { expected_version: fiscal.version, inscricao_estadual: null, regime_tributario: null }), /AUDIT_FAILURE/);
    assert.deepEqual(await service.get(ctx, 'Empresa', a), fiscal);
    const cleared = await service.update(ctx, 'Empresa', a, { expected_version: fiscal.version, regime_tributario: null });
    assert.equal(cleared.regime_tributario, null);
    assert.equal(cleared.inscricao_estadual, '00123');
    assert.equal(cleared.id, a);
  } finally {
    await db.end();
    if (created) { assert.match(schema, /^org_[a-f0-9]{32}$/); await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    await admin.end();
  }
});
