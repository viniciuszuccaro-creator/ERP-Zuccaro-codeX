import type { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';
import type { RequestContext } from '../audit/types.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { FornecedorService } from '../services/fornecedorService.js';

const idSchema = z.string().uuid();
const reversalSchema = z.object({
  expectedRevision: z.number().int().positive().safe(),
  source: z.string().trim().min(1).max(80),
  batch: z.string().uuid(),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

// Import master only: never use this reduced contract as the general UI save.
export function mountFornecedorRoutes(router: Router, service: FornecedorService | null | undefined,
  context: (req: Request) => RequestContext) {
  const run = (fn: (s: FornecedorService, req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.setHeader('Cache-Control', 'no-store');
        if (req.authVerified !== true) throw new AppError(401, 'AUTH_REQUIRED', 'Verified session required');
        if (!service) throw new AppError(503, 'FORNECEDOR_HTTP_DISABLED', 'Supplier HTTP requires explicit activation and database');
        await fn(service, req, res);
      } catch (error) { next(error); }
    };
  router.post('/api/v1/fornecedores/importar', requireTenantScope, run(async (s, req, res) => {
    const result = await s.importar(context(req), req.body);
    res.status(result.reutilizado ? 200 : 201).json({ data: result });
  }));
  router.get('/api/v1/fornecedores/:id', requireTenantScope, run(async (s, req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid supplier identity');
    res.json({ data: await s.get(context(req), id.data) });
  }));
  router.post('/api/v1/fornecedores/:id/reverter', requireTenantScope, run(async (s, req, res) => {
    const id = idSchema.safeParse(req.params.id), body = reversalSchema.safeParse(req.body);
    if (!id.success || !body.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid supplier reversal');
    const p = body.data;
    res.json({ data: await s.softDelete(context(req), id.data, p.expectedRevision, p.source, p.batch, p.expectedFingerprint) });
  }));
}
