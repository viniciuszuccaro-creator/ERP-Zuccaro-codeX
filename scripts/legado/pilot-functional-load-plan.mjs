import { rowHash } from './pilot-functional-policy.mjs';
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
