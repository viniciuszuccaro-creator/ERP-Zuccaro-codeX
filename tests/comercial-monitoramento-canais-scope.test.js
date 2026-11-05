import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('MonitoramentoCanaisRealtime usa filterInContext sem list unscoped', () => {
  const src = readFileSync('src/components/comercial/MonitoramentoCanaisRealtime.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.doesNotMatch(src, /Pedido\.list\(/);
  assert.doesNotMatch(src, /ParametroOrigemPedido\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});
