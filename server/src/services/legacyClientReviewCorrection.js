const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token = value => typeof value === 'string' && /^[a-z0-9_.:-]{1,80}$/i.test(value);
const reject = code => { throw new Error(code); };

function captureScope(scope) {
  if (scope?.scopeType !== 'grupo' || scope.empresaId != null || !uuid(scope.groupId)
      || !uuid(scope.actorId) || !token(scope.requestId)) reject('REVIEW_GROUP_SCOPE_REQUIRED');
  return { groupId: scope.groupId, empresaId: null, actorId: scope.actorId, requestId: scope.requestId, scopeType: 'grupo' };
}

const authorize = (rbac, ctx, action, q) =>
  rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { executor: q, allowGlobalWildcard: false });

export async function saveAssistedClientDocumentCorrection(identity, command, scope, { db, audit, rbac, prepareAssistedReviewProposal, isValidCpf, isValidCnpj }) {
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
