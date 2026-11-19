import assert from 'node:assert/strict';
import test from 'node:test';
import { projetarParcelasFaturamento } from '../src/services/faturamentoParcelasPolicy.ts';

const parcelas = [
  { ordem: 2, dias: 30, percentual: '50' },
  { ordem: 1, dias: 0, percentual: '50.000000' },
];

test('parcelas canonicas conservam centavos e ordem, inclusive fim de mes', () => {
  const expected = [
    { ordem: 1, vencimento: '2028-01-31', valor: '50.01' },
    { ordem: 2, vencimento: '2028-03-01', valor: '50.00' },
  ];
  assert.deepEqual(projetarParcelasFaturamento('100.010000', '2028-01-31', parcelas), expected);
  assert.deepEqual(projetarParcelasFaturamento('100.01', '2028-01-31', [...parcelas].reverse()), expected);
});

test('parcelamento recusa fracao de centavo, parcela zerada, condicao invalida e data impossivel', () => {
  assert.throws(() => projetarParcelasFaturamento('23.691356', '2028-01-31', parcelas), {
    code: 'FATURAMENTO_TOTAL_NAO_EXPRESSO_EM_CENTAVOS',
  });
  assert.throws(() => projetarParcelasFaturamento('0.01', '2028-01-31', parcelas), {
    code: 'FATURAMENTO_PARCELA_SEM_VALOR',
  });
  assert.throws(() => projetarParcelasFaturamento('10', '2028-01-31', parcelas.slice(0, 1)), {
    code: 'FATURAMENTO_PARCELAS_INVALIDAS',
  });
  assert.throws(() => projetarParcelasFaturamento('10', '2028-01-31', [
    { ordem: 1, dias: 0, percentual: 'inválido' },
  ]), { code: 'FATURAMENTO_PARCELAS_INVALIDAS' });
  assert.throws(() => projetarParcelasFaturamento('10', '2028-02-30', parcelas), {
    code: 'FATURAMENTO_DATA_INVALIDA',
  });
});
