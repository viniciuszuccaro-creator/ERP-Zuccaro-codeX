import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { SupabaseStorageAdapter } from '../src/services/supabaseStorageAdapter.js';

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

test('Storage adapter confirms exact byte count and SHA-256', async () => {
  const adapter = makeAdapter(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }));
  const metadata = await adapter.confirmUpload(request);
  assert.equal(metadata.sha256, request.sha256);
  await assert.rejects(adapter.confirmUpload({ ...request, sha256: '0'.repeat(64) }), /STORAGE_CHECKSUM_MISMATCH/);
  await assert.rejects(adapter.confirmUpload({ ...request, sizeBytes: 2 }), /STORAGE_SIZE_MISMATCH/);
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
