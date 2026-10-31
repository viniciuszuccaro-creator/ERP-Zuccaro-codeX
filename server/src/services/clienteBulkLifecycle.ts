import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import { sanitizeClienteAudit } from '../audit/clienteAuditSnapshot.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { AppliedBulkItem } from './cadastroBulkPolicy.js';
import { expectedPostgresBulkRestore } from './cadastroBulkPostgresSnapshot.js';

export const clienteBulkSnapshotSchema = z.object({ id: z.string().uuid(), group_id: z.string().uuid(),
  empresa_id: z.string().uuid().nullable(), ativo: z.boolean(), status: z.string().max(40),
  updated_at: z.string().datetime({ offset: true }), created_at: z.string().datetime({ offset: true }),
}).passthrough();

/** Private ledger evidence only. Existing restore() and its consumers keep their original contract. */
export async function restoreClienteBulkSnapshot(deps: { repo: ClienteRepository; audit: AuditRepository;
  rbac: RbacGuard; tenant: TenantGuard }, ctx: RequestContext, item: AppliedBulkItem) {
  const before = clienteBulkSnapshotSchema.parse(item.before), after = clienteBulkSnapshotSchema.parse(item.after);
  if (typeof item.id !== 'string' || item.id !== before.id || before.group_id !== ctx.groupId
    || (ctx.empresaId != null && before.empresa_id !== ctx.empresaId) || !before.ativo || after.ativo
    || !isDeepStrictEqual(after, { ...before, ativo: false, status: 'Inativo', updated_at: after.updated_at })) {
    throw new AppError(409, 'BULK_EVIDENCE_INVALID', 'Canonical Cliente lifecycle evidence required');
  }
  return deps.repo.withTransaction(async q => {
    if (!q || !deps.repo.getBulkSnapshot) throw new AppError(503, 'BULK_SQL_REQUIRED', 'Canonical SQL snapshot repository required');
    await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'restaurar', { allowGlobalWildcard: false, executor: q });
    await deps.tenant.assertEmpresaInGroup(ctx.groupId, before.empresa_id, q);
    const current = await deps.repo.getBulkSnapshot(ctx, before.id, q);
    if (!isDeepStrictEqual(current, after)) throw new AppError(409, 'BULK_REVERSAL_CONFLICT', 'Cliente changed after batch');
    const expected = await expectedPostgresBulkRestore(before, q);
    const changed = await deps.repo.update(ctx, before.id, { ativo: true, status: before.status }, q);
    if (!changed) throw new AppError(409, 'BULK_REVERSAL_CONFLICT', 'Cliente not restored');
    const restored = await deps.repo.getBulkSnapshot(ctx, before.id, q);
    if (!restored || !isDeepStrictEqual(restored, expected)) throw new AppError(409, 'BULK_RESTORE_MISMATCH', 'Canonical restore changed unexpected fields');
    await deps.audit.append({ ...ctx, empresaId: before.empresa_id ?? ctx.empresaId, entity: 'Cliente', entityId: before.id,
      action: 'restore', beforeData: sanitizeClienteAudit(after), afterData: sanitizeClienteAudit(restored) }, q);
    await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'restaurar', { allowGlobalWildcard: false, executor: q });
    return restored;
  });
}
