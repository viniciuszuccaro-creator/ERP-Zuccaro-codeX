import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ContasPagarTab lista Empresa via filterInContext', () => {
  const src = readFileSync('src/components/financeiro/ContasPagarTab.jsx', 'utf8');
  assert.match(src, /filterInContext/);
  assert.match(src, /filterInContext\('Empresa'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.match(src, /isErrorEmpresasPagar/);
  assert.match(src, /erro de carga ≠ zero/);
});
