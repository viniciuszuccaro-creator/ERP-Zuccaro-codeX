import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GameficacaoProducao lista OP/Pedido/Entrega via filterInContext', () => {
  const src = readFileSync('src/components/rh/GameficacaoProducao.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\('OrdemProducao'/);
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /filterInContext\('Entrega'/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.(OrdemProducao|Pedido|Entrega)\.list\(/);
  assert.match(src, /isErrorOps|isErrorPedidos|isErrorEntregas|cargaIndisponivel/);
  assert.match(src, /erro de carga ≠ zero|erro ≠ zero/);
});
