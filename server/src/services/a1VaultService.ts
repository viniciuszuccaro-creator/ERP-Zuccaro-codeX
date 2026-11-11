import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacAction, RbacGuard } from '../db/rbacGuard.js';
import { PostgresA1VaultRepository, a1Metadata, type A1VaultRow } from '../repositories/postgresA1VaultRepository.js';
import { A1VaultEncryption } from './a1VaultEncryption.js';
import { inspectA1Pkcs12, signValidatedA1Pkcs12 } from './a1Pkcs12Inspection.js';
import type { A1CertificateValidation } from './a1CertificateValidation.js';

const identity = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid(), actorId: z.string().uuid(), requestId: z.string().uuid() });
const revision = z.object({ id: z.string().uuid(), revision: z.string().regex(/^[1-9]\d{0,18}$/) }).strict();
const upload = z.object({ operationId: z.string().uuid(), certificate: z.instanceof(Buffer).refine(b => b.length > 0 && b.length <= 5000000),
  password: z.instanceof(Buffer).refine(b => b.length <= 4096), replaces: revision.optional() }).strict();
function expectedRevision(raw: unknown) {
  const result = revision.safeParse(raw);
  if (!result.success) throw new AppError(422, 'A1_REVISION_INVALID', 'Invalid certificate revision');
  return result.data;
}

/** Canonical backend vault capability; no automatic route mounting, grants, upload trust or download interface. */
export class A1VaultService {
  constructor(private readonly db: DbClient, private readonly rbac: RbacGuard, private readonly audit: AuditRepository,
    private readonly repo: PostgresA1VaultRepository, private readonly encryption: A1VaultEncryption,
    private readonly loadTrust: () => Promise<A1CertificateValidation['trust']>) {}

  private async transaction<T>(raw: RequestContext, action: RbacAction,
    operation: (q: DbQueryExecutor, ctx: RequestContext, cnpj: string, authorize: () => Promise<void>) => Promise<T>) {
    const parsed = identity.safeParse(raw);
    if (!parsed.success || !this.db.withTenantContext)
      throw new AppError(403, 'A1_VERIFIED_CONTEXT_REQUIRED', 'Authenticated legal-company context required');
    if (typeof this.loadTrust !== 'function') throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable');
    const ctx = Object.freeze({ ...raw, ...parsed.data });
    try {
      return await this.db.withTenantContext(ctx, () => this.db.withTransaction(async q => {
        const authorize = () => this.rbac.assertAllowed(ctx, 'Fiscal', 'certificado', action, { allowGlobalWildcard: false, executor: q });
        await authorize();
        const cnpj = await this.repo.prepare(ctx, q);
        const result = await operation(q, ctx, cnpj, authorize);
        await authorize();
        return result;
      }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && 'code' in error && error.code === '23505')
        throw new AppError(409, 'A1_OPERATION_CONFLICT', 'Certificate or operation already recorded');
      throw new AppError(503, 'A1_VAULT_UNAVAILABLE', 'Certificate vault unavailable');
    }
  }
  private scope(ctx: RequestContext, row: Pick<A1VaultRow, 'id' | 'issuer_cnpj'>) {
    return { groupId: ctx.groupId, empresaId: identity.parse(ctx).empresaId, certificateId: row.id, issuerCnpj: row.issuer_cnpj };
  }
  private current(row: A1VaultRow | null, expected: z.infer<typeof revision>) {
    if (!row || row.id !== expected.id || row.revision !== expected.revision || row.state !== 'ACTIVE')
      throw new AppError(409, 'A1_REVISION_CONFLICT', 'Certificate changed; refresh required');
    return row;
  }
  private record(ctx: RequestContext, q: DbQueryExecutor, action: 'create' | 'update' | 'change_status' | 'read',
    row: A1VaultRow, before?: A1VaultRow, verification?: { version: string; snapshotSha256: string }) {
    return this.audit.append({ ...ctx, entity: 'A1CertificateVault', entityId: row.id, action,
      beforeData: before ? a1Metadata(before) : null, afterData: { ...a1Metadata(row), ...(verification ? { verification } : {}) } }, q);
  }
  metadata(ctx: RequestContext) {
    return this.transaction(ctx, 'visualizar', async (q, ctx) => {
      const row = await this.repo.active(ctx, q);
      if (row) await this.record(ctx, q, 'read', row);
      return row ? a1Metadata(row) : null;
    });
  }
  upload(ctx: RequestContext, raw: unknown) {
    const parsed = upload.safeParse(raw);
    if (!parsed.success) throw new AppError(422, 'A1_UPLOAD_INVALID', 'Invalid certificate upload');
    const request = parsed.data;
    const certificate = Buffer.from(request.certificate), password = Buffer.from(request.password);
    return this.transaction(ctx, 'importar', async (q, ctx, cnpj, authorize) => {
      const previous = await this.repo.active(ctx, q);
      if (previous || request.replaces) this.current(previous, request.replaces ?? { id: '', revision: '' });
      const checked = await inspectA1Pkcs12(certificate, password, { validation: { issuerCnpj: cnpj, trust: await this.loadTrust() } });
      if (!checked.identityVerified || !checked.trustVerified || !checked.revocationVerified || !checked.trustStoreVersion)
        throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable');
      await authorize();
      const id = randomUUID();
      const envelope = await this.encryption.seal(this.scope(ctx, { id, issuer_cnpj: cnpj }), certificate, password);
      if (previous) {
        const changed = await this.repo.change(ctx, q, previous, 'SUPERSEDED');
        await this.record(ctx, q, 'change_status', changed, previous);
      }
      const row = await this.repo.insert(ctx, q, { id, operationId: request.operationId, issuerCnpj: cnpj,
        fingerprint: checked.fingerprintSha256, validFrom: checked.validFrom, validTo: checked.validTo,
        trustVersion: checked.trustStoreVersion, envelope });
      if (!('trustSnapshotSha256' in checked) || typeof checked.trustSnapshotSha256 !== 'string')
        throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable');
      await this.record(ctx, q, 'create', row, undefined, { version: checked.trustStoreVersion, snapshotSha256: checked.trustSnapshotSha256 });
      return a1Metadata(row);
    }).finally(() => { certificate.fill(0); password.fill(0); });
  }
  revoke(ctx: RequestContext, raw: unknown) {
    const expected = expectedRevision(raw);
    return this.transaction(ctx, 'revogar', async (q, ctx) => {
      const before = this.current(await this.repo.get(ctx, q, expected.id), expected);
      const after = await this.repo.change(ctx, q, before, 'REVOKED_LOCAL');
      await this.record(ctx, q, 'change_status', after, before); return a1Metadata(after);
    });
  }
  rotate(ctx: RequestContext, raw: unknown) {
    const expected = expectedRevision(raw);
    return this.transaction(ctx, 'rotacionar', async (q, ctx, cnpj) => {
      const before = this.current(await this.repo.get(ctx, q, expected.id), expected);
      if (cnpj !== before.issuer_cnpj) throw new AppError(409, 'A1_COMPANY_CHANGED', 'Legal company identity changed');
      const envelope = await this.encryption.rewrap(this.scope(ctx, before), before.encrypted_envelope);
      const after = await this.repo.change(ctx, q, before, 'ACTIVE', envelope);
      await this.record(ctx, q, 'update', after, before); return a1Metadata(after);
    });
  }
  /** Returns only a local signature AFTER audit and transaction commit. No consumer callback or HTTP signing/download. */
  sign(ctx: RequestContext, raw: unknown, data: Buffer) {
    const expected = expectedRevision(raw);
    if (!Buffer.isBuffer(data) || !data.length || data.length > 1000000)
      throw new AppError(422, 'A1_SIGNING_DATA_INVALID', 'Invalid signing input');
    const payload = Buffer.from(data);
    let signature: Buffer | undefined;
    return this.transaction(ctx, 'usar', async (q, ctx, cnpj, authorize) => {
      const row = this.current(await this.repo.get(ctx, q, expected.id), expected);
      if (cnpj !== row.issuer_cnpj) throw new AppError(409, 'A1_COMPANY_CHANGED', 'Legal company identity changed');
      const trust = await this.loadTrust();
      let verification: { version: string; snapshotSha256: string } | undefined;
      await this.encryption.use(this.scope(ctx, row), row.encrypted_envelope, async material => {
        await authorize();
        const signed = await signValidatedA1Pkcs12(material.certificate, material.password, payload, { validation: { issuerCnpj: cnpj, trust } });
        signature = signed.signature;
        const checked = signed.metadata;
        if (checked.fingerprintSha256 !== row.fingerprint || Date.parse(checked.validFrom) !== Date.parse(row.valid_from)
          || Date.parse(checked.validTo) !== Date.parse(row.valid_to))
          throw new AppError(409, 'A1_CERTIFICATE_CHANGED', 'Stored certificate metadata mismatch');
        if (!checked.trustVerified || !checked.revocationVerified || !checked.identityVerified || !checked.trustStoreVersion
          || !('trustSnapshotSha256' in checked) || typeof checked.trustSnapshotSha256 !== 'string')
          throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable');
        verification = { version: checked.trustStoreVersion, snapshotSha256: checked.trustSnapshotSha256 };
      });
      if (!verification) throw new AppError(503, 'A1_TRUST_UNAVAILABLE', 'Certificate trust configuration unavailable');
      await this.audit.append({ ...ctx, entity: 'A1CertificateSignature', entityId: row.id, action: 'create',
        afterData: { certificate: a1Metadata(row), verification, operation: 'sign', algorithm: 'RSA-SHA256',
          payloadSha256: createHash('sha256').update(payload).digest('hex') } }, q);
      if (!signature) throw new AppError(503, 'A1_SIGNING_UNAVAILABLE', 'Certificate signing unavailable');
      return { certificateId: row.id, fingerprint: row.fingerprint, revision: row.revision, algorithm: 'RSA-SHA256', signature };
    }).catch(error => { signature?.fill(0); throw error; }).finally(() => payload.fill(0));
  }
}
