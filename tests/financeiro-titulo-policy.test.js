import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertTituloOnCreate,
  assertTituloOnDelete,
  assertTituloOnUpdate,
  assertTitulosProntosParaCaixa,
  assertPedidoVinculoTitulo,
  applyPedidoVinculoAoForm,
  filterPedidosParaTitulo,
  findDuplicateTitulo,
  tituloIdempotencyKey,
  tituloSettlementPermissionActions,
} from '../src/components/lib/financeiroTituloPolicy.js';

const titulo = {
  id: 'cr-1',
  empresa_id: 'cpa-aco',
  pedido_id: 'ped-1',
  numero_parcela: '1/3',
  valor: 100,
  valor_recebido: 100,
  status: 'Recebido',
  origem_tipo: 'pedido',
};

test('liquidated titles cannot be deleted', () => {
  assert.throws(() => assertTituloOnDelete(titulo), /Nao excluir titulo liquidado/);
  assert.doesNotThrow(() => assertTituloOnDelete({ ...titulo, status: 'Pendente' }));
});

test('settled amount and order link stay frozen after baixa', () => {
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { valor: 80 } }),
    /recalculados apos baixa/,
  );
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { valor_recebido: 50 } }),
    /recalculados apos baixa/,
  );
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { pedido_id: '' } }),
    /recalculados apos baixa/,
  );
});

test('retry of the same settlement is idempotent', () => {
  const decision = assertTituloOnUpdate({
    before: titulo,
    patch: { status: 'Recebido', data_recebimento: '2026-09-07' },
  });
  assert.equal(decision.reuse.id, 'cr-1');
});

test('conciliation after settlement requires conciliar path', () => {
  const decision = assertTituloOnUpdate({
    before: titulo,
    patch: { status: 'Conciliado', data_conciliacao: '2026-09-08' },
  });
  assert.equal(decision.conciliation, true);
  assert.equal(decision.record.status, 'Conciliado');
  assert.equal(decision.record.valor, 100);
});

test('cancel after settlement is blocked', () => {
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { status: 'Cancelado' } }),
    /Estorno deve preservar historico/,
  );
});

test('estorno keeps the original value and history', () => {
  const decision = assertTituloOnUpdate({
    before: titulo,
    patch: { status: 'Estornado' },
  });
  assert.equal(decision.estorno, true);
  assert.equal(decision.record.valor, 100);
  assert.equal(decision.record.pedido_id, 'ped-1');
  assert.equal(decision.record.historico_eventos.at(-1).acao, 'estorno');
});

test('duplicate receivable from the same order installment is reused', () => {
  const incoming = {
    empresa_id: 'cpa-aco',
    group_id: 'g-cpa',
    pedido_id: 'ped-1',
    numero_parcela: '1',
    origem_tipo: 'pedido',
    valor: 100,
  };
  const pedido = { id: 'ped-1', empresa_id: 'cpa-aco', group_id: 'g-cpa' };
  assert.equal(tituloIdempotencyKey(incoming), tituloIdempotencyKey(titulo));
  assert.equal(findDuplicateTitulo(incoming, [titulo])?.id, 'cr-1');
  assert.equal(assertTituloOnCreate({
    record: incoming,
    titles: [titulo],
    pedido,
    groupId: 'g-cpa',
    empresaId: 'cpa-aco',
  }).reuse.id, 'cr-1');
});

test('payment of another company is blocked', () => {
  assert.throws(
    () => assertTituloOnUpdate({ before: titulo, patch: { empresa_id: '3z' } }),
    /empresa correta/,
  );
});

test('settlement permission actions include baixa aliases', () => {
  assert.deepEqual(tituloSettlementPermissionActions('ContaReceber'), ['receber', 'baixar', 'liquidar']);
  assert.deepEqual(tituloSettlementPermissionActions('ContaPagar'), ['pagar', 'baixar', 'liquidar']);
});

test('vinculo pedido no titulo exige mesmo grupo/empresa', () => {
  assert.throws(
    () => assertPedidoVinculoTitulo({
      record: { pedido_id: 'ped-1', empresa_id: 'e1' },
      pedido: { id: 'ped-1', empresa_id: 'e1', group_id: 'g1' },
      groupId: '',
      empresaId: 'e1',
    }),
    /grupo e empresa/,
  );
  assert.throws(
    () => assertPedidoVinculoTitulo({
      record: { pedido_id: 'ped-1', empresa_id: 'e1', group_id: 'g1' },
      pedido: { id: 'ped-1', empresa_id: 'outra', group_id: 'g1' },
      groupId: 'g1',
      empresaId: 'e1',
    }),
    /outra empresa/,
  );
  assert.throws(
    () => assertPedidoVinculoTitulo({
      record: { pedido_id: 'ped-1', empresa_id: 'e1', group_id: 'g1' },
      pedido: null,
      groupId: 'g1',
      empresaId: 'e1',
    }),
    /nao encontrado/,
  );
  const ok = assertPedidoVinculoTitulo({
    record: { pedido_id: 'ped-1', empresa_id: 'e1', group_id: 'g1', valor: 10 },
    pedido: { id: 'ped-1', empresa_id: 'e1', group_id: 'g1' },
    groupId: 'g1',
    empresaId: 'e1',
  });
  assert.equal(ok.record.origem_tipo, 'pedido');
  assert.equal(ok.record.origem_documento_id, 'ped-1');

  const filtrados = filterPedidosParaTitulo({
    pedidos: [
      { id: 'a', empresa_id: 'e1', group_id: 'g1' },
      { id: 'b', empresa_id: 'e2', group_id: 'g1' },
      { id: 'c', empresa_id: 'e1', group_id: 'g2' },
    ],
    groupId: 'g1',
    empresaId: 'e1',
  });
  assert.deepEqual(filtrados.map((p) => p.id), ['a']);

  const linked = applyPedidoVinculoAoForm({
    form: { descricao: '', valor: 0, origem_tipo: 'manual' },
    pedido: { id: 'ped-9', numero_pedido: 'P-9', cliente_id: 'c1', cliente_nome: 'Cliente', valor_total: 55 },
  });
  assert.equal(linked.pedido_id, 'ped-9');
  assert.equal(linked.origem_tipo, 'pedido');
  assert.equal(linked.cliente_id, 'c1');
  assert.equal(linked.valor, 55);
  assert.match(linked.descricao, /P-9/);
});

test('create com pedido estranho a empresa e bloqueado', () => {
  assert.throws(
    () => assertTituloOnCreate({
      record: { empresa_id: 'e1', group_id: 'g1', pedido_id: 'ped-x', valor: 10 },
      pedido: { id: 'ped-x', empresa_id: 'e2', group_id: 'g1' },
      groupId: 'g1',
      empresaId: 'e1',
    }),
    /outra empresa/,
  );
  const created = assertTituloOnCreate({
    record: { empresa_id: 'e1', group_id: 'g1', pedido_id: 'ped-x', valor: 10 },
    pedido: { id: 'ped-x', empresa_id: 'e1', group_id: 'g1' },
    groupId: 'g1',
    empresaId: 'e1',
  });
  assert.equal(created.record.origem_tipo, 'pedido');
  assert.equal(created.reuse, null);
});

test('envio ao caixa exige contexto unico e bloqueia titulo liquidado', () => {
  assert.throws(
    () => assertTitulosProntosParaCaixa({ titulos: [{ id: '1', group_id: 'g', empresa_id: 'e', valor: 10 }], groupId: '', empresaId: 'e' }),
    /grupo e empresa/,
  );
  assert.throws(
    () => assertTitulosProntosParaCaixa({
      titulos: [
        { id: '1', group_id: 'g', empresa_id: 'e', valor: 10 },
        { id: '2', group_id: 'g', empresa_id: 'outra', valor: 5 },
      ],
      groupId: 'g',
      empresaId: 'e',
    }),
    /outro grupo\/empresa/,
  );
  assert.throws(
    () => assertTitulosProntosParaCaixa({
      titulos: [{ id: '1', group_id: 'g', empresa_id: 'e', valor: 10, status: 'Recebido' }],
      groupId: 'g',
      empresaId: 'e',
    }),
    /liquidado/,
  );
  const ok = assertTitulosProntosParaCaixa({
    titulos: [
      { id: '1', group_id: 'g', empresa_id: 'e', valor: 10, status: 'Pendente', pedido_id: 'p1' },
      { id: '2', group_id: 'g', empresa_id: 'e', valor: 5.5, status: 'Aberto' },
    ],
    groupId: 'g',
    empresaId: 'e',
  });
  assert.equal(ok.quantidade, 2);
  assert.equal(ok.total, 15.5);
});

test('finance persistence blocks delete of settled titles and closes caixa/conciliacao fail-open', async () => {
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const updateTransitions = await readFile(new URL('../src/api/localEntityUpdateTransitions.js', import.meta.url), 'utf8');
  const fluxo = await readFile(new URL('../src/components/lib/useFluxoPedido.jsx', import.meta.url), 'utf8');
  const lote = await readFile(new URL('../src/components/financeiro/LiquidacaoEmLote.jsx', import.meta.url), 'utf8');
  const ordens = await readFile(new URL('../src/components/financeiro/caixa-central/OrdensLiquidacaoPendentes.jsx', import.meta.url), 'utf8');
  const pdv = await readFile(new URL('../src/components/financeiro/CaixaPDVCompleto.jsx', import.meta.url), 'utf8');
  const liquidar = await readFile(new URL('../src/components/financeiro/caixa-central/LiquidarReceberPagar.jsx', import.meta.url), 'utf8');
  const conciliacao = await readFile(new URL('../src/components/financeiro/ConciliacaoEmLote.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/financeiro/ConciliacaoBancariaTab.jsx', import.meta.url), 'utf8');
  const payment = await readFile(new URL('../base44/functions/paymentStatusManager/entry.ts', import.meta.url), 'utf8');
  const guard = await readFile(new URL('../base44/functions/_lib/security/entityGuardPolicy/entry.ts', import.meta.url), 'utf8');

  assert.match(client, /assertTituloOnDelete/);
  assert.match(client, /assertLocalTituloSettlementAllowed/);
  assert.match(client, /ContaReceber: \{ module: 'Financeiro'/);
  assert.match(client, /applyLocalEntityUpdateTransitions/);
  assert.match(updateTransitions, /decision\.conciliation/);
  assert.match(updateTransitions, /assertMutationAllowed\(entityName, 'conciliar'/);
  assert.match(fluxo, /origem_documento_id: `\$\{pedido\.id\}/);
  assert.match(lote, /Sem permissao para baixa manual/);
  assert.doesNotMatch(ordens, /canEdit\('Financeiro', 'Caixa'\)/);
  assert.match(ordens, /ContaReceber', 'receber'/);
  assert.doesNotMatch(pdv, /canEdit\('Financeiro', 'Contas a Receber'\)/);
  assert.match(pdv, /podeLiquidarTitulosReceber/);
  assert.doesNotMatch(liquidar, /hasPermission\("Financeiro", null, "editar"\)/);
  assert.match(conciliacao, /podeConciliar/);
  assert.match(conciliacao, /updateInContext\('ContaReceber'/);
  assert.doesNotMatch(tab, /canEdit\('Financeiro'/);
  assert.match(tab, /'conciliar'/);
  assert.match(payment, /assertFinanceSettlementPermission/);
  assert.match(payment, /Estorno deve preservar historico/);
  assert.match(guard, /'baixar'/);
  const enviarCaixa = await readFile(new URL('../src/components/financeiro/EnviarParaCaixa.jsx', import.meta.url), 'utf8');
  assert.match(enviarCaixa, /assertTitulosProntosParaCaixa/);
  assert.match(enviarCaixa, /data-action="enviar-para-caixa"/);
  assert.match(enviarCaixa, /pedido_id/);
  const vinculos = await readFile(new URL('../src/components/financeiro/ContaReceberVinculosSection.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/financeiro/ContaReceberForm.jsx', import.meta.url), 'utf8');
  assert.match(vinculos, /filterPedidosParaTitulo/);
  assert.match(vinculos, /applyPedidoVinculoAoForm/);
  assert.match(form, /assertTituloOnCreate/);
  assert.match(client, /getEntityStore\(db, 'Pedido'\)/);
});
