import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AcoesRapidasGlobal lista Cliente via filterInContext', () => {
  const src = readFileSync('src/components/AcoesRapidasGlobal.jsx', 'utf8');
  assert.match(src, /filterInContext\('Cliente'/);
  assert.doesNotMatch(src, /entities\.Cliente\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});
