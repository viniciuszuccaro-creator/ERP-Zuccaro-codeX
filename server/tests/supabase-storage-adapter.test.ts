import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SupabaseStorageAdapter } from '../src/services/supabaseStorageAdapter.js';

import { assertCleanMalwareScan, assertMalwareScanResult, type MalwareScanResult } from '../src/services/storagePort.js';
const groupId = '11111111-1111-4111-8111-111111111111';
const empresaId = '22222222-2222-4222-8222-222222222222';
const entityId = '33333333-3333-4333-8333-333333333333';
const fileId = '44444444-4444-4444-8444-444444444444';
const storageKey = `groups/${groupId}/companies/${empresaId}/products/${entityId}/images/${fileId}-foto.png`;
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qZkAAAAASUVORK5CYII=', 'base64');
const request = {
  groupId, empresaId, actorId: 'synthetic-actor', entity: 'Produto' as const, entityId,
  storageKey, fileName: 'foto.png', mimeType: 'image/png', sizeBytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};

function makeAdapter(fetchImpl: typeof fetch) {
  return new SupabaseStorageAdapter({
    internalUrl: 'https://internal.example.test', publicUrl: 'https://public.example.test',
    serviceRoleKey: 'synthetic-key', privateBucket: 'private', maxBytes: 1024, fetchImpl,
  });
}

test('Storage adapter signs only private tenant path and keeps service key off returned URL', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const adapter = makeAdapter(async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json({ url: `/object/upload/sign/private/${storageKey}?token=synthetic-token` });
  });
  const signed = await adapter.createSignedUploadUrl(request);
  assert.equal(calls[0].url.origin, 'https://internal.example.test');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.match(signed.url, /^https:\/\/public\.example\.test\/storage\/v1\/object\/upload\/sign\/private\//);
  assert.equal(signed.url.includes('synthetic-key'), false);
  assert.equal(signed.requiredHeaders['content-type'], 'image/png');
  assert.equal(JSON.stringify(calls[0].init?.headers).includes('synthetic-key'), true);
});

test('Storage adapter rejects cross-tenant path before network', async () => {
  const adapter = makeAdapter(async () => { throw new Error('network must not run'); });
  await assert.rejects(adapter.createSignedUploadUrl({ ...request, empresaId: groupId }), /STORAGE_SCOPE_INVALID/);
  await assert.rejects(adapter.createSignedDownloadUrl({ ...request, empresaId: groupId }, storageKey), /STORAGE_SCOPE_INVALID/);
  await assert.rejects(adapter.createSignedUploadUrl({ ...request, mimeType: 'application/x-msdownload' }), /STORAGE_UPLOAD_INVALID/);
  await assert.rejects(adapter.createSignedUploadUrl({ ...request, fileName: '../foto.png' }), /STORAGE_UPLOAD_INVALID/);
  await assert.rejects(adapter.createSignedUploadUrl({ ...request, storageKey: storageKey.replace('/images/', '/documents/') }), /STORAGE_UPLOAD_INVALID/);
  await assert.rejects(adapter.createSignedUploadUrl({ ...request, storageKey: storageKey.replace('/images/', '/cad/') }), /STORAGE_SCOPE_INVALID/);
  await assert.rejects(adapter.createSignedDownloadUrl(request, storageKey.replace('/images/', '/cad/')), /STORAGE_SCOPE_INVALID/);
});

test('Storage adapter rejects signed response pointing to another object', async () => {
  const adapter = makeAdapter(async () => Response.json({ url: '/object/upload/sign/private/other?token=synthetic-token' }));
  await assert.rejects(adapter.createSignedUploadUrl(request), /STORAGE_SIGN_RESPONSE_INVALID/);
});

test('Storage adapter rejects signed URLs outside the configured public origin', async () => {
  const path = `/storage/v1/object/upload/sign/private/${storageKey}?token=synthetic-token`;
  for (const url of [`https://other.example.test${path}`, `https://public.example.test${path}#fragment`,
    `https://public.example.test/storage/v1/object/upload/sign/private/${storageKey}?token=`]) {
    const adapter = makeAdapter(async () => Response.json({ url }));
    await assert.rejects(adapter.createSignedUploadUrl(request), /STORAGE_SIGN_RESPONSE_INVALID/);
  }
  const foreignDownload = makeAdapter(async () => Response.json({
    signedURL: `https://other.example.test/storage/v1/object/sign/private/${storageKey}?token=synthetic-token`,
  }));
  await assert.rejects(foreignDownload.createSignedDownloadUrl(request, storageKey), /STORAGE_SIGN_RESPONSE_INVALID/);
});

test('Storage adapter confirms exact byte count and SHA-256', async () => {
  const adapter = makeAdapter(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }));
  const metadata = await adapter.confirmUpload(request);
  assert.equal(metadata.sha256, request.sha256);
  await assert.rejects(adapter.confirmUpload({ ...request, sha256: '0'.repeat(64) }), /STORAGE_CHECKSUM_MISMATCH/);
  await assert.rejects(adapter.confirmUpload({ ...request, sizeBytes: 2 }), /STORAGE_SIZE_MISMATCH/);
});

test('Storage adapter rejects redirects on privileged signing and object reads', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const adapter = makeAdapter(async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    if (init?.redirect !== 'error') throw new Error('UNSAFE_REDIRECT_POLICY');
    return Response.redirect('https://other.example.test/collect', 302);
  });
  await assert.rejects(adapter.createSignedUploadUrl(request), /STORAGE_REQUEST_FAILED/);
  await assert.rejects(adapter.createSignedDownloadUrl(request, storageKey), /STORAGE_REQUEST_FAILED/);
  await assert.rejects(adapter.confirmUpload(request), /STORAGE_OBJECT_NOT_FOUND/);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ url, init }) => url.origin === 'https://internal.example.test' && init?.redirect === 'error'));
});

test('Storage adapter rejects MIME header and spoofed content even with matching checksum', async () => {
  const wrongHeader = makeAdapter(async () => new Response(bytes, { headers: { 'content-type': 'text/html' } }));
  await assert.rejects(wrongHeader.confirmUpload(request), /STORAGE_MIME_MISMATCH/);
  const spoof = Buffer.from('synthetic-not-a-png');
  const fake = { ...request, sizeBytes: spoof.length, sha256: createHash('sha256').update(spoof).digest('hex') };
  const wrongBody = makeAdapter(async () => new Response(spoof, { headers: { 'content-type': 'image/png' } }));
  await assert.rejects(wrongBody.confirmUpload(fake), /STORAGE_CONTENT_MISMATCH/);
});

test('Storage adapter accepts a private PDF in a matching category', async () => {
  const pdf = Buffer.from('%PDF-1.7\nsynthetic');
  const pdfKey = `groups/${groupId}/companies/${empresaId}/products/${entityId}/documents/${fileId}-manual.pdf`;
  const pdfRequest = {
    ...request, storageKey: pdfKey, fileName: 'manual.pdf', mimeType: 'application/pdf',
    sizeBytes: pdf.length, sha256: createHash('sha256').update(pdf).digest('hex'),
  };
  const adapter = makeAdapter(async () => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }));
  const metadata = await adapter.confirmUpload(pdfRequest);
  assert.equal(metadata.storageKey, pdfKey);
});

test('Storage adapter signs private download for one minute', async () => {
  const adapter = makeAdapter(async () => Response.json({ signedURL: `/object/sign/private/${storageKey}?token=synthetic-token` }));
  const result = await adapter.createSignedDownloadUrl(request, storageKey);
  assert.match(result.url, /^https:\/\/public\.example\.test\/storage\/v1\/object\/sign\/private\//);
});
test('DAM scan contract fails closed for missing, inconclusive, or unrelated results', () => {
  const clean: MalwareScanResult = {
    ...request, version: 1, verdict: 'CLEAN', scanner: 'synthetic-scanner',
    scannedAt: new Date().toISOString(),
  };
  assert.doesNotThrow(() => assertCleanMalwareScan(request, clean));
  const invalid: unknown[] = [
    undefined, null, {},
    { ...clean, verdict: 'INFECTED' },
    { ...clean, verdict: 'ERROR' },
    { ...clean, scanner: '' },
    { ...clean, scannedAt: 'invalid' },
    { ...clean, scannedAt: new Date(Date.now() - 10 * 60_000).toISOString() },
    { ...clean, scannedAt: new Date(Date.now() + 2 * 60_000).toISOString() },
    { ...clean, groupId: empresaId },
    { ...clean, empresaId: groupId },
    { ...clean, actorId: 'other-actor' },
    { ...clean, entityId: fileId },
    { ...clean, storageKey: 'other-key' },
    { ...clean, sha256: '0'.repeat(64) },
    { ...clean, sizeBytes: request.sizeBytes + 1 },
    { ...clean, version: 2 },
  ];
  for (const result of invalid) {
    assert.throws(() => assertCleanMalwareScan(request, result), /MALWARE_SCAN_NOT_CLEAN/);
  }
});
test('DAM rejeita evidencia anterior ao inicio da varredura atual', () => {
  const startedAtMs = Date.now();
  const clean: MalwareScanResult = { ...request, version: 1, verdict: 'CLEAN',
    scanner: 'synthetic-scanner', scannedAt: new Date(startedAtMs - 10_000).toISOString() };
  assert.throws(() => assertMalwareScanResult(request, clean, startedAtMs), /MALWARE_SCAN_NOT_CLEAN/);
  assert.throws(() => assertMalwareScanResult(request, { ...clean, scannedAt: new Date(startedAtMs + 60_000).toISOString() }, startedAtMs), /MALWARE_SCAN_NOT_CLEAN/);
  assert.doesNotThrow(() => assertMalwareScanResult(request, { ...clean, scannedAt: new Date().toISOString() }, startedAtMs));
});
test('Clamd scan is disabled without an explicit local socket', async () => {
  const adapter = makeAdapter(async () => { throw new Error('network must not run'); });
  await assert.rejects(adapter.scan(request), /MALWARE_SCAN_NOT_CONFIGURED/);
  await assert.rejects(adapter.scan({ ...request, empresaId: groupId }), /STORAGE_SCOPE_INVALID/);
});

test('Clamd INSTREAM verifies exact private object and fails closed on scanner results', async () => {
  const socketPath = process.platform === 'win32'
    ? `\\\\.\\pipe\\erp-clamd-${randomUUID()}` : join(tmpdir(), `erp-clamd-${randomUUID()}.sock`);
  let verdict = 'stream: OK';
  let scanned = Buffer.alloc(0);
  const server = createServer((socket) => {
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length < 10 || pending.subarray(0, 10).toString() !== 'zINSTREAM\0') return;
      let offset = 10;
      const parts: Buffer[] = [];
      while (offset + 4 <= pending.length) {
        const length = pending.readUInt32BE(offset);
        if (length === 0) {
          scanned = Buffer.concat(parts);
          if (verdict === 'NO_REPLY') return;
          socket.end(`${verdict}\0`);
          return;
        }
        if (offset + 4 + length > pending.length) return;
        parts.push(pending.subarray(offset + 4, offset + 4 + length));
        offset += 4 + length;
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  const adapter = new SupabaseStorageAdapter({
    internalUrl: 'https://internal.example.test', publicUrl: 'https://public.example.test',
    serviceRoleKey: 'synthetic-key', privateBucket: 'private', maxBytes: 1024,
    clamdSocketPath: socketPath, clamdTimeoutMs: 1000,
    fetchImpl: async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }),
  });
  try {
    const clean = await adapter.scan(request);
    assert.equal(clean.verdict, 'CLEAN');
    assert.equal(clean.scanner, 'clamd');
    assert.deepEqual(scanned, bytes);
    assert.doesNotThrow(() => assertCleanMalwareScan(request, clean));
    verdict = 'stream: Synthetic.Test FOUND';
    const infected = await adapter.scan(request);
    assert.equal(infected.verdict, 'INFECTED');
    assert.throws(() => assertCleanMalwareScan(request, infected), /MALWARE_SCAN_NOT_CLEAN/);
    verdict = 'stream: ERROR';
    await assert.rejects(adapter.scan(request), /MALWARE_SCAN_INCONCLUSIVE/);
    await assert.rejects(adapter.scan({ ...request, sha256: '0'.repeat(64) }), /MALWARE_SCAN_OBJECT_INVALID/);
    verdict = 'stream: OK';
    const spoof = Buffer.from('synthetic-not-a-png');
    const spoofAdapter = new SupabaseStorageAdapter({ internalUrl: 'https://internal.example.test', publicUrl: 'https://public.example.test', serviceRoleKey: 'synthetic-key', privateBucket: 'private', maxBytes: 1024, clamdSocketPath: socketPath, clamdTimeoutMs: 1000, fetchImpl: async () => new Response(spoof, { headers: { 'content-type': 'image/png' } }) });
    await assert.rejects(spoofAdapter.scan({ ...request, sizeBytes: spoof.length, sha256: createHash('sha256').update(spoof).digest('hex') }), /MALWARE_SCAN_OBJECT_INVALID/);
    verdict = 'NO_REPLY';
    await assert.rejects(adapter.scan(request), /MALWARE_SCAN_INCONCLUSIVE|MALWARE_SCAN_TIMEOUT/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
