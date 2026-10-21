import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readlink, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { A1FileProtectionKeys } from '../src/services/a1FileProtectionKeys.ts';
import { A1VaultEncryption } from '../src/services/a1VaultEncryption.ts';
import { AppError } from '../src/api/errors.ts';

const linux = { skip: process.platform !== 'linux' };
const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222',
  certificateId: '33333333-3333-4333-8333-333333333333', issuerCnpj: '00000000000000' };
async function fixture(run: (directory: string, key: Buffer) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'erp-a1-keys-synthetic-'));
  const key = randomBytes(32);
  try {
    await chmod(directory, 0o700);
    await writeFile(join(directory, 'old.key'), key, { mode: 0o400 });
    await run(directory, key);
  } finally { key.fill(0); await rm(directory, { recursive: true, force: true }); }
}
function hidden(error: unknown) {
  assert.ok(error instanceof AppError);
  assert.equal(error.code, 'A1_PROTECTION_KEY_UNAVAILABLE');
  assert.equal(error.statusCode, 503);
  assert.equal(error.message, 'Certificate protection key unavailable');
  assert.equal(error.details, undefined);
  return true;
}

test('external key files return independent buffers, do not cache and do not expose paths on failure', linux, async () => fixture(async (dir, key) => {
  const provider = new A1FileProtectionKeys(dir, 'old');
  const a = await provider.active(), b = await provider.read('old');
  assert.equal(a.id, 'old'); assert.deepEqual(a.bytes, key); assert.deepEqual(b, key);
  a.bytes.fill(0); assert.deepEqual(b, key); b.fill(0);
  await assert.rejects(provider.read('missing'), hidden);
  await rm(join(dir, 'old.key'));
  await assert.rejects(provider.active(), hidden);
}));

test('key ids and noncanonical or relative configuration cannot escape the secret mount', linux, async () => fixture(async (dir) => {
  const provider = new A1FileProtectionKeys(dir, 'old');
  for (const id of ['', '../old', 'old.key', '/old', 'a/b', 'a\\b', 'a'.repeat(81)]) await assert.rejects(provider.read(id), hidden);
  for (const path of ['relative', `${dir}/../`, `${dir}//`, '/']) await assert.rejects(new A1FileProtectionKeys(path, 'old').active(), hidden);
  await assert.rejects(new A1FileProtectionKeys(dir, '../old').read('old'), hidden);
}));

test('group or world permissions on key directory and keys fail closed', linux, async () => fixture(async (dir) => {
  for (const mode of [0o600, 0o640, 0o604, 0o660, 0o700]) {
    await chmod(join(dir, 'old.key'), mode);
    await assert.rejects(new A1FileProtectionKeys(dir, 'old').active(), hidden);
  }
  await chmod(join(dir, 'old.key'), 0o400);
  for (const mode of [0o750, 0o705, 0o777]) {
    await chmod(dir, mode);
    await assert.rejects(new A1FileProtectionKeys(dir, 'old').active(), hidden);
  }
}));

test('symlink files, symlink ancestors, hardlinks and directories cannot supply key material', linux, async () => fixture(async (dir) => {
  await symlink(join(dir, 'old.key'), join(dir, 'alias.key'));
  await assert.rejects(new A1FileProtectionKeys(dir, 'alias').active(), hidden);
  await mkdir(join(dir, 'nested'), { mode: 0o700 });
  await symlink(dir, join(dir, 'nested', 'alias'));
  await assert.rejects(new A1FileProtectionKeys(join(dir, 'nested', 'alias'), 'old').active(), hidden);
  await link(join(dir, 'old.key'), join(dir, 'hard.key'));
  await assert.rejects(new A1FileProtectionKeys(dir, 'old').active(), hidden);
  await mkdir(join(dir, 'folder.key'), { mode: 0o700 });
  await assert.rejects(new A1FileProtectionKeys(dir, 'folder').active(), hidden);
}));

test('only exact 32-byte binary keys are accepted, no base64 or truncated reads', linux, async () => fixture(async (dir) => {
  for (const size of [0, 31, 33, 1_000_000]) {
    await writeFile(join(dir, `bad_${size}.key`), Buffer.alloc(size, 65), { mode: 0o400 });
    await assert.rejects(new A1FileProtectionKeys(dir, `bad_${size}`).active(), hidden);
  }
}));

test('real file-key rotation rewraps without modifying old envelopes; missing old key denies recovery', linux, async () => fixture(async (dir) => {
  const certificate = Buffer.from('SYNTHETIC-ENCRYPTION-NOT-PKCS12'), password = Buffer.from('SYNTHETIC');
  const old = new A1VaultEncryption(new A1FileProtectionKeys(dir, 'old'));
  const envelope = await old.seal(scope, certificate, password);
  const fresh = randomBytes(32);
  await writeFile(join(dir, 'new.key'), fresh, { mode: 0o400 }); fresh.fill(0);
  const current = new A1VaultEncryption(new A1FileProtectionKeys(dir, 'new'));
  const rotated = await current.rewrap(scope, envelope);
  assert.equal(envelope.keyId, 'old'); assert.equal(rotated.keyId, 'new');
  await rm(join(dir, 'old.key'));
  await assert.rejects(current.use(scope, envelope, async () => assert.fail('no key')));
  await current.use(scope, rotated, async material => assert.deepEqual(material.certificate, certificate));
}));

test('repeated denial releases all descriptors referencing the secret directory', linux, async () => fixture(async (dir) => {
  for (let n = 0; n < 40; n++) await assert.rejects(new A1FileProtectionKeys(dir, 'missing').active(), hidden);
  for (const fd of await readdir('/proc/self/fd')) {
    let target: string;
    try { target = await readlink(`/proc/self/fd/${fd}`); } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
    assert.ok(!target.startsWith(dir));
  }
}));
