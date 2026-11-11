import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';

const scopeSchema = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(),
  certificateId: z.string().uuid(), issuerCnpj: z.string().regex(/^\d{14}$/) }).strict();
export type A1EncryptionScope = z.infer<typeof scopeSchema>;
const b64 = z.string().max(12_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const envelopeSchema = z.object({ version: z.literal(1), algorithm: z.literal('aes-256-gcm'),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), nonce: b64, tag: b64, ciphertext: b64 }).strict();
export type A1EncryptedEnvelope = z.infer<typeof envelopeSchema>;
/** External KMS/key-file provider. Both methods transfer exclusive buffers for caller erasure; no key material in rows, envelopes or encrypted-object backups. */
export interface A1ProtectionKeys {
  active(): Promise<{ id: string; bytes: Buffer }>;
  read(id: string): Promise<Buffer>;
}
function denied(): never { throw new AppError(422, 'A1_ENCRYPTION_INVALID', 'Certificate protection unavailable or invalid'); }
function aad(scope: A1EncryptionScope) {
  const s = scopeSchema.parse(scope);
  return Buffer.from(JSON.stringify(['ERP_A1_V1', s.groupId, s.empresaId, s.certificateId, s.issuerCnpj]));
}
function validatedKey(bytes: Buffer) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) return denied();
  return bytes;
}

/** Backend encryption primitive, NOT an upload/auth/PKCS#12 validation endpoint. */
export class A1VaultEncryption {
  constructor(private readonly keys: A1ProtectionKeys) {}

  async seal(scope: A1EncryptionScope, certificate: Buffer, password: Buffer): Promise<A1EncryptedEnvelope> {
    let key: Buffer | undefined;
    let packed: Buffer | undefined;
    try {
      const associated = aad(scope);
      if (!Buffer.isBuffer(certificate) || certificate.length < 1 || certificate.length > 5_000_000
        || !Buffer.isBuffer(password) || password.length > 4096) return denied();
      const active = await this.keys.active();
      key = active.bytes;
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(active.id)) return denied();
      key = validatedKey(active.bytes);
      const nonce = randomBytes(12);
      packed = Buffer.alloc(4 + certificate.length + password.length);
      packed.writeUInt32BE(certificate.length, 0);
      certificate.copy(packed, 4); password.copy(packed, 4 + certificate.length);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(associated);
      const encrypted = Buffer.concat([cipher.update(packed), cipher.final()]);
      return { version: 1, algorithm: 'aes-256-gcm', keyId: active.id,
        nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
    } catch { return denied(); }
    finally { key?.fill(0); packed?.fill(0); }
  }

  /** Server-owned operation only; callback return values are discarded. Buffer wiping does not guarantee erasure of all process memory. */
  async use(scope: A1EncryptionScope, raw: unknown, process: (material: { certificate: Buffer; password: Buffer }) => Promise<void>): Promise<void> {
    let key: Buffer | undefined;
    let plain: Buffer | undefined;
    let certificate: Buffer | undefined;
    let password: Buffer | undefined;
    try {
      const envelope = envelopeSchema.parse(raw);
      const associated = aad(scope);
      const nonce = Buffer.from(envelope.nonce, 'base64');
      const tag = Buffer.from(envelope.tag, 'base64');
      const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
      if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 1 || ciphertext.length > 6_700_000) return denied();
      key = await this.keys.read(envelope.keyId);
      key = validatedKey(key);
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(associated); decipher.setAuthTag(tag);
      plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      if (plain.length < 5) return denied();
      const certificateLength = plain.readUInt32BE(0);
      if (certificateLength < 1 || certificateLength > 5_000_000 || certificateLength + 4 > plain.length || plain.length - certificateLength - 4 > 4096) return denied();
      certificate = Buffer.from(plain.subarray(4, 4 + certificateLength));
      password = Buffer.from(plain.subarray(4 + certificateLength));
    } catch {
      certificate?.fill(0); password?.fill(0); key?.fill(0); plain?.fill(0);
      return denied();
    }
    try { await process({ certificate, password }); }
    catch { throw new AppError(503, 'A1_PROCESS_FAILED', 'Certificate process failed'); }
    finally { certificate.fill(0); password.fill(0); key?.fill(0); plain?.fill(0); }
  }

  async rewrap(scope: A1EncryptionScope, envelope: unknown): Promise<A1EncryptedEnvelope> {
    let rotated: A1EncryptedEnvelope | undefined;
    await this.use(scope, envelope, async material => { rotated = await this.seal(scope, material.certificate, material.password); });
    if (!rotated) return denied();
    return rotated;
  }
}
