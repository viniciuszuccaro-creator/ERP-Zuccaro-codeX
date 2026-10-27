import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clienteEmpresaPickerLabel,
  filterClienteEmpresaOptions,
  filterProdutoOptions,
  formatMasterCodigoLabel,
  ORCAMENTO_PERSISTENCE_GAPS,
  produtoPickerLabel,
  resolveComercialAuxiliaryView,
} from '../src/components/comercial/comercialMasterPicker.js';

test('label de mestre expoe codigo e nome sem perder identidade', () => {
  assert.equal(formatMasterCodigoLabel('000012', 'Cliente Alfa'), '000012 — Cliente Alfa');
  assert.equal(produtoPickerLabel({ codigo: 'P-9', descricao: 'Vergalhao' }), 'P-9 — Vergalhao');
  assert.equal(
    clienteEmpresaPickerLabel({ codigo: 'CE-1', cliente_id: 'c1' }, { razao_social: 'CPA' }),
    'CE-1 — CPA',
  );
});

test('filtro de cliente e produto busca por codigo e nome normalizado', () => {
  const clients = new Map([['c1', { id: 'c1', codigo: '100', razao_social: 'Metalurgica Zeta' }]]);
  const links = [
    { id: 'l1', cliente_id: 'c1', codigo: 'CE-100', ativo: true, habilitado_operacao: true },
    { id: 'l2', cliente_id: 'c1', codigo: 'CE-200', ativo: true, habilitado_operacao: true, bloqueado: true },
  ];
  assert.equal(filterClienteEmpresaOptions(links, clients, 'ce-100').length, 1);
  assert.equal(filterClienteEmpresaOptions(links, clients, 'zeta').length, 1);
  assert.equal(filterClienteEmpresaOptions(links, clients, '200').length, 0);

  const produtos = [
    { id: 'p1', codigo: '0007', descricao: 'Chapa grossa', ativo: true },
    { id: 'p2', codigo: '0008', descricao: 'Tubo', ativo: false },
  ];
  assert.equal(filterProdutoOptions(produtos, '0007').length, 1);
  assert.equal(filterProdutoOptions(produtos, 'chapa').length, 1);
  assert.equal(filterProdutoOptions(produtos, 'tubo').length, 0);
});

test('gaps remanescentes do orcamento ficam explicitos (tabela_preco persistida via 039)', () => {
  assert.equal('tabela_preco_id' in ORCAMENTO_PERSISTENCE_GAPS, false);
  assert.match(ORCAMENTO_PERSISTENCE_GAPS.preco_unitario_ui, /servidor/i);
  assert.match(ORCAMENTO_PERSISTENCE_GAPS.unidade_alternativa, /principal/i);
});


function canonicalMasterPagesFixture() {
  const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', empresaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const id = n => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  const page = data => ({ data, meta: { limit: 50, offset: 0, total: data.length, hasMore: false } });
  const client = { id: id(1), group_id: groupId, codigo: '000001', razao_social: 'SYNTHETIC MASTER', ativo: true };
  const link = { id: id(2), group_id: groupId, empresa_id: empresaId, cliente_id: client.id,
    ativo: true, situacao_comercial: 'ATIVO', habilitado_operacao: true, bloqueado: false, elegivel_operacao: true };
  return { scope: { groupId, empresaId }, pages: {
    clientes: page([{ ...client, empresa_operacao: link }]),
    produtos: page([{ id: id(3), group_id: groupId, ativo: true, unidade_medida_id: id(4) }]),
    condicoes: page([{ id: id(5), ativo: true }]), unidades: { data: [{ id: id(4), ativo: true, sigla: 'KG' }] },
    tabelas: page([{ id: id(6), ativo: true }]),
  } };
}
test('canonical masters: preserve proven master/link identities without local reconstruction', async () => {
  const { resolveComercialMasterPages } = await import('../src/components/comercial/comercialMasterPicker.js');
  assert.equal(typeof resolveComercialMasterPages, 'function');
  const { scope, pages } = canonicalMasterPagesFixture(), before = JSON.stringify(pages);
  const result = resolveComercialMasterPages(pages, scope);
  assert.equal(result.clientes[0].id, pages.clientes.data[0].id);
  assert.equal(result.clientesEmpresa[0].id, pages.clientes.data[0].empresa_operacao.id);
  assert.notEqual(result.clientes[0].id, result.clientesEmpresa[0].id);
  assert.equal(clienteEmpresaPickerLabel(result.clientesEmpresa[0], result.clientes[0]), '000001 — SYNTHETIC MASTER');
  assert.equal(JSON.stringify(pages), before);
});
test('canonical masters: cross-company, missing link, ambiguity and incomplete pages blocked', async () => {
  const { resolveComercialMasterPages } = await import('../src/components/comercial/comercialMasterPicker.js');
  for (const mutate of [
    pages => { delete pages.clientes.data[0].empresa_operacao; },
    pages => { pages.clientes.data[0].empresa_operacao.empresa_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'; },
    pages => { pages.clientes.data[0].empresa_operacao.cliente_id = pages.produtos.data[0].id; },
    pages => { pages.clientes.data[0].empresa_operacao.bloqueado = true; },
    pages => { pages.clientes.data.push(pages.clientes.data[0]); },
    pages => { pages.produtos.data[0].group_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; },
    pages => { pages.clientes.meta.total = -1; },
    pages => { pages.condicoes.meta.hasMore = true; },
  ]) {
    const { pages, scope } = canonicalMasterPagesFixture(); mutate(pages);
    assert.throws(() => resolveComercialMasterPages(pages, scope));
  }
});

const auxIds = {
  groupId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  empresaId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  clienteId: '99999999-aaaa-4aaa-8aaa-999999999991',
  linkId: '88888888-aaaa-4aaa-8aaa-888888888888',
};
function auxiliaryFixture() {
  const block = { status: 'ok', data: [], meta: { limit: 200, offset: 0, total: 0, hasMore: false } };
  return {
    identity: { id: auxIds.clienteId },
    empresaLink: { id: auxIds.linkId, cliente_id: auxIds.clienteId, empresa_id: auxIds.empresaId, ativo: true, elegivel_operacao: true },
    meta: { groupId: auxIds.groupId, empresaId: auxIds.empresaId, clienteId: auxIds.clienteId, clienteEmpresaId: auxIds.linkId },
    blocks: { locais: structuredClone(block), obras: structuredClone(block) },
  };
}
const resolveAux = view => resolveComercialAuxiliaryView(view, auxIds, auxIds.clienteId, auxIds.linkId);
test('Pedido usa blocos canonicos escopados de Local/Obra sem fabricar registros', () => {
  const view = auxiliaryFixture();
  view.blocks.locais.data = [{ id: '11111111-aaaa-4aaa-8aaa-111111111111', cliente_id: auxIds.clienteId, ativo: true }];
  view.blocks.locais.meta.total = 1;
  assert.equal(resolveAux(view).locais[0], view.blocks.locais.data[0]);
  assert.deepEqual(resolveAux({ data: view }).obras, []);
});
test('Pedido rejeita identidade Grupo Empresa ou vinculo trocado nos auxiliares', () => {
  for (const mutate of [
    v => { v.meta.groupId = 'outro'; }, v => { v.meta.empresaId = 'outra'; },
    v => { v.identity.id = auxIds.linkId; }, v => { v.empresaLink.id = auxIds.clienteId; },
    v => { v.empresaLink.elegivel_operacao = false; },
  ]) {
    const view = auxiliaryFixture(); mutate(view);
    assert.throws(() => resolveAux(view), /COMERCIAL_AUXILIARY_INVALID/);
  }
});
test('Pedido nao apresenta forbidden unavailable ou skipped como catalogo vazio', () => {
  for (const status of ['forbidden', 'unavailable', 'skipped']) {
    const view = auxiliaryFixture(); view.blocks.obras.status = status;
    assert.throws(() => resolveAux(view), /COMERCIAL_AUXILIARY_UNAVAILABLE/);
  }
});
test('Pedido exige paginacao explicita quando catalogo auxiliar estiver incompleto', () => {
  const view = auxiliaryFixture(); view.blocks.locais.meta.hasMore = true;
  assert.throws(() => resolveAux(view), /COMERCIAL_REFERENCE_PAGINATION_REQUIRED/);
  view.blocks.locais.meta.hasMore = false; view.blocks.locais.meta.total = 1;
  assert.throws(() => resolveAux(view), /COMERCIAL_AUXILIARY_INVALID/);
});
test('Pedido rejeita auxiliares de outro cliente e IDs duplicados', () => {
  const view = auxiliaryFixture();
  view.blocks.obras.data = [{ id: '22222222-aaaa-4aaa-8aaa-222222222222', cliente_id: auxIds.linkId, ativo: true }];
  view.blocks.obras.meta.total = 1;
  assert.throws(() => resolveAux(view), /COMERCIAL_AUXILIARY_INVALID/);
  view.blocks.obras.data[0].cliente_id = auxIds.clienteId;
  view.blocks.obras.data.push({ ...view.blocks.obras.data[0] }); view.blocks.obras.meta.total = 2;
  assert.throws(() => resolveAux(view), /COMERCIAL_AUXILIARY_INVALID/);
});
