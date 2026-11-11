import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ClienteLocalRepository } from '../repositories/inMemoryClienteLocalRepository.js';
import {
  clienteLocalCreateSchema, clienteLocalUpdateSchema, clienteLocalFinalidadesSchema,
} from '../repositories/clienteLocalTypes.js';
import type { ClienteLocalService } from './clienteLocalService.js';

const uuid = z.string().uuid();
const schema = z.object({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  operations: z.array(z.discriminatedUnion('op', [
    z.object({ op: z.literal('create'), data: clienteLocalCreateSchema }).strict(),
    z.object({ op: z.literal('update'), id: uuid, data: clienteLocalUpdateSchema }).strict(),
    z.object({ op: z.literal('purposes'), id: uuid, finalidades: clienteLocalFinalidadesSchema }).strict(),
    z.object({ op: z.literal('inactivate'), id: uuid }).strict(),
  ])).min(1).max(50),
}).strict();

// Reuses canonical CRUD and their audit; this helper only coordinates one transaction.
export async function localBatchSnapshot(
  repo: ClienteLocalRepository, ctx: RequestContext, clienteId: string,
  executor?: DbQueryExecutor,
) {
  const scope = { groupId: ctx.groupId, clienteId };
  await repo.lockScope(scope, executor);
  const page = await repo.listPage({ ...scope, ativo: true, limit: 200 }, executor);
  if (page.total !== page.rows.length) {
    throw new AppError(409, 'CLIENTE_LOCAIS_SNAPSHOT_INCOMPLETE', 'Complete snapshot required');
  }
  const rows = page.rows.slice().sort((a, b) => a.id.localeCompare(b.id))
    .map(row => ({ ...row, finalidades: row.finalidades.slice().sort((a, b) => a.id.localeCompare(b.id)) }));
  const version = createHash('sha256').update(JSON.stringify({
    groupId: ctx.groupId, empresaId: ctx.empresaId ?? null,
    actorId: ctx.actorId ?? null, clienteId, rows,
  })).digest('hex');
  return { version, rows };
}

export function parseLocalBatch(payload: unknown) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid local batch', parsed.error.flatten());
  const targets = new Set<string>();
  for (const op of parsed.data.operations) {
    if (op.op === 'create') continue;
    const key = `${op.op}:${op.id}`;
    if (targets.has(key)) throw new AppError(400, 'VALIDATION_ERROR', 'Duplicate batch operation');
    targets.add(key);
  }
  return parsed.data;
}

export async function applyLocalBatch(
  service: ClienteLocalService, ctx: RequestContext, clienteId: string,
  batch: ReturnType<typeof parseLocalBatch>,
) {
  const results = [];
  for (const op of batch.operations) {
    if (op.op === 'create') results.push(await service.create(ctx, clienteId, op.data));
    else if (op.op === 'update') results.push(await service.update(ctx, clienteId, op.id, op.data));
    else if (op.op === 'purposes') results.push(await service.setFinalidades(ctx, clienteId, op.id, { finalidades: op.finalidades }));
    else results.push(await service.softDelete(ctx, clienteId, op.id));
  }
  return results;
}
