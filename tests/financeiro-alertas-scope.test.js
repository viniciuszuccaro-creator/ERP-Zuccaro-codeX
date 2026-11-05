import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AlertasFinanceirosEmpresa usa filterInContext sem list/filter unscoped', () => {
  const src = readFileSync('src/components/financeiro/AlertasFinanceirosEmpresa.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\('ContaPagar'/);
  assert.match(src, /filterInContext\('ContaReceber'/);
  assert.match(src, /filterInContext\('ConciliacaoBancaria'/);
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.(ContaPagar|ContaReceber|ConciliacaoBancaria|Pedido)\.(list|filter)\(/);
  assert.match(src, /cargaIndisponivel|isErrorPagar/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /!cargaIndisponivel && contextoValido && alertas\.every/);
});
