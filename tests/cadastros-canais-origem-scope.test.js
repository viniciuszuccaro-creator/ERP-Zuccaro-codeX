import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GerenciadorCanaisOrigem usa filter/update InContext sem initialData zero', () => {
  const src = readFileSync('src/components/cadastros/GerenciadorCanaisOrigem.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /updateInContext\('ParametroOrigemPedido'/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.(ParametroOrigemPedido|Pedido)\.(list|update)\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.match(src, /cargaIndisponivel|isErrorParametros/);
  assert.match(src, /erro de carga ≠ zero/);
});
