import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DashboardFechamentoPedidos usa filterInContext sem list unscoped', () => {
  const src = readFileSync('src/components/comercial/DashboardFechamentoPedidos.jsx', 'utf8');
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
