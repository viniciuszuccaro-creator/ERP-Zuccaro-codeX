import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ImportadorProdutosPlanilha lista Grupo/Empresa via filterInContext', () => {
  const src = readFileSync('src/components/estoque/ImportadorProdutosPlanilha.jsx', 'utf8');
  assert.match(src, /filterInContext\('GrupoEmpresarial'/);
  assert.match(src, /filterInContext\('Empresa'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /GrupoEmpresarial\.list\(/);
  assert.match(src, /isErrorEmpresasImportador/);
  assert.match(src, /erro de carga ≠ zero/);
});
