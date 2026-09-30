import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
    write(candidate, `${header.join(',')}\n${Object.values(row).join(',')}\n`);
    write(quarantine, `${header.join(',')}\n`);
    const counts = entity === 'clientes'
      ? { sourceRows: 1, acceptedCandidates: 1, quarantinedRows: 0 }
      : entity === 'fornecedores'
        ? { totals: { source_rows: 1, candidates: 1, quarantine: 0 } }
        : { source_rows: 1, candidate_rows: 1, quarantine_rows: 0 };
    write(summary, `${entity === 'produtos_revenda' ? '\uFEFF' : ''}${JSON.stringify({ ...counts, ...overrides.summary })}`);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('reconciles synthetic master extracts without returning identifiers', () => {
  const data = fixture();
  try {
    const report = reconcilePrivateCandidates(data.root);
    assert.equal(report.entities.clientes.candidates, 1);
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

test('rejects missing legacy code and cross-group masters', () => {
  for (const values of [{ codigo_legado: '' }, { group_id: 'different-group' }]) {
    const data = fixture({ fornecedores: values });
    try { assert.throws(() => reconcilePrivateCandidates(data.root), /LEGACY_(CODE|SCOPE)_INVALID:fornecedores/); }
    finally { data.cleanup(); }
  }
});
