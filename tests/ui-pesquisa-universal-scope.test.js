import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PesquisaUniversal consulta via filtrarPorContexto sem list unscoped', () => {
  const src = readFileSync('src/components/PesquisaUniversal.jsx', 'utf8');
  assert.match(src, /filtrarPorContexto\('Cliente'/);
  assert.match(src, /filtrarPorContexto\('Pedido'/);
  assert.match(src, /filtrarPorContexto\('Produto'/);
  assert.doesNotMatch(src, /entities\.\w+\.list\(/);
  assert.match(src, /contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});
