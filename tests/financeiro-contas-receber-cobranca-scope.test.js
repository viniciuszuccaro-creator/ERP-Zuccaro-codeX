import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ContasReceberTab carrega Empresa/Config cobranca via filterInContext', () => {
  const src = readFileSync('src/components/financeiro/ContasReceberTab.jsx', 'utf8');
  assert.match(src, /filterInContext/);
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /filterInContext\('ConfiguracaoCobrancaEmpresa'/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /base44\.entities\.ConfiguracaoCobrancaEmpresa\.list\(/);
  assert.match(src, /cobrancaMastersIndisponiveis|isErrorConfigsCobranca/);
  assert.match(src, /erro ≠ zero/);
});
