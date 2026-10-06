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
  assert.deepEqual(codes(snapshot([row({ quantidade: '0' })]), snapshot([])), ['MISSING_LEDGER']);
  assert.deepEqual(codes(snapshot([]), snapshot([row({ quantidade: '0' })])), ['MISSING_SOURCE']);
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

test('linhas sem evidência, quantidade negativa/imprecisa e corte inválido falham fechado', () => {
  assert.ok(codes(snapshot([row({ evidenceId: '' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([row({ quantidade: '-1' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([row({ quantidade: '1.0000001' })]), snapshot([])).includes('INVALID_ROW'));
  assert.ok(codes(snapshot([],'not-a-date'), snapshot([])).includes('INVALID_SNAPSHOT'));
});
