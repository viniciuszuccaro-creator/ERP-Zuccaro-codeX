import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  clienteHydrationSettlementKey,
  collectSettledClienteHydration,
  mergeComercialSelectedCliente,
  nextClienteHydrationBatch,
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

test('nextClienteHydrationBatch: 20 falhas não prendem a 21ª identidade', () => {
  const needed = Array.from({ length: 25 }, (_, i) => `id-${String(i + 1).padStart(2, '0')}`);
  const attempted = needed.slice(0, 20);
  const batch = nextClienteHydrationBatch(needed, {
    knownLinkIds: [],
    attemptedIds: attempted,
    limit: 20,
  });
  assert.deepEqual(batch, ['id-21', 'id-22', 'id-23', 'id-24', 'id-25']);
});

test('collectSettledClienteHydration + settlementKey: 404 conta como tentativa', () => {
  const queries = [
    { queryKey: ['orcamento-row-cliente', 'g', 'e', 'a', 's', 'id-01'], isSuccess: false, isError: true, error: { status: 404 } },
    { queryKey: ['orcamento-row-cliente', 'g', 'e', 'a', 's', 'id-02'], isSuccess: true, isError: false, data: { clientes: [{ id: 'c2' }], clientesEmpresa: [{ id: 'id-02', cliente_id: 'c2' }] } },
    { queryKey: ['orcamento-row-cliente', 'g', 'e', 'a', 's', 'id-03'], isSuccess: false, isError: false },
  ];
  const settled = collectSettledClienteHydration(queries);
  assert.deepEqual(settled.attemptedIds, ['id-01', 'id-02']);
  assert.equal(settled.successPayloads.length, 1);
  assert.equal(settled.failures['id-01'], 'HTTP 404');
  const key = clienteHydrationSettlementKey(queries);
  assert.match(key, /err:id-01/);
  assert.match(key, /ok:id-02/);
  assert.doesNotMatch(key, /id-03/);
});

test('OrcamentosTab: hidratação leve + catálogo acumulado (sem N×5 masters)', () => {
  const src = fs.readFileSync('src/components/comercial/OrcamentosTab.jsx', 'utf8');
  assert.match(src, /unionComercialClienteCatalog/);
  assert.match(src, /resolveClienteEmpresa/);
  assert.match(src, /orcamento-selected-cliente/);
  assert.match(src, /orcamento-row-cliente/);
  assert.match(src, /rowHydrationKey/);
  assert.match(src, /clienteCatalog/);
  assert.match(src, /nextClienteHydrationBatch/);
  assert.match(src, /clienteHydrationAttemptedIds/);
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
  assert.match(src, /nextClienteHydrationBatch/);
  assert.match(src, /clienteHydrationAttemptedIds/);
  assert.doesNotMatch(src, /comercialMasters\.list\(\{\s*clienteEmpresaId/);
});
