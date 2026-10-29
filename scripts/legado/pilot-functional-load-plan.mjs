import { createHash } from 'node:crypto';
import { rowHash, projectionDifferences } from './pilot-functional-policy.mjs';
import { isValidCpf, isValidCnpj } from '../../src/api/localCadastroMasterPolicy.js';
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const proven = (value, target) => value?.verified === true && hash(value.proofSha256) && hash(target)
  && value.targetIdentitySha256 === target && value.environment === 'OPERATIONAL_DESTINATION'
  && typeof value.observedAt === 'string' && Number.isFinite(Date.parse(value.observedAt));

export function compareOperationalMigrationEvidence({ candidates, deployed = [], applied = null, journalProof = null, targetIdentitySha256 = null }) {
  const valid = item => item && /^\d+_[^/\\]+\.sql$/.test(item.name) && hash(item.sha256);
  if (!Array.isArray(candidates) || !Array.isArray(deployed) || !candidates.every(valid) || !deployed.every(valid))
    throw new Error('MIGRATION_INVENTORY_REQUIRED');
  const names = candidates.map(item => item.name);
  if (new Set(names).size !== names.length || new Set(deployed.map(item => item.name)).size !== deployed.length)
    throw new Error('MIGRATION_FULL_NAME_AMBIGUOUS');
  const prefixes = new Map();
  for (const item of [...candidates, ...deployed]) {
    const prefix = item.name.split('_')[0];
    const group = prefixes.get(prefix) || new Set(); group.add(item.name); prefixes.set(prefix, group);
  }
  const sameNameDifferentBytes = candidates.filter(item => deployed.some(row => row.name === item.name && row.sha256 !== item.sha256)).map(item => item.name);
  const numericCollisions = [...prefixes].filter(([, group]) => group.size > 1).map(([prefix, group]) => ({ prefix, names: [...group].sort() }));
  const journalVerified = proven(journalProof, targetIdentitySha256) && Array.isArray(applied)
    && applied.every(item => typeof item === 'string' && /^\d+_[^/\\]+\.sql$/.test(item))
    && new Set(applied).size === applied.length;
  const known = new Set([...names, ...deployed.map(item => item.name)]);
  const unknownApplied = journalVerified ? applied.filter(name => !known.has(name)) : [];
  return { identity: 'FULL_FILENAME', ordering: 'LEXICOGRAPHIC_FULL_FILENAME',
    automaticFiles: candidates.filter(item => item.automatic === true).map(item => item.name).sort(),
    quarantinedFiles: candidates.filter(item => item.automatic !== true).map(item => item.name).sort(),
    journalVerified, sameNameDifferentBytes, numericCollisions, unknownApplied,
    pending: journalVerified ? names.filter(name => !applied.includes(name)).sort() : null,
    originalAppliedSqlHashVerified: proven(journalProof?.appliedArtifacts, targetIdentitySha256),
    decisionRequired: !journalVerified || sameNameDifferentBytes.length > 0 || numericCollisions.length > 0
      || unknownApplied.length > 0 || (applied?.length > 0 && !proven(journalProof?.appliedArtifacts, targetIdentitySha256)),
    renameAuthorized: false, executeMigrations: false };
}

/** Prepares a bounded source cohort, not an import command or an operational authorization. */
export function buildOperationalLoadCandidate({ candidates, proofs = {}, migrations, limit = 100, excludedIndices = [], targetIdentitySha256 = null }) {
  if (!Array.isArray(candidates) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || !Array.isArray(excludedIndices)) throw new Error('LOAD_CANDIDATE_CONTRACT_REQUIRED');
  const indices = new Set();
  for (const row of candidates) {
    if (!Number.isSafeInteger(row.index) || row.index < 0 || indices.has(row.index)
        || !hash(row.sourceFingerprint) || !hash(row.fileSha256)) throw new Error('LOAD_SOURCE_IDENTITY_AMBIGUOUS');
    indices.add(row.index);
  }
  const released = candidates.filter(row => row.sourceActive === true && row.canonicalValidated === true
    && row.identityConflict === false && !excludedIndices.includes(row.index)).sort((a, b) => a.index - b.index);
  const cohort = released.slice(0, limit).map(row => ({ sourceIndex: row.index,
    sourceFingerprint: row.sourceFingerprint, fileSha256: row.fileSha256 }));
  const cohortSha256 = rowHash(cohort);
  const verified = key => proven(proofs[key], targetIdentitySha256)
    && (!['destinationDuplicates', 'ownerLoadApproval'].includes(key) || proofs[key].cohortSha256 === cohortSha256)
    && (key !== 'destinationRestore' || (hash(proofs.destinationBackup?.artifactSha256)
      && proofs[key].backupSha256 === proofs.destinationBackup.artifactSha256));
  const groups = [
    ['TARGET_AND_SCHEMA', ['targetIdentity', 'schemaCompatibility', 'migrationJournals', 'databaseFilesystemCapacity']],
    ['SCOPE_AND_DUPLICATES', ['groupCompanyCrosswalk', 'destinationDuplicates']],
    ['PRIVILEGES_AND_ATOMIC_LEDGER', ['leastPrivilege', 'actualRbac', 'serviceAuditMapSameTransaction', 'firstInsertConcurrency']],
    ['DESTINATION_BACKUP_AND_RESTORE', ['destinationBackup', 'destinationRestore', 'destinationBatchReversal']],
    ['EXPLICIT_OPERATIONAL_RELEASE', ['ownerLoadApproval']],
  ];
  const gates = groups.map(([id, keys]) => ({ id, passed: keys.every(verified), missing: keys.filter(key => !verified(key)) }));
  if (!migrations || migrations.decisionRequired !== false) {
    gates[0].passed = false;
    if (!gates[0].missing.includes('migrationIdentityAndAppliedArtifacts')) gates[0].missing.push('migrationIdentityAndAppliedArtifacts');
  }
  return { status: 'PREPARED_NOT_AUTHORIZED_OPERATIONAL_LOAD', entity: 'cliente',
    firstLoad: { proposedLimit: limit, sourcePrepared: released.length, selected: cohort.length,
      ordering: 'VERIFIED_SOURCE_INDEX', scope: 'GROUP_MASTER_WITH_EXPLICIT_AUTHORIZED_VISIBILITY',
      companyLinksCreated: false, inactiveReactivation: false, overwriteExisting: false, autoMergeDuplicates: false,
      createsFinancialOrStockBalance: false, createsFiscalDocument: false },
    cohort, cohortSha256, targetIdentitySha256, sourceHeld: candidates.length - released.length, independentRowsContinue: true,
    gates, productPrerequisites: { canonicalUnitsAndReferencesVerified: proven(proofs.canonicalUnitsAndReferences, targetIdentitySha256),
      blocksOnlyProductLoad: true }, readyForReleaseReview: gates.every(gate => gate.passed), operationalEligible: 0,
    executable: false, operationalAuthorized: false, migrations, migrationsExecuted: 0,
    backupRestoreScope: 'ACTUAL_DESTINATION_REQUIRED_NOT_WORKSPACE_OR_LEGACY_SOURCE_RESTORE',
    isolatedProofDoesNotReleaseDestination: true };
}

const uuid = value => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const clientReadFields = Object.freeze(['id', 'group_id', 'empresa_id', 'codigo', 'tipo',
  'documento', 'documento_normalizado', 'nome', 'razao_social', 'nome_fantasia', 'ativo',
  'status', 'email', 'telefone', 'celular', 'origem', 'codigo_legado',
  'legacy_id', 'source_system', 'migration_batch']);
const comparisonFields = Object.freeze(['tipo', 'documento', 'nome', 'razao_social',
  'nome_fantasia', 'ativo', 'status', 'email', 'telefone', 'celular']);
const cloneFrozen = value => {
  const copy = structuredClone(value);
  const freeze = item => {
    if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
    return item;
  };
  return freeze(copy);
};

/** Fixed read proposal in the existing load preparation flow; no connection or authorization is created. */
export function buildClientReconciliationReadPlan({ sourceBytes, expectedSourceSha256, expectedCohortSha256, target }) {
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length > 2 * 1024 * 1024
    || !hash(expectedSourceSha256)
    || createHash('sha256').update(sourceBytes).digest('hex') !== expectedSourceSha256)
    throw new Error('RECONCILIATION_SOURCE_PIN_REQUIRED');
  if (!target || target.schema !== 'public' || !hash(target.identitySha256) || !uuid(target.groupId)
    || !Array.isArray(target.companyIds) || target.companyIds.length < 1 || target.companyIds.length > 200
    || !target.companyIds.every(uuid) || new Set(target.companyIds).size !== target.companyIds.length
    || typeof target.database !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(target.database)
    || typeof target.executorRole !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(target.executorRole))
    throw new Error('RECONCILIATION_TARGET_BINDING_REQUIRED');
  target = { identitySha256: target.identitySha256, database: target.database, schema: target.schema,
    executorRole: target.executorRole, groupId: target.groupId, companyIds: [...target.companyIds] };
  let source;
  try { source = JSON.parse(sourceBytes.toString('utf8')); }
  catch { throw new Error('RECONCILIATION_SOURCE_INVALID'); }
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || !Array.isArray(source.cohort) || source.cohort.length < 1 || source.cohort.length > 100
    || !hash(expectedCohortSha256) || source.cohortSha256 !== expectedCohortSha256
    || source.cohortSha256 !== rowHash(source.cohort) || !Array.isArray(source.selectedDetails)
    || source.selectedDetails.length !== source.cohort.length)
    throw new Error('RECONCILIATION_COHORT_INVALID');
  const details = new Map();
  for (const row of source.selectedDetails) {
    if (!row || !Number.isSafeInteger(row.sourceIndex) || row.sourceIndex < 0 || row.sourceIndex > 2147483647
      || details.has(row.sourceIndex)) throw new Error('RECONCILIATION_SOURCE_IDENTITY_INVALID');
    details.set(row.sourceIndex, row);
  }
  const seen = new Set(), rows = [];
  for (const ref of source.cohort) {
    const row = details.get(ref?.sourceIndex);
    if (!row || seen.has(ref.sourceIndex) || !hash(ref.sourceFingerprint) || !hash(ref.fileSha256)
      || row.sourceFingerprint !== ref.sourceFingerprint || row.fileSha256 !== ref.fileSha256
      || !row.canonical || typeof row.canonical !== 'object' || Array.isArray(row.canonical))
      throw new Error('RECONCILIATION_SOURCE_IDENTITY_INVALID');
    seen.add(ref.sourceIndex);
    const documentAbsent = row.canonical.documento == null;
    const documentValid = documentAbsent || typeof row.canonical.documento === 'string'
      && /^(?:\d{11}|\d{14})$/.test(row.canonical.documento)
      && (isValidCpf(row.canonical.documento) || isValidCnpj(row.canonical.documento));
    const projection = Object.fromEntries(comparisonFields.filter(key => Object.hasOwn(row.canonical, key)
      && !(key === 'documento' && documentAbsent))
      .map(key => [key, row.canonical[key]]));
    rows.push({ sourceIndex: ref.sourceIndex, sourceFingerprint: ref.sourceFingerprint,
      fileSha256: ref.fileSha256, projection, documento: documentAbsent ? null : row.canonical.documento,
      sourceMissingDocument: documentAbsent,
      uncomparedSourceFields: Object.keys(row.canonical).filter(key => !Object.hasOwn(projection, key)),
      sourceSystem: row.canonical.source_system ?? null, codigoLegado: row.canonical.codigo_legado ?? null,
      blockedReason: documentValid ? null : 'SOURCE_DOCUMENT_UNVERIFIED' });
  }
  const occurrences = new Map();
  for (const row of rows) if (!row.blockedReason && row.documento !== null)
    occurrences.set(row.documento, (occurrences.get(row.documento) || 0) + 1);
  for (const row of rows) if (!row.blockedReason && row.documento !== null && occurrences.get(row.documento) !== 1)
    row.blockedReason = 'SOURCE_DOCUMENT_AMBIGUOUS';
  const nativeOccurrences = new Map();
  for (const row of rows) {
    const native = [row.sourceSystem, row.codigoLegado];
    row.nativeIdentityValid = native.every(value => typeof value === 'string'
      && value === value.trim() && value.length > 0 && value.length <= 80);
    if (!native.every(value => value === null) && !row.nativeIdentityValid)
      row.blockedReason ||= 'SOURCE_LEGACY_IDENTITY_INCOMPLETE';
    if (row.sourceMissingDocument && !row.nativeIdentityValid)
      row.blockedReason ||= 'SOURCE_IDENTITY_UNVERIFIED';
    if (row.nativeIdentityValid) {
      const key = JSON.stringify(native);
      nativeOccurrences.set(key, (nativeOccurrences.get(key) || 0) + 1);
    }
  }
  for (const row of rows) if (row.nativeIdentityValid
    && nativeOccurrences.get(JSON.stringify([row.sourceSystem, row.codigoLegado])) !== 1)
    row.blockedReason ||= 'SOURCE_LEGACY_IDENTITY_AMBIGUOUS';
  const identities = rows.filter(row => !row.blockedReason).map(row => ({ source_index: row.sourceIndex,
    documento: row.documento, source_system: row.sourceSystem, codigo_legado: row.codigoLegado }));
  const documents = identities.filter(row => row.documento !== null).map(row => row.documento);
  const precheck = {
    sql: `SELECT current_database() AS database_name,current_user AS executor_role,
      session_user AS session_role,current_setting('transaction_read_only') AS read_only,
      current_setting('transaction_isolation') AS isolation,current_setting('search_path') AS search_path,
      (SELECT count(*)::int FROM public.groups WHERE id=$1::uuid) AS group_matches,
      (SELECT count(*)::int FROM public.empresas WHERE group_id=$1::uuid
        AND id=ANY($2::uuid[])) AS company_matches`,
    params: [target.groupId, target.companyIds],
  };
  const query = identities.length ? {
    sql: `WITH requested AS (SELECT source_index,documento,source_system,codigo_legado
        FROM jsonb_to_recordset($2::jsonb) AS r(source_index int,documento text,source_system text,codigo_legado text)),
      matched AS MATERIALIZED (SELECT r.source_index,c.id,
        (c.documento_normalizado=r.documento) AS document_match,
        (r.source_system IS NOT NULL AND c.source_system=r.source_system AND c.codigo_legado=r.codigo_legado) AS legacy_match
        FROM requested r JOIN public.clientes c ON c.group_id=$1::uuid AND
          (c.documento_normalizado=r.documento OR (r.source_system IS NOT NULL
            AND c.source_system=r.source_system AND c.codigo_legado=r.codigo_legado))),
      counts AS (SELECT source_index,count(*)::int AS matches,
        count(*) FILTER (WHERE document_match)::int AS document_matches,
        count(*) FILTER (WHERE legacy_match)::int AS legacy_matches FROM matched GROUP BY source_index)
      SELECT r.source_index,r.documento,coalesce(n.matches,0) AS matches,
        coalesce(n.document_matches,0) AS document_matches,coalesce(n.legacy_matches,0) AS legacy_matches,
        CASE WHEN n.matches=1 THEN jsonb_build_object(${clientReadFields.map(key => `'${key}',c.${key}`).join(',')}) END AS record,
        CASE WHEN n.matches=1 THEN (SELECT count(*)::int FROM public.cliente_empresas ce
          WHERE ce.group_id=$1::uuid AND ce.cliente_id=c.id AND ce.empresa_id=ANY($3::uuid[])) ELSE 0 END AS company_links,
        CASE WHEN n.matches=1 THEN (SELECT count(*)::int FROM public.cliente_locais cl
          WHERE cl.group_id=$1::uuid AND cl.cliente_id=c.id) ELSE 0 END AS address_links
      FROM requested r LEFT JOIN counts n ON n.source_index=r.source_index
      LEFT JOIN matched m ON n.matches=1 AND m.source_index=r.source_index
      LEFT JOIN public.clientes c ON c.id=m.id AND c.group_id=$1::uuid ORDER BY r.source_index`,
    params: [target.groupId, JSON.stringify(identities), target.companyIds],
  } : null;
  return cloneFrozen({ status: 'PREPARED_NOT_AUTHORIZED_READ', privateOnly: true,
    sourceArtifactSha256: expectedSourceSha256, cohortSha256: source.cohortSha256,
    target, rows, documents, identities, precheck, query,
    transaction: { begin: 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      settings: ["SET LOCAL search_path=pg_catalog", "SET LOCAL statement_timeout='10s'", "SET LOCAL lock_timeout='2s'",
        "SET LOCAL idle_in_transaction_session_timeout='30s'"], end: 'ROLLBACK' },
    operationalAuthorized: false, operationalEligible: 0, executorIsRestrictedReader: false,
    authenticationProven: false, physicalDestinationProofRequired: true,
    codeCollisionCheckOutsideCohortPending: true, auxiliaryCompletenessPending: true });
}

/** Validates the exact statement's private output, not authentication, freshness or load authorization. */
export function classifyClientReconciliationReadResult(plan, { session, rows }) {
  if (!plan?.privateOnly || plan.status !== 'PREPARED_NOT_AUTHORIZED_READ'
    || session?.database_name !== plan.target.database || session.executor_role !== plan.target.executorRole
    || session.session_role !== plan.target.executorRole || session.read_only !== 'on'
    || session.isolation !== 'repeatable read' || session.search_path !== 'pg_catalog' || session.group_matches !== 1
    || session.company_matches !== plan.target.companyIds.length)
    throw new Error('RECONCILIATION_SESSION_UNVERIFIED');
  if (!Array.isArray(rows) || rows.length !== plan.identities.length)
    throw new Error('RECONCILIATION_RESULT_INCOMPLETE');
  const actual = new Map();
  for (const row of rows) {
    const requested = plan.identities.find(item => item.source_index === row?.source_index);
    if (!row || !requested || requested.documento !== row.documento || actual.has(row.source_index)
      || !Number.isSafeInteger(row.matches) || row.matches < 0
      || !Number.isSafeInteger(row.document_matches) || row.document_matches < 0 || row.document_matches > row.matches
      || !Number.isSafeInteger(row.legacy_matches) || row.legacy_matches < 0 || row.legacy_matches > row.matches
      || (requested.source_system === null && row.legacy_matches !== 0)
      || row.matches > row.document_matches + row.legacy_matches
      || !Number.isSafeInteger(row.company_links) || row.company_links < 0
      || row.company_links > plan.target.companyIds.length
      || !Number.isSafeInteger(row.address_links) || row.address_links < 0
      || (row.matches !== 1 && (row.company_links !== 0 || row.address_links !== 0))
      || (row.matches !== 1 && row.record != null)) throw new Error('RECONCILIATION_RESULT_INVALID');
    if (row.matches === 1 && (!row.record || !uuid(row.record.id)
      || row.record.group_id !== plan.target.groupId
      || (requested.documento !== null && row.record.documento_normalizado === row.documento) !== (row.document_matches === 1)
      || (requested.source_system !== null && row.record.source_system === requested.source_system
        && row.record.codigo_legado === requested.codigo_legado) !== (row.legacy_matches === 1)
      || !clientReadFields.every(key => Object.hasOwn(row.record, key))
      || Object.keys(row.record).some(key => !clientReadFields.includes(key))))
      throw new Error('RECONCILIATION_RESULT_SCOPE_INVALID');
    actual.set(row.source_index, row);
  }
  const details = plan.rows.map(source => {
    if (source.blockedReason) return { sourceIndex: source.sourceIndex, status: 'BLOCKED', reason: source.blockedReason };
    const found = actual.get(source.sourceIndex);
    if (found.matches === 0) return { sourceIndex: source.sourceIndex, status: 'NEW', scope: 'APPROVED_DOCUMENT_OR_NATIVE_SNAPSHOT_ONLY' };
    if (found.matches > 1) return { sourceIndex: source.sourceIndex,
      status: found.matches === 2 && found.document_matches === 1 && found.legacy_matches === 1
        ? 'DIVERGENT' : 'DUPLICATE', reason: 'AMBIGUOUS_DOCUMENT_OR_LEGACY_IDENTITY', matches: found.matches };
    const differences = projectionDifferences(source.projection, { ...found.record, documento: found.record.documento_normalizado });
    const legacyConflict = source.sourceSystem !== null && found.legacy_matches === 0
      && (found.record.source_system != null || found.record.codigo_legado != null);
    return { sourceIndex: source.sourceIndex,
      status: found.record.empresa_id != null ? 'BLOCKED' : differences.length || legacyConflict ? 'DIVERGENT' : 'COMPATIBLE',
      reason: found.record.empresa_id != null ? 'EXISTING_RECORD_IS_NOT_GROUP_MASTER'
        : legacyConflict ? 'EXISTING_LEGACY_PROVENANCE_DIFFERS' : null,
      differences, record: found.record, uncomparedSourceFields: source.uncomparedSourceFields,
      legacyBindingMatches: found.legacy_matches === 1,
      sourceMissingDocument: source.sourceMissingDocument,
      comparisonScope: 'DECLARED_CANONICAL_FIELDS_ONLY',
      companyLinks: found.company_links, addressLinks: found.address_links };
  });
  const counts = Object.fromEntries(['NEW', 'COMPATIBLE', 'DUPLICATE', 'DIVERGENT', 'BLOCKED']
    .map(status => [status, details.filter(row => row.status === status).length]));
  return { privateOnly: true, details, publicSummary: { total: details.length, counts,
    operationalAuthorized: false, operationalEligible: 0, authenticationProven: false,
    physicalDestinationProofRequired: true, codeCollisionCheckOutsideCohortPending: true,
    auxiliaryCompletenessPending: true } };
}
