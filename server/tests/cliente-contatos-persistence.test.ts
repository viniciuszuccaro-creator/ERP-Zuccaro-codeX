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
import { mapLegadoClienteMasterFields } from '../../scripts/legado/mapear-registro-sintetico.mjs';
import { clienteMasterExtrasSchema } from '../src/repositories/clienteMasterExtras.ts';
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

test('initial contacts: PostgreSQL repository SQL persists or rolls back the entire create (synthetic PGlite)', async () => {
  const f = await localCrmFixture();
  try {
    const repo = new PostgresClienteRepository(f.admin), audit = new PostgresAuditRepository(f.admin);
    const rbac = new InMemoryRbacGuard();
    rbac.link({ actorId: ctx.actorId, groupId: ctx.groupId, permissions: { Cadastros: { cliente: ['criar','visualizar'] } } });
    const service = new ClienteService(repo, audit, new InMemoryTenantGuard(), rbac);
    const payload = { tipo: 'Pessoa Física', documento: '12345678909', nome: 'SYNTHETIC initial SQL', contatos: channels };
    const original = repo.update.bind(repo);
    let failedId = '';
    repo.update = async (_scope, id) => { failedId = id; throw Error('SYNTHETIC_CONTACT_WRITE_FAILURE'); };
    await assert.rejects(service.create(ctx, payload), /SYNTHETIC_CONTACT_WRITE_FAILURE/);
    assert.equal(await repo.getById(ctx, failedId), null);
    assert.equal((await audit.listByEntity('Cliente', failedId)).length, 0);
    repo.update = original;
    const created = await service.create(ctx, payload);
    assert.deepEqual(created.contatos, channels);
    const reopened = await service.get(ctx, created.id);
    assert.deepEqual(reopened.contatos, channels);
    assert.match(reopened.contatos_version || '', /^[a-f0-9]{64}$/);
    const entries = await audit.listByEntity('Cliente', created.id);
    assert.equal(entries.filter(row => row.action === 'create').length, 1);
    assert.equal(entries.filter(row => row.action === 'update').length, 0);
  } finally { await f.close(); }
});

test('contacts canonical persistence, CAS and legacy receipts: isolated synthetic PGlite', async t => {
  const f = await localCrmFixture({ legacyContactsSchema: true });
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
    await t.test('native mapper enriches an inactive imported master without restoration or unrelated changes', async () => {
      const original = await snapshot(); assert.ok(original);
      await f.admin.query('UPDATE clientes SET ativo=false WHERE id=$1', [ID.clientePfA]);
      const before = await snapshot(); assert.ok(before);
      assert.equal(before.ativo, false);
      const mapped = mapLegadoClienteContatos({
        nativeParent: { CODIGOCLIENTE: 'SYNTHETIC-CONTACTS', EMAIL: null },
        contacts34: [{ CODIGOCLIENTE: 'SYNTHETIC-CONTACTS', SEQUENCIA: 17,
          TELEFCLIENTE: '0011223344', EMAIL: 'native@example.invalid',
          NOMECONTATO: 'SYNTHETIC native contact', CARGOSETOR: 'Compras' }],
        nativeKey: 'SYNTHETIC-CONTACTS', sourceSystem: 'SYNTHETIC', canonical: before,
      }, { batchUUID: batch, validateContact: (contact: unknown) => clienteContatoSchema.safeParse(contact) });
      assert.equal(mapped.status, 'ready'); assert.ok(mapped.contatos);
      const baseline = before.contatos as typeof channels;
      assert.deepEqual(mapped.contatos.slice(0, baseline.length), baseline);
      const added = mapped.contatos.slice(baseline.length);
      assert.equal(added.length, 2);
      assert.deepEqual(added.map(c => c.tipo).sort(), ['E-mail', 'Telefone']);
      assert.ok(added.every(c => c.nome === 'SYNTHETIC native contact' && c.cargo === 'Compras'
        && c.principal === undefined && c.ativo === undefined));
      const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
        expectedFingerprint: legacyContactsFingerprint(before), sourceSystem: 'SYNTHETIC',
        legacyCode: 'SYNTHETIC-CONTACTS', batch, contatos: mapped.contatos,
        sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'ndjson-v1' } };
      const count = await audits();
      const applied = await enrich(command);
      const after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, contatos: mapped.contatos, updated_at: after.updated_at });
      assert.equal(after.ativo, false);
      assert.equal((await enrich(command)).reused, true);
      assert.deepEqual(await snapshot(), after); assert.equal(await audits(), count + 1);
      await assert.rejects(enrich({ ...command, operationId: randomUUID() }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      assert.deepEqual(await snapshot(), after); assert.equal(await audits(), count + 1);
      const reversal = { mode: 'reverse', id: command.id, operationId: randomUUID(),
        originalOperationId: command.operationId, expectedFingerprint: applied.fingerprint,
        sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
      await enrich(reversal);
      const restored = await snapshot(); assert.ok(restored);
      assert.deepEqual(restored, { ...before, updated_at: restored.updated_at });
      assert.equal(restored.ativo, false);
      assert.equal((await enrich(reversal)).reused, true); assert.equal(await audits(), count + 2);
      await f.admin.query('UPDATE clientes SET ativo=$1 WHERE id=$2', [original.ativo, ID.clientePfA]);
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
    await t.test('optional master extensions: old schema fails closed; combined CAS, replay, reversal and manual edits', async () => {
      const old = await snapshot(); assert.ok(old);
      const historical = (await audit.listByEntity('Cliente', ID.clientePfA)).find(e =>
        (e.afterData as any)?.kind === 'legacy_contacts_enrichment' && (e.afterData as any)?.mode === 'apply'
        && (e.afterData as any)?.fingerprint === legacyContactsFingerprint(old));
      assert.ok(historical);
      await assert.rejects(service().update(ctx, ID.clientePfA, { rg: '001234-X' }), { code: 'CLIENTE_MASTER_STORAGE_REQUIRED' });
      assert.deepEqual(await snapshot(), old);
      await f.exec(await readFile(new URL('../schema-candidates/cliente_master_extras.sql', import.meta.url), 'utf8'));
      const schemaChanged = await snapshot(); assert.ok(schemaChanged);
      assert.deepEqual(schemaChanged, { ...old, rg: null, numero_caixa_postal: null, cep_caixa_postal: null,
        caixa_postal_cobranca: null, inscricao_produtor_rural: null });
      const prior = historical.afterData as any;
      await assert.rejects(enrich({ mode: 'apply', id: ID.clientePfA, operationId: prior.operationId,
        expectedFingerprint: (historical.beforeData as any).fingerprint, sourceSystem: 'SYNTHETIC',
        legacyCode: 'SYNTHETIC-CONTACTS', batch, contatos: old.contatos, sourceProof: prior.sourceProof }),
      { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      assert.deepEqual(await snapshot(), schemaChanged, 'schema drift must not silently refresh an old receipt');
      await f.admin.query('UPDATE clientes SET ativo=false WHERE id=$1', [ID.clientePfA]);
      const before = await snapshot(); assert.ok(before);
      const masterFields = { rg: '001234-X', numero_caixa_postal: '00017', cep_caixa_postal: '01234000',
        caixa_postal_cobranca: '00091', inscricao_produtor_rural: '001122' };
      const mapped = mapLegadoClienteMasterFields({ nativeParent: { CODIGOCLIENTE: 'SYNTHETIC-CONTACTS',
        RG: '001234-X', NUMEROCXPOSTAL: '00017', CEPCXPOSTAL: '01234000',
        CAIXAPOSTALCOBRANCA: '00091', INSCRICAOPRODUTORRURAL: '001122' },
        nativeKey: 'SYNTHETIC-CONTACTS', canonical: before, sourceSystem: 'SYNTHETIC' },
      { validateFields: (value: unknown) => clienteMasterExtrasSchema.safeParse(value) });
      assert.deepEqual(mapped.masterFields, masterFields); assert.equal(mapped.status, 'ready');
      const command = { mode: 'apply', id: ID.clientePfA, operationId: randomUUID(),
        expectedFingerprint: legacyContactsFingerprint(before), sourceSystem: 'SYNTHETIC', legacyCode: 'SYNTHETIC-CONTACTS', batch,
        contatos: before.contatos, masterFields, sourceProof: { fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), parser: 'ndjson-v1' } };
      const count = await audits();
      for (const invalid of [{ rg: null }, {}, { rg: '' }, { rg: ' trim ' }, { rg: '<script>' },
        { cep_caixa_postal: '00000000' }, { cep_caixa_postal: '123' }, { empresa_id: ID.empresaA }]) {
        await assert.rejects(enrich({ ...command, masterFields: invalid }), { code: 'VALIDATION_ERROR' });
        assert.deepEqual(await snapshot(), before); assert.equal(await audits(), count);
      }
      await assert.rejects(enrich(command, audit, { ...ctx, groupId: ID.groupB }));
      await assert.rejects(enrich(command, failingAudit), /SYNTHETIC_AUDIT_FAILURE/);
      assert.deepEqual(await snapshot(), before); assert.equal(await audits(), count);
      const applied = await enrich(command), after = await snapshot(); assert.ok(after);
      assert.deepEqual(after, { ...before, ...masterFields, updated_at: after.updated_at });
      assert.equal(after.ativo, false); assert.deepEqual(after.contatos, before.contatos);
      assert.equal((await enrich(command)).reused, true); assert.equal(await audits(), count + 1);
      const reverse = { mode: 'reverse', id: command.id, operationId: randomUUID(), originalOperationId: command.operationId,
        expectedFingerprint: applied.fingerprint, sourceSystem: command.sourceSystem, legacyCode: command.legacyCode, batch };
      await enrich(reverse);
      const restored = await snapshot(); assert.ok(restored);
      assert.deepEqual(restored, { ...before, updated_at: restored.updated_at });
      assert.equal((await enrich(reverse)).reused, true); assert.equal(await audits(), count + 2);
      const again = { ...command, operationId: randomUUID(), expectedFingerprint: legacyContactsFingerprint(restored) };
      const appliedAgain = await enrich(again);
      await f.admin.query("UPDATE clientes SET rg='MANUAL-001' WHERE id=$1", [ID.clientePfA]);
      const manual = await snapshot(); assert.ok(manual);
      await assert.rejects(enrich({ ...reverse, operationId: randomUUID(), originalOperationId: again.operationId,
        expectedFingerprint: appliedAgain.fingerprint }), { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      await assert.rejects(enrich({ ...command, operationId: randomUUID(), expectedFingerprint: legacyContactsFingerprint(manual) }),
        { code: 'LEGACY_ENRICHMENT_CONFLICT' });
      assert.deepEqual(await snapshot(), manual); assert.equal(manual.ativo, false);
    });
    await t.test('master-only command preserves NULL contacts through apply, replay and reversal', async () => {
      await f.admin.query('UPDATE clientes SET contatos=NULL,inscricao_produtor_rural=NULL WHERE id=$1',[ID.clientePfA]);
      const before = await snapshot(); assert.ok(before); assert.equal(before.contatos,null);
      const command = {mode:'apply',id:ID.clientePfA,operationId:randomUUID(),
        expectedFingerprint:legacyContactsFingerprint(before),sourceSystem:'SYNTHETIC',legacyCode:'SYNTHETIC-CONTACTS',batch,
        masterFields:{inscricao_produtor_rural:'00099'},sourceProof:{fileSha256:'a'.repeat(64),rowSha256:'b'.repeat(64),parser:'ndjson-v1'}};
      const count=await audits();
      const {masterFields: _fields,...empty}=command;
      await assert.rejects(enrich(empty),{code:'VALIDATION_ERROR'});
      const applied=await enrich(command),after=await snapshot();assert.ok(after);
      assert.deepEqual(after,{...before,inscricao_produtor_rural:'00099',updated_at:after.updated_at});
      assert.equal((await enrich(command)).reused,true);assert.equal(await audits(),count+1);
      const reverse={mode:'reverse',id:command.id,operationId:randomUUID(),originalOperationId:command.operationId,
        expectedFingerprint:applied.fingerprint,sourceSystem:command.sourceSystem,legacyCode:command.legacyCode,batch};
      await enrich(reverse);const restored=await snapshot();assert.ok(restored);
      assert.deepEqual(restored,{...before,updated_at:restored.updated_at});
      assert.equal((await enrich(reverse)).reused,true);assert.equal(await audits(),count+2);
    });
    await t.test('new optional fields persist on create, omission preserves, explicit NULL clears only its own field', async () => {
      await setPermissions({ Cadastros: { cliente: ['visualizar', 'criar', 'editar', 'importar'] } });
      await f.exec(`GRANT INSERT ON clientes TO "${ROLE}";
        GRANT SELECT,INSERT,UPDATE ON entity_code_sequences TO "${ROLE}";
        CREATE POLICY master_extra_codes ON entity_code_sequences FOR ALL TO "${ROLE}"
        USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)
        WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid)`);
      const created = await service().create(ctx, { tipo: 'Pessoa Física', nome: 'SYNTHETIC master extras',
        documento: '11144477735', rg: '001234-X', numero_caixa_postal: '00017', cep_caixa_postal: '01234000' });
      assert.equal(created.rg, '001234-X'); assert.equal(created.numero_caixa_postal, '00017');
      const reopened = await service().get(ctx, created.id);
      assert.equal(reopened.cep_caixa_postal, '01234000');
      const cleared = await service().update(ctx, created.id, { rg: null });
      assert.equal(cleared.rg, null); assert.equal(cleared.numero_caixa_postal, '00017');
      assert.equal(cleared.cep_caixa_postal, '01234000');
      const receipt = (await audit.listByEntity('Cliente', created.id)).find(e => e.action === 'create');
      assert.notEqual((receipt?.afterData as any)?.rg, '001234-X', 'ordinary audit must mask the identity document');
    });
  } finally { await f.close(); }
});

test('in-memory parity: NULL/omission/[], serialized CAS and defensive contact copies', async () => {
  const repo = new InMemoryClienteRepository(), audit = new InMemoryAuditRepository();
  const rbac = new InMemoryRbacGuard();
  rbac.link({ actorId: ctx.actorId, groupId: ctx.groupId, permissions: { Cadastros: { cliente: ['criar', 'visualizar', 'editar'] } } });
  const service = new ClienteService(repo, audit, new InMemoryTenantGuard(), rbac);
  const created = await service.create(ctx, { tipo: 'Pessoa Física', nome: 'SYNTHETIC', documento: '52998224725', rg: '001234-X' });
  assert.equal(created.rg, '001234-X');
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

test('master mapper keeps per-field provenance, rejects placeholders, and never clears or guesses a link', () => {
  const canonical = { id: ID.clientePfA, group_id: ctx.groupId, empresa_id: null, source_system: 'SYNTHETIC',
    codigo_legado: '7', rg: 'MANUAL', numero_caixa_postal: null, cep_caixa_postal: null,
    caixa_postal_cobranca: null, inscricao_produtor_rural: null };
  const nativeParent = { CODIGOCLIENTE: 7, RG: '000123-X', NUMEROCXPOSTAL: ' 00017 ', CEPCXPOSTAL: '01234000',
    CAIXAPOSTALCOBRANCA: ' ', INSCRICAOPRODUTORRURAL: null, COMENTARIO: 'unused', STRINGLIVRE6: 'unused', CODREGIAO: 99 };
  const record = { nativeParent, nativeKey: 7, canonical, sourceSystem: 'SYNTHETIC' };
  const validateFields = (value: unknown) => clienteMasterExtrasSchema.safeParse(value);
  const original = structuredClone(record);
  const result = mapLegadoClienteMasterFields(record, { validateFields });
  assert.deepEqual(result.masterFields, { numero_caixa_postal: '00017', cep_caixa_postal: '01234000' });
  assert.ok(result.pending.some(p => p.target === 'rg' && p.reason === 'TARGET_VALUE_CONFLICT'));
  assert.ok(result.provenance.some(p => p.target === 'numero_caixa_postal' && p.transformation === 'trim-boundary'));
  assert.deepEqual(record, original);
  for (const value of ['0', '000.000', '<unsafe>', 'x'.repeat(31), 123]) {
    const invalid = mapLegadoClienteMasterFields({ ...record, nativeParent: { ...nativeParent, RG: value } }, { validateFields });
    assert.equal(Object.hasOwn(invalid.masterFields, 'rg'), false);
    assert.deepEqual(invalid.masterFields, result.masterFields);
  }
  const unloaded = mapLegadoClienteMasterFields({ ...record, canonical: { ...canonical, rg: undefined },
    nativeParent: { CODIGOCLIENTE: 7 } }, { validateFields });
  assert.equal(unloaded.pending.length, 5); assert.deepEqual(unloaded.masterFields, {});
  const unknownStorage = mapLegadoClienteMasterFields({ ...record,
    canonical: { id: canonical.id, group_id: ctx.groupId, empresa_id: null, source_system: 'SYNTHETIC', codigo_legado: '7' } }, { validateFields });
  assert.deepEqual(unknownStorage.masterFields, {});
  assert.ok(unknownStorage.pending.some(p => p.reason === 'TARGET_STORAGE_NOT_REVIEWED'));
  assert.throws(() => mapLegadoClienteMasterFields({ ...record, nativeKey: '7' }, { validateFields }));
  assert.throws(() => mapLegadoClienteMasterFields({ ...record, canonical: { ...canonical, empresa_id: ID.empresaA } }, { validateFields }));
});
