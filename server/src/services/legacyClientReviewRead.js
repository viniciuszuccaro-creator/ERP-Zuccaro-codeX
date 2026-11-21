const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token = value => typeof value === 'string' && /^[a-z0-9_.:-]{1,80}$/i.test(value);

export async function reopenAssistedClientReview(identity, scope, { db, rbac }) {
  if (scope?.scopeType !== 'grupo' || scope.empresaId != null || !uuid(scope.groupId)
      || !uuid(scope.actorId) || !token(scope.requestId)) throw new Error('REVIEW_GROUP_SCOPE_REQUIRED');
  const ctx = { groupId: scope.groupId, empresaId: null, actorId: scope.actorId,
    requestId: scope.requestId, scopeType: 'grupo' };
  const { sourceSystem, nativeKey } = identity ?? {};
  if (!token(sourceSystem) || !token(nativeKey)) throw new Error('REVIEW_IDENTITY_REQUIRED');
  return db.withTenantContext(ctx, () => db.withTransaction(async q => {
    for (const action of ['visualizar', 'importar']) {
      await rbac.assertAllowed(ctx, 'Cadastros', 'cliente', action, { executor: q, allowGlobalWildcard: false });
    }
    const found = (await q.query(`SELECT id, record, correction->>'status' AS correction_status
      FROM legacy_client_review WHERE group_id=$1 AND source_system=$2 AND native_key=$3 AND NOT archived`,
    [ctx.groupId, sourceSystem, nativeKey])).rows[0];
    if (!found) return null;
    return { id: found.id, correctionStatus: found.correction_status, record: { ...found.record, fields: found.record.fields.map(field => {
      if (!field.protected) return field;
      const { original: _original, ...masked } = field;
      return masked;
    }) } };
  }));
}
