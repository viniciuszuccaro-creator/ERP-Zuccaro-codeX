import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PontoForm lista Colaborador via filterInContext', () => {
  const src = readFileSync('src/components/rh/PontoForm.jsx', 'utf8');
  assert.match(src, /filterInContext\('Colaborador'/);
  assert.match(src, /queryKey:\s*\['colaboradores-ponto-form',\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.Colaborador\.list\(/);
  assert.match(src, /isErrorColaboradores/);
  assert.match(src, /Contagem de colaboradores indisponível|≠ zero/);
});
