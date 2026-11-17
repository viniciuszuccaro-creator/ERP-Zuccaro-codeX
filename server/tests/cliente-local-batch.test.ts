import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { DbClient, DbQueryExecutor } from '../src/db/client.ts';
import { PostgresClienteLocalRepository } from '../src/repositories/postgresClienteLocalRepository.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { PostgresAuditRepository } from '../src/audit/auditRepository.ts';
import { ClienteLocalService } from '../src/services/clienteLocalService.ts';
import { InMemoryRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard } from '../src/db/tenantGuard.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';

test('canonical local batch: CAS, rollback, replay rejection, permissions and fixed context (PGlite)', async t => {
  const pg = new PGlite();
  try {
    const migrations = new URL('../migrations/', import.meta.url);
    for (const file of readdirSync(migrations).filter(name => /^\d{3}_.*\.sql$/.test(name)).sort()) {
      await pg.exec(readFileSync(new URL(file, migrations), 'utf8')
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, ''));
    }
    await pg.exec(readFileSync(new URL('../scripts/seed-dev-synthetic.sql', import.meta.url), 'utf8'));
    const db: DbClient = {
      pool: null, query: (sql, values) => pg.query(sql, values as never) as never,
      withTransaction: fn => pg.transaction(tx => fn({
        query: (sql, values) => tx.query(sql, values as never) as never,
      } as DbQueryExecutor)), checkConnection: async () => true, end: async () => {},
    };
    const rbac = new InMemoryRbacGuard();
    rbac.link({ actorId: ID.runtimeActorA, groupId: ID.groupA, permissions: {
      Cadastros: { cliente_local: ['visualizar', 'criar', 'editar', 'principal', 'inativar', 'restaurar'] },
    } });
    const service = new ClienteLocalService(new PostgresClienteLocalRepository(db),
      new PostgresClienteRepository(db), new PostgresAuditRepository(db), new InMemoryTenantGuard(), rbac);
    const ctx = { groupId: ID.groupA, actorId: ID.runtimeActorA, requestId: 'local-batch-synthetic' };
    const snapshot = () => service.snapshot(ctx, ID.clientePjA);
    const base = await snapshot();
    assert(base.data.length >= 2);
    const first = base.data[0].id, second = base.data[1].id;
    const countAudit = async () => (await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n;

    await t.test('two writes commit once; old version cannot replay or duplicate', async () => {
      const audits = await countAudit();
      const payload = { version: base.version, operations: [
        { op: 'update', id: first, data: { referencia: 'Sintetico A' } },
        { op: 'update', id: second, data: { referencia: 'Sintetico B' } },
      ] };
      const result = await service.sync(ctx, ID.clientePjA, payload);
      assert.equal(result.batchAtomic, true);
      assert.equal(result.data.length, 2);
      assert.equal(await countAudit(), audits + 2);
      await assert.rejects(service.sync(ctx, ID.clientePjA, payload), { code: 'CLIENTE_LOCAIS_VERSION_CONFLICT' });
      assert.equal(await countAudit(), audits + 2);
      assert.equal((await snapshot()).version, result.version);
    });
    await t.test('second write failure rolls back first write and audit', async () => {
      const before = await snapshot(), audits = await countAudit();
      await assert.rejects(service.sync(ctx, ID.clientePjA, { version: before.version, operations: [
        { op: 'update', id: first, data: { referencia: 'Never persisted' } },
        { op: 'update', id: ID.clienteLocalB1, data: { referencia: 'Cross tenant' } },
      ] }), { code: 'CLIENTE_LOCAL_NOT_FOUND' });
      assert.equal((await snapshot()).version, before.version);
      assert.equal(await countAudit(), audits);
    });
    await t.test('invalid second payload and omitted operations never write', async () => {
      const before = await snapshot();
      await assert.rejects(service.sync(ctx, ID.clientePjA, { version: before.version, operations: [
        { op: 'update', id: first, data: { referencia: 'Never' } },
        { op: 'update', id: second, data: { bogus: true } },
      ] }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(service.sync(ctx, ID.clientePjA, { version: before.version }), { code: 'VALIDATION_ERROR' });
      assert.equal((await snapshot()).version, before.version);
    });
    await t.test('permission, foreign group/company and actor denied', async () => {
      const before = await snapshot();
      const payload = { version: before.version, operations: [{ op: 'update', id: first, data: { referencia: 'Denied' } }] };
      await assert.rejects(service.sync({ ...ctx, actorId: ID.runtimeActorB }, ID.clientePjA, payload));
      await assert.rejects(service.sync({ ...ctx, groupId: ID.groupB }, ID.clientePjA, payload));
      await assert.rejects(service.sync({ ...ctx, empresaId: ID.empresaB }, ID.clientePjA, payload));
      assert.equal((await snapshot()).version, before.version);
    });
    await t.test('audit failure rolls back business data', async () => {
      const before = await snapshot();
      const failing = new ClienteLocalService(new PostgresClienteLocalRepository(db), new PostgresClienteRepository(db), {
        append: async () => { throw new Error('AUDIT_FAILURE'); }, listByEntity: async () => [],
      }, new InMemoryTenantGuard(), rbac);
      await assert.rejects(failing.sync(ctx, ID.clientePjA, { version: before.version, operations: [
        { op: 'update', id: first, data: { referencia: 'Never audited' } },
      ] }), /AUDIT_FAILURE/);
      assert.equal((await snapshot()).version, before.version);
    });
    await t.test('same snapshot competing saves admit only one winner', async () => {
      const before = await snapshot(), audits = await countAudit();
      const saves = await Promise.allSettled(['A', 'B'].map(value => service.sync(ctx, ID.clientePjA, {
        version: before.version, operations: [{ op: 'update', id: first, data: { referencia: `Winner ${value}` } }],
      })));
      assert.equal(saves.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = saves.find(result => result.status === 'rejected');
      assert.equal(rejected?.status === 'rejected' && rejected.reason.code, 'CLIENTE_LOCAIS_VERSION_CONFLICT');
      assert.equal(await countAudit(), audits + 1);
    });
    await t.test('create replay cannot duplicate; purposes and inactivation are reversible operations', async () => {
      const before = await snapshot();
      const payload = { version: before.version, operations: [{ op: 'create', data: {
        nome: 'Local sintetico lote', cep: '00123456', logradouro: 'Rua sintetica', numero: '25',
        bairro: 'Bairro sintetico', cidade: 'Cidade sintetica', uf: 'SP', pais: 'BRASIL',
        finalidades: [{ finalidade: 'COBRANCA', principal: false }],
      } }] };
      const created = await service.sync(ctx, ID.clientePjA, payload);
      await assert.rejects(service.sync(ctx, ID.clientePjA, payload), { code: 'CLIENTE_LOCAIS_VERSION_CONFLICT' });
      assert.equal((await snapshot()).data.length, before.data.length + 1);
      const changed = await service.sync(ctx, ID.clientePjA, { version: created.version, operations: [
        { op: 'purposes', id: created.data[0].id, finalidades: [{ finalidade: 'FISCAL', principal: false }] },
        { op: 'inactivate', id: created.data[0].id },
      ] });
      assert.equal(changed.data[0].finalidades[0].finalidade, 'FISCAL');
      assert.equal(changed.data[1].ativo, false);
      assert.equal((await snapshot()).data.length, before.data.length);
      const restored = await service.restore(ctx, ID.clientePjA, created.data[0].id);
      assert.equal(restored.id, created.data[0].id);
      assert.equal(restored.ativo, true);
    });
    await t.test('migration review stores partial components inactive without fake country, and cannot restore', async () => {
      const payload={nome:'',cep:'01310100',logradouro:'Rua sintetica parcial',numero:'',bairro:'Bairro',cidade:'Cidade',uf:'SP',pais:'',
        origem:'MIGRACAO',legacy_id:'ClientesObras:00001:002:003',source_system:'SYNTHETIC_NATIVE',migration_batch:'synthetic-review',
        imported_at:'2026-11-12T00:00:00Z',endereco_incompleto:true,ativo:false,finalidades:[{finalidade:'ENTREGA',principal:false}]};
      const before=await snapshot(),audits=await countAudit();
      await assert.rejects(service.create(ctx,ID.clientePjA,payload),{code:'VALIDATION_ERROR'});
      await assert.rejects(service.createMigrationPending(ctx,ID.clientePjA,payload),{code:'PERMISSION_DENIED'});
      rbac.link({actorId:ID.runtimeActorA,groupId:ID.groupA,permissions:{Cadastros:{cliente:['importar'],cliente_local:['visualizar','criar','editar','principal','inativar','restaurar']}}});
      const row=await service.createMigrationPending(ctx,ID.clientePjA,payload);
      assert.equal(row.ativo,false);assert.equal(row.endereco_incompleto,true);
      for(const key of ['nome','numero','pais']as const)assert.equal(row[key],'');
      assert.equal(row.logradouro,payload.logradouro);assert.equal(row.legacy_id,payload.legacy_id);
      assert.equal((await snapshot()).version,before.version);
      assert.equal(await countAudit(),audits+1);
      await assert.rejects(service.get(ctx,ID.clientePjA,row.id),{code:'CLIENTE_LOCAL_NOT_FOUND'});
      await assert.rejects(service.restore(ctx,ID.clientePjA,row.id),{code:'MIGRATION_REVIEW_REQUIRED'});
      assert.equal((await service.getMigrationPending(ctx,ID.clientePjA,row.id)).ativo,false);
      assert((await service.list(ctx,ID.clientePjA,{ativo:false})).data.some(item=>item.id===row.id));
      await assert.rejects(service.createMigrationPending({...ctx,empresaId:ID.empresaA},ID.clientePjA,payload));
      for(const change of [{ativo:true},{origem:'ERP'},{finalidades:[{finalidade:'ENTREGA',principal:true}]},{pais:'BRASIL',nome:'Completo',numero:'20'},{cep:'invalid'},{latitude:0}])
        await assert.rejects(service.createMigrationPending(ctx,ID.clientePjA,{...payload,...change}),{code:'VALIDATION_ERROR'});
      const cancelled=await service.cancelMigrationPending(ctx,ID.clientePjA,row.id);
      assert.equal(cancelled.ativo,false);assert.equal(cancelled.finalidades.length,0);
      assert.equal(cancelled.logradouro,payload.logradouro);
      assert.equal((await snapshot()).version,before.version);
    });
    await t.test('review uses separate CAS, preserves identity and needs explicit permission to activate', async () => {
      const pending = await service.createMigrationPending(ctx, ID.clientePjA, {
        nome: '', cep: '01310100', logradouro: 'Rua revisao CAS', numero: '', bairro: 'Bairro',
        cidade: 'Cidade', uf: 'SP', pais: '', origem: 'MIGRACAO', legacy_id: 'synthetic-native-review',
        source_system: 'SYNTHETIC_NATIVE', migration_batch: 'synthetic-review-cas',
        imported_at: '2026-11-12T00:00:00Z',
        endereco_incompleto: true, ativo: false, finalidades: [{ finalidade: 'ENTREGA', principal: false }],
      });
      const row = async () => (await service.list(ctx, ID.clientePjA, { ativo: false })).data.find(x => x.id === pending.id);
      const before = await service.snapshot(ctx, ID.clientePjA, true), audits = await countAudit();
      const op = { op: 'review', id: pending.id, data: { nome: 'Obra comprovada', numero: '42', pais: 'BRASIL' } };
      const payload = { version: before.version, review_version: before.reviewVersion, operations: [op] };
      for (const denied of [{ ...ctx, actorId: ID.runtimeActorB }, { ...ctx, groupId: ID.groupB }, { ...ctx, empresaId: ID.empresaB }]) {
        await assert.rejects(service.sync(denied, ID.clientePjA, payload));
      }
      await assert.rejects(service.sync(ctx, ID.clientePjA, { ...payload, review_version: undefined }), { code: 'CLIENTE_LOCAIS_VERSION_CONFLICT' });
      await assert.rejects(service.sync(ctx, ID.clientePjA, { ...payload, operations: [{ ...op, data: { nome: 'Ainda parcial' } }] }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(service.sync(ctx, ID.clientePjA, { ...payload, operations: [{ ...op, data: { ...op.data, legacy_id: 'forged' } }] }), { code: 'VALIDATION_ERROR' });
      rbac.link({ actorId: ID.runtimeActorA, groupId: ctx.groupId, permissions: { Cadastros: { cliente_local: ['visualizar', 'editar'] } } });
      await assert.rejects(service.sync(ctx, ID.clientePjA, { ...payload, operations: [{ ...op, activate: true }] }), { code: 'PERMISSION_DENIED' });
      assert.equal(await countAudit(), audits); assert.equal((await row())?.endereco_incompleto, true);
      const done = await service.sync(ctx, ID.clientePjA, payload), completed = await row();
      assert.equal(completed?.id, pending.id); assert.equal(completed?.ativo, false);
      assert.equal(completed?.endereco_incompleto, false);
      for (const key of ['legacy_id', 'source_system', 'migration_batch', 'imported_at'] as const) assert.equal(completed?.[key], pending[key]);
      assert.equal(done.version, before.version, 'ordinary active snapshot contract unchanged');
      assert.notEqual(done.reviewVersion, before.reviewVersion);
      await assert.rejects(service.sync(ctx, ID.clientePjA, payload), { code: 'CLIENTE_LOCAIS_VERSION_CONFLICT' });
      assert.equal(await countAudit(), audits + 1);
      const noChange = { version: done.version, review_version: done.reviewVersion,
        operations: [{ op: 'review', id: pending.id, data: {} }] };
      await service.sync(ctx, ID.clientePjA, noChange);
      await service.sync(ctx, ID.clientePjA, noChange);
      assert.equal(await countAudit(), audits + 1, 'unchanged reviewed draft does not duplicate audit');
      rbac.link({ actorId: ID.runtimeActorA, groupId: ctx.groupId, permissions: { Cadastros: { cliente_local: ['visualizar', 'editar', 'restaurar'] } } });
      const active = await service.sync(ctx, ID.clientePjA, { version: done.version, review_version: done.reviewVersion,
        operations: [{ op: 'review', id: pending.id, data: {}, activate: true }] });
      assert.equal(active.data[0].id, pending.id); assert.equal(active.data[0].ativo, true);
      assert.equal((await service.get(ctx, ID.clientePjA, pending.id)).legacy_id, pending.legacy_id);
      assert.equal(await countAudit(), audits + 2);
    });
    await t.test('review rolls back first write/audit and concurrent inactive edits admit one winner', async () => {
      rbac.link({ actorId: ID.runtimeActorA, groupId: ctx.groupId, permissions: { Cadastros: {
        cliente: ['importar'], cliente_local: ['visualizar', 'criar', 'editar', 'restaurar'],
      } } });
      const local = await service.createMigrationPending(ctx, ID.clientePjA, {
        nome: '', cep: '01310100', logradouro: 'Rua fiscal transacional', numero: '', bairro: 'Bairro',
        cidade: 'Cidade', uf: 'SP', pais: '', origem: 'MIGRACAO', legacy_id: 'synthetic-fiscal-review',
        source_system: 'SYNTHETIC_NATIVE', migration_batch: 'synthetic-review-atomic', imported_at: '2026-11-12T00:00:00Z',
        endereco_incompleto: true, ativo: false, finalidades: [{ finalidade: 'FISCAL', principal: false }],
      });
      const read = () => service.snapshot(ctx, ID.clientePjA, true);
      const before = await read(), audits = await countAudit();
      const op = { op: 'review', id: local.id, data: { nome: 'Fiscal comprovado', numero: '51', pais: 'BRASIL' } };
      const payload = { version: before.version, review_version: before.reviewVersion, operations: [op] };
      await assert.rejects(service.sync(ctx, ID.clientePjA, { ...payload,
        operations: [op, { ...op, id: ID.clienteLocalB1 }] }), { code: 'CLIENTE_LOCAL_NOT_FOUND' });
      assert.equal((await read()).reviewVersion, before.reviewVersion);
      const failing = new ClienteLocalService(new PostgresClienteLocalRepository(db), new PostgresClienteRepository(db), {
        append: async () => { throw new Error('REVIEW_AUDIT_FAILURE'); }, listByEntity: async () => [],
      }, new InMemoryTenantGuard(), rbac);
      await assert.rejects(failing.sync(ctx, ID.clientePjA, payload), /REVIEW_AUDIT_FAILURE/);
      assert.equal((await read()).reviewVersion, before.reviewVersion);
      assert.equal(await countAudit(), audits);
      const attempts = await Promise.allSettled(['A', 'B'].map(label => service.sync(ctx, ID.clientePjA, {
        ...payload, operations: [{ ...op, data: { ...op.data, nome: `Fiscal ${label}` } }],
      })));
      assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
      const denied = attempts.find(x => x.status === 'rejected');
      assert.equal(denied?.status === 'rejected' && denied.reason.code, 'CLIENTE_LOCAIS_VERSION_CONFLICT');
      assert.equal(await countAudit(), audits + 1);
      const fiscal = (await service.list(ctx, ID.clientePjA, { ativo: false })).data.find(x => x.id === local.id);
      assert.equal(fiscal?.ativo, false); assert.equal(fiscal?.finalidades[0].finalidade, 'FISCAL');
    });
    await t.test('context mutation during authorization cannot retarget batch', async () => {
      const before = await snapshot();
      const original = { ...ctx };
      const guarded = new ClienteLocalService(new PostgresClienteLocalRepository(db), new PostgresClienteRepository(db),
        new PostgresAuditRepository(db), new InMemoryTenantGuard(), {
          assertAllowed: async (...args) => {
            original.actorId = ID.runtimeActorB;
            await rbac.assertAllowed(...args);
            assert.equal(args[0].actorId, ID.runtimeActorA);
          },
        });
      await guarded.sync(original, ID.clientePjA, { version: before.version, operations: [
        { op: 'update', id: first, data: { referencia: 'Fixed actor' } },
      ] });
      const audit = await pg.query<{ actor_id: string }>(
        "SELECT actor_id FROM audit_logs WHERE after_data->>'id'=$1 ORDER BY created_at DESC LIMIT 1", [first]);
      assert.equal(audit.rows[0].actor_id, ID.runtimeActorA);
    });
  } finally { await pg.close(); }
});
