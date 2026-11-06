import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import { AppError } from '../api/errors.js';
import { isValidCnpj, normalizeDocumento } from '../db/documentoValidators.js';
import type { A1EncryptedEnvelope } from '../services/a1VaultEncryption.js';

const rowSchema = z.object({ id: z.string().uuid(), group_id: z.string().uuid(), empresa_id: z.string().uuid(),
  operation_id: z.string().uuid(), created_by: z.string().uuid(), issuer_cnpj: z.string(), fingerprint: z.string(),
  valid_from: z.string(), valid_to: z.string(), trust_version: z.string(),
  state: z.enum(['ACTIVE', 'REVOKED_LOCAL', 'SUPERSEDED']), revision: z.string().regex(/^[1-9]\d*$/),
  encrypted_envelope: z.unknown() });
export type A1VaultRow = z.infer<typeof rowSchema>;
const projection = "id,group_id,empresa_id,operation_id,created_by,issuer_cnpj,fingerprint,valid_from::text,valid_to::text,trust_version,state,revision::text,encrypted_envelope";
function scopedRow(raw: unknown, ctx: RequestContext) {
  const row = rowSchema.parse(raw);
  if (row.group_id.toLowerCase() !== ctx.groupId.toLowerCase() || row.empresa_id.toLowerCase() !== ctx.empresaId?.toLowerCase())
    throw new AppError(409, 'A1_CONTEXT_MISMATCH', 'Certificate tenant context mismatch');
  return row;
}
export function a1Metadata(row: A1VaultRow) {
  return { id: row.id, fingerprint: row.fingerprint, validFrom: row.valid_from, validTo: row.valid_to,
    state: row.state, revision: row.revision, trustStoreVersion: row.trust_version };
}

/** Uses only the service transaction executor; never creates a second connection or a storage URL. */
export class PostgresA1VaultRepository {
  async prepare(ctx: RequestContext, q: DbQueryExecutor) {
    const settings = await q.query<{ group_id: string; empresa_id: string }>(
      "SELECT current_setting('app.group_id',true) AS group_id,current_setting('app.empresa_id',true) AS empresa_id");
    if (settings.rows[0]?.group_id !== ctx.groupId || settings.rows[0]?.empresa_id !== ctx.empresaId)
      throw new AppError(403, 'A1_CONTEXT_MISMATCH', 'Certificate tenant context mismatch');
    await q.query("SELECT pg_advisory_xact_lock(hashtextextended('a1:' || $1::text || ':' || $2::text,0))", [ctx.groupId,ctx.empresaId]);
    const company = await q.query<{ cnpj: string | null; status: string }>(
      'SELECT cnpj,status FROM empresas WHERE group_id=$1 AND id=$2 FOR UPDATE', [ctx.groupId,ctx.empresaId]);
    const row = company.rows[0];
    if (!row || row.status !== 'Ativa' || !row.cnpj
      || !/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(row.cnpj) || !isValidCnpj(row.cnpj))
      throw new AppError(409, 'A1_COMPANY_IDENTITY_REQUIRED', 'Active legal company identity required');
    return normalizeDocumento(row.cnpj);
  }
  async active(ctx: RequestContext, q: DbQueryExecutor) {
    const result = await q.query(`SELECT ${projection} FROM a1_certificate_vault
      WHERE group_id=$1 AND empresa_id=$2 AND state='ACTIVE' FOR UPDATE`, [ctx.groupId,ctx.empresaId]);
    return result.rows[0] ? scopedRow(result.rows[0], ctx) : null;
  }
  async get(ctx: RequestContext, q: DbQueryExecutor, id: string) {
    const result = await q.query(`SELECT ${projection} FROM a1_certificate_vault
      WHERE group_id=$1 AND empresa_id=$2 AND id=$3 FOR UPDATE`, [ctx.groupId,ctx.empresaId,id]);
    return result.rows[0] ? scopedRow(result.rows[0], ctx) : null;
  }
  async insert(ctx: RequestContext, q: DbQueryExecutor, data: { id: string; operationId: string; issuerCnpj: string;
    fingerprint: string; validFrom: string; validTo: string; trustVersion: string; envelope: A1EncryptedEnvelope }) {
    const result = await q.query(`INSERT INTO a1_certificate_vault
      (id,group_id,empresa_id,operation_id,issuer_cnpj,fingerprint,valid_from,valid_to,trust_version,encrypted_envelope,state,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'ACTIVE',$11) RETURNING ${projection}`,
      [data.id,ctx.groupId,ctx.empresaId,data.operationId,data.issuerCnpj,data.fingerprint,data.validFrom,data.validTo,
        data.trustVersion,JSON.stringify(data.envelope),ctx.actorId]);
    const row = scopedRow(result.rows[0], ctx);
    if (row.id !== data.id || row.operation_id !== data.operationId || row.created_by !== ctx.actorId
      || row.issuer_cnpj !== data.issuerCnpj || row.fingerprint !== data.fingerprint || row.trust_version !== data.trustVersion
      || row.state !== 'ACTIVE' || row.revision !== '1' || Date.parse(row.valid_from) !== Date.parse(data.validFrom)
      || Date.parse(row.valid_to) !== Date.parse(data.validTo) || !isDeepStrictEqual(row.encrypted_envelope, data.envelope))
      throw new AppError(409, 'A1_STORAGE_CONFLICT', 'Stored certificate differs from the validated certificate');
    return row;
  }
  async change(ctx: RequestContext, q: DbQueryExecutor, row: A1VaultRow, state: A1VaultRow['state'], envelope?: A1EncryptedEnvelope) {
    const result = await q.query(`UPDATE a1_certificate_vault SET state=$5,revision=revision+1,
      encrypted_envelope=COALESCE($6::jsonb,encrypted_envelope)
      WHERE group_id=$1 AND empresa_id=$2 AND id=$3 AND revision=$4::bigint AND state='ACTIVE' RETURNING ${projection}`,
      [ctx.groupId,ctx.empresaId,row.id,row.revision,state,envelope ? JSON.stringify(envelope) : null]);
    if (!result.rows[0]) throw new AppError(409, 'A1_REVISION_CONFLICT', 'Certificate changed; refresh required');
    const after = scopedRow(result.rows[0], ctx);
    const expected = { ...row, state, revision: (BigInt(row.revision) + 1n).toString(), encrypted_envelope: envelope ?? row.encrypted_envelope };
    if (!isDeepStrictEqual(after, expected)) throw new AppError(409, 'A1_STORAGE_CONFLICT', 'Stored certificate changed unexpectedly');
    return after;
  }
}
