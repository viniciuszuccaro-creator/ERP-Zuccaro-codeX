import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelConciliacaoKpiState,
  isPainelConciliacaoScopeCurrent,
  assertPainelConciliacaoEmpresaMatch,
  buildPainelConciliacaoTituloUpdate,
  buildPainelConciliacaoExtratoUpdate,
} from '../src/components/financeiro/painelConciliacaoScope.js';

test('PainelConciliacao usa filter/update InContext sem entities unscoped', () => {
  const src = readFileSync('src/components/financeiro/PainelConciliacao.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'ExtratoBancario'/);
  assert.match(src, /filterInContext\(\s*'ContaReceber'/);
  assert.match(src, /filterInContext\(\s*'ContaPagar'/);
  assert.match(src, /updateInContext\(\s*'ExtratoBancario'/);
  assert.match(src, /PAINEL_CONCILIACAO_MUTATE_STALE_SCOPE/);
  assert.match(src, /Erro ≠ 0 pendentes/);
  assert.doesNotMatch(src, /entities\.ExtratoBancario\.(filter|update)\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.filter\(/);
  assert.doesNotMatch(src, /entities\.ContaPagar\.filter\(/);
  assert.doesNotMatch(src, /data:\s*extratos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI, mismatch e payloads de conciliação', () => {
  assert.equal(resolvePainelConciliacaoKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolvePainelConciliacaoKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(assertPainelConciliacaoEmpresaMatch('e1', 'e1'), 'e1');
  assert.throws(() => assertPainelConciliacaoEmpresaMatch('e1', 'e2'), /PAINEL_CONCILIACAO_EMPRESA_MISMATCH/);
  assert.throws(() => assertPainelConciliacaoEmpresaMatch(null, null), /PAINEL_CONCILIACAO_SCOPE_BLOCKED/);
  assert.equal(isPainelConciliacaoScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  const receber = buildPainelConciliacaoTituloUpdate('receber', { data_movimento: '2026-01-01', valor: 10 });
  assert.equal(receber.status, 'Recebido');
  assert.equal(receber.valor_recebido, 10);
  const extrato = buildPainelConciliacaoExtratoUpdate('pagar', 't1');
  assert.equal(extrato.conciliado, true);
  assert.equal(extrato.conciliado_com_tipo, 'ContaPagar');
  assert.equal(extrato.conciliado_com_id, 't1');
});
