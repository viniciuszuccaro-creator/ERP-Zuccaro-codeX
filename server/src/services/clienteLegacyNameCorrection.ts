import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard, RbacAction } from '../db/rbacGuard.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import { clienteContatosReplaceSchema } from '../repositories/clienteTypes.js';
import { canonicalClienteJson, assertContactReferences } from './clienteContatos.js';
import { clienteMasterExtrasSchema, type ClienteMasterExtras } from '../repositories/clienteMasterExtras.js';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const fields = { id: z.string().uuid(), operationId: z.string().uuid(), expectedFingerprint: hashSchema,
  sourceSystem: z.string().min(1).max(80), legacyCode: z.string().min(1).max(80), batch: z.string().uuid() };
const proof = z.object({ fileSha256: hashSchema, rowSha256: hashSchema,
  parser: z.literal('csv-rfc4180-doublequote-v1') }).strict();
const reviewProofSchema = z.object({ recordKey: z.string().min(1).max(160), sourceFingerprint: hashSchema,
  proposalHash: hashSchema, bindingHash: hashSchema, recordHash: hashSchema, authorizationRef: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  evidenceRefs: z.array(z.object({ ref: z.string().regex(/^[a-zA-Z0-9:_-]{1,120}$/), sha256: hashSchema }).strict()).min(1).max(20),
}).strict();
const commandSchema = z.discriminatedUnion('mode', [
  z.object({ ...fields, mode: z.literal('apply'), correctedName: z.string().trim().min(1).max(180), sourceProof: proof, reviewProof: reviewProofSchema.optional() }).strict(),
  z.object({ ...fields, mode: z.literal('reverse'), originalOperationId: z.string().uuid() }).strict(),
]);
const receiptSchema = z.object({ kind: z.literal('legacy_inactive_name_correction'),
  operationId: z.string().uuid(), commandHash: hashSchema, mode: z.enum(['apply', 'reverse']),
  nome: z.string().nullable(), fingerprint: hashSchema, sourceProof: proof, reviewProof: reviewProofSchema.optional() }).strict();
export const legacyNameFingerprint = (value: unknown) => {
  const bytes = JSON.stringify(value);
  if (bytes === undefined) throw new Error('LEGACY_SNAPSHOT_REQUIRED');
  return createHash('sha256').update(bytes).digest('hex');
};
const conflict = () => new AppError(409, 'LEGACY_NAME_CORRECTION_CONFLICT', 'Inactive imported name requires matching evidence');

/** Specialized canonical lifecycle: no restore, generic edit, HTTP route or permission grant. */
export async function correctInactiveLegacyName(deps: { repo: ClienteRepository; audit: AuditRepository; rbac: RbacGuard },
  ctx: RequestContext, input: unknown) {
  // Capture caller-owned inputs before asynchronous authorization.
  ctx = { ...ctx };
  const parsed = commandSchema.safeParse(input);
  if (!z.string().uuid().safeParse(ctx.groupId).success || !z.string().uuid().safeParse(ctx.actorId).success
    || ctx.empresaId || ctx.scopeType === 'empresa') {
    throw new AppError(403, 'LEGACY_GROUP_SCOPE_REQUIRED', 'Explicit Group actor required');
  }
  const authorize = async (q?: DbQueryExecutor) => {
    const actions: RbacAction[] = ['editar', 'importar'];
    for (const action of actions) {
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { allowGlobalWildcard: false, executor: q });
    }
  };
  await authorize();
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid inactive name correction command');
  const command = parsed.data, digest = legacyNameFingerprint({ group: ctx.groupId, actor: ctx.actorId, command });
  return deps.repo.withTransaction(async q => {
    if (!q || !deps.repo.getBulkSnapshot) throw new AppError(503, 'BULK_SQL_REQUIRED', 'Canonical locked SQL snapshot required');
    await authorize(q);
    const before = await deps.repo.getBulkSnapshot({ groupId: ctx.groupId, empresaId: null }, command.id, q);
    if (!before || before.group_id !== ctx.groupId || before.empresa_id != null || before.ativo !== false
      || before.status !== 'Inativo' || before.origem !== 'MIGRACAO' || before.tipo !== 'Pessoa Física'
      || before.source_system !== command.sourceSystem || before.codigo_legado !== command.legacyCode
      || before.migration_batch !== command.batch) throw conflict();
    const history = (await deps.audit.listByEntity('Cliente', command.id, q))
      .filter(e => e.groupId === ctx.groupId && e.empresaId == null && e.action === 'update');
    const own = history.filter(e => {
      const r = receiptSchema.safeParse(e.afterData);
      return r.success && r.data.operationId === command.operationId;
    });
    if (own.length > 1) throw conflict();
    if (own.length === 1) {
      const receipt = receiptSchema.parse(own[0].afterData);
      if (receipt.commandHash !== digest || receipt.fingerprint !== legacyNameFingerprint(before)) throw conflict();
      await authorize(q);
      return { id: command.id, fingerprint: receipt.fingerprint, reused: true, active: false };
    }
    if (legacyNameFingerprint(before) !== command.expectedFingerprint) throw conflict();
    let target: string | null;
    let sourceProof: z.infer<typeof proof>;
    let reviewProof: z.infer<typeof reviewProofSchema> | undefined;
    if (command.mode === 'apply') { target = command.correctedName; sourceProof = command.sourceProof; reviewProof = command.reviewProof; }
    else {
      const originals = history.filter(e => {
        const r = receiptSchema.safeParse(e.afterData);
        return r.success && r.data.mode === 'apply' && r.data.operationId === command.originalOperationId;
      });
      if (originals.length !== 1) throw conflict();
      const original = receiptSchema.parse(originals[0].afterData);
      const originalBefore = receiptSchema.safeParse(originals[0].beforeData);
      if (!originalBefore.success || original.fingerprint !== command.expectedFingerprint) throw conflict();
      target = originalBefore.data.nome;
      sourceProof = original.sourceProof;
      reviewProof = original.reviewProof;
    }
    if (target === before.nome) throw conflict();
    await deps.repo.update({ groupId: ctx.groupId, empresaId: null }, command.id, { nome: target }, q);
    const after = await deps.repo.getBulkSnapshot({ groupId: ctx.groupId, empresaId: null }, command.id, q);
    if (!after || !isDeepStrictEqual(after, { ...before, nome: target, updated_at: after.updated_at })) {
      throw new AppError(409, 'LEGACY_NAME_CORRECTION_MISMATCH', 'Unexpected canonical name correction change');
    }
    const common = { kind: 'legacy_inactive_name_correction', operationId: command.operationId, commandHash: digest, mode: command.mode, sourceProof,
      ...(reviewProof ? { reviewProof } : {}) };
    await deps.audit.append({ ...ctx, empresaId: null, entity: 'Cliente', entityId: command.id, action: 'update',
      beforeData: { ...common, nome: before.nome, fingerprint: command.expectedFingerprint },
      afterData: { ...common, nome: target, fingerprint: legacyNameFingerprint(after) } }, q);
    await authorize(q);
    return { id: command.id, fingerprint: legacyNameFingerprint(after), reused: false, active: false };
  });
}

const registrationCommand = z.discriminatedUnion('mode', [
  z.object({ ...fields, mode: z.literal('apply'), inscricaoEstadual: z.string().min(1).max(40)
    .refine(v => v === v.trim()), sourceProof: proof }).strict(),
  z.object({ ...fields, mode: z.literal('reverse'), originalOperationId: z.string().uuid() }).strict(),
]);
const registrationReceipt = z.object({ kind: z.literal('legacy_state_registration_enrichment'),
  operationId: z.string().uuid(), commandHash: hashSchema, mode: z.enum(['apply', 'reverse']),
  inscricaoEstadual: z.string().nullable(), fingerprint: hashSchema, sourceProof: proof }).strict();

/** Restricted enrichment in the existing canonical lifecycle; no route, load or implicit clearing. */
export async function enrichLegacyStateRegistration(
  deps: { repo: ClienteRepository; audit: AuditRepository; rbac: RbacGuard }, ctx: RequestContext, input: unknown,
) {
  ctx = { ...ctx };
  const parsed = registrationCommand.safeParse(input);
  if (!z.string().uuid().safeParse(ctx.groupId).success || !z.string().uuid().safeParse(ctx.actorId).success
    || ctx.empresaId || ctx.scopeType === 'empresa') {
    throw new AppError(403, 'LEGACY_GROUP_SCOPE_REQUIRED', 'Explicit Group actor required');
  }
  const authorize = async (q?: DbQueryExecutor) => {
    for (const action of ['editar', 'importar'] as const) {
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { allowGlobalWildcard: false, executor: q });
    }
  };
  await authorize();
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid registration enrichment command');
  const command = parsed.data, commandHash = legacyNameFingerprint({ group: ctx.groupId, actor: ctx.actorId, command });
  const mismatch = () => new AppError(409, 'LEGACY_ENRICHMENT_CONFLICT', 'Matching source and unchanged snapshot required');
  return deps.repo.withTransaction(async q => {
    if (!q || !deps.repo.getBulkSnapshot) throw new AppError(503, 'BULK_SQL_REQUIRED', 'Canonical locked SQL snapshot required');
    await authorize(q);
    const scope = { groupId: ctx.groupId, empresaId: null };
    const before = await deps.repo.getBulkSnapshot(scope, command.id, q);
    if (!before || before.group_id !== ctx.groupId || before.empresa_id != null || before.origem !== 'MIGRACAO'
      || before.source_system !== command.sourceSystem || before.codigo_legado !== command.legacyCode
      || before.migration_batch !== command.batch) throw mismatch();
    const history = (await deps.audit.listByEntity('Cliente', command.id, q))
      .filter(e => e.groupId === ctx.groupId && e.empresaId == null && e.action === 'update');
    const receipts = history.filter(e => {
      const r = registrationReceipt.safeParse(e.afterData);
      return r.success && r.data.operationId === command.operationId;
    });
    if (receipts.length > 1) throw mismatch();
    if (receipts.length === 1) {
      const r = registrationReceipt.parse(receipts[0].afterData);
      if (r.commandHash !== commandHash || r.fingerprint !== legacyNameFingerprint(before)) throw mismatch();
      await authorize(q);
      return { id: command.id, fingerprint: r.fingerprint, reused: true };
    }
    if (legacyNameFingerprint(before) !== command.expectedFingerprint) throw mismatch();
    let target: string | null;
    let sourceProof: z.infer<typeof proof>;
    if (command.mode === 'apply') {
      if (before.inscricao_estadual !== null && before.inscricao_estadual !== '') throw mismatch();
      target = command.inscricaoEstadual;
      sourceProof = command.sourceProof;
    } else {
      const originals = history.filter(e => {
        const r = registrationReceipt.safeParse(e.afterData);
        return r.success && r.data.mode === 'apply' && r.data.operationId === command.originalOperationId;
      });
      if (originals.length !== 1) throw mismatch();
      const original = registrationReceipt.parse(originals[0].afterData);
      const originalBefore = registrationReceipt.safeParse(originals[0].beforeData);
      if (!originalBefore.success || original.fingerprint !== command.expectedFingerprint
        || original.inscricaoEstadual !== before.inscricao_estadual) throw mismatch();
      target = originalBefore.data.inscricaoEstadual;
      sourceProof = original.sourceProof;
    }
    await deps.repo.update(scope, command.id, { inscricao_estadual: target }, q);
    const after = await deps.repo.getBulkSnapshot(scope, command.id, q);
    if (!after || !isDeepStrictEqual(after, { ...before, inscricao_estadual: target, updated_at: after.updated_at })) {
      throw new AppError(409, 'LEGACY_ENRICHMENT_MISMATCH', 'Unexpected canonical enrichment change');
    }
    const common = { kind: 'legacy_state_registration_enrichment', operationId: command.operationId,
      commandHash, mode: command.mode, sourceProof };
    await deps.audit.append({ ...ctx, empresaId: null, entity: 'Cliente', entityId: command.id, action: 'update',
      beforeData: { ...common, inscricaoEstadual: before.inscricao_estadual, fingerprint: command.expectedFingerprint },
      afterData: { ...common, inscricaoEstadual: target, fingerprint: legacyNameFingerprint(after) } }, q);
    await authorize(q);
    return { id: command.id, fingerprint: legacyNameFingerprint(after), reused: false };
  });
}

const ndjsonProof = z.object({ fileSha256: hashSchema, rowSha256: hashSchema,
  parser: z.literal('ndjson-v1') }).strict();
const contactsCommand = z.discriminatedUnion('mode', [
  z.object({ ...fields, mode: z.literal('apply'),
    contatos: clienteContatosReplaceSchema.innerType().shape.contatos, sourceProof: ndjsonProof,
    masterFields: clienteMasterExtrasSchema.refine(value => Object.keys(value).length > 0
      && Object.values(value).every(v => typeof v === 'string' && v.length > 0)).optional() }).strict(),
  z.object({ ...fields, mode: z.literal('reverse'), originalOperationId: z.string().uuid() }).strict(),
]);
const contactsReceipt = z.object({ kind: z.literal('legacy_contacts_enrichment'),
  operationId: z.string().uuid(), commandHash: hashSchema, mode: z.enum(['apply', 'reverse']),
  fingerprint: hashSchema, sourceProof: ndjsonProof,
  changedMasterFields: z.array(z.enum(['rg', 'numero_caixa_postal', 'cep_caixa_postal',
    'caixa_postal_cobranca', 'inscricao_produtor_rural'])).max(5).optional(),
  snapshot: z.object({ contatos: clienteContatosReplaceSchema.innerType().shape.contatos.unwrap().nullable() }).passthrough(),
}).strict();

export const legacyContactsFingerprint = (snapshot: unknown) =>
  createHash('sha256').update(canonicalClienteJson(snapshot)).digest('hex');

/** Same legacy receipt lifecycle, raw locked snapshots and audit transaction; no importer or SQL writes here. */
export async function enrichLegacyContacts(
  deps: { repo: ClienteRepository; audit: AuditRepository; rbac: RbacGuard }, ctx: RequestContext, input: unknown,
) {
  ctx = { ...ctx };
  const parsed = contactsCommand.safeParse(input);
  if (!z.string().uuid().safeParse(ctx.groupId).success || !z.string().uuid().safeParse(ctx.actorId).success
    || ctx.empresaId || ctx.scopeType === 'empresa') {
    throw new AppError(403, 'LEGACY_GROUP_SCOPE_REQUIRED', 'Explicit Group actor required');
  }
  const authorize = async (q?: DbQueryExecutor) => {
    for (const action of ['editar', 'importar'] as const) {
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { allowGlobalWildcard: false, executor: q });
    }
  };
  await authorize();
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid contacts enrichment command');
  const command = parsed.data;
  if (command.mode === 'apply') {
    if (command.contatos === undefined && command.masterFields === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Contacts or master fields required');
    }
    const validated = clienteContatosReplaceSchema.safeParse({ contatos: command.contatos, expectedVersion: command.expectedFingerprint });
    if (!validated.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid contacts replacement');
    if (command.contatos !== undefined) assertContactReferences(command.contatos);
  }
  const commandHash = legacyContactsFingerprint({ group: ctx.groupId, actor: ctx.actorId, command });
  const mismatch = () => new AppError(409, 'LEGACY_ENRICHMENT_CONFLICT', 'Matching source and unchanged snapshot required');
  return deps.repo.withTransaction(async q => {
    if (!q || !deps.repo.getBulkSnapshot) throw new AppError(503, 'BULK_SQL_REQUIRED', 'Canonical locked SQL snapshot required');
    await authorize(q);
    const scope = { groupId: ctx.groupId, empresaId: null };
    const before = await deps.repo.getBulkSnapshot(scope, command.id, q);
    if (!before || before.group_id !== ctx.groupId || before.empresa_id != null || before.origem !== 'MIGRACAO'
      || before.source_system !== command.sourceSystem || before.codigo_legado !== command.legacyCode
      || before.migration_batch !== command.batch) throw mismatch();
    if (!Object.hasOwn(before, 'contatos')) throw new AppError(503, 'CLIENTE_CONTATOS_STORAGE_REQUIRED', 'Reviewed contacts schema required');
    const history = (await deps.audit.listByEntity('Cliente', command.id, q))
      .filter(e => e.groupId === ctx.groupId && e.empresaId == null && e.action === 'update');
    const receipts = history.filter(e => {
      const r = contactsReceipt.safeParse(e.afterData);
      return r.success && r.data.operationId === command.operationId;
    });
    if (receipts.length > 1) throw mismatch();
    if (receipts.length === 1) {
      const receipt = contactsReceipt.parse(receipts[0].afterData);
      if (receipt.commandHash !== commandHash || receipt.fingerprint !== legacyContactsFingerprint(before)
        || !isDeepStrictEqual(receipt.snapshot, before)) throw mismatch();
      await authorize(q);
      return { id: command.id, fingerprint: receipt.fingerprint, reused: true };
    }
    if (legacyContactsFingerprint(before) !== command.expectedFingerprint) throw mismatch();
    let target;
    const masterFields: ClienteMasterExtras = {};
    let changedMasterFields: (keyof ClienteMasterExtras)[] = [];
    let sourceProof: z.infer<typeof ndjsonProof>;
    if (command.mode === 'apply') {
      const baseline = before.contatos === null ? [] : before.contatos;
      const preserved = before.contatos === null ? null : clienteContatosReplaceSchema.parse({
        contatos: before.contatos, expectedVersion: command.expectedFingerprint }).contatos!;
      const proposed = command.contatos === undefined ? preserved : command.contatos;
      const channels = proposed === null ? [] : proposed;
      for (const [key, value] of Object.entries(command.masterFields || {}) as [keyof ClienteMasterExtras, string][]) {
        if (!Object.hasOwn(before, key)) throw new AppError(503, 'CLIENTE_MASTER_STORAGE_REQUIRED', 'Reviewed master schema required');
        if (before[key] != null && before[key] !== '') throw mismatch();
        masterFields[key] = value;
        changedMasterFields.push(key);
      }
      // Enrichment appends only: preserve the complete ordered baseline, including manual metadata.
      if (!Array.isArray(baseline) || channels.length < baseline.length
        || (channels.length === baseline.length && changedMasterFields.length === 0)
        || !isDeepStrictEqual(channels.slice(0, baseline.length), baseline)) throw mismatch();
      const existingIds = new Set(baseline.map(contact => contact.id));
      if (channels.slice(baseline.length).some(contact => !contact.id || existingIds.has(contact.id))) throw mismatch();
      target = proposed;
      sourceProof = command.sourceProof;
    }
    else {
      const originals = history.filter(e => {
        const r = contactsReceipt.safeParse(e.afterData);
        return r.success && r.data.mode === 'apply' && r.data.operationId === command.originalOperationId;
      });
      if (originals.length !== 1) throw mismatch();
      const original = contactsReceipt.parse(originals[0].afterData);
      const originalBefore = contactsReceipt.safeParse(originals[0].beforeData);
      if (!originalBefore.success || original.fingerprint !== command.expectedFingerprint
        || !isDeepStrictEqual(original.snapshot, before)
        || originalBefore.data.fingerprint !== legacyContactsFingerprint(originalBefore.data.snapshot)) throw mismatch();
      target = originalBefore.data.snapshot.contatos;
      changedMasterFields = original.changedMasterFields || [];
      if (new Set(changedMasterFields).size !== changedMasterFields.length) throw mismatch();
      for (const key of changedMasterFields) {
        if (!Object.hasOwn(before, key) || !Object.hasOwn(originalBefore.data.snapshot, key)) throw mismatch();
        const parsed = clienteMasterExtrasSchema.safeParse({ [key]: originalBefore.data.snapshot[key] });
        if (!parsed.success) throw mismatch();
        Object.assign(masterFields, parsed.data);
      }
      sourceProof = original.sourceProof;
    }
    await deps.repo.update(scope, command.id, { contatos: target, ...masterFields }, q);
    const after = await deps.repo.getBulkSnapshot(scope, command.id, q);
    if (!after || !isDeepStrictEqual(after, { ...before, contatos: target, ...masterFields, updated_at: after.updated_at })) {
      throw new AppError(409, 'LEGACY_ENRICHMENT_MISMATCH', 'Unexpected canonical contacts enrichment change');
    }
    const common = { kind: 'legacy_contacts_enrichment', operationId: command.operationId, commandHash,
      mode: command.mode, sourceProof, ...(changedMasterFields.length ? { changedMasterFields } : {}) };
    await deps.audit.append({ ...ctx, empresaId: null, entity: 'Cliente', entityId: command.id, action: 'update',
      beforeData: { ...common, snapshot: before, fingerprint: legacyContactsFingerprint(before) },
      afterData: { ...common, snapshot: after, fingerprint: legacyContactsFingerprint(after) } }, q);
    await authorize(q);
    return { id: command.id, fingerprint: legacyContactsFingerprint(after), reused: false };
  });
}
