import type { Express } from 'express';
import type { DbClient } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import { reopenAssistedClientReview } from '../services/legacyClientReviewRead.js';
import { AppError } from './errors.js';

const identityPart = /^[a-z0-9_.:-]{1,80}$/i;

export function mountLegacyClientReviewRead(app: Express, db: DbClient, rbac: RbacGuard) {
  app.get('/api/v1/clientes/revisao-legado/:sourceSystem/:nativeKey', requireTenantScope, async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    try {
      if (req.authVerified !== true || !req.actorId) throw new AppError(401, 'AUTH_REQUIRED', 'Verified session required');
      if (req.scopeType !== 'grupo' || req.empresaId != null)
        throw new AppError(403, 'REVIEW_GROUP_SCOPE_REQUIRED', 'Group scope required');
      const { sourceSystem, nativeKey } = req.params;
      if (!identityPart.test(sourceSystem) || !identityPart.test(nativeKey))
        throw new AppError(422, 'REVIEW_IDENTITY_REQUIRED', 'Invalid review identity');
      const entry = await reopenAssistedClientReview({ sourceSystem, nativeKey }, {
        groupId: req.groupId, actorId: req.actorId, requestId: req.requestId, scopeType: 'grupo',
      }, { db, rbac });
      if (!entry) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review entry not found');
      res.json(entry);
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(503, 'REVIEW_UNAVAILABLE', 'Review unavailable'));
    }
  });
}
