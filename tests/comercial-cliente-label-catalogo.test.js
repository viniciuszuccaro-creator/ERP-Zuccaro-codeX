import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  mergeComercialSelectedCliente,
  unionComercialClienteCatalog,
} from '../src/components/comercial/comercialMasterPicker.js';

test('mergeComercialSelectedCliente: seleção vazia não empurra undefined no catálogo', () => {
  const base = {
    clientes: [{ id: 'c1', razao_social: 'A' }],
    clientesEmpresa: [{ id: 'ce1', cliente_id: 'c1' }],
  };
  const empty = { clientes: [], clientesEmpresa: [] };
  const merged = mergeComercialSelectedCliente(base, empty);
  assert.deepEqual(merged.clientes, base.clientes);
  assert.deepEqual(merged.clientesEmpresa, base.clientesEmpresa);
  assert.ok(merged.clientes.every((row) => row?.id));
});

test('unionComercialClienteCatalog: preserva base e ignora patch sem id', () => {
  const base = { clientes: [{ id: 'c1' }], clientesEmpresa: [{ id: 'ce1', cliente_id: 'c1' }] };
  const out = unionComercialClienteCatalog(base, {
    clientes: [undefined, { id: 'c2' }],
    clientesEmpresa: [{ nome: 'sem-id' }, { id: 'ce2', cliente_id: 'c2' }],
  });
  assert.equal(out.clientes.length, 2);
  assert.equal(out.clientesEmpresa.length, 2);
  assert.ok(out.clientes.every((row) => row?.id));
});

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
