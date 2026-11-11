import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { realCrmFixture } from './helpers/crmPostgresFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { createPoolDbClient, type DbClient, type DbQueryExecutor } from '../src/db/client.ts';
import { PostgresClienteLocalRepository } from '../src/repositories/postgresClienteLocalRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { PostgresRbacGuard, type RbacGuard } from '../src/db/rbacGuard.ts';
import type { RequestContext } from '../src/audit/types.ts';
import { PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { ClienteLocalService } from '../src/services/clienteLocalService.ts';
import { criarTransacaoEnderecoPilotoPostgres, persistirEnderecoClienteGrupoLegado,
  fingerprintEnderecoLegado } from '../../scripts/legado/persistencia-endereco-legado.mjs';

const url = process.env.LEGACY_ADDRESS_PG_TEST_URL;
test('legacy address PostgreSQL: canonical service, audit and ledger are atomic under first-insert contention',
  { skip: !url }, async t => {
    if (!url) throw new Error('ISOLATED_TEST_URL_REQUIRED');
    const f = await realCrmFixture(url, { restrictedLogin: true });
    try {
      const permissions = { Cadastros: { cliente: ['importar'], cliente_local: ['visualizar', 'criar', 'editar', 'inativar'] } };
      await f.admin.query('UPDATE profiles SET permissoes=$1::jsonb,empresa_id=NULL WHERE id=$2', [JSON.stringify(permissions), ID.runtimeActorA]);
      await f.admin.query('UPDATE clientes SET empresa_id=NULL WHERE id=$1', [ID.clientePfA]);
      await f.exec(`GRANT SELECT ON clientes,cliente_locais,cliente_local_finalidades TO "${f.role}";
        GRANT UPDATE(updated_at) ON clientes TO "${f.role}";
        GRANT INSERT,UPDATE ON cliente_locais,cliente_local_finalidades TO "${f.role}";
        CREATE TABLE pilot_worker_map(group_id uuid NOT NULL,source_key text NOT NULL,cliente_id uuid NOT NULL REFERENCES clientes(id),
          source_fingerprint text NOT NULL,payload_hash text NOT NULL,payload_json jsonb NOT NULL,raw_source_json jsonb NOT NULL,
          target_id uuid NOT NULL REFERENCES cliente_locais(id),snapshot jsonb NOT NULL,revision integer NOT NULL,
          state text NOT NULL CHECK(state IN ('APPLIED','REVERTED')),transformation_json jsonb NOT NULL,
          PRIMARY KEY(group_id,source_key));
        ALTER TABLE pilot_worker_map ENABLE ROW LEVEL SECURITY;
        ALTER TABLE pilot_worker_map FORCE ROW LEVEL SECURITY;
        GRANT SELECT,INSERT,UPDATE ON pilot_worker_map TO "${f.role}";`);
      for (const table of ['clientes', 'cliente_locais', 'cliente_local_finalidades', 'pilot_worker_map']) await f.exec(`
        CREATE POLICY address_fixture_scope ON ${table} FOR ALL TO "${f.role}"
        USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
          AND NULLIF(current_setting('app.empresa_id',true),'') IS NULL)
        WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
          AND NULLIF(current_setting('app.empresa_id',true),'') IS NULL)`);
      await f.exec(`CREATE POLICY address_fixture_audit ON audit_logs FOR INSERT TO "${f.role}"
        WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);`);
      assert(f.data.pool);
      const db = createPoolDbClient(f.data.pool), realRbac = new PostgresRbacGuard(db);
      const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: randomUUID() };
      let failAudit = false, denyLate = false, auditSeen = false, expired: DbClient | undefined;
      const identities = new Set<string>();
      const observed: DbClient = { ...db, withTransaction: fn => db.withTransaction(q => {
        const tracked: DbQueryExecutor = { query: async (sql, values) => {
          if (/INSERT INTO (?:cliente_locais|audit_logs|pilot_worker_map)/.test(sql)) {
            const stamp = (await q.query<{ pid: number; tx: string }>('SELECT pg_backend_pid() AS pid,txid_current()::text AS tx')).rows[0];
            identities.add(stamp.pid + ':' + stamp.tx);
          }
          return q.query(sql, values);
        } };
        return fn(tracked);
      }) };
      const factory = (context: RequestContext = ctx) => criarTransacaoEnderecoPilotoPostgres({ db: observed, ctx: context,
        rbacGuard: { assertAllowed: async (...args: Parameters<typeof realRbac.assertAllowed>) => {
          if (denyLate && auditSeen) throw new Error('SYNTHETIC_LATE_PERMISSION_DENIED');
          return realRbac.assertAllowed(...args);
        } }, criarServico: (bound: DbClient, rbac: RbacGuard) => {
          expired = bound; const audit = new PostgresAuditRepository(bound);
          return new ClienteLocalService(new PostgresClienteLocalRepository(bound), new PostgresClienteRepository(bound), {
            listByEntity: audit.listByEntity.bind(audit), append: async (entry, executor) => {
              if (failAudit) throw new Error('SYNTHETIC_AUDIT_FAILURE');
              await audit.append(entry, executor); auditSeen = true;
            },
          }, new PostgresTenantGuard(bound), rbac);
        } });
      const emptyConflicts: string[] = [];
      let sourceSequence = 10;
      const source = (key: string = randomUUID()) => ({ groupId: ID.groupA, clienteId: ID.clientePfA, key, conflicts: emptyConflicts,
        fingerprint: 'a'.repeat(64), raw: { synthetic: true, sourceAddressId: key }, transformation: { version: 'synthetic-explicit-fields-v1' },
        payload: { nome: 'SYNTHETIC ADDRESS', cep: '00000000', logradouro: 'SYNTHETIC STREET', numero: String(++sourceSequence),
          bairro: 'SYNTHETIC DISTRICT', cidade: 'SYNTHETIC CITY', uf: 'SP', pais: 'BRASIL', origem: 'MIGRACAO',
          legacy_id: key, source_system: 'SYNTHETIC_ADDRESS_344', migration_batch: ctx.requestId,
          finalidades: [{ finalidade: 'ENTREGA', principal: false }] } });
      const apply = (s: ReturnType<typeof source>, transaction = factory()) => persistirEnderecoClienteGrupoLegado(s, { transaction });
      const counts = async () => (await f.admin.query<{ addresses: number; maps: number; audits: number }>(`SELECT
        (SELECT count(*)::int FROM cliente_locais WHERE source_system='SYNTHETIC_ADDRESS_344') AS addresses,
        (SELECT count(*)::int FROM pilot_worker_map) AS maps,
        (SELECT count(*)::int FROM audit_logs WHERE request_id=$1) AS audits`, [ctx.requestId])).rows[0];

      await t.test('one real transaction owns canonical address, audit and ledger; replay is read-only', async () => {
        identities.clear(); const s = source(), first = await apply(s), after = await counts();
        assert.equal(first.created, true); assert.equal(identities.size, 1);
        assert.deepEqual(after, { addresses: 1, maps: 1, audits: 1 });
        const again = await apply(s); assert.equal(again.id, first.id); assert.equal(again.created, false);
        assert.deepEqual(await counts(), after);
        assert(expired); await assert.rejects(expired.query('SELECT 1'), /EXECUTOR_EXPIRED/);
      });
      await t.test('audit failure, map SQL failure and late denial roll back all three writes', async () => {
        const before = await counts(); failAudit = true;
        await assert.rejects(apply(source()), /SYNTHETIC_AUDIT_FAILURE/); failAudit = false;
        assert.deepEqual(await counts(), before);
        await f.exec(`CREATE FUNCTION address_map_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.source_key='synthetic-map-failure' THEN RAISE EXCEPTION 'SYNTHETIC_MAP_FAILURE'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER address_map_fail BEFORE INSERT ON pilot_worker_map FOR EACH ROW EXECUTE FUNCTION address_map_fail();`);
        await assert.rejects(apply(source('synthetic-map-failure')), /SYNTHETIC_MAP_FAILURE/);
        assert.deepEqual(await counts(), before);
        auditSeen = false; denyLate = true;
        await assert.rejects(apply(source()), /SYNTHETIC_LATE_PERMISSION_DENIED/); denyLate = false;
        assert.deepEqual(await counts(), before);
      });
      await t.test('incomplete or conflicting fields, foreign parent and company context cannot be written', async () => {
        const before = await counts(), s = source();
        for (const field of ['numero', 'pais']) await assert.rejects(apply({ ...s, payload: { ...s.payload, [field]: '' } }), /FIELDS_UNPROVEN/);
        await assert.rejects(apply({ ...s, conflicts: ['SOURCE_CONFLICT'] }), /FIELDS_UNPROVEN/);
        await assert.rejects(apply({ ...s, clienteId: ID.clientePjB }), /MAP_SCOPE_DENIED/);
        assert.throws(() => factory({ ...ctx, empresaId: ID.empresaA }), /TRANSACTION_CONTRACT_REQUIRED/);
        assert.deepEqual(await counts(), before);
      });
      await t.test('two real connections queue before the first ledger insertion, then converge without duplicates', async () => {
        assert(f.admin.pool); const blocker = await f.admin.pool.connect(), s = source(), before = await counts();
        let attempts: Promise<unknown>[] = [];
        try {
          await blocker.query('BEGIN'); await blocker.query(`SET LOCAL search_path TO "${f.schema}",pg_catalog`);
          await blocker.query('SELECT id FROM clientes WHERE id=$1 FOR UPDATE', [ID.clientePfA]);
          attempts = [apply(s), apply(s)];
          let queued = false;
          for (let i = 0; i < 100; i++) {
            const n = (await f.admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE usename=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM clientes%'`, [f.role])).rows[0].n;
            if (n === 2) { queued = true; break; }
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          assert.equal(queued, true, 'Both connections must demonstrably contend on the parent before map load');
        } finally { await blocker.query('ROLLBACK'); blocker.release(); }
        const results = await Promise.all(attempts);
        assert.equal(results.filter(r => r && typeof r === 'object' && 'created' in r && r.created === true).length, 1);
        assert.deepEqual(await counts(), { addresses: before.addresses + 1, maps: before.maps + 1, audits: before.audits + 1 });
      });
      await t.test('logical reversal and ledger are atomic; outside edits remain protected', async () => {
        const s = source(), first = await apply(s), transaction = factory();
        const before = await counts();
        assert.equal((await persistirEnderecoClienteGrupoLegado(s, { transaction, action: 'revert' })).reverted, true);
        const map = (await f.admin.query<{ state: string; raw_source_json: unknown }>('SELECT state,raw_source_json FROM pilot_worker_map WHERE source_key=$1', [s.key])).rows[0];
        assert.equal(map.state, 'REVERTED'); assert.equal(fingerprintEnderecoLegado(map.raw_source_json), fingerprintEnderecoLegado(s.raw));
        assert.equal((await f.admin.query<{ ativo: boolean }>('SELECT ativo FROM cliente_locais WHERE id=$1', [first.id])).rows[0].ativo, false);
        assert.equal((await persistirEnderecoClienteGrupoLegado(s, { transaction, action: 'revert' })).reverted, false);
        const current = await counts(); assert.equal(current.addresses, before.addresses); assert.equal(current.audits, before.audits + 1);
        const edited = source(), created = await apply(edited);
        await f.admin.query("UPDATE cliente_locais SET numero='EXTERNAL' WHERE id=$1", [created.id]);
        await assert.rejects(persistirEnderecoClienteGrupoLegado(edited, { transaction: factory(), action: 'revert' }), /DESTINATION_CHANGED_OUTSIDE_BATCH/);
        assert.equal((await f.admin.query<{ state: string }>('SELECT state FROM pilot_worker_map WHERE source_key=$1', [edited.key])).rows[0].state, 'APPLIED');
      });
    } finally { await f.close(); }
  });
