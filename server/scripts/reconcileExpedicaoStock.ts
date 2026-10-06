import { readFile, stat } from 'node:fs/promises';
import { reconcileExpedicaoStock, type StockSnapshot } from '../src/services/expedicaoStockReconciliation.ts';

async function readSnapshot(path: string): Promise<StockSnapshot> {
  if ((await stat(path)).size > 16 * 1024 * 1024) throw new Error('SNAPSHOT_SIZE_LIMIT');
  const bytes = await readFile(path);
  if (bytes.length > 16 * 1024 * 1024) throw new Error('SNAPSHOT_SIZE_LIMIT');
  return JSON.parse(bytes.toString('utf8')) as StockSnapshot;
}

async function main(): Promise<void> {
  const [sourcePath, ledgerPath, extra] = process.argv.slice(2);
  if (!sourcePath || !ledgerPath || extra) throw new Error('USAGE_SOURCE_LEDGER_PATHS');
  const report = reconcileExpedicaoStock(await readSnapshot(sourcePath), await readSnapshot(ledgerPath));
  const conflicts = Object.fromEntries([...new Set(report.issues.map((issue) => issue.code))]
    .sort().map((code) => [code, report.issues.filter((issue) => issue.code === code).length]));
  process.stdout.write(`${JSON.stringify({ ready: report.ready, sourceCount: report.sourceCount,
    ledgerCount: report.ledgerCount, compared: report.compared, conflicts })}\n`);
  if (!report.ready) process.exitCode = 2;
}

main().catch((error: unknown) => {
  // Never log paths, JSON contents, database details, or source-controlled data.
  const safe = error instanceof Error && ['SNAPSHOT_SIZE_LIMIT', 'USAGE_SOURCE_LEDGER_PATHS'].includes(error.message)
    ? error.message : 'SNAPSHOT_READ_OR_PARSE_FAILED';
  process.stderr.write(`${safe}\n`);
  process.exitCode = 2;
});
