import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDescontoDentroDaAlcadaOuAprovar,
  computeDescontoBps,
  descontoExcedeAlcadaLivre,
} from '../src/services/comercialDescontoAlcadaPolicy.ts';

test('desconto zero não excede alçada livre', () => {
  assert.equal(descontoExcedeAlcadaLivre([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '0' },
  ]), false);
  assert.equal(computeDescontoBps([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '0' },
  ]).descontoBps, 0);
});

test('qualquer desconto > 0 excede alçada livre padrão (0 bps)', () => {
  assert.equal(descontoExcedeAlcadaLivre([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '1.000000' },
  ]), true);
});

test('assertDesconto exige canAprovar quando excede alçada', () => {
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
      canAprovar: false,
      entityLabel: 'Orçamento',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'DESCONTO_ALCADA_DENIED',
  );
  assert.doesNotThrow(() => assertDescontoDentroDaAlcadaOuAprovar({
    items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
    canAprovar: true,
  }));
});
