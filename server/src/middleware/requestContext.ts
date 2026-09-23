import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../api/errors.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      groupId?: string;
      empresaId?: string;
      actorId?: string;
      actorEmail?: string;
      scopeType?: 'grupo' | 'empresa';
      authVerified?: boolean;
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
const PUBLIC_PATHS = new Set(['/health', '/ready', '/api/v1/meta']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createSupabaseAuthMiddleware({
  supabaseUrl, anonKey, fetchImpl = fetch,
}: { supabaseUrl: string; anonKey: string; fetchImpl?: typeof fetch }) {
  const userUrl = new URL('auth/v1/user', `${supabaseUrl.replace(/\/+$/, '')}/`);
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (PUBLIC_PATHS.has(req.path)) { next(); return; }
    const bearer = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.header('authorization') || '');
    if (!bearer || bearer[1].length > 8192) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Authenticated user token required'));
      return;
    }
    let response: globalThis.Response;
    try {
      response = await fetchImpl(userUrl, {
        method: 'GET',
        headers: { apikey: anonKey, Authorization: `Bearer ${bearer[1]}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      next(new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service unavailable'));
      return;
    }
    if (!response.ok) {
      next(response.status >= 500
        ? new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service unavailable')
        : new AppError(401, 'AUTH_INVALID', 'Invalid user token'));
      return;
    }
    let user: unknown;
    try { user = await response.json(); }
    catch {
      next(new AppError(503, 'AUTH_UNAVAILABLE', 'Identity service returned invalid response'));
      return;
    }
    const identity = user && typeof user === 'object' ? user as Record<string, unknown> : {};
    const id = typeof identity.id === 'string' ? identity.id : '';
    const email = typeof identity.email === 'string' ? identity.email : '';
    if (!UUID_RE.test(id)) {
      next(new AppError(401, 'AUTH_INVALID', 'Invalid user token'));
      return;
    }
    if ((req.header('x-actor-id') && req.header('x-actor-id') !== id)
      || (req.header('x-actor-email') && req.header('x-actor-email') !== email)) {
      next(new AppError(403, 'ACTOR_HEADER_MISMATCH', 'Actor headers do not match authenticated user'));
      return;
    }
    req.actorId = id;
    if (email) req.actorEmail = email;
    req.authVerified = true;
    next();
  };
}


export function scopeMiddleware(req: Request, _res: Response, next: NextFunction) {
  const groupId = String(req.header('x-group-id') || req.query.group_id || '').trim();
  const empresaId = String(req.header('x-empresa-id') || req.query.empresa_id || '').trim();
  const actorId = String(req.header('x-actor-id') || '').trim();
  const actorEmail = String(req.header('x-actor-email') || '').trim();

  if (groupId) req.groupId = groupId;
  if (empresaId) req.empresaId = empresaId;
  if (!req.authVerified) {
    if (actorId) req.actorId = actorId;
    if (actorEmail) req.actorEmail = actorEmail;
  }
  req.scopeType = empresaId ? 'empresa' : 'grupo';
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
