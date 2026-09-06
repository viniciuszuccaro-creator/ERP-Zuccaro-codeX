import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertMovimentacaoEstoque,
  findDuplicateMovement,
  resolveNextEstoque,
} from '../src/components/lib/estoqueMovimentoPolicy.js';

const produto = { id: 'prod-1', estoque_atual: 10, empresa_id: 'cpa-aco' };

test('stock outflow without policy cannot go negative', () => {
  assert.throws(
    () => assertMovimentacaoEstoque({
      record: {
        empresa_id: 'cpa-aco',
        produto_id: 'prod-1',
        tipo_movimento: 'Saída',
        quantidade: 12,
        origem_movimento: 'manual',
        documento: 'MOV-1',
      },
      produto,
    }),
    /Saldo negativo sem politica/,
  );
});

test('retry with the same origin does not create a second movement', () => {
  const record = {
    empresa_id: 'cpa-aco',
    produto_id: 'prod-1',
    tipo_movimento: 'saida',
    quantidade: 2,
    origem_movimento: 'pedido',
    origem_documento_id: 'ped-9',
    documento: 'PED-000009',
  };
  const existing = { ...record, id: 'mov-1' };
  assert.equal(findDuplicateMovement(record, [existing])?.id, 'mov-1');
  assert.equal(assertMovimentacaoEstoque({ record, produto, movements: [existing] }).reuse.id, 'mov-1');
});

test('movement of another company against a company-owned product is blocked', () => {
  assert.throws(
    () => assertMovimentacaoEstoque({
      record: {
        empresa_id: '3z',
        produto_id: 'prod-1',
        tipo_movimento: 'Entrada',
        quantidade: 1,
        origem_movimento: 'compra',
        documento: 'NF-1',
      },
      produto,
    }),
    /empresa errada/,
  );
});

test('explicit next balance from inventory is applied as a set, not a delta', () => {
  const { next } = resolveNextEstoque({
    produto,
    record: { tipo_movimento: 'ajuste', quantidade: 3, estoque_atual: 7 },
  });
  assert.equal(next, 7);
});

test('stock persistence owns the product balance and history cannot be deleted', async () => {
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/estoque/MovimentacoesTab.jsx', import.meta.url), 'utf8');
  assert.match(client, /applyLocalEstoqueMovimento/);
  assert.match(client, /Exclusao de historico bloqueada/);
  assert.doesNotMatch(tab, /Movimentacao deixaria o estoque negativo/);
});
