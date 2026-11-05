import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ConfiguracaoCobranca usa filter/create/update InContext', () => {
  const src = readFileSync('src/components/financeiro/ConfiguracaoCobranca.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\('ConfiguracaoCobrancaEmpresa'/);
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /createInContext\('ConfiguracaoCobrancaEmpresa'/);
  assert.match(src, /updateInContext\('ConfiguracaoCobrancaEmpresa'/);
  assert.match(src, /queryKey:\s*\['configs-cobranca',\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.ConfiguracaoCobrancaEmpresa\.(list|create|update)\(/);
  assert.match(src, /isErrorConfigs|isErrorEmpresas/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /disabled=\{salvarMutation\.isPending \|\| !contextoValido/);
});
