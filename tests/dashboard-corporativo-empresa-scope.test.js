import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DashboardCorporativo fail-closed sem list unscoped', () => {
  const src = readFileSync('src/pages/DashboardCorporativo.jsx', 'utf8');
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /Pedido\.list\(/);
  assert.doesNotMatch(src, /Cliente\.list\(/);
  assert.doesNotMatch(src, /Produto\.list\(/);
  assert.doesNotMatch(src, /ContaReceber\.list\(/);
  assert.doesNotMatch(src, /ContaPagar\.list\(/);
  assert.doesNotMatch(src, /Entrega\.list\(/);
  assert.doesNotMatch(src, /OrdemProducao\.list\(/);
  assert.match(src, /scopeFilter/);
  assert.match(src, /enabled: contextoValido && !!scopeFilter/);
  assert.match(src, /empresasDoGrupo/);
  assert.match(src, /mastersCorpIndisponiveis/);
  assert.match(src, /erro de carga ≠ zero/);
});
