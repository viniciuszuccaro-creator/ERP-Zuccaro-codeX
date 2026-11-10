import { createHash } from 'node:crypto';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { Cliente, ClienteContato } from '../repositories/clienteTypes.js';

// JSONB key order is not insertion order; array order and missing fields remain significant.
export function canonicalClienteJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalClienteJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => JSON.stringify(k) + ':' + canonicalClienteJson(v)).join(',') + '}';
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('CLIENTE_JSON_REQUIRED');
  return json;
}

export function clienteContatosVersion(ctx: RequestContext, row: Cliente): string | undefined {
  if (row.contatos === undefined) return undefined; // Old schema is not an empty baseline.
  return createHash('sha256').update(canonicalClienteJson({
    actorId: ctx.actorId ?? null, groupId: ctx.groupId, empresaId: ctx.empresaId ?? null,
    id: row.id, ownerGroupId: row.group_id, ownerEmpresaId: row.empresa_id,
    contatos: row.contatos, updated_at: row.updated_at,
  })).digest('hex');
}

export function withClienteContatosVersion(ctx: RequestContext, row: Cliente) {
  const version = clienteContatosVersion(ctx, row);
  return { ...row, ...(version === undefined ? {} : { contatos_version: version }) };
}

export function assertClienteContatosVersion(ctx: RequestContext, row: Cliente, expected: string | undefined) {
  if (row.contatos === undefined) throw new AppError(503, 'CLIENTE_CONTATOS_STORAGE_REQUIRED', 'Reviewed contacts schema required');
  if (!expected || clienteContatosVersion(ctx, row) !== expected) {
    throw new AppError(409, 'CLIENTE_CONTATOS_VERSION_CONFLICT', 'Complete unchanged contacts snapshot required');
  }
}

export function assertContactReferences(contatos: readonly ClienteContato[]) {
  // No canonical B2B repository exists in this backend yet. Never accept an unchecked link.
  if (contatos.some(c => c.contato_b2b_id != null)) {
    throw new AppError(409, 'CLIENTE_CONTATO_B2B_REVIEW_REQUIRED', 'Exact canonical B2B ownership resolution required');
  }
}
