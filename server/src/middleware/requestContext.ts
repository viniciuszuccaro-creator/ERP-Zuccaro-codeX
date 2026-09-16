import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      groupId?: string;
      empresaId?: string;
      actorId?: string;
      actorEmail?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = String(req.header('x-request-id') || '').trim();
  const requestId = incoming || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function scopeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const groupId = String(req.header('x-group-id') || req.query.group_id || '').trim();
  const empresaId = String(req.header('x-empresa-id') || req.query.empresa_id || '').trim();
  const actorId = String(req.header('x-actor-id') || '').trim();
  const actorEmail = String(req.header('x-actor-email') || '').trim();

  if (groupId) req.groupId = groupId;
  if (empresaId) req.empresaId = empresaId;
  if (actorId) req.actorId = actorId;
  if (actorEmail) req.actorEmail = actorEmail;
  next();
}

export function requireTenantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.groupId) {
    next(new Error('GROUP_ID_REQUIRED'));
    return;
  }
  // UUID format soft-check
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(req.groupId)) {
    next(Object.assign(new Error('GROUP_ID_INVALID'), { statusCode: 400, code: 'GROUP_ID_INVALID' }));
    return;
  }
  if (req.empresaId && !uuidRe.test(req.empresaId)) {
    next(Object.assign(new Error('EMPRESA_ID_INVALID'), { statusCode: 400, code: 'EMPRESA_ID_INVALID' }));
    return;
  }
  next();
}
