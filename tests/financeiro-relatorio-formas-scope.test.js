import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('RelatorioFormasPagamento lista via filterInContext com contexto', () => {
  const src = readFileSync('src/components/financeiro/RelatorioFormasPagamento.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\('FormaPagamento'/);
  assert.match(src, /filterInContext\('Pedido'/);
  assert.match(src, /filterInContext\('ContaReceber'/);
  assert.match(src, /filterInContext\('CaixaMovimento'/);
  assert.match(src, /queryKey:\s*\['formas-pagamento-relatorio',\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.(FormaPagamento|Pedido|ContaReceber|CaixaMovimento)\.list\(/);
  assert.match(src, /cargaIndisponivel|isErrorFormas/);
  assert.match(src, /erro de carga ≠ zero/);
});
