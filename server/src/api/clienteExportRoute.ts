import type { Request, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import type { RequestContext } from '../audit/types.js';
import type { ClienteService } from '../services/clienteService.js';
import { requireTenantScope } from '../middleware/requestContext.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Prepared extraction for mountClienteRoutes, not an automatically mounted parallel router.
 * The existing router supplies its canonical context producer after verified Bearer middleware.
 */
export function mountClienteExportRoute(router: Router, service: Pick<ClienteService, 'export'>,
  context: (req: Request) => RequestContext) {
  router.post('/api/v1/clientes/export', (req, res, next) => {
    // Refine the existing correlation producer only for this boundary; never echo arbitrary header values.
    if (!uuid.test(req.requestId)) {
      req.requestId = randomUUID();
      res.setHeader('X-Request-Id', req.requestId);
    }
    next();
  }, requireTenantScope, async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.authVerified !== true || !req.actorId) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Verified user session required');
      }
      const ctx = context(req);
      if (ctx.groupId !== req.groupId || (ctx.empresaId ?? null) !== (req.empresaId ?? null)
        || ctx.actorId !== req.actorId || ctx.requestId !== req.requestId) {
        throw new AppError(403, 'CLIENTE_EXPORT_CONTEXT_MISMATCH', 'Request context mismatch');
      }
      const result = await service.export(ctx, req.body);
      // No file headers or bytes are emitted before the audited service transaction resolves.
      res.setHeader('Content-Disposition', 'attachment; filename="clientes.json"');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-SHA256', result.sha256);
      res.status(200).send(result.bytes);
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError(422, 'CLIENTE_EXPORT_INVALID', 'Invalid export request'));
      } else if (error instanceof AppError) {
        next(error);
      } else {
        // Never forward raw database/audit errors to the shared development logger or response.
        console.warn('[cliente-export]', req.requestId, 'CLIENTE_EXPORT_UNAVAILABLE');
        next(new AppError(503, 'CLIENTE_EXPORT_UNAVAILABLE', 'Export unavailable'));
      }
    }
  });
}
