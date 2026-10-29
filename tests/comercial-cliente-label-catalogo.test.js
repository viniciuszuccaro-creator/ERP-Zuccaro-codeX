import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  mergeComercialSelectedCliente,
  resolveComercialSelectedCliente,
  resolveComercialSelectedClienteLinks,
  unionComercialClienteCatalog,
} from '../src/components/comercial/comercialMasterPicker.js';

const SCOPE = { groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresaId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
const LINK_ID = '88888888-aaaa-4aaa-8aaa-888888888888';
const CLIENTE_ID = '77777777-aaaa-4aaa-8aaa-777777777777';

function makeClientePage() {
  return {
    data: [{
      id: CLIENTE_ID,
      group_id: SCOPE.groupId,
      ativo: true,
      razao_social: 'Cliente Sintetico',
      codigo: '0001',
      empresa_operacao: {
        id: LINK_ID,
        cliente_id: CLIENTE_ID,
        group_id: SCOPE.groupId,
        empresa_id: SCOPE.empresaId,
        ativo: true,
        situacao_comercial: 'ATIVO',
        habilitado_operacao: true,
        bloqueado: false,
        elegivel_operacao: true,
        codigo: '0001',
      },
    }],
    meta: { total: 1, limit: 1, offset: 0, hasMore: false },
  };
}

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

test('resolveComercialSelectedClienteLinks: lookup leve só com página /clientes', () => {
  const resolved = resolveComercialSelectedClienteLinks(makeClientePage(), SCOPE, LINK_ID);
  assert.equal(resolved.clientes.length, 1);
  assert.equal(resolved.clientesEmpresa[0].id, LINK_ID);
  assert.throws(
    () => resolveComercialSelectedClienteLinks({ data: [], meta: { total: 0, limit: 1, offset: 0, hasMore: false } }, SCOPE, LINK_ID),
    /COMERCIAL_SELECTED_CLIENTE_UNAVAILABLE/,
  );
});

test('resolveComercialSelectedCliente: aceita payload leve {clientes} sem mestres extras', () => {
  const resolved = resolveComercialSelectedCliente({ clientes: makeClientePage() }, SCOPE, LINK_ID);
  assert.equal(resolved.clientesEmpresa[0].id, LINK_ID);
});

test('OrcamentosTab: hidratação leve + catálogo acumulado (sem N×5 masters)', () => {
  const src = fs.readFileSync('src/components/comercial/OrcamentosTab.jsx', 'utf8');
  assert.match(src, /unionComercialClienteCatalog/);
  assert.match(src, /resolveClienteEmpresa/);
  assert.match(src, /orcamento-selected-cliente/);
  assert.match(src, /orcamento-row-cliente/);
  assert.match(src, /rowHydrationKey/);
  assert.match(src, /clienteCatalog/);
  assert.doesNotMatch(src, /comercialMasters\.list\(\{\s*clienteEmpresaId/);
  assert.match(src, /filterClienteEmpresaOptions\([^)]*form\.cliente_empresa_id/);
});

test('PedidoCanonicoPanel: lookup leve + fila de hidratação avança via catálogo', () => {
  const src = fs.readFileSync('src/components/comercial/PedidoCanonicoPanel.jsx', 'utf8');
  assert.match(src, /unionComercialClienteCatalog/);
  assert.match(src, /resolveClienteEmpresa/);
  assert.match(src, /pedido-row-cliente/);
  assert.match(src, /rowHydrationKey/);
  assert.match(src, /clienteCatalog/);
  assert.doesNotMatch(src, /comercialMasters\.list\(\{\s*clienteEmpresaId/);
});
