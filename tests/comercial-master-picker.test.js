import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clienteEmpresaPickerLabel,
  filterClienteEmpresaOptions,
  filterProdutoOptions,
  formatMasterCodigoLabel,
  ORCAMENTO_PERSISTENCE_GAPS,
  produtoPickerLabel,
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
