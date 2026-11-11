import busboy from 'busboy';
import { json, type Request, type RequestHandler, type Router } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import type { RequestContext } from '../audit/types.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { A1VaultService } from '../services/a1VaultService.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uploadError() { return new AppError(422, 'A1_UPLOAD_INVALID', 'Invalid certificate upload'); }

/** Multipart bytes exist only for the authenticated operation; neither filenames nor fields are logged. */
async function receive(req: Request) {
  return new Promise<{ certificate: Buffer; password: Buffer; operationId: string; replaces?: unknown }>((resolve, reject) => {
    let parser: ReturnType<typeof busboy>;
    try { parser = busboy({ headers: req.headers, limits: { fileSize: 5000000, files: 1, fieldSize: 4096,
      fields: 3, parts: 4, fieldNameSize: 40, headerPairs: 50 } }); } catch { reject(uploadError()); return; }
    const chunks: Buffer[] = [], fields = new Map<string,string>();
    let fileCount = 0, done = false;
    const cleanup = () => { clearTimeout(timer); req.removeListener('aborted', abort); req.removeListener('error', fail); };
    const wipe = () => { for (const chunk of chunks) chunk.fill(0); chunks.length = 0; fields.clear(); };
    const fail = () => {
      if (done) return;
      done = true; cleanup(); wipe(); req.unpipe(parser); req.resume();
      // Busboy updates its file state after emitting limits; synchronous destroy is reentrant.
      queueMicrotask(() => parser.destroy()); reject(uploadError());
    };
    const abort = () => fail();
    const timer = setTimeout(fail, 15000);
    req.once('aborted', abort); req.once('error', fail);
    parser.on('file', (name, stream, info) => {
      fileCount++;
      stream.on('error', fail);
      if (name !== 'certificate' || !/\.(pfx|p12)$/i.test(info.filename ?? '')
        || !['application/x-pkcs12', 'application/octet-stream'].includes(info.mimeType)) { stream.resume(); fail(); return; }
      stream.on('data', (chunk: Buffer) => { if (done) chunk.fill(0); else chunks.push(chunk); });
      stream.on('limit', fail);
    });
    parser.on('field', (name, value, info) => {
      if (!['password', 'operationId', 'replaces'].includes(name) || fields.has(name) || info.valueTruncated || info.nameTruncated) { fail(); return; }
      fields.set(name, value);
    });
    parser.on('filesLimit', fail); parser.on('fieldsLimit', fail); parser.on('partsLimit', fail); parser.on('error', fail);
    parser.on('close', () => {
      if (done) return;
      const operationId = fields.get('operationId');
      if (fileCount !== 1 || !chunks.length || !fields.has('password') || !operationId || !uuid.test(operationId)) { fail(); return; }
      let replaces: unknown;
      try { const value = fields.get('replaces'); replaces = value === undefined ? undefined : JSON.parse(value); }
      catch { fail(); return; }
      const result = { certificate: Buffer.concat(chunks), password: Buffer.from(fields.get('password') ?? '', 'utf8'),
        operationId, ...(replaces === undefined ? {} : { replaces }) };
      done = true; cleanup(); wipe(); resolve(result);
    });
    req.pipe(parser);
  });
}

/** Prepared canonical router extraction. Does NOT mount itself in app/router or expose a download/signing endpoint. */
export function mountA1VaultRoutes(router: Router, service: Pick<A1VaultService, 'upload' | 'metadata' | 'revoke' | 'rotate'>,
  context: (req: Request) => RequestContext) {
  const base = '/api/v1/fiscal/certificados-a1';
  const contexts = new WeakMap<Request, RequestContext>();
  let pending = 0;
  const parseJson = json({ limit: '4kb' });
  const safeJson: RequestHandler = (req,res,next) => parseJson(req,res,(error?: unknown) => next(error ? uploadError() : undefined));
  const verified: RequestHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!uuid.test(req.requestId ?? '')) { req.requestId = randomUUID(); res.setHeader('X-Request-Id', req.requestId); }
    try {
      if (req.authVerified !== true || !req.actorId) throw new AppError(401, 'AUTH_REQUIRED', 'Verified user session required');
      const ctx = context(req);
      if (!req.empresaId || ctx.groupId !== req.groupId || ctx.empresaId !== req.empresaId
        || ctx.actorId !== req.actorId || ctx.requestId !== req.requestId)
        throw new AppError(403, 'A1_CONTEXT_MISMATCH', 'Legal-company request context mismatch');
      contexts.set(req, Object.freeze({ ...ctx })); next();
    } catch (error) { next(error instanceof AppError ? error : new AppError(503, 'A1_VAULT_UNAVAILABLE', 'Certificate vault unavailable')); }
  };
  const handler = (operation: (req: Request, ctx: RequestContext) => Promise<unknown>): RequestHandler => async (req,res,next) => {
    try {
      const ctx = contexts.get(req);
      if (!ctx) throw new AppError(401, 'AUTH_REQUIRED', 'Verified user session required');
      const result = await operation(req, ctx); res.status(200).json(result);
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(503, 'A1_VAULT_UNAVAILABLE', 'Certificate vault unavailable'));
    } finally { contexts.delete(req); }
  };
  router.get(base, requireTenantScope, verified, handler((_req,ctx) => service.metadata(ctx)));
  router.post(base, requireTenantScope, verified, handler(async (req,ctx) => {
    if (pending >= 2) throw new AppError(429, 'A1_UPLOAD_BUSY', 'Certificate upload busy');
    pending++;
    let request: Awaited<ReturnType<typeof receive>> | undefined;
    try { request = await receive(req); return await service.upload(ctx, request); }
    finally { pending--; request?.certificate.fill(0); request?.password.fill(0); }
  }));
  router.post(`${base}/:id/revogar`, requireTenantScope, verified, safeJson,
    handler((req,ctx) => service.revoke(ctx, { ...req.body, id: req.params.id })));
  router.post(`${base}/:id/rotacionar`, requireTenantScope, verified, safeJson,
    handler((req,ctx) => service.rotate(ctx, { ...req.body, id: req.params.id })));
}
