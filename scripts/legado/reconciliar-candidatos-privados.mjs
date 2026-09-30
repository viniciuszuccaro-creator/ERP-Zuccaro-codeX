import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { parse } from 'csv-parse/sync';

const ENTITIES = {
  clientes: { candidate: '03_EXPORT_STAGING/CLIENTES/CLIENTES-LEGACY-TID-001/clientes-candidatos.csv', quarantine: '05_QUARANTINE/CLIENTES/CLIENTES-LEGACY-TID-001/clientes-quarentena.csv', summary: '04_REPORTS/legacy-client-nominal-staging-summary.json' },
  fornecedores: { candidate: '03_EXPORT_STAGING/FORNECEDORES/FORNECEDORES-LEGACY-TID-001/fornecedores-candidatos.csv', quarantine: '05_QUARANTINE/FORNECEDORES/FORNECEDORES-LEGACY-TID-001/fornecedores-quarentena.csv', summary: '04_REPORTS/legacy-supplier-nominal-staging-summary.json' },
  produtos_revenda: { candidate: '03_EXPORT_STAGING/PRODUTOS/PRODUTOS-LEGACY-TID-001/produtos-revenda-candidatos.csv', quarantine: '05_QUARANTINE/PRODUTOS/PRODUTOS-LEGACY-TID-001/produtos-revenda-quarentena.csv', summary: '04_REPORTS/legacy-product-nominal-staging-summary.json' },
};

function rows(path) {
  return parse(readFileSync(path), { columns: true, bom: true, skip_empty_lines: true, max_record_size: 1_000_000 });
}

function expected(summary, entity) {
  if (entity === 'clientes') return [summary.sourceRows, summary.acceptedCandidates, summary.quarantinedRows];
  if (entity === 'fornecedores') return [summary.totals.source_rows, summary.totals.candidates, summary.totals.quarantine];
  return [summary.source_rows, summary.candidate_rows, summary.quarantine_rows];
}

function expectedHash(summary, entity, file, kind) {
  if (entity === 'produtos_revenda') return summary[`${kind}_sha256`];
  const artifacts = entity === 'clientes' ? summary.files : summary.artifacts;
  const item = artifacts?.find((artifact) =>
    (artifact.name || basename(artifact.relative_path || '')) === basename(file));
  return item?.sha256;
}

function verifyHash(path, expected, entity) {
  if (!/^[a-f0-9]{64}$/i.test(expected || '')) throw new Error(`LEGACY_HASH_MISSING:${entity}`);
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`LEGACY_HASH_MISMATCH:${entity}`);
}

function documentOf(row, entity) {
  const value = entity === 'clientes' ? (row.cnpj || row.cpf) : row.cpf_cnpj;
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

export function reconcilePrivateCandidates(root) {
  const report = { schemaVersion: 1, mode: 'READ_ONLY_NO_IMPORT', entities: {}, crossRoleDocumentOverlap: 0, crossRoleOverlapIsTentative: true, operationalImportAuthorized: false };
  const clientDocuments = new Set();
  const supplierDocuments = new Set();
  let sharedGroup;
  for (const [entity, files] of Object.entries(ENTITIES)) {
    const path = (name) => `${root}/${name}`;
    let candidates, quarantined, summary;
    try {
      candidates = rows(path(files.candidate));
      quarantined = rows(path(files.quarantine));
      summary = JSON.parse(readFileSync(path(files.summary), 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      throw new Error(`LEGACY_INPUT_UNREADABLE:${entity}`);
    }
    const [sourceCount, candidateCount, quarantineCount] = expected(summary, entity);
    verifyHash(path(files.candidate), expectedHash(summary, entity, files.candidate, 'candidate'), entity);
    verifyHash(path(files.quarantine), expectedHash(summary, entity, files.quarantine, 'quarantine'), entity);
    if (![sourceCount, candidateCount, quarantineCount].every(Number.isSafeInteger)
      || sourceCount !== candidates.length + quarantined.length
      || candidateCount !== candidates.length || quarantineCount !== quarantined.length) {
      throw new Error(`LEGACY_COUNTS_MISMATCH:${entity}`);
    }
    const codes = new Set();
    for (const row of candidates) {
      const group = String(row.group_id || '').trim();
      const code = String(row.codigo_legado || '').trim();
      if (!group || (sharedGroup && sharedGroup !== group) || String(row.empresa_id || '').trim()) {
        throw new Error(`LEGACY_SCOPE_INVALID:${entity}`);
      }
      sharedGroup = group;
      if (!code || codes.has(code)) throw new Error(`LEGACY_CODE_INVALID:${entity}`);
      codes.add(code);
      if (String(row.import_authorized || '').trim().toLowerCase() !== 'false') {
        throw new Error(`LEGACY_IMPORT_FLAG_INVALID:${entity}`);
      }
      const document = documentOf(row, entity);
      if (document && entity === 'clientes') clientDocuments.add(document);
      if (document && entity === 'fornecedores') supplierDocuments.add(document);
    }
    report.entities[entity] = {
      sourceRows: sourceCount, candidates: candidates.length, quarantine: quarantined.length,
      difference: sourceCount - candidates.length - quarantined.length,
      reconciled: true, fileHashesVerified: true, uniqueLegacyCodes: codes.size,
      scope: 'GROUP_MASTER', companyScopedRows: 0,
    };
  }
  for (const document of clientDocuments) if (supplierDocuments.has(document)) report.crossRoleDocumentOverlap++;
  return report;
}

if (process.argv[1]?.endsWith('reconciliar-candidatos-privados.mjs')) {
  try {
    if (!process.argv[2]) throw new Error('LEGACY_ROOT_REQUIRED');
    process.stdout.write(`${JSON.stringify(reconcilePrivateCandidates(process.argv[2]), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message.startsWith('LEGACY_') ? error.message : 'LEGACY_RECONCILIATION_FAILED'}\n`);
    process.exitCode = 1;
  }
}
