import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/comercial/WidgetFechamentoPedidos.jsx', 'utf8');

test('WidgetFechamentoPedidos lista Pedido via filterInContext', () => {
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.doesNotMatch(src, /entities\.Pedido\.list\(/);
  assert.match(src, /enabled: contextoValido/);
  assert.match(src, /erro de carga ≠ zero/);
});

test('#545: widget não exibe 0 em KPI pendente e cancela stats stale', () => {
  assert.match(src, /kpiLabel\(contagemIndisponivel \? null : pedidosComAutomacao\.length\)/);
  assert.match(src, /kpiLabel\(contagemIndisponivel \? null : pedidosProntosFechar\.length\)/);
  assert.match(src, /kpiState === 'ready' && Array\.isArray\(pedidos\)/);
  assert.match(src, /cancelled = true/);
  assert.match(src, /scopeLiveRef/);
  assert.match(src, /buildFechamentoQueryKey\('pedidos'/);
  assert.doesNotMatch(src, /pedidos-widget-fechamento/);
});
