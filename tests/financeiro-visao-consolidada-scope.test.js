import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveVisaoConsolidadaKpiState,
  isVisaoConsolidadaScopeCurrent,
  assertVisaoConsolidadaGroupMatch,
  sumVisaoConsolidadaPendente,
  sumVisaoConsolidadaAtrasado,
  buildVisaoConsolidadaPorEmpresa,
} from '../src/components/financeiro/visaoConsolidadaGrupoScope.js';

test('VisaoConsolidadaGrupo usa filterInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/financeiro/VisaoConsolidadaGrupo.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Empresa'/);
  assert.match(src, /filterInContext\(\s*'ContaPagar'/);
  assert.match(src, /filterInContext\(\s*'ContaReceber'/);
  assert.match(src, /VISAO_CONSOLIDADA_PAGAR_STALE_SCOPE/);
  assert.match(src, /Erro ≠ R\$ 0,00/);
  assert.doesNotMatch(src, /entities\.Empresa\.filter\(/);
  assert.doesNotMatch(src, /entities\.ContaPagar\.filter\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.filter\(/);
  assert.doesNotMatch(src, /data:\s*empresas\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI e mismatch de grupo', () => {
  assert.equal(resolveVisaoConsolidadaKpiState({
    contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveVisaoConsolidadaKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveVisaoConsolidadaKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(assertVisaoConsolidadaGroupMatch('g1', 'g1'), 'g1');
  assert.throws(() => assertVisaoConsolidadaGroupMatch('g1', 'g2'), /VISAO_CONSOLIDADA_GROUP_MISMATCH/);
  assert.equal(isVisaoConsolidadaScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isVisaoConsolidadaScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});

test('agregações por status e empresa', () => {
  const pagar = [
    { empresa_id: 'e1', status: 'Pendente', valor: 10 },
    { empresa_id: 'e1', status: 'Atrasado', valor: 3 },
    { empresa_id: 'e2', status: 'Pendente', valor: 7 },
  ];
  const receber = [
    { empresa_id: 'e1', status: 'Pendente', valor: 20 },
    { empresa_id: 'e2', status: 'Pendente', valor: 4 },
  ];
  assert.equal(sumVisaoConsolidadaPendente(pagar), 17);
  assert.equal(sumVisaoConsolidadaAtrasado(pagar), 3);
  const porEmp = buildVisaoConsolidadaPorEmpresa(
    [{ id: 'e1', nome_fantasia: 'A' }, { id: 'e2', razao_social: 'B' }],
    pagar,
    receber,
  );
  assert.equal(porEmp[0].receber, 20);
  assert.equal(porEmp[0].pagar, 10);
  assert.equal(porEmp[0].saldo, 10);
  assert.equal(porEmp[1].saldo, -3);
});
