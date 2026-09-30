import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { reconcilePrivateCandidates } from '../scripts/legado/reconciliar-candidatos-privados.mjs';

const paths = {
  clientes: ['03_EXPORT_STAGING/CLIENTES/CLIENTES-LEGACY-TID-001/clientes-candidatos.csv', '05_QUARANTINE/CLIENTES/CLIENTES-LEGACY-TID-001/clientes-quarentena.csv', '04_REPORTS/legacy-client-nominal-staging-summary.json'],
  fornecedores: ['03_EXPORT_STAGING/FORNECEDORES/FORNECEDORES-LEGACY-TID-001/fornecedores-candidatos.csv', '05_QUARANTINE/FORNECEDORES/FORNECEDORES-LEGACY-TID-001/fornecedores-quarentena.csv', '04_REPORTS/legacy-supplier-nominal-staging-summary.json'],
  produtos_revenda: ['03_EXPORT_STAGING/PRODUTOS/PRODUTOS-LEGACY-TID-001/produtos-revenda-candidatos.csv', '05_QUARANTINE/PRODUTOS/PRODUTOS-LEGACY-TID-001/produtos-revenda-quarentena.csv', '04_REPORTS/legacy-product-nominal-staging-summary.json'],
};

function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'legacy-reconcile-'));
  const write = (relative, content) => {
    const file = join(root, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  for (const [entity, [candidate, quarantine, summary]] of Object.entries(paths)) {
    const row = {
      group_id: 'synthetic-group', empresa_id: '', codigo_legado: `synthetic-${entity}`,
      import_authorized: 'false', cnpj: '12345678000199', cpf_cnpj: '12345678000199',
      ...overrides[entity],
    };
    const header = Object.keys(row);
    const candidateContent = `${header.join(',')}\n${Object.values(row).join(',')}\n`;
    const quarantineRow = overrides.quarantine?.[entity];
    const quarantineContent = `${header.join(',')}\n${quarantineRow ? `${header.map((key) => quarantineRow[key] ?? row[key]).join(',')}\n` : ''}`;
    const quarantineCount = quarantineRow ? 1 : 0;
    write(candidate, candidateContent);
    write(quarantine, quarantineContent);
    const hash = (content) => createHash('sha256').update(content).digest('hex');
    const counts = entity === 'clientes'
      ? { sourceRows: 1 + quarantineCount, acceptedCandidates: 1, quarantinedRows: quarantineCount }
      : entity === 'fornecedores'
        ? { totals: { source_rows: 1 + quarantineCount, candidates: 1, quarantine: quarantineCount } }
        : { source_rows: 1 + quarantineCount, candidate_rows: 1, quarantine_rows: quarantineCount };
    const integrity = entity === 'produtos_revenda'
      ? { candidate_sha256: hash(candidateContent), quarantine_sha256: hash(quarantineContent) }
      : entity === 'clientes'
        ? { files: [{ name: candidate.split('/').at(-1), sha256: hash(candidateContent) }, { name: quarantine.split('/').at(-1), sha256: hash(quarantineContent) }] }
        : { artifacts: [{ relative_path: candidate, sha256: hash(candidateContent) }, { relative_path: quarantine, sha256: hash(quarantineContent) }] };
    const importState = entity === 'clientes'
      ? { importAuthorized: false, directImportPerformed: false }
      : { import_authorized: false, direct_import_performed: false };
    write(summary, `${entity === 'produtos_revenda' ? '\uFEFF' : ''}${JSON.stringify({ ...counts, ...integrity, ...importState, ...overrides.summary })}`);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('reconciles synthetic master extracts without returning identifiers', () => {
  const data = fixture();
  try {
    const report = reconcilePrivateCandidates(data.root);
    assert.equal(report.entities.clientes.candidates, 1);
    assert.equal(report.entities.clientes.fileHashesVerified, true);
    assert.equal(report.entities.clientes.companyScopedRows, 0);
    assert.equal(report.crossRoleDocumentOverlap, 1);
    assert.equal(report.crossRoleOverlapIsTentative, true);
    assert.equal(report.operationalImportAuthorized, false);
    assert.doesNotMatch(JSON.stringify(report), /12345678000199|synthetic-group|synthetic-clientes/);
  } finally { data.cleanup(); }
});

test('rejects mismatched private counts without exposing a row', () => {
  const data = fixture({ summary: { sourceRows: 2 } });
  try { assert.throws(() => reconcilePrivateCandidates(data.root), { message: 'LEGACY_COUNTS_MISMATCH:clientes' }); }
  finally { data.cleanup(); }
});

test('rejects company-scoped master and import authorization', () => {
  for (const values of [{ empresa_id: 'other-company' }, { import_authorized: 'true' }]) {
    const data = fixture({ clientes: values });
    try { assert.throws(() => reconcilePrivateCandidates(data.root), /LEGACY_(SCOPE|IMPORT_FLAG)_INVALID:clientes/); }
    finally { data.cleanup(); }
  }
});

test('rejects unreadable input with sanitized error', () => {
  assert.throws(() => reconcilePrivateCandidates('missing-private-root'), { message: 'LEGACY_INPUT_UNREADABLE:clientes' });
});

test('rejects a changed private CSV before considering its rows', () => {
  const data = fixture();
  try {
    writeFileSync(join(data.root, paths.clientes[0]), 'group_id,codigo_legado\nchanged,private\n');
    assert.throws(() => reconcilePrivateCandidates(data.root), { message: 'LEGACY_HASH_MISMATCH:clientes' });
  } finally { data.cleanup(); }
});

test('rejects missing legacy code and cross-group masters', () => {
  for (const values of [{ codigo_legado: '' }, { group_id: 'different-group' }]) {
    const data = fixture({ fornecedores: values });
    try { assert.throws(() => reconcilePrivateCandidates(data.root), /LEGACY_(CODE|SCOPE)_INVALID:fornecedores/); }
    finally { data.cleanup(); }
  }
});

test('counts quarantined overlap and foreign scope without releasing values', () => {
  const data = fixture({ quarantine: { clientes: { group_id: 'foreign-group', empresa_id: 'foreign-company' } } });
  try {
    const report = reconcilePrivateCandidates(data.root);
    assert.equal(report.entities.clientes.candidateQuarantineCodeOverlap, 1);
    assert.equal(report.entities.clientes.quarantineCompanyRows, 1);
    assert.equal(report.entities.clientes.quarantineOtherGroupRows, 1);
    assert.doesNotMatch(JSON.stringify(report), /foreign-group|foreign-company/);
  } finally { data.cleanup(); }
});

test('rejects import authorization in summary or quarantine', () => {
  const summary = fixture({ summary: { importAuthorized: true } });
  try { assert.throws(() => reconcilePrivateCandidates(summary.root), { message: 'LEGACY_SUMMARY_IMPORT_STATE_INVALID:clientes' }); }
  finally { summary.cleanup(); }
  const quarantine = fixture({ quarantine: { clientes: { import_authorized: 'true' } } });
  try { assert.throws(() => reconcilePrivateCandidates(quarantine.root), { message: 'LEGACY_QUARANTINE_IMPORT_FLAG_INVALID:clientes' }); }
  finally { quarantine.cleanup(); }
});
