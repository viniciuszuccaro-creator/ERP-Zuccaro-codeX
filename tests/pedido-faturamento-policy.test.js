import {
  assertFaturamentoDentroDoPedido,
  avaliarReservaParcial,
  evaluatePedidoCredito,
  pedidoJaTemReservaEstoque,
  pedidoJaTemSaidaEstoque,
  validarItensReservaEstoque,
  remainingValorFaturar,
  resolveStatusFaturamentoPedido,
} from '../src/components/lib/pedidoFaturamentoPolicy.js';
import { applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pedido = { id: 'ped-1', valor_total: 1000 };

test('partial billing keeps remaining balance on the order', () => {
  const notas = [{ id: 'nf-1', pedido_id: 'ped-1', valor_total: 400, status: 'Autorizada' }];
  assert.equal(remainingValorFaturar({ pedido, notasExistentes: notas }), 600);
  assert.equal(resolveStatusFaturamentoPedido({ pedido, notasExistentes: notas, notaNova: { valor_total: 200 } }), 'Faturado Parcial');
  assert.equal(resolveStatusFaturamentoPedido({ pedido, notasExistentes: notas, notaNova: { valor_total: 600 } }), 'Faturado');
});

test('billing above the order is blocked', () => {
  const notas = [{ id: 'nf-1', pedido_id: 'ped-1', valor_total: 800, status: 'Pendente' }];
  assert.throws(
    () => assertFaturamentoDentroDoPedido({ pedido, notasExistentes: notas, notaNova: { valor_total: 300 } }),
    /Faturamento acima do pedido bloqueado/,
  );
});

test('cancelled notes do not consume the remaining balance', () => {
  const notas = [{ id: 'nf-c', pedido_id: 'ped-1', valor_total: 1000, status: 'Cancelada' }];
  assert.equal(remainingValorFaturar({ pedido, notasExistentes: notas }), 1000);
});

test('pedido numbers are reserved with prefix on create, not invented in the form', () => {
  const record = applyCodigoOnCreate({
    entityName: 'Pedido',
    record: { group_id: 'local_grupo_cpa' },
    records: [{ numero_pedido: 'PED-000004' }],
    sequenceValue: 4,
  });
  assert.equal(record.numero_pedido, 'PED-000005');
});

test('credit evaluation fails closed without client, limit or alcada', () => {
  assert.equal(evaluatePedidoCredito({ pedido: { valor_total: 100 }, cliente: null }).aprovado, false);
  assert.equal(evaluatePedidoCredito({
    pedido: { cliente_id: 'c1', valor_total: 100 },
    cliente: { condicao_comercial: { limite_credito: 0 } },
  }).aprovado, false);
  assert.equal(evaluatePedidoCredito({
    pedido: { cliente_id: 'c1', valor_total: 100, limite_credito_override: true },
    cliente: { condicao_comercial: { limite_credito: 50 } },
    permitirOverride: false,
  }).aprovado, false);
  assert.equal(evaluatePedidoCredito({
    pedido: { cliente_id: 'c1', valor_total: 80, limite_credito_override: true, limite_credito_justificativa: 'ok' },
    cliente: { condicao_comercial: { limite_credito: 50, limite_credito_utilizado: 0 } },
    permitirOverride: true,
  }).aprovado, true);
  assert.equal(evaluatePedidoCredito({
    pedido: { cliente_id: 'c1', valor_total: 80 },
    cliente: { condicao_comercial: { limite_credito: 100, limite_credito_utilizado: 10 } },
  }).aprovado, true);
});

test('stock movement idempotency helpers detect reserva and saida', () => {
  const movimentos = [
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1' },
    { tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p2' },
  ];
  assert.equal(pedidoJaTemReservaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), true);
  assert.equal(pedidoJaTemReservaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p2' }), false);
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p2' }), true);
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), false);
});

test('approval blocks downstream effects and compensates partial stock reservations', async () => {
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const approvalStart = fluxo.indexOf('export async function aprovarPedidoCompleto');
  const productionStart = fluxo.indexOf("if (pedido.itens_producao?.length > 0)", approvalStart);
  const failClosedStart = fluxo.indexOf('resultados.reservaEstoqueBloqueada = true;', approvalStart);

  assert.ok(failClosedStart > approvalStart);
  assert.ok(failClosedStart < productionStart);
  assert.match(fluxo.slice(approvalStart, productionStart), /reservasCompensadas/);
  assert.match(fluxo.slice(approvalStart, productionStart), /liberarReservaEstoque\(reserva, contextoOperacao\.empresaId\)/);
  assert.match(fluxo.slice(approvalStart, productionStart), /return resultados;/);
  assert.match(fluxo.slice(approvalStart, productionStart), /validarItensReservaEstoque/);
  assert.match(fluxo.slice(approvalStart, productionStart), /duplicado ou sem produto para reserva/);
});

test('partial reservation failure compensates created moves and blocks downstream effects', () => {
  const decision = avaliarReservaParcial({
    reservas: [{ id: 'r1' }, { skipped: true }, { id: 'r2' }],
    erros: ['estoque insuficiente no item seguinte'],
  });
  assert.deepEqual(decision, { bloqueado: true, compensar: [{ id: 'r1' }, { id: 'r2' }] });
  assert.deepEqual(avaliarReservaParcial({ reservas: [{ id: 'r1' }], erros: [] }), { bloqueado: false, compensar: [] });
});

test('stock reservation rejects duplicate or missing product lines before persistence', () => {
  const valid = validarItensReservaEstoque([{ produto_id: 'p1', unidade: 'UN', quantidade: 2 }, { produto_id: 'p1', unidade: 'UN', quantidade: 3 }]);
  assert.equal(valid.valido, true);
  assert.equal(valid.invalidos.length, 0);
  assert.equal(valid.itens.length, 1);
  assert.equal(valid.itens[0].quantidade, 5);
  const duplicate = validarItensReservaEstoque([{ produto_id: 'p1', unidade: 'UN', quantidade: 1 }, { produto_id: 'p1', unidade: 'KG', quantidade: 1 }, { quantidade: 0 }]);
  assert.equal(duplicate.valido, false);
  assert.equal(duplicate.invalidos.length, 2);
  assert.equal(validarItensReservaEstoque([{ produto_id: 'p3', quantidade: 'abc' }]).valido, false);
});

test('cancelling a reservation is idempotent after a prior release', async () => {
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const releaseStart = fluxo.indexOf('async function liberarReservaEstoque');
  const releaseBody = fluxo.slice(releaseStart, fluxo.indexOf('/**', releaseStart + 1));
  assert.match(releaseBody, /pedidoJaTemSaidaEstoque/);
  assert.match(releaseBody, /skipped: true/);
});

test('commercial billing persists the NF instead of logging it', async () => {
  const fechamento = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const wizard = await readFile(new URL('../src/components/comercial/wizard/WizardEtapa1Cliente.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/comercial/PedidoForm.jsx', import.meta.url), 'utf8');
  const formCompleto = await readFile(new URL('../src/components/comercial/PedidoFormCompleto.jsx', import.meta.url), 'utf8');
  const central = await readFile(new URL('../src/components/comercial/CentralAprovacoesManager.jsx', import.meta.url), 'utf8');
  const stockFn = await readFile(new URL('../base44/functions/applyOrderStockMovements/entry.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(fechamento, /console\.log\('Emitir NF-e'/);
  assert.match(fechamento, /assertFaturamentoDentroDoPedido/);
  assert.match(fechamento, /createInContext\('NotaFiscal'/);
  assert.match(fluxo, /assertFaturamentoDentroDoPedido/);
  assert.match(fluxo, /reservarEstoqueItemAprovacao/);
  assert.match(fluxo, /evaluatePedidoCredito|validarLimiteCredito/);
  assert.doesNotMatch(fluxo, /Baixa automatica - Pedido .* aprovado/);
  assert.doesNotMatch(wizard, /PED-\$\{Date\.now/);
  assert.doesNotMatch(form, /PED-\$\{Date\.now/);
  assert.doesNotMatch(formCompleto, /applyOrderStockMovements/);
  assert.match(central, /validarLimiteCredito/);
  assert.doesNotMatch(central, /hasPermission\("Comercial", "Pedido", "editar"\)/);
  assert.match(stockFn, /modo: 'reserva'/);
  assert.match(stockFn, /Comercial\.Pedido\.aprovar/);
  assert.doesNotMatch(stockFn, /tipo_movimento: 'saida'/);
});
