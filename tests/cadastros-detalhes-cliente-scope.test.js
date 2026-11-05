import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDetalhesCadastroQueryKey,
  isDetalhesCadastroScopeCurrent,
  resolveDetalhesCadastroKpiState,
  sumDetalhesCadastroTotalVendas,
  sumDetalhesCadastroTotalReceber,
  countDetalhesCadastroContasAtrasadas,
} from '../src/components/cadastros/detalhesCadastroScope.js';

test('DetalhesCadastro usa filterInContext sem entities.*.filter unscoped', () => {
  const src = readFileSync('src/components/cadastros/DetalhesCadastro.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /filterInContext\(\s*'ContaReceber'/);
  assert.match(src, /filterInContext\(\s*'Entrega'/);
  assert.match(src, /filterInContext\(\s*'NotaFiscal'/);
  assert.match(src, /DETALHES_CADASTRO_PEDIDOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ ausência de registros/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.filter\(/);
  assert.doesNotMatch(src, /entities\.Entrega\.filter\(/);
  assert.doesNotMatch(src, /entities\.NotaFiscal\.filter\(/);
  assert.doesNotMatch(src, /data:\s*pedidos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator, sessão e cliente', () => {
  assert.deepEqual(
    buildDetalhesCadastroQueryKey('pedidos-cliente', {
      groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1', clienteId: 'c9',
    }),
    ['pedidos-cliente', 'g1', 'e1', 'a1', 's1', 'c9'],
  );
});

test('KPI loading/erro nunca é ready (≠ zero registros)', () => {
  assert.equal(resolveDetalhesCadastroKpiState({
    isClienteTipo: true, contextoValido: true, clienteId: 'c1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveDetalhesCadastroKpiState({
    isClienteTipo: true, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveDetalhesCadastroKpiState({
    isClienteTipo: false, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'idle');
  assert.equal(resolveDetalhesCadastroKpiState({
    isClienteTipo: true, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('agregações financeiras só sobre listas válidas', () => {
  assert.equal(sumDetalhesCadastroTotalVendas([{ valor_total: 10 }, { valor_total: 5 }]), 15);
  assert.equal(sumDetalhesCadastroTotalReceber([
    { status: 'Pendente', valor: 7 },
    { status: 'Pago', valor: 99 },
  ]), 7);
  assert.equal(countDetalhesCadastroContasAtrasadas([
    { status: 'Pendente', data_vencimento: '2000-01-01' },
    { status: 'Pendente', data_vencimento: '2999-01-01' },
  ], new Date('2020-01-01')), 1);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isDetalhesCadastroScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isDetalhesCadastroScopeCurrent(expected, { actorId: 'a1', sessionKey: 's2' }), false);
});
