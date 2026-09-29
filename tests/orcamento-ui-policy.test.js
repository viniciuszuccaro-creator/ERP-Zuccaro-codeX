import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildOrcamentoPayload,
  buildOrcamentoShareText,
  calculateItem,
  calculateTotals,
  canUseOrcamentoAction,
  isOrcamentoValidadeExpirada,
  mapOrcamentoRowToForm,
  microsToDecimal,
  orcamentoConvertSnapshotHint,
  orcamentoValidadeHint,
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

test('payload inclui refs de promoção quando a simulação aplicada confirma', () => {
  const payload = buildOrcamentoPayload(form(), {
    promocao: { aplicada: true, bps: 500, cupom: 'CPA10' },
  });
  assert.deepEqual(payload.promocao, { bps: 500, cupom: 'CPA10' });
  const fromPersisted = buildOrcamentoPayload({
    ...form(),
    promocao_aplicada: true,
    promocao_bps: 250,
    promocao_cupom: 'VIP5',
  });
  assert.deepEqual(fromPersisted.promocao, { bps: 250, cupom: 'VIP5' });
  assert.equal('promocao' in buildOrcamentoPayload(form()), false);
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
  assert.throws(
    () => buildOrcamentoPayload({ ...form(), validade_em: '2020-01-01' }, { now: new Date('2026-09-29T15:00:00.000Z') }),
    /Validade expirada/i,
  );
});

test('hint e detecção de validade expirada no UI policy', () => {
  const now = new Date('2026-09-29T15:00:00.000Z');
  assert.equal(isOrcamentoValidadeExpirada('2020-01-01', now), true);
  assert.equal(isOrcamentoValidadeExpirada('2027-01-01', now), false);
  assert.match(orcamentoValidadeHint('2020-01-01', now), /expirada/i);
  assert.equal(orcamentoValidadeHint('2027-01-01', now), null);
});

test('hint de convert snapshot incompleto (pós-031) no UI policy', () => {
  assert.match(
    String(orcamentoConvertSnapshotHint({
      tabela_preco_id: '55555555-5555-4555-8555-555555555555',
    })),
    /tabela/i,
  );
  assert.match(
    String(orcamentoConvertSnapshotHint({
      condicao_pagamento_codigo_snapshot: 'SNAP',
      condicao_pagamento_nome_snapshot: '',
    })),
    /condição/i,
  );
  assert.equal(orcamentoConvertSnapshotHint({
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: '55555555-5555-4555-8555-555555555555',
    tabela_preco_codigo_snapshot: 'TAB',
    tabela_preco_nome_snapshot: 'Tabela',
    promocao_aplicada: false,
  }), null);
  assert.equal(orcamentoConvertSnapshotHint({ condicao_pagamento_id: 'x' }), null);
});

test('tela contempla estados, detalhe, edicao, confirmacao e invalidacao por empresa', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const listPolicy = await readFile(new URL('../src/components/comercial/comercialListHttpUiPolicy.js', import.meta.url), 'utf8');
  assert.match(tab, /Carregando orçamentos/);
  assert.match(tab, /formatHttpListEmptyMessage/);
  assert.match(tab, /listEmptyMessage/);
  assert.match(listPolicy, /Nenhum \$\{entity\} encontrado para os filtros desta empresa/);
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
  assert.match(tab, /orcamentoValidadeHint|Comercial\.orcamento\.validade-hint/);
  assert.match(listPolicy, /ORCAMENTO_VALIDADE_EXPIRADA/);
  assert.match(tab, /formatComercialHttpError|resolveHttpListViewState/);
  assert.match(tab, /isOrcamentoValidadeExpirada/);
  assert.match(tab, /orcamentoConvertSnapshotHint|Comercial\.orcamento\.convert-snapshot-hint/);
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

test('mapOrcamentoRowToForm recarrega campos canônicos sem inventar snapshots', () => {
  const mapped = mapOrcamentoRowToForm({
    id: 'o1',
    numero: '00000001',
    cliente_empresa_id: 'ce',
    condicao_pagamento_id: 'cp',
    validade_em: '2026-12-01T12:00:00.000Z',
    observacoes: 'ok',
    condicao_pagamento_nome_snapshot: '28 dias',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'X', unidade_sigla: 'UN',
      quantidade: '1.000000', preco_unitario: '10.000000', desconto: '0.000000',
    }],
  });
  assert.equal(mapped.cliente_empresa_id, 'ce');
  assert.equal(mapped.condicao_pagamento_id, 'cp');
  assert.equal(mapped.validade_em, '2026-12-01');
  assert.equal(mapped.observacoes, 'ok');
  assert.equal(mapped.itens.length, 1);
  assert.equal('condicao_pagamento_nome_snapshot' in mapped, false);
  assert.equal('numero' in mapped, false);
});