import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolvePainelDinamicoKpiState,
  isPainelDinamicoScopeCurrent,
  sumPainelDinamicoTotalVendas,
  sumPainelDinamicoTotalEmAberto,
} from '../src/components/cadastros/painelDinamicoClienteScope.js';

test('PainelDinamicoCliente usa getInContext/filterInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/cadastros/PainelDinamicoCliente.jsx', 'utf8');
  assert.match(src, /getInContext\(\s*"Cliente"/);
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /filterInContext\(\s*'Entrega'/);
  assert.match(src, /filterInContext\(\s*'ContaReceber'/);
  assert.match(src, /PAINEL_DINAMICO_PEDIDOS_STALE_SCOPE/);
  assert.match(src, /Erro ≠ zero em aberto/);
  assert.doesNotMatch(src, /entities\.Cliente\.get\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /entities\.Entrega\.filter\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.filter\(/);
  assert.doesNotMatch(src, /data:\s*pedidos\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('KPI loading/erro nunca é ready (≠ zero)', () => {
  assert.equal(resolvePainelDinamicoKpiState({
    painelAberto: true, contextoValido: true, clienteId: 'c1',
    isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolvePainelDinamicoKpiState({
    painelAberto: true, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolvePainelDinamicoKpiState({
    painelAberto: false, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'idle');
  assert.equal(resolvePainelDinamicoKpiState({
    painelAberto: true, contextoValido: true, clienteId: 'c1',
    isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('agregações e stale scope', () => {
  assert.equal(sumPainelDinamicoTotalVendas([
    { status: 'Aprovado', valor_total: 10 },
    { status: 'Cancelado', valor_total: 99 },
  ]), 10);
  assert.equal(sumPainelDinamicoTotalEmAberto([
    { status: 'Pendente', valor: 5 },
    { status: 'Pago', valor: 9 },
  ]), 5);
  assert.equal(isPainelDinamicoScopeCurrent(
    { actorId: 'a1', sessionKey: 's1' },
    { actorId: 'a1', sessionKey: 's1' },
  ), true);
  assert.equal(isPainelDinamicoScopeCurrent(
    { actorId: 'a1', sessionKey: 's1' },
    { actorId: 'a2', sessionKey: 's1' },
  ), false);
});
