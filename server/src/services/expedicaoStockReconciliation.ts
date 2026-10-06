/** Offline comparison only. Never creates opening balances or writes to a database. */
export type StockSnapshot = {
  cutoff: string;
  rows: Array<{
    groupId: string;
    empresaId: string;
    produtoId: string;
    unidadeId: string;
    quantidade: string;
    evidenceId: string;
  }>;
};

export type StockIssue = {
  code: 'INVALID_SNAPSHOT' | 'EMPTY_SNAPSHOT' | 'CUTOFF_MISMATCH' | 'INVALID_ROW' | 'DUPLICATE_KEY' | 'MISSING_SOURCE' | 'MISSING_LEDGER' | 'UNIT_MISMATCH' | 'QUANTITY_MISMATCH';
  side?: 'source' | 'ledger';
  key?: string;
};

const id = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const decimal = /^(0|[1-9]\d{0,11})(?:\.(\d{1,6}))?$/;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function micros(value: string): bigint | null {
  const match = decimal.exec(value);
  return match ? BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? '').padEnd(6, '0')) : null;
}

function validCutoff(value: unknown): value is string {
  if (typeof value !== 'string' || !utc.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const canonical = new Date(parsed).toISOString();
  const expected = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fractional: string | undefined) =>
    `.${(fractional ?? '').padEnd(3, '0')}Z`);
  return canonical === expected;
}

type ValidRow = StockSnapshot['rows'][number] & { amount: bigint; key: string };

export function reconcileExpedicaoStock(source: StockSnapshot, ledger: StockSnapshot): {
  ready: boolean;
  compared: number;
  sourceCount: number;
  ledgerCount: number;
  issues: StockIssue[];
} {
  const issues: StockIssue[] = [];
  const parsed = (snapshot: StockSnapshot, side: 'source' | 'ledger'): Map<string, ValidRow> => {
    const found = new Map<string, ValidRow>();
    if (!snapshot || !validCutoff(snapshot.cutoff) || !Array.isArray(snapshot.rows) || snapshot.rows.length > 100_000) {
      issues.push({ code: 'INVALID_SNAPSHOT', side });
      return found;
    }
    snapshot.rows.forEach((row, index) => {
      const fields = row && [row.groupId, row.empresaId, row.produtoId, row.unidadeId, row.evidenceId];
      const amount = row && typeof row.quantidade === 'string' ? micros(row.quantidade) : null;
      if (!fields || fields.some((field) => typeof field !== 'string' || !id.test(field)) || amount === null) {
        issues.push({ code: 'INVALID_ROW', side, key: `row:${index}` });
        return;
      }
      const key = `${row.groupId}/${row.empresaId}/${row.produtoId}`;
      // Ledger PK has no unit: two units for the same product cannot be summed.
      if (found.has(key)) {
        issues.push({ code: 'DUPLICATE_KEY', side, key });
        return;
      }
      found.set(key, { ...row, amount, key });
    });
    return found;
  };
  const left = parsed(source, 'source');
  const right = parsed(ledger, 'ledger');
  if (left.size === 0) issues.push({ code: 'EMPTY_SNAPSHOT', side: 'source' });
  if (right.size === 0) issues.push({ code: 'EMPTY_SNAPSHOT', side: 'ledger' });
  if (validCutoff(source?.cutoff) && validCutoff(ledger?.cutoff) && Date.parse(source.cutoff) !== Date.parse(ledger.cutoff)) {
    issues.push({ code: 'CUTOFF_MISMATCH' });
  }
  let compared = 0;
  for (const [key, row] of left) {
    const counterpart = right.get(key);
    if (!counterpart) {
      issues.push({ code: 'MISSING_LEDGER', key });
      continue;
    }
    compared++;
    if (row.unidadeId !== counterpart.unidadeId) issues.push({ code: 'UNIT_MISMATCH', key });
    if (row.amount !== counterpart.amount) issues.push({ code: 'QUANTITY_MISMATCH', key });
  }
  for (const key of right.keys()) if (!left.has(key)) issues.push({ code: 'MISSING_SOURCE', key });
  return { ready: issues.length === 0, compared, sourceCount: left.size, ledgerCount: right.size, issues };
}
