import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { A1VaultEncryption } from '../src/services/a1VaultEncryption.ts';

const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222',
  certificateId: '33333333-3333-4333-8333-333333333333', issuerCnpj: '00000000000000' };
function fixture() {
  const keys = new Map([['key_a', randomBytes(32)], ['key_b', randomBytes(32)]]);
  let active = 'key_a';
  const vault = new A1VaultEncryption({ active: async () => ({ id: active, bytes: Buffer.from(keys.get(active)!) }), read: async id => {
    const value = keys.get(id); if (!value) throw new Error('PRIVATE_KEY_PATH'); return Buffer.from(value);
  } });
  return { vault, keys, rotate() { active = 'key_b'; } };
}
const certificate = Buffer.from('SYNTHETIC-ENCRYPTION-ONLY-NOT-PKCS12');
const password = Buffer.from('SYNTHETIC_PRIVATE_PASSWORD');

test('exclusive protection-key buffers are erased after seal, use and invalid provider results', async () => {
  const stored = randomBytes(32);
  const issued: Buffer[] = [];
  const issue = () => { const bytes = Buffer.from(stored); issued.push(bytes); return bytes; };
  const vault = new A1VaultEncryption({ active: async () => ({ id: 'synthetic', bytes: issue() }), read: async () => issue() });
  const envelope = await vault.seal(scope, certificate, password);
  assert.ok(issued[0].every(byte => byte === 0));
  await vault.use(scope, envelope, async material => assert.deepEqual(material.certificate, certificate));
  assert.ok(issued[1].every(byte => byte === 0));
  const invalid = issue();
  await assert.rejects(new A1VaultEncryption({ active: async () => ({ id: '../invalid', bytes: invalid }), read: async () => issue() })
    .seal(scope, certificate, password));
  assert.ok(invalid.every(byte => byte === 0));
  const short = Buffer.alloc(31, 42);
  await assert.rejects(new A1VaultEncryption({ active: async () => ({ id: 'short', bytes: short }), read: async () => short })
    .seal(scope, certificate, password));
  assert.ok(short.every(byte => byte === 0));
  stored.fill(0);
});

test('envelope has no password/certificate/key; random nonces and exact authorized recovery', async () => {
  const f = fixture();
  const a = await f.vault.seal(scope, certificate, password);
  const b = await f.vault.seal(scope, certificate, password);
  assert.notEqual(a.nonce, b.nonce); assert.notEqual(a.ciphertext, b.ciphertext);
  for (const secret of [password.toString(), certificate.toString(), password.toString('base64'), f.keys.get('key_a')!.toString('base64')]) {
    assert.ok(!JSON.stringify(a).includes(secret));
  }
  let held: Buffer | undefined;
  await f.vault.use(scope, a, async material => {
    assert.deepEqual(material.certificate, certificate); assert.deepEqual(material.password, password); held = material.password;
  });
  assert.ok(held?.every(byte => byte === 0));
  assert.equal(password.toString(), 'SYNTHETIC_PRIVATE_PASSWORD');
});

test('tenant, company, certificate and issuer bindings authenticate without exposing raw errors', async () => {
  const f = fixture(), envelope = await f.vault.seal(scope, certificate, password);
  for (const change of [{ empresaId: scope.groupId }, { groupId: scope.empresaId }, { certificateId: scope.groupId }, { issuerCnpj: '11111111111111' }]) {
    await assert.rejects(f.vault.use({ ...scope, ...change }, envelope, async () => assert.fail('must not release')),
      error => error instanceof Error && error.message === 'Certificate protection unavailable or invalid');
  }
  for (const tampered of [{ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA` }, { ...envelope, keyId: 'other' },
    { ...envelope, nonce: '' }, { ...envelope, version: 2 }]) {
    await assert.rejects(f.vault.use(scope, tampered, async () => assert.fail('must not release')));
  }
});

test('rewrap supports separately protected backup keys and preserves certificate; process failure wipes buffers', async () => {
  const f = fixture(), original = await f.vault.seal(scope, certificate, password);
  f.rotate(); const rotated = await f.vault.rewrap(scope, original);
  assert.equal(original.keyId, 'key_a'); assert.equal(rotated.keyId, 'key_b');
  await f.vault.use(scope, rotated, async material => assert.deepEqual(material.certificate, certificate));
  let held: Buffer | undefined;
  await assert.rejects(f.vault.use(scope, original, async material => { held = material.certificate; throw new Error('PRIVATE_PROCESS_SECRET'); }),
    error => error instanceof Error && error.message === 'Certificate process failed');
  assert.ok(held?.every(byte => byte === 0));
  f.keys.delete('key_a');
  await assert.rejects(f.vault.use(scope, original, async () => assert.fail('retired key')));
  await f.vault.use(scope, rotated, async material => assert.deepEqual(material.password, password));
});

test('untyped callback cannot expose its return value and binary material does not pass through JSON/text serialization', async () => {
  const f = fixture(), binary = Buffer.from([0, 255, 17, 0, 128]);
  const encrypted = await f.vault.seal(scope, binary, Buffer.alloc(0));
  const result = await Reflect.apply(f.vault.use, f.vault, [scope, encrypted,
    async (material: { certificate: Buffer; password: Buffer }) => {
      assert.deepEqual(material.certificate, binary); assert.equal(material.password.length, 0);
      return material.certificate.toString('base64');
    }]);
  assert.equal(result, undefined);
});
