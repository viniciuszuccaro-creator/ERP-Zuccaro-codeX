import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('UsuarioForm lista PerfilAcesso via filterInContext', () => {
  const src = readFileSync('src/components/cadastros/UsuarioForm.jsx', 'utf8');
  assert.match(src, /filterInContext\('PerfilAcesso'/);
  assert.match(src, /queryKey:\s*\['perfis-acesso',\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.PerfilAcesso\.list\(/);
  assert.match(src, /isErrorPerfis/);
  assert.match(src, /Contagem de perfis indisponível|≠ zero/);
});
