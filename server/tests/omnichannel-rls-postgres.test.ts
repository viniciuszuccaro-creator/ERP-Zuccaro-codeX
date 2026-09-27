import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;
test('real PostgreSQL FORCE RLS fences reads, writes and claims for a non-bypass role and resets scope per transaction', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  const role = `omni_role_${randomUUID().replaceAll('-','')}`;
  const schema = (await f.pg.query<{ name: string }>('SELECT current_schema() AS name')).rows[0].name;
  assert.match(schema,/^omni_test_[a-f0-9]{32}$/);
  let created = false;
  const denied = (e: unknown) => (e as { code: string }).code==='42501';
  try {
    const migration = readFileSync(new URL('../migrations/033_integration_events_company_rls.sql', import.meta.url), 'utf8');
    await f.pg.exec(migration); await f.pg.exec(migration); // canonical migration is repeatable
    const own = await f.event(); const other = await f.event({ empresa: S.empresaA2 });
    await f.pg.exec(`CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOLOGIN`); created = true;
    await f.pg.exec(`GRANT USAGE ON SCHEMA ${schema} TO ${role}; GRANT SELECT,INSERT,UPDATE ON integration_events TO ${role}`);
    const flags = (await f.pg.query<{ rolsuper: boolean; rolbypassrls: boolean }>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
    assert.equal(flags.rolsuper,false); assert.equal(flags.rolbypassrls,false);
    await f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx.query('SELECT id FROM integration_events')).rows.length,0);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      assert.deepEqual((await tx.query('SELECT id FROM integration_events')).rows.map((r) => r.id),[own]);
      assert.equal((await tx.query('UPDATE integration_events SET attempts=1 WHERE id=$1 RETURNING id',[other])).rows.length,0);
      const claimed = await tx.query("SELECT id FROM integration_events WHERE status='pending' ORDER BY id FOR UPDATE SKIP LOCKED");
      assert.deepEqual(claimed.rows.map((r) => r.id),[own]);
    });
    // New transaction must not inherit trusted session context or privileged role.
    await f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx.query('SELECT id FROM integration_events')).rows.length,0);
    });
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query('UPDATE integration_events SET empresa_id=$2 WHERE id=$1',[own,S.empresaA2]);
    }),denied);
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type) VALUES($1,$2,'ERP','catalogo.reconciliado')",[S.groupB,S.empresaB]);
    }),denied);
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE '+role);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type) VALUES($1,NULL,'ERP','catalogo.reconciliado')",[S.groupA]);
    }),denied);
    assert.equal((await f.pg.query('SELECT empresa_id FROM integration_events WHERE id=$1',[own])).rows[0].empresa_id,S.empresaA);
  } finally {
    try {
      if (created) await f.pg.exec(`REVOKE SELECT,INSERT,UPDATE ON integration_events FROM ${role}; REVOKE USAGE ON SCHEMA ${schema} FROM ${role}; DROP ROLE ${role}`);
    } finally { await f.close(); }
  }
});
