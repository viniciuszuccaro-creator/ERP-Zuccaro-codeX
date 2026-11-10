import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { localCrmFixture, ROLE } from './helpers/crmFixture.ts';
import { SEED_IDS as ID } from '../scripts/seedDevIds.ts';
import { PostgresClienteRepository } from '../src/repositories/postgresClienteRepository.ts';
import { InMemoryClienteRepository } from '../src/repositories/inMemoryClienteRepository.ts';
import { PostgresAuditRepository, InMemoryAuditRepository } from '../src/audit/auditRepository.ts';
import { InMemoryRbacGuard, PostgresRbacGuard } from '../src/db/rbacGuard.ts';
import { InMemoryTenantGuard, PostgresTenantGuard } from '../src/db/tenantGuard.ts';
import { ClienteService } from '../src/services/clienteService.ts';
import { clienteContatoSchema } from '../src/repositories/clienteTypes.ts';
import { mapLegadoClienteContatos } from '../../scripts/legado/mapear-registro-sintetico.mjs';
import { clienteContatosVersion, canonicalClienteJson } from '../src/services/clienteContatos.ts';
import { enrichLegacyContacts, legacyContactsFingerprint } from '../src/services/clienteLegacyNameCorrection.ts';
import type { RequestContext, AuditRepository } from '../src/audit/types.ts';

const channels = [
  { id: 'native-0001', tipo: 'Telefone' as const, valor: '00112233', ramal: '0007',
    nome: 'SYNTHETIC', cargo: 'Compras', legacy_id: '00001', source_system: 'SYNTHETIC', principal: true },
  { id: 'native-0002', tipo: 'E-mail' as const, valor: 'synthetic@example.invalid', ativo: false },
  { id: 'native-0003', tipo: 'Celular' as const, nome: 'SYNTHETIC metadata only' },
];
const ctx = { groupId: ID.groupA, empresaId: null, actorId: ID.runtimeActorA, requestId: 'synthetic-contacts' };
const version = (row: { contatos_version?: string }) => { assert.ok(row.contatos_version); return row.contatos_version; };

test('contacts canonical persistence, CAS and legacy receipts: isolated synthetic PGlite', async t => {
  const f = await localCrmFixture();
  try {
    await f.exec(`GRANT SELECT,UPDATE ON clientes TO "${ROLE}";
      GRANT SELECT ON empresas TO "${ROLE}";
      CREATE POLICY contacts_client ON clientes FOR ALL TO "${ROLE}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      CREATE POLICY contacts_audit ON audit_logs FOR ALL TO "${ROLE}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL)
      WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id IS NULL);
      CREATE POLICY contacts_company ON empresas FOR SELECT TO "${ROLE}"
      USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid);
      SELECT set_config('app.group_id','${ID.groupA}',false),set_config('app.empresa_id','',false)`);
    const batch = randomUUID();
    await f.admin.query(`UPDATE clientes SET empresa_id=NULL,origem='MIGRACAO',codigo_legado='SYNTHETIC-CONTACTS',
      source_system='SYNTHETIC',migration_batch=$1 WHERE id=$2`, [batch, ID.clientePfA]);
    const permissions = { Cadastros: { cliente: ['visualizar', 'editar', 'importar'] } };
    const setPermissions = (p: unknown) => f.admin.query('UPDATE profiles SET permissoes=$1::jsonb,empresa_id=NULL WHERE id=$2',
      [JSON.stringify(p), ctx.actorId]);
    await setPermissions(permissions);
    const repo = new PostgresClienteRepository(f.data), audit = new PostgresAuditRepository(f.data);
    const rbac = new PostgresRbacGuard(f.data), tenant = new PostgresTenantGuard(f.data);
    const service = (auditRepo: AuditRepository = audit, guard = rbac) => new ClienteService(repo, auditRepo, tenant, guard);
    const get = () => service().get(ctx, ID.clientePfA);
    const snapshot = () => repo.withTransaction(q => { assert.ok(q); return repo.getBulkSnapshot(ctx, ID.clientePfA, q); });
    const audits = async () => (await audit.listByEntity('Cliente', ID.clientePfA)).length;
    await t.test('old schema: scalar update works; missing contacts is not an empty baseline', async () => {
      const initial = await get();
      assert.equal(Object.hasOwn(initial, 'contatos'), false);
      assert.equal(initial.contatos_version, undefined);
      await service().update(ctx, ID.clientePfA, { observacoes: 'SYNTHETIC preserved' });
      await assert.rejects(service().update(ctx, ID.clientePfA, { contatos: [], expectedVersion: 'a'.repeat(64) }),
        { code: 'CLIENTE_CONTATOS_STORAGE_REQUIRED' });
    });
    // Candidate DDL runs only inside this disposable in-memory synthetic fixture.
    await f.exec(await readFile(new URL('../schema-candidates/cliente_contatos.sql', import.meta.url), 'utf8'));
    await t.test('NULL, rich round-trip, omission and explicit [] preserve all unrelated fields', async () => {
      const initial = await get(); assert.equal(initial.contatos, null);
      assert.match(initial.updated_at, /\.\d{6}Z$/);
      const before = await snapshot(); assert.ok(before);
      const changed = await service().update(ctx, ID.clientePfA, { contatos: channels, expectedVersion: version(initial) });
      assert.deepEqual(changed.contatos, channels);
      assert.equal(changed.contatos_version, version(await get()));
      const after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, contatos: channels, updated_at: after.updated_at });
      const saved = await service().update(ctx, ID.clientePfA, { observacoes: 'SYNTHETIC changed', contatos: undefined });
      assert.deepEqual(saved.contatos, channels);
      await assert.rejects(service().update(ctx, ID.clientePfA, { contatos: null, expectedVersion: version(saved) }),
        { code: 'VALIDATION_ERROR' });
      const empty = await service().update(ctx, ID.clientePfA, { contatos: [], expectedVersion: version(saved) });
      assert.deepEqual(empty.contatos, []);
      const history = await audit.listByEntity('Cliente', ID.clientePfA);
      assert.deepEqual((history.at(-1)?.beforeData as any).contatos, channels);
      assert.deepEqual((history.at(-1)?.afterData as any).contatos, []);
    });
    await t.test('200/201, duplicates, unknown links and SQL array checks fail closed', async () => {
      const many = Array.from({ length: 200 }, (_, i) => ({ id: `synthetic-${i}`, tipo: 'Telefone', valor: '0001' }));
      const changed = await service().update(ctx, ID.clientePfA, { contatos: many, expectedVersion: version(await get()) });
      assert.equal(changed.contatos?.length, 200);
      const count = await audits();
      for (const contatos of [[...many, { id: 'overflow', tipo: 'Telefone', valor: '0001' }],
        [channels[0], channels[0]], [{ ...channels[0], contato_b2b_id: 'unchecked-native-id' }]]) {
        await assert.rejects(service().update(ctx, ID.clientePfA, { contatos, expectedVersion: version(changed) }));
      }
      for (const value of [{}, Array.from({ length: 201 }, () => ({})), 'invalid', null]) {
        await assert.rejects(f.admin.query('UPDATE clientes SET contatos=$1::jsonb WHERE id=$2', [JSON.stringify(value), ID.clientePfA]));
      }
      assert.equal(await audits(), count);
      await service().update(ctx, ID.clientePfA, { contatos: [], expectedVersion: version(changed) });
    });
    await t.test('CAS binds Group, Company, Actor and canonical full snapshot', async () => {
      const initial = await get();
      await f.admin.query('UPDATE profiles SET group_id=$1,empresa_id=NULL,permissoes=$2::jsonb WHERE id=$3',
        [ctx.groupId, JSON.stringify(permissions), ID.runtimeActorB]);
      assert.equal(clienteContatosVersion(ctx, { ...initial, contatos: channels }),
        clienteContatosVersion(ctx, { ...initial, contatos: channels.map(c => Object.fromEntries(Object.entries(c).reverse())) as any }));
      for (const context of [{ ...ctx, groupId: ID.groupB }, { ...ctx, actorId: ID.runtimeActorB },
        { ...ctx, empresaId: ID.empresaA }]) {
        assert.notEqual(clienteContatosVersion(context, initial), version(initial));
        await assert.rejects(service().update(context, ID.clientePfA, { contatos: channels, expectedVersion: version(initial) }));
      }
      await assert.rejects(service().update({ ...ctx, actorId: null }, ID.clientePfA,
        { contatos: channels, expectedVersion: version(initial) }), { code: 'PERMISSION_DENIED' });
      await setPermissions({ Cadastros: { cliente: ['visualizar'] } });
      await assert.rejects(service().update(ctx, ID.clientePfA, { contatos: channels, expectedVersion: version(initial) }),
        { code: 'PERMISSION_DENIED' });
      await setPermissions(permissions);
      await service().update(ctx, ID.clientePfA, { observacoes: 'SYNTHETIC outside edit' });
      await assert.rejects(service().update(ctx, ID.clientePfA, { contatos: channels, expectedVersion: version(initial) }),
        { code: 'CLIENTE_CONTATOS_VERSION_CONFLICT' });
    });
    await t.test('two writers: one locked CAS wins, the other cannot overwrite', async () => {
      const initial = await get(), count = await audits();
      const results = await Promise.allSettled(['one', 'two'].map(id => service().update(ctx, ID.clientePfA,
        { contatos: [{ id, tipo: 'Telefone', valor: '0001' }], expectedVersion: version(initial) })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const loser = results.find(r => r.status === 'rejected');
      assert.equal(loser?.status === 'rejected' && loser.reason.code, 'CLIENTE_CONTATOS_VERSION_CONFLICT');
      assert.equal(await audits(), count + 1);
    });
    const failingAudit: AuditRepository = { append: async () => { throw new Error('SYNTHETIC_AUDIT_FAILURE'); },
      listByEntity: (...args) => audit.listByEntity(...args) };
    await t.test('audit failure and final reauthorization roll back mutation and audit', async () => {
      const initial = await snapshot(), row = await get(), count = await audits();
      await assert.rejects(service(failingAudit).update(ctx, ID.clientePfA,
        { contatos: channels, expectedVersion: version(row) }), /SYNTHETIC_AUDIT_FAILURE/);
      assert.deepEqual(await snapshot(), initial);
      let calls = 0;
      class RevokingGuard extends PostgresRbacGuard {
        override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
          if (++calls === 3) throw new Error('SYNTHETIC_REVOKED_BEFORE_COMMIT');
          return super.assertAllowed(...args);
        }
      }
      await assert.rejects(service(audit, new RevokingGuard(f.data)).update(ctx, ID.clientePfA,
        { contatos: channels, expectedVersion: version(row) }), /SYNTHETIC_REVOKED_BEFORE_COMMIT/);
      assert.deepEqual(await snapshot(), initial); assert.equal(await audits(), count);
    });
    await t.test('caller input and context captured before first await', async () => {
      const initial = await get(), request = { ...ctx }, proposed = { contatos: structuredClone(channels), expectedVersion: version(initial) };
      let mutated = false;
      class MutatingGuard extends PostgresRbacGuard {
        override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
          await super.assertAllowed(...args);
          if (!mutated) { mutated = true; request.groupId = ID.groupB; proposed.contatos[0].valor = 'FORGED'; }
        }
      }
      await service(audit, new MutatingGuard(f.data)).update(request, ID.clientePfA, proposed);
      assert.deepEqual((await get()).contatos, channels);
    });
    const enrich = (input: unknown, auditRepo = audit, context: RequestContext = ctx) =>
      enrichLegacyContacts({ repo, audit: auditRepo, rbac }, context, input);
    await t.test('legacy apply/replay/reverse use raw complete snapshots, audit and NDJSON proof', async () => {
      await f.admin.query('UPDATE clientes SET contatos=NULL WHERE id=$1', [ID.clientePfA]);
      const before = await snapshot(); assert.ok(before);
      const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
        expectedFingerprint: legacyContactsFingerprint(before), sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-CONTACTS', batch,
        contatos: channels, sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'ndjson-v1' } };
      const count = await audits();
      await assert.rejects(enrich(command, failingAudit as any), /SYNTHETIC_AUDIT_FAILURE/);
      assert.deepEqual(await snapshot(), before);
      for (const delta of [{ sourceProof: { ...command.sourceProof, parser: 'csv-rfc4180-doublequote-v1' } },
        { expectedFingerprint: 'c'.repeat(64) }, { legacyCode: 'OTHER' }, { batch: randomUUID() }]) {
        await assert.rejects(enrich({ ...command, ...delta }));
      }
      await assert.rejects(enrich(command, audit, { ...ctx, empresaId: ID.empresaA }), { code: 'LEGACY_GROUP_SCOPE_REQUIRED' });
      const applied = await enrich(command);
      const after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, contatos: channels, updated_at: after.updated_at });
      assert.equal((await enrich(command)).reused, true); assert.equal(await audits(), count + 1);
      await assert.rejects(enrich({ ...command, contatos: [] }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      const reverse = { mode: 'reverse', id: command.id, operationId: randomUUID(), originalOperationId: command.operationId,
        expectedFingerprint: applied.fingerprint, sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
      await enrich(reverse);
      const restored = await snapshot(); assert.ok(restored);
      assert.deepEqual(restored, { ...before, updated_at: restored.updated_at });
      assert.equal((await enrich(reverse)).reused, true); assert.equal(await audits(), count + 2);
      const again = { ...command, operationId: randomUUID(), expectedFingerprint: legacyContactsFingerprint(restored) };
      const appliedAgain = await enrich(again);
      await service().update(ctx, ID.clientePfA, { observacoes: 'SYNTHETIC external after apply' });
      await assert.rejects(enrich({ ...reverse, operationId: randomUUID(), originalOperationId: again.operationId,
        expectedFingerprint: appliedAgain.fingerprint }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      assert.equal((await snapshot())?.observacoes, 'SYNTHETIC external after apply');
      const current = await snapshot(); assert.ok(current);
      const appended = [...channels, { id: 'native-appended', tipo: 'Telefone', valor: '005566' }];
      const addition = { ...command, operationId: randomUUID(), contatos: appended, expectedFingerprint: legacyContactsFingerprint(current) };
      const enriched = await enrich(addition);
      assert.deepEqual((await snapshot())?.contatos, appended);
      await enrich({ ...reverse, operationId: randomUUID(), originalOperationId: addition.operationId,
        expectedFingerprint: enriched.fingerprint });
      const richRestored = await snapshot(); assert.ok(richRestored);
      assert.deepEqual(richRestored, { ...current, updated_at: richRestored.updated_at });
    });
    await t.test('legacy enrichment rejects clearing and manual rewrites; only new IDs append with exact reversal', async () => {
      const before = await snapshot(); assert.ok(before);
      const baseline = structuredClone(before.contatos) as typeof channels;
      assert.ok(baseline.length > 1);
      const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
        expectedFingerprint: legacyContactsFingerprint(before), sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-CONTACTS', batch,
        contatos: baseline, sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'ndjson-v1' } };
      const count = await audits();
      const changed = (field: string) => baseline.map((c, i) => i === 0 ? { ...c, [field]: 'SYNTHETIC overwrite' } : c);
      for (const contatos of [[], baseline.slice(1), [...baseline].reverse(), baseline,
        changed('valor'), changed('nome'), changed('cargo'),
        [...baseline, { tipo: 'Telefone', valor: '007788' }]]) {
        await assert.rejects(enrich({ ...command, operationId: randomUUID(), contatos }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
        assert.deepEqual(await snapshot(), before, 'rejected enrichment must preserve the complete before snapshot');
        assert.equal(await audits(), count, 'rejected enrichment must not publish a receipt');
      }
      await assert.rejects(enrich({ ...command, contatos: [...baseline, baseline[0]] }), { code: 'VALIDATION_ERROR' });
      assert.deepEqual(await snapshot(), before); assert.equal(await audits(), count);
      const addition = { ...command, contatos: [...baseline, { id: 'new-enrichment-only', tipo: 'Telefone', valor: '007788' }] };
      const applied = await enrich(addition);
      const after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, contatos: addition.contatos, updated_at: after.updated_at });
      assert.deepEqual((after.contatos as typeof channels).slice(0, baseline.length), baseline);
      assert.equal((await enrich(addition)).reused, true); assert.equal(await audits(), count + 1);
      const reversal = { mode: 'reverse', id: command.id, operationId: randomUUID(), originalOperationId: addition.operationId,
        expectedFingerprint: applied.fingerprint, sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
      await enrich(reversal);
      const restored = await snapshot(); assert.ok(restored);
      assert.deepEqual(restored, { ...before, updated_at: restored.updated_at });
      assert.equal((await enrich(reversal)).reused, true); assert.equal(await audits(), count + 2);
    });
    await t.test('legacy captures caller fields before await; final reauthorization failure rolls back receipt', async () => {
      const before = await snapshot(); assert.ok(before);
      const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
        expectedFingerprint: legacyContactsFingerprint(before), sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-CONTACTS', batch,
        contatos: [...structuredClone(channels), { id: 'native-captured-addition', tipo: 'Telefone' as const, valor: '001100' }],
        sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'ndjson-v1' } };
      const request = { ...ctx }, approved = structuredClone(command);
      let once = false;
      class CaptureGuard extends PostgresRbacGuard {
        override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
          await super.assertAllowed(...args);
          if (!once) { once = true; request.actorId = ID.runtimeActorB; command.contatos[0].valor = 'FORGED'; command.sourceProof.rowSha256 = 'c'.repeat(64); }
        }
      }
      const result = await enrichLegacyContacts({ repo, audit, rbac: new CaptureGuard(f.data) }, request, command);
      const receipt = (await audit.listByEntity('Cliente', ID.clientePfA)).find(e => (e.afterData as any)?.operationId === approved.operationId);
      assert.equal(receipt?.actorId, ctx.actorId);
      assert.deepEqual((receipt?.afterData as any).sourceProof, approved.sourceProof);
      assert.deepEqual((await snapshot())?.contatos, approved.contatos);
      assert.equal((await enrich(approved)).reused, true);
      const current = await snapshot(), count = await audits(); assert.ok(current);
      let checks = 0;
      class RevokeGuard extends PostgresRbacGuard {
        override async assertAllowed(...args: Parameters<PostgresRbacGuard['assertAllowed']>) {
          if (++checks === 5) throw new Error('SYNTHETIC_LEGACY_REVOKED');
          return super.assertAllowed(...args);
        }
      }
      await assert.rejects(enrichLegacyContacts({ repo, audit, rbac: new RevokeGuard(f.data) }, ctx,
        { ...approved, operationId: randomUUID(), expectedFingerprint: result.fingerprint,
          contatos: [...approved.contatos, { id: 'native-must-rollback', tipo: 'Telefone', valor: '009900' }] }), /SYNTHETIC_LEGACY_REVOKED/);
      assert.deepEqual(await snapshot(), current); assert.equal(await audits(), count);
    });
  } finally { await f.close(); }
});

test('in-memory parity: NULL/omission/[], serialized CAS and defensive contact copies', async () => {
  const repo = new InMemoryClienteRepository(), audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ctx.actorId, groupId: ctx.groupId, permissions: { Cadastros: { cliente: ['criar', 'visualizar', 'editar'] } } });
  const service = new ClienteService(repo, audit, new InMemoryTenantGuard(), rbac);
  const created = await service.create(ctx, { tipo: 'Pessoa Física', nome: 'SYNTHETIC', documento: '52998224725' });
  const initial = await service.get(ctx, created.id); assert.equal(initial.contatos, null);
  const rich = await service.update(ctx, created.id, { contatos: channels, expectedVersion: version(initial) });
  rich.contatos![0].valor = 'FORGED';
  assert.deepEqual((await service.get(ctx, created.id)).contatos, channels);
  await service.update(ctx, created.id, { observacoes: 'SYNTHETIC', contatos: undefined });
  const before = await service.get(ctx, created.id);
  const results = await Promise.allSettled([1, 2].map(() => service.update(ctx, created.id,
    { contatos: [], expectedVersion: version(before) })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual((await service.get(ctx, created.id)).contatos, []);
  assert.equal((await service.get(ctx, created.id)).observacoes, 'SYNTHETIC');
  assert.equal(canonicalClienteJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('pure native mapper delegates to the canonical contact schema without losing valid sibling fields', () => {
  const result = mapLegadoClienteContatos({ nativeParent: { CODIGOCLIENTE: 7, EMAIL: 'valid@example.invalid' },
    nativeKey: 7, sourceSystem: 'SYNTHETIC',
    canonical: { id: ID.clientePfA, group_id: ctx.groupId, empresa_id: null, codigo_legado: '7',
      source_system: 'SYNTHETIC', contatos: null },
    contacts34: [{ CODIGOCLIENTE: 7, SEQUENCIA: 1, TELEFCLIENTE: '001122', EMAIL: 'invalid email',
      NOMECONTATO: '<unsafe>', CARGOSETOR: 'SYNTHETIC cargo' },
    { CODIGOCLIENTE: 7, SEQUENCIA: 2, TELEFCLIENTE: '004455', EMAIL: 'x'.repeat(181) }] },
  { batchUUID: randomUUID(), validateContact: value => clienteContatoSchema.safeParse(value) });
  assert.equal(result.status, 'partial'); assert.equal(result.contatos?.length, 3);
  assert.equal(result.quarentena.filter(q => q.field === 'EMAIL').length, 2);
  assert(result.quarentena.some(q => q.field === 'NOMECONTATO'));
  const phone = result.contatos?.find(c => c.valor === '001122');
  assert.equal(phone?.cargo, 'SYNTHETIC cargo'); assert.equal(Object.hasOwn(phone!, 'nome'), false);
  assert(result.contatos?.every(c => clienteContatoSchema.safeParse(c).success));
});
