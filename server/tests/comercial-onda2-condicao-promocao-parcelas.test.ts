import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../src/api/errors.js';
import {
  escolherCondicaoResolvida,
  snapshotCondicaoParaDocumento,
} from '../src/services/comercialCondicaoResolucaoPolicy.js';
import { buildParcelaSchedule } from '../src/services/comercialParcelaSchedulePolicy.js';
import {
  aplicarDescontoPromocional,
  cupomPromocionalAutorizado,
} from '../src/services/comercialPromocaoPolicy.js';

test('resolução: preferência ClienteEmpresa ativa prevalece sobre padrão', () => {
  const preferida = {
    id: '11111111-1111-4111-8111-111111111111',
    codigo: '000001',
    nome: '28 dias',
    ativo: true,
    parcelas: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
  };
  const padrao = {
    id: '22222222-2222-4222-8222-222222222222',
    codigo: '000002',
    nome: 'À vista',
    ativo: true,
    parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
  };
  const result = escolherCondicaoResolvida({ preferida, padraoEmpresa: padrao });
  assert.equal(result.fonte, 'cliente_empresa');
  assert.equal(result.condicao?.id, preferida.id);
});

test('resolução: preferência inativa cai para padrão da Empresa', () => {
  const result = escolherCondicaoResolvida({
    preferida: {
      id: '11111111-1111-4111-8111-111111111111',
      codigo: '000001',
      nome: 'X',
      ativo: false,
      parcelas: [],
    },
    padraoEmpresa: {
      id: '22222222-2222-4222-8222-222222222222',
      codigo: '000002',
      nome: 'Padrão',
      ativo: true,
      parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
    },
  });
  assert.equal(result.fonte, 'empresa_padrao');
  assert.equal(result.condicao?.codigo, '000002');
});

test('resolução: sem preferência nem padrão retorna nenhuma (fail-closed)', () => {
  const result = escolherCondicaoResolvida({ preferida: null, padraoEmpresa: null });
  assert.equal(result.fonte, 'nenhuma');
  assert.equal(result.condicao, null);
  assert.equal(snapshotCondicaoParaDocumento(null), null);
});

test('parcelas: agenda 28/35/42 com resíduo na última', () => {
  const schedule = buildParcelaSchedule({
    total: '100.000000',
    baseDate: '2027-01-01',
    parcelas: [
      { ordem: 1, dias: 28, percentual: '33.333333' },
      { ordem: 2, dias: 35, percentual: '33.333333' },
      { ordem: 3, dias: 42, percentual: '33.333334' },
    ],
  });
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0]!.vencimento, '2027-01-29');
  assert.equal(schedule[1]!.vencimento, '2027-02-05');
  assert.equal(schedule[2]!.vencimento, '2027-02-12');
  const sum = schedule.reduce((acc, row) => {
    const [w, f = ''] = row.valor.split('.');
    return acc + BigInt(w) * 1000000n + BigInt(`${f}000000`.slice(0, 6));
  }, 0n);
  assert.equal(sum, 100000000n);
  assert.equal(schedule[0]!.valor, '33.333333');
  assert.equal(schedule[1]!.valor, '33.333333');
  assert.equal(schedule[2]!.valor, '33.333334');
});

test('parcelas: à vista 100% no dia 0', () => {
  const schedule = buildParcelaSchedule({
    total: '50.500000',
    baseDate: '2027-03-10',
    parcelas: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
  });
  assert.deepEqual(schedule, [{
    ordem: 1,
    dias: 0,
    percentual: '100.000000',
    valor: '50.500000',
    vencimento: '2027-03-10',
  }]);
});

test('parcelas: sem parcela ativa falha fechado', () => {
  assert.throws(
    () => buildParcelaSchedule({ total: '10.000000', baseDate: '2027-01-01', parcelas: [] }),
    (err: unknown) => err instanceof AppError && err.code === 'CONDICAO_PAGAMENTO_SEM_PARCELAS',
  );
});

test('promoção: fail-closed sem config ativa', () => {
  assert.throws(
    () => aplicarDescontoPromocional({
      items: [{ quantidade: '1', preco_unitario: '100.000000', desconto: '0' }],
      promocaoBps: 500,
      config: null,
    }),
    (err: unknown) => err instanceof AppError && err.code === 'PROMOCAO_INATIVA',
  );
  assert.throws(
    () => aplicarDescontoPromocional({
      items: [{ quantidade: '1', preco_unitario: '100.000000' }],
      promocaoBps: 500,
      config: { ativa: false, maxBps: 1000 },
    }),
    (err: unknown) => err instanceof AppError && err.code === 'PROMOCAO_INATIVA',
  );
});

test('promoção: aplica bps e rejeita acima do teto ou cupom inválido', () => {
  const ok = aplicarDescontoPromocional({
    items: [{ quantidade: '2', preco_unitario: '50.000000', desconto: '1.000000' }],
    promocaoBps: 500,
    config: { ativa: true, maxBps: 1000, cuponsPermitidos: ['CPA10'] },
    cupom: 'cpa10',
  });
  assert.equal(ok.aplicada, true);
  // linha=100; promo 5%=5; existente 1 → 6
  assert.equal(ok.items[0]!.desconto, '6.000000');

  assert.throws(
    () => aplicarDescontoPromocional({
      items: [{ quantidade: '1', preco_unitario: '100.000000' }],
      promocaoBps: 1500,
      config: { ativa: true, maxBps: 1000 },
    }),
    (err: unknown) => err instanceof AppError && err.code === 'PROMOCAO_ACIMA_DO_TETO',
  );

  assert.equal(cupomPromocionalAutorizado('X', []), false);
  assert.throws(
    () => aplicarDescontoPromocional({
      items: [{ quantidade: '1', preco_unitario: '100.000000' }],
      promocaoBps: 100,
      config: { ativa: true, maxBps: 500, cuponsPermitidos: ['CPA10'] },
      cupom: 'OUTRO',
    }),
    (err: unknown) => err instanceof AppError && err.code === 'PROMOCAO_CUPOM_NEGADO',
  );
});
