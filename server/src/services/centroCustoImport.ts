import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbClient } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';

const inputSchema = z.object({
  codigo: z.string().trim().min(1).max(80),
  descricao: z.string().trim().min(1).max(255),
  ativo: z.boolean(),
  sourceSystem: z.string().trim().min(1).max(80),
  legacyId: z.string().trim().min(1).max(120),
}).strict();

type Centro = { id: string; codigo: string; descricao: string; ativo: boolean };

export async function importCentroCusto(
  context: RequestContext,
  payload: unknown,
  { db, rbac, audit }: { db: DbClient; rbac: RbacGuard; audit: AuditRepository },
) {
  const ctx = Object.freeze({ ...context });
  const { groupId, empresaId, actorId, requestId } = ctx;
  if (!groupId || !empresaId || !actorId || !requestId || !db.withTenantContext) {
    throw new AppError(400, 'CENTRO_CUSTO_IMPORT_CONTEXT_REQUIRED', 'Explicit company and audit context required');
  }
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cost center import');
  const d = parsed.data;
  return db.withTenantContext({ groupId, empresaId }, () => db.withTransaction(async q => {
    await rbac.assertAllowed(ctx, 'Cadastros', 'centros_custo', 'importar', { allowGlobalWildcard: false, executor: q });
    const key = [groupId, empresaId, d.sourceSystem, d.legacyId];
    const created = (await q.query<Centro>(
      `INSERT INTO centros_custo(group_id,empresa_id,source_system,legacy_id,codigo,descricao,ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (group_id,empresa_id,source_system,legacy_id) WHERE source_system IS NOT NULL DO NOTHING
       RETURNING id,codigo,descricao,ativo`, [...key, d.codigo, d.descricao, d.ativo],
    )).rows[0];
    if (!created) {
      const existing = (await q.query<Centro>(
        `SELECT id,codigo,descricao,ativo FROM centros_custo
         WHERE group_id=$1 AND empresa_id=$2 AND source_system=$3 AND legacy_id=$4`, key,
      )).rows[0];
      if (!existing || existing.codigo !== d.codigo || existing.descricao !== d.descricao || existing.ativo !== d.ativo) {
        throw new AppError(409, 'CENTRO_CUSTO_RECONCILIATION_REQUIRED', 'Cost center needs reconciliation');
      }
      return { id: existing.id, reused: true };
    }
    await audit.append({
      groupId, empresaId, actorId, requestId, entity: 'CentroCusto',
      entityId: created.id, action: 'create',
      afterData: { ...created, source_system: d.sourceSystem, legacy_id: d.legacyId },
    }, q);
    return { id: created.id, reused: false };
  }));
}
