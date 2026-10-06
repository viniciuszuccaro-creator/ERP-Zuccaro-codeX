import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileExpedicaoStock, type StockSnapshot } from '../src/services/expedicaoStockReconciliation.ts';

const cutoff = '2026-10-06T12:00:00.000Z';
const row = (overrides: Partial<StockSnapshot['rows'][number]> = {}) => ({
  groupId: 'groupA', empresaId: 'companyA', produtoId: 'productA', unidadeId: 'kg',
  quantidade: '1.000001', evidenceId: 'synthetic-fixture-1', ...overrides,
});
const snapshot = (rows: StockSnapshot['rows'], at = cutoff): StockSnapshot => ({ cutoff: at, rows });
const codes = (source: StockSnapshot, ledger: StockSnapshot) => reconcileExpedicaoStock(source, ledger).issues.map((issue) => issue.code);

test('saldo equivalente com precisão de 6 casas e escopo explícito é candidato, sem escrever abertura', () => {
  const report = reconcileExpedicaoStock(snapshot([row()]), snapshot([row({ quantidade: '1.000001' })]));
  assert.deepEqual(report, { ready: true, compared: 1, sourceCount: 1, ledgerCount: 1, issues: [] });
});

test('ausência em qualquer lado não vira zero, mesmo com saldo zero explícito', () => {
  assert.deepEqual(codes(snapshot([row({ quantidade: '0' })]), snapshot([])), ['EMPTY_SNAPSHOT', 'MISSING_LEDGER']);
  assert.deepEqual(codes(snapshot([]), snapshot([row({ quantidade: '0' })])), ['EMPTY_SNAPSHOT', 'MISSING_SOURCE']);
});

test('dois snapshots vazios nunca liberam abertura ou ativação', () => {
  assert.deepEqual(codes(snapshot([]), snapshot([])), ['EMPTY_SNAPSHOT', 'EMPTY_SNAPSHOT']);
});

test('Grupo/Empresa/produto não se cruzam e unidade não é convertida implicitamente', () => {
  assert.deepEqual(codes(snapshot([row()]), snapshot([row({ empresaId: 'companyB' })])), ['MISSING_LEDGER', 'MISSING_SOURCE']);
  assert.deepEqual(codes(snapshot([row()]), snapshot([row({ unidadeId: 't' })])), ['UNIT_MISMATCH']);
});

test('quantidade distinta, corte distinto e duplicidade são conflitos bloqueantes', () => {
  assert.deepEqual(codes(snapshot([row()]), snapshot([row({ quantidade: '1.000002' })])), ['QUANTITY_MISMATCH']);
  assert.deepEqual(codes(snapshot([row()]), snapshot([row()], '2026-10-06T12:00:01.000Z')), ['CUTOFF_MISMATCH']);
  assert.deepEqual(codes(snapshot([row(), row({ evidenceId: 'synthetic-fixture-2' })]), snapshot([row()])), ['DUPLICATE_KEY']);
});

test('cortes UTC equivalentes com precisão textual diferente passam; calendário impossível falha', () => {
  assert.equal(reconcileExpedicaoStock(snapshot([row()], '2026-10-06T12:00:00Z'), snapshot([row()], '2026-10-06T12:00:00.00Z')).ready, true);
  assert.ok(codes(snapshot([row()], '2026-02-30T12:00:00Z'), snapshot([row()])).includes('INVALID_SNAPSHOT'));
});

test('unidades distintas do mesmo produto não são somadas (chave sem unidade = DUPLICATE_KEY)', () => {
  assert.deepEqual(
    codes(snapshot([row(), row({ unidadeId: 't', evidenceId: 'synthetic-fixture-2' })]), snapshot([row()])),
    ['DUPLICATE_KEY'],
  );
  const report = reconcileExpedicaoStock(
    snapshot([row({ quantidade: '1' }), row({ unidadeId: 't', quantidade: '2', evidenceId: 'synthetic-fixture-2' })]),
    snapshot([row({ quantidade: '3' })]),
  );
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === 'DUPLICATE_KEY'));
});

test('linhas sem evidência, quantidade negativa/imprecisa e corte inválido falham fechado', () => {
  assert.ok(codes(snapshot([row({ evidenceId: '' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([row({ quantidade: '-1' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([row({ quantidade: '1.0000001' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([],'not-a-date'), snapshot([])).includes('INVALID_SNAPSHOT'));
});

test('fixture sanitizada não afirma extração real nem ready', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const fixture = JSON.parse(readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures/expedicao-stock-reconciliation-sanitized.json'),
    'utf8',
  ));
  assert.equal(fixture.counts.compared, 0);
  assert.equal(fixture.doesNotInventOpeningBalance, true);
  assert.equal(fixture.provenance.origin, 'NOT_EXTRACTED');
  assert.equal(fixture.readyMeansLoad, false);
  assert.ok(Array.isArray(fixture.blocked) && fixture.blocked.includes('B5_PRIVATE_SNAPSHOTS'));
  assert.equal(fixture.provenance.remoteDevMeta?.pedidoEstoqueSideEffects ?? null, null);
});
