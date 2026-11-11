import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { consumirLoteStagingLegado } from './consumir-lote-staging.mjs';

// Orchestration only: retain the protected mapper/consumer and all its existing callers.
export const consumirLotesStagingRetomavel = options => processStagingBatches({
  ...options, consume: consumirLoteStagingLegado,
});

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = (value, omitUndefinedFields = false) => {
  if (value === null || ['string','boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => plain(item, omitUndefinedFields));
  if (value && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => !omitUndefinedFields || value[key] !== undefined)
      .map(key => [key, plain(value[key], omitUndefinedFields)]));
  throw new Error('STAGING_JSON_REQUIRED');
};
const write = (file, value) => {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  if (process.platform !== 'win32') {
    const parent = fs.openSync(path.dirname(file), 'r');
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  }
};
const read = file => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (process.platform !== 'win32'
    && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) throw new Error('STAGING_PRIVATE_FILE_REQUIRED');
  return JSON.parse(fs.readFileSync(file,'utf8'));
};

/** Private staging only. Canonical services continue to own any later business writes. */
export function processStagingBatches({ rows, nativeKey, sourceSha256, runId, batchSize = 500,
  options = {}, directory, repo, consume, afterCheckpoint = () => {} }) {
  if (!Array.isArray(rows) || !rows.length || typeof nativeKey !== 'string' || !nativeKey
    || !/^[a-f0-9]{64}$/.test(sourceSha256 || '') || !/^[a-zA-Z0-9_-]{1,80}$/.test(runId || '')
    || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000
    || typeof consume !== 'function') throw new Error('STAGING_BATCH_CONTRACT_REQUIRED');
  // Snapshot before invoking callbacks, preserving strings and leading zeros exactly.
  const ordered = plain(rows).map(row => {
    const key = row[nativeKey];
    if (typeof key !== 'string' || !key.trim()) throw new Error('STAGING_NATIVE_KEY_REQUIRED');
    return { key, row };
  }).sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  if (new Set(ordered.map(row => row.key)).size !== ordered.length)
    throw new Error('STAGING_NATIVE_KEY_DUPLICATE');
  const config = plain(options);
  const manifest = { version: 1, runId, sourceSha256, nativeKey, batchSize, options: config,
    selection: ordered.map(({key,row}) => ({key, sha256: digest(row)})),
    scope: 'PRIVATE_STAGING_ONLY', businessWrites: false };
  const manifestSha256 = digest(manifest);
  const root = fs.realpathSync(directory), checkout = fs.realpathSync(repo);
  const relative = path.relative(checkout, root);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)))
    throw new Error('STAGING_PRIVATE_DIRECTORY_REQUIRED');
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== 'win32'
    && (stat.uid !== process.getuid() || (stat.mode & 0o077))))
    throw new Error('STAGING_PRIVATE_DIRECTORY_REQUIRED');
  const lock = path.join(root, 'writer.lock');
  const fd = fs.openSync(lock, 'wx', 0o600);
  const ownedLock = fs.fstatSync(fd);
  try {
    const manifestPath = path.join(root, 'manifest.private.json');
    if (fs.existsSync(manifestPath)) {
      if (digest(read(manifestPath)) !== manifestSha256)
        throw new Error('STAGING_MANIFEST_CHANGED');
    } else write(manifestPath, manifest);
    let previous = manifestSha256, reused = 0, processed = 0;
    const keys = [...(config.chavesJaGravadas || [])];
    for (let offset = 0, index = 0; offset < ordered.length; offset += batchSize, index++) {
      const selected = ordered.slice(offset, offset + batchSize);
      const batchSha256 = digest(selected);
      const file = path.join(root, `batch-${String(index).padStart(8,'0')}.private.json`);
      let receipt;
      if (fs.existsSync(file)) {
        receipt = read(file);
        if (receipt.manifestSha256 !== manifestSha256 || receipt.previous !== previous
          || receipt.index !== index || receipt.batchSha256 !== batchSha256
          || receipt.resultSha256 !== digest(receipt.result)) throw new Error('STAGING_CHECKPOINT_INVALID');
        reused++;
      } else {
        const result = plain(consume(selected.map(item => item.row),
          {...structuredClone(config), chavesJaGravadas: structuredClone(keys)}), true);
        if (!Array.isArray(result.comprovados) || !result.totais)
          throw new Error('STAGING_RESULT_INVALID');
        receipt = {manifestSha256, previous, index, batchSha256, result, resultSha256: digest(result)};
        write(file, receipt);
        processed++;
      }
      for (const item of receipt.result.comprovados) keys.push({
        chave: item.chave_idempotente_migracao, fingerprint: item.fingerprint_migracao });
      previous = digest(receipt);
      afterCheckpoint({ index, processed, reused });
    }
    return {manifestSha256, batches: processed + reused, processed, reused,
      records: rows.length, businessWrites: 0, scope: 'PRIVATE_STAGING_ONLY'};
  } finally {
    fs.closeSync(fd);
    const current = fs.lstatSync(lock);
    if (current.dev !== ownedLock.dev || current.ino !== ownedLock.ino || current.isSymbolicLink())
      throw new Error('STAGING_LOCK_CHANGED');
    fs.unlinkSync(lock);
  }
}
