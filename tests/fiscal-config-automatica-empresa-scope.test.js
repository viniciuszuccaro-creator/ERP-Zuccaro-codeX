import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ConfigFiscalAutomatica usa filterInContext/createInContext/updateInContext', () => {
  const src = readFileSync('src/components/fiscal/ConfigFiscalAutomatica.jsx', 'utf8');
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /filterInContext\('ConfigFiscalEmpresa'/);
  assert.match(src, /updateInContext\('ConfigFiscalEmpresa'/);
  assert.match(src, /createInContext\('ConfigFiscalEmpresa'/);
  assert.match(src, /createInContext\('AuditLog'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /ConfigFiscalEmpresa\.filter\(/);
  assert.doesNotMatch(src, /ConfigFiscalEmpresa\.update\(/);
  assert.doesNotMatch(src, /ConfigFiscalEmpresa\.create\(/);
  assert.match(src, /isErrorEmpresaFiscal/);
  assert.match(src, /erro ≠ zero|erro de carga ≠ zero/);
  assert.match(src, /enabled: contextoValido/);
});
