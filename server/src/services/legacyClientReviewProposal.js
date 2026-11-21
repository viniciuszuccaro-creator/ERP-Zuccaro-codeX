import { createHash } from 'node:crypto';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => { throw new Error(code); };
const rowHash = value => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');

export function normalizeReviewField(field, original) {
  if (typeof original !== 'string') return { proposed: null, rule: null };
  if (field === 'cep' && /^\s*\d{2}\.?\d{3}-?\d{3}\s*$/.test(original)) {
    const proposed = original.replace(/[.\-\s]/g, '');
    return { proposed: proposed === original ? null : proposed, rule: 'CEP_PRESENTATION_ONLY' };
  }
  if (['uf', 'estado'].includes(field) && /^\s*[a-zA-Z]{2}\s*$/.test(original)) {
    const proposed = original.trim().toUpperCase();
    return { proposed: proposed === original ? null : proposed, rule: 'UF_CASE_PRESENTATION_ONLY' };
  }
  return { proposed: null, rule: null };
}

/** Consumes an untrusted draft; no master write, permission grant or automatic release. */
export async function prepareAssistedReviewProposal(record, command, { context, rbacGuard, isAllowedField } = {}) {
  record = structuredClone(record);
  command = structuredClone(command);
  context = structuredClone(context);
  const allowed = ['operationId', 'expectedSourceFingerprint', 'field', 'proposedValue', 'reason', 'evidenceRefs'];
  if (!record || !command || typeof command !== 'object' || Array.isArray(command)
      || Object.keys(command).some(key => !allowed.includes(key)) || !uuid(command.operationId)
      || !uuid(context?.actorId) || record.context.groupId !== context.groupId
      || record.context.empresaId !== (context.empresaId ?? null) || !rbacGuard?.assertAllowed)
    fail('REVIEW_AUTHORIZED_CONTEXT_REQUIRED');
  if (command.expectedSourceFingerprint !== record.sourceFingerprint) fail('REVIEW_SOURCE_CHANGED');
  const field = record.fields.find(item => item.name === command.field);
  if (!field || !isAllowedField?.(command.field)) fail('REVIEW_FIELD_DENIED');
  if (field.originalPresent && field.original === command.proposedValue) fail('REVIEW_NO_CHANGE');
  if (typeof command.proposedValue !== 'string' || !command.proposedValue.trim() || command.proposedValue.length > 500
      || typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500)
    fail('REVIEW_EXPLICIT_VALUE_AND_REASON_REQUIRED');
  const entity = record.entity.replace('endereco-', '');
  for (const action of ['importar', 'editar']) await rbacGuard.assertAllowed(context, 'Cadastros', entity, action, { allowGlobalWildcard: false });
  const normalization = normalizeReviewField(command.field, field.original);
  const formatOnly = normalization.rule != null && normalization.proposed === command.proposedValue;
  const refs = command.evidenceRefs;
  if (!Array.isArray(refs) || (!formatOnly && refs.length === 0)
      || refs.some(ref => !ref || typeof ref.ref !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(ref.ref) || !hash(ref.sha256)))
    fail('REVIEW_MEANING_CHANGE_EVIDENCE_REQUIRED');
  const proposal = { operationId: command.operationId, key: record.key, context: record.context,
    sourceFingerprint: record.sourceFingerprint, provenance: record.provenance, field: field.name,
    originalPresent: field.originalPresent, ...(field.originalPresent ? { originalValue: field.original } : {}),
    proposedValue: command.proposedValue, reason: command.reason, evidenceRefs: structuredClone(refs),
    kind: formatOnly ? 'FORMAT_ONLY' : 'MEANING_CHANGE', rule: formatOnly ? normalization.rule : null,
    status: 'PENDING_CANONICAL_REVALIDATION', applied: false, operationalAuthorized: false,
    auditProposal: { action: 'migration.review.proposed', actorId: context.actorId,
      groupId: context.groupId, empresaId: context.empresaId ?? null, correlationId: command.operationId } };
  for (const action of ['importar', 'editar']) await rbacGuard.assertAllowed(context, 'Cadastros', entity, action, { allowGlobalWildcard: false });
  return { ...proposal, commandHash: rowHash(proposal) };
}
