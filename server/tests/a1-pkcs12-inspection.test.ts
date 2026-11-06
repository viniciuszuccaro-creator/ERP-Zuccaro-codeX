import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomBytes, X509Certificate } from 'node:crypto';
import { inspectA1Pkcs12 } from '../src/services/a1Pkcs12Inspection.ts';
import { A1VaultEncryption } from '../src/services/a1VaultEncryption.ts';

const linux = { skip: process.platform !== 'linux' };
const password = Buffer.from('SYNTHETIC-A1-INSPECTION-ONLY');
let directory = '';
let valid: Buffer, noMac: Buffer, noKey: Buffer, unrelated: Buffer, slow: Buffer;
let certificate: X509Certificate;

test('canonical runtime image installs the native inspector without running the API as root', () => {
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const runtime = dockerfile.split(/FROM node:22-bookworm-slim AS runtime\r?\n/)[1];
  assert.ok(runtime);
  assert.match(runtime, /apt-get install[^\n]*--no-install-recommends[^\n]*openssl/);
  assert.match(runtime, /USER node/);
  assert.match(runtime, /CMD \["node", "dist\/index.js"\]/);
});
function openssl(args: string[], input?: Buffer) {
  const result = spawnSync('/usr/bin/openssl', args, { input, timeout: 15000, maxBuffer: 262144 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, 'synthetic fixture generation failed');
}

before(() => {
  if (process.platform !== 'linux') return;
  directory = mkdtempSync(join(tmpdir(), 'erp-a1-synthetic-'));
  for (const name of ['leaf', 'other']) {
    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
      '-subj', '/CN=SYNTHETIC-INSPECTION-NOT-ICP-BRASIL',
      '-addext', 'basicConstraints=critical,CA:FALSE',
      '-keyout', join(directory, `${name}.key`), '-out', join(directory, `${name}.crt`)]);
  }
  const pack = (name: string, extra: string[] = []) => {
    const path = join(directory, `${name}.p12`);
    openssl(['pkcs12', '-export', '-inkey', join(directory, 'leaf.key'),
      '-in', join(directory, 'leaf.crt'), '-out', path, '-passout', 'stdin', ...extra],
    Buffer.concat([password, Buffer.from('\n')]));
    return readFileSync(path);
  };
  valid = pack('valid'); noMac = pack('nomac', ['-nomac']); noKey = pack('nokey', ['-nokeys']);
  unrelated = pack('unrelated', ['-certfile', join(directory, 'other.crt')]);
  slow = pack('bounded', ['-iter', '300000']);
  certificate = new X509Certificate(readFileSync(join(directory, 'leaf.crt')));
});
after(() => {
  if (!directory) return;
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  assert.ok(directory.includes('erp-a1-synthetic-'));
  rmSync(directory, { recursive: true });
});

test('A1 inspection rejects invalid input before starting a native process', async () => {
  for (const [bytes, pass] of [[Buffer.alloc(0), password], [Buffer.alloc(5000001), password],
    [Buffer.from('invalid'), Buffer.from('line\nbreak')], [Buffer.from('invalid'), Buffer.from([0])],
    [Buffer.from('invalid'), Buffer.alloc(4097)]]) {
    await assert.rejects(inspectA1Pkcs12(bytes, pass), { code: 'A1_PKCS12_INVALID' });
  }
  if (process.platform !== 'linux') {
    await assert.rejects(inspectA1Pkcs12(Buffer.from('invalid'), password), { code: 'A1_INSPECTION_UNAVAILABLE' });
  }
});

test('real OpenSSL PKCS12: key/certificate match and validity do not fabricate CNPJ or chain trust', linux, async () => {
  const original = Buffer.from(valid), pass = Buffer.from(password);
  const result = await inspectA1Pkcs12(valid, pass);
  assert.equal(result.fingerprintSha256, certificate.fingerprint256.replaceAll(':', '').toLowerCase());
  assert.equal(result.keyAlgorithm, 'rsa'); assert.equal(result.macAlgorithm, 'sha256');
  assert.equal(result.certificateCount, 1);
  assert.equal(result.identityVerified, false); assert.equal(result.trustVerified, false); assert.equal(result.revocationVerified, false);
  assert.doesNotMatch(JSON.stringify(result), /BEGIN |SYNTHETIC|PRIVATE|password|issuerCnpj/);
  assert.deepEqual(valid, original); assert.deepEqual(pass, password);
});

test('real containers reject wrong password, corruption, absent MAC, absent key and unrelated leaf', linux, async () => {
  const corrupted = Buffer.from(valid); corrupted[corrupted.length - 1] ^= 1;
  for (const [bytes, pass] of [[valid, Buffer.from('WRONG_SYNTHETIC_PASSWORD')], [corrupted, password],
    [Buffer.from('NOT-PKCS12'), password], [noMac, password], [noKey, password], [unrelated, password]]) {
    await assert.rejects(inspectA1Pkcs12(bytes, pass), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Invalid certificate container');
      assert.doesNotMatch(JSON.stringify(error), /WRONG_SYNTHETIC|BEGIN |MAC verify|password|\.key/);
      return true;
    });
  }
});

test('real container validity is checked at both boundaries with an explicit server clock', linux, async () => {
  const from = Date.parse(certificate.validFrom), until = Date.parse(certificate.validTo);
  await inspectA1Pkcs12(valid, password, { now: new Date(from) });
  for (const time of [from - 1, until, until + 1, NaN]) {
    await assert.rejects(inspectA1Pkcs12(valid, password, { now: new Date(time) }), { code: 'A1_PKCS12_INVALID' });
  }
});

test('native runtime errors, timeout, cancellation and concurrency are bounded and sanitized', linux, async () => {
  await assert.rejects(inspectA1Pkcs12(valid, password, { runtime: { binary: '/missing/private-path/openssl' } }),
    { code: 'A1_INSPECTION_UNAVAILABLE', message: 'Certificate inspection unavailable' });
  await assert.rejects(inspectA1Pkcs12(slow, password, { runtime: { timeoutMs: 5 } }), { code: 'A1_INSPECTION_TIMEOUT' });
  await assert.rejects(inspectA1Pkcs12(valid, password, { signal: AbortSignal.abort() }), { code: 'A1_INSPECTION_ABORTED' });
  const abort = new AbortController();
  const pending = inspectA1Pkcs12(slow, password, { signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, { code: 'A1_INSPECTION_ABORTED' });
  const first = inspectA1Pkcs12(slow, password), second = inspectA1Pkcs12(slow, password);
  await assert.rejects(inspectA1Pkcs12(valid, password), { code: 'A1_INSPECTION_BUSY' });
  await Promise.all([first, second]);
  await inspectA1Pkcs12(valid, password);
});

test('existing encryption core reopens a real synthetic PKCS12 for inspection without returning plaintext', linux, async () => {
  const key = randomBytes(32);
  const vault = new A1VaultEncryption({ active: async () => ({ id: 'synthetic', bytes: Buffer.from(key) }), read: async () => Buffer.from(key) });
  const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222',
    certificateId: '33333333-3333-4333-8333-333333333333', issuerCnpj: '00000000000000' };
  const envelope = await vault.seal(scope, valid, password);
  let seen: Buffer | undefined;
  const result = await vault.use(scope, envelope, async material => {
    seen = material.certificate;
    assert.equal((await inspectA1Pkcs12(material.certificate, material.password)).identityVerified, false);
  });
  assert.equal(result, undefined); assert.ok(seen?.every(byte => byte === 0)); key.fill(0);
});
