import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/comercial/DashboardFechamentoPedidos.jsx', 'utf8');

test('DashboardFechamentoPedidos usa filterInContext sem list unscoped', () => {
  assert.match(src, /filterInContext\(entity/);
  assert.match(src, /fetchScoped\('Pedido'/);
  assert.match(src, /fetchScoped\('MovimentacaoEstoque'/);
  assert.match(src, /fetchScoped\('ContaReceber'/);
  assert.match(src, /fetchScoped\('Entrega'/);
  assert.doesNotMatch(src, /entities\.\w+\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
  assert.match(src, /buildFechamentoQueryKey/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
});

test('#545: KPI agregado com resolveFechamentoDashboardKpiState', () => {
  assert.match(src, /resolveFechamentoDashboardKpiState/);
  assert.match(src, /movIsLoading/);
  assert.match(src, /contasIsLoading/);
  assert.match(src, /entregasIsLoading/);
  assert.match(src, /kpiState === 'ready' && Array\.isArray\(movimentacoes\)/);
});

test('#545: namespaces raiz compatíveis com invalidateQueries', () => {
  assert.match(src, /buildFechamentoQueryKey\('pedidos'/);
  assert.match(src, /buildFechamentoQueryKey\('movimentacoes'/);
  assert.match(src, /buildFechamentoQueryKey\('contas-receber'/);
  assert.match(src, /buildFechamentoQueryKey\('entregas'/);
  assert.doesNotMatch(src, /pedidos-fechamento/);
});

test('#545: estatísticas IA com cancel/binding e limpeza na troca', () => {
  assert.match(src, /setEstatisticasIA\(null\)/);
  assert.match(src, /cancelled = true/);
  assert.match(src, /isFechamentoScopeCurrent\(generation, live\)/);
  assert.match(src, /scopeLiveRef/);
  assert.match(src, /actorId, sessionKey/);
});
