import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('migration 031 é aditiva: snapshot TabelaPreco codigo+nome Orçamento/Pedido', async () => {
  const source = await readFile(new URL('../migrations/031_orcamento_pedido_tabela_snapshot.sql', import.meta.url), 'utf8');
  for (const token of [
    'ADD COLUMN IF NOT EXISTS tabela_preco_codigo_snapshot',
    'ADD COLUMN IF NOT EXISTS tabela_preco_nome_snapshot',
    'orcamentos_tabela_snapshot_pair',
    'pedidos_tabela_snapshot_pair',
  ]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
  assert.ok(source.includes('031'));
  assert.doesNotMatch(source, /025_|026_|027_|028_/);
  const executable = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(executable, /\bDROP TABLE\b/i);
  assert.doesNotMatch(executable, /\bTRUNCATE\b/i);
  assert.doesNotMatch(executable, /\bDROP COLUMN\b/i);
});
