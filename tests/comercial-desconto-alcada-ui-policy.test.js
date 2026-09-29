import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  beginSaveOnce,
  canAprovarDescontoAlcada,
  computeDescontoBpsFromItems,
  descontoExcedeAlcadaLivreUi,
  endSaveOnce,
  evaluateDescontoAlcadaUi,
  formatDescontoAlcadaHttpError,
} from '../src/components/comercial/comercialDescontoAlcadaUiPolicy.js';
import { formatComercialHttpError } from '../src/components/comercial/comercialListHttpUiPolicy.js';

const item = (overrides = {}) => ({
  quantidade: '1',
  preco_unitario: '100.000000',
  desconto: '0',
  ...overrides,
});

const allow = (section, action) => (m, s, a) => m === 'Comercial' && s === section && a === action;

test('desconto zero não excede alçada livre', () => {
  assert.equal(descontoExcedeAlcadaLivreUi([item()]), false);
  assert.equal(computeDescontoBpsFromItems([item()]).descontoBps, 0);
});

test('qualquer desconto > 0 excede alçada livre padrão (0 bps)', () => {
  assert.equal(descontoExcedeAlcadaLivreUi([item({ desconto: '1.000000' })]), true);
});

test('desconto positivo abaixo de 1 bp ainda excede alçada 0 (sem truncar)', () => {
  // 0.01 em 1000 = 0.1 bp → truncaria para 0 se usasse Number bps; comparação inteira bloqueia.
  assert.equal(
    descontoExcedeAlcadaLivreUi([item({ quantidade: '1', preco_unitario: '1000.000000', desconto: '0.010000' })]),
    true,
  );
});

test('RBAC aprovar fail-closed por seção', () => {
  assert.equal(canAprovarDescontoAlcada(null, 'orcamento'), false);
  assert.equal(canAprovarDescontoAlcada(() => false, 'orcamento'), false);
  assert.equal(canAprovarDescontoAlcada(allow('orcamento', 'criar'), 'orcamento'), false);
  assert.equal(canAprovarDescontoAlcada(allow('orcamento', 'aprovar'), 'orcamento'), true);
  assert.equal(canAprovarDescontoAlcada(allow('pedido', 'aprovar'), 'pedido'), true);
  assert.equal(canAprovarDescontoAlcada(allow('pedido', 'aprovar'), 'orcamento'), false);
});

test('create com desconto: bloqueia mesmo com aprovar (sem autoaprovação)', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '5' })],
    hasPermission: allow('orcamento', 'aprovar'),
    entity: 'orcamento',
    mode: 'create',
    actorId: 'actor-1',
    criadorActorId: 'actor-1',
  });
  assert.equal(decision.excedeu, true);
  assert.equal(decision.canSave, false);
  assert.equal(decision.blockCode, 'DESCONTO_ALCADA_DENIED');
  assert.match(decision.hint, /outro aprovador/i);
});

test('create com desconto sem aprovar: bloqueia por permissão', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '5' })],
    hasPermission: allow('orcamento', 'criar'),
    entity: 'orcamento',
    mode: 'create',
    actorId: 'actor-1',
  });
  assert.equal(decision.canSave, false);
  assert.match(decision.hint, /aprovar/i);
});

test('update com aprovar e criador desconhecido: permite tentativa + aviso', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '5' })],
    hasPermission: allow('pedido', 'aprovar'),
    entity: 'pedido',
    mode: 'update',
    actorId: 'actor-2',
    criadorActorId: null,
  });
  assert.equal(decision.excedeu, true);
  assert.equal(decision.canSave, true);
  assert.match(decision.hint, /servidor valida/i);
});

test('update com aprovador ≠ criador: permite', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '5' })],
    hasPermission: allow('pedido', 'aprovar'),
    entity: 'pedido',
    mode: 'update',
    actorId: 'aprovador',
    criadorActorId: 'criador',
  });
  assert.equal(decision.canSave, true);
  assert.equal(decision.aprovacaoExigida, true);
});

test('update criador = ator: bloqueia segregação', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '5' })],
    hasPermission: allow('pedido', 'aprovar'),
    entity: 'pedido',
    mode: 'update',
    actorId: 'mesmo',
    criadorActorId: 'mesmo',
  });
  assert.equal(decision.canSave, false);
  assert.match(decision.hint, /outro aprovador/i);
});

test('à vista com regra explícita libera alçada na UI', () => {
  const decision = evaluateDescontoAlcadaUi({
    items: [item({ desconto: '50' })],
    hasPermission: () => false,
    entity: 'orcamento',
    mode: 'create',
    actorId: 'actor-1',
    liberadoPorAvista: true,
  });
  assert.equal(decision.canSave, true);
  assert.equal(decision.aprovacaoExigida, false);
});

test('beginSaveOnce/endSaveOnce: idempotência de duplo clique', () => {
  const ref = { current: false };
  assert.equal(beginSaveOnce(ref), true);
  assert.equal(beginSaveOnce(ref), false);
  assert.equal(beginSaveOnce(ref), false);
  endSaveOnce(ref);
  assert.equal(beginSaveOnce(ref), true);
  endSaveOnce(ref);
});

test('formatComercialHttpError mapeia DESCONTO_ALCADA_DENIED', () => {
  assert.match(
    formatComercialHttpError({
      status: 403,
      body: { error: { code: 'DESCONTO_ALCADA_DENIED', message: 'Orçamento com desconto acima da alçada livre exige permissão de aprovar' } },
    }, { entityLabel: 'Orçamento' }),
    /alçada.*aprovar/i,
  );
  assert.match(
    formatComercialHttpError({
      status: 403,
      body: { error: { code: 'DESCONTO_ALCADA_DENIED', message: 'Pedido com desconto acima da alçada livre exige outro aprovador' } },
    }, { entityLabel: 'Pedido' }),
    /outro aprovador/i,
  );
  assert.match(
    formatDescontoAlcadaHttpError({
      status: 403,
      body: { error: { code: 'DESCONTO_ALCADA_DENIED', message: 'exige outro aprovador' } },
    }, 'Pedido'),
    /outro aprovador/i,
  );
});

test('painéis Orçamento/Pedido exibem alçada fail-closed e trava de save', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(orc, /evaluateDescontoAlcadaUi/);
  assert.match(orc, /beginSaveOnce/);
  assert.match(orc, /orcamento-desconto-alcada-alert/);
  assert.match(orc, /!descontoAlcada\.canSave/);
  assert.match(ped, /evaluateDescontoAlcadaUi/);
  assert.match(ped, /beginSaveOnce/);
  assert.match(ped, /pedido-desconto-alcada-alert/);
  assert.match(ped, /!descontoAlcada\.canSave/);
});
