import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GrupoEmpresarialForm lista Empresa via filterInContext', () => {
  const src = readFileSync('src/components/cadastros/GrupoEmpresarialForm.jsx', 'utf8');
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /group_id:\s*groupId/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.match(src, /isErrorEmpresas/);
  assert.match(src, /Contagem de empresas indisponível|≠ zero/);
});
