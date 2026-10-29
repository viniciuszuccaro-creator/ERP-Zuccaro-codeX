import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('OrcamentosTab: hidrata cliente selecionado/listagem fora da página de busca', () => {
  const src = fs.readFileSync('src/components/comercial/OrcamentosTab.jsx', 'utf8');
  assert.match(src, /unionComercialClienteCatalog/);
  assert.match(src, /resolveComercialSelectedCliente/);
  assert.match(src, /orcamento-selected-cliente/);
  assert.match(src, /orcamento-row-cliente/);
  assert.match(src, /clienteCatalog/);
  assert.match(src, /filterClienteEmpresaOptions\([^)]*form\.cliente_empresa_id/);
});

test('PedidoCanonicoPanel: labels de listagem independentes da página de busca', () => {
  const src = fs.readFileSync('src/components/comercial/PedidoCanonicoPanel.jsx', 'utf8');
  assert.match(src, /unionComercialClienteCatalog/);
  assert.match(src, /pedido-row-cliente/);
  assert.match(src, /clienteCatalog/);
});
