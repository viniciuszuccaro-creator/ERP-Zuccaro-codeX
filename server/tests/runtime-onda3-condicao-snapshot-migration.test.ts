import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('migration 025 é aditiva: snapshot condição Orçamento/Pedido + tabela_preco no Orçamento', async () => {
  const source = await readFile(new URL('../migrations/025_orcamento_pedido_condicao_snapshot.sql', import.meta.url), 'utf8');
  for (const token of [
    'ADD COLUMN IF NOT EXISTS condicao_pagamento_codigo_snapshot',
    'ADD COLUMN IF NOT EXISTS condicao_pagamento_nome_snapshot',
    'ADD COLUMN IF NOT EXISTS condicao_pagamento_parcelas_snapshot',
    'ADD COLUMN IF NOT EXISTS tabela_preco_id',
    'orcamentos_condicao_snapshot_pair',
    'pedidos_condicao_snapshot_pair',
    'assert_orcamento_same_tenant',
    'TENANT_FK_MISMATCH: tabela_preco outside scope',
  ]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
  // Somente comentários de rollback podem mencionar DROP; o DDL executável é aditivo.
  const executable = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(executable, /\bDROP TABLE\b/i);
  assert.doesNotMatch(executable, /\bTRUNCATE\b/i);
  assert.doesNotMatch(executable, /\bDROP COLUMN\b/i);
});
