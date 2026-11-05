import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PedidosRetiradaTab lista Pedido via filterInContext', () => {
  const src = readFileSync('src/components/comercial/PedidosRetiradaTab.jsx', 'utf8');
  assert.match(src, /filterInContext\('Pedido'/);
  assert.doesNotMatch(src, /entities\.Pedido\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});
