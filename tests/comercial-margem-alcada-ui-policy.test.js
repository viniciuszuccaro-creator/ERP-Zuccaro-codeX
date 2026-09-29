import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canAprovarMargemAlcada,
  computeMargemBpsUi,
  evaluateMargemAlcadaUi,
  formatMargemAlcadaHttpError,
  lineAbaixoDaMargemMinimaUi,
  resolveMargemCostLookupFromItems,
} from '../src/components/comercial/comercialMargemAlcadaUiPolicy.js';
import { formatComercialHttpError } from '../src/components/comercial/comercialListHttpUiPolicy.js';

const produtoId = '33333333-3333-4333-8333-333333333333';
const unidadeId = '44444444-4444-4444-8444-444444444444';

const item = (overrides = {}) => ({
  produto_id: produtoId,
  unidade_id: unidadeId,
  quantidade: '1',
  preco_unitario: '100.000000',
  desconto: '0',
  ...overrides,
});

const allow = (section, action) => (m, s, a) => m === 'Comercial' && s === section && a === action;

test('sem snapshot de custo → skip (não inventa, não bloqueia)', () => {
  const decision = evaluateMargemAlcadaUi({
    items: [item()],
    hasPermission: () => false,
    entity: 'orcamento',
  });
  assert.equal(decision.costSnapshotPresent, false);
  assert.equal(decision.anyAbaixo, false);
  assert.equal(decision.canSave, true);
  assert.equal(decision.blockCode, null);
});

test('resolveMargemCostLookupFromItems ignora preço e só aceita custo explícito', () => {
  const empty = resolveMargemCostLookupFromItems([item({ preco_unitario: '50' })]);
  assert.equal(empty.size, 0);

  const fromItem = resolveMargemCostLookupFromItems([item({ custo_unitario: '80.000000' })]);
  assert.equal(fromItem.size, 1);
  assert.equal(fromItem.get(`${produtoId}|${unidadeId}`).custo_unitario, '80.000000');

  const key = `${produtoId}|${unidadeId}`;
  const fromLookup = resolveMargemCostLookupFromItems(
    [item()],
    { [key]: { custo_unitario: '70', margem_minima_bps: 500 } },
  );
  assert.equal(fromLookup.get(key).margem_minima_bps, 500);

  // Lookup explícito null → skip (não inventa)
  const skipped = resolveMargemCostLookupFromItems([item()], { [key]: null });
  assert.equal(skipped.size, 0);
});

test('preço >= custo com mínima 0 → ok sem aprovar', () => {
  const decision = evaluateMargemAlcadaUi({
    items: [item({ preco_unitario: '10', custo_unitario: '10' })],
    hasPermission: () => false,
    entity: 'pedido',
  });
  assert.equal(decision.anyAbaixo, false);
  assert.equal(decision.canSave, true);
  assert.equal(decision.costSnapshotPresent, true);
});

test('venda abaixo do custo (mínima 0) sem aprovar → bloqueia', () => {
  const decision = evaluateMargemAlcadaUi({
    items: [item({ preco_unitario: '9', custo_unitario: '10' })],
    hasPermission: allow('orcamento', 'criar'),
    entity: 'orcamento',
  });
  assert.equal(decision.anyAbaixo, true);
  assert.equal(decision.canSave, false);
  assert.equal(decision.blockCode, 'MARGEM_ALCADA_DENIED');
  assert.match(decision.hint, /aprovar/i);
});

test('abaixo da mínima com aprovar → permite + aviso (backend audita)', () => {
  const decision = evaluateMargemAlcadaUi({
    items: [item({ preco_unitario: '9', custo_unitario: '10' })],
    hasPermission: allow('pedido', 'aprovar'),
    entity: 'pedido',
  });
  assert.equal(decision.anyAbaixo, true);
  assert.equal(decision.canSave, true);
  assert.equal(decision.aprovacaoExigida, true);
  assert.match(decision.hint, /servidor valida/i);
});

test('desconto que derruba margem abaixo da mínima → bloqueia', () => {
  // líquido 90, custo 80, mínima 1500 bps → ~11.11% < 15%
  const decision = evaluateMargemAlcadaUi({
    items: [item({
      preco_unitario: '100',
      desconto: '10',
      custo_unitario: '80',
      margem_minima_bps: 1500,
    })],
    hasPermission: () => false,
    entity: 'orcamento',
  });
  assert.equal(decision.anyAbaixo, true);
  assert.equal(decision.canSave, false);
  assert.equal(decision.blockCode, 'MARGEM_ALCADA_DENIED');
});

test('fração de bp sem truncar (paridade backend)', () => {
  const net = 1_000_000_000n; // 1000.000000
  const cost = 999_999_999n; // 999.999999
  assert.equal(lineAbaixoDaMargemMinimaUi(net, cost, 1), true);
  assert.equal(computeMargemBpsUi(net, cost), 0);
  assert.equal(lineAbaixoDaMargemMinimaUi(net, cost, 0), false);
});

test('RBAC aprovar fail-closed por seção', () => {
  assert.equal(canAprovarMargemAlcada(null, 'orcamento'), false);
  assert.equal(canAprovarMargemAlcada(() => false, 'pedido'), false);
  assert.equal(canAprovarMargemAlcada(allow('orcamento', 'criar'), 'orcamento'), false);
  assert.equal(canAprovarMargemAlcada(allow('orcamento', 'aprovar'), 'orcamento'), true);
  assert.equal(canAprovarMargemAlcada(allow('pedido', 'aprovar'), 'orcamento'), false);
});

test('formatComercialHttpError mapeia MARGEM_ALCADA_DENIED', () => {
  assert.match(
    formatComercialHttpError({
      status: 403,
      body: { error: { code: 'MARGEM_ALCADA_DENIED', message: 'Orçamento com margem abaixo da mínima exige permissão de aprovar' } },
    }, { entityLabel: 'Orçamento' }),
    /margem.*m[ií]nima.*aprovar/i,
  );
  assert.match(
    formatMargemAlcadaHttpError({
      status: 403,
      body: { error: { code: 'MARGEM_ALCADA_DENIED', message: 'Pedido com margem abaixo da mínima' } },
    }, 'Pedido'),
    /margem.*m[ií]nima.*aprovar/i,
  );
});

test('painéis Orçamento/Pedido exibem margem fail-closed e trava de save', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(orc, /evaluateMargemAlcadaUi/);
  assert.match(orc, /orcamento-margem-alcada-alert/);
  assert.match(orc, /!margemAlcada\.canSave/);
  assert.match(ped, /evaluateMargemAlcadaUi/);
  assert.match(ped, /pedido-margem-alcada-alert/);
  assert.match(ped, /!margemAlcada\.canSave/);
});
