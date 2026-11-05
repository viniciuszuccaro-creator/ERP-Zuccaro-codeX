import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildValidacaoCreditoClienteQueryKey,
  buildValidacaoCreditoPedidosQueryKey,
  isValidacaoCreditoScopeCurrent,
  resolveValidacaoCreditoKpiState,
  filtrarPedidosComprometemCredito,
} from '../src/components/financeiro/validacaoCreditoScope.js';

test('ValidacaoCredito usa getInContext/filterInContext sem Cliente.filter/Pedido.filter unscoped', () => {
  const src = readFileSync('src/components/financeiro/ValidacaoCredito.jsx', 'utf8');
  assert.match(src, /getInContext\(\s*'Cliente'/);
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /VALIDACAO_CREDITO_CLIENTE_STALE_SCOPE/);
  assert.match(src, /VALIDACAO_CREDITO_PEDIDOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ limite zerado/);
  assert.doesNotMatch(src, /entities\.Cliente\.filter\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.filter\(/);
  assert.doesNotMatch(src, /data:\s*pedidosPendentes\s*=\s*\[\]/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('queryKey separa Grupo, Empresa, ator, sessão e cliente', () => {
  const base = { groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1', clienteId: 'c9' };
  assert.deepEqual(
    buildValidacaoCreditoClienteQueryKey(base),
    ['cliente-credito', 'g1', 'e1', 'a1', 's1', 'c9'],
  );
  assert.deepEqual(
    buildValidacaoCreditoPedidosQueryKey({ ...base, pedidoId: 'p1' }),
    ['pedidos-pendentes-cliente', 'g1', 'e1', 'a1', 's1', 'c9', 'p1'],
  );
});

test('KPI loading/erro nunca é ready (≠ crédito zerado)', () => {
  assert.equal(resolveValidacaoCreditoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveValidacaoCreditoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveValidacaoCreditoKpiState({
    contextoValido: true, clienteId: 'c1', isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('filtrarPedidosComprometemCredito preserva status e exclui pedido atual', () => {
  const rows = [
    { id: 'p1', status: 'Aprovado', valor_total: 10 },
    { id: 'p2', status: 'Rascunho', valor_total: 99 },
    { id: 'p3', status: 'Faturado', valor_total: 5 },
  ];
  const out = filtrarPedidosComprometemCredito(rows, 'p1');
  assert.deepEqual(out.map((p) => p.id), ['p3']);
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isValidacaoCreditoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isValidacaoCreditoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
