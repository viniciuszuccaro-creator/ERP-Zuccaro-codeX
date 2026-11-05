import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DashboardFechamentoPedidos usa filterInContext sem list unscoped', () => {
  const src = readFileSync('src/components/comercial/DashboardFechamentoPedidos.jsx', 'utf8');
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /filterInContext\('MovimentacaoEstoque'/);
  assert.match(src, /filterInContext\('ContaReceber'/);
  assert.match(src, /filterInContext\('Entrega'/);
  assert.doesNotMatch(src, /\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});
