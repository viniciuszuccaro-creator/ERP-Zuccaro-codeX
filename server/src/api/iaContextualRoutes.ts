import type { Router } from 'express';
import { AppError } from './errors.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { IaContextualService } from '../services/iaContextualService.js';

export function mountIaContextualRoutes(router: Router, service: IaContextualService) {
  router.post('/api/v1/ia/invocations', requireTenantScope, async (req, res, next) => {
    const cancelled = new AbortController();
    const onClose = () => { if (!res.writableEnded) cancelled.abort(); };
    res.once('close', onClose);
    try {
      if (req.authVerified !== true || !req.groupId || !req.actorId) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Verified Bearer session required');
      }
      const data = await service.invoke({ requestId: req.requestId, groupId: req.groupId,
        empresaId: req.empresaId, actorId: req.actorId, scopeType: req.scopeType,
      }, req.body, cancelled.signal);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ data });
    } catch (error) { next(error); }
    finally { res.off('close', onClose); }
  });
}
