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
    const importAuthorized = entity === 'clientes' ? summary.importAuthorized : summary.import_authorized;
    const directImportPerformed = entity === 'clientes' ? summary.directImportPerformed : summary.direct_import_performed;
    if (importAuthorized !== false || directImportPerformed !== false) {
      throw new Error(`LEGACY_SUMMARY_IMPORT_STATE_INVALID:${entity}`);
    }
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
    let candidateQuarantineCodeOverlap = 0;
    let quarantineCompanyRows = 0;
    let quarantineOtherGroupRows = 0;
    for (const row of quarantined) {
      if (String(row.import_authorized || '').trim().toLowerCase() !== 'false') {
        throw new Error(`LEGACY_QUARANTINE_IMPORT_FLAG_INVALID:${entity}`);
      }
      if (codes.has(String(row.codigo_legado || '').trim())) candidateQuarantineCodeOverlap++;
      if (String(row.empresa_id || '').trim()) quarantineCompanyRows++;
      if (String(row.group_id || '').trim() !== sharedGroup) quarantineOtherGroupRows++;
    }
    report.entities[entity] = {
      sourceRows: sourceCount, candidates: candidates.length, quarantine: quarantined.length,
      difference: sourceCount - candidates.length - quarantined.length,
      reconciled: true, fileHashesVerified: true, uniqueLegacyCodes: codes.size,
      scope: 'GROUP_MASTER', companyScopedRows: 0,
      candidateQuarantineCodeOverlap, quarantineCompanyRows, quarantineOtherGroupRows,
      duplicateDocumentSignal: entity === 'clientes'
        ? { unit: 'reason_occurrences', count: Number.isSafeInteger(summary.quarantineReasonCounts?.DOCUMENTO_DUPLICADO_LEGADO) ? summary.quarantineReasonCounts.DOCUMENTO_DUPLICADO_LEGADO : null }
        : entity === 'fornecedores'
          ? { unit: 'groups', count: Number.isSafeInteger(summary.totals.duplicate_document_groups) ? summary.totals.duplicate_document_groups : null }
          : null,
    };
  }
  for (const document of clientDocuments) if (supplierDocuments.has(document)) report.crossRoleDocumentOverlap++;
  return report;
}

export function reconcilePrivateProductsWithTarget(root, inventoryPath) {
  const verified = reconcilePrivateCandidates(root);
  let inventory;
  try { inventory = JSON.parse(readFileSync(inventoryPath, 'utf8').replace(/^\uFEFF/, '')); }
  catch { throw new Error('LEGACY_TARGET_INVENTORY_UNREADABLE'); }
  const target = inventory?.produtos;
  if (inventory?.mode !== 'READ_ONLY' || typeof inventory?.codigo_legado_column_present !== 'boolean'
    || inventory?.database !== 'postgres' || !Number.isFinite(Date.parse(inventory?.exported_at))
    || !Array.isArray(target) || !Number.isSafeInteger(inventory?.row_count)
    || inventory.row_count !== target.length) throw new Error('LEGACY_TARGET_INVENTORY_INVALID');
  const candidates = rows(`${root}/${ENTITIES.produtos_revenda.candidate}`);
  const groupId = candidates[0]?.group_id;
  if (!groupId || candidates.length !== verified.entities.produtos_revenda.candidates) {
    throw new Error('LEGACY_PRODUCT_SOURCE_INVALID');
  }
  const code = (value) => String(value ?? '').trim().toUpperCase();
  const name = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  const seenIds = new Set();
  const sameGroup = new Map();
  const otherGroup = new Set();
  for (const row of target) {
    if (!row || typeof row.id !== 'string' || !row.id || seenIds.has(row.id)
      || typeof row.group_id !== 'string' || !row.group_id
      || typeof row.codigo !== 'string' && row.codigo !== null
      || typeof row.codigo_legado !== 'string' && row.codigo_legado !== null
      || !inventory.codigo_legado_column_present && row.codigo_legado !== null
      || typeof row.descricao !== 'string' || !row.descricao.trim()) {
      throw new Error('LEGACY_TARGET_INVENTORY_INVALID');
    }
    seenIds.add(row.id);
    const index = row.group_id === groupId ? sameGroup : otherGroup;
    for (const key of new Set([code(row.codigo), code(row.codigo_legado)].filter(Boolean))) {
      if (index === otherGroup) { otherGroup.add(key); continue; }
      const matches = sameGroup.get(key) || [];
      matches.push(row);
      sameGroup.set(key, matches);
    }
  }
  if (target.length > 0 && !target.some((row) => row.group_id === groupId)) {
    throw new Error('LEGACY_PRODUCT_GROUP_SCOPE_UNPROVEN');
  }
  const report = { mode: 'READ_ONLY_NO_IMPORT', sourceCandidates: candidates.length,
    targetRows: target.length, targetGroupRows: target.filter((row) => row.group_id === groupId).length,
    existing: 0, absent: 0, conflicts: 0, otherGroupCodeOnly: 0,
    legacyCodeColumnPresent: inventory.codigo_legado_column_present,
    legacyCodeStorageAvailable: inventory.codigo_legado_column_present,
    operationalImportAuthorized: false };
  for (const row of candidates) {
    const key = code(row.codigo_legado);
    const matches = [...new Map((sameGroup.get(key) || []).map((item) => [item.id, item])).values()];
    if (!matches.length) {
      report.absent++;
      if (otherGroup.has(key)) report.otherGroupCodeOnly++;
      continue;
    }
    const targetRow = matches[0];
    const legacyCode = code(targetRow.codigo_legado);
    if (matches.length !== 1 || (legacyCode && legacyCode !== key)
      || name(row.descricao) !== name(targetRow.descricao)) report.conflicts++;
    else report.existing++;
  }
  return report;
}

export function reconcilePrivatePurchaseFinance(root) {
  let companies, titles;
  try {
    companies = rows(`${root}/04_REPORTS/legacy-purchase-company-code-reconciliation.csv`);
    titles = rows(`${root}/04_REPORTS/legacy-purchase-candidate-fiscal-title-total-reconciliation.csv`);
  } catch { throw new Error('LEGACY_PURCHASE_REPORT_UNREADABLE'); }
  if (!companies.length || !titles.length
    || companies.some((row) => row.ImportacaoAutorizada !== 'False'
      || !row.Classificacao || !row.EmpresaPedido || !row.EmpresaFiscal)) {
    throw new Error('LEGACY_PURCHASE_SCOPE_UNPROVEN');
  }
  const integer = (value) => {
    if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) {
      throw new Error('LEGACY_PURCHASE_COUNTS_INVALID');
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error('LEGACY_PURCHASE_COUNTS_INVALID');
    return number;
  };
  const report = { mode: 'READ_ONLY_NO_IMPORT', companyComparisons: companies.length,
    blockedCompanyComparisons: companies.length, documentGroups: titles.length,
    documents: 0, titles: 0, openTitles: 0, paidTitles: 0,
    fiscalCompanyProven: false, reportIntegrityVerified: false,
    operationalImportAuthorized: false };
  const compositions = new Set();
  for (const row of titles) {
    if (!row.Composicao || compositions.has(row.Composicao)) {
      throw new Error('LEGACY_PURCHASE_COUNTS_INVALID');
    }
    compositions.add(row.Composicao);
    const documents = integer(row.QuantidadeDocumentos);
    const count = integer(row.QuantidadeTitulos);
    const open = integer(row.TitulosAbertos);
    const paid = integer(row.TitulosBaixados);
    if (open + paid !== count) throw new Error('LEGACY_PURCHASE_COUNTS_MISMATCH');
    report.documents += documents;
    report.titles += count;
    report.openTitles += open;
    report.paidTitles += paid;
  }
  if (![report.documents, report.titles, report.openTitles, report.paidTitles]
    .every(Number.isSafeInteger)) throw new Error('LEGACY_PURCHASE_COUNTS_INVALID');
  return report;
}

if (process.argv[1]?.endsWith('reconciliar-candidatos-privados.mjs')) {
  try {
    if (!process.argv[2]) throw new Error('LEGACY_ROOT_REQUIRED');
    if (process.argv.length > 4) throw new Error('LEGACY_MODE_INVALID');
    const report = process.argv[3] === '--purchase-financial'
      ? reconcilePrivatePurchaseFinance(process.argv[2])
      : process.argv[3]
      ? reconcilePrivateProductsWithTarget(process.argv[2], process.argv[3])
      : reconcilePrivateCandidates(process.argv[2]);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message.startsWith('LEGACY_') ? error.message : 'LEGACY_RECONCILIATION_FAILED'}\n`);
    process.exitCode = 1;
  }
}
