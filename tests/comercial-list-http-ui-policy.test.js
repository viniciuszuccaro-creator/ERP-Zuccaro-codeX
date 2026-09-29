import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  ORCAMENTO_LIST_FILTER_DEFAULTS,
  PEDIDO_LIST_FILTER_DEFAULTS,
  formatComercialHttpError,
  formatHttpListEmptyMessage,
  isHttpListQueryKeyScoped,
  buildHttpListQueryKey,
  buildOrcamentoListRequestParams,
  buildPedidoListRequestParams,
  hasActiveComercialListFilters,
  normalizeOrcamentoListFilters,
  normalizePedidoListFilters,
  resolveHttpListViewState,
  resolveHttpMasterPickerState,
  formatMasterPickerPlaceholder,
  buildMastersHttpBannerText,
  isMasterPickerBlocked,
  sanitizeListSearchText,
  sanitizeObservacoesText,
} from '../src/components/comercial/comercialListHttpUiPolicy.js';
import { buildOrcamentoPayload } from '../src/components/comercial/orcamentoUiPolicy.js';
import { buildPedidoPayload } from '../src/components/comercial/pedidoUiPolicy.js';

test('resolveHttpListViewState: 403/5xx nunca viram empty', () => {
  assert.equal(resolveHttpListViewState({ isLoading: true, isError: false, rowCount: 0 }), 'loading');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 12 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 3 }), 'ready');
});

test('empty search result permanece empty — nunca error banner', () => {
  // Busca sem matches: rowCount=0 + isError=false → empty (não error)
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.match(
    formatHttpListEmptyMessage({ entityLabel: 'pedido', hasActiveFilters: true }),
    /filtros desta empresa/i,
  );
  assert.match(
    formatHttpListEmptyMessage({ entityLabel: 'orçamento', hasActiveFilters: false }),
    /encontrado nesta empresa/i,
  );
  assert.doesNotMatch(formatHttpListEmptyMessage({ hasActiveFilters: true }), /permissão|servidor|comunicar/i);
  // 403/5xx continuam error mesmo com rowCount 0
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.match(formatComercialHttpError({ status: 403 }), /permissão/i);
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
});

test('sanitizeListSearchText e normalize filtros Orçamento/Pedido', () => {
  assert.equal(sanitizeListSearchText('  42  '), '42');
  assert.equal(sanitizeListSearchText('<b>12</b>'), 'b12/b');
  assert.equal(sanitizeListSearchText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizeListSearchText(''), '');
  const orc = normalizeOrcamentoListFilters({
    search: '  <x>99</x>  ',
    status: 'EM_ABERTO',
    clienteEmpresaId: 'ce-1',
    validadeDe: '2027-01-01',
    validadeAte: 'bad',
  });
  assert.equal(orc.search, 'x99/x');
  assert.equal(orc.status, 'EM_ABERTO');
  assert.equal(orc.clienteEmpresaId, 'ce-1');
  assert.equal(orc.validadeDe, '2027-01-01');
  assert.equal(orc.validadeAte, '');
  const ped = normalizePedidoListFilters({
    search: '  7  ',
    status: 'FATURADO',
    clienteEmpresaId: 'TODOS',
    tipoOperacao: 'ENTREGA',
  });
  assert.deepEqual(ped, {
    search: '7',
    status: 'FATURADO',
    clienteEmpresaId: 'TODOS',
    tipoOperacao: 'ENTREGA',
  });
  assert.equal(hasActiveComercialListFilters(orc, ORCAMENTO_LIST_FILTER_DEFAULTS), true);
  assert.equal(hasActiveComercialListFilters(ORCAMENTO_LIST_FILTER_DEFAULTS, ORCAMENTO_LIST_FILTER_DEFAULTS), false);
  assert.equal(hasActiveComercialListFilters(PEDIDO_LIST_FILTER_DEFAULTS, PEDIDO_LIST_FILTER_DEFAULTS), false);
});

test('build list request params omite TODOS e inclui search sanitizado', () => {
  const orcParams = buildOrcamentoListRequestParams(
    normalizeOrcamentoListFilters({ search: '10', status: 'TODOS', clienteEmpresaId: 'ce', validadeDe: '', validadeAte: '' }),
    { page: 2, pageSize: 10 },
  );
  assert.equal(orcParams.limit, 10);
  assert.equal(orcParams.offset, 10);
  assert.equal(orcParams.search, '10');
  assert.equal(orcParams.clienteEmpresaId, 'ce');
  assert.equal(orcParams.status, undefined);
  const pedParams = buildPedidoListRequestParams(
    normalizePedidoListFilters({ search: '', status: 'EM_ABERTO', tipoOperacao: 'RETIRADA' }),
    { page: 1, pageSize: 20 },
  );
  assert.equal(pedParams.search, undefined);
  assert.equal(pedParams.status, 'EM_ABERTO');
  assert.equal(pedParams.tipoOperacao, 'RETIRADA');
  assert.equal(pedParams.offset, 0);
});

test('formatComercialHttpError distingue 403, 5xx e rede sem mascarar como vazio', () => {
  assert.match(formatComercialHttpError({ status: 403 }), /permissão/i);
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
  assert.match(formatComercialHttpError({ status: 503 }), /servidor/i);
  assert.match(formatComercialHttpError({ message: 'Failed to fetch' }), /comunicar com o servidor/i);
  assert.match(formatComercialHttpError({ status: 404 }, { entityLabel: 'Pedido' }), /Pedido/i);
  assert.match(
    formatComercialHttpError({ status: 409 }, { conflictMessage: 'O orçamento foi alterado e não está mais em aberto.' }),
    /não está mais em aberto/i,
  );
  assert.match(
    formatComercialHttpError({
      status: 403,
      body: { error: { code: 'DESCONTO_ALCADA_DENIED', message: 'exige permissão de aprovar' } },
    }, { entityLabel: 'Orçamento' }),
    /alçada/i,
  );
  assert.doesNotMatch(formatComercialHttpError({ status: 403 }), /nenhum|vazio|encontrado nesta empresa/i);
  assert.doesNotMatch(formatComercialHttpError({ status: 500 }), /nenhum|vazio|encontrado nesta empresa/i);
});

test('queryKey list HTTP exige groupId + empresaId + filters', () => {
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e1', 1], { prefix: 'pedidos-http' }), true);
  assert.equal(isHttpListQueryKeyScoped(['orcamentos-http', 'g1', 'e1'], {
    prefix: 'orcamentos-http', groupId: 'g1', empresaId: 'e1',
  }), true);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1'], { prefix: 'pedidos-http' }), false);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e2'], {
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1',
  }), false);
  const filters = normalizePedidoListFilters({ search: '9' });
  const key = buildHttpListQueryKey({
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1', page: 1, pageSize: 20, filters,
  });
  assert.equal(isHttpListQueryKeyScoped(key, {
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1', requireFilters: true, filters,
  }), true);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e1', 1, 20], {
    prefix: 'pedidos-http', requireFilters: true,
  }), false);
  assert.equal(isHttpListQueryKeyScoped(key, {
    prefix: 'pedidos-http', filters: normalizePedidoListFilters({ search: 'other' }),
  }), false);
});

test('sanitizeObservacoesText remove markup perigoso', () => {
  assert.equal(sanitizeObservacoesText('  ok  '), 'ok');
  assert.equal(sanitizeObservacoesText('<script>alert(1)</script>nota'), 'scriptalert(1)/scriptnota');
  assert.equal(sanitizeObservacoesText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizeObservacoesText(''), '');
});

test('payload Orçamento/Pedido sanitiza observacoes no save', () => {
  const orc = buildOrcamentoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    validade_em: '2027-01-01',
    observacoes: '  <b>proposta</b>  ',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0',
    }],
  });
  assert.equal(orc.observacoes, 'bproposta/b');
  const ped = buildPedidoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-01-01',
    observacoes: '<img onerror=x>livre',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0', requer_producao: false,
    }],
  });
  assert.equal(ped.observacoes, 'img onerror=xlivre');
});

test('painéis Pedido/Orçamento usam list search/filter fail-closed e queryKey tenant+filters', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  for (const source of [pedido, orcamento]) {
    assert.match(source, /resolveHttpListViewState/);
    assert.match(source, /formatComercialHttpError/);
    assert.match(source, /formatHttpListEmptyMessage/);
    assert.match(source, /hasActiveComercialListFilters/);
    assert.match(source, /buildHttpListQueryKey/);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /masters-error|Masters não carregados|não trate como lista vazia/);
    assert.match(source, /resolveHttpMasterPickerState/);
    assert.match(source, /formatMasterPickerPlaceholder/);
    assert.match(source, /buildMastersHttpBannerText/);
    assert.match(source, /isMasterPickerBlocked/);
    assert.match(source, /masters-form-banner/);
    assert.match(source, /data-empty-filtered/);
  }
  assert.match(pedido, /normalizePedidoListFilters/);
  assert.match(pedido, /buildPedidoListRequestParams/);
  assert.match(pedido, /PEDIDO_LIST_FILTER_DEFAULTS/);
  assert.match(orcamento, /normalizeOrcamentoListFilters/);
  assert.match(orcamento, /buildOrcamentoListRequestParams/);
  assert.match(orcamento, /ORCAMENTO_LIST_FILTER_DEFAULTS/);
  assert.match(pedido, /prefix:\s*'pedidos-http'|prefix:'pedidos-http'/);
  assert.match(orcamento, /prefix:\s*'orcamentos-http'/);
  assert.match(pedido, /pedido-list-error/);
  assert.match(orcamento, /orcamento-list-error/);
  assert.match(pedido, /listView\s*===\s*'error'|listView==='error'/);
  assert.match(orcamento, /listView === 'error'/);
  assert.match(pedido, /pedido-condicao-picker/);
  assert.match(pedido, /pedido-tabela-picker/);
  assert.match(pedido, /pedido-produto-picker/);
  assert.match(pedido, /pedido-cliente-picker/);
  assert.match(orcamento, /orcamento-condicao-picker/);
  assert.match(orcamento, /orcamento-produto-picker/);
  assert.match(orcamento, /orcamento-cliente-picker/);
  assert.match(pedido, /canLoadTabelasPrecoHttp/);
  assert.match(orcamento, /canLoadCondicoesPagamentoHttp/);
  // erro não colapsa no empty state
  assert.doesNotMatch(pedido, /list\.isError\s*\?\s*rows\.length/);
  assert.doesNotMatch(orcamento, /listQuery\.isError\s*\?\s*rows\.length/);
});

test('resolveHttpMasterPickerState: 403/5xx e denied nunca viram empty silencioso', () => {
  assert.equal(resolveHttpMasterPickerState({ isLoading: true, isError: false, rowCount: 0 }), 'loading');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: true, rowCount: 5 }), 'error');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 0, allowed: false }), 'denied');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 2 }), 'ready');
});

test('formatMasterPickerPlaceholder e banner masters não mascaram erro como vazio', () => {
  assert.equal(formatMasterPickerPlaceholder('loading'), 'Carregando...');
  assert.equal(formatMasterPickerPlaceholder('error'), 'Falha ao carregar');
  assert.equal(formatMasterPickerPlaceholder('denied'), 'Sem permissão');
  assert.match(formatMasterPickerPlaceholder('empty', 'produto'), /Nenhum produto/);
  assert.equal(formatMasterPickerPlaceholder('ready'), 'Selecione');
  assert.match(buildMastersHttpBannerText({ status: 403 }), /permissão/i);
  assert.match(buildMastersHttpBannerText({ status: 403 }), /não trate como lista vazia/i);
  assert.match(buildMastersHttpBannerText({ status: 500 }), /servidor/i);
  assert.doesNotMatch(buildMastersHttpBannerText({ status: 403 }), /nenhum encontrado nesta empresa/i);
  assert.equal(isMasterPickerBlocked({ isLoading: true, isError: false }), true);
  assert.equal(isMasterPickerBlocked({ isLoading: false, isError: true }), true);
  assert.equal(isMasterPickerBlocked({ isLoading: false, isError: false }), false);
});
