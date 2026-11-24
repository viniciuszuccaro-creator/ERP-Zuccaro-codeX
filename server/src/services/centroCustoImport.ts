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

type Centro = { id: string; codigo: string; descricao: string; ativo: boolean; revision: number };
type Dependencies = { db: DbClient; rbac: RbacGuard; audit: AuditRepository };

export async function importCentroCusto(
  context: RequestContext,
  payload: unknown,
  { db, rbac, audit }: Dependencies,
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
       RETURNING id,codigo,descricao,ativo,revision`, [...key, d.codigo, d.descricao, d.ativo],
    )).rows[0];
    if (!created) {
      const existing = (await q.query<Centro>(
        `SELECT id,codigo,descricao,ativo,revision FROM centros_custo
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

const reversalSchema = z.object({
  id: z.string().uuid(),
  importRequestId: z.string().trim().min(1).max(120),
}).strict();
const postimageSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  descricao: z.string(),
  ativo: z.literal(true),
  revision: z.literal(1),
  source_system: z.string().min(1),
  legacy_id: z.string().min(1),
}).strict();

export async function reverseCentroCustoImport(
  context: RequestContext,
  payload: unknown,
  { db, rbac, audit }: Dependencies,
) {
  const ctx = Object.freeze({ ...context });
  const { groupId, empresaId, actorId, requestId } = ctx;
  if (!groupId || !empresaId || !actorId || !requestId || !db.withTenantContext) {
    throw new AppError(400, 'CENTRO_CUSTO_IMPORT_CONTEXT_REQUIRED', 'Explicit company and audit context required');
  }
  const parsed = reversalSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid cost center reversal');
  const { id, importRequestId } = parsed.data;
  return db.withTenantContext({ groupId, empresaId }, () => db.withTransaction(async q => {
    await rbac.assertAllowed(ctx, 'Cadastros', 'centros_custo', 'inativar', { allowGlobalWildcard: false, executor: q });
    const proof = (await q.query<{ after_data: unknown }>(
      `SELECT after_data FROM audit_logs WHERE group_id=$1 AND empresa_id=$2 AND entity='CentroCusto'
       AND entity_id=$3 AND request_id=$4 AND action='create' LIMIT 2`,
      [groupId, empresaId, id, importRequestId],
    )).rows;
    if (proof.length !== 1) return { reversed: false, reason: 'creation_not_proven' };
    const original = postimageSchema.safeParse(proof[0].after_data);
    if (!original.success || original.data.id !== id) return { reversed: false, reason: 'creation_not_proven' };
    const p = original.data;
    const updated = (await q.query<Centro>(
      `UPDATE centros_custo SET ativo=false
       WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND revision=$4 AND ativo=true
         AND codigo=$5 AND descricao=$6 AND source_system=$7 AND legacy_id=$8
       RETURNING id,codigo,descricao,ativo,revision`,
      [groupId, empresaId, id, p.revision, p.codigo, p.descricao, p.source_system, p.legacy_id],
    )).rows[0];
    if (!updated) return { reversed: false, reason: 'postimage_changed' };
    await audit.append({
      groupId, empresaId, actorId, requestId, entity: 'CentroCusto', entityId: id,
      action: 'soft_delete', beforeData: p, afterData: updated,
    }, q);
    return { reversed: true };
  }));
}
