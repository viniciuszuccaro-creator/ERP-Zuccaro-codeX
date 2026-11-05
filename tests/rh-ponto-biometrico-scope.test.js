import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PontoEletronicoBiometrico lista Colaborador/Ponto via filterInContext', () => {
  const src = readFileSync('src/components/rh/PontoEletronicoBiometrico.jsx', 'utf8');
  assert.match(src, /filterInContext\('Colaborador'/);
  assert.match(src, /filterInContext\('Ponto'/);
  assert.match(src, /createInContext\('Ponto'/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.Colaborador\.list\(/);
  assert.doesNotMatch(src, /base44\.entities\.Ponto\.list\(/);
  assert.doesNotMatch(src, /base44\.entities\.Ponto\.create\(/);
  assert.match(src, /isErrorColaboradores|isErrorPontos/);
  assert.match(src, /Contagem RH indisponível|≠ zero/);
});
