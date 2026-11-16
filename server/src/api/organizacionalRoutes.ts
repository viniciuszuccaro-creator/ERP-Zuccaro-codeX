import type { Router, Request } from 'express';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { OrganizacionalService } from '../services/organizacionalService.js';

export function mountOrganizacionalRoutes(router: Router, service: OrganizacionalService) {
  const ctx = (r: Request) => ({ requestId: r.requestId, groupId: r.groupId as string, empresaId: r.empresaId,
    actorId: r.actorId, actorEmail: r.actorEmail, scopeType: r.scopeType, ipAddress: r.ip });
  for (const [path, kind] of [['grupos-empresariais', 'GrupoEmpresarial'], ['empresas', 'Empresa']] as const) {
    const base = `/api/v1/${path}`;
    router.get(base, requireTenantScope, async (req, res, next) => {
      try { const rows = await service.list(ctx(req), kind); res.setHeader('Cache-Control', 'no-store'); res.json({ data: rows, meta: { total: rows.length } }); }
      catch (error) { next(error); }
    });
    router.get(`${base}/:id`, requireTenantScope, async (req, res, next) => {
      try { res.setHeader('Cache-Control', 'no-store'); res.json({ data: await service.get(ctx(req), kind, req.params.id) }); }
      catch (error) { next(error); }
    });
    router.patch(`${base}/:id`, requireTenantScope, async (req, res, next) => {
      try { res.setHeader('Cache-Control', 'no-store'); res.json({ data: await service.update(ctx(req), kind, req.params.id, req.body) }); }
      catch (error) { next(error); }
    });
  }
}
