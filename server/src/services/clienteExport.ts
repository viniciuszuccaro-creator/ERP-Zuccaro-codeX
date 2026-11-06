import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';

const filters = z.object({ ativo: z.boolean().optional(), search: z.string().min(1).max(200).optional(),
  codigo: z.string().min(1).max(100).optional(), documento: z.string().min(1).max(32).optional(),
  orderBy: z.enum(['codigo', 'nome']).optional(), orderDir: z.enum(['asc', 'desc']).optional() }).strict();
const input = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('selected'), ids: z.array(z.string().uuid()).min(1).max(500), filters }).strict(),
  z.object({ mode: z.literal('filtered'), filters }).strict(),
]);
const contextSchema = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid().nullish(),
  actorId: z.string().uuid(), requestId: z.string().trim().min(1).max(200) });
const fields = ['id', 'codigo', 'tipo', 'nome', 'razao_social', 'nome_fantasia', 'status', 'ativo'];

/** Extraction from the canonical ClienteService, not a parallel cadastro/export endpoint.
 * JSON avoids spreadsheet formula execution. Contacts/documents/financial fields are deliberately not exported.
 */
export async function exportClientes(deps: { repo: ClienteRepository; audit: AuditRepository;
  rbac: RbacGuard; tenant: TenantGuard }, rawContext: RequestContext, rawInput: unknown) {
  const request = input.parse(rawInput);
  const identity = contextSchema.parse(rawContext);
  const ctx = Object.freeze({ ...rawContext, ...identity });
  const ids = request.mode === 'selected' ? request.ids : undefined;
  if (ids && new Set(ids.map(id => id.toLowerCase())).size !== ids.length) {
    throw new AppError(422, 'CLIENTE_EXPORT_DUPLICATE_ID', 'Duplicate selection');
  }
  const prepare = deps.repo.prepareExport;
  if (!prepare) throw new AppError(503, 'CLIENTE_EXPORT_UNAVAILABLE', 'Transactional export is not configured');
  return deps.repo.withTransaction(async q => {
    if (!q) throw new AppError(503, 'CLIENTE_EXPORT_UNAVAILABLE', 'Transactional executor required');
    const authorize = async () => {
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'visualizar', { allowGlobalWildcard: false, executor: q });
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'exportar', { allowGlobalWildcard: false, executor: q });
      await deps.tenant.assertEmpresaInGroup(ctx.groupId, ctx.empresaId, q);
    };
    await authorize();
    const restoreVisibility = await prepare.call(deps.repo, ctx, q);
    const data: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let total: number | undefined;
    do {
      await authorize();
      const page = await deps.repo.listPage({ ...request.filters, groupId: ctx.groupId,
        empresaId: ctx.empresaId, limit: 200, offset: data.length }, q, { ids, exactEmpresa: true });
      if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > 10000) {
        throw new AppError(422, 'CLIENTE_EXPORT_LIMIT', 'Complete export exceeds the supported limit');
      }
      total ??= page.total;
      if (page.total !== total || (ids && total !== ids.length) || (!page.rows.length && data.length < total)) {
        throw new AppError(409, 'CLIENTE_EXPORT_INCOMPLETE', 'Complete authorized selection could not be exported');
      }
      for (const row of page.rows) {
        if (row.group_id !== ctx.groupId || (ctx.empresaId != null && row.empresa_id !== ctx.empresaId)
          || seen.has(row.id) || (ids && !ids.some(id => id.toLowerCase() === row.id.toLowerCase()))) {
          throw new AppError(409, 'CLIENTE_EXPORT_INCOMPLETE', 'Export scope or pagination mismatch');
        }
        seen.add(row.id);
        data.push({ id: row.id, codigo: row.codigo, tipo: row.tipo, nome: row.nome,
          razao_social: row.razao_social, nome_fantasia: row.nome_fantasia, status: row.status, ativo: row.ativo });
      }
      if (data.length > total) throw new AppError(409, 'CLIENTE_EXPORT_INCOMPLETE', 'Export count mismatch');
    } while (data.length < total);
    await restoreVisibility();
    const bytes = Buffer.from(JSON.stringify({ version: 1, mode: request.mode, fields, data }), 'utf8');
    if (bytes.length > 8 * 1024 * 1024) throw new AppError(422, 'CLIENTE_EXPORT_LIMIT', 'Export byte limit exceeded');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await deps.audit.append({ ...ctx, entity: 'ClienteExport', action: 'read',
      afterData: { operation: 'export', mode: request.mode, count: data.length, fields, sha256 } }, q);
    await authorize();
    return { fileName: 'clientes.json', contentType: 'application/json', bytes, count: data.length, sha256 };
  });
}
