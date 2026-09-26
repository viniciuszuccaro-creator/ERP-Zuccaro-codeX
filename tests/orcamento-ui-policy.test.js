import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildOrcamentoPayload,
  buildOrcamentoShareText,
  buildOrcamentoVersionPayload,
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
  assert.equal(canUseOrcamentoAction(allow, 'imprimir'), true);
});

test('impressao exige visualizar ou imprimir e falha fechado sem permissao', () => {
  const deny = () => false;
  const onlyView = (module, section, action) => module === 'Comercial' && section === 'orcamento' && action === 'visualizar';
  const onlyPrint = (module, section, action) => module === 'Comercial' && section === 'orcamento' && action === 'imprimir';
  assert.equal(canUseOrcamentoAction(deny, 'imprimir'), false);
  assert.equal(canUseOrcamentoAction(onlyView, 'imprimir'), true);
  assert.equal(canUseOrcamentoAction(onlyPrint, 'imprimir'), true);
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
test('preparacao de compartilhamento usa somente resumo comercial revisavel', () => {
  const text = buildOrcamentoShareText({
    numero: '00000042',
    status: 'EM_ABERTO',
    versao: 2,
    origem: 'CRM',
    validade_em: '2027-01-31T00:00:00.000Z',
    total: '125.500000',
  }, { empresaNome: 'Empresa Sintetica', clienteNome: 'Cliente Sintetico' });
  assert.match(text, /Orçamento 00000042 \(v2\)/);
  assert.match(text, /Cliente Sintetico/);
  assert.match(text, /Origem: CRM/);
  assert.match(text, /R\$\s*125,50/);
  assert.doesNotMatch(text, /groupId|empresaId|actorId|token/i);
});

test('impressao de orcamento escapa campos livres e nao depende de credencial externa', async () => {
  const source = await readFile(new URL('../src/components/lib/exportacaoPDF.jsx', import.meta.url), 'utf8');
  assert.match(source, /export function gerarPDFOrcamento/);
  assert.match(source, /escapeDocumentText\(item\.descricao\)/);
  assert.match(source, /escapeDocumentText\(orcamento\.observacoes/);
  assert.match(source, /printWindow\.opener = null/);
  assert.match(source, /orcamento\.versao/);
  assert.match(source, /orcamento\.origem/);
  assert.doesNotMatch(source, /api[_-]?key|access[_-]?token|service[_-]?role/i);
});

test('tela audita impressao e compartilhamento com RBAC fail-closed', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/Comercial.jsx', import.meta.url), 'utf8');
  assert.match(tab, /canPrint/);
  assert.match(tab, /auditOrcamento/);
  assert.match(tab, /Impressao bloqueada/);
  assert.match(tab, /Compartilhamento preparado/);
  assert.match(tab, /data-permission="Comercial\.orcamento\.imprimir"/);
  assert.match(tab, /createVersion/);
  assert.match(tab, /listVersions/);
  assert.match(tab, /listAnexos/);
  assert.match(tab, /ORCAMENTO_ORIGEM_LABELS/);
  assert.match(tab, /data-permission="Comercial\.orcamento\.versionar"/);
  assert.match(page, /createInContext/);
  assert.match(page, /OrcamentosTab[\s\S]*createInContext/);
});
test('versionar exige permissao e estado EM_ABERTO', () => {
  const allow = (module, section, action) => module === 'Comercial' && section === 'orcamento' && action === 'versionar';
  assert.equal(canUseOrcamentoAction(allow, 'versionar', 'EM_ABERTO'), true);
  assert.equal(canUseOrcamentoAction(allow, 'versionar', 'SUPERSEDIDO'), false);
  const payload = buildOrcamentoVersionPayload({
    cliente_empresa_id: 'cliente-empresa-1',
    condicao_pagamento_id: 'condicao-1',
    validade_em: '2027-01-31T00:00:00.000Z',
    itens: form().itens,
  });
  assert.equal(payload.cliente_empresa_id, 'cliente-empresa-1');
  assert.equal(payload.itens.length, 1);
});
