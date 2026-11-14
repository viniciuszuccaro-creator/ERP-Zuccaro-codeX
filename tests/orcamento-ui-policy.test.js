import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildOrcamentoPayload,
  buildOrcamentoShareText,
  mapOrcamentoRowToCreateDraft,
  revalidateOrcamentoDraftAgainstMasters,
  resolveOrcamentoHistorySources,
  calculateItem,
  calculateTotals,
  canUseOrcamentoAction,
  createOrcamentoActionGate,
  microsToDecimal,
} from '../src/components/comercial/orcamentoUiPolicy.js';

test('revalidacao conserva 100KG/preco e nao preenche unidade historica desconhecida', () => {
  const masters={produtos:[{id:'p',unidade_medida_id:'un'}],unidades:[{id:'kg',sigla:'KG'},{id:'un',sigla:'UN'}]};
  const original={itens:[{produto_id:'p',unidade_id:'kg',unidade_sigla:'KG',quantidade:'100',preco_unitario:'0',desconto:'0'}]};
  const checked=revalidateOrcamentoDraftAgainstMasters(original,masters);
  assert.deepEqual(checked.draft.itens[0],{...original.itens[0],descricao:''});
  assert.deepEqual(checked.warnings.unidadesDivergentes,['kg']);
  assert.deepEqual(checked.warnings.unidadesAusentes,[]);
  const unknown=revalidateOrcamentoDraftAgainstMasters({itens:[{produto_id:'p',quantidade:'100'}]},masters);
  assert.equal(unknown.draft.itens[0].unidade_id,'');assert.equal(unknown.draft.itens[0].unidade_sigla,'');
  assert.equal(unknown.draft.itens[0].preco_unitario,undefined);
  assert.deepEqual(unknown.warnings.unidadesAusentes,['p']);
  assert.equal(original.itens[0].unidade_id,'kg');
});

test('fontes de historico independentes distinguem 403, sessao expirada, vazio e envelope invalido',()=>{
  const quote={id:'quote',itens:[]},fulfilled=value=>({status:'fulfilled',value});
  const partial=resolveOrcamentoHistorySources({pedido:{status:'rejected',reason:{status:403}},orcamento:fulfilled({data:[quote]})});
  assert.deepEqual(partial.orcamento,[quote]);assert.deepEqual(partial.unavailableSources,['pedido']);
  assert.deepEqual(resolveOrcamentoHistorySources({pedido:{skipped:true},orcamento:fulfilled({data:[]})}),{pedido:[],orcamento:[],unavailableSources:[]});
  assert.throws(()=>resolveOrcamentoHistorySources({pedido:{status:'rejected',reason:{status:401}},orcamento:fulfilled({data:[quote]})}),{status:401});
  assert.throws(()=>resolveOrcamentoHistorySources({pedido:{skipped:true},orcamento:fulfilled({data:null})}),/RESPONSE_INVALID/);
  assert.throws(()=>resolveOrcamentoHistorySources({pedido:{status:'rejected',reason:{status:500}},orcamento:{status:'rejected',reason:{status:403}}}),{status:500});
  const invalid=resolveOrcamentoHistorySources({pedido:fulfilled({count:0}),orcamento:fulfilled({data:[quote]})});
  assert.deepEqual(invalid.unavailableSources,['pedido']);assert.deepEqual(invalid.orcamento,[quote]);
});

test('Orçamento trava duplo clique e descarta resposta antiga após CPA→3Z', () => {
  const gate = createOrcamentoActionGate();
  const cpa = { groupId: 'g', empresaId: 'cpa', actorId: 'u' };
  const tresZ = { groupId: 'g', empresaId: '3z', actorId: 'u' };
  const first = gate.begin(cpa, cpa, cpa);
  assert.ok(first);
  assert.equal(gate.begin(cpa, cpa, cpa), null);
  assert.equal(gate.isCurrent(first, cpa, tresZ), false);
  gate.invalidate();
  const second = gate.begin(tresZ, tresZ, tresZ);
  assert.ok(second);
  assert.equal(gate.end(first), false);
  assert.equal(gate.isCurrent(second, tresZ, tresZ), true);
  assert.equal(gate.end(second), true);
  assert.equal(gate.begin(cpa, tresZ, tresZ), null);
  assert.equal(gate.begin(cpa, cpa, { ...cpa, actorId: 'outro-usuario' }), null);
});

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
  const withTabela = buildOrcamentoPayload({ ...form(), tabela_preco_id: '11111111-1111-4111-8111-111111111111' });
  assert.equal(withTabela.tabela_preco_id, '11111111-1111-4111-8111-111111111111');
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
  const shell = await readFile(new URL('../src/components/comercial/CentralVendas360Shell.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  // Orçamentos vivem na Central (accessKeys pedido+orcamento); sem tile separado.
  assert.match(page, /accessKeys: \['pedido', 'orcamento'\]/);
  assert.match(page, /title: 'Central de Vendas360°'/);
  assert.match(shell, /OrcamentosTab/);
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
  assert.match(tab, /\[groupId, empresaId, actorId, sessionIdentity, proposalMode\]/);
  assert.match(tab, /invalidateQueries\(\{ queryKey: \['orcamentos-http', groupId, empresaId\]/);
  assert.match(tab, /comercialMasterPicker/);
  assert.match(tab, /orcamento-busca-cliente/);
  assert.match(tab, /orcamento-busca-produto/);
  assert.match(tab, /orcamento-tabela-preco/);
  assert.match(tab, /tabela_preco_id/);
  assert.match(tab, /http\.comercialMasters\.list/);
  assert.match(tab, /resolveComercialMasterPages/);
  // Salvamento → reabre detalhe com gravado; tabela visível (≠ inventar; ausente=Não informada/Desconhecida).
  assert.match(tab, /setDetailOpen\(true\)/);
  assert.match(tab, /orcamento-detalhe-tabela-preco/);
  assert.match(tab, /tabelaLabel/);
  assert.match(tab, /Não informada/);
  assert.match(tab, /Desconhecida/);
  assert.match(tab, /openEdit[\s\S]*tabela_preco_id: row\.tabela_preco_id/);
  const transport = await readFile(new URL('../src/api/httpApiClient.js', import.meta.url), 'utf8');
  assert.ok(transport.includes("request('/api/v1/tabelas-preco'"));
  assert.match(tab, /ORCAMENTO_PERSISTENCE_GAPS/);
});
test('preparacao de compartilhamento usa somente resumo comercial revisavel', () => {
  const text = buildOrcamentoShareText({ numero: '00000042', status: 'EM_ABERTO', validade_em: '2027-01-31T00:00:00.000Z', total: '125.500000' }, { empresaNome: 'Empresa Sintetica', clienteNome: 'Cliente Sintetico' });
  assert.match(text, /Orçamento 00000042/);
  assert.match(text, /Cliente Sintetico/);
  assert.match(text, /R\$\s*125,50/);
  assert.doesNotMatch(text, /groupId|empresaId|actorId|token/i);
});

test('impressao de orcamento escapa campos livres e nao depende de credencial externa', async () => {
  const source = await readFile(new URL('../src/components/lib/exportacaoPDF.jsx', import.meta.url), 'utf8');
  assert.match(source, /export function gerarPDFOrcamento/);
  assert.match(source, /escapeDocumentText\(item\.descricao\)/);
  assert.match(source, /escapeDocumentText\(orcamento\.observacoes/);
  assert.match(source, /printWindow\.opener = null/);
  assert.doesNotMatch(source, /api[_-]?key|access[_-]?token|service[_-]?role/i);
});

test('duplicar: draft sem id/número; validade limpa; revalida mestres sem inventar preço', () => {
  const draft = mapOrcamentoRowToCreateDraft({
    id: 'orc-1',
    numero: '00000099',
    status: 'EM_ABERTO',
    cliente_empresa_id: 'ce-1',
    condicao_pagamento_id: 'cond-old',
    tabela_preco_id: 'tab-1',
    validade_em: '2027-05-01T12:00:00.000Z',
    observacoes: 'obs',
    itens: [{
      id: 'item-1',
      produto_id: 'prod-1',
      unidade_id: 'un-1',
      descricao: 'Antiga',
      unidade_sigla: 'KG',
      quantidade: '2',
      preco_unitario: '10.5',
      desconto: '0',
    }],
  });
  assert.equal(draft.cliente_empresa_id, 'ce-1');
  assert.equal(draft.validade_em, '');
  assert.equal(draft.itens[0].produto_id, 'prod-1');
  assert.equal(draft.itens[0].preco_unitario, '10.5');
  assert.doesNotMatch(JSON.stringify(draft), /orc-1|00000099|EM_ABERTO|item-1/);

  const checked = revalidateOrcamentoDraftAgainstMasters(draft, {
    produtos: [{ id: 'prod-1', descricao: 'Atualizada', unidade_medida_id: 'un-2' }],
    unidades: [{ id: 'un-2', sigla: 'UN' }],
    condicoes: [{ id: 'cond-new' }],
  });
  assert.equal(checked.draft.itens[0].descricao, 'Atualizada');
  assert.equal(checked.draft.itens[0].unidade_id, 'un-1');
  assert.equal(checked.draft.itens[0].unidade_sigla, 'KG');
  assert.equal(checked.draft.itens[0].quantidade, '2');
  assert.equal(checked.draft.itens[0].preco_unitario, '10.5');
  assert.equal(checked.warnings.condicaoAusente, true);
  assert.deepEqual(checked.warnings.produtosAusentes, []);
  assert.deepEqual(checked.warnings.unidadesAusentes, ['un-1']);
});
