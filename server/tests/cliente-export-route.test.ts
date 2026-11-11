import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { mountClienteExportRoute } from '../src/api/clienteExportRoute.ts';
import { requestIdMiddleware, scopeMiddleware } from '../src/middleware/requestContext.ts';
import { createErrorHandler, notFoundHandler } from '../src/middleware/errorHandler.ts';
import { loadConfig } from '../src/config/env.ts';
import { AppError } from '../src/api/errors.ts';
import type { ClienteService } from '../src/services/clienteService.ts';
import type { RequestContext } from '../src/audit/types.ts';

const group = '10000000-0000-4000-8000-000000000001';
const actor = '10000000-0000-4000-8000-000000000002';
const bytes = Buffer.from('{"version":1,"mode":"selected","data":[]}');
const file = { fileName: 'clientes.json', contentType: 'application/json', bytes,
  count: 0, sha256: createHash('sha256').update(bytes).digest('hex') };
type Export = Pick<ClienteService, 'export'>;

/** Isolated HTTP boundary fixture: this is not Supabase authentication or an operational route mount. */
async function fixture(service: Export, options: { verified?: boolean; mismatch?: boolean; mounted?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: '64kb' }), requestIdMiddleware, scopeMiddleware);
  app.use((req, _res, next) => {
    if (options.verified) { req.authVerified = true; req.actorId = actor; }
    next();
  });
  const router = Router();
  if (options.mounted !== false) mountClienteExportRoute(router, service, req => ({
    requestId: req.requestId, groupId: options.mismatch ? actor : req.groupId ?? '',
    empresaId: req.empresaId, actorId: req.actorId,
  }));
  app.use(router, notFoundHandler, createErrorHandler(loadConfig({ NODE_ENV: 'production', ERP_ENV: 'prod',
    SUPABASE_URL: 'https://auth.synthetic.test', SUPABASE_ANON_KEY: 'SYNTHETIC_NOT_A_CREDENTIAL',
    DATABASE_URL: 'postgresql://synthetic@127.0.0.1/erp_test' })));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const send = (body: unknown = { mode: 'selected', ids: [actor], filters: {} }, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${address.port}/api/v1/clientes/export`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-group-id': group, ...headers }, body: JSON.stringify(body) });
  return { send, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test('Cliente export HTTP requires verified middleware state, never actor or authVerified headers', async () => {
  let calls = 0;
  const f = await fixture({ export: async () => { calls++; return file; } });
  try {
    const response = await f.send(undefined, { 'x-actor-id': actor, 'authorization': 'Bearer synthetic', 'authVerified': 'true' });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
    assert.equal(response.headers.get('content-disposition'), null);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  } finally { await f.close(); }
});

test('Cliente export HTTP returns exact bytes/hash only after service resolves, with canonical context/body', async () => {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered = () => {};
  const ready = new Promise<void>(resolve => { entered = resolve; });
  let observed: RequestContext | undefined;
  const input = { mode: 'filtered', filters: { ativo: false } };
  const f = await fixture({ export: async (ctx, body) => {
    observed = ctx; assert.deepEqual(body, input); entered(); await gate; return file;
  } }, { verified: true });
  try {
    let responseReceived = false;
    const pending = f.send(input).then(response => { responseReceived = true; return response; });
    await ready;
    assert.equal(responseReceived, false);
    release();
    const response = await pending;
    assert.equal(response.status, 200);
    assert.equal(observed?.groupId, group); assert.equal(observed?.actorId, actor);
    assert(observed?.requestId);
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="clientes.json"');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-content-sha256'), file.sha256);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  } finally { release(); await f.close(); }
});

test('Cliente export HTTP denies mismatched producer and remains absent when not mounted', async () => {
  let calls = 0;
  const service: Export = { export: async () => { calls++; return file; } };
  for (const options of [{ verified: true, mismatch: true }, { mounted: false }]) {
    const f = await fixture(service, options);
    try { assert.equal((await f.send()).status, options.mounted === false ? 404 : 403); }
    finally { await f.close(); }
  }
  assert.equal(calls, 0);
});

test('Cliente export HTTP errors have no file headers or raw database/input secrets', async t => {
  const logger = t.mock.method(console, 'warn', () => {});
  for (const error of [new AppError(403, 'PERMISSION_DENIED', 'Permission denied'),
    z.object({ ids: z.array(z.string().uuid()) }).parseAsync({ ids: ['PRIVATE_SYNTHETIC'] }).catch(error => error),
    new Error('PRIVATE_SYNTHETIC_AUDIT_FAILURE')]) {
    const failure = await error;
    const f = await fixture({ export: async () => { throw failure; } }, { verified: true });
    try {
      const response = await f.send(undefined, { 'x-request-id': 'PRIVATE_SYNTHETIC' });
      assert([403,422,503].includes(response.status));
      assert.equal(response.headers.get('content-disposition'), null);
      assert.equal(response.headers.get('x-content-sha256'), null);
      assert(!(await response.text()).includes('PRIVATE_SYNTHETIC'));
    } finally { await f.close(); }
  }
  assert(!JSON.stringify(logger.mock.calls.map(call => call.arguments)).includes('PRIVATE_SYNTHETIC'));
});
