import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DuplicarMesAnterior usa filterInContext/createInContext e exige empresa', () => {
  const src = readFileSync('src/components/financeiro/DuplicarMesAnterior.jsx', 'utf8');
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /filterInContext\('ConfiguracaoDespesaRecorrente'/);
  assert.match(src, /filterInContext\('ContaPagar'/);
  assert.match(src, /createInContext\('ContaPagar'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /ConfiguracaoDespesaRecorrente\.list\(/);
  assert.doesNotMatch(src, /ContaPagar\.bulkCreate\(/);
  assert.match(src, /isErrorEmpresasDuplicar/);
  assert.match(src, /erro de carga ≠ zero|erro ≠ zero/);
  assert.match(src, /enabled: contextoValido && dialogOpen && !!empresaSelecionada/);
});
