import { projectAssistedLegacyReview, rowHash } from './pilot-functional-policy.mjs';
import { SECRET_MIGRACAO_KEYS } from '../../src/components/lib/migracaoErpPolicy.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fields = new Set(['codigo', 'codigo_legado', 'nome', 'razao_social', 'nome_fantasia', 'descricao',
  'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'estado', 'pais', 'finalidades',
  'unidade_origem', 'unidade_principal', 'codigo_classe', 'email', 'contato_email', 'documento', 'cpf', 'cnpj']);
const protectedFields = new Set(['codigo', 'codigo_legado', 'nome', 'razao_social', 'nome_fantasia', 'email', 'contato_email', 'documento', 'cpf', 'cnpj',
  'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'estado', 'pais', 'finalidades']);
const secret = key => SECRET_MIGRACAO_KEYS.some(value => value.toLowerCase() === key.toLowerCase());
const immutable = new Set(['codigo', 'codigo_legado', 'codigo_classe', 'unidade_origem']);
const fail = code => { throw new Error(code); };
export const protectReviewValue = value => Array.isArray(value) ? value.map(protectReviewValue)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .filter(([key]) => !secret(key)).map(([key, item]) => [key, protectReviewValue(item)])) : value;

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

export function buildAssistedReviewRecord({ entity, sourceIndex, original, provenance, context, evidence,
  permissionSnapshot = {}, synthetic = false }) {
  if (!['cliente', 'fornecedor', 'produto', 'endereco-cliente', 'endereco-fornecedor'].includes(entity)
      || !Number.isSafeInteger(sourceIndex) || sourceIndex < 0 || !original || typeof original !== 'object'
      || !uuid(context?.groupId) || (context.empresaId != null && !uuid(context.empresaId))
      || !hash(provenance?.fileSha256) || !hash(provenance.rowSha256)
      || typeof provenance.sourceSystem !== 'string' || !provenance.sourceSystem || !provenance.file
      || (synthetic && provenance.sourceSystem !== 'SYNTHETIC')) fail('REVIEW_SOURCE_CONTRACT_REQUIRED');
  const projected = projectAssistedLegacyReview(evidence);
  const viewFields = Object.entries(original).filter(([key]) => fields.has(key) && !secret(key)).map(([name, value]) => ({
    name, originalPresent: true, original: protectReviewValue(value), protected: protectedFields.has(name), editable: !immutable.has(name),
    reasons: projected.reasons.filter(reason => reason.field === name).map(reason => reason.reason),
    normalization: normalizeReviewField(name, value),
  }));
  for (const reason of projected.reasons) if (fields.has(reason.field) && !viewFields.some(field => field.name === reason.field))
    viewFields.push({ name: reason.field, originalPresent: false, protected: protectedFields.has(reason.field), editable: !immutable.has(reason.field),
      reasons: [reason.reason], normalization: { proposed: null, rule: null } });
  const scopeMatches = permissionSnapshot.groupId === context.groupId
    && (permissionSnapshot.empresaId ?? null) === (context.empresaId ?? null);
  return { key: `${entity}:${sourceIndex}`, entity, sourceIndex, synthetic,
    context: { groupId: context.groupId, empresaId: context.empresaId ?? null },
    provenance: Object.fromEntries(['file', 'sourceSystem', 'fileSha256', 'rowSha256', 'batch']
      .filter(key => Object.hasOwn(provenance, key)).map(key => [key, provenance[key]])),
    sourceFingerprint: rowHash(original), fields: viewFields, ...projected,
    actions: { inspect: true, prepareDraft: scopeMatches && permissionSnapshot.loaded === true
      && permissionSnapshot.canImport === true && permissionSnapshot.canEdit === true,
    viewProtected: scopeMatches && permissionSnapshot.loaded === true && permissionSnapshot.canViewSensitive === true,
    apply: false, releaseOperational: false } };
}

/** Consumes an untrusted draft; no master write, permission grant or automatic release. */
export async function prepareAssistedReviewProposal(record, command, { context, rbacGuard } = {}) {
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
  if (!field || !fields.has(command.field) || secret(command.field) || immutable.has(command.field)) fail('REVIEW_FIELD_DENIED');
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

export function collectAssistedReviewProposal(journal, proposal) {
  if (!Array.isArray(journal) || proposal?.applied !== false || proposal?.operationalAuthorized !== false
      || proposal.status !== 'PENDING_CANONICAL_REVALIDATION' || !hash(proposal.commandHash)) fail('REVIEW_PROPOSAL_REQUIRED');
  const { commandHash, ...payload } = proposal;
  if (rowHash(payload) !== commandHash) fail('REVIEW_PROPOSAL_TAMPERED');
  const operations = new Set();
  for (const entry of journal) {
    const { commandHash: previousHash, ...previous } = entry;
    if (!hash(previousHash) || rowHash(previous) !== previousHash || operations.has(entry.operationId))
      fail('REVIEW_JOURNAL_TAMPERED');
    operations.add(entry.operationId);
  }
  const known = journal.filter(item => item.operationId === proposal.operationId);
  if (known.length > 1 || (known.length && known[0].commandHash !== commandHash)) fail('REVIEW_OPERATION_CONFLICT');
  return { journal: known.length ? structuredClone(journal) : [...structuredClone(journal), structuredClone(proposal)],
    reused: known.length === 1, masterWrites: 0 };
}

export function createSyntheticAssistedReviewRecords() {
  const context = { groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresaId: null };
  const base = { identityVerified: true, scopeVerified: true, canonicalValidated: true, reconciled: true, imported: true, issues: [] };
  const examples = [base, { ...base, issues: [{ field: 'numero', reason: 'SOURCE_FIELD_ABSENT', critical: false, blocks: ['endereco.entrega'] }] },
    { ...base, canonicalValidated: false, issues: [{ field: 'pais', reason: 'SOURCE_FIELD_ABSENT', critical: true, blocks: ['endereco.entrega'] }] },
    { ...base, batchReverted: true }];
  return examples.map((evidence, index) => buildAssistedReviewRecord({ entity: 'cliente', sourceIndex: index, synthetic: true,
    context, evidence, original: { codigo: `00000${index + 1}`, nome: `Pessoa SINTETICA ${index + 1}`, cep: '12.345-678', uf: ' sp ' },
    provenance: { sourceSystem: 'SYNTHETIC', file: 'clientes-sinteticos.csv', fileSha256: 'a'.repeat(64), rowSha256: 'b'.repeat(64), batch: 'preview-review' },
    permissionSnapshot: { ...context, loaded: true, canImport: true, canEdit: true, canViewSensitive: true } }));
}
