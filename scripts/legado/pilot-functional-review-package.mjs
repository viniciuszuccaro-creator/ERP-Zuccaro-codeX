import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { rowHash } from './pilot-functional-policy.mjs';
import { buildAssistedReviewRecord, createSyntheticAssistedReviewRecords } from './pilot-functional-review-record.mjs';
import { renderAssistedReview } from './pilot-functional-review-view.mjs';
import { buildOperationalLoadCandidate, compareOperationalMigrationEvidence } from './pilot-functional-load-plan.mjs';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const evidence = record => ({ identityVerified: false, scopeVerified: false, canonicalValidated: false,
  reconciled: false, imported: false, historyOnly: record.status === 'HISTORY_ONLY',
  issues: record.reasons.map(reason => ({ ...reason })) });

export function writeSyntheticAssistedReview(destination) {
  const records = createSyntheticAssistedReviewRecords();
  fs.writeFileSync(destination, renderAssistedReview(records, { kind: 'synthetic' }), { flag: 'wx', mode: 0o600 });
  return { records: records.length, syntheticOnly: true, masterWrites: 0 };
}

/** Extends the existing private review receipts; no database, container or import is invoked. */
export function prepareAssistedReviewPackage({ base, repo, context }) {
  process.umask(0o077);
  base = fs.realpathSync(base); repo = fs.realpathSync(repo);
  assert.equal(base.startsWith(repo + path.sep), false);
  assert.notEqual(base, repo);
  const safeRoot = (pointer, prefix) => {
    const root = read(path.join(base, pointer)).root;
    assert.equal(path.dirname(root), base); assert.match(path.basename(root), new RegExp(`^${prefix}-344-[a-f0-9]{16}$`));
    const stat = fs.lstatSync(root);
    assert.equal(stat.isSymbolicLink(), false); assert.equal(stat.uid, process.getuid()); assert.equal(stat.mode & 0o777, 0o700);
    assert.equal(fs.existsSync(path.join(root, 'writer.lock')), false);
    return root;
  };
  const functional = safeRoot('current-functional.json', 'functional');
  const products = safeRoot('current-products.json', 'products');
  const projectionFile = path.join(products, 'assisted-review-v2/projection-private.json');
  const projection = read(projectionFile), input = read(path.join(functional, 'input.json'));
  assert.ok(Array.isArray(projection.records)); assert.ok(Array.isArray(input.sourceFiles));
  const records = [], rejected = [];
  for (const item of projection.records) {
    try {
      const owner = item.entity.replace('endereco-', ''), source = input.rows[owner]?.[item.index];
      const descriptors = input.sourceFiles.filter(file => file.entity === owner);
      assert.equal(descriptors.length, 1);
      const descriptor = descriptors[0];
      assert.ok(source && descriptor); assert.equal(Number.isSafeInteger(item.index), true);
      // Historical references identify entity/index, not row bytes; never label them as content hashes.
      if (!item.entity.startsWith('endereco-')) assert.equal(item.sourceReference, digest(item.entity + ':' + item.index));
      let original = source;
      if (item.entity.startsWith('endereco-')) {
        if (owner === 'cliente') {
          const prefix = item.kind === 'cobranca' ? 'cobranca_' : 'endereco_';
          original = Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith(prefix))
            .map(([key, value]) => [key.slice(prefix.length), value]));
        } else if (item.kind === 'cobranca') {
          original = JSON.parse(source.endereco_cobranca);
          assert.ok(original && typeof original === 'object' && !Array.isArray(original));
        } else original = { logradouro: source.endereco, cep: source.cep, bairro: source.bairro,
          cidade: source.cidade, estado: source.estado };
      }
      const record = buildAssistedReviewRecord({ entity: item.entity, sourceIndex: item.index, original,
        context, evidence: evidence(item), provenance: { sourceSystem: 'LEGACY_PRESERVED_SOURCE',
          file: descriptor.relativePath, fileSha256: descriptor.sha256, rowSha256: rowHash(source), batch: '344' } });
      // Keep the previously reconciled state; it is historical evidence, not a fresh permission or validation.
      for (const key of ['status', 'label', 'reasons', 'blockedOperations']) record[key] = structuredClone(item[key]);
      record.key += ':' + (item.kind || 'master');
      records.push(record);
    } catch (error) {
      rejected.push({ entity: item.entity, index: item.index, kind: item.kind ?? null,
        reason: error?.code === 'ENOENT' ? 'SOURCE_NOT_AVAILABLE' : 'SOURCE_IDENTITY_OR_STRUCTURE_NOT_PROVEN' });
    }
  }
  const root = path.join(base, 'review-344-' + crypto.randomBytes(8).toString('hex'));
  fs.mkdirSync(root, { mode: 0o700 });
  const save = (name, value) => fs.writeFileSync(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  save('records-private.json', records); save('quarantine-private.json', rejected);
  save('REVISAO_ASSISTIDA_344_PRIVADA.html', renderAssistedReview(records));
  const migrationDir = path.join(repo, 'server/migrations');
  const candidates = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter(name => /^\d+_.*\.sql$/i.test(name))
    .map(name => ({ name, sha256: digest(fs.readFileSync(path.join(migrationDir, name))), automatic: true })) : [];
  const migrations = compareOperationalMigrationEvidence({ candidates });
  const prepared = records.filter(record => record.entity === 'cliente').map(record => ({ index: record.sourceIndex,
    sourceFingerprint: record.sourceFingerprint, fileSha256: record.provenance.fileSha256,
    // Reversed or incomplete receipts are not silently promoted into a released cohort.
    sourceActive: record.status === 'VALIDATED_ELIGIBLE', canonicalValidated: record.status === 'VALIDATED_ELIGIBLE', identityConflict: false }));
  const plan = buildOperationalLoadCandidate({ candidates: prepared, migrations });
  save('operational-candidate-private.json', plan);
  const counts = Object.fromEntries(['VALIDATED_ELIGIBLE', 'IMPORTED_PENDING', 'REVIEW_REQUIRED', 'HISTORY_ONLY']
    .map(status => [status, records.filter(record => record.status === status).length]));
  const receipt = { records: records.length, quarantine: rejected.length, counts, databaseAccess: false,
    loadsExecuted: 0, sourceReceiptSha256: digest(fs.readFileSync(projectionFile)),
    draftPermissionsProven: false, operationalLoad: false, proposedClientLimit: 100,
    sourceReleasedForOperationalLoad: plan.firstLoad.selected, missingGateGroups: plan.gates.filter(gate => !gate.passed).map(gate => gate.id) };
  save('result-sanitized.json', receipt);
  const manifest = fs.readdirSync(root).map(name => ({ name, bytes: fs.statSync(path.join(root, name)).size,
    sha256: digest(fs.readFileSync(path.join(root, name))) }));
  save('integrity-private.json', manifest);
  return { root, receipt };
}
