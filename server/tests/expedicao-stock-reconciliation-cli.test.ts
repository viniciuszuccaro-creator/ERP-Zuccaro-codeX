import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('CLI offline relata somente agregados, falha fechado e não imprime IDs/saldos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'erp-stock-reconcile-'));
  try {
    const source = join(dir, 'source.json');
    const ledger = join(dir, 'ledger.json');
    const cutoff = '2026-10-06T12:00:00Z';
    const row = { groupId: 'private-group', empresaId: 'private-company', produtoId: 'private-product',
      unidadeId: 'kg', quantidade: '123.456789', evidenceId: 'private-evidence' };
    await writeFile(source, JSON.stringify({ cutoff, rows: [row] }));
    await writeFile(ledger, JSON.stringify({ cutoff, rows: [{ ...row, quantidade: '123.456788' }] }));
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/reconcileExpedicaoStock.ts', source, ledger],
      { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ready: false, sourceCount: 1, ledgerCount: 1,
      compared: 1, conflicts: { QUANTITY_MISMATCH: 1 } });
    assert.doesNotMatch(result.stdout + result.stderr, /private-|123\.456/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
