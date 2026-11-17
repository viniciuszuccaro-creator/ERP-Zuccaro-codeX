import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { DbClient } from '../db/client.js';
import { PostgresRbacGuard } from '../db/rbacGuard.js';
import { PostgresAuditRepository } from '../audit/auditRepository.js';
import { PostgresA1VaultRepository } from '../repositories/postgresA1VaultRepository.js';
import { A1VaultService } from './a1VaultService.js';
import { A1VaultEncryption } from './a1VaultEncryption.js';
import { A1FileProtectionKeys } from './a1FileProtectionKeys.js';
import type { A1CertificateValidation } from './a1CertificateValidation.js';

const absolute = z.string().max(4096).refine(value => path.isAbsolute(value) && path.normalize(value) === value);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const artifact = z.object({ file: absolute, sha256: digest }).strict();
const configuration = z.object({ version: z.literal(1), keyDirectory: absolute,
  activeKeyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), trust: z.object({
    version: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), roots: artifact, crls: artifact,
    rootFingerprints: z.array(digest).min(1).max(16),
    allowedPolicies: z.array(z.string().regex(/^2\.16\.76\.1\.2\.1\.\d+(?:\.\d+)*$/)).min(1).max(32),
    validUntil: z.string().datetime(), maxCrlAgeMs: z.number().int().positive().max(7*86400000),
    retrievedAt: z.string().datetime().optional(), maxSnapshotAgeMs: z.number().int().positive().max(86400000).optional(),
  }).strict() }).strict();
const unavailable = () => new AppError(503, 'A1_CONFIGURATION_UNAVAILABLE', 'Certificate vault configuration unavailable');

// Only explicit administrator-managed paths. Never follow uploaded AIA/CDP URLs or discover keys.
async function boundedFile(file: string, limit: number) {
  if (process.platform !== 'linux' || !process.getuid || !absolute.safeParse(file).success) throw unavailable();
  const uid = process.getuid();
  let parent = path.dirname(file);
  for (;;) {
    const st = await lstat(parent);
    if (!st.isDirectory() || st.isSymbolicLink() || ![0,uid].includes(st.uid) || (st.mode & 0o022)) throw unavailable();
    if (parent === '/') break;
    parent = path.dirname(parent);
  }
  const handle = await open(file, constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const before=await handle.stat({bigint:true});
    if (!before.isFile() || before.nlink!==1n || before.size<1n || before.size>BigInt(limit)
      || ![0n,BigInt(uid)].includes(before.uid) || (before.mode&0o022n)) throw unavailable();
    const bytes=Buffer.alloc(Number(before.size)+1);
    const {bytesRead}=await handle.read(bytes,0,bytes.length,0);
    const after=await handle.stat({bigint:true});
    if (bytesRead!==Number(before.size) || after.size!==before.size || after.mtimeNs!==before.mtimeNs
      || after.ctimeNs!==before.ctimeNs) throw unavailable();
    return bytes.subarray(0,bytesRead);
  } finally { await handle.close(); }
}

/** Opt-in wiring of the existing vault. No key generation, grants, schema changes or network fetching. */
export async function createConfiguredA1Vault(db: DbClient, file?: string) {
  if (file === undefined) return undefined;
  try {
    const config=configuration.parse(JSON.parse((await boundedFile(file,65536)).toString('utf8')));
    const keys=new A1FileProtectionKeys(config.keyDirectory,config.activeKeyId);
    const active=await keys.active(); active.bytes.fill(0);
    const loadTrust=async (): Promise<A1CertificateValidation['trust']> => {
      const roots=await boundedFile(config.trust.roots.file,131072);
      const crls=await boundedFile(config.trust.crls.file,4000000);
      if (Date.parse(config.trust.validUntil)<=Date.now()
        || ((config.trust.retrievedAt===undefined)!==(config.trust.maxSnapshotAgeMs===undefined))
        || (config.trust.retrievedAt!==undefined && (Date.parse(config.trust.retrievedAt)>Date.now()
          || Date.now()-Date.parse(config.trust.retrievedAt)>config.trust.maxSnapshotAgeMs!))
        || createHash('sha256').update(roots).digest('hex')!==config.trust.roots.sha256
        || createHash('sha256').update(crls).digest('hex')!==config.trust.crls.sha256) throw unavailable();
      return {version:config.trust.version,rootsPem:roots,crlsPem:crls,
        rootFingerprints:config.trust.rootFingerprints,allowedPolicies:config.trust.allowedPolicies,
        validUntil:config.trust.validUntil,maxCrlAgeMs:config.trust.maxCrlAgeMs,
        retrievedAt:config.trust.retrievedAt,maxSnapshotAgeMs:config.trust.maxSnapshotAgeMs};
    };
    await loadTrust();
    // Read-only physical probe; starting the API must never create or import anything.
    const role=(await db.query<{allowed:boolean}>('SELECT NOT rolsuper AND NOT rolbypassrls AS allowed FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!role?.allowed) throw unavailable();
    await db.query('SELECT id,group_id,empresa_id,operation_id,created_by,issuer_cnpj,fingerprint,valid_from,valid_to,trust_version,state,revision,encrypted_envelope FROM a1_certificate_vault WHERE false');
    return new A1VaultService(db,new PostgresRbacGuard(db),new PostgresAuditRepository(db),
      new PostgresA1VaultRepository(),new A1VaultEncryption(keys),loadTrust);
  } catch { throw unavailable(); }
}
