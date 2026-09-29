import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applySimulacaoToForm,
  assertPromocaoAplicadaOuFalhar,
  assertSimulacaoNoContexto,
  buildSimularVendaPayload,
  buildSimulacaoPreviewState,
  canSimularVenda,
  formatParcelasSchedule,
  mergeSimulacaoBeforeSave,
  resolveDisplayTotals,
} from '../src/components/comercial/comercialSimulacaoUiPolicy.js';

const GROUP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMPRESA_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CLIENTE = '11111111-1111-4111-8111-111111111111';
const CONDICAO = '22222222-2222-4222-8222-222222222222';
const PRODUTO = '33333333-3333-4333-8333-333333333333';
const UNIDADE = '44444444-4444-4444-8444-444444444444';

const formBase = () => ({
  cliente_empresa_id: CLIENTE,
  condicao_pagamento_id: CONDICAO,
  validade_em: '2026-10-15',
  itens: [{
    produto_id: PRODUTO,
    unidade_id: UNIDADE,
    descricao: 'Produto sintético',
    unidade_sigla: 'UN',
    quantidade: '2',
    preco_unitario: '50.000000',
    desconto: '0',
    requer_producao: false,
  }],
});

const simulationA = (overrides = {}) => ({
  group_id: GROUP_A,
  empresa_id: EMPRESA_A,
  cliente_empresa_id: CLIENTE,
  base_date: '2026-10-15',
  condicao: {
    id: CONDICAO,
    codigo: 'CP-30',
    nome: '30 dias',
    parcelas: [{ ordem: 1, dias: 30, percentual: '100.000000' }],
  },
  promocao: null,
  itens: [{
    produto_id: PRODUTO,
    unidade_id: UNIDADE,
    descricao: 'Produto sintético',
    unidade_sigla: 'UN',
    quantidade: '2.000000',
    preco_unitario: '100.000000',
    desconto: '5.000000',
    subtotal: '200.000000',
    total: '195.000000',
  }],
  subtotal: '200.000000',
  desconto: '5.000000',
  total: '195.000000',
  desconto_bps: 250,
  aprovacao_desconto_exigida: false,
  parcelas: [{
    ordem: 1, dias: 30, percentual: '100.000000', valor: '195.000000', vencimento: '2026-11-14',
  }],
  ...overrides,
});

test('RBAC fail-closed: simular exige visualizar orçamento ou pedido', () => {
  assert.equal(canSimularVenda(() => false), false);
  assert.equal(canSimularVenda((m, s, a) => m === 'Comercial' && s === 'orcamento' && a === 'criar'), false);
  assert.equal(canSimularVenda((m, s, a) => m === 'Comercial' && s === 'orcamento' && a === 'visualizar'), true);
  assert.equal(canSimularVenda((m, s, a) => m === 'Comercial' && s === 'pedido' && a === 'visualizar'), true);
  assert.equal(canSimularVenda(null), false);
});

test('happy path: payload estrito sem tenant e com promoção opcional', () => {
  const payload = buildSimularVendaPayload(formBase(), { baseDate: '2026-10-15', promocaoBps: 500, cupom: ' cpa10 ' });
  assert.deepEqual(Object.keys(payload).sort(), ['base_date', 'cliente_empresa_id', 'condicao_pagamento_id', 'itens', 'promocao']);
  assert.equal(payload.promocao.bps, 500);
  assert.equal(payload.promocao.cupom, 'cpa10');
  assert.equal('groupId' in payload, false);
  assert.equal('empresaId' in payload, false);
  assert.equal(payload.itens[0].quantidade, '2.000000');
  assert.equal('preco_unitario' in payload.itens[0], false);
});

test('payload bloqueia item incompleto e promoção inválida', () => {
  assert.throws(() => buildSimularVendaPayload({ ...formBase(), cliente_empresa_id: '' }), /cliente/i);
  assert.throws(() => buildSimularVendaPayload({ ...formBase(), itens: [] }), /item/i);
  assert.throws(() => buildSimularVendaPayload(formBase(), { promocaoBps: 0 }), /basis points/i);
  assert.throws(() => buildSimularVendaPayload(formBase(), { promocaoBps: 1.5 }), /basis points/i);
  assert.throws(() => buildSimularVendaPayload(formBase(), { baseDate: '15/10/2026' }), /data base/i);
});

test('contexto Grupo/Empresa A vs B: rejeita simulação cruzada', () => {
  const sim = simulationA();
  assert.equal(assertSimulacaoNoContexto(sim, { groupId: GROUP_A, empresaId: EMPRESA_A }).empresa_id, EMPRESA_A);
  assert.throws(
    () => assertSimulacaoNoContexto(sim, { groupId: GROUP_A, empresaId: EMPRESA_B }),
    /fora do contexto/i,
  );
  assert.throws(
    () => assertSimulacaoNoContexto(sim, { groupId: '', empresaId: EMPRESA_A }),
    /obrigatório/i,
  );
});

test('promoção fail-closed: sem confirmação do servidor não aplica', () => {
  const sim = simulationA({ promocao: null });
  assert.throws(() => assertPromocaoAplicadaOuFalhar(sim, true), /não aplicada/i);
  assert.equal(assertPromocaoAplicadaOuFalhar(sim, false), sim);
  assert.equal(
    assertPromocaoAplicadaOuFalhar(simulationA({ promocao: { aplicada: true, promocaoBps: 500 } }), true).promocao.aplicada,
    true,
  );
});

test('aplica preços/desconto/condição no formulário sem inventar campos persistidos', () => {
  const next = applySimulacaoToForm(formBase(), simulationA());
  assert.equal(next.condicao_pagamento_id, CONDICAO);
  assert.equal(next.itens[0].preco_unitario, '100.000000');
  assert.equal(next.itens[0].desconto, '5.000000');
  assert.equal(next.itens[0].requer_producao, false);
  assert.equal(next.validade_em, '2026-10-15');
  assert.throws(
    () => applySimulacaoToForm(formBase(), simulationA({
      itens: [{ ...simulationA().itens[0], produto_id: '99999999-9999-4999-8999-999999999999' }],
    })),
    /divergência/i,
  );
});

test('agenda de parcelas e preview UI', () => {
  const preview = buildSimulacaoPreviewState(simulationA({
    promocao: { aplicada: true, promocaoBps: 500 },
    aprovacao_desconto_exigida: true,
  }));
  assert.equal(preview.promocao.bps, 500);
  assert.equal(preview.aprovacaoDescontoExigida, true);
  assert.equal(preview.parcelas.length, 1);
  assert.match(preview.parcelas[0].label, /30d/);
  assert.deepEqual(formatParcelasSchedule([]), []);
});

test('totais: prioriza preview do servidor; rascunho local sem inventar persistência', () => {
  const preview = buildSimulacaoPreviewState(simulationA());
  const display = resolveDisplayTotals(preview, { subtotal: '999', desconto: '1', total: '998' });
  assert.equal(display.source, 'server');
  assert.equal(display.total, '195.000000');
  const draft = resolveDisplayTotals(null, { subtotal: '10', desconto: '1', total: '9' });
  assert.equal(draft.source, 'local-draft');
  assert.equal(draft.total, '9');
});

test('mergeSimulacaoBeforeSave aplica última simulação no contexto', () => {
  const merged = mergeSimulacaoBeforeSave(formBase(), simulationA(), { groupId: GROUP_A, empresaId: EMPRESA_A });
  assert.equal(merged.itens[0].preco_unitario, '100.000000');
  assert.equal(merged.itens[0].desconto, '5.000000');
  assert.equal(mergeSimulacaoBeforeSave(formBase(), null, { groupId: GROUP_A, empresaId: EMPRESA_A }).itens[0].preco_unitario, '50.000000');
  assert.throws(
    () => mergeSimulacaoBeforeSave(formBase(), simulationA(), { groupId: GROUP_A, empresaId: EMPRESA_B }),
    /fora do contexto/i,
  );
});

test('Orçamento e Pedido canônicos ligam simular-venda sem módulo paralelo', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/httpApiClient.js', import.meta.url), 'utf8');
  assert.match(orc, /comercialApi\.simularVenda/);
  assert.match(orc, /mergeSimulacaoBeforeSave/);
  assert.match(orc, /resolveDisplayTotals/);
  assert.match(orc, /Aplicar preços da simulação/);
  assert.match(orc, /canSimularVenda/);
  assert.match(ped, /comercialApi\.simularVenda/);
  assert.match(ped, /mergeSimulacaoBeforeSave/);
  assert.match(ped, /resolveDisplayTotals/);
  assert.match(ped, /data-action="Comercial\.simular-venda"/);
  assert.match(client, /\/api\/v1\/comercial\/simular-venda/);
  assert.match(client, /\/api\/v1\/condicoes-pagamento\/resolve/);
  assert.doesNotMatch(orc, /ComercialV2|SimulacaoVendaTab/);
  assert.doesNotMatch(ped, /base44\.entities/);
});

test('buildPersistedPromocaoSnapshotFromRow e collectPersistedCommercialSnapshots proveem round-trip', async () => {
  const {
    buildPersistedPromocaoSnapshotFromRow,
    collectPersistedCommercialSnapshots,
    promoInputsFromPersistedSnapshot,
  } = await import('../src/components/comercial/comercialSimulacaoUiPolicy.js');

  assert.equal(buildPersistedPromocaoSnapshotFromRow(null), null);
  assert.equal(buildPersistedPromocaoSnapshotFromRow({ promocao_aplicada: true, promocao_bps: 0 }), null);
  assert.deepEqual(buildPersistedPromocaoSnapshotFromRow({ promocao_aplicada: false }), {
    aplicada: false,
    bps: null,
    cupom: null,
    fonte: 'persistido',
    persistido: true,
  });
  const promo = buildPersistedPromocaoSnapshotFromRow({
    promocao_aplicada: true,
    promocao_bps: 500,
    promocao_cupom: 'CPA10',
  });
  assert.equal(promo.aplicada, true);
  assert.equal(promo.bps, 500);
  assert.equal(promo.cupom, 'CPA10');
  assert.equal(promo.persistido, true);
  assert.deepEqual(promoInputsFromPersistedSnapshot(promo), { promoBps: '500', promoCupom: 'CPA10' });
  assert.deepEqual(promoInputsFromPersistedSnapshot({ aplicada: false }), { promoBps: '', promoCupom: '' });

  const COND = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TAB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const snaps = collectPersistedCommercialSnapshots({
    condicao_pagamento_id: COND,
    condicao_pagamento_codigo_snapshot: '000010',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: TAB,
    tabela_preco_codigo_snapshot: '000020',
    tabela_preco_nome_snapshot: 'Atacado',
    promocao_aplicada: true,
    promocao_bps: 250,
    promocao_cupom: 'VIP5',
  });
  assert.equal(snaps.condicao?.persistido, true);
  assert.equal(snaps.condicao?.nome, '28 dias');
  assert.equal(snaps.condicao?.parcelas?.[0]?.dias, 28);
  assert.equal(snaps.tabela?.persistido, true);
  assert.equal(snaps.tabela?.codigo, '000020');
  assert.equal(snaps.promocao?.bps, 250);
  assert.equal(snaps.promocao?.cupom, 'VIP5');
});

test('Orçamento/Pedido mantêm formulário aberto e recarregam snapshots após save', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(orc, /collectPersistedCommercialSnapshots/);
  assert.match(orc, /mapOrcamentoRowToForm\(saved\)/);
  assert.match(orc, /applyPersistedSnapshotsFromRow\(saved\)/);
  assert.match(orc, /setFormOpen\(true\)/);
  assert.match(orc, /data-testid="orcamento-condicao-snapshot"/);
  assert.match(orc, /data-testid="orcamento-tabela-snapshot"/);
  assert.match(orc, /data-testid="orcamento-promocao-snapshot"/);
  assert.match(ped, /collectPersistedCommercialSnapshots/);
  assert.match(ped, /mapPedidoRowToForm\(saved\)/);
  assert.match(ped, /applyPersistedSnapshotsFromRow\(saved\)/);
  assert.match(ped, /data-testid="pedido-condicao-snapshot"/);
  assert.match(ped, /data-testid="pedido-tabela-snapshot"/);
  assert.match(ped, /data-testid="pedido-promocao-snapshot"/);
  assert.doesNotMatch(orc, /setFormOpen\(false\);\s*setEditing\(null\);\s*setSelected\(saved\);\s*resetSimulacaoUi/);
});
