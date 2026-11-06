import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('BitolasDisponiveis lista Produto via filterInContext', () => {
  const src = readFileSync('src/components/producao/BitolasDisponiveis.jsx', 'utf8');
  assert.match(src, /filterInContext\('Produto'/);
  assert.doesNotMatch(src, /base44\.entities\.Produto\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /isErrorBitolas/);
  assert.match(src, /erro de carga ≠ zero/);
});
