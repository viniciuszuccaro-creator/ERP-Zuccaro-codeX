import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { mountA1VaultRoutes } from '../src/api/a1VaultRoute.ts';
import { AppError } from '../src/api/errors.ts';
import type { A1VaultService } from '../src/services/a1VaultService.ts';

const base = '/api/v1/fiscal/certificados-a1';
type State = { fail: boolean; held?: Buffer; calls: number; pause?: Promise<void>; entered?: () => void };
async function fixture(run: (url: string, state: State) => Promise<void>) {
  const state: State = { fail: false, calls: 0 };
  const app = express();
  app.use((req,_res,next) => {
    // Explicit synthetic verified-state fixture: no actual Bearer/identity-provider proof.
    req.requestId = 'SYNTHETIC-ARBITRARY-REQUEST-ID';
    req.groupId = '11111111-1111-4111-8111-111111111111';
    req.empresaId = '22222222-2222-4222-8222-222222222222';
    if (req.header('x-synthetic-verified') === 'yes') { req.authVerified = true; req.actorId = '33333333-3333-4333-8333-333333333333'; }
    next();
  });
  const metadata: Awaited<ReturnType<A1VaultService['upload']>> = { id: '44444444-4444-4444-8444-444444444444', fingerprint: '0'.repeat(64), validFrom: '2026-10-01',
    validTo: '2026-12-01', state: 'ACTIVE', revision: '1', trustStoreVersion: 'synthetic' };
  mountA1VaultRoutes(app, {
    async upload(ctx, input) {
      state.calls++;
      assert.notEqual(ctx.requestId, 'SYNTHETIC-ARBITRARY-REQUEST-ID');
      assert.ok(input && typeof input === 'object' && 'password' in input && Buffer.isBuffer(input.password));
      state.held = input.password;
      state.entered?.(); await state.pause;
      if (state.fail) throw new Error('SYNTHETIC_SECRET_PASSWORD_RAW_ERROR');
      return metadata;
    },
    async metadata() { return metadata; }, async revoke() { return metadata; }, async rotate() { return metadata; },
  }, req => ({ groupId: req.groupId!, empresaId: req.empresaId, actorId: req.actorId, requestId: req.requestId }));
  const errors: ErrorRequestHandler = (error,_req,res,_next) => {
    assert.ok(error instanceof AppError);
    res.status(error.statusCode).json({ code: error.code, message: error.message });
  };
  app.use(errors);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`, state); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); }
}
function form(options: { duplicate?: boolean; password?: string; mime?: string; file?: string; fileBytes?: number } = {}) {
  const body = new FormData();
  body.set('password', options.password ?? 'SYNTHETIC-PASSWORD'); body.set('operationId', randomUUID());
  body.append('certificate', new Blob([options.fileBytes ? 'x'.repeat(options.fileBytes) : 'SYNTHETIC-PFX-BOUNDARY-ONLY'],
    { type: options.mime ?? 'application/x-pkcs12' }), options.file ?? 'synthetic.p12');
  if (options.duplicate) body.append('certificate', new Blob(['another']), 'another.p12');
  return body;
}

test('A1 HTTP rejects unverified state before consuming multipart and offers no download endpoint', async () => fixture(async url => {
  const denied = await fetch(url + base, { method: 'POST', body: 'not multipart', headers: { 'content-type': 'text/plain' } });
  assert.equal(denied.status, 401);
  const download = await fetch(url + base + '/44444444-4444-4444-8444-444444444444/download', { headers: { 'x-synthetic-verified': 'yes' } });
  assert.equal(download.status, 404);
}));

test('A1 HTTP waits for service commit, returns metadata only and erases transferred buffers', async () => fixture(async (url,state) => {
  let release: (() => void) | undefined;
  state.pause = new Promise(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { state.entered = resolve; });
  let responded = false;
  const pending = fetch(url + base, { method: 'POST', body: form(), headers: { 'x-synthetic-verified': 'yes' } })
    .then(response => { responded = true; return response; });
  await entered; assert.equal(responded, false); assert.ok(release); release();
  const result = await pending;
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store, private');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(!(await result.text()).includes('SYNTHETIC-PASSWORD'));
  assert.ok(state.held?.every(byte => byte === 0));
  state.fail = true;
  const failure = await fetch(url + base, { method: 'POST', body: form(), headers: { 'x-synthetic-verified': 'yes' } });
  assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('SYNTHETIC_SECRET'));
  assert.ok(state.held?.every(byte => byte === 0));
}));

test('A1 HTTP rejects duplicate files, bad MIME/extension, oversized password and malformed JSON without raw errors', async () => fixture(async (url,state) => {
  for (const options of [{ duplicate: true }, { mime: 'image/png' }, { file: 'synthetic.exe' }, { password: 'x'.repeat(4097) }, { fileBytes: 5000001 }]) {
    const response = await fetch(url + base, { method: 'POST', body: form(options), headers: { 'x-synthetic-verified': 'yes' } });
    assert.equal(response.status, 422, await response.text());
  }
  assert.equal(state.calls, 0);
  const invalid = await fetch(url + base + '/44444444-4444-4444-8444-444444444444/revogar', {
    method: 'POST', body: '{SYNTHETIC_PRIVATE_MALFORMED', headers: { 'x-synthetic-verified': 'yes', 'content-type': 'application/json' } });
  assert.equal(invalid.status, 422); assert.ok(!(await invalid.text()).includes('SYNTHETIC_PRIVATE'));
}));
