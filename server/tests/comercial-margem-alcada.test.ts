import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertMargemDentroDaAlcadaOuAprovar,
  computeMargemBps,
  evaluateMargemAlcada,
  lineAbaixoDaMargemMinima,
  type ComercialCostPort,
} from '../src/services/comercialMargemAlcadaPolicy.ts';

const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';
const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function stubCost(custo: string, minimaBps?: number): ComercialCostPort {
  return {
    getUnitCost: async () => ({ custo_unitario: custo, margem_minima_bps: minimaBps }),
  };
}

test('porta de custo ausente → skip (não inventa)', async () => {
  await assert.doesNotReject(() => assertMargemDentroDaAlcadaOuAprovar({
    groupId,
    empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '10', desconto: '0' }],
    costs: null,
    canAprovar: false,
  }));
  await assert.doesNotReject(() => assertMargemDentroDaAlcadaOuAprovar({
    groupId,
    empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '10', desconto: '0' }],
    costs: undefined,
    canAprovar: false,
  }));
});

test('custo null para o item → skip da linha', async () => {
  const costs: ComercialCostPort = { getUnitCost: async () => null };
  const result = await evaluateMargemAlcada({
    groupId,
    empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '5', desconto: '0' }],
    costs,
  });
  assert.equal(result.evaluated.length, 0);
  assert.equal(result.anyAbaixo, false);
  await assert.doesNotReject(() => assertMargemDentroDaAlcadaOuAprovar({
    groupId, empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '5', desconto: '0' }],
    costs,
    canAprovar: false,
  }));
});

test('preço >= custo com mínima 0 → ok sem aprovar', async () => {
  await assert.doesNotReject(() => assertMargemDentroDaAlcadaOuAprovar({
    groupId, empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '2', preco_unitario: '10', desconto: '0' }],
    costs: stubCost('10'),
    canAprovar: false,
  }));
  assert.equal(lineAbaixoDaMargemMinima(20_000_000n, 20_000_000n, 0), false);
});

test('venda abaixo do custo (mínima 0) exige aprovar', async () => {
  await assert.rejects(
    () => assertMargemDentroDaAlcadaOuAprovar({
      groupId, empresaId,
      items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '9', desconto: '0' }],
      costs: stubCost('10'),
      canAprovar: false,
      entityLabel: 'Orçamento',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'MARGEM_ALCADA_DENIED',
  );
  await assert.doesNotReject(() => assertMargemDentroDaAlcadaOuAprovar({
    groupId, empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '9', desconto: '0' }],
    costs: stubCost('10'),
    canAprovar: true,
  }));
});

test('desconto que derruba margem abaixo da mínima → 403', async () => {
  // líquido 90, custo 80, mínima 1500 bps (15%) → margem = 11.11% < 15%
  await assert.rejects(
    () => assertMargemDentroDaAlcadaOuAprovar({
      groupId, empresaId,
      items: [{
        produto_id: produtoId,
        unidade_id: unidadeId,
        quantidade: '1',
        preco_unitario: '100',
        desconto: '10',
      }],
      costs: stubCost('80', 1500),
      canAprovar: false,
    }),
    (err: any) => err?.code === 'MARGEM_ALCADA_DENIED',
  );
});

test('margem abaixo da mínima por fração de bp (sem truncar)', async () => {
  // net=1000, cost=999.999999 → margem quase 0; mínima 1 bp deve bloquear
  // 1000 - 999.999999 = 0.000001 → (0.000001*10000)/1000 = 0.00001 bp
  const net = 1_000_000_000n; // 1000.000000
  const cost = 999_999_999n; // 999.999999
  assert.equal(lineAbaixoDaMargemMinima(net, cost, 1), true);
  assert.equal(computeMargemBps(net, cost), 0); // truncamento na leitura
  assert.equal(lineAbaixoDaMargemMinima(net, cost, 0), false); // acima do custo
});

test('evaluateMargemAlcada marca linha abaixo', async () => {
  const { evaluated, anyAbaixo } = await evaluateMargemAlcada({
    groupId, empresaId,
    items: [{ produto_id: produtoId, unidade_id: unidadeId, quantidade: '1', preco_unitario: '50', desconto: '0' }],
    costs: stubCost('60'),
  });
  assert.equal(anyAbaixo, true);
  assert.equal(evaluated.length, 1);
  assert.equal(evaluated[0].abaixoDaMinima, true);
  assert.equal(evaluated[0].netMicros, 50_000_000n);
  assert.equal(evaluated[0].costMicros, 60_000_000n);
});
