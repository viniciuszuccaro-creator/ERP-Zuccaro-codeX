import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildOrcamentoPayload,
  calculateItem,
  calculateTotals,
  canUseOrcamentoAction,
  microsToDecimal,
} from '../src/components/comercial/orcamentoUiPolicy.js';

const form = () => ({
  cliente_empresa_id: 'cliente-empresa-1',
  condicao_pagamento_id: 'condicao-1',
  validade_em: '2026-10-01',
  observacoes: '  proposta sintética  ',
  groupId: 'nao-enviar', empresaId: 'nao-enviar', total: '999', status: 'CANCELADO', numero: 99,
  itens: [{
    produto_id: 'produto-1', unidade_id: 'unidade-1', descricao: 'Produto sintético',
    unidade_sigla: 'UN', quantidade: '2.500000', preco_unitario: '10.200000', desconto: '0.500000',
  }],
});

test('calculo de orcamento usa inteiros decimais e nao float', () => {
  assert.deepEqual(calculateItem(form().itens[0]), { subtotal: '25.500000', total: '25.000000' });
  const totals = calculateTotals(form().itens);
  assert.equal(microsToDecimal(totals.subtotal), '25.500000');
  assert.equal(microsToDecimal(totals.desconto), '0.500000');
  assert.equal(microsToDecimal(totals.total), '25.000000');
});

test('payload permite somente campos comerciais e ignora tenant, status, numero e totais', () => {
  const payload = buildOrcamentoPayload(form());
  assert.equal(payload.observacoes, 'proposta sintética');
  assert.deepEqual(Object.keys(payload).sort(), ['cliente_empresa_id', 'condicao_pagamento_id', 'itens', 'observacoes', 'validade_em']);
  assert.equal(payload.itens[0].quantidade, '2.500000');
  assert.equal('groupId' in payload, false);
  assert.equal('total' in payload, false);
});

test('politica visual exige permissao exata e estado editavel', () => {
  const allow = (module, section, action) => module === 'Comercial' && section === 'orcamento' && action !== 'cancelar';
  assert.equal(canUseOrcamentoAction(allow, 'visualizar'), true);
  assert.equal(canUseOrcamentoAction(allow, 'editar', 'EM_ABERTO'), true);
  assert.equal(canUseOrcamentoAction(allow, 'editar', 'CANCELADO'), false);
  assert.equal(canUseOrcamentoAction(allow, 'cancelar', 'EM_ABERTO'), false);
});

test('Comercial integra orcamentos sem persistencia Base44 paralela', async () => {
  const page = await readFile(new URL('../src/pages/Comercial.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  assert.match(page, /sectionKey: 'orcamento'[\s\S]*exactPermission: true/);
  assert.match(tab, /createHttpApiClient[\s\S]*\.orcamentos/);
  assert.match(tab, /\['orcamentos-http', groupId, empresaId/);
  assert.doesNotMatch(tab, /base44\.entities\.Orcamento/);
  assert.match(meta, /orcamento:\s*\{[\s\S]*frontendHttp: true/);
});

test('payload invalido e bloqueado antes da chamada HTTP', () => {
  assert.throws(() => buildOrcamentoPayload({ ...form(), cliente_empresa_id: '' }), /cliente/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [] }), /item/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [{ ...form().itens[0], quantidade: '0' }] }), /quantidade/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [{ ...form().itens[0], desconto: '99' }] }), /desconto/i);
});

test('tela contempla estados, detalhe, edicao, confirmacao e invalidacao por empresa', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /Carregando orçamentos/);
  assert.match(tab, /Nenhum orçamento encontrado para os filtros desta empresa/);
  assert.match(tab, /Pesquisar número/);
  assert.match(tab, /clienteEmpresaId/);
  assert.match(tab, /validadeDe/);
  assert.match(tab, /validadeAte/);
  assert.match(tab, /Tentar novamente/);
  assert.match(tab, /showDetail/);
  assert.match(tab, /openEdit/);
  assert.match(tab, /Cancelar orçamento\?/);
  assert.match(tab, /beforeunload/);
  assert.match(tab, /\[groupId, empresaId\]/);
  assert.match(tab, /invalidateQueries\(\{ queryKey: \['orcamentos-http', groupId, empresaId\]/);
});
