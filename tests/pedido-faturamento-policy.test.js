import {
  assertFaturamentoDentroDoPedido,
  avaliarEtapaFaturamento,
  resolverNotaResidualPedido,
  resolverUltimaEtapaMonetaria,
  avaliarReservaParcial,
  executarReservasComCompensacao,
  cicloReservaPedidoProduto,
  evaluatePedidoCredito,
  pedidoJaTemReservaEstoque,
  pedidoJaTemSaidaEstoque,
  saldoReservaPedidoProduto,
  validarItensReservaEstoque,
  remainingValorFaturar,
  resolveStatusFaturamentoPedido,
} from '../src/components/lib/pedidoFaturamentoPolicy.js';
import { applyCodigoOnCreate } from '../src/api/localCadastroMasterPolicy.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

/** Sandbox VM legado: HTTP Expedição desligado — writers locais exercitados. */
const fluxoEstoqueLegadoHttp = Object.freeze({
  isHttpExpedicaoEnabled: () => false,
  assertEscritaEstoqueLocalPermitida: () => {},
  HTTP_ESTOQUE_LOCAL_BLOQUEADO:
    'MovimentacaoEstoque local indisponível no modo HTTP Expedição. Use o ledger de Expedição.',
});

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

test('nota pendente rejeitada após falha não consome saldo faturável', () => {
  const notas = [{ pedido_id: 'ped-1', valor_total: 1000, status: 'Rejeitada' }];
  assert.equal(remainingValorFaturar({ pedido, notasExistentes: notas }), 1000);
});

test('etapa com revenda estocavel bloqueia antes da NF; etapa de armado preserva status', async () => {
  const pedidoEtapa = {
    id: 'ped-1', status: 'Aprovado', valor_total: 100,
    itens_revenda: [{ produto_id: 'p1', quantidade: 1 }],
    etapas_entrega: [{ id: 'et1', faturada: false, itens_etapa: [
      { item_pedido_id: 'revenda-0', origem_item: 'revenda', quantidade: 1 },
    ] }],
  };
  assert.match(avaliarEtapaFaturamento({ pedido: pedidoEtapa, etapaId: 'et1' }).motivo, /baixa antes da NF/);
  const semEstoque = { ...pedidoEtapa, etapas_entrega: [{
    id: 'et2', faturada: false, itens_etapa: [
      { item_pedido_id: 'armado-0', origem_item: 'armado_padrao', quantidade: 1 },
    ],
  }] };
  assert.equal(avaliarEtapaFaturamento({ pedido: semEstoque, etapaId: 'et2' }).permitido, true);
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const efeitos = [];
  const ctx = {
    formData: semEstoque, empresaId: 'e1', groupId: 'g1', valorTotal: 100,
    toast: { error: () => {}, success: () => {} },
    avaliarEtapaFaturamento, resolverUltimaEtapaMonetaria,
    filterInContext: async () => [],
    assertFaturamentoDentroDoPedido: () => ({ status: 'Faturado Parcial' }),
    createInContext: async (entity) => { efeitos.push('criar:' + entity); return { id: 'nf-1' }; },
    updateInContext: async (entity, _id, patch) => { efeitos.push({ entity, patch }); return patch; },
    faturarPedidoCompleto: async () => { throw new Error('baixa indevida'); },
    auditFechamento: async () => {},
    setFormData: () => {},
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 20,
    escopo: 'etapa_especifica', etapa_id: 'et2' });
  assert.equal(efeitos[0], 'criar:NotaFiscal');
  assert.equal(efeitos[1].entity, 'Pedido');
  assert.equal(efeitos[1].patch.status, undefined);
  assert.equal(efeitos[1].patch.etapas_entrega[0].faturada, true);
  efeitos.length = 0;
  ctx.formData = pedidoEtapa;
  await assert.rejects(() => emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1',
    valor_total: 20, escopo: 'etapa_especifica', etapa_id: 'et1' }), /baixa antes da NF/);
  assert.deepEqual(efeitos, []);
});

test('etapa sem estoque seguida de NF residual baixa só revenda aberta', async () => {
  const pedidoMisto = {
    id: 'ped-1', numero_pedido: 'PED-1', status: 'Aprovado', valor_total: 100,
    itens_revenda: [{ produto_id: 'p1', descricao: 'Revenda', quantidade: 1, valor_item: 70 }],
    itens_armado_padrao: [{ id: 'a1', descricao_automatica: 'Armado', preco_venda_total: 30 }],
    etapas_entrega: [{ id: 'et-armado', faturada: false, valor_total_etapa: 30,
      itens_etapa: [{ item_pedido_id: 'armado-0', origem_item: 'armado_padrao' }] }],
  };
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const notas = [];
  const baixas = [];
  const movimentos = [{ id: 'r1', tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 1 }];
  const produto = { id: 'p1', descricao: 'Revenda', estoque_atual: 10, estoque_reservado: 1 };
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const baixaStart = fluxo.indexOf('async function baixarEstoqueItem');
  const baixaSource = fluxo.slice(baixaStart, fluxo.indexOf('/**', baixaStart + 1));
  const baixar = runInNewContext(baixaSource + '; baixarEstoqueItem', {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async (entity, criteria) => entity === 'Produto' ? [produto]
      : movimentos.filter((mov) => Object.entries(criteria).every(([key, value]) => mov[key] === value)),
    pedidoJaTemSaidaEstoque, saldoReservaPedidoProduto,
    getUsuarioAtual: async () => ({ id: 'u1' }),
    createScoped: async (_entity, payload) => {
      const mov = { ...payload, id: 'saida-1' }; movimentos.push(mov); return mov;
    },
    updateScoped: async (_entity, _id, patch) => {
      Object.assign(produto, patch); return { before: null, updated: produto };
    },
    auditar: async () => {},
  });
  const faturarStart = fluxo.indexOf('export async function faturarPedidoCompleto');
  const faturarSource = fluxo.slice(faturarStart, fluxo.indexOf('async function baixarEstoqueItem', faturarStart)).replace('export ', '');
  const faturar = runInNewContext(faturarSource + '; faturarPedidoCompleto', {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async (entity) => entity === 'NotaFiscal' ? notas : [],
    assertFaturamentoDentroDoPedido, validarItensReservaEstoque, baixarEstoqueItem: baixar,
    getUsuarioAtual: async () => ({ id: 'u1' }),
    createScoped: async (entity) => entity === 'Entrega' ? { id: 'ent-1' } : null,
    updateScoped: async (_entity, _id, patch) => ({ before: null, updated: patch }),
    auditar: async () => {},
  });
  const ctx = {
    formData: pedidoMisto, empresaId: 'e1', groupId: 'g1', valorTotal: 100,
    toast: { error: () => {}, success: () => {} },
    avaliarEtapaFaturamento, resolverNotaResidualPedido, resolverUltimaEtapaMonetaria, assertFaturamentoDentroDoPedido,
    filterInContext: async () => notas,
    createInContext: async (_entity, payload) => {
      const nota = { ...payload, id: 'nf-' + (notas.length + 1) };
      notas.push(nota);
      return nota;
    },
    updateInContext: async (_entity, _id, patch) => patch,
    faturarPedidoCompleto: async (pedido, nota, empresa) => {
      const resultado = await faturar(pedido, nota, empresa);
      baixas.push({ nota, saida: resultado.baixasEstoque[0], entrega: resultado.entrega });
      return resultado;
    },
    auditFechamento: async () => {},
    setFormData: (updater) => { ctx.formData = updater(ctx.formData); },
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 30,
    escopo: 'etapa_especifica', etapa_id: 'et-armado' });
  assert.equal(notas[0].valor_total, 30);
  assert.equal(ctx.formData.status, 'Aprovado');
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 100,
    escopo: 'pedido_inteiro', itens: [...pedidoMisto.itens_revenda, ...pedidoMisto.itens_armado_padrao] });
  assert.equal(notas[1].valor_total, 70);
  assert.deepEqual(notas[1].itens, pedidoMisto.itens_revenda);
  assert.equal(baixas.length, 1);
  assert.equal(baixas[0].nota.id, notas[1].id);
  assert.equal(baixas[0].saida.tipo_movimento, 'saida');
  assert.equal(baixas[0].entrega.id, 'ent-1');
  assert.equal(produto.estoque_atual, 9);
  assert.equal(produto.estoque_reservado, 0);
  assert.equal(ctx.formData.status, 'Faturado');
});

test('NF residual absorve etapa B aberta e impede segunda emissão dela', async () => {
  const pedidoMisto = {
    id: 'ped-1', numero_pedido: 'PED-1', status: 'Aprovado', valor_total: 100,
    itens_revenda: [{ produto_id: 'p1', quantidade: 1, valor_item: 50 }],
    itens_armado_padrao: [{ id: 'a1' }, { id: 'a2' }],
    etapas_entrega: [
      { id: 'et-a', faturada: false, itens_etapa: [{ item_pedido_id: 'armado-0', origem_item: 'armado_padrao' }] },
      { id: 'et-b', faturada: false, itens_etapa: [{ item_pedido_id: 'armado-1', origem_item: 'armado_padrao' }] },
    ],
  };
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const notas = [];
  const ctx = {
    formData: pedidoMisto, empresaId: 'e1', groupId: 'g1', valorTotal: 100,
    toast: { error: () => {}, success: () => {} },
    avaliarEtapaFaturamento, resolverNotaResidualPedido, resolverUltimaEtapaMonetaria,
    assertFaturamentoDentroDoPedido,
    filterInContext: async () => notas,
    createInContext: async (_entity, payload) => {
      const nota = { ...payload, id: `nf-${notas.length + 1}` }; notas.push(nota); return nota;
    },
    updateInContext: async (_entity, _id, patch) => patch,
    faturarPedidoCompleto: async () => ({ erros: [] }),
    auditFechamento: async () => {},
    setFormData: (updater) => { ctx.formData = updater(ctx.formData); },
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 30,
    escopo: 'etapa_especifica', etapa_id: 'et-a' });
  assert.equal(ctx.formData.etapas_entrega[0].faturada, true);
  assert.equal(ctx.formData.etapas_entrega[1].faturada, false);
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 100,
    escopo: 'pedido_inteiro', itens: [] });
  assert.equal(notas[1].valor_total, 70);
  assert.equal(ctx.formData.etapas_entrega[1].faturada, true);
  await assert.rejects(() => emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', valor_total: 20,
    escopo: 'etapa_especifica', etapa_id: 'et-b' }), /ja faturada/);
  assert.equal(notas.length, 2);
});

test('frete remanescente entra na ultima NF de etapa sem nota vazia', async () => {
  const pedidoFrete = { id: 'ped-1', valor_total: 110, valor_frete: 10,
    itens_armado_padrao: [{ id: 'a1' }],
    etapas_entrega: [{ id: 'et-1', faturada: false,
      itens_etapa: [{ item_pedido_id: 'armado-0', origem_item: 'armado_padrao' }] }] };
  assert.deepEqual(resolverUltimaEtapaMonetaria({ pedido: pedidoFrete, etapaId: 'et-1',
    notasExistentes: [], valorEtapa: 100 }), {
    valor_total: 110, valor_produtos: 100, valor_frete: 10, outras_despesas: 0,
  });
  assert.equal(remainingValorFaturar({ pedido: pedidoFrete,
    notasExistentes: [{ pedido_id: 'ped-1', valor_total: 110, status: 'Pendente' }] }), 0);
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const notas = [];
  const ctx = {
    formData: pedidoFrete, empresaId: 'e1', groupId: 'g1', valorTotal: 110,
    toast: { error: () => {}, success: () => {} },
    avaliarEtapaFaturamento, resolverNotaResidualPedido, resolverUltimaEtapaMonetaria,
    assertFaturamentoDentroDoPedido,
    filterInContext: async () => notas,
    createInContext: async (_entity, payload) => {
      const nota = { ...payload, id: 'nf-1' }; notas.push(nota); return nota;
    },
    updateInContext: async (_entity, _id, patch) => patch,
    faturarPedidoCompleto: async () => { throw new Error('baixa indevida'); },
    auditFechamento: async () => {},
    setFormData: (updater) => { ctx.formData = updater(ctx.formData); },
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1', escopo: 'etapa_especifica',
    etapa_id: 'et-1', valor_total: 100, itens: pedidoFrete.itens_armado_padrao });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].valor_total, 110);
  assert.equal(notas[0].valor_produtos, 100);
  assert.equal(notas[0].valor_frete, 10);
  assert.equal(ctx.formData.etapas_entrega[0].faturada, true);
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
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p2' }), false);
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), false);
});

test('retry apos compensacao exige nova reserva antes do financeiro', async () => {
  const movimentos = [
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 2 },
    { tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 2 },
  ];
  assert.equal(pedidoJaTemReservaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), false);
  movimentos.push({ tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 2 });
  assert.equal(pedidoJaTemReservaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), true);
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  assert.ok(fluxo.includes('return { skipped: true, produto_id: item.produto_id };'));
  assert.ok(fluxo.includes('const itens = pedido.itens_revenda || [];'));
});

test('compensacao, retry e faturamento consomem a reserva nova uma vez', async () => {
  const movimentos = [
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 4 },
  ];
  assert.equal(saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), 4);
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), false);
  movimentos.push({ tipo_movimento: 'saida', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 4 });
  assert.equal(saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), 0);
  assert.equal(pedidoJaTemSaidaEstoque({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), true);
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const baixa = fluxo.slice(fluxo.indexOf('async function baixarEstoqueItem'), fluxo.indexOf('export async function concluirOPCompleto'));
  assert.match(baixa, /tipo_movimento: 'saida'/);
  assert.match(baixa, /saldoReservaPedidoProduto/);
  assert.match(baixa, /estoque_atual: novoEstoque/);
  assert.match(baixa, /estoque_reservado: novoReservado/);
});

test('cancelamento libera apenas quatro apos compensar dez e preserva outro pedido', async () => {
  const movimentos = [
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 4 },
    { tipo_movimento: 'reserva', origem_documento_id: 'ped-2', produto_id: 'p1', quantidade: 7 },
  ];
  const liberar = saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' });
  assert.equal(liberar, 4);
  movimentos.push({ tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: liberar });
  assert.equal(saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-1', produtoId: 'p1' }), 0);
  assert.equal(saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-2', produtoId: 'p1' }), 7);
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const cancelamento = fluxo.slice(fluxo.indexOf('export async function cancelarPedidoCompleto'), fluxo.indexOf('async function liberarReservaEstoque'));
  assert.match(cancelamento, /quantidade: saldo/);
  assert.doesNotMatch(cancelamento, /tipo_movimento: 'reserva'\s*\}/);
  const liberacao = fluxo.slice(fluxo.indexOf('async function liberarReservaEstoque'));
  assert.match(liberacao, /Math.min\(saldo, Number\(movimentacaoReserva.quantidade\)\)/);
});

test('peça de armado sem produto não bloqueia revenda estocável', () => {
  const itens = [
    { produto_id: null, origem_armado: true, item_producao_id: 'arm-1', quantidade: 1 },
    { produto_id: 'p1', unidade: 'UN', quantidade: 2 },
  ];
  assert.deepEqual(validarItensReservaEstoque(itens).itens.map((item) => item.produto_id), ['p1']);
  assert.equal(validarItensReservaEstoque(itens).valido, true);
  assert.equal(validarItensReservaEstoque([{ produto_id: null, quantidade: 1 }]).valido, false);
});

test('fluxo real baixa depois de compensar e reserva de novo, sem dupla baixa', async () => {
  const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('async function baixarEstoqueItem');
  const fnSource = source.slice(start, source.indexOf('/**', start + 1));
  const movimentos = [
    { id: 'r10', tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { id: 'c10', tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { id: 'r4', tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 4 },
  ];
  const produto = { id: 'p1', descricao: 'Produto', estoque_atual: 20, estoque_reservado: 4 };
  const ctx = {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async (entity, criteria) => entity === 'Produto' ? [produto]
      : movimentos.filter((mov) => Object.entries(criteria).every(([key, value]) => mov[key] === value)),
    pedidoJaTemSaidaEstoque, saldoReservaPedidoProduto,
    getUsuarioAtual: async () => ({ id: 'u1' }),
    createScoped: async (_entity, payload) => {
      const mov = { ...payload, id: 'saida-1' };
      movimentos.push(mov);
      return mov;
    },
    updateScoped: async (_entity, _id, patch) => {
      Object.assign(produto, patch);
      return { before: null, updated: produto };
    },
    auditar: async () => {},
  };
  const baixar = runInNewContext(fnSource + '; baixarEstoqueItem', ctx);
  const item = { produto_id: 'p1', quantidade: 4, descricao: 'Produto', unidade: 'UN' };
  const ped = { id: 'ped-1', numero_pedido: 'PED-1' };
  const baixa = await baixar(item, ped, 'e1');
  assert.equal(baixa.tipo_movimento, 'saida');
  assert.equal(produto.estoque_atual, 16);
  assert.equal(produto.estoque_reservado, 0);
  assert.equal(movimentos.filter((mov) => mov.tipo_movimento === 'saida').length, 1);
  await baixar(item, ped, 'e1');
  assert.equal(produto.estoque_atual, 16);
  assert.equal(movimentos.filter((mov) => mov.tipo_movimento === 'saida').length, 1);
});

test('fluxo real cancela só saldo aberto do pedido após retry menor', async () => {
  const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const cancelStart = source.indexOf('export async function cancelarPedidoCompleto');
  const releaseStart = source.indexOf('async function liberarReservaEstoque', cancelStart);
  const cancelSource = source.slice(cancelStart, source.indexOf('/**', cancelStart + 10)).replace('export ', '');
  const releaseSource = source.slice(releaseStart, source.indexOf('/**', releaseStart + 10));
  const movimentos = [
    { id: 'r10', tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { id: 'c10', tipo_movimento: 'liberacao_reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 10 },
    { id: 'r4', tipo_movimento: 'reserva', origem_documento_id: 'ped-1', produto_id: 'p1', quantidade: 4 },
    { id: 'r7', tipo_movimento: 'reserva', origem_documento_id: 'ped-2', produto_id: 'p1', quantidade: 7 },
  ];
  const produto = { id: 'p1', descricao: 'Produto', estoque_atual: 20, estoque_reservado: 11 };
  const pedidoEstado = { id: 'ped-1', numero_pedido: 'PED-1', status: 'Aprovado' };
  const ctx = {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async (entity, criteria) => entity === 'Produto' ? [produto]
      : entity === 'ContaReceber' ? [] : movimentos.filter((mov) => Object.entries(criteria).every(([key, value]) => mov[key] === value)),
    saldoReservaPedidoProduto, cicloReservaPedidoProduto, getUsuarioAtual: async () => ({ id: 'u1' }),
    createScoped: async (_entity, payload) => {
      const mov = { ...payload, id: 'liberacao-4' };
      movimentos.push(mov);
      return mov;
    },
    updateScoped: async (entity, _id, patch) => {
      const target = entity === 'Produto' ? produto : pedidoEstado;
      Object.assign(target, patch);
      return { before: null, updated: target };
    },
    auditar: async () => {},
  };
  const cancelar = runInNewContext(releaseSource + '\n' + cancelSource + '; cancelarPedidoCompleto', ctx);
  const resultado = await cancelar(pedidoEstado, 'e1');
  assert.equal(resultado.erros.length, 0);
  assert.equal(resultado.reservasLiberadas.length, 1);
  assert.equal(resultado.reservasLiberadas[0].quantidade, 4);
  assert.equal(produto.estoque_reservado, 7);
  assert.equal(saldoReservaPedidoProduto({ movimentos, pedidoId: 'ped-2', produtoId: 'p1' }), 7);
});

test('retry de quantidade igual cria nova reserva na deduplicação real', async () => {
  const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('async function reservarEstoqueItemAprovacao');
  const fnSource = source.slice(start, source.indexOf('async function gerarOPAutomatica', start));
  const { findDuplicateMovement } = await import('../src/components/lib/estoqueMovimentoPolicy.js');
  const movimentos = [
    { id: 'r-antiga', tipo_movimento: 'reserva', origem_movimento: 'pedido', origem_documento_id: 'ped-1',
      empresa_id: 'e1', group_id: 'g1', produto_id: 'p1', quantidade: 10, documento: 'PED-1' },
    { id: 'c-antiga', tipo_movimento: 'liberacao_reserva', origem_movimento: 'pedido', origem_documento_id: 'ped-1',
      empresa_id: 'e1', group_id: 'g1', produto_id: 'p1', quantidade: 10, documento: 'PED-1' },
  ];
  const produto = { id: 'p1', descricao: 'Produto', estoque_atual: 20, estoque_reservado: 0 };
  const ctx = {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async (entity, criteria) => entity === 'Produto' ? [produto]
      : movimentos.filter((mov) => Object.entries(criteria).every(([key, value]) => mov[key] === value)),
    pedidoJaTemReservaEstoque, pedidoJaTemSaidaEstoque, saldoReservaPedidoProduto, cicloReservaPedidoProduto,
    getUsuarioAtual: async () => ({ id: 'u1' }),
    createScoped: async (_entity, payload) => {
      const duplicado = findDuplicateMovement(payload, movimentos);
      if (duplicado) return duplicado;
      const mov = { ...payload, id: 'r-nova' };
      movimentos.push(mov);
      produto.estoque_reservado = payload.reservado_atual;
      if (payload.tipo_movimento === 'saida') produto.estoque_atual = payload.estoque_atual;
      return mov;
    },
    updateScoped: async (_entity, _id, patch) => {
      Object.assign(produto, patch);
      return { before: null, updated: produto };
    },
    auditar: async () => {},
  };
  const reservar = runInNewContext(fnSource + '; reservarEstoqueItemAprovacao', ctx);
  const item = { produto_id: 'p1', quantidade: 10, descricao: 'Produto', unidade: 'UN' };
  const ped = { id: 'ped-1', numero_pedido: 'PED-1' };
  const nova = await reservar(item, ped, 'e1');
  assert.equal(nova.id, 'r-nova');
  assert.equal(produto.estoque_reservado, 10);
  const repetida = await reservar(item, ped, 'e1');
  assert.equal(repetida.skipped, true);
  assert.equal(movimentos.filter((mov) => mov.tipo_movimento === 'reserva').length, 2);
  assert.equal(produto.estoque_reservado, 10);
  const baixaStart = source.indexOf('async function baixarEstoqueItem');
  const baixaSource = source.slice(baixaStart, source.indexOf('/**', baixaStart + 1));
  const baixar = runInNewContext(baixaSource + '; baixarEstoqueItem', ctx);
  const saida = await baixar(item, ped, 'e1');
  assert.equal(saida.tipo_movimento, 'saida');
  assert.equal(produto.estoque_atual, 10);
  assert.equal(produto.estoque_reservado, 0);
  await baixar(item, ped, 'e1');
  assert.equal(movimentos.filter((mov) => mov.tipo_movimento === 'saida').length, 1);
  await assert.rejects(() => reservar(item, ped, 'e1'), /ja possui saida fisica/);
  assert.equal(produto.estoque_reservado, 0);
  assert.equal(movimentos.filter((mov) => mov.tipo_movimento === 'reserva').length, 2);
});

test('falha da baixa bloqueia Entrega e status no faturamento real', async () => {
  const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export async function faturarPedidoCompleto');
  const fnSource = source.slice(start, source.indexOf('async function baixarEstoqueItem', start)).replace('export ', '');
  const efeitos = [];
  const ctx = {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ empresaId: 'e1', groupId: 'g1' }),
    filterScoped: async () => [],
    assertFaturamentoDentroDoPedido: () => ({ status: 'Faturado' }),
    validarItensReservaEstoque,
    baixarEstoqueItem: async () => { throw new Error('baixa falhou'); },
    createScoped: async (entity) => { efeitos.push(entity); return { id: 'ent-1' }; },
    updateScoped: async (entity) => { efeitos.push(entity); return { before: null, updated: {} }; },
    getUsuarioAtual: async () => ({ id: 'u1' }),
    auditar: async () => {},
  };
  const faturar = runInNewContext(fnSource + '; faturarPedidoCompleto', ctx);
  const resultado = await faturar({ id: 'ped-1', numero_pedido: 'PED-1', valor_total: 10,
    itens_revenda: [{ produto_id: 'p1', quantidade: 1, unidade: 'UN' }] }, null, 'e1');
  assert.equal(resultado.entrega, null);
  assert.match(resultado.erros.join(' '), /baixa falhou/);
  assert.deepEqual(efeitos, []);
});

test('tela reverte NF pendente e nao marca pedido faturado quando baixa falha', async () => {
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const emission = source.slice(source.indexOf('onEmitir={async (dadosNFe) => {'));
  assert.ok(emission.indexOf('faturarPedidoCompleto(pedidoValorado, nota, empresaId)')
    < emission.indexOf("await updateInContext('Pedido', formData.id"));
  assert.ok(emission.includes("await updateInContext('NotaFiscal', nota.id, { status: 'Rejeitada' })"));
  assert.ok(emission.includes('conciliacao manual obrigatoria'));
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const closure = fluxo.slice(fluxo.indexOf('export async function executarFechamentoCompleto'));
  assert.ok(closure.indexOf('pedidosAtuais') < closure.indexOf('executarReservasComCompensacao'));
  assert.ok(closure.includes("'Faturado', 'Faturado Parcial', 'Cancelado'"));
});

test('handler real de NF rejeita pendente e preserva Pedido quando baixa falha', async () => {
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  assert.ok(start > 0 && end > start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const efeitos = [];
  const ctx = {
    formData: { id: 'ped-1', empresa_id: 'e1', numero_pedido: 'PED-1', etapas_entrega: [] },
    empresaId: 'e1', groupId: 'g1', valorTotal: 10,
    toast: { error: () => {}, success: () => { efeitos.push('sucesso'); } },
    filterInContext: async () => [],
    assertFaturamentoDentroDoPedido: () => ({ status: 'Faturado' }),
    createInContext: async (entity) => {
      efeitos.push('criar:' + entity);
      return { id: 'nf-1', status: 'Pendente' };
    },
    updateInContext: async (entity, _id, patch) => {
      efeitos.push('atualizar:' + entity + ':' + patch.status);
      return patch;
    },
    faturarPedidoCompleto: async () => ({ erros: ['baixa falhou'] }),
    auditFechamento: async () => {},
    setFormData: () => { efeitos.push('setFormData'); },
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await assert.rejects(() => emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1',
    cliente_id: 'c1', cliente_nome: 'Cliente', valor_total: 10, escopo: 'pedido_inteiro' }), /baixa falhou/);
  assert.deepEqual(efeitos, ['criar:NotaFiscal', 'atualizar:NotaFiscal:Rejeitada']);
});

test('falha ao atualizar Pedido após baixa não rejeita NF válida', async () => {
  const source = await readFile(new URL('../src/components/comercial/FechamentoFinanceiroTab.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('onEmitir={async (dadosNFe) => {');
  const end = source.indexOf('\n        }}', start);
  const handlerSource = source.slice(start + 'onEmitir={'.length, end) + '\n}';
  const efeitos = [];
  const ctx = {
    formData: { id: 'ped-1', empresa_id: 'e1', numero_pedido: 'PED-1', etapas_entrega: [] },
    empresaId: 'e1', groupId: 'g1', valorTotal: 10,
    toast: { error: () => {}, success: () => {} },
    filterInContext: async () => [],
    assertFaturamentoDentroDoPedido: () => ({ status: 'Faturado' }),
    createInContext: async () => ({ id: 'nf-1', status: 'Pendente' }),
    updateInContext: async (entity) => {
      efeitos.push(entity);
      if (entity === 'Pedido') throw new Error('falha pedido');
    },
    faturarPedidoCompleto: async () => ({ erros: [] }),
    auditFechamento: async () => {},
    setFormData: () => {},
    setModalNFeOpen: () => {},
  };
  const emitir = runInNewContext('(' + handlerSource + ')', ctx);
  await assert.rejects(() => emitir({ pedido_id: 'ped-1', numero_pedido: 'PED-1',
    cliente_id: 'c1', cliente_nome: 'Cliente', valor_total: 10, escopo: 'pedido_inteiro' }), /conciliacao manual/);
  assert.deepEqual(efeitos, ['Pedido']);
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

test('fechamento compensa reserva parcial e nao entra em financeiro ou logistica', async () => {
  const efeitos = [];
  const reserva = await executarReservasComCompensacao({
    itens: [
      { produto_id: 'p1', quantidade: 1, unidade: 'UN' },
      { produto_id: 'p2', quantidade: 1, unidade: 'UN' },
    ],
    reservar: async (item) => {
      efeitos.push('reservar:' + item.produto_id);
      if (item.produto_id === 'p2') throw new Error('falha-p2');
      return { id: 'r1', produto_id: item.produto_id };
    },
    compensar: async (movimento) => {
      efeitos.push('compensar:' + movimento.id);
      return { id: 'c1' };
    },
  });
  if (!reserva.bloqueado) efeitos.push('financeiro', 'logistica', 'status');
  assert.deepEqual(efeitos, ['reservar:p1', 'reservar:p2', 'compensar:r1']);
  assert.equal(reserva.bloqueado, true);
  assert.deepEqual(reserva.compensadas, [{ id: 'c1' }]);
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const fechamento = fluxo.slice(fluxo.indexOf('export async function executarFechamentoCompleto'));
  assert.ok(fechamento.indexOf('if (reserva.bloqueado)') < fechamento.indexOf('// ETAPA 2: Gerar Financeiro'));
  assert.match(fechamento, /return resultados;[\s\S]*?\/\/ ETAPA 2: Gerar Financeiro/);
});

test('reserva sem confirmacao compensa a anterior e bloqueia efeitos posteriores', async () => {
  const efeitos = [];
  const resultado = await executarReservasComCompensacao({
    itens: [{ produto_id: 'p1', quantidade: 2, unidade: 'UN' }, { produto_id: 'p2', quantidade: 1, unidade: 'UN' }],
    reservar: async (item) => {
      efeitos.push(`reservar:${item.produto_id}`);
      return item.produto_id === 'p1' ? { id: 'r1', produto_id: 'p1' } : undefined;
    },
    compensar: async (reserva) => { efeitos.push(`compensar:${reserva.id}`); return { id: 'c1' }; },
  });
  if (!resultado.bloqueado) efeitos.push('financeiro', 'expedicao', 'status');
  assert.deepEqual(efeitos, ['reservar:p1', 'reservar:p2', 'compensar:r1']);
  assert.equal(resultado.bloqueado, true);
  assert.deepEqual(resultado.compensadas, [{ id: 'c1' }]);
  assert.match(resultado.erros[0], /sem confirmacao/);
});

test('aprovacao real para no item sem recibo, compensa e nao aciona producao ou financeiro', async () => {
  const source = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export async function aprovarPedidoCompleto');
  const end = source.indexOf('export async function validarLimiteCredito', start);
  const approvalSource = source.slice(start, end).replace(/^export /, '');
  const efeitos = [];
  const approve = runInNewContext(`(${approvalSource})`, {
    ...fluxoEstoqueLegadoHttp,
    normalizarContextoOperacao: () => ({ groupId: 'g1', empresaId: 'e1' }),
    validarLimiteCredito: async () => ({ aprovado: true }),
    validarItensReservaEstoque,
    reservarEstoqueItemAprovacao: async (item) => {
      efeitos.push(`reserva:${item.produto_id}`);
      return item.produto_id === 'p1' ? { id: 'r1', produto_id: 'p1' } : undefined;
    },
    avaliarReservaParcial,
    liberarReservaEstoque: async (reserva) => { efeitos.push(`compensa:${reserva.id}`); return { id: 'c1' }; },
    gerarOPAutomatica: async () => { efeitos.push('producao'); },
    gerarContaReceber: async () => { efeitos.push('financeiro'); },
    updateScoped: async () => { efeitos.push('status'); },
  });
  const result = await approve({ id: 'ped-1', itens_revenda: [
    { produto_id: 'p1', unidade: 'UN', quantidade: 2 },
    { produto_id: 'p2', unidade: 'UN', quantidade: 1 },
    { produto_id: 'p3', unidade: 'UN', quantidade: 1 },
  ], itens_producao: [{}], forma_pagamento: 'PIX', parcelas: [{}] }, 'e1');
  assert.deepEqual(efeitos, ['reserva:p1', 'reserva:p2', 'compensa:r1']);
  assert.equal(result.reservaEstoqueBloqueada, true);
  assert.equal(result.reservasCompensadas.length, 1);
  assert.equal(result.erros.length, 1);
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
  assert.match(releaseBody, /saldoReservaPedidoProduto/);
  assert.match(releaseBody, /skipped: true/);
});

test('stock validator uses tenant-scoped available balance instead of physical balance', async () => {
  const validator = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  assert.match(validator, /group_id: groupId, empresa_id: empresaId/);
  assert.match(validator, /estoqueAtual - estoqueReservado/);
  assert.match(validator, /estoqueDisponivel >= quantidadeTotalProduto/);
});

test('stock validator aggregates repeated product demand before comparing availability', async () => {
  const validator = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  assert.match(validator, /demandaPorProduto/);
  assert.match(validator, /quantidadeTotalProduto/);
  assert.match(validator, /estoqueDisponivel >= quantidadeTotalProduto/);
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
