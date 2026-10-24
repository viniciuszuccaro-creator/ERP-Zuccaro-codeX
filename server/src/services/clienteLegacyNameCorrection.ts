import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard, RbacAction } from '../db/rbacGuard.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const fields = { id: z.string().uuid(), operationId: z.string().uuid(), expectedFingerprint: hashSchema,
  sourceSystem: z.string().min(1).max(80), legacyCode: z.string().min(1).max(80), batch: z.string().uuid() };
const proof = z.object({ fileSha256: hashSchema, rowSha256: hashSchema,
  parser: z.literal('csv-rfc4180-doublequote-v1') }).strict();
const commandSchema = z.discriminatedUnion('mode', [
  z.object({ ...fields, mode: z.literal('apply'), correctedName: z.string().trim().min(1).max(180), sourceProof: proof }).strict(),
  z.object({ ...fields, mode: z.literal('reverse'), originalOperationId: z.string().uuid() }).strict(),
]);
const receiptSchema = z.object({ kind: z.literal('legacy_inactive_name_correction'),
  operationId: z.string().uuid(), commandHash: hashSchema, mode: z.enum(['apply', 'reverse']),
  nome: z.string().nullable(), fingerprint: hashSchema, sourceProof: proof }).strict();
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
    if (command.mode === 'apply') { target = command.correctedName; sourceProof = command.sourceProof; }
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
    }
    if (target === before.nome) throw conflict();
    await deps.repo.update({ groupId: ctx.groupId, empresaId: null }, command.id, { nome: target }, q);
    const after = await deps.repo.getBulkSnapshot({ groupId: ctx.groupId, empresaId: null }, command.id, q);
    if (!after || !isDeepStrictEqual(after, { ...before, nome: target, updated_at: after.updated_at })) {
      throw new AppError(409, 'LEGACY_NAME_CORRECTION_MISMATCH', 'Unexpected canonical name correction change');
    }
    const common = { kind: 'legacy_inactive_name_correction', operationId: command.operationId, commandHash: digest, mode: command.mode, sourceProof };
    await deps.audit.append({ ...ctx, empresaId: null, entity: 'Cliente', entityId: command.id, action: 'update',
      beforeData: { ...common, nome: before.nome, fingerprint: command.expectedFingerprint },
      afterData: { ...common, nome: target, fingerprint: legacyNameFingerprint(after) } }, q);
    await authorize(q);
    return { id: command.id, fingerprint: legacyNameFingerprint(after), reused: false, active: false };
  });
}
