import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ConciliacaoBancaria lista Empresa via filterInContext e fail-closed sem empresa', () => {
  const src = readFileSync('src/components/financeiro/ConciliacaoBancaria.jsx', 'utf8');
  assert.match(src, /filterInContext/);
  assert.match(src, /filterInContext\('Empresa'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.match(src, /isErrorEmpresasConciliacao/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /buildFinanceiroQueryScopeKey/);
  assert.match(src, /enabled: contextoValido && !!empresaSelecionada/);
  assert.doesNotMatch(src, /ExtratoBancario\.list\(/);
  assert.doesNotMatch(src, /ConciliacaoBancaria\.list\(/);
  assert.doesNotMatch(src, /CaixaMovimento\.list\(/);
});
