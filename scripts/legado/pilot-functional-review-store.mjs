import { buildAssistedReviewRecord, prepareAssistedReviewProposal } from './pilot-functional-review-record.mjs';
import { rowHash } from './pilot-functional-policy.mjs';
import { isValidCpf, isValidCnpj } from '../../src/api/localCadastroMasterPolicy.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token = value => typeof value === 'string' && /^[a-z0-9_.:-]{1,80}$/i.test(value);
const reasons = new Set(['DOCUMENTO_ESTRUTURAL_PENDENTE', 'DOCUMENTO_REPETIDO_FONTE',
  'DOCUMENTO_INVALIDO', 'SITUACAO_FORA_ESCOPO_ATIVO']);
const states = new Set(['At', 'Po', 'In']);
const reject = code => { throw new Error(code); };

function captureScope(scope) {
  if (scope?.scopeType !== 'grupo' || scope.empresaId != null || !uuid(scope.groupId)
      || !uuid(scope.actorId) || !token(scope.requestId)) reject('REVIEW_GROUP_SCOPE_REQUIRED');
  return { groupId: scope.groupId, empresaId: null, actorId: scope.actorId, requestId: scope.requestId, scopeType: 'grupo' };
}

function selectRecord(q, ctx, sourceSystem, nativeKey) {
  return q.query(`SELECT id, source_fingerprint, record, archived, correction->>'status' AS correction_status FROM legacy_client_review
    WHERE group_id=$1 AND source_system=$2 AND native_key=$3`, [ctx.groupId, sourceSystem, nativeKey]);
}

export async function saveAssistedClientDocumentCorrection(identity, command, scope, { db, audit, rbac }) {
  const ctx = captureScope(scope);
  const { sourceSystem, nativeKey } = identity ?? {};
  const draft = structuredClone(command);
  if (!token(sourceSystem) || !token(nativeKey)) reject('REVIEW_IDENTITY_REQUIRED');
  const value = draft?.proposedValue;
  if (!(draft?.field === 'cpf' && typeof value === 'string' && /^\d{11}$/.test(value) && isValidCpf(value))
      && !(draft?.field === 'cnpj' && typeof value === 'string' && /^\d{14}$/.test(value) && isValidCnpj(value)))
    reject('REVIEW_CANONICAL_DOCUMENT_REQUIRED');
  return db.withTenantContext(ctx, () => db.withTransaction(async q => {
    for (const action of ['importar', 'editar']) await authorize(rbac, ctx, action, q);
    const result = await q.query(`SELECT id, record, correction, archived FROM legacy_client_review
      WHERE group_id=$1 AND source_system=$2 AND native_key=$3 FOR UPDATE`, [ctx.groupId, sourceSystem, nativeKey]);
    const saved = result.rows[0];
    if (saved?.record.status !== 'REVIEW_REQUIRED' || saved.archived) reject('REVIEW_CORRECTION_NOT_AVAILABLE');
    const proposal = await prepareAssistedReviewProposal(saved.record, draft, {
      context: ctx, rbacGuard: { assertAllowed: (_scope, _module, _entity, action) => authorize(rbac, ctx, action, q) },
    });
    if (saved.correction) {
      if (saved.correction.commandHash !== proposal.commandHash) reject('REVIEW_CORRECTION_CONFLICT');
      return { id: saved.id, replayed: true, status: proposal.status };
    }
    const updated = await q.query(`UPDATE legacy_client_review SET correction=$3::jsonb
      WHERE id=$1 AND group_id=$2 AND correction IS NULL AND NOT archived RETURNING id`, [saved.id, ctx.groupId, JSON.stringify(proposal)]);
    if (updated.rowCount !== 1) reject('REVIEW_CORRECTION_CONFLICT');
    await audit.append({ ...ctx, entity: 'LegacyClientReview', entityId: saved.id, action: 'update',
      afterData: { field: proposal.field, commandHash: proposal.commandHash, status: proposal.status } }, q);
    for (const action of ['importar', 'editar']) await authorize(rbac, ctx, action, q);
    return { id: saved.id, replayed: false, status: proposal.status };
  }));
}

const authorize = (rbac, ctx, action, q) =>
  rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { executor: q, allowGlobalWildcard: false });

export async function stageAssistedClientReview(input, scope, { db, audit, rbac }) {
  const ctx = captureScope(scope);
  const { nativeKey, cpf, cnpj, sourceStatus, reason, sourceIndex } = input ?? {};
  const provenance = structuredClone(input?.provenance);
  if (!token(nativeKey) || !token(provenance?.sourceSystem) || !reasons.has(reason) || !states.has(sourceStatus)
      || (sourceStatus === 'At') === (reason === 'SITUACAO_FORA_ESCOPO_ATIVO')
      || ![cpf, cnpj].every(value => typeof value === 'string' && value.length <= 200)) reject('REVIEW_INTAKE_INVALID');
  const sourceSystem = provenance.sourceSystem;
  const original = { codigo_legado: nativeKey, cpf, cnpj, status: sourceStatus };
  const record = { ...buildAssistedReviewRecord({
    entity: 'cliente', sourceIndex, original, provenance, context: ctx,
    evidence: { scopeVerified: true, canonicalValidated: false,
      reconciled: false, imported: false, historyOnly: sourceStatus === 'In',
      issues: [{ field: 'documento', reason, critical: true, blocks: ['cadastro.utilizar', 'fiscal.emitir'] }] },
  }), sourceStatus };
  const fingerprint = rowHash({ original, reason, provenance, sourceIndex });
  return db.withTenantContext(ctx, () => db.withTransaction(async q => {
    await authorize(rbac, ctx, 'importar', q);
    const inserted = await q.query(`INSERT INTO legacy_client_review
      (group_id,source_system,native_key,source_fingerprint,record) VALUES ($1,$2,$3,$4,$5::jsonb)
      ON CONFLICT (group_id,source_system,native_key) DO NOTHING RETURNING id`,
    [ctx.groupId, sourceSystem, nativeKey, fingerprint, JSON.stringify(record)]);
    const id = inserted.rows[0]?.id;
    if (!id) {
      const known = (await selectRecord(q, ctx, sourceSystem, nativeKey)).rows[0];
      if (known?.source_fingerprint !== fingerprint) reject('REVIEW_SOURCE_CONFLICT');
      if (known.archived) reject('REVIEW_SOURCE_ARCHIVED');
      return { id: known.id, replayed: true, fingerprint };
    }
    await audit.append({ ...ctx, entity: 'LegacyClientReview', entityId: id, action: 'create',
      afterData: { fingerprint, sourceStatus, reason, status: record.status } }, q);
    await authorize(rbac, ctx, 'importar', q);
    return { id, replayed: false, fingerprint };
  }));
}

export async function reopenAssistedClientReview(identity, scope, { db, rbac }) {
  const ctx = captureScope(scope);
  const { sourceSystem, nativeKey } = identity ?? {};
  if (!token(sourceSystem) || !token(nativeKey)) reject('REVIEW_IDENTITY_REQUIRED');
  return db.withTenantContext(ctx, () => db.withTransaction(async q => {
    await authorize(rbac, ctx, 'visualizar', q);
    await authorize(rbac, ctx, 'importar', q);
    const found = (await selectRecord(q, ctx, sourceSystem, nativeKey)).rows[0];
    if (!found || found.archived) return null;
    // Existing renderer masks protected fields; do not return their raw values.
    return { id: found.id, correctionStatus: found.correction_status, record: { ...found.record, fields: found.record.fields.map(field => {
      if (!field.protected) return field;
      const { original: _original, ...masked } = field;
      return masked;
    }) } };
  }));
}

export async function archiveAssistedClientReview(input, scope, { db, audit, rbac }) {
  const ctx = captureScope(scope);
  const { sourceSystem, nativeKey, id, fingerprint } = input ?? {};
  if (!token(sourceSystem) || !token(nativeKey) || !uuid(id) || typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint))
    reject('REVIEW_ARCHIVE_RECEIPT_REQUIRED');
  return db.withTenantContext(ctx, () => db.withTransaction(async q => {
    await authorize(rbac, ctx, 'inativar', q);
    const found = (await q.query(`SELECT id, source_fingerprint, archived, correction IS NOT NULL AS has_correction
      FROM legacy_client_review WHERE group_id=$1 AND source_system=$2 AND native_key=$3 FOR UPDATE`,
    [ctx.groupId, sourceSystem, nativeKey])).rows[0];
    if (found?.id !== id || found.source_fingerprint !== fingerprint) reject('REVIEW_ARCHIVE_RECEIPT_MISMATCH');
    if (found.has_correction) reject('REVIEW_ARCHIVE_POSTIMAGE_CHANGED');
    if (found.archived) return { id, replayed: true };
    const result = await q.query(`UPDATE legacy_client_review SET archived=true
      WHERE id=$1 AND group_id=$2 AND NOT archived AND correction IS NULL RETURNING id`, [id, ctx.groupId]);
    if (result.rowCount !== 1) reject('REVIEW_ARCHIVE_POSTIMAGE_CHANGED');
    await audit.append({ ...ctx, entity: 'LegacyClientReview', entityId: id, action: 'inactivate',
      afterData: { fingerprint, archived: true } }, q);
    await authorize(rbac, ctx, 'inativar', q);
    return { id, replayed: false };
  }));
}
