import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isRateioMultiempresaScopeCurrent,
  resolveRateioMultiempresaGroupId,
  resolveRateioTituloEntity,
  buildRateioFinanceiroCreatePayload,
  buildRateioTituloCreatePayload,
  buildRateioDistribuicaoRealizada,
} from '../src/components/financeiro/rateioMultiempresaScope.js';

test('RateioMultiempresa usa createInContext/updateInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/financeiro/RateioMultiempresa.jsx', 'utf8');
  assert.match(src, /createInContext\(\s*'RateioFinanceiro'/);
  assert.match(src, /updateInContext\(\s*'RateioFinanceiro'/);
  assert.match(src, /RATEIO_MULTIEMPRESA_STALE_SCOPE/);
  assert.doesNotMatch(src, /entities\.RateioFinanceiro\.(create|update)\(/);
  assert.doesNotMatch(src, /entities\.ContaPagar\.create\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.create\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('resolveRateioMultiempresaGroupId fail-closed e mismatch', () => {
  assert.equal(resolveRateioMultiempresaGroupId({
    groupId: null, propGrupoId: null,
  }).ok, false);
  assert.equal(resolveRateioMultiempresaGroupId({
    groupId: 'g1', propGrupoId: 'g2',
  }).reason, 'GROUP_MISMATCH');
  assert.deepEqual(resolveRateioMultiempresaGroupId({
    groupId: 'g1', propGrupoId: 'g1',
  }), { ok: true, reason: null, groupId: 'g1' });
});

test('payloads preservam groupId e entidade do título', () => {
  assert.equal(resolveRateioTituloEntity('ContaPagar'), 'ContaPagar');
  assert.equal(resolveRateioTituloEntity('ContaReceber'), 'ContaReceber');
  const dados = {
    tipo_documento: 'ContaPagar',
    descricao: 'Aluguel',
    valor_total: 100,
    criterio_rateio: 'percentual',
    distribuicao: [{ empresa_id: 'e1', empresa_nome: 'A', percentual: 100, valor: 100, observacao: '' }],
    categoria: 'Aluguel',
    data_vencimento: '2026-02-01',
  };
  const rateio = buildRateioFinanceiroCreatePayload({ groupId: 'g1', dados });
  assert.equal(rateio.group_id, 'g1');
  const titulo = buildRateioTituloCreatePayload({
    groupId: 'g1', dados, dist: dados.distribuicao[0], rateioId: 'r1',
  });
  assert.equal(titulo.empresa_id, 'e1');
  assert.equal(titulo.rateio_id, 'r1');
  assert.equal(titulo.fornecedor, 'Aluguel');
});

test('distribuicao_realizada preserva índice legado', () => {
  const out = buildRateioDistribuicaoRealizada(
    [{ id: 't1', valor: 50, percentual_rateio: 50, status: 'Pendente' }],
    [{ empresa_id: 'e1', empresa_nome: 'A' }],
  );
  assert.deepEqual(out, [{
    empresa_id: 'e1', empresa_nome: 'A', titulo_id: 't1',
    valor: 50, percentual: 50, status: 'Pendente',
  }]);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isRateioMultiempresaScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isRateioMultiempresaScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
