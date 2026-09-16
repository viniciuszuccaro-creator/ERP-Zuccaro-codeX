import { Router, type Request } from 'express';
import type { AppConfig } from '../config/env.js';
import { publicConfigView } from '../config/env.js';
import type { DbClient } from '../db/client.js';
import { getAuthFoundation } from '../auth/foundation.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { MarcaService } from '../services/marcaService.js';

export type ApiDeps = {
  config: AppConfig;
  db: DbClient;
  marcaService: MarcaService;
};

function ctxFromReq(req: Request) {
  return {
    requestId: req.requestId,
    groupId: req.groupId as string,
    empresaId: req.empresaId,
    actorId: req.actorId,
    actorEmail: req.actorEmail,
    ipAddress: req.ip,
  };
}

export function createApiRouter(deps: ApiDeps) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: deps.config.erpEnv,
      database: deps.config.databaseUrl ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
      version: deps.config.appVersion,
    });
  });

  router.get('/ready', async (_req, res) => {
    const ok = await deps.db.checkConnection();
    if (!ok) {
      res.status(503).json({
        status: 'not_ready',
        database: 'unreachable',
        timestamp: new Date().toISOString(),
        version: deps.config.appVersion,
      });
      return;
    }
    res.json({
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
      version: deps.config.appVersion,
    });
  });

  router.get('/api/v1/meta', (_req, res) => {
    res.json({
      runtime: 'ERP-RUNTIME-01',
      auth: getAuthFoundation(),
      config: publicConfigView(deps.config),
      pilotEntity: 'Marca',
    });
  });

  router.get('/api/v1/marcas', requireTenantScope, async (req, res, next) => {
    try {
      const ativoParam = req.query.ativo;
      const ativo = ativoParam == null
        ? undefined
        : ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());
      const search = req.query.search ? String(req.query.search) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const rows = await deps.marcaService.list(ctxFromReq(req), { ativo, search, limit });
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/marcas/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await deps.marcaService.get(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/marcas', requireTenantScope, async (req, res, next) => {
    try {
      const row = await deps.marcaService.create(ctxFromReq(req), req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/api/v1/marcas/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await deps.marcaService.update(ctxFromReq(req), req.params.id, req.body);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/v1/marcas/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await deps.marcaService.softDelete(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
