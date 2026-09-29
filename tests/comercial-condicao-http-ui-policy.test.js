import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyResolvedCondicaoToForm,
  assertCondicaoResolucaoNoContexto,
  buildCondicaoSnapshotPreview,
  canLoadCondicoesPagamentoHttp,
  normalizeCondicoesListPayload,
} from '../src/components/comercial/comercialCondicaoHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONDICAO = '11111111-1111-4111-8111-111111111111';

test('canLoadCondicoesPagamentoHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadCondicoesPagamentoHttp(undefined), false);
  assert.equal(canLoadCondicoesPagamentoHttp(() => false), false);
});

test('canLoadCondicoesPagamentoHttp libera Cadastros ou Comercial visualizar', () => {
  assert.equal(
    canLoadCondicoesPagamentoHttp((module, section, action) => (
      module === 'Cadastros' && section === 'condicao_pagamento' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadCondicoesPagamentoHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    true,
  );
});

test('normalizeCondicoesListPayload aceita envelope e array e filtra inativos', () => {
  assert.deepEqual(
    normalizeCondicoesListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeCondicoesListPayload([{ id: 'c', ativo: true }]).map((row) => row.id),
    ['c'],
  );
  assert.deepEqual(normalizeCondicoesListPayload(null), []);
});

test('applyResolvedCondicaoToForm grava só condicao_pagamento_id e snapshot em memória', () => {
  const form = { cliente_empresa_id: 'x', condicao_pagamento_id: '', observacoes: 'ok' };
  const applied = applyResolvedCondicaoToForm(form, {
    fonte: 'cliente_empresa',
    condicao: {
      id: CONDICAO,
      codigo: '000010',
      nome: '28 dias',
      parcelas: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    },
    snapshot: {
      id: CONDICAO,
      codigo: '000010',
      nome: '28 dias',
      parcelas: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    },
  });
  assert.equal(applied.applied, true);
  assert.equal(applied.form.condicao_pagamento_id, CONDICAO);
  assert.equal(applied.form.observacoes, 'ok');
  assert.equal('parcelas' in applied.form, false);
  assert.equal(applied.snapshot.fonte, 'cliente_empresa');
  assert.equal(applied.snapshot.parcelas.length, 1);
});

test('applyResolvedCondicaoToForm não aplica fonte nenhuma', () => {
  const applied = applyResolvedCondicaoToForm(
    { condicao_pagamento_id: 'keep' },
    { fonte: 'nenhuma', condicao: null, snapshot: null },
  );
  assert.equal(applied.applied, false);
  assert.equal(applied.form.condicao_pagamento_id, 'keep');
  assert.equal(applied.snapshot, null);
});

test('assertCondicaoResolucaoNoContexto bloqueia cross-group', () => {
  assert.throws(
    () => assertCondicaoResolucaoNoContexto(
      { fonte: 'empresa_padrao', condicao: { id: CONDICAO, group_id: 'other-group' } },
      { groupId: GROUP, empresaId: EMPRESA },
    ),
    /fora do grupo/,
  );
  const ok = assertCondicaoResolucaoNoContexto(
    { fonte: 'empresa_padrao', condicao: { id: CONDICAO, group_id: GROUP, empresa_id: EMPRESA } },
    { groupId: GROUP, empresaId: EMPRESA },
  );
  assert.equal(ok.fonte, 'empresa_padrao');
});

test('buildCondicaoSnapshotPreview normaliza parcelas sem inventar campos de persistência', () => {
  const preview = buildCondicaoSnapshotPreview({
    id: CONDICAO,
    nome: 'À vista',
    fonte: 'empresa_padrao',
    parcelas: [{ ordem: 1, dias: 0, percentual: 100 }],
  });
  assert.deepEqual(preview, {
    id: CONDICAO,
    codigo: null,
    nome: 'À vista',
    fonte: 'empresa_padrao',
    parcelas: [{ ordem: 1, dias: 0, percentual: '100' }],
  });
});
