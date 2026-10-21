import { constants, createPrivateKey, createPublicKey, sign, timingSafeEqual, X509Certificate } from 'node:crypto';
import { AppError } from '../api/errors.js';
import { runA1Native, type A1NativeRuntime } from './a1NativeProcess.js';
import { validateA1Certificate, type A1CertificateValidation } from './a1CertificateValidation.js';

let running = 0;
function invalid(): never { throw new AppError(422, 'A1_PKCS12_INVALID', 'Invalid certificate container'); }

/** Server-owned configuration only. No path, flags or timeout are taken from an upload. */
type InspectionRuntime = A1NativeRuntime;

async function decode(certificate: Buffer, password: Buffer, runtime: InspectionRuntime, signal?: AbortSignal) {
  const passwordLine = Buffer.alloc(password.length + 1);
  password.copy(passwordLine); passwordLine[password.length] = 10;
  try { return await runA1Native(['pkcs12', '-info', '-noenc', '-passin', 'fd:3'], certificate, [passwordLine], runtime, signal); }
  finally { passwordLine.fill(0); }
}

function blocks(bytes: Buffer, label: string) {
  const begin = Buffer.from(`-----BEGIN ${label}-----`), end = Buffer.from(`-----END ${label}-----`);
  const found: Buffer[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = bytes.indexOf(begin, offset);
    if (start < 0) break;
    const finish = bytes.indexOf(end, start + begin.length);
    if (finish < 0 || found.length >= 16) return invalid();
    found.push(bytes.subarray(start, finish + end.length));
    offset = finish + end.length;
  }
  return found;
}

/** Inspect before sealing with A1VaultEncryption. NOT an authorization, CNPJ, trust-chain or revocation decision.
 * OpenSSL verifies the PKCS#12 MAC; plaintext is confined to pipes/process memory, never temporary files.
 * Native crypto objects/OS pipes may retain copies: buffer wiping is not a guarantee of total memory erasure.
 */
type InspectionOptions = { now?: Date; signal?: AbortSignal; runtime?: InspectionRuntime; validation?: A1CertificateValidation };
async function processContainer(certificate: Buffer, password: Buffer, options: InspectionOptions, signingData?: Buffer) {
  if (!Buffer.isBuffer(certificate) || certificate.length < 1 || certificate.length > 5000000
    || !Buffer.isBuffer(password) || password.length > 4096 || password.includes(0)
    || password.includes(10) || password.includes(13)) return invalid();
  const time = options.now?.getTime() ?? Date.now();
  if (!Number.isFinite(time)) return invalid();
  if (running >= 2) throw new AppError(429, 'A1_INSPECTION_BUSY', 'Certificate inspection busy');
  running++;
  const input = Buffer.from(certificate), secret = Buffer.from(password);
  let decoded: Awaited<ReturnType<typeof decode>> | undefined;
  try {
    decoded = await decode(input, secret, options.runtime ?? {}, options.signal);
    // -info/-noenc uses native MAC verification; a container without a MAC is not accepted.
    const mac = /^MAC: (sha1|sha224|sha256|sha384|sha512), Iteration ([1-9][0-9]*)\r?$/m.exec(decoded.diagnostics.toString('utf8'));
    if (!mac) return invalid();
    const keys = blocks(decoded.output, 'PRIVATE KEY');
    const certificates = blocks(decoded.output, 'CERTIFICATE');
    if (keys.length !== 1 || !certificates.length) return invalid();
    const key = createPrivateKey(keys[0]);
    const publicKey = createPublicKey(key).export({ format: 'der', type: 'spki' });
    const parsed = certificates.map(pem => new X509Certificate(pem));
    const matching = parsed.filter(cert => {
      const candidate = cert.publicKey.export({ format: 'der', type: 'spki' });
      return publicKey.length === candidate.length && timingSafeEqual(publicKey, candidate);
    });
    if (matching.length !== 1 || matching[0].ca || parsed.some(cert => !cert.ca && cert !== matching[0])) return invalid();
    const leaf = matching[0];
    const from = Date.parse(leaf.validFrom), until = Date.parse(leaf.validTo);
    if (!Number.isFinite(from) || !Number.isFinite(until) || time < from || time >= until) return invalid();
    const verification = options.validation
      ? await validateA1Certificate(leaf, parsed.filter(cert => cert !== leaf), options.validation, time, options.runtime ?? {}, options.signal)
      : { identityVerified: false, trustVerified: false, revocationVerified: false, trustStoreVersion: null };
    if (signingData && (!options.validation || !verification.trustVerified || key.asymmetricKeyType !== 'rsa')) return invalid();
    return { fingerprintSha256: leaf.fingerprint256.replaceAll(':', '').toLowerCase(),
      validFrom: new Date(from).toISOString(), validTo: new Date(until).toISOString(),
      keyAlgorithm: key.asymmetricKeyType, macAlgorithm: mac[1], certificateCount: parsed.length,
      ...verification, signature: signingData ? sign('RSA-SHA256', signingData, { key, padding: constants.RSA_PKCS1_PADDING }) : undefined };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return invalid();
  } finally {
    input.fill(0); secret.fill(0); decoded?.output.fill(0); decoded?.diagnostics.fill(0); running--;
  }
}

export async function inspectA1Pkcs12(certificate: Buffer, password: Buffer, options: InspectionOptions = {}) {
  const { signature, ...metadata } = await processContainer(certificate, password, options);
  void signature;
  return metadata;
}

/** Local cryptographic operation only: no arbitrary callback, private material return, file or network submission. */
export async function signValidatedA1Pkcs12(certificate: Buffer, password: Buffer, data: Buffer,
  options: InspectionOptions & { validation: A1CertificateValidation }) {
  if (!Buffer.isBuffer(data) || !data.length || data.length > 1000000) return invalid();
  const payload = Buffer.from(data);
  try {
    const { signature, ...metadata } = await processContainer(certificate, password, options, payload);
    if (!signature) return invalid();
    return { signature, metadata };
  } finally { payload.fill(0); }
}
