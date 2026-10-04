import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('migration 030 é aditiva: snapshot promoção Orçamento/Pedido', async () => {
  const source = await readFile(new URL('../migrations/030_orcamento_pedido_promocao_snapshot.sql', import.meta.url), 'utf8');
  for (const token of [
    'ADD COLUMN IF NOT EXISTS promocao_bps',
    'ADD COLUMN IF NOT EXISTS promocao_cupom',
    'ADD COLUMN IF NOT EXISTS promocao_aplicada',
    'orcamentos_promocao_snapshot_pair',
    'pedidos_promocao_snapshot_pair',
    'promocao_aplicada = true',
    'promocao_bps <= 10000',
  ]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
  const executable = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(executable, /\bDROP TABLE\b/i);
  assert.doesNotMatch(executable, /\bTRUNCATE\b/i);
  assert.doesNotMatch(executable, /\bDROP COLUMN\b/i);
  assert.ok(!source.includes('025_') && !source.includes('026_') && !source.includes('027_') && !source.includes('028_'));
});
