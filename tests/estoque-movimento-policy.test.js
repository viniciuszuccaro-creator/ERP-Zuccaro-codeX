import {
  assertMovimentacaoEstoque,
  configAllowsNegativeStock,
  findDuplicateMovement,
  resolveNextEstoque,
  resolveSignedQuantity,
} from '../src/components/lib/estoqueMovimentoPolicy.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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

test('missing movement type fails closed instead of defaulting to entrada', () => {
  assert.throws(
    () => resolveSignedQuantity({ quantidade: 5 }),
    /Tipo de movimentacao obrigatorio/,
  );
  assert.equal(resolveSignedQuantity({ tipo_movimento: 'Saída', quantidade: 3 }), -3);
  assert.equal(resolveSignedQuantity({ tipo_movimentacao: 'Entrada', quantidade: 2 }), 2);
  assert.equal(resolveSignedQuantity({ tipo_movimento: 'transferencia_saida', quantidade: 4 }), -4);
  assert.equal(resolveSignedQuantity({ tipo_movimento: 'transferencia_entrada', quantidade: 4 }), 4);
});

test('negative stock config requires group or company scope', () => {
  assert.equal(configAllowsNegativeStock([
    { chave: 'estoque_permite_saldo_negativo', valor: 'true' },
  ], { groupId: 'g1', empresaId: 'cpa-aco' }), false);
  assert.equal(configAllowsNegativeStock([
    { chave: 'estoque_permite_saldo_negativo', valor: 'true', group_id: 'g1', empresa_id: 'cpa-aco' },
  ], { groupId: 'g1', empresaId: 'cpa-aco' }), true);
  assert.equal(configAllowsNegativeStock([
    { chave: 'estoque_permite_saldo_negativo', valor: 'true', group_id: 'outro', empresa_id: 'cpa-aco' },
  ], { groupId: 'g1', empresaId: 'cpa-aco' }), false);
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
  const inv = await readFile(new URL('../src/components/estoque/InventarioForm.jsx', import.meta.url), 'utf8');
  const transfer = await readFile(new URL('../src/components/estoque/TransferenciaEntreEmpresasForm.jsx', import.meta.url), 'utf8');
  const applyInv = await readFile(new URL('../base44/functions/applyInventoryAdjustments/entry.ts', import.meta.url), 'utf8');
  const validation = await readFile(new URL('../base44/functions/_lib/validationUtils/entry.ts', import.meta.url), 'utf8');
  const controle = await readFile(new URL('../src/components/estoque/ControleEstoqueCompleto.jsx', import.meta.url), 'utf8');

  assert.match(client, /applyLocalEstoqueMovimento/);
  assert.match(client, /Exclusao de historico bloqueada/);
  assert.match(client, /MovimentacaoEstoque: \{ module: 'Estoque'/);
  assert.doesNotMatch(tab, /Movimentacao deixaria o estoque negativo/);
  assert.match(tab, /tipo_movimento: tipoMovimento/);
  assert.match(inv, /podeAprovar = canApprove/);
  assert.doesNotMatch(inv, /podeAprovar = canApprove\('Estoque', 'Inventário'\) \|\| canApprove\('Estoque', 'Inventario'\) \|\| canEdit/);
  assert.match(inv, /applyInventoryAdjustments/);
  assert.match(transfer, /transferencia_saida/);
  assert.match(transfer, /transferencia_entrada/);
  assert.doesNotMatch(transfer, /hasPermission\('Estoque', null, 'criar'\)/);
  assert.match(applyInv, /'aprovar'/);
  assert.match(validation, /if \(!data \|\| typeof data !== 'object'\) return false/);
  assert.match(controle, /canApprove\('Estoque', 'Inventario'\)/);
  assert.doesNotMatch(controle, /updateInContext\('Produto', produtoId, \{\s*estoque_atual: quantidadeContada/);
});
