import { createHash, X509Certificate } from 'node:crypto';
import { chmod, mkdtemp, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AsnParser } from '@peculiar/asn1-schema';
import { Certificate, CertificateList, CertificatePolicies, KeyUsage, SubjectAlternativeName } from '@peculiar/asn1-x509';
import { fromBER, OctetString, PrintableString } from 'asn1js';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import { isValidCnpj } from '../db/documentoValidators.js';
import { runA1Native, type A1NativeRuntime } from './a1NativeProcess.js';

/** Loaded by backend configuration, NEVER from an uploaded container or a request body. */
export type A1CertificateValidation = {
  issuerCnpj: string;
  trust: {
    version: string;
    rootsPem: Buffer;
    rootFingerprints: string[];
    crlsPem: Buffer;
    allowedPolicies: string[];
    validUntil: string;
    maxCrlAgeMs: number;
  };
};
const schema = z.object({ issuerCnpj: z.string().regex(/^\d{14}$/), trust: z.object({
  version: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  rootsPem: z.instanceof(Buffer).refine(value => value.length > 0 && value.length <= 131072),
  rootFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(16),
  crlsPem: z.instanceof(Buffer).refine(value => value.length > 0 && value.length <= 4000000),
  allowedPolicies: z.array(z.string().regex(/^2\.16\.76\.1\.2\.1\.\d+(?:\.\d+)*$/)).min(1).max(32),
  validUntil: z.string().datetime(), maxCrlAgeMs: z.number().int().min(1).max(7 * 86400000),
}).strict() }).strict();
const parserOptions = { berOptions: { maxDepth: 32, maxNodes: 20000, maxContentLength: 4000000 } };
function rejected(): never { throw new AppError(422, 'A1_CERTIFICATE_REJECTED', 'Certificate identity or trust validation failed'); }
function missingTrust(): never { throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable'); }
function pemBlocks(bytes: Buffer, label: string, max: number) {
  const text = bytes.toString('ascii');
  const pattern = new RegExp(`-----BEGIN ${label}-----[\\sA-Za-z0-9+/=]+-----END ${label}-----`, 'g');
  const items = text.match(pattern) ?? [];
  if (!items.length || items.length > max || text.replace(pattern, '').trim()) return missingTrust();
  return items;
}

/** Reads the designated SAN otherName only. CN, serialNumber and adjacent OIDs are not identity sources. */
function assertIdentity(leaf: X509Certificate, expected: string, allowedPolicies: string[]) {
  if (!/^\d{14}$/.test(expected) || !isValidCnpj(expected)) return rejected();
  const parsed = AsnParser.parse(leaf.raw, Certificate, parserOptions);
  const extensions = parsed.tbsCertificate.extensions ?? [];
  const unique = (oid: string) => {
    const found = extensions.filter(extension => extension.extnID === oid);
    if (found.length !== 1) return rejected();
    return found[0];
  };
  const san = unique('2.5.29.17');
  const names = AsnParser.parse(san.extnValue.buffer, SubjectAlternativeName, parserOptions);
  const identities = names.filter(name => name.otherName?.typeId === '2.16.76.1.3.3');
  if (identities.length !== 1) return rejected();
  const other = identities[0].otherName;
  if (!other) return rejected();
  const value = fromBER(other.value, parserOptions.berOptions);
  if (value.offset !== other.value.byteLength) return rejected();
  let cnpj: string;
  if (value.result instanceof PrintableString) cnpj = value.result.valueBlock.value;
  else if (value.result instanceof OctetString && !value.result.idBlock.isConstructed) {
    const bytes = value.result.valueBlock.valueHexView;
    if (bytes.some(byte => byte < 48 || byte > 57)) return rejected();
    cnpj = Buffer.from(bytes).toString('ascii');
  }
  else return rejected();
  if (!/^\d{14}$/.test(cnpj) || !isValidCnpj(cnpj) || cnpj !== expected) return rejected();
  const policies = AsnParser.parse(unique('2.5.29.32').extnValue.buffer, CertificatePolicies, parserOptions);
  if (!policies.some(policy => allowedPolicies.includes(policy.policyIdentifier))) return rejected();
  const usage = AsnParser.parse(unique('2.5.29.15').extnValue.buffer, KeyUsage, parserOptions);
  if (!usage.toJSON().includes('digitalSignature') || leaf.ca) return rejected();
}

export function assertA1CnpjIdentity(leaf: X509Certificate, expected: string, allowedPolicies: string[]) {
  try { assertIdentity(leaf, expected, allowedPolicies); } catch { return rejected(); }
}

/** Offline verification with fresh, signed CRLs for the full chain; no AIA/CDP network access or system trust fallback. */
export async function validateA1Certificate(leaf: X509Certificate, chain: X509Certificate[], raw: A1CertificateValidation,
  now: number, runtime: A1NativeRuntime, signal?: AbortSignal) {
  const policy = schema.safeParse(raw);
  if (!policy.success || !Number.isSafeInteger(now) || now <= 0) return missingTrust();
  const { issuerCnpj, trust } = policy.data;
  if (Date.parse(trust.validUntil) <= now) return missingTrust();
  const roots = Buffer.from(trust.rootsPem), crls = Buffer.from(trust.crlsPem);
  let verification: Awaited<ReturnType<typeof runA1Native>> | undefined;
  let directory: string | undefined;
  try {
    const anchors = pemBlocks(roots, 'CERTIFICATE', 16).map(pem => new X509Certificate(pem));
    const fingerprints = anchors.map(cert => cert.fingerprint256.replaceAll(':', '').toLowerCase());
    if (new Set(fingerprints).size !== anchors.length || fingerprints.length !== trust.rootFingerprints.length
      || fingerprints.some(hash => !trust.rootFingerprints.includes(hash))
      || anchors.some(cert => !cert.ca || !cert.checkIssued(cert) || !cert.verify(cert.publicKey))) return missingTrust();
    for (const pem of pemBlocks(crls, 'X509 CRL', 32)) {
      const der = Buffer.from(pem.replace(/-----[^\n]+-----|\s/g, ''), 'base64');
      const list = AsnParser.parse(der, CertificateList, parserOptions).tbsCertList;
      const start = list.thisUpdate.getTime().getTime(), end = list.nextUpdate?.getTime().getTime();
      if (!Number.isFinite(start) || end === undefined || !Number.isFinite(end) || start > now
        || end <= now || end <= start || now - start > trust.maxCrlAgeMs) return missingTrust();
    }
    assertA1CnpjIdentity(leaf, issuerCnpj, trust.allowedPolicies);
    const intermediates = Buffer.from(chain.map(cert => cert.toString()).join('\n'));
    // OpenSSL file loaders cannot reopen Node socket-backed pipes as /proc/self/fd files.
    // Only public CA certificates/CRLs enter this private tmpfs; never a key, password, leaf or PKCS12.
    if ((await statfs(tmpdir())).type !== 0x01021994) return missingTrust();
    directory = await mkdtemp(join(tmpdir(), 'erp-a1-public-trust-'));
    await chmod(directory, 0o700);
    const rootPath = join(directory, 'roots.pem'), crlPath = join(directory, 'crls.pem');
    await writeFile(rootPath, roots, { flag: 'wx', mode: 0o600 });
    await writeFile(crlPath, crls, { flag: 'wx', mode: 0o600 });
    const args = ['verify', '-no-CAfile', '-no-CApath', '-no-CAstore', '-trusted', rootPath,
      '-CRLfile', crlPath, '-crl_check_all', '-x509_strict', '-check_ss_sig', '-purpose', 'sslclient',
      '-auth_level', '2', '-verify_depth', '8', '-attime', String(Math.floor(now / 1000))];
    if (intermediates.length) {
      const chainPath = join(directory, 'intermediates.pem');
      await writeFile(chainPath, intermediates, { flag: 'wx', mode: 0o600 });
      args.push('-untrusted', chainPath);
    }
    verification = await runA1Native(args, Buffer.from(leaf.toString()), [], runtime, signal);
    const trustSnapshotSha256 = createHash('sha256').update(JSON.stringify({ version: trust.version,
      roots: createHash('sha256').update(roots).digest('hex'), crls: createHash('sha256').update(crls).digest('hex'),
      pins: trust.rootFingerprints, policies: trust.allowedPolicies, until: trust.validUntil, maxAge: trust.maxCrlAgeMs })).digest('hex');
    return { identityVerified: true, trustVerified: true, revocationVerified: true, trustStoreVersion: trust.version, trustSnapshotSha256 };
  } catch (error) {
    if (error instanceof AppError && error.statusCode !== 422) throw error;
    return rejected();
  } finally {
    roots.fill(0); crls.fill(0); verification?.output.fill(0); verification?.diagnostics.fill(0);
    if (directory) { try { await rm(directory, { recursive: true }); } catch { missingTrust(); } }
  }
}
