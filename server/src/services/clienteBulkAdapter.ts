import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext, AuditRepository } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import { PostgresClienteRepository } from '../repositories/postgresClienteRepository.js';
import { PostgresCadastroBulkLedger } from '../repositories/postgresCadastroBulkLedger.js';
import { ClienteService } from './clienteService.js';
import { CadastroBulkTransaction, type CadastroBulkAdapter } from './cadastroBulkTransaction.js';
import type { AppliedBulkItem, CadastroBulkIdentity, CadastroBulkRow, Eligibility } from './cadastroBulkPolicy.js';

/** Trusted server policy must check domain rules and lock references through q. Never accept decisions from the HTTP body. */
export interface ClienteBulkEligibilityGuard {
  inspect(ctx: RequestContext, lockedRows: readonly CadastroBulkRow[], q: DbQueryExecutor): Promise<Eligibility[]>;
}

export function createClienteBulkTransaction(deps: { db: DbClient; rbac: RbacGuard; audit: AuditRepository;
  tenant: TenantGuard; eligibility: ClienteBulkEligibilityGuard }) {
  const repo = new PostgresClienteRepository(deps.db);
  const service = new ClienteService(repo, deps.audit, deps.tenant, deps.rbac);
  const requireId = (id: CadastroBulkIdentity) => {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new AppError(422, 'BULK_CANONICAL_ID_REQUIRED', 'Canonical Cliente UUID required; legacy IDs need a proven mapping');
    return parsed.data;
  };
  const adapter: CadastroBulkAdapter = {
    entity: 'Cliente', permissionSection: 'cliente', restoredTimestamp: 'postgres_set_updated_at_json',
    async inspect(ctx, ids, q) {
      await deps.rbac.assertAllowed(ctx, 'Cadastros', 'cliente', 'visualizar', { allowGlobalWildcard: false, executor: q });
      const rows: CadastroBulkRow[] = [];
      // Stable lock order prevents inverted selections from deadlocking each other.
      const validated = ids.map(requireId);
      for (const id of [...validated].sort()) {
        const row = await repo.getBulkSnapshot(ctx, id, q);
        if (row) rows.push(row);
      }
      const eligibility = await deps.eligibility.inspect(ctx, structuredClone(rows), q);
      return { rows, eligibility };
    },
    async inactivate(ctx, id, q) {
      const canonicalId = requireId(id);
      await service.softDelete(ctx, canonicalId);
      const row = await repo.getBulkSnapshot(ctx, canonicalId, q);
      if (!row) throw new AppError(409, 'BULK_RECORD_MISSING', 'Canonical Cliente missing after lifecycle mutation');
      return row;
    },
    restore(ctx: RequestContext, id: CadastroBulkIdentity, _q: DbQueryExecutor, evidence: AppliedBulkItem) {
      if (requireId(id) !== evidence.id) throw new AppError(409, 'BULK_EVIDENCE_INVALID', 'Cliente identity mismatch');
      return service.restoreBulkSnapshot(ctx, evidence);
    },
  };
  return new CadastroBulkTransaction(deps.db, deps.rbac, deps.audit, new PostgresCadastroBulkLedger(), adapter);
}
