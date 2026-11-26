import type { Express } from 'express';
import { z } from 'zod';
import type { DbClient } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import { AppError } from './errors.js';

const page = z.object({
  offset: z.string().regex(/^\d{1,7}$/).transform(Number).optional(),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().min(1).max(200)).optional(),
}).strict();

export function mountSupplierSettlementHistoryRead(app: Express, db: DbClient, rbac: RbacGuard) {
  app.get('/api/v1/financeiro/historico-baixas-fornecedores', requireTenantScope, async (req, res, next) => {
    res.set('Cache-Control', 'no-store, private');
    try {
      if (!req.authVerified || !req.actorId) throw new AppError(401, 'AUTH_REQUIRED', 'Verified session required');
      if (req.scopeType !== 'empresa' || !req.empresaId || !req.groupId) {
        throw new AppError(403, 'EMPRESA_REQUIRED', 'Company scope required');
      }
      const parsed = page.safeParse(req.query);
      if (!parsed.success) throw new AppError(422, 'HISTORY_INVALID_PAGE', 'Invalid history pagination');
      const { offset = 0, limit = 100 } = parsed.data;
      const ctx = { groupId: req.groupId, empresaId: req.empresaId, actorId: req.actorId, requestId: req.requestId };
      const items = await db.withTransaction(async q => {
        const { rows: [scope] } = await q.query(
          `SELECT current_schema() AS ns, current_schemas(false)::text[] AS path,
            NOT (rolsuper OR rolbypassrls) AS restricted,
            row_security_active(to_regclass('legacy_supplier_settlement_history')) AS rls
            FROM pg_roles WHERE rolname=current_user`);
        if (!scope?.restricted || !scope.rls || !scope.ns || scope.path[0] !== scope.ns
          || !/^hml[a-z0-9_]+$/.test(scope.ns) || scope.path.slice(1).some((ns: string) => ns !== 'pg_catalog')) {
          throw new AppError(503, 'HISTORY_SCHEMA_UNAVAILABLE', 'History unavailable');
        }
        await rbac.assertAllowed(ctx, 'Financeiro', 'historico_baixas_fornecedores', 'visualizar',
          { allowGlobalWildcard: false, executor: q });
        return (await q.query(
          `SELECT empresa_id, source_report, source_sequence_hex, supplier_legacy_code, fiscal_note_number,
                  legacy_settlement_marker, original_title_amount::text
           FROM legacy_supplier_settlement_history
           WHERE empresa_id=$1 AND NOT archived
           ORDER BY source_report,source_sequence_hex,source_archive_sha256
           LIMIT $2 OFFSET $3`, [ctx.empresaId, limit + 1, offset])).rows;
      });
      res.json({ classification: 'BAIXA_HISTORICA_SEM_COMPROVANTE', items: items.slice(0, limit),
        nextOffset: items.length > limit ? offset + limit : null });
    } catch (error) { next(error); }
  });
}
