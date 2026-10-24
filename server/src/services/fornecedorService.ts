import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { RbacGuard, RbacAction } from '../db/rbacGuard.js';
import type { DbQueryExecutor } from '../db/client.js';
import { maskDocumento } from '../db/documentoValidators.js';
import { PostgresFornecedorRepository } from '../repositories/postgresFornecedorRepository.js';
import { fornecedorImportSchema, type Fornecedor } from '../repositories/fornecedorTypes.js';

const uuid = z.string().uuid();
export const fingerprintFornecedor = (r: Fornecedor) => createHash('sha256').update(JSON.stringify(r)).digest('hex');
const snapshot = (r: Fornecedor) => ({ id: r.id, codigo: r.codigo, ativo: r.ativo, status: r.status,
  documento: maskDocumento(r.cpf_cnpj), source_system: r.source_system, codigo_legado: r.codigo_legado,
  migration_batch: r.migration_batch, revision: r.revision });

/** Group master persistence for existing Fornecedor; no UI ownership or routes changed. */
export class FornecedorService {
  constructor(private readonly repo: PostgresFornecedorRepository,
    private readonly audit: AuditRepository, private readonly rbac: RbacGuard) {}

  private async authorize(ctx: RequestContext, action: RbacAction, q?: DbQueryExecutor) {
    if (!uuid.safeParse(ctx.groupId).success || !uuid.safeParse(ctx.actorId).success || ctx.empresaId) {
      throw new AppError(403, 'FORNECEDOR_GROUP_SCOPE_REQUIRED', 'Group master context required');
    }
    await this.rbac.assertAllowed(ctx, 'Cadastros', 'fornecedor', action, { allowGlobalWildcard: false, executor: q });
  }
  async importar(ctx: RequestContext, payload: unknown) {
    await this.authorize(ctx, 'importar');
    await this.authorize(ctx, 'criar');
    const parsed = fornecedorImportSchema.safeParse(payload);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid supplier master payload');
    const data = parsed.data;
    return this.repo.db.withTransaction(async q => {
      await this.authorize(ctx, 'importar', q); await this.authorize(ctx, 'criar', q);
      // The authorized profile and the insert both reference groups by FK.
      // No extra Auth-bootstrap or company-table privileges are needed here.
      // Same deterministic ordering for legacy identity, code and document races.
      const keys = [`legacy:${data.source_system}:${data.codigo_legado}`, `code:${data.codigo}`, `document:${data.cpf_cnpj}`].sort();
      for (const key of keys) await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`fornecedor:${ctx.groupId}:${key}`]);
      const known = await this.repo.byIdentity(ctx.groupId, data.source_system, data.codigo_legado, q);
      if (known) {
        if (known.revision !== 1 || known.ativo !== (data.status === 'Ativo')
          || Object.entries(data).some(([k, v]) => !isDeepStrictEqual(Reflect.get(known, k), v))) {
          throw new AppError(409, 'LEGACY_RECONCILIATION_REQUIRED', 'Supplier identity differs');
        }
        await this.audit.append({ groupId: ctx.groupId, empresaId: null, actorId: ctx.actorId,
          entity: 'Fornecedor', entityId: known.id, action: 'possible_duplicate',
          afterData: { ...snapshot(known), identicalReplay: true }, requestId: ctx.requestId }, q);
        await this.authorize(ctx, 'importar', q);
        return { registro: known, reutilizado: true };
      }
      if (await this.repo.conflict(ctx.groupId, data, q)) {
        throw new AppError(409, 'DUPLICATE_DOCUMENT_OR_CODE', 'Supplier identity conflict');
      }
      const created = await this.repo.create(ctx.groupId, uuid.parse(ctx.actorId), data, q);
      await this.audit.append({ groupId: ctx.groupId, empresaId: null, actorId: ctx.actorId,
        entity: 'Fornecedor', entityId: created.id, action: 'create', afterData: snapshot(created), requestId: ctx.requestId }, q);
      await this.authorize(ctx, 'importar', q); await this.authorize(ctx, 'criar', q);
      return { registro: created, reutilizado: false };
    });
  }
  async get(ctx: RequestContext, id: string) {
    await this.authorize(ctx, 'visualizar'); uuid.parse(id);
    return this.repo.db.withTransaction(async q => {
      await this.authorize(ctx, 'visualizar', q);
      const r = await this.repo.byId(ctx.groupId, id, q);
      if (!r) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
      await this.authorize(ctx, 'visualizar', q); return r;
    });
  }
  async softDelete(ctx: RequestContext, id: string, expectedRevision: number, source: string, batch: string, expectedFingerprint: string) {
    await this.authorize(ctx, 'inativar'); uuid.parse(id); uuid.parse(batch);
    z.number().int().positive().parse(expectedRevision);
    z.string().regex(/^[a-f0-9]{64}$/).parse(expectedFingerprint);
    return this.repo.db.withTransaction(async q => {
      await this.authorize(ctx, 'inativar', q);
      const before = await this.repo.byId(ctx.groupId, id, q);
      if (!before || before.source_system !== source || before.migration_batch !== batch
        || before.revision !== expectedRevision || !before.ativo || fingerprintFornecedor(before) !== expectedFingerprint) {
        throw new AppError(409, 'FORNECEDOR_REVISION_CONFLICT', 'Supplier reversal requires matching batch and revision');
      }
      const after = await this.repo.deactivate(ctx.groupId, uuid.parse(ctx.actorId), id, expectedRevision, q);
      await this.audit.append({ groupId: ctx.groupId, empresaId: null, actorId: ctx.actorId,
        entity: 'Fornecedor', entityId: id, action: 'soft_delete', beforeData: snapshot(before),
        afterData: snapshot(after), requestId: ctx.requestId }, q);
      await this.authorize(ctx, 'inativar', q); return after;
    });
  }
}
