import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppError } from '../api/errors.js';

const identity = z.union([z.string().min(1).max(200), z.number().int().safe()]);
const entity = z.enum(['Cliente', 'Fornecedor', 'Produto']);
const rowSchema = z.object({ id: identity, group_id: z.string().uuid(), empresa_id: z.string().uuid().nullable(), ativo: z.boolean() }).passthrough();
const scopeSchema = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid().nullable() }).strict();
export type CadastroBulkEntity = z.infer<typeof entity>;
export type CadastroBulkIdentity = z.infer<typeof identity>;
export type CadastroBulkRow = z.infer<typeof rowSchema>;
export type CadastroBulkScope = z.infer<typeof scopeSchema>;
export type Eligibility = { id: CadastroBulkIdentity; allowed: boolean; reasons: string[] };
export type AppliedBulkItem = { id: CadastroBulkIdentity; before: CadastroBulkRow; after: CadastroBulkRow };
export type AppliedCadastroBatch = { id: string; entity: CadastroBulkEntity; scope: CadastroBulkScope; items: AppliedBulkItem[] };

function invalid(): never { throw new AppError(422, 'CADASTRO_BULK_INVALID', 'Invalid cadastro batch'); }
function typedKey(id: CadastroBulkIdentity) { return JSON.stringify([typeof id, id]); }
function selection(raw: unknown): CadastroBulkIdentity[] {
  const ids = z.array(identity).min(1).max(500).parse(raw);
  if (new Set(ids.map(typedKey)).size !== ids.length) return invalid();
  return ids;
}
function sameScope(row: CadastroBulkRow, scope: CadastroBulkScope) {
  // Company scope does not implicitly authorize a shared master with empresa_id=NULL.
  return row.group_id === scope.groupId && (scope.empresaId === null || row.empresa_id === scope.empresaId);
}
function scopedRows(raw: unknown, scope: CadastroBulkScope) {
  const rows = z.array(rowSchema).max(500).parse(raw);
  const seen = new Set<string>();
  for (const row of rows) {
    const key = typedKey(row.id);
    if (seen.has(key)) return invalid();
    seen.add(key);
  }
  return new Map(rows.filter(row => sameScope(row, scope)).map(row => [typedKey(row.id), row]));
}

/** Server-only plan after RBAC and relation checks from the canonical entity service. Never grants eligibility by default. */
export function cadastroBulkPreflight(rawEntity: unknown, rawScope: unknown, rawIds: unknown, rawRows: unknown, eligibility: readonly Eligibility[]) {
  try {
    const name = entity.parse(rawEntity), scope = scopeSchema.parse(rawScope), ids = selection(rawIds);
    const rows = scopedRows(rawRows, scope);
    const checked = z.array(z.object({ id: identity, allowed: z.boolean(), reasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/)).max(20) }).strict()).max(500).parse(eligibility);
    const decisions = new Map(checked.map(item => [typedKey(item.id), item]));
    if (decisions.size !== checked.length || checked.some(item => !ids.some(id => typedKey(id) === typedKey(item.id)))) return invalid();
    const items = ids.map(id => {
      const row = rows.get(typedKey(id)), decision = decisions.get(typedKey(id));
      const reasons = !row ? ['NOT_FOUND_IN_SCOPE'] : !row.ativo ? ['ALREADY_INACTIVE']
        : !decision ? ['ELIGIBILITY_NOT_VERIFIED'] : !decision.allowed ? (decision.reasons.length ? decision.reasons : ['ENTITY_POLICY_DENIED'])
          : decision.reasons.length ? ['ELIGIBILITY_INCONSISTENT'] : [];
      return { id, eligible: reasons.length === 0, reasons };
    });
    return { entity: name, requested: ids.length, eligible: items.filter(item => item.eligible).length,
      blocked: items.filter(item => !item.eligible).length, items };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return invalid();
  }
}

/** Persist this result only in the same transaction as canonical inactivation + audit. It contains private snapshots, not an HTTP DTO. */
export function captureAppliedCadastroBatch(batchId: string, rawEntity: unknown, rawScope: unknown, pairs: readonly AppliedBulkItem[]): AppliedCadastroBatch {
  try {
    z.string().uuid().parse(batchId);
    const name = entity.parse(rawEntity), scope = scopeSchema.parse(rawScope);
    selection(pairs.map(pair => pair.id));
    const items = pairs.map(pair => {
      const before = rowSchema.parse(pair.before), after = rowSchema.parse(pair.after);
      if (!sameScope(before, scope) || !sameScope(after, scope) || typedKey(pair.id) !== typedKey(before.id)
        || typedKey(before.id) !== typedKey(after.id) || before.group_id !== after.group_id || before.empresa_id !== after.empresa_id
        || before.ativo !== true || after.ativo !== false) return invalid();
      return { id: pair.id, before: structuredClone(before), after: structuredClone(after) };
    });
    return { id: batchId, entity: name, scope: structuredClone(scope), items };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return invalid();
  }
}

/** Full post-image comparison refuses external edits, even when a timestamp/version was not changed. */
export function cadastroBulkReversalPlan(batch: AppliedCadastroBatch, rawScope: unknown, rawCurrentRows: unknown) {
  const scope = scopeSchema.parse(rawScope);
  if (!isDeepStrictEqual(scope, batch.scope)) throw new AppError(403, 'CADASTRO_BULK_SCOPE_DENIED', 'Batch scope mismatch');
  const valid = captureAppliedCadastroBatch(batch.id, batch.entity, batch.scope, batch.items);
  const current = scopedRows(rawCurrentRows, scope);
  return valid.items.map(item => {
    const now = current.get(typedKey(item.id));
    if (!now) return { id: item.id, reversible: false, reason: 'NOT_FOUND_IN_SCOPE' };
    if (!isDeepStrictEqual(now, item.after)) return { id: item.id, reversible: false, reason: 'EXTERNAL_CHANGE_CONFLICT' };
    return { id: item.id, reversible: true, reason: null };
  });
}
